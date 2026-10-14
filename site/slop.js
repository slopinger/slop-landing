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
  function oink() {
    if (!soundOn) return;
    try {
      const a = ac(), now = a.currentTime;
      for (const [t0, f0] of [[0, rand(230, 280)], [.16, rand(190, 230)]]) {
        const o = a.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f0, now + t0);
        o.frequency.exponentialRampToValueAtTime(f0 * .55, now + t0 + .13);
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 6;
        const g = a.createGain();
        g.gain.setValueAtTime(.0001, now + t0);
        g.gain.exponentialRampToValueAtTime(.35, now + t0 + .02);
        g.gain.exponentialRampToValueAtTime(.0001, now + t0 + .14);
        o.connect(lp).connect(g).connect(a.destination);
        o.start(now + t0); o.stop(now + t0 + .16);
      }
    } catch { /* the pig is mute */ }
  }

  // =====================================================================
  // THE SLIME ENGINE
  // Metaballs: every blob is a soft radial sprite added into a low-res
  // alpha field; a lookup table then thresholds the field into cartoon
  // slime (dark outline + shaded green) and the browser upscales it.
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
      r = 42; g = 33; b = 24;
      a = Math.round(clamp((v - 104) / 10, 0, 1) * 255);
    } else {
      // darker rim, brighter belly, plus a glossy band just inside the rim
      const t = clamp((v - 126) / 70, 0, 1);
      r = Math.round(62 + t * 66); g = Math.round(150 + t * 62); b = Math.round(22 + t * 36);
      if (v > 150 && v < 162) { r = 175; g = 245; b = 120; }
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
        toast(pick(['*SLUUUURP*', '*glorp*', '🐖 *slurping intensifies*', '*schlorp*']), 1400);
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
    toast(pick(['🧽 mopped. (it will be back)', '🧽 squeaky clean. for now.', '🧽 the slop remembers.']));
  });
  $('#more').addEventListener('click', () => {
    spawnRate = Math.min(spawnRate * 1.6, 25);
    for (let i = 0; i < 6; i++) spawnDrip();
    toast(`💧 slop output: ${Math.round((spawnRate / .75) * 100)}%`);
  });

  // =====================================================================
  // SLOP-O-MATIC 3000
  // =====================================================================
  const words = {
    adj: ['robust', 'seamless', 'transformative', 'holistic', 'cutting-edge', 'multifaceted', 'synergistic', 'game-changing',
      'vibrant', 'pivotal', 'nuanced', 'ever-evolving', 'scalable', 'bespoke', 'frictionless', 'disruptive', 'intricate',
      'AI-powered', 'next-generation', 'mission-critical', 'deeply human', 'blockchain-enabled', 'artisanal', 'moist'],
    noun: ['synergy', 'the human experience', 'paradigms', 'innovation', 'stakeholder alignment', 'the slop economy',
      'thought leadership', 'the customer journey', 'value creation', 'our core competencies', 'digital transformation',
      'the trough', 'best practices', 'empowerment', 'the rich tapestry of life', 'growth hacking', 'the metaverse',
      'actionable insights', 'company culture', 'the pig', 'quarterly vibes', 'the grindset', 'authentic engagement',
      'learnings', 'the bottom line', 'circular slop'],
    verb: ['elevate', 'empower', 'unlock', 'reimagine', 'streamline', 'harness', 'foster', 'navigate', 'supercharge',
      'delve into', 'revolutionize', 'operationalize', 'ladle', 'double-click on', 'circle back on', 'democratize'],
    persona: ['seasoned professional', 'curious beginner', 'visionary founder', 'hungry pig', '10x engineer',
      'LinkedIn influencer', 'sentient spreadsheet', 'Chief Slop Officer', 'unpaid intern', 'thought leader', 'golden retriever'],
    num: ['3', '5', '7', '10', '11', '42', '69'],
    emoji: ['🚀', '✨', '💡', '🔥', '🙌', '📈', '🐖', '💯', '🤝', '🌟', '🧠', '⚡', '🎯', '🫡'],
  };
  const openers = [
    'Great question!', "In today's fast-paced digital landscape, everything is changing.", "Let's delve into it.",
    'Buckle up.', 'In an era defined by rapid change, one thing remains constant: slop.', 'Picture this:',
    "Here's the thing nobody is talking about:", 'I was today years old when I realized something.',
    'Unpopular opinion:', 'I almost didn\'t post this.', 'Stop scrolling.', 'My pig taught me a powerful lesson about {noun}.',
  ];
  const templates = [
    "It's not just {noun} — it's {noun}.",
    'By leveraging {adj} {noun}, we can {verb} {noun} at scale.',
    "This isn't merely about {noun}; it's about how we {verb} {noun}.",
    'The {adj} tapestry of {noun} invites us to {verb} {noun}.',
    "Whether you're a {persona} or a {persona}, {noun} offers something for everyone.",
    'Here are {num} key takeaways about {noun} that changed my life.',
    'Let that sink in.',
    'And honestly? That\'s {adj}.',
    "Here's why that matters 👇",
    'At its core, {noun} is a {adj} journey, not a destination.',
    'We must {verb} {noun} to truly {verb} {noun}.',
    'Studies show* that {num}% of every {persona} underestimates {noun}. (*no they don\'t)',
    'Navigating the {adj} world of {noun} requires a {adj} mindset.',
    'I asked a {persona} about {noun}. Their answer? Silence. Then: slop.',
    'In many ways, {noun} is the new {noun}.',
    'The real {noun} was the {noun} we made along the way.',
    'This is a {adj} reminder that {noun} is {adj}.',
    'I hired a {persona}. Best decision I ever made for {noun}.',
  ];
  const closers = [
    'In conclusion, the future of {noun} is {adj}.', "Ultimately, it's a testament to the power of {noun}.",
    'I hope this helps! 😊', "Let me know if you'd like me to delve deeper!", 'Agree? ♻️ Repost to spread the slop.',
    'Thoughts? 👇', "I'm humbled and honored to share this.", "What's your take on {noun}? Let's discuss in the comments.",
    '#slop #{noun} #thoughtleadership #grateful',
  ];
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => {
    const w = pick(words[k]);
    return s.startsWith('#') && k === 'noun' ? w.replace(/[^a-z0-9]/gi, '') : w;
  });

  function typo(word) {
    if (word.length < 4 || Math.random() > .5) return word;
    const i = Math.floor(rand(1, word.length - 2));
    return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
  }
  function sprinkle(s, lvl) {
    let out = s;
    if (Math.random() < lvl / 15) {
      const w = out.split(' ');
      const i = Math.floor(Math.random() * w.length);
      if (/^[a-z-]{4,}$/i.test(w[i])) w[i] = '**' + w[i] + '**';
      out = w.join(' ');
    }
    if (lvl >= 7 && Math.random() < .3) out = out.replace(/, /, ' — ');
    if (lvl >= 11) out = out.split(' ').map((w) => (Math.random() < .15 ? w.toUpperCase() : Math.random() < .12 ? typo(w) : w)).join(' ');
    if (Math.random() < lvl / 12) out += ' ' + pick(words.emoji) + (lvl >= 10 ? pick(words.emoji) : '');
    return out;
  }
  function generateSlop(lvl) {
    const lines = [];
    if (lvl >= 9) lines.push(pick(['Certainly! Here is the slop you requested:', 'Absolutely! 🙌', 'As an AI language model, I love slop.']));
    lines.push(fill(pick(openers)));
    const pool = templates.slice().sort(() => Math.random() - .5);
    const n = 1 + Math.round(lvl * .7);
    for (let i = 0; i < n; i++) lines.push(fill(pool[i % pool.length]));
    lines.push(fill(pick(closers)));
    const s = lines.map((l) => sprinkle(l, lvl));
    if (lvl >= 8) return s.join('\n\n'); // full broetry
    if (lvl >= 4) { const p = []; for (let i = 0; i < s.length; i += 2) p.push(s.slice(i, i + 2).join(' ')); return p.join('\n\n'); }
    return s.join(' ');
  }

  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const somOut = $('#som-out');
  const intensity = $('#intensity');
  let currentSlop = '';
  let typer = null;
  function renderSlop(text, typing) {
    let html = escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*\*/g, '');
    somOut.innerHTML = html + (typing ? '<span class="caret"></span>' : '');
  }
  function syncIntensity() {
    const v = +intensity.value;
    $('#intensity-val').textContent = v;
    $('#intensity-warn').textContent = v === 11 ? '☢️ THIS ONE GOES TO ELEVEN' : v >= 9 ? '⚠️ hazardous' : v <= 2 ? '(barely slop)' : '';
    $('#slopomatic').classList.toggle('intensity-11', v === 11 && !reduceMotion);
  }
  intensity.addEventListener('input', syncIntensity);
  syncIntensity();

  $('#generate').addEventListener('click', () => {
    currentSlop = generateSlop(+intensity.value);
    clearInterval(typer);
    squelch(1.4, .25);
    if (reduceMotion) { renderSlop(currentSlop, false); return; }
    let i = 0;
    const step = Math.max(2, Math.ceil(currentSlop.length / 80));
    typer = setInterval(() => {
      i = Math.min(currentSlop.length, i + step);
      renderSlop(currentSlop.slice(0, i), i < currentSlop.length);
      if (i >= currentSlop.length) clearInterval(typer);
    }, 18);
  });
  $('#copy').addEventListener('click', async () => {
    if (!currentSlop) { toast('generate some slop first, you absolute muffin'); return; }
    try {
      await navigator.clipboard.writeText(currentSlop.replace(/\*\*/g, ''));
      toast(pick(['📋 copied! go forth and post.', '📋 copied. your network will be thrilled.', '📋 copied. #grateful']));
    } catch { toast('clipboard said no. select it manually like a peasant.'); }
  });

  // =====================================================================
  // GERALD THE PIG
  // =====================================================================
  const MAX_FAT = 12;
  const gerald = $('#gerald');
  const bubble = $('#bubble');
  const feedBtn = $('#feed');
  let fat = 0;
  let ladles = store.get('ladles', 0);
  let exploded = store.get('exploded', 0);
  const pigSays = [
    ['oink', 'more pls', 'mmm, synergy', 'is this organic?', 'delicious', 'ah yes. slop.', 'OINK', 'thank u'],
    ['*chewing noises*', 'i can taste colors', 'one more. just one more.', 'this is my passion', 'i am thriving', 'oink (satisfied)'],
    ['i feel... unstable', 'tell my piglets i love them', 'my pants are tight (i have no pants)', 'GERALD IS BECOME SLOP', 'this is fine', 'oink...?'],
  ];
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function syncPig() {
    gerald.style.setProperty('--fat', (1 + fat * .085).toFixed(3));
    $('#meter').style.width = (fat / MAX_FAT) * 100 + '%';
    $('#trough-slop').style.setProperty('--slop', 15 + (fat % 4) * 20 + '%');
    $('#ladles').textContent = ladles;
    $('#exploded').textContent = exploded;
  }
  syncPig();

  feedBtn.addEventListener('click', () => {
    fat++; ladles++;
    store.set('ladles', ladles);
    bubble.textContent = pick(pigSays[fat < 5 ? 0 : fat < 9 ? 1 : 2]);
    restart(gerald, 'chomp');
    squelch(rand(.9, 1.2), .4);
    setTimeout(oink, 180);
    const r = $('.trough').getBoundingClientRect();
    if (!reduceMotion) for (let i = 0; i < 3; i++) blobs.push({ x: r.left + rand(10, r.width - 10), y: r.top + 6, vx: rand(-60, 60), vy: rand(-220, -80), r: rand(4, 8) });
    if (fat >= MAX_FAT) {
      feedBtn.disabled = true;
      bubble.textContent = 'pig.exe has stopped responding';
      gerald.classList.remove('chomp');
      gerald.classList.add('boom');
      setTimeout(() => {
        const g = gerald.getBoundingClientRect();
        if (!reduceMotion) { splat(g.left + g.width / 2, g.top + g.height / 2, 70, 1.5); squelch(.4, .8); }
        exploded++;
        store.set('exploded', exploded);
        toast('💥 GERALD HAS EXPLODED. a new Gerald will be along shortly.', 2600);
        fat = 0;
        syncPig();
      }, 380);
      setTimeout(() => {
        gerald.classList.remove('boom');
        restart(gerald, 'respawn');
        bubble.textContent = pick(["hi i'm Gerald (new)", 'hello. i am Gerald.', 'what happened to the last guy?', 'Gerald v' + (exploded + 1) + '.0 online']);
        feedBtn.disabled = false;
      }, 1800);
    }
    syncPig();
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
  // GUESTBOOK (real! stored by slopd)
  // =====================================================================
  const archive = [
    { name: 'xX_SlopMaster_Xx', message: 'first!!!!1', d: '1998-04-01' },
    { name: 'your mom', message: 'very nice website sweetie. how do i make the letters bigger', d: '2003-11-23' },
    { name: 'Clippy', message: "It looks like you're writing slop. Would you like help?", d: '1997-01-30' },
    { name: 'webmaster', message: 'sorry, the site is under construction', d: '1999-12-31' },
    { name: 'a mysterious stranger', message: 'i have seen the slop. the slop has seen me.', d: '2012-12-21' },
  ];
  const gb = { entries: [], status: 'loading', more: false, freshId: null };
  const entriesEl = $('#entries');
  const moreBtn = $('#gb-more');
  try { localStorage.removeItem('slop:gb'); localStorage.removeItem('slop:visits'); } catch { /* the old fake guestbook/counter state, now obsolete */ }

  function ago(ts) {
    const s = Date.now() / 1000 - ts;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }
  function entryEl(e, cls, when) {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    const b = document.createElement('b');
    b.textContent = e.name;
    const w = document.createElement('span');
    w.className = 'when';
    w.textContent = '· ' + when;
    li.append(b, ': ', document.createTextNode(e.message), w);
    return li;
  }
  function statusEl(text) {
    const li = document.createElement('li');
    li.className = 'status';
    li.textContent = text;
    return li;
  }
  function renderEntries() {
    entriesEl.textContent = '';
    if (gb.status === 'loading') entriesEl.append(statusEl('loading slop…'));
    else if (gb.status === 'down') entriesEl.append(statusEl('the guestbook server is busy eating. try again later. 🐖'));
    else if (!gb.entries.length) entriesEl.append(statusEl('nobody has signed yet. be the first!!! (you are legally allowed to write "first!!!")'));
    for (const e of gb.entries) entriesEl.append(entryEl(e, e.id === gb.freshId ? 'fresh' : '', ago(e.created)));
    moreBtn.hidden = !gb.more;
    if (gb.more) return; // the archive lives at the very bottom
    const h = document.createElement('li');
    h.className = 'archive-h';
    h.textContent = '— recovered from the 1998 geocities archive —';
    entriesEl.append(h);
    for (const e of archive) entriesEl.append(entryEl(e, 'archived', e.d));
  }
  async function loadEntries(before) {
    try {
      const j = await api('/api/guestbook' + (before ? `?before=${before}` : ''));
      gb.entries = before ? gb.entries.concat(j.entries) : j.entries;
      gb.more = j.more;
      gb.status = 'ok';
    } catch {
      if (!before) gb.status = 'down';
      else toast('could not load older slop. it may have fossilized.');
    }
    renderEntries();
  }
  renderEntries();
  loadEntries();
  setInterval(() => { if (!document.hidden && gb.status !== 'loading') refreshEntries(); }, 60000);
  async function refreshEntries() { // pick up new entries from other people without losing loaded pages
    try {
      const j = await api('/api/guestbook');
      const known = new Set(gb.entries.map((e) => e.id));
      const fresh = j.entries.filter((e) => !known.has(e.id));
      if (fresh.length || gb.status !== 'ok') {
        gb.entries = gb.status === 'ok' ? fresh.concat(gb.entries) : j.entries;
        if (gb.status !== 'ok') gb.more = j.more;
        gb.status = 'ok';
        renderEntries();
      }
    } catch { /* still eating */ }
  }
  moreBtn.addEventListener('click', () => {
    const last = gb.entries[gb.entries.length - 1];
    if (last) loadEntries(last.id);
  });

  $('#gb-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = $('#gb-msg').value.trim();
    if (!message) return;
    const btn = $('#gb-submit');
    btn.disabled = true;
    btn.textContent = '⏳ ladling…';
    try {
      const j = await api('/api/guestbook', { name: $('#gb-name').value, message, website: $('#gb-website').value });
      if (j.entry.id) {
        gb.entries = [j.entry, ...gb.entries.filter((x) => x.id !== j.entry.id)];
        gb.freshId = j.entry.id;
        gb.status = 'ok';
      }
      renderEntries();
      $('#gb-msg').value = '';
      toast(pick(['✅ signed! the whole internet can see it now.', '✅ signed. Gerald read it. Gerald approves.', '✅ your slop has been immortalized.']));
      const r = btn.getBoundingClientRect();
      if (!reduceMotion) splat(r.left + r.width / 2, r.top, 18, .8);
    } catch (err) {
      toast('❌ ' + err.message, 3000);
    } finally {
      btn.disabled = false;
      btn.textContent = '✍️ sign';
    }
  });

  // =====================================================================
  // HIT COUNTER (real! counted by slopd, one count per visitor per 30 min)
  // =====================================================================
  const counter = $('#counter');
  const counterNote = $('#counter-note');
  const counterLive = $('#counter-live');
  const pad = (n) => String(n).padStart(7, '0');
  let myNumber = null;
  let nanTimer = null;
  function showLive(total) {
    if (myNumber == null || total <= myNumber) { counterLive.textContent = ''; return; }
    const n = total - myNumber;
    counterLive.textContent = `${n} more ${n === 1 ? 'person has' : 'people have'} arrived since you. total: ${total}.`;
  }
  api('/api/visits', {})
    .then((j) => {
      myNumber = j.visitor;
      counter.textContent = pad(j.visitor);
      counterNote.textContent = j.counted
        ? (j.visitor === 1 ? '(you are the FIRST. this number is real. we are as surprised as you.)' : '(this number is real now. we are as surprised as you.)')
        : '(welcome back! you were already counted. no double-dipping in the trough.)';
      showLive(j.total);
      setInterval(() => {
        if (!document.hidden) api('/api/visits').then((v) => showLive(v.total)).catch(() => {});
      }, 30000);
    })
    .catch(() => {
      counter.textContent = 'ERR0R';
      counterNote.textContent = '(the counter fell in the slop. it will be fished out shortly.)';
    });
  counter.addEventListener('click', () => {
    if (myNumber == null) return;
    counter.textContent = 'NaNNaNN';
    clearTimeout(nanTimer);
    nanTimer = setTimeout(() => { counter.textContent = pad(myNumber); }, 1500);
    toast('counter reset. (just kidding. it is a real counter now. no take-backs.)', 2600);
  });

  // =====================================================================
  // ↑ ↑ ↓ ↓ ← → ← → B A
  // =====================================================================
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kpos = 0;
  let maxSlop = false;
  document.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = k === konami[kpos] ? kpos + 1 : k === konami[0] ? 1 : 0;
    if (kpos < konami.length) return;
    kpos = 0;
    maxSlop = !maxSlop;
    document.documentElement.classList.toggle('max-slop', maxSlop);
    spawnRate = maxSlop ? 12 : .75;
    intensity.value = maxSlop ? 11 : 5;
    syncIntensity();
    if (maxSlop && !reduceMotion) splat(W / 2, H / 2, 120, 2);
    toast(maxSlop ? '☢️ MAXIMUM SLOP ENGAGED ☢️' : 'slop levels returning to "normal"', 2500);
  });

  // shared bits for games.js (the slop arcade)
  window.slop = {
    $, rand, pick, clamp, toast, squelch, oink, store, reduceMotion,
    splat(x, y, n, power) { if (!reduceMotion) splat(x, y, n, power); },
  };

  console.log('%cFREIFICK', 'font: 64px "Rubik Wet Paint", cursive; color: #7bd43a; text-shadow: 3px 3px 0 #ff5fa2', '\nhi. you found the console. there is no more slop in here. (there is always more slop.)');
})();
