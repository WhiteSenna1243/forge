// Daily targets from a profile (Mifflin-St Jeor). Shared by the browser and the tests.
export const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 };
export const PACES = { lose: [0.5, 1, 1.5, 2], gain: [0.25, 0.5, 0.75] }; // lb per week
const DEFAULT_PACE = { lose: 1, gain: 0.5 };
const KCAL_PER_LB_PER_WEEK = 500; // ~3500 kcal per lb, spread over 7 days

export function targets(p) {
  const kg = p.weightLb * 0.4536, cm = p.heightIn * 2.54;
  const bmr = 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const maintenance = Math.round(bmr * (ACTIVITY[p.activity] || 1.2));
  const floor = p.sex === 'male' ? 1500 : 1200;
  const dir = p.goal === 'lose' ? -1 : p.goal === 'gain' ? 1 : 0;
  let calories;
  if (p.calorieGoal > 0) calories = Math.round(p.calorieGoal);
  else {
    const wanted = dir ? Number(p.pace) || DEFAULT_PACE[p.goal] : 0;
    const pace = Math.min(wanted, p.weightLb * 0.01); // more than ~1% of body weight a week isn't safe
    calories = Math.max(floor, Math.round(maintenance + dir * pace * KCAL_PER_LB_PER_WEEK));
  }
  const protein = Math.round(p.weightLb * (p.trainDays >= 3 ? 1 : 0.8)); // lifting 3+ days a week needs more protein
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  // The pace these calories actually give (after the safety caps), in lb/week.
  const pace = Math.round((Math.abs(calories - maintenance) / KCAL_PER_LB_PER_WEEK) * 100) / 100;
  return { calories, protein, carbs, fat, maintenance, pace };
}

// When the goal weight is reached at the current targets, or why it can't be shown.
export function goalETA(p, now = new Date()) {
  const goal = Number(p.goalWeightLb);
  if (!goal || p.goal === 'maintain') return null;
  const diff = goal - p.weightLb;
  if ((p.goal === 'lose' && diff >= 0) || (p.goal === 'gain' && diff <= 0)) return { mismatch: true };
  const { pace } = targets(p);
  if (!pace) return null;
  const weeks = Math.abs(diff) / pace;
  return { weeks: Math.ceil(weeks), date: new Date(now.getTime() + weeks * 7 * 864e5), pace, lbs: Math.abs(diff) };
}

export function sum(entries) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries) for (const k in t) t[k] += (Number(e[k]) || 0) * (Number(e.servings) || 1);
  for (const k in t) t[k] = Math.round(t[k]);
  return t;
}
