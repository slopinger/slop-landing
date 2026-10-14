// the global slop pot: every visitor's splats and ladles go into one shared pot (slopd /api/pot).
// reporting runs on every page; the cauldron is drawn wherever #pot exists.
(() => {
  'use strict';
  const { $, api, on, toast, reduceMotion } = window.slop;

  // ---------- reporting (batched; the server caps each request at 50 splats / 20 ladles) ----------
  const pending = { splats: 0, ladles: 0 };
  on('splat', () => { pending.splats++; });
  on('ladle', () => { pending.ladles++; });
  let sending = false;
  async function flush(keepalive) {
    if (sending || (!pending.splats && !pending.ladles)) return;
    const batch = { splats: Math.min(pending.splats, 50), ladles: Math.min(pending.ladles, 20) };
    pending.splats -= batch.splats; pending.ladles -= batch.ladles;
    sending = true;
    try {
      const r = await fetch('/api/pot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch), keepalive });
      if (r.ok) draw(await r.json());
      else if (r.status !== 429) throw new Error();
      else { pending.splats += batch.splats; pending.ladles += batch.ladles; } // too fast: retry next round
    } catch { /* the pot is offline; that slop is lost to the void */ }
    sending = false;
  }
  setInterval(() => flush(false), 6000);
  addEventListener('pagehide', () => flush(true));

  // ---------- the cauldron ----------
  const el = $('#pot');
  if (!el) return;
  const MILESTONES = [
    [100, 'Gerald notices the pot'], [500, 'Gerald gets a tiny hat'], [1000, 'the pot achieves sentience'],
    [2500, 'Gerald learns to whistle'], [5000, 'a second pig appears (his name is also Gerald)'],
    [10000, 'the pot is visible from space'], [25000, 'Gerald runs for mayor'], [50000, 'the slop gains a seat at the UN'],
    [100000, 'the pot becomes a small moon'], [250000, 'the heat death of the slop'], [1000000, 'we did not plan this far'],
  ];
  const fill = el.querySelector('.pot-fill');
  const num = el.querySelector('.pot-total');
  const detail = el.querySelector('.pot-detail');
  const next = el.querySelector('.pot-next');
  let lastUnits = null;
  const fmt = (n) => n.toLocaleString('en-US');

  function draw(p) {
    const units = p.splats + p.ladles * 5; // a ladle is chunkier than a splat
    num.textContent = fmt(units);
    detail.textContent = `${fmt(p.splats)} splats + ${fmt(p.ladles)} ladles (×5) from everyone, ever`;
    const i = MILESTONES.findIndex(([at]) => units < at);
    const [goal, prize] = i === -1 ? [units, 'you broke the pot. congratulations.'] : MILESTONES[i];
    const prev = i > 0 ? MILESTONES[i - 1] : null;
    const base = prev ? prev[0] : 0;
    fill.style.height = Math.max(4, Math.min(100, ((units - base) / Math.max(1, goal - base)) * 100)) + '%';
    next.textContent = i === -1 ? prize : `next at ${fmt(goal)}: ${prize}` + (prev ? ` · unlocked: ${prev[1]}` : '');
    if (lastUnits != null && prev && lastUnits < prev[0] && units >= prev[0]) toast(`🍲 POT MILESTONE: ${prev[1]}!`, 3500);
    if (lastUnits != null && units > lastUnits && !reduceMotion) { el.classList.remove('bubble'); void el.offsetWidth; el.classList.add('bubble'); }
    lastUnits = units;
  }
  async function refresh() { try { draw(await api('/api/pot')); } catch { num.textContent = '???'; detail.textContent = 'the pot lid is stuck. try later.'; } }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 20000);
})();
