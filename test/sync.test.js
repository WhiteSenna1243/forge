import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, merge, withIds, doc } from '../public/sync.js';

const e = (id, name, cal = 100) => ({ id, meal: 'Lunch', name, servings: 1, calories: cal, protein: 0, carbs: 0, fat: 0 });
const P = { sex: 'male', age: 20, heightIn: 69, weightLb: 160, activity: 'light', goal: 'maintain', calorieGoal: 0 };

test('new account: upload what this device has', () => {
  const local = { profile: P, profileSet: true, log: { d1: [e('a', 'Eggs')] }, updatedAt: 5 };
  assert.deepEqual(reconcile(local, null, 'u1'), { next: local, upload: true });
});

test('first login on a fresh device takes the account copy', () => {
  const local = { profile: P, profileSet: false, log: {}, updatedAt: 0 };
  const remote = { profile: { ...P, weightLb: 150 }, profileSet: true, log: { d1: [e('a', 'Eggs')] }, updatedAt: 9 };
  const r = reconcile(local, remote, 'u1');
  assert.equal(r.upload, false);
  assert.equal(r.next.profile.weightLb, 150);
  assert.equal(r.next.log.d1.length, 1);
});

test('first login with food already logged here keeps both', () => {
  const local = { profile: P, profileSet: true, log: { d1: [e('b', 'Toast')] }, updatedAt: 3 };
  const remote = { profile: P, profileSet: true, log: { d1: [e('a', 'Eggs')] }, updatedAt: 9 };
  const r = reconcile(local, remote, 'u1');
  assert.equal(r.upload, true);
  assert.deepEqual(r.next.log.d1.map(x => x.name).sort(), ['Eggs', 'Toast']);
});

test("a different person logging in doesn't inherit the last person's diary", () => {
  const local = { profile: P, profileSet: true, log: { d1: [e('a', 'Eggs')] }, syncedUser: 'u1', syncedAt: 9, updatedAt: 9 };
  const remote = { profile: P, profileSet: true, log: {}, updatedAt: 4 };
  const r = reconcile(local, remote, 'u2');
  assert.equal(r.upload, false);
  assert.deepEqual(r.next.log, {});
});

test('later syncs: newer account copy replaces, local edits upload, both edited merges', () => {
  const base = { profile: P, profileSet: true, log: { d1: [e('a', 'Eggs')] }, syncedUser: 'u1', syncedAt: 10, updatedAt: 10 };
  const remoteNewer = { ...doc(base), log: { d1: [] }, updatedAt: 20 }; // deleted on the laptop
  assert.deepEqual(reconcile(base, remoteNewer, 'u1').next.log, { d1: [] });
  const edited = { ...base, dirty: true, updatedAt: 15, log: { d1: [e('a', 'Eggs'), e('c', 'Rice')] } };
  assert.equal(reconcile(edited, doc(base), 'u1').upload, true);
  const both = reconcile(edited, { ...doc(base), log: { d1: [e('a', 'Eggs'), e('d', 'Salad')] }, updatedAt: 20 }, 'u1');
  assert.deepEqual(both.next.log.d1.map(x => x.name).sort(), ['Eggs', 'Rice', 'Salad']);
  assert.equal(both.upload, true);
});

test('withIds gives old entries ids; merge keeps the newer profile', () => {
  const log = withIds({ d1: [{ name: 'x' }, { name: 'y' }] });
  assert.ok(log.d1[0].id && log.d1[1].id && log.d1[0].id !== log.d1[1].id);
  const m = merge({ profile: { ...P, age: 20 }, log: {}, updatedAt: 1 }, { profile: { ...P, age: 21 }, log: {}, updatedAt: 2 });
  assert.equal(m.profile.age, 21);
});

test("a new account on a phone that still holds someone else's diary starts empty", () => {
  const local = { profile: P, profileSet: true, log: { d1: [e('a', 'Eggs')] }, syncedUser: 'u1', syncedAt: 9, updatedAt: 9 };
  const r = reconcile(local, null, 'u2');
  assert.equal(r.upload, true);
  assert.deepEqual(r.next.log, {});
  assert.equal(r.next.profileSet, false);
});
