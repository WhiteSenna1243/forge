// Account sync with Supabase. Each user has one row holding their diary as JSON; row-level security
// in the database lets people read and write only their own row. The app keeps working offline:
// changes save on the device first and upload when there's a connection.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=8';

export const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
let sb = null;

export async function client() {
  if (!enabled) return null;
  if (!sb) {
    const { createClient } = await import(LIB);
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return sb;
}

// Supabase keeps the login in localStorage; lets the app decide whether to show the login screen before the library loads.
export const hasSavedLogin = () => { try { return Object.keys(localStorage).some(k => /^sb-.+-auth-token$/.test(k)); } catch { return false; } };

export async function pull(db, userId) {
  const { data, error } = await db.from('user_data').select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.data || null;
}

export async function push(db, userId, state) {
  const { error } = await db.from('user_data').upsert({ user_id: userId, data: doc(state), updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function deleteMine(db, userId) {
  const { error } = await db.from('user_data').delete().eq('user_id', userId);
  if (error) throw error;
}

// What gets stored in the account. The campus menu stays on the device (it's big and changes daily).
export const doc = s => ({ profile: s.profile, profileSet: !!s.profileSet, log: s.log || {}, myFoods: s.myFoods || [], workouts: s.workouts || {}, trainPlan: s.trainPlan || null, updatedAt: s.updatedAt || 0 });

const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
export function withIds(log = {}) {
  for (const list of Object.values(log)) for (const e of list) e.id ||= newId();
  return log;
}
export { newId };

const hasData = s => !!s.profileSet || Object.values(s.log || {}).some(l => l.length) || (s.myFoods || []).length > 0 || Object.keys(s.workouts || {}).length > 0;

// Combine two { day: [items with id] } maps, keeping every id once.
function unionByDay(a = {}, b = {}) {
  const out = {};
  for (const src of [a, b]) for (const [day, list] of Object.entries(src)) {
    const byId = new Map((out[day] || []).map(e => [e.id, e]));
    for (const e of list) if (!byId.has(e.id)) byId.set(e.id, e);
    out[day] = [...byId.values()];
  }
  return out;
}

// Combine two copies: newest profile wins, food entries are combined (matched by id).
export function merge(local, remote) {
  const newer = (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
  const foods = new Map([...(remote.myFoods || []), ...(local.myFoods || [])].map(f => [f.id, f]));
  return {
    ...local, profile: newer.profile, profileSet: !!(local.profileSet || remote.profileSet),
    log: unionByDay(remote.log, local.log), workouts: unionByDay(remote.workouts, local.workouts),
    myFoods: [...foods.values()], trainPlan: newer.trainPlan || local.trainPlan || remote.trainPlan || null, updatedAt: Date.now(),
  };
}

const adopt = (local, remote) => ({ ...local, profile: remote.profile, profileSet: !!remote.profileSet, log: remote.log || {}, myFoods: remote.myFoods || [], workouts: remote.workouts || {}, trainPlan: remote.trainPlan || null, updatedAt: remote.updatedAt || 0 });

// Decide what this device should hold after seeing the account's copy, and whether to upload.
// local.syncedUser / local.syncedAt record which account this device last synced with, and when.
export function reconcile(local, remote, userId) {
  if (!remote) {
    // New account. Never upload a diary this device synced for someone else.
    if (local.syncedUser && local.syncedUser !== userId) return { next: { ...local, profileSet: false, log: {}, updatedAt: Date.now() }, upload: true };
    return { next: local, upload: true };
  }
  if (local.syncedUser !== userId) {
    // First sync on this device: keep anything logged here before logging in.
    return hasData(local) && local.syncedUser == null ? { next: merge(local, remote), upload: true } : { next: adopt(local, remote), upload: false };
  }
  const remoteChanged = (remote.updatedAt || 0) > (local.syncedAt || 0);
  if (remoteChanged && local.dirty) return { next: merge(local, remote), upload: true }; // edited on two devices
  if (remoteChanged) return { next: adopt(local, remote), upload: false };
  return { next: local, upload: !!local.dirty };
}

// ---------- shared campus menus (one row per day, readable by every signed-in user) ----------
export async function menuStamps(db, fromDate) {
  const { data, error } = await db.from('menus').select('date, updated_at').gte('date', fromDate);
  if (error) throw error;
  return data || [];
}

export async function menuDays(db, dates) {
  if (!dates.length) return [];
  const { data, error } = await db.from('menus').select('date, items, updated_at').in('date', dates);
  if (error) throw error;
  return data || [];
}

// Upload one day at a time (each is a few hundred KB), then clear out days that have passed.
export async function shareMenus(db, days, yesterday) {
  const stamps = {};
  for (const [date, items] of Object.entries(days)) {
    const updated_at = new Date().toISOString();
    const { error } = await db.from('menus').upsert({ date, items, updated_at }, { onConflict: 'date' });
    if (error) throw error;
    stamps[date] = updated_at;
  }
  await db.from('menus').delete().lt('date', yesterday);
  return stamps;
}

// Which shared days this device should download: ones it lacks or has an older copy of.
export const staleDays = (rows, have, local) =>
  rows.filter(r => !local[r.date] || !have[r.date] || r.updated_at > have[r.date]).map(r => r.date);
