import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoal, plan } from '../public/coach.js';

const now = new Date(2026, 10, 18, 12, 0); // Nov 18, noon
const me = { sex: 'male', age: 20, heightIn: 69, weightLb: 160, activity: 'light', goal: 'maintain', calorieGoal: 0 };

test('parseGoal reads direction, amount, deadline, protein and meal', () => {
  const g = parseGoal('I want to lose 10 pounds by spring break', now);
  assert.equal(g.direction, 'lose');
  assert.equal(g.pounds, 10);
  assert.ok(g.weeks > 15 && g.weeks < 17, String(g.weeks));
  assert.deepEqual(
    (({ protein, meal }) => ({ protein, meal }))(parseGoal('I need 150g of protein, what should I eat tonight?', now)),
    { protein: 150, meal: 'Dinner' });
  assert.equal(parseGoal('bulk 5 lbs in 2 months', now).direction, 'gain');
  assert.ok(Math.abs(parseGoal('bulk 5 lbs in 2 months', now).weeks - 8.7) < 0.01);
  assert.equal(parseGoal('lose 3 kg by march 1', now).pounds, 6.6);
});

test('plan caps unsafe loss rates and never drops below the floor', () => {
  const fast = plan({ goal: 'lose 30 pounds in 4 weeks', profile: me, now });
  assert.ok(fast.dailyTargets.calories >= 1500);
  assert.match(fast.tips[0], /faster than is safe/);
  const normal = plan({ goal: 'lose 10 pounds by spring break', profile: me, now });
  assert.ok(normal.dailyTargets.calories < 2372 && normal.dailyTargets.calories > 2000, String(normal.dailyTargets.calories));
});

test('plan builds meals from the campus menu, within the calories left', () => {
  const menu = [
    { location: 'Social 704', period: 'Dinner', station: 'Grill', name: 'Grilled Chicken', portion: '4 oz', calories: 180, protein: 33, carbs: 0, fat: 4 },
    { location: 'Social 704', period: 'Dinner', station: 'Sides', name: 'Steamed Broccoli', portion: '1 cup', calories: 50, protein: 4, carbs: 10, fat: 0 },
    { location: 'Social 704', period: 'Dinner', station: 'Sides', name: 'Brown Rice', portion: '1 cup', calories: 220, protein: 5, carbs: 45, fat: 2 },
    { location: 'Social 704', period: 'Dinner', station: 'Dessert', name: 'Brownie', portion: '1 each', calories: 400, protein: 4, carbs: 50, fat: 20 },
    { location: 'Social 704', period: 'Breakfast', station: 'Kitchen', name: 'Pancakes', portion: '2', calories: 300, protein: 6, carbs: 50, fat: 8 },
  ];
  const eaten = [{ meal: 'Breakfast', calories: 1000, protein: 40, carbs: 150, fat: 50, servings: 1 }, { meal: 'Lunch', calories: 300, protein: 20, carbs: 30, fat: 10, servings: 1 }];
  const r = plan({ goal: 'what should I eat for dinner tonight to keep losing', profile: me, eaten, menu, now: new Date(2026, 10, 18, 18, 0) });
  assert.equal(r.suggestions.length, 1);
  const s = r.suggestions[0];
  assert.equal(s.where, 'Social 704 - Dinner');
  assert.ok(s.foods.some(f => f.name === 'Grilled Chicken'));
  assert.ok(!s.foods.some(f => f.name === 'Pancakes'));
  const cal = s.foods.reduce((t, f) => t + f.calories, 0);
  assert.ok(cal <= (r.dailyTargets.calories - 1300) * 1.05, `${cal} kcal`);
});

test('plan without a menu suggests basic foods', () => {
  const r = plan({ goal: 'maintain', profile: me, now });
  assert.ok(r.suggestions.length >= 1);
  assert.equal(r.suggestions[0].where, 'Anywhere');
});

test('parsePrefs reads diets, allergies and dislikes', async () => {
  const { parsePrefs } = await import('../public/coach.js');
  const a = parsePrefs("I'm vegetarian and hate rice, what should I eat tonight?");
  assert.equal(a.diet, 'Vegetarian');
  assert.deepEqual([...a.words], ['rice']);
  const b = parsePrefs('allergic to peanuts and shellfish. halal, no mushrooms or onions');
  assert.ok(b.tags.has('Peanut') && b.tags.has('Shellfish') && b.tags.has('Pork'));
  assert.ok(b.words.has('mushroom') && b.words.has('onion'));
  assert.equal(parsePrefs('what should I eat for dinner tonight?').labels.length, 0);
});

test('allowed filters by labels and whole words', async () => {
  const { parsePrefs, allowed } = await import('../public/coach.js');
  const item = (name, tags = [], ingredients = '') => ({ name, tags, ingredients });
  const veg = parsePrefs('vegetarian, no rice');
  assert.equal(allowed(item('Veggie Fried Rice', ['Vegetarian']), veg), false);
  assert.equal(allowed(item('Bulgur Pilaf', ['Vegan']), veg), true);
  assert.equal(allowed(item('Mystery Bowl'), veg), false); // unlabeled items can't be trusted for a diet
  const halal = parsePrefs('halal');
  assert.equal(allowed(item('Hamburger', ['Beef']), halal), true);
  assert.equal(allowed(item('Ham and Cheese', ['Pork']), halal), false);
  assert.equal(allowed(item('Club', [], 'turkey, bacon, lettuce'), halal), false);
  assert.equal(allowed(item('Mixed Berries'), parsePrefs('I hate berries')), false);
});

test('plan honors preferences with the campus menu', () => {
  const menu = [
    { location: 'SoVi', period: 'Dinner', station: 'Grill', name: 'BBQ Pulled Pork', portion: '4 oz', calories: 370, protein: 41, carbs: 3, fat: 20, tags: ['Pork'] },
    { location: 'SoVi', period: 'Dinner', station: 'Grill', name: 'Steamed Tofu', portion: '3 oz', calories: 70, protein: 7, carbs: 2, fat: 4.5, tags: ['Vegan', 'Vegetarian', 'Soy'] },
    { location: 'SoVi', period: 'Dinner', station: 'Grains', name: 'Bulgur Pilaf with Lentils', portion: '4 oz', calories: 110, protein: 6, carbs: 21, fat: 1.5, tags: ['Vegan', 'Vegetarian', 'Gluten'] },
    { location: 'SoVi', period: 'Dinner', station: 'Grains', name: 'Jasmine Rice', portion: '1/2 cup', calories: 180, protein: 3, carbs: 40, fat: 0, tags: ['Vegan', 'Vegetarian'] },
  ];
  const r = plan({ goal: "I'm vegetarian and hate rice, what should I eat tonight?", profile: me, menu, now: new Date(2026, 10, 18, 18, 0) });
  const names = r.suggestions.flatMap(s => s.foods.map(f => f.name));
  assert.deepEqual(names.sort(), ['Bulgur Pilaf with Lentils', 'Steamed Tofu']);
  assert.match(r.summary, /Going by: vegetarian, no rice/);
});

test('goal words are not dislikes; allergies drop unlabeled items', async () => {
  const { parsePrefs, allowed } = await import('../public/coach.js');
  assert.deepEqual(parsePrefs('halal, no onions, high protein dinner').labels, ['no pork', 'no onions']);
  const gf = parsePrefs('I have a gluten allergy');
  assert.equal(allowed({ name: 'French Fries', tags: [] }, gf), false);
  assert.equal(allowed({ name: 'Grilled Chicken', tags: ['Poultry'] }, gf), true);
});

test('nutrition coach listens to the workout plan', () => {
  const r = plan({ goal: 'maintain', profile: me, now, training: { today: 'Push', strengthDays: 4, burned: 300 } });
  assert.equal(r.dailyTargets.protein, 160); // 1 g/lb with 3+ lifting days
  assert.match(r.tips[0], /Training day \(Push\)/);
  assert.ok(r.tips.some(t => /burned about 300/.test(t)));
});
