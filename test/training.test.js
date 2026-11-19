import test from 'node:test';
import assert from 'node:assert/strict';
import { caloriesBurned, workoutCalories, e1rm, nextTarget, personalRecord, parseWorkoutGoal, buildPlan, todaysPlan, strengthDays } from '../public/training.js';

const log = (name, sets) => ({ exercises: [{ name, sets: sets.map(([weight, reps]) => ({ weight, reps, done: true })) }] });

test('calories burned use MET x kg x hours', () => {
  assert.equal(caloriesBurned(9.8, 30, 160), 356); // 30 min run at 160 lb
  const w = { exercises: [{ name: 'Bench Press', sets: [{ done: true }, { done: true }, { done: false }] }, { name: 'Running', sets: [{ minutes: 20, done: true }] }] };
  assert.equal(workoutCalories(w, 160), caloriesBurned(5.5, 4, 160) + caloriesBurned(9.8, 20, 160));
});

test('e1rm, PRs and progression', () => {
  assert.equal(e1rm(135, 10), 180);
  const workouts = { '2026-11-10': [log('Bench Press', [[135, 12], [135, 12], [135, 12]])], '2026-11-03': [log('Bench Press', [[125, 12]])] };
  assert.equal(personalRecord(workouts, 'bench press'), 189);
  assert.equal(nextTarget(workouts, 'Bench Press', '8-12').weight, 140);
  const squats = { d: [log('Barbell Back Squat', [[185, 12], [185, 12]])] };
  assert.equal(nextTarget(squats, 'Barbell Back Squat', '8-12').weight, 195); // lower body jumps more
  const short = { d: [log('Bench Press', [[135, 9], [135, 8]])] };
  assert.equal(nextTarget(short, 'Bench Press', '8-12').weight, 135);
  assert.match(nextTarget({}, 'Bench Press').text, /Start light/);
});

test('parseWorkoutGoal reads goal, days, equipment, level, focus', () => {
  const g = parseWorkoutGoal('I want bigger arms, 4 days a week at the gym, kinda new to lifting');
  assert.equal(g.goal, 'muscle'); assert.equal(g.days, 4); assert.equal(g.equip, 'gym'); assert.equal(g.level, 'beginner');
  assert.deepEqual(g.focus, ['biceps', 'triceps']);
  assert.equal(parseWorkoutGoal('lose fat, three days, no equipment in my dorm').equip, 'bw');
});

test('buildPlan picks a split by days and listens to the nutrition goal', () => {
  const ppl = buildPlan('build muscle 6 days gym');
  assert.equal(ppl.plan.length, 6);
  assert.deepEqual(ppl.plan.slice(0, 3).map(d => d.name), ['Push', 'Pull', 'Legs']);
  const cut = buildPlan('build muscle 3 days with dumbbells', { profileGoal: 'lose' });
  assert.equal(cut.scheme.sets, 3);
  assert.ok(cut.notes.some(n => /cut/.test(n)));
  assert.ok(cut.plan[0].exercises.some(e => e.name === 'Goblet Squat'));
  assert.equal(strengthDays(cut), 3);
  assert.equal(todaysPlan(cut, new Date(2026, 10, 16)).name, 'Full body A'); // a Monday
  assert.equal(todaysPlan(cut, new Date(2026, 10, 17)), null); // Tuesday is a rest day
});
