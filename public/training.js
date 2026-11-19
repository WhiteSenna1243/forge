// Workouts: exercise library, calories burned, personal records, progression, and the workout coach.
// The workout coach reads the nutrition side (cut/bulk, calories eaten) and the nutrition side reads
// the training plan (training days, protein needs), so the two coaches plan together.

// kind: strength | cardio | core. met: energy cost used for calories burned (Compendium of Physical Activities).
export const EXERCISES = [
  ['Barbell Back Squat', 'legs', 'gym', 'strength', 6], ['Goblet Squat', 'legs', 'db', 'strength', 5.5], ['Bodyweight Squat', 'legs', 'bw', 'strength', 5],
  ['Leg Press', 'legs', 'gym', 'strength', 5.5], ['Dumbbell Lunge', 'legs', 'db', 'strength', 5.5], ['Reverse Lunge', 'legs', 'bw', 'strength', 5],
  ['Romanian Deadlift', 'hamstrings', 'gym', 'strength', 6], ['Dumbbell Romanian Deadlift', 'hamstrings', 'db', 'strength', 5.5], ['Glute Bridge', 'hamstrings', 'bw', 'strength', 4],
  ['Deadlift', 'back', 'gym', 'strength', 6], ['Leg Curl', 'hamstrings', 'gym', 'strength', 4.5], ['Leg Extension', 'legs', 'gym', 'strength', 4.5], ['Calf Raise', 'calves', 'bw', 'strength', 4],
  ['Bench Press', 'chest', 'gym', 'strength', 5.5], ['Dumbbell Bench Press', 'chest', 'db', 'strength', 5.5], ['Push-up', 'chest', 'bw', 'strength', 5],
  ['Incline Dumbbell Press', 'chest', 'db', 'strength', 5.5], ['Cable Fly', 'chest', 'gym', 'strength', 4.5],
  ['Overhead Press', 'shoulders', 'gym', 'strength', 5.5], ['Dumbbell Shoulder Press', 'shoulders', 'db', 'strength', 5.5], ['Pike Push-up', 'shoulders', 'bw', 'strength', 5],
  ['Lateral Raise', 'shoulders', 'db', 'strength', 4],
  ['Lat Pulldown', 'back', 'gym', 'strength', 5], ['Pull-up', 'back', 'bw', 'strength', 6], ['Seated Cable Row', 'back', 'gym', 'strength', 5],
  ['One-Arm Dumbbell Row', 'back', 'db', 'strength', 5], ['Inverted Row', 'back', 'bw', 'strength', 5], ['Barbell Row', 'back', 'gym', 'strength', 5.5],
  ['Dumbbell Curl', 'biceps', 'db', 'strength', 4], ['Cable Curl', 'biceps', 'gym', 'strength', 4], ['Chin-up', 'biceps', 'bw', 'strength', 6],
  ['Triceps Pushdown', 'triceps', 'gym', 'strength', 4], ['Overhead Dumbbell Extension', 'triceps', 'db', 'strength', 4], ['Bench Dip', 'triceps', 'bw', 'strength', 4.5],
  ['Plank', 'core', 'bw', 'core', 4], ['Hanging Knee Raise', 'core', 'bw', 'core', 4], ['Crunch', 'core', 'bw', 'core', 3.8], ['Cable Crunch', 'core', 'gym', 'core', 4],
  ['Running', 'cardio', 'bw', 'cardio', 9.8], ['Brisk Walk', 'cardio', 'bw', 'cardio', 4.3], ['Incline Treadmill Walk', 'cardio', 'gym', 'cardio', 6],
  ['Cycling', 'cardio', 'gym', 'cardio', 7], ['Rowing Machine', 'cardio', 'gym', 'cardio', 7], ['Elliptical', 'cardio', 'gym', 'cardio', 5], ['Stair Climber', 'cardio', 'gym', 'cardio', 9],
  ['Jump Rope', 'cardio', 'bw', 'cardio', 11], ['Basketball', 'cardio', 'bw', 'cardio', 6.5], ['Swimming', 'cardio', 'gym', 'cardio', 7],
].map(([name, group, equip, kind, met]) => ({ name, group, equip, kind, met }));
export const exercise = name => EXERCISES.find(e => e.name.toLowerCase() === String(name).toLowerCase())
  || { name, group: 'other', equip: 'bw', kind: 'strength', met: 5 };

const LOWER = new Set(['legs', 'hamstrings', 'calves']);

// Calories burned: MET x kg x hours. Strength sessions count working time, not the whole visit.
export function caloriesBurned(met, minutes, weightLb) {
  return Math.round(met * weightLb * 0.4536 * (minutes / 60));
}

export function workoutCalories(workout, weightLb) {
  let total = 0;
  for (const ex of workout.exercises || []) {
    const info = exercise(ex.name);
    const done = (ex.sets || []).filter(s => s.done);
    if (info.kind === 'cardio') total += caloriesBurned(info.met, done.reduce((t, s) => t + (+s.minutes || 0), 0), weightLb);
    else total += caloriesBurned(info.met, done.length * 2, weightLb); // ~1 min of work + rest counted per set
  }
  return total;
}

// Estimated one-rep max (Epley) for personal records.
export const e1rm = (weight, reps) => (weight > 0 && reps > 0 ? Math.round(weight * (1 + Math.min(reps, 15) / 30)) : 0);

export function bestSet(sets) {
  let best = null;
  for (const s of sets || []) if (s.done && e1rm(+s.weight, +s.reps) > (best ? e1rm(+best.weight, +best.reps) : 0)) best = s;
  return best;
}

// Every logged session of one exercise, newest first: [{ date, sets }].
export function history(workouts, name) {
  const out = [];
  for (const [date, list] of Object.entries(workouts || {})) for (const w of list) for (const ex of w.exercises || [])
    if (ex.name.toLowerCase() === name.toLowerCase() && ex.sets?.some(s => s.done)) out.push({ date, sets: ex.sets.filter(s => s.done) });
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function personalRecord(workouts, name) {
  let pr = 0;
  for (const h of history(workouts, name)) for (const s of h.sets) pr = Math.max(pr, e1rm(+s.weight, +s.reps));
  return pr;
}

const range = reps => { const [lo, hi] = String(reps).split('-').map(Number); return { lo: lo || 8, hi: hi || lo || 12 }; };

// Progressive overload: what to lift next time, based on the last session.
export function nextTarget(workouts, name, reps = '8-12') {
  const info = exercise(name);
  if (info.kind !== 'strength') return null;
  const last = history(workouts, name)[0];
  const { lo, hi } = range(reps);
  if (!last) return { text: `Start light: pick a weight you can lift for ${hi} clean reps with 2 left in the tank.` };
  const top = Math.max(...last.sets.map(s => +s.weight || 0));
  const topSets = last.sets.filter(s => (+s.weight || 0) === top);
  if (!top) return { text: topSets.every(s => +s.reps >= hi) ? `Hit ${hi}+ every set last time. Add a harder variation or a weighted vest.` : `Aim for 1 more rep per set than last time.` };
  if (topSets.every(s => +s.reps >= hi)) {
    const step = info.equip === 'db' ? 5 : LOWER.has(info.group) ? 10 : 5;
    return { weight: top + step, text: `You hit ${hi}+ reps on every set at ${top} lb. Go up to ${top + step} lb and work back up from ${lo}.` };
  }
  if (topSets.some(s => +s.reps < lo - 2)) return { weight: top, text: `Last time some sets fell well short of ${lo}. Stay at ${top} lb and own the form.` };
  return { weight: top, text: `Stay at ${top} lb and beat last time's reps (${topSets.map(s => s.reps).join(', ')}).` };
}

// ---------- workout coach ----------
const PATTERNS = {
  squat: { gym: 'Barbell Back Squat', db: 'Goblet Squat', bw: 'Bodyweight Squat' },
  hinge: { gym: 'Romanian Deadlift', db: 'Dumbbell Romanian Deadlift', bw: 'Glute Bridge' },
  lunge: { gym: 'Leg Press', db: 'Dumbbell Lunge', bw: 'Reverse Lunge' },
  hpush: { gym: 'Bench Press', db: 'Dumbbell Bench Press', bw: 'Push-up' },
  ipush: { gym: 'Incline Dumbbell Press', db: 'Incline Dumbbell Press', bw: 'Push-up' },
  vpush: { gym: 'Overhead Press', db: 'Dumbbell Shoulder Press', bw: 'Pike Push-up' },
  hpull: { gym: 'Seated Cable Row', db: 'One-Arm Dumbbell Row', bw: 'Inverted Row' },
  vpull: { gym: 'Lat Pulldown', db: 'One-Arm Dumbbell Row', bw: 'Pull-up' },
  biceps: { gym: 'Cable Curl', db: 'Dumbbell Curl', bw: 'Chin-up' },
  triceps: { gym: 'Triceps Pushdown', db: 'Overhead Dumbbell Extension', bw: 'Bench Dip' },
  delts: { gym: 'Lateral Raise', db: 'Lateral Raise', bw: 'Pike Push-up' },
  hams: { gym: 'Leg Curl', db: 'Dumbbell Romanian Deadlift', bw: 'Glute Bridge' },
  calves: { gym: 'Calf Raise', db: 'Calf Raise', bw: 'Calf Raise' },
  core: { gym: 'Cable Crunch', db: 'Plank', bw: 'Plank' },
  cardio: { gym: 'Incline Treadmill Walk', db: 'Brisk Walk', bw: 'Brisk Walk' },
};
const SPLITS = {
  full: [['Full body A', ['squat', 'hpush', 'hpull', 'hinge', 'core']], ['Full body B', ['hinge', 'vpush', 'vpull', 'lunge', 'core']]],
  upperlower: [['Upper', ['hpush', 'hpull', 'vpush', 'vpull', 'biceps', 'triceps']], ['Lower', ['squat', 'hinge', 'lunge', 'calves', 'core']]],
  ppl: [['Push', ['hpush', 'vpush', 'ipush', 'delts', 'triceps']], ['Pull', ['vpull', 'hpull', 'biceps', 'core']], ['Legs', ['squat', 'hinge', 'lunge', 'hams', 'calves']]],
};
const SCHEMES = {
  strength: { sets: 5, reps: '3-5', rest: 180, label: 'get stronger' },
  muscle: { sets: 4, reps: '8-12', rest: 90, label: 'build muscle' },
  fatloss: { sets: 3, reps: '10-15', rest: 60, label: 'lose fat and keep muscle', cardio: 20 },
  endurance: { sets: 3, reps: '15-20', rest: 45, label: 'build endurance', cardio: 30 },
  general: { sets: 3, reps: '8-12', rest: 75, label: 'get fit overall', cardio: 10 },
};
const DAY_SETS = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] };
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FOCUS = [[/\b(arms?|biceps?|triceps?)\b/, ['biceps', 'triceps']], [/\bchest|pecs?\b/, ['ipush']], [/\bshoulders?|delts?\b/, ['delts']],
  [/\bback|lats?\b/, ['vpull']], [/\blegs?|quads?\b/, ['lunge']], [/\bglutes?|butt|booty\b/, ['hinge']], [/\babs?|core\b/, ['core']]];
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

export function parseWorkoutGoal(text) {
  const t = String(text).toLowerCase();
  const g = {};
  if (/\b(strong|strength|powerlift|1 ?rm|max)\b/.test(t)) g.goal = 'strength';
  else if (/\b(muscle|bigger|bulk|hypertroph|build|gains?|size|mass)\b/.test(t)) g.goal = 'muscle';
  else if (/\b(lose|fat|cut|lean|tone|shred|weight loss|slim)\b/.test(t)) g.goal = 'fatloss';
  else if (/\b(run|running|endurance|cardio|stamina|marathon|5k|10k)\b/.test(t)) g.goal = 'endurance';
  const d = t.match(/\b(\d|one|two|three|four|five|six)\s*(?:days?|x|times)\b/);
  if (d) g.days = Math.min(6, Math.max(1, NUM[d[1]] || +d[1]));
  if (/\b(no equipment|bodyweight|body weight|at home|home|dorm|no gym)\b/.test(t)) g.equip = 'bw';
  if (/\bdumbbells?\b/.test(t)) g.equip = 'db';
  if (/\b(gym|barbell|machines?|rec center|ucrc)\b/.test(t)) g.equip = 'gym';
  if (/\b(beginner|new|never|first time|just starting)\b/.test(t)) g.level = 'beginner';
  else if (/\b(advanced|years|experienced)\b/.test(t)) g.level = 'advanced';
  g.focus = FOCUS.filter(([re]) => re.test(t)).flatMap(([, p]) => p);
  return g;
}

// Build a weekly plan. nutrition: { goal: 'lose'|'maintain'|'gain', eatenToday, targetToday } from the food side.
export function buildPlan(text, { profileGoal = 'maintain', saved = {}, nutrition = {} } = {}) {
  const p = parseWorkoutGoal(text);
  const goal = p.goal || saved.goal || (profileGoal === 'lose' ? 'fatloss' : profileGoal === 'gain' ? 'muscle' : 'general');
  const days = p.days || saved.days || 3;
  const equip = p.equip || saved.equip || 'gym';
  const level = p.level || saved.level || 'intermediate';
  const scheme = { ...SCHEMES[goal] };
  const notes = [];
  if (level === 'beginner') { scheme.sets = Math.max(2, scheme.sets - 1); notes.push('Beginner plan: fewer sets so you can learn the moves and recover. Add a set per exercise after 4 weeks.'); }
  // Working together with the nutrition coach:
  if (profileGoal === 'lose' && (goal === 'muscle' || goal === 'strength')) {
    scheme.sets = Math.min(scheme.sets, 3);
    notes.push('Your nutrition goal is a cut, so volume is capped at 3 sets: keep the weights heavy to hold on to muscle while you lose fat.');
  }
  if (profileGoal === 'gain' && goal === 'fatloss') notes.push('Heads up: your nutrition goal is a bulk but this asks for fat loss. Change one of them so the coaches agree.');
  if (profileGoal === 'gain') scheme.cardio = Math.min(scheme.cardio || 0, 10);
  const split = days <= 3 ? 'full' : days === 4 ? 'upperlower' : 'ppl';
  const weekdays = DAY_SETS[days];
  const plan = weekdays.map((wd, i) => {
    const [name, patterns] = SPLITS[split][i % SPLITS[split].length];
    const list = [...patterns, ...p.focus.filter(f => !patterns.includes(f)).slice(0, 1)];
    const exercises = list.map(k => PATTERNS[k][equip]).filter((n, j, a) => a.indexOf(n) === j)
      .map(n => ({ name: n, sets: exercise(n).kind === 'core' ? 3 : scheme.sets, reps: exercise(n).kind === 'core' ? (n === 'Plank' ? '30-60s' : '12-15') : scheme.reps }));
    if (scheme.cardio) exercises.push({ name: PATTERNS.cardio[equip], sets: 1, reps: `${scheme.cardio} min`, cardio: true });
    return { weekday: wd, name, exercises };
  });
  if (p.focus.length) notes.push(`Extra work added for ${[...new Set(p.focus)].join(' and ').replace('ipush', 'chest').replace('vpull', 'back').replace('hinge', 'glutes').replace('lunge', 'legs').replace('delts', 'shoulders')}.`);
  notes.push(`Rest about ${scheme.rest >= 120 ? `${scheme.rest / 60} min` : `${scheme.rest} s`} between sets. Log every set so I can tell you when to add weight.`);
  if (nutrition.targetToday && nutrition.eatenToday != null && nutrition.eatenToday < nutrition.targetToday * 0.4 && new Date().getHours() >= 15)
    notes.push(`You've only eaten ${nutrition.eatenToday} kcal today. Have a snack with carbs and protein before training.`);
  const summary = `${days} days a week to ${scheme.label}: ${split === 'full' ? 'full-body' : split === 'upperlower' ? 'upper/lower' : 'push/pull/legs'} workouts, ${scheme.sets} sets of ${scheme.reps} reps${scheme.cardio ? `, plus ${scheme.cardio} min of cardio` : ''}, using ${equip === 'gym' ? 'gym equipment' : equip === 'db' ? 'dumbbells' : 'just your bodyweight'}.`;
  return { goal, days, equip, level, scheme, plan, summary, notes };
}

export const todaysPlan = (plan, date = new Date()) => plan?.plan?.find(d => d.weekday === date.getDay()) || null;
// Strength days per week in the plan; the nutrition side raises protein when it's 3 or more.
export const strengthDays = plan => (plan?.plan || []).filter(d => d.exercises.some(e => !e.cardio)).length;
