// the global slop pot: every visitor's splats and ladles go into one shared pot (slopd /api/pot).
// reporting runs on every page; the cauldron is drawn wherever #pot exists.
//
// the number shown is (latest server total) + (your own slop that hasn't been sent yet), so your
// clicks count up instantly, and it never goes backwards: the real pot only ever grows, so an older
// or overlapping server answer is never allowed to make the display drop.
(() => {
  'use strict';
  const { $, api, on, toast, reduceMotion } = window.slop;

  const el = $('#pot');
  const pending = { splats: 0, ladles: 0 }; // counted locally, not yet sent
  let inflight = { splats: 0, ladles: 0 };  // sent, waiting for the server to confirm
  let server = null;                        // newest server snapshot we have seen
  let busy = false;                         // one request at a time, so answers can't arrive out of order
  const units = (p) => p.splats + p.ladles * 5; // a ladle is chunkier than a splat

  on('splat', () => { pending.splats++; render(); });
  on('ladle', () => { pending.ladles++; render(); });

  function accept(p) {
    if (p && typeof p.splats === 'number' && (!server || units(p) >= units(server))) server = p;
  }

  async function sync(keepalive) {
    if (busy) return;
    const hasSlop = pending.splats || pending.ladles;
    if (!hasSlop && !el) return; // nothing to send and nothing to draw on this page
    busy = true;
    try {
      if (hasSlop) {
        inflight = { splats: Math.min(pending.splats, 50), ladles: Math.min(pending.ladles, 20) }; // server caps per request
        pending.splats -= inflight.splats; pending.ladles -= inflight.ladles;
        const r = await fetch('/api/pot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inflight), keepalive });
        if (r.ok) accept(await r.json());
        else if (r.status === 429) { pending.splats += inflight.splats; pending.ladles += inflight.ladles; } // too fast: retry next round
      } else {
        accept(await api('/api/pot'));
      }
    } catch { /* the pot is offline; that slop is lost to the void */ }
    inflight = { splats: 0, ladles: 0 };
    busy = false;
    render();
  }
  setInterval(() => { if (!document.hidden || pending.splats || pending.ladles) sync(false); }, el ? 5000 : 6000);
  addEventListener('pagehide', () => sync(true));

  // ---------- the cauldron ----------
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
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  let shown = null;   // the number currently on screen (animated towards target)
  let target = 0;
  let anim = 0;

  function render() {
    if (!server) return;
    const mine = units(pending) + units(inflight);
    target = Math.max(target, units(server) + mine); // never backwards
    detail.textContent = `${fmt(server.splats + pending.splats + inflight.splats)} splats + ${fmt(server.ladles + pending.ladles + inflight.ladles)} ladles (×5) from everyone, ever`;
    if (shown == null || reduceMotion) { paint(target); return; }
    if (!anim) anim = requestAnimationFrame(step);
  }
  function step() { // count up smoothly instead of teleporting
    const d = target - shown;
    paint(d < 0.5 ? target : shown + Math.max(0.5, d * 0.18));
    anim = shown < target ? requestAnimationFrame(step) : 0;
  }
  function paint(v) {
    const before = shown;
    shown = v;
    num.textContent = fmt(v);
    const i = MILESTONES.findIndex(([at]) => v < at);
    const [goal, prize] = i === -1 ? [v, 'you broke the pot. congratulations.'] : MILESTONES[i];
    const prev = i > 0 ? MILESTONES[i - 1] : null;
    const base = prev ? prev[0] : 0;
    fill.style.height = Math.max(4, Math.min(100, ((v - base) / Math.max(1, goal - base)) * 100)) + '%';
    next.textContent = i === -1 ? prize : `next at ${fmt(goal)}: ${prize}` + (prev ? ` · unlocked: ${prev[1]}` : '');
    if (before != null && prev && before < prev[0] && v >= prev[0]) toast(`🍲 POT MILESTONE: ${prev[1]}!`, 3500);
    if (before != null && Math.floor(v) > Math.floor(before) && !reduceMotion && !el.classList.contains('bubble')) {
      el.classList.add('bubble');
      setTimeout(() => el.classList.remove('bubble'), 1200);
    }
  }

  sync(false).then(() => { if (!server) { num.textContent = '???'; detail.textContent = 'the pot lid is stuck. try later.'; } });
})();
