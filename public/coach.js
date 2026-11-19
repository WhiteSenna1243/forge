// Free, offline goal coach: reads a goal sentence, sets daily targets, and builds meals from the campus menu.
import { targets, sum } from './calc.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10, twelve: 12 };
const EVENTS = [[/spring break/, 2, 7], [/summer/, 4, 10], [/winter break|christmas/, 11, 15], [/thanksgiving/, 10, 26], [/new year/, 0, 1]];
const MEAL_WORDS = [[/breakfast|morning/, 'Breakfast'], [/lunch/, 'Lunch'], [/dinner|tonight|supper/, 'Dinner'], [/late night|snack/, 'Snacks']];
const MEAL_SHARE = { Breakfast: 0.25, Lunch: 0.35, Dinner: 0.4, Snacks: 0.15 };
// Which Dine On Campus periods can serve each meal.
const SERVES = { Breakfast: ['breakfast', 'brunch', 'every day'], Lunch: ['lunch', 'brunch', 'every day'], Dinner: ['dinner', 'every day'], Snacks: ['late night', 'every day'] };
// Condiments, toppings and desserts are menu items too; never build a meal from them.
const SKIP = /dressing|sauce|\boil\b|syrup|honey|butter|cream cheese|gravy|glaze|relish|spread|salsa|seasoning|crouton|\bdip\b|ketchup|mayo|mustard|shredded|sliced (red )?onion|olives|tortilla|pie\b|cake|cookie|donut|muffin|danish|cobbler|brownie|frosting/i;
const SIDE = /salad|vegetable|veggie|broccoli|green bean|spinach|carrot|fruit|apple|banana|berr|grape|melon|orange|rice|potato|beans|quinoa|oat|yogurt/i;

// Used when no campus menu is imported. Tags use Dine On Campus's label names.
const V = 'Vegetarian', VG = 'Vegan';
const BASICS = [
  ['Grilled chicken breast', '4 oz', 185, 35, 0, 4, 'LD', 'Poultry'], ['Scrambled eggs', '2 eggs', 180, 12, 2, 13, 'B', `${V} Egg`],
  ['Greek yogurt, plain nonfat', '1 cup', 130, 23, 9, 0, 'BS', `${V} Milk`], ['Oatmeal', '1 cup cooked', 160, 6, 28, 3, 'B', `${V} ${VG} Gluten`],
  ['Banana', '1 medium', 105, 1, 27, 0, 'BS', `${V} ${VG}`], ['Turkey sandwich on wheat', '1 sandwich', 330, 24, 36, 9, 'L', 'Poultry Wheat Gluten'],
  ['Brown rice', '1 cup', 215, 5, 45, 2, 'LD', `${V} ${VG}`], ['Steamed broccoli', '1 cup', 55, 4, 11, 1, 'LD', `${V} ${VG}`],
  ['Garden salad, light dressing', '2 cups', 90, 2, 10, 5, 'LD', `${V} ${VG}`], ['Salmon fillet', '4 oz', 235, 25, 0, 14, 'D', 'Fish'],
  ['Black bean burrito bowl', '1 bowl', 520, 22, 75, 14, 'LD', `${V} Milk`], ['Apple', '1 medium', 95, 0, 25, 0, 'BS', `${V} ${VG}`],
  ['String cheese', '1 stick', 80, 7, 1, 5, 'S', `${V} Milk`], ['Protein shake', '1 bottle', 160, 30, 5, 3, 'BS', `${V} Milk Soy`],
  ['Peanut butter toast', '1 slice + 1 tbsp', 190, 7, 17, 10, 'BS', `${V} ${VG} Peanut Wheat Gluten`], ['Baked potato', '1 medium', 160, 4, 37, 0, 'D', `${V} ${VG}`],
  ['Tofu stir-fry', '1.5 cups', 300, 20, 18, 16, 'LD', `${V} ${VG} Soy`], ['Lentil soup', '1.5 cups', 230, 16, 38, 2, 'LD', `${V} ${VG}`],
].map(([name, portion, calories, protein, carbs, fat, m, tags]) => ({ name, portion, calories, protein, carbs, fat, m, tags: tags.split(' '), ingredients: '', location: 'Anywhere' }));

// Allergy and avoid words -> Dine On Campus labels.
const ALLERGENS = [[/peanut/, 'Peanut'], [/tree ?nut|\bnuts?\b|almond|pecan|walnut|cashew/, 'Tree Nuts'], [/shellfish|shrimp|crab|lobster/, 'Shellfish'],
  [/\bfish\b|seafood/, 'Fish'], [/\beggs?\b/, 'Egg'], [/\bsoy/, 'Soy'], [/sesame/, 'Sesame'], [/dairy|milk|lactose|cheese/, 'Milk'], [/gluten|wheat|celiac/, 'Gluten']];
const PORK_WORDS = ['pork', 'bacon', 'ham', 'sausage', 'pepperoni', 'salami', 'capicola', 'prosciutto', 'chorizo'];

// Diets, allergies and dislikes in plain words.
export function parsePrefs(text) {
  const t = String(text).toLowerCase().replace(/[‘’]/g, "'");
  const p = { diet: null, tags: new Set(), words: new Set(), labels: [] };
  if (/\bvegan\b|plant[- ]based/.test(t)) p.diet = 'Vegan';
  else if (/vegetarian|veggie diet|no meat|don'?t eat meat|without meat/.test(t)) p.diet = 'Vegetarian';
  else if (/pescatarian|pescetarian/.test(t)) { ['Beef', 'Pork', 'Poultry'].forEach(x => p.tags.add(x)); p.labels.push('pescatarian'); }
  if (p.diet) p.labels.push(p.diet.toLowerCase());
  if (/halal|no pork|don'?t eat pork|kosher/.test(t)) { p.tags.add('Pork'); PORK_WORDS.forEach(w => p.words.add(w)); p.labels.push('no pork'); }
  if (/no beef|don'?t eat beef/.test(t)) { p.tags.add('Beef'); p.words.add('beef'); p.labels.push('no beef'); }
  if (/gluten[- ]free|celiac|no gluten/.test(t)) { p.tags.add('Gluten').add('Wheat'); p.labels.push('gluten-free'); }
  if (/dairy[- ]free|lactose|no dairy/.test(t)) { p.tags.add('Milk'); p.labels.push('dairy-free'); }
  // "allergic to peanuts and shellfish", "peanut allergy"
  for (const m of t.matchAll(/allerg(?:ic|y|ies)\s+to\s+([a-z ,]+?)(?=[.;!?]|$|\bbut\b|\bwhat\b|\bhow\b)|([a-z]+(?: nut)?)\s+allerg(?:y|ies)/g)) {
    const what = m[1] || m[2];
    for (const [re, tag] of ALLERGENS) if (re.test(what)) { p.tags.add(tag); if (tag === 'Gluten') p.tags.add('Wheat'); p.labels.push(`no ${tag.toLowerCase()} (allergy)`); }
  }
  // "hate rice", "no mushrooms or onions", "don't like spicy food"
  const STOP = /^(the|any|a|an|eating|to|too|much|meat|pork|beef|dairy|gluten|time|idea|clue|more|than|longer)$/;
  for (const m of t.matchAll(/(?:\bno|\bhate|don'?t like|do not like|dislike|not a fan of|\bwithout|\bavoid|can'?t stand)\s+([a-z ,'-]+?)(?=[.;!?]|$|\bbut\b|\bwhat\b|\bhow\b|\bi\b|\bso\b|\bplease\b)/g)) {
    for (let w of m[1].split(/,|\band\b|\bor\b/)) {
      w = w.trim().replace(/^(the|any|eating)\s+/, '').replace(/\s+(food|foods|stuff)$/, '');
      if (!w || STOP.test(w) || w.split(' ').length > 3 || /\b(protein|calorie|carb|fat|dinner|lunch|breakfast|meal|snack|high|low|weight|pound|tonight|today)/.test(w)) continue;
      const stem = w.replace(/ies$/, 'y').replace(/oes$/, 'o').replace(/([^s])s$/, '$1');
      if (!p.words.has(stem)) { p.words.add(stem); p.labels.push(`no ${w}`); }
    }
  }
  return p;
}

export function allowed(item, p) {
  if (!p) return true;
  const tags = item.tags || [];
  if (p.diet === 'Vegan' && !tags.includes('Vegan')) return false;
  if (p.diet === 'Vegetarian' && !tags.includes('Vegetarian') && !tags.includes('Vegan')) return false;
  if (tags.some(x => p.tags.has(x))) return false;
  // With an allergy, an item with no labels can't be checked, so leave it out.
  if (!tags.length && [...p.tags].some(x => ALLERGENS.some(([, tag]) => tag === x))) return false;
  const text = `${item.name} ${item.ingredients || ''} ${tags.join(" ")}`.toLowerCase();
  for (const w of p.words) {
    const base = w.replace(/[^a-z ]/g, ''); // whole words, plural or not: rice, onions, berries, potatoes
    if (new RegExp(`\\b${base.endsWith('y') ? base.slice(0, -1) + '(y|ies)' : base + '(e?s)?'}\\b`).test(text)) return false;
  }
  return true;
}

export function parseGoal(text, now = new Date()) {
  const t = String(text).toLowerCase();
  const g = {};
  if (/\b(lose|losing|lost|cut|cutting|drop|shed|slim|lean out|weight loss|fat loss|burn fat)\b/.test(t)) g.direction = 'lose';
  else if (/\b(gain|gaining|bulk|bulking|build|bigger|put on|muscle)\b/.test(t)) g.direction = 'gain';
  else if (/\b(maintain|keep my weight|stay the same)\b/.test(t)) g.direction = 'maintain';

  const lb = t.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/);
  const kg = t.match(/(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?)\b/);
  if (lb) g.pounds = +lb[1]; else if (kg) g.pounds = +(kg[1] * 2.2046).toFixed(1);
  const p = t.match(/(\d{2,3})\s*g(?:rams?)?\s*(?:of\s+)?protein/) || t.match(/protein\D{0,12}(\d{2,3})\s*g/);
  if (p) g.protein = +p[1];
  const c = t.match(/(\d{3,4})\s*(?:k?cals?|calories)/);
  if (c) g.calories = +c[1];

  const inN = t.match(/in\s+(\d+|a|an|one|two|three|four|five|six|eight|ten|twelve)\s+(week|month)s?/);
  if (inN) g.weeks = (WORDS[inN[1]] || +inN[1]) * (inN[2] === 'month' ? 4.35 : 1);
  let target = null;
  const by = t.match(new RegExp(`by\\s+(${MONTHS.join('|')})[a-z]*\\.?\\s*(\\d{1,2})?`));
  if (by) target = [MONTHS.indexOf(by[1]), +(by[2] || 1)];
  for (const [re, m, d] of EVENTS) if (!target && re.test(t)) { target = [m, d]; g.guessed = re.source.split('|')[0]; }
  if (target && !g.weeks) {
    let date = new Date(now.getFullYear(), target[0], target[1]);
    if (date <= now) date = new Date(now.getFullYear() + 1, target[0], target[1]);
    g.weeks = (date - now) / (7 * 864e5);
    g.by = date;
  }
  for (const [re, meal] of MEAL_WORDS) if (re.test(t)) { g.meal = meal; break; }
  g.prefs = parsePrefs(t);
  return g;
}

function pickMeal(pool, budget, proteinGoal) {
  const ok = pool.filter(i => i.calories >= 30 && i.calories <= budget * 1.05 && (i.location === 'Anywhere' || !SKIP.test(i.name)));
  const chosen = []; let cal = 0, pro = 0;
  const has = i => chosen.some(x => x.name.toLowerCase() === i.name.toLowerCase());
  const add = i => { chosen.push(i); cal += i.calories; pro += i.protein; };
  // Mains: best protein per calorie first.
  for (const i of [...ok].sort((a, b) => b.protein / b.calories - a.protein / a.calories)) {
    if (chosen.length >= 2 || pro >= proteinGoal * 0.8) break;
    if (i.protein / i.calories >= 0.05 && cal + i.calories <= budget * 1.05 && !has(i)) add(i);
  }
  // Sides: veggies, fruit and grains first, biggest that still fits.
  const sides = ok.filter(i => !has(i)).sort((a, b) => (SIDE.test(b.name) - SIDE.test(a.name)) || b.calories - a.calories);
  for (const i of sides) {
    if (chosen.length >= 4 || cal >= budget * 0.85) break;
    if (cal + i.calories <= budget * 1.05 && !has(i)) add(i);
  }
  return { foods: chosen, cal, pro };
}

function mealPlan(meal, items, budget, proteinGoal, prefs) {
  const pool = (items
    ? items.filter(i => SERVES[meal].includes(i.period.toLowerCase()))
    : BASICS.filter(i => i.m.includes(meal[0]))).filter(i => allowed(i, prefs));
  const byPlace = Map.groupBy ? Map.groupBy(pool, i => i.location) : pool.reduce((m, i) => m.set(i.location, [...(m.get(i.location) || []), i]), new Map());
  let best = null;
  for (const [place, list] of byPlace) {
    const r = pickMeal(list, budget, proteinGoal);
    if (!r.foods.length) continue;
    const score = Math.abs(budget - r.cal) / budget + Math.max(0, proteinGoal - r.pro) / Math.max(1, proteinGoal);
    if (!best || score < best.score) best = { ...r, score, place, period: list[0].period };
  }
  return best;
}

const fmt = n => Math.round(n).toLocaleString('en-US');
const strip = ({ name, portion, calories, protein, carbs, fat }) => ({ name, portion, calories, protein, carbs, fat });

// menu: today's imported campus items or null. eaten: today's diary entries.
export function plan({ goal, profile, eaten = [], menu = null, now = new Date() }) {
  const g = parseGoal(goal, now);
  const dir = g.direction || profile.goal || 'maintain';
  const maint = targets({ ...profile, goal: 'maintain', calorieGoal: 0 }).calories;
  const floor = profile.sex === 'male' ? 1500 : 1200;
  const tips = [];
  let daily;
  if (g.calories) daily = g.calories;
  else if (dir === 'lose') {
    let deficit = g.pounds && g.weeks ? (g.pounds * 3500) / (g.weeks * 7) : 500;
    const maxDeficit = Math.min(1000, (profile.weightLb * 0.01 * 3500) / 7); // about 1% of body weight a week
    if (deficit > maxDeficit) {
      tips.push(`${g.pounds} lb in ${Math.max(1, Math.round(g.weeks))} weeks is faster than is safe. This plan loses about ${(maxDeficit * 7 / 3500).toFixed(1)} lb a week, which gets you there in about ${Math.ceil((g.pounds * 3500) / (maxDeficit * 7))} weeks.`);
      deficit = maxDeficit;
    }
    daily = maint - deficit;
  } else if (dir === 'gain') daily = maint + (g.pounds && g.weeks ? Math.min(500, (g.pounds * 3500) / (g.weeks * 7)) : 300);
  else daily = maint;
  if (daily < floor) {
    tips.push(`I kept you at ${fmt(floor)} kcal. Eating less than that makes it hard to get enough nutrients, so lose weight more slowly instead.`);
    daily = floor;
  }
  daily = Math.round(daily / 10) * 10;
  const protein = g.protein || Math.round(profile.weightLb * (dir === 'maintain' ? 0.8 : 1));
  const fat = Math.round((daily * 0.25) / 9);
  const carbs = Math.max(0, Math.round((daily - protein * 4 - fat * 9) / 4));

  const got = sum(eaten);
  const leftCal = daily - got.calories, leftPro = Math.max(0, protein - got.protein);
  const hour = now.getHours() + now.getMinutes() / 60;
  const ahead = hour < 10.5 ? ['Breakfast', 'Lunch', 'Dinner'] : hour < 15 ? ['Lunch', 'Dinner'] : hour < 21 ? ['Dinner'] : ['Snacks'];
  const meals = g.meal ? [g.meal] : ahead.filter(m => !eaten.some(e => e.meal === m)).concat().slice(0, 3);
  const shareTotal = meals.reduce((s, m) => s + MEAL_SHARE[m], 0);

  const suggestions = [];
  if (leftCal >= 150) {
    for (const meal of meals.length ? meals : ['Snacks']) {
      // One asked-about meal gets a normal-sized share (not the whole day); otherwise split what's left.
      const part = g.meal ? Math.min(1, (daily * MEAL_SHARE[meal] * 1.25) / leftCal) : MEAL_SHARE[meal] / (shareTotal || MEAL_SHARE[meal]);
      const p = mealPlan(meal, menu, leftCal * part, leftPro * part, g.prefs);
      if (!p) continue;
      suggestions.push({
        meal, where: p.place === 'Anywhere' ? 'Anywhere' : `${p.place} - ${p.period}`, foods: p.foods.map(strip),
        why: `${fmt(p.cal)} kcal and ${Math.round(p.pro)}g protein, about ${Math.round((p.cal / leftCal) * 100)}% of what you have left today.`,
      });
    }
  }

  const what = dir === 'lose' ? 'lose' : dir === 'gain' ? 'gain' : 'maintain your weight';
  const amount = g.pounds && dir !== 'maintain' ? ` ${g.pounds} lb` : '';
  const when = g.by ? ` by ${g.by.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : g.weeks ? ` in ${Math.round(g.weeks)} weeks` : '';
  const vsMaint = daily < maint ? `, ${fmt(maint - daily)} below` : daily > maint ? `, ${fmt(daily - maint)} above` : ', right at';
  let summary = `To ${what}${amount}${when}, eat about ${fmt(daily)} kcal a day${vsMaint} your maintenance of ~${fmt(maint)}, with ${protein}g protein. `;
  summary += leftCal >= 150 ? `You have ${fmt(leftCal)} kcal and ${Math.round(leftPro)}g protein left today.` : leftCal >= 0 ? `You're right at your goal for today. Nice work.` : `You're ${fmt(-leftCal)} kcal over today. That's fine; just get back on track tomorrow.`;

  if (g.prefs.labels.length) summary += ` Going by: ${g.prefs.labels.join(', ')}.`;
  if (g.guessed) tips.push(`I assumed ${g.guessed} is around ${g.by.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Say the exact date (like "by March 9") if it's different.`);
  if ([...g.prefs.tags].some(x => ALLERGENS.some(([, tag]) => tag === x))) tips.push('Menu allergen labels can be wrong or change, and cross-contact happens. Always confirm with dining staff before eating.');
  if (/halal|kosher/.test(String(goal).toLowerCase())) tips.push('The menu doesn\u2019t say which meat is halal or kosher, so I only removed pork. Ask dining staff which options are certified.');
  if (leftCal >= 150 && !suggestions.length) tips.push('Nothing on today\u2019s menu fits those preferences for that meal. Try another meal, or check the Campus tab yourself.');
  if (!menu) tips.push('Import today’s campus menu (Campus tab) and these suggestions will come from the dining halls.');
  if (!g.direction && !g.pounds && !g.protein && !g.calories && !g.meal) tips.push('I couldn’t find a specific goal there, so I used your profile. Try something like "lose 10 pounds by spring break" or "150g protein, what should I eat tonight?"');
  if (dir === 'lose') tips.push('Weigh yourself a few mornings a week and watch the weekly average. Day-to-day numbers jump around with water.', 'Drinks count: a large sweet tea or a frappuccino can be 300-500 kcal.');
  else if (dir === 'gain') tips.push('Lift 3-4 times a week so the extra calories go to muscle, and aim to gain about 0.5 lb a week.', 'Hitting your calories is easier with 4-5 meals and snacks than with 3 big ones.');
  else tips.push('Spread protein across your meals (about 30g each) rather than saving it for dinner.');
  tips.push('This is general guidance, not medical advice. See a doctor or dietitian if you have a health condition.');

  return { summary, dailyTargets: { calories: daily, protein, carbs, fat }, suggestions, tips: tips.slice(0, 6) };
}
