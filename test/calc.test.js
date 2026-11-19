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
