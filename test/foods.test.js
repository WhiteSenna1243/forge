import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUSDA, normalizeOFF, forGrams, looksWrong, recipeTotals } from '../public/foods.js';

test('normalizeUSDA: lab food without an Energy value falls back to macros', () => {
  const f = normalizeUSDA({ fdcId: 1, description: 'CHICKEN, BREAST, BONELESS, SKINLESS, RAW', dataType: 'Foundation',
    foodNutrients: [{ nutrientId: 1003, value: 22.5 }, { nutrientId: 1004, value: 1.93 }, { nutrientId: 1005, value: -0.4 }] });
  assert.equal(f.kind, 'lab');
  assert.equal(f.name, 'Chicken, Breast, Boneless, Skinless, Raw');
  assert.deepEqual(f.per100, { calories: 107.4, protein: 22.5, carbs: 0, fat: 1.9 });
});

test('normalizeUSDA: branded serving and household measures become portions', () => {
  const f = normalizeUSDA({ fdcId: 2, description: 'BIG MAC', dataType: 'Survey (FNDDS)', foodNutrients: [{ nutrientId: 1008, value: 257, unitName: 'KCAL' }],
    foodMeasures: [{ disseminationText: '1 sandwich', gramWeight: 219 }, { disseminationText: 'Quantity not specified', gramWeight: 219 }] });
  assert.equal(f.kind, 'survey');
  assert.ok(f.portions.some(p => p.label.startsWith('1 sandwich') && p.grams === 219));
  assert.ok(!f.portions.some(p => /not specified/.test(p.label)));
  assert.equal(forGrams(f, 219).calories, 563);
});

test('normalizeOFF: per-100 g values, serving portion, kJ fallback', () => {
  const f = normalizeOFF({ code: '123', product_name: 'Protein Shake', brands: 'Fairlife,Coca-Cola', serving_quantity: 340, serving_size: '1 bottle (340 ml)',
    nutriments: { energy_100g: 209, proteins_100g: 8.8, carbohydrates_100g: 1.8, fat_100g: 0.7 } });
  assert.equal(f.brand, 'Fairlife');
  assert.equal(f.per100.calories, 50);
  assert.equal(f.portions[0].grams, 340);
});

test('looksWrong flags calories that disagree with macros', () => {
  assert.equal(looksWrong({ calories: 110, protein: 22.5, carbs: 0, fat: 2 }), false);
  assert.equal(looksWrong({ calories: 20, protein: 22.5, carbs: 10, fat: 15 }), true);
});

test('recipeTotals adds ingredients and divides by servings', () => {
  const rice = { per100: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 } };
  const chicken = { per100: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } };
  const oil = { per100: { calories: 884, protein: 0, carbs: 0, fat: 100 } };
  const r = recipeTotals([{ food: rice, grams: 400 }, { food: chicken, grams: 300 }, { food: oil, grams: 14 }], 2);
  assert.equal(r.total.calories, 520 + 495 + 124);
  assert.equal(r.perServing.calories, 570);
  assert.equal(r.gramsPerServing, 357);
});
