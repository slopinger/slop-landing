// slop.js — the slop engine. no frameworks, no build step, no regrets.
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // localStorage can throw (private mode, blocked storage); slop must go on regardless
  const store = {
    get(k, d) { try { const v = localStorage.getItem('slop:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('slop:' + k, JSON.stringify(v)); } catch { /* /dev/null */ } },
  };

  // ---------- tiny event bus: features emit, the passport and the pot listen ----------
  const bus = new EventTarget();
  const on = (type, fn) => bus.addEventListener(type, (e) => fn(e.detail));
  const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

  // ---------- every visit is uniquely crooked ----------
  const wobbleScale = Math.min(1, innerWidth / 800);
  document.querySelectorAll('.tilt').forEach((el) => {
    el.style.setProperty('--tilt', (rand(-2.2, 2.2) * (el.classList.contains('controls') ? .6 : 1)).toFixed(2) + 'deg');
    if (el.classList.contains('card')) el.style.setProperty('--nudge', Math.round(rand(-16, 16) * wobbleScale) + 'px');
  });

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, ms = 2000) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ---------- sound (synthesized squelches, opt-in) ----------
  let audio = null;
  let soundOn = store.get('sound', false);
  const soundBtn = $('#sound');
  function syncSoundBtn() {
    soundBtn.textContent = soundOn ? '🔊 sound' : '🔇 sound';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
  }
  syncSoundBtn();
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    store.set('sound', soundOn);
    syncSoundBtn();
    if (soundOn) { squelch(1, .6); toast('🔊 squelch mode: ON'); }
  });
  function ac() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }
  function squelch(pitch = 1, vol = .4) {
    if (!soundOn) return;
    try {
      const a = ac(), now = a.currentTime, dur = rand(.18, .32);
      const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = a.createBufferSource(); src.buffer = buf;
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9;
      f.frequency.setValueAtTime(rand(700, 1100) * pitch, now);
      f.frequency.exponentialRampToValueAtTime(rand(110, 170) * pitch, now + dur);
      const g = a.createGain();
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(.001, now + dur);
      src.connect(f).connect(g).connect(a.destination);
      src.start(now);
    } catch { /* silence is also slop */ }
  }
  function sigh() { // a long, tired exhale: breathy noise through a closing low-pass filter
    if (!soundOn) return;
    try {
      const a = ac(), now = a.currentTime, dur = rand(.5, .7);
      const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(); src.buffer = buf;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(rand(1300, 1600), now);
      lp.frequency.exponentialRampToValueAtTime(rand(250, 320), now + dur);
      const g = a.createGain();
      g.gain.setValueAtTime(.0001, now);
      g.gain.exponentialRampToValueAtTime(.3, now + .08);
      g.gain.exponentialRampToValueAtTime(.0001, now + dur);
      src.connect(lp).connect(g).connect(a.destination);
      src.start(now);
    } catch { /* too tired to sigh */ }
  }

  // =====================================================================
  // THE SLIME ENGINE
  // Metaballs: every blob is a soft radial sprite added into a low-res
  // alpha field; a lookup table then thresholds the field into cartoon
  // slime (dark outline + shaded lavender) and the browser upscales it.
  // =====================================================================
  const cv = $('#slime');
  const ctx = cv.getContext('2d');
  const field = document.createElement('canvas');
  const fctx = field.getContext('2d', { willReadFrequently: true });

  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  {
    const s = sprite.getContext('2d');
    const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(.45, 'rgba(255,255,255,.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    s.fillStyle = g;
    s.fillRect(0, 0, 64, 64);
  }
  const SPRITE_K = 2.25; // visible radius -> sprite radius (threshold sits at ~45% of the sprite)

  // field alpha (0..255) -> packed RGBA (little-endian ABGR)
  const LUT = new Uint32Array(256);
  for (let v = 0; v < 256; v++) {
    let r, g, b, a;
    if (v < 104) { r = g = b = a = 0; }
    else if (v < 126) { // ink outline, anti-aliased on the outer edge
      r = 35; g = 35; b = 50;
      a = Math.round(clamp((v - 104) / 10, 0, 1) * 255);
    } else {
      // darker rim, brighter belly, plus a glossy band just inside the rim
      const t = clamp((v - 126) / 70, 0, 1);
      r = Math.round(117 + t * 66); g = Math.round(97 + t * 67); b = Math.round(142 + t * 64);
      if (v > 150 && v < 162) { r = 220; g = 210; b = 237; }
      a = 255;
    }
    LUT[v] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  let W = 0, H = 0, S = 4, fw = 0, fh = 0, img = null, px = null;
  let ceiling = [];
  const drips = [];
  const blobs = [];   // free-flying slop with physics
  const trails = [];  // stationary strands that shrink away
  const pool = { level: 0, target: 0, draining: false, max: 70 };
  const mouse = { x: -100, y: -100, tx: -100, ty: -100, active: false, lastTrail: 0 };
  let spawnRate = 0.75; // drips per second
  let spawnAcc = 0;

  function resize() {
    W = innerWidth; H = innerHeight;
    S = W < 700 ? 2 : 3;
    fw = Math.ceil(W / S); fh = Math.ceil(H / S);
    cv.width = field.width = fw;
    cv.height = field.height = fh;
    img = ctx.createImageData(fw, fh);
    px = new Uint32Array(img.data.buffer);
    pool.max = Math.min(70, H * .075);
    ceiling = [];
    for (let x = -10; x < W + 30; x += rand(20, 30)) ceiling.push({ x, r: rand(13, 19), ph: rand(0, 6.28) });
  }

  const poolSurface = () => H + 26 - pool.level;

  function addToPool(r) {
    if (pool.draining) return;
    pool.target = Math.min(pool.max + 4, pool.target + (Math.PI * r * r * 7) / W);
  }

  function spawnDrip(x = rand(0, W)) {
    drips.push({ x, y: 8, r: 3, rmax: rand(8, 15), grow: rand(4, 10), vy: 0, falling: false, lastTrailY: 0 });
  }

  function splat(x, y, n = 14, power = 1) {
    for (let i = 0; i < n && blobs.length < 500; i++) {
      const ang = rand(-Math.PI * .95, -Math.PI * .05); // mostly upwards
      const sp = rand(150, 650) * power;
      blobs.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: rand(4, 11) });
    }
    blobs.push({ x, y, vx: 0, vy: -40, r: 14 });
    squelch(rand(.8, 1.3), .45);
  }

  function update(dt, t) {
    // new drips
    spawnAcc += dt * spawnRate;
    while (spawnAcc >= 1) { spawnAcc -= 1; if (drips.length < 40) spawnDrip(); }

    // drips: grow on the ceiling, sag, let go, fall, leave a strand
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      if (!d.falling) {
        d.r += d.grow * dt;
        d.y += (4 + d.r * .9) * dt;
        if (d.r >= d.rmax) { d.falling = true; d.lastTrailY = d.y; }
      } else {
        d.vy += 1300 * dt;
        d.y += d.vy * dt;
        while (d.y - d.lastTrailY > 9) {
          d.lastTrailY += 9;
          trails.push({ x: d.x + rand(-1, 1), y: d.lastTrailY, r: d.r * rand(.35, .55), shrink: rand(10, 22) });
        }
        if (d.y > poolSurface()) {
          addToPool(d.r);
          for (let k = 0; k < 3; k++) blobs.push({ x: d.x, y: d.y - 8, vx: rand(-120, 120), vy: rand(-260, -120), r: rand(3, 6) });
          drips.splice(i, 1);
        }
      }
    }

    // trails shrink and slooowly slide
    for (let i = trails.length - 1; i >= 0; i--) {
      const s = trails[i];
      s.r -= s.shrink * dt;
      s.y += 14 * dt;
      if (s.r < .8) trails.splice(i, 1);
    }
    if (trails.length > 1200) trails.splice(0, trails.length - 1200);

    // free blobs
    for (let i = blobs.length - 1; i >= 0; i--) {
      const b = blobs[i];
      b.vy += 1100 * dt;
      b.vx *= 1 - .8 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 0) { b.x = 0; b.vx *= -.4; }
      if (b.x > W) { b.x = W; b.vx *= -.4; }
      if (b.y > poolSurface() + 4) { addToPool(b.r); blobs.splice(i, 1); }
    }

    // the pool rises... and then it gets slurped
    if (pool.draining) {
      pool.target = 0;
      pool.level = Math.max(0, pool.level - 90 * dt);
      if (pool.level <= 0) pool.draining = false;
    } else {
      pool.level += (pool.target - pool.level) * Math.min(1, dt * 2);
      if (pool.level >= pool.max) {
        pool.draining = true;
        toast(pick(['*SLUUUURP*', '*glorp*', '🖤 *slurping intensifies*', '*schlorp*']), 1400);
        squelch(.5, .6);
      }
    }

    // cursor blob chases the cursor
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 18);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 18);
    if (mouse.active && t - mouse.lastTrail > .03) {
      const sp = Math.hypot(mouse.tx - mouse.x, mouse.ty - mouse.y);
      if (sp > 6) { trails.push({ x: mouse.x, y: mouse.y, r: Math.min(7, 2 + sp * .12), shrink: 18 }); mouse.lastTrail = t; }
    }
  }

  function render(t) {
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, fw, fh);
    fctx.globalCompositeOperation = 'lighter';
    const ball = (x, y, r) => {
      const R = (r * SPRITE_K) / S;
      fctx.drawImage(sprite, x / S - R, y / S - R, R * 2, R * 2);
    };

    for (const c of ceiling) ball(c.x, 2 + Math.sin(t * 1.3 + c.ph) * 2.5, c.r + Math.sin(t * .9 + c.ph) * 1.5);
    for (const d of drips) {
      ball(d.x, d.y, d.r);
      if (!d.falling) ball(d.x, (d.y + 4) / 2, d.r * .7); // neck to the ceiling
    }
    for (const s of trails) ball(s.x, s.y, s.r);
    for (const b of blobs) ball(b.x, b.y, b.r);
    if (mouse.active) ball(mouse.x, mouse.y, 8);

    if (pool.level > 1) {
      const top = poolSurface();
      for (let x = -20, i = 0; x < W + 40; x += 28, i++) ball(x, top + Math.sin(t * 2 + i * .7) * 4, 22 + Math.sin(t * 1.4 + i) * 3);
      fctx.fillStyle = '#fff';
      fctx.fillRect(0, (top + 6) / S, fw, fh);
    }

    const data = fctx.getImageData(0, 0, fw, fh).data;
    for (let i = 0, j = 3; i < px.length; i++, j += 4) px[i] = LUT[data[j]];
    ctx.putImageData(img, 0, 0);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    update(dt, now / 1000);
    render(now / 1000);
    requestAnimationFrame(frame);
  }

  resize();
  addEventListener('resize', () => { resize(); if (reduceMotion) render(0); });
  if (reduceMotion) {
    render(0); // a static ceiling of slop. very calm. very still.
  } else {
    for (let i = 0; i < 5; i++) spawnDrip();
    requestAnimationFrame(frame);
  }

  // ---------- pointer: splat anywhere, slime follows the mouse ----------
  const interactive = 'button, a, input, textarea, label, select, .controls, .som-out, .arena';
  document.addEventListener('pointerdown', (e) => {
    if (reduceMotion || e.button > 0 || e.target.closest(interactive)) return;
    splat(e.clientX, e.clientY);
    emit('splat');
  });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.tx = e.clientX; mouse.ty = e.clientY;
    if (!mouse.active) { mouse.x = mouse.tx; mouse.y = mouse.ty; mouse.active = true; }
  });
  document.documentElement.addEventListener('mouseleave', () => { mouse.active = false; });

  $('#mop').addEventListener('click', () => {
    drips.length = blobs.length = trails.length = 0;
    pool.level = pool.target = 0; pool.draining = false;
    if (reduceMotion) render(0);
    emit('mop');
    toast(pick(['🧽 mopped. (it will be back)', '🧽 squeaky clean. for now.', '🧽 the slop remembers.']));
  });
  $('#more').addEventListener('click', () => {
    spawnRate = Math.min(spawnRate * 1.6, 25);
    for (let i = 0; i < 6; i++) spawnDrip();
    toast(`💧 slop output: ${Math.round((spawnRate / .75) * 100)}%`);
  });

  // =====================================================================
  // API (slopd, proxied by Caddy at /api/*)
  // =====================================================================
  async function api(path, body) {
    const opts = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `the server made a weird noise (${r.status})`);
    return j;
  }

  // =====================================================================
  // ↑ ↑ ↓ ↓ ← → ← → B A
  // =====================================================================
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kpos = 0;
  let maxSlop = false;
  function setMaxSlop(onOff, quiet) { // persists across pages, because once is never enough
    maxSlop = onOff;
    store.set('maxslop', maxSlop);
    document.documentElement.classList.toggle('max-slop', maxSlop);
    spawnRate = maxSlop ? 12 : .75;
    emit('maxslop', maxSlop);
    if (quiet) return;
    if (maxSlop && !reduceMotion) splat(W / 2, H / 2, 120, 2);
    toast(maxSlop ? '☢️ MAXIMUM SLOP ENGAGED ☢️' : 'slop levels returning to "normal"', 2500);
  }
  document.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = k === konami[kpos] ? kpos + 1 : k === konami[0] ? 1 : 0;
    if (kpos < konami.length) return;
    kpos = 0;
    setMaxSlop(!maxSlop);
  });

  // ---------- nav: mark the current page ----------
  const here = location.pathname.replace(/index\.html$/, '');
  document.querySelectorAll('.nav a').forEach((a) => {
    if (new URL(a.href).pathname === here) a.setAttribute('aria-current', 'page');
  });

  // shared bits for the page modules in js/
  window.slop = {
    $, rand, pick, clamp, toast, squelch, sigh, store, reduceMotion, api, on, emit,
    splat(x, y, n, power) { if (!reduceMotion) splat(x, y, n, power); },
    blob(x, y, vx, vy, r) { if (!reduceMotion && blobs.length < 500) blobs.push({ x, y, vx, vy, r }); },
    setMaxSlop, get maxSlop() { return maxSlop; },
  };
  // modules load after this script, so re-apply a persisted MAXIMUM SLOP once they've subscribed
  if (store.get('maxslop', false)) addEventListener('DOMContentLoaded', () => setMaxSlop(true, true));

  console.log('%cFREIFICK', 'font: 64px "Rubik Wet Paint", cursive; color: #b7a4ce; text-shadow: 3px 3px 0 #5865f2', '\nhi. you found the console. you are now the second person in this room. (there is always more slop.)');
})();
