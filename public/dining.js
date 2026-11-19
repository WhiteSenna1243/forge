// Bookmarklet body. It runs on dineoncampus.com (the user's own browser session on the official site),
// makes the same menu requests that page makes, then sends the next 7 days of UNC Charlotte menus to FORGE:
// "Send" opens the app and posts them; "Copy" puts them on the clipboard for the app's Paste button
// (needed on phones, where a home-screen app doesn't share storage with the browser).
// Dine On Campus blocks other sites (CORS) and non-browser clients, so this is the supported way in.
// Must stay self-contained: it is stringified, so it cannot use anything outside its own body.
export function grab(APP) {
  if (location.hostname !== 'dineoncampus.com') { alert('Open dineoncampus.com/unccharlotte first, then tap the FORGE import bookmark.'); return; }
  const ORIGIN = new URL(APP).origin;
  const BASE = 'https://apiv4.dineoncampus.com', SITE = '5751fd2790975b60e0489226';
  const get = p => fetch(BASE + p).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const num = (i, pre) => { const v = parseFloat((i.nutrients || []).find(n => n.name.startsWith(pre))?.valueNumeric); return Number.isFinite(v) ? v : 0; };
  document.getElementById('forge-import')?.remove();
  const box = document.createElement('div');
  box.id = 'forge-import';
  box.style.cssText = 'position:fixed;z-index:2147483647;left:12px;right:12px;bottom:16px;max-width:440px;margin:0 auto;background:#141416;color:#f4f2ee;border:1px solid #ff5a1f;padding:14px 16px;border-radius:16px;font:600 15px/1.4 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.55)';
  const msg = document.createElement('div');
  msg.textContent = 'FORGE · loading this week’s menus…';
  box.append(msg);
  document.body.append(box);
  const button = (label, primary) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `margin:12px 8px 0 0;padding:11px 16px;border-radius:12px;border:0;font:800 14px system-ui,sans-serif;letter-spacing:.3px;cursor:pointer;background:${primary ? '#ff5a1f' : '#2a2a2f'};color:${primary ? '#120a06' : '#f4f2ee'}`;
    box.append(b);
    return b;
  };
  (async () => {
    const d = await get(`/sites/${SITE}/locations-public?for_menus=true&locale=en`);
    const locs = (d.buildings || []).flatMap(b => b.locations);
    const dates = [...Array(7)].map((_, k) => new Date(Date.now() + k * 864e5).toLocaleDateString('en-CA'));
    const days = Object.fromEntries(dates.map(x => [x, []]));
    const jobs = dates.flatMap(day => locs.map(l => [day, l]));
    let done = 0;
    const work = async () => {
      for (let job; (job = jobs.shift());) {
        const [day, l] = job;
        try {
          for (const p of (await get(`/locations/${l.id}/periods/?date=${day}`)).periods || []) {
            const m = await get(`/locations/${l.id}/menu?date=${day}&period=${p.id}&locale=en`);
            for (const c of m.period?.categories || []) for (const i of c.items || []) days[day].push({
              location: (l.useDisplayName && l.displayName) || l.name, period: p.name, station: c.name,
              name: i.name, portion: i.portion || '', calories: Number(i.calories) || num(i, 'Calories'),
              protein: num(i, 'Protein'), carbs: num(i, 'Total Carbohydrates'), fat: num(i, 'Total Fat'),
              // Diet and allergen labels; a trailing * marks possible cross-contact, kept as present to be safe.
              tags: [...new Set((i.filters || []).map(f => f.name.replace(/\*$/, '').replace(/ \(.*\)$/, '')))],
              ingredients: (i.ingredients || '').slice(0, 160),
            });
          }
        } catch { /* closed that day */ }
        msg.textContent = `FORGE \u00b7 reading this week\u2019s menus ${Math.round((++done / (dates.length * locs.length)) * 100)}%\u2026`;
      }
    };
    await Promise.all([work(), work(), work()]); // 3 at a time: quick, but gentle on their site
    const items = Object.values(days).flat();
    const payload = { type: 'forge-menus', version: 2, days };
    msg.textContent = `FORGE · got ${items.length} items for the next 7 days.`;
    let acked = false;
    button('Send to FORGE', true).onclick = () => {
      const app = window.open(APP + '?import=1', 'forge');
      let tries = 0;
      const send = setInterval(() => {
        if (acked || ++tries > 40 || !app || app.closed) { clearInterval(send); if (!acked) msg.textContent = 'Couldn’t reach FORGE. Tap Copy, then Paste menu in FORGE.'; return; }
        app.postMessage(payload, ORIGIN);
      }, 700);
    };
    addEventListener('message', e => {
      if (e.origin === ORIGIN && e.data?.type === 'forge-ack') { acked = true; msg.textContent = `Sent ${items.length} items to FORGE ✓`; }
    });
    button('Copy').onclick = async e => {
      try { await navigator.clipboard.writeText(JSON.stringify(payload)); e.target.textContent = 'Copied ✓'; msg.textContent = 'Now open FORGE → Campus → Paste menu.'; }
      catch { msg.textContent = 'Copy was blocked. Use Send to FORGE.'; }
    };
    button('✕').onclick = () => box.remove();
  })().catch(e => { msg.textContent = 'FORGE import failed: ' + e.message; button('✕').onclick = () => box.remove(); });
}
