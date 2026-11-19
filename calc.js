// Daily targets from a profile (Mifflin-St Jeor). Shared by the browser and the tests.
export const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 };
const GOAL_ADJUST = { lose: -500, maintain: 0, gain: 300 };

export function targets(p) {
  const kg = p.weightLb * 0.4536, cm = p.heightIn * 2.54;
  const bmr = 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const calories = p.calorieGoal > 0
    ? Math.round(p.calorieGoal)
    : Math.max(1200, Math.round(bmr * (ACTIVITY[p.activity] || 1.2) + (GOAL_ADJUST[p.goal] || 0)));
  const protein = Math.round(p.weightLb * 0.8);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

export function sum(entries) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries) for (const k in t) t[k] += (Number(e[k]) || 0) * (Number(e.servings) || 1);
  for (const k in t) t[k] = Math.round(t[k]);
  return t;
}
