import test from 'node:test';
import assert from 'node:assert/strict';
import { targets, sum } from '../public/calc.js';

test('targets: Mifflin-St Jeor with goal adjustment', () => {
  // 20yo male, 5'9", 160 lb, light: BMR ≈ 1725, × 1.375 ≈ 2372
  const t = targets({ sex: 'male', age: 20, heightIn: 69, weightLb: 160, activity: 'light', goal: 'maintain' });
  assert.ok(Math.abs(t.calories - 2372) <= 2, String(t.calories));
  assert.equal(t.protein, 128);
  assert.equal(targets({ sex: 'male', age: 20, heightIn: 69, weightLb: 160, activity: 'light', goal: 'lose' }).calories, t.calories - 500);
});

test('targets: custom goal wins, floor of 1200 otherwise', () => {
  assert.equal(targets({ sex: 'female', age: 20, heightIn: 64, weightLb: 130, activity: 'light', goal: 'maintain', calorieGoal: 1800 }).calories, 1800);
  assert.equal(targets({ sex: 'female', age: 60, heightIn: 58, weightLb: 90, activity: 'sedentary', goal: 'lose' }).calories, 1200);
});

test('sum multiplies by servings', () => {
  assert.deepEqual(sum([{ calories: 100, protein: 10, carbs: 5, fat: 2, servings: 2 }, { calories: 50, protein: 0, carbs: 12, fat: 0 }]),
    { calories: 250, protein: 20, carbs: 22, fat: 4 });
});

test('pace sets the deficit, capped at 1% of body weight a week', async () => {
  const { targets } = await import('../public/calc.js');
  const me = { sex: 'male', age: 20, heightIn: 69, weightLb: 160, activity: 'light', goal: 'lose' };
  const maint = targets({ ...me, goal: 'maintain' }).calories;
  assert.equal(targets({ ...me, pace: 0.5 }).calories, maint - 250);
  assert.equal(targets({ ...me, pace: 2 }).pace, 1.6); // 2 lb/wk asked, 1% of 160 lb allowed
  assert.equal(targets({ ...me, goal: 'gain', pace: 0.25 }).calories, maint + 125);
});

test('goalETA gives a date, flags a goal weight in the wrong direction', async () => {
  const { goalETA } = await import('../public/calc.js');
  const me = { sex: 'male', age: 20, heightIn: 69, weightLb: 180, activity: 'light', goal: 'lose', pace: 1, goalWeightLb: 170 };
  const eta = goalETA(me, new Date(2026, 0, 1));
  assert.equal(eta.weeks, 10);
  assert.equal(eta.date.getMonth(), 2); // early March
  assert.deepEqual(goalETA({ ...me, goalWeightLb: 190 }), { mismatch: true });
  assert.equal(goalETA({ ...me, goal: 'maintain' }), null);
});
