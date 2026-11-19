// Food lookup: USDA FoodData Central (lab-measured generic foods, restaurant dishes, branded labels)
// and Open Food Facts (store products by name or barcode). Everything is normalized to per-100 g
// values plus a list of portions, so any amount can be logged.
import { USDA_API_KEY } from './config.js?v=6';

const USDA = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const OFF_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl'; // allows browser requests from https sites (not localhost)
const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v2/product/';
const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_quantity,serving_size,quantity';

// How much to trust each source, best first.
export const SOURCES = {
  lab: { label: 'USDA lab', note: 'Measured by the USDA' },
  survey: { label: 'USDA dish', note: 'USDA average for this dish (good for restaurants and home cooking)' },
  label: { label: 'Label', note: 'From the package label' },
  community: { label: 'Open Food Facts', note: 'Label data entered by the community' },
  recipe: { label: 'Recipe', note: 'Added up from your ingredients' },
  estimate: { label: 'Estimate', note: 'Built from ingredients, so treat it as an estimate' },
  custom: { label: 'My food', note: 'Numbers you entered' },
};
const USDA_KIND = { Foundation: 'lab', 'SR Legacy': 'lab', 'Survey (FNDDS)': 'survey', Branded: 'label' };

const round1 = v => Math.round(v * 10) / 10;
const pos = v => (Number.isFinite(+v) && +v > 0 ? +v : 0);
const title = s => String(s || '').toLowerCase().replace(/(^|[\s,(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

function usdaNutrient(f, ids) {
  for (const id of ids) {
    const n = (f.foodNutrients || []).find(x => x.nutrientId === id || x.nutrientNumber === String(id));
    if (n && Number.isFinite(+n.value)) return { value: +n.value, unit: String(n.unitName || '').toUpperCase() };
  }
  return null;
}

export function normalizeUSDA(f) {
  const protein = pos(usdaNutrient(f, [1003])?.value), fat = pos(usdaNutrient(f, [1004])?.value), carbs = pos(usdaNutrient(f, [1005])?.value);
  let kcal = usdaNutrient(f, [1008, 2047, 2048]);
  let calories = kcal && kcal.unit === 'KJ' ? kcal.value / 4.184 : pos(kcal?.value);
  if (!calories) calories = protein * 4 + carbs * 4 + fat * 9; // some lab entries only list macros
  const portions = [{ label: '100 g', grams: 100 }];
  if (f.servingSize && /^(g|grm|ml|mlt)$/i.test(f.servingSizeUnit || '')) {
    portions.unshift({ label: f.householdServingFullText ? `${f.householdServingFullText} (${round1(f.servingSize)} g)` : `1 serving (${round1(f.servingSize)} g)`, grams: +f.servingSize });
  }
  for (const m of f.foodMeasures || []) {
    if (m.gramWeight > 0 && m.disseminationText && !/quantity not specified/i.test(m.disseminationText)) portions.push({ label: `${m.disseminationText} (${round1(m.gramWeight)} g)`, grams: m.gramWeight });
  }
  portions.push({ label: '1 oz (28 g)', grams: 28.35 });
  const kind = USDA_KIND[f.dataType] || 'label';
  return {
    id: `usda:${f.fdcId}`, name: title(f.description), brand: title(f.brandName || f.brandOwner || ''), kind,
    per100: { calories: round1(calories), protein: round1(protein), carbs: round1(carbs), fat: round1(fat) },
    portions: dedupePortions(portions).slice(0, 8),
  };
}

export function normalizeOFF(p) {
  const n = p.nutriments || {};
  let calories = pos(n['energy-kcal_100g']);
  if (!calories && pos(n.energy_100g)) calories = n.energy_100g / 4.184; // kJ only
  const per100 = { calories: round1(calories), protein: round1(pos(n.proteins_100g)), carbs: round1(pos(n.carbohydrates_100g)), fat: round1(pos(n.fat_100g)) };
  const portions = [{ label: '100 g', grams: 100 }];
  const sq = pos(p.serving_quantity);
  if (sq) portions.unshift({ label: p.serving_size ? `${p.serving_size}` : `1 serving (${round1(sq)} g)`, grams: sq });
  const brands = Array.isArray(p.brands) ? p.brands.join(', ') : p.brands;
  return { id: `off:${p.code}`, name: String(p.product_name || 'Unnamed product').trim(), brand: String(brands || '').split(',')[0].trim(), kind: 'community', per100, portions: dedupePortions(portions), barcode: p.code };
}

const dedupePortions = list => list.filter((p, i) => list.findIndex(q => Math.abs(q.grams - p.grams) < 0.5 && q.label === p.label) === i);

// Nutrition for an amount in grams.
export function forGrams(food, grams) {
  const k = pos(grams) / 100, p = food.per100;
  return { calories: Math.round(p.calories * k), protein: round1(p.protein * k), carbs: round1(p.carbs * k), fat: round1(p.fat * k) };
}

// Labels and community data can contain typos. Flag foods whose calories don't match their macros.
export function looksWrong(per100) {
  const fromMacros = per100.protein * 4 + per100.carbs * 4 + per100.fat * 9;
  if (per100.calories < 40 && fromMacros < 40) return false;
  return Math.abs(fromMacros - per100.calories) / Math.max(per100.calories, fromMacros) > 0.3;
}

const usable = f => f.per100.calories > 0 || f.per100.protein + f.per100.carbs + f.per100.fat > 0;

export async function searchUSDA(query, { kinds } = {}) {
  const types = kinds || ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];
  const url = `${USDA}?api_key=${encodeURIComponent(USDA_API_KEY || 'DEMO_KEY')}&query=${encodeURIComponent(query)}&pageSize=30&requireAllWords=true&dataType=${types.map(t => t.replace(/ /g, '%20')).join(',')}`; // USDA rejects encoded commas/parentheses here
  const r = await fetch(url);
  if (r.status === 429) throw new Error('USDA search limit reached for now. Try again in a bit, or add a free USDA key.');
  if (!r.ok) throw new Error(`USDA search failed (${r.status})`);
  return ((await r.json()).foods || []).map(normalizeUSDA).filter(usable);
}

export async function searchOFF(query) {
  const r = await fetch(`${OFF_SEARCH}?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=25&fields=${OFF_FIELDS}`);
  if (!r.ok) throw new Error(`Open Food Facts search failed (${r.status})`);
  return ((await r.json()).products || []).map(normalizeOFF).filter(usable);
}

export async function byBarcode(code) {
  const clean = String(code).replace(/\D/g, '');
  if (clean.length < 6) throw new Error('That barcode looks too short.');
  const r = await fetch(`${OFF_PRODUCT}${clean}.json?fields=${OFF_FIELDS}`);
  if (r.ok) {
    const d = await r.json();
    if (d.status === 1 && d.product) { const f = normalizeOFF(d.product); if (usable(f)) return f; }
  }
  const usda = await searchUSDA(clean, { kinds: ['Branded'] }).catch(() => []); // USDA branded foods carry UPCs too
  if (usda[0]) return usda[0];
  throw new Error('No product found for that barcode. You can enter it from the label instead.');
}

// Search both sources at once; USDA first for plain foods, store products after.
export async function searchAll(query) {
  const [usda, off] = await Promise.allSettled([searchUSDA(query), searchOFF(query)]);
  const order = { lab: 0, survey: 1, label: 2, community: 3 };
  const results = [...(usda.value || []), ...(off.value || [])];
  const seen = new Set();
  return {
    results: results
      .filter(f => { const key = `${f.name}|${f.brand}`.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
      .sort((a, b) => order[a.kind] - order[b.kind]),
    errors: [usda, off].filter(x => x.status === 'rejected').map(x => x.reason?.message || 'Search failed'),
  };
}

// A recipe's nutrition per serving, from ingredients [{ food, grams }].
export function recipeTotals(ingredients, servings) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let grams = 0;
  for (const { food, grams: g } of ingredients) {
    const n = forGrams(food, g);
    for (const k in t) t[k] += n[k];
    grams += pos(g);
  }
  const s = Math.max(1, pos(servings) || 1);
  return {
    total: { calories: Math.round(t.calories), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) },
    perServing: { calories: Math.round(t.calories / s), protein: round1(t.protein / s), carbs: round1(t.carbs / s), fat: round1(t.fat / s) },
    gramsPerServing: Math.round(grams / s),
  };
}
