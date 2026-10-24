// games.js — the slop arcade. four games, zero QA, zero sunlight.
// Borrows the toast/sound/splat helpers that slop.js puts on window.slop.
(() => {
  'use strict';
  const portrait = new Image();
  portrait.src = '/slop-avatar.png';

  const { $, rand, pick, clamp, toast, squelch, sigh, splat, store, emit } = window.slop;
  const INK = '#16152a', SLIME = '#b7a4ce', SLIME_DARK = '#75618e', RED = '#ff5d5d', GRASS = '#5fae3a', TENDIE = '#d9932f';
  const FONT = '"Comic Neue", "Comic Sans MS", cursive';
  const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  // a canvas with a world H units tall, scaled to whatever width the card gives it. the world is
  // 600 wide, or 400 on phones so the text stays readable (games read a.W, it changes on resize)
  function arena(canvas, H, redraw) {
    const ctx = canvas.getContext('2d');
    const a = {
      ctx, W: 600, H, fit,
      toWorld(e) { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * a.W, y: ((e.clientY - r.top) / r.height) * H }; },
      toScreen(x, y) { const r = canvas.getBoundingClientRect(); return [r.left + (x / a.W) * r.width, r.top + (y / H) * r.height]; },
    };
    function fit() {
      const w = canvas.parentElement.clientWidth || 600;
      a.W = w < 500 ? 400 : 600;
      canvas.style.aspectRatio = `${a.W} / ${H}`;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(((canvas.clientWidth * H) / a.W) * dpr);
      ctx.setTransform(canvas.width / a.W, 0, 0, canvas.height / H, 0, 0);
      redraw();
    }
    addEventListener('resize', fit);
    document.fonts?.ready.then(fit); // redraw once Comic Neue shows up
    return a;
  }

  // requestAnimationFrame loop; step(dt) returns false to stop
  function loop(step) {
    let last = 0, raf = 0, on = false;
    const tick = (now) => {
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      if (step(dt) === false) { on = false; return; }
      raf = requestAnimationFrame(tick);
    };
    return {
      start() { if (on) return; on = true; last = performance.now(); raf = requestAnimationFrame(tick); },
      stop() { on = false; cancelAnimationFrame(raf); },
    };
  }

  // chunky outlined text, the official typeface of slop
  function label(ctx, text, x, y, size, fill = '#fff', align = 'center') {
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = INK;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }
  function emoji(ctx, ch, x, y, size) {
    ctx.font = `${size}px ${EMOJI}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y);
  }
  function keyIs(e, ...keys) { return keys.includes(e.key) || keys.includes(e.code); }

  // =====================================================================
  // CABINET PICKER: one game on screen at a time (less scrolling), chosen by #hash
  // =====================================================================
  {
    const tabs = [...document.querySelectorAll('.cabinets a[data-game]')];
    const games = tabs.map((t) => document.getElementById(t.dataset.game)).filter(Boolean);
    function show(id) {
      if (!games.some((g) => g && g.id === id)) id = store.get('cabinet', 'whack');
      for (const g of games) if (g) g.hidden = g.id !== id;
      for (const t of tabs) t.setAttribute('aria-current', t.dataset.game === id ? 'true' : 'false');
      store.set('cabinet', id);
      dispatchEvent(new Event('resize')); // canvases measure their card; it was hidden a moment ago
    }
    for (const t of tabs) {
      t.addEventListener('click', (e) => {
        if (!t.dataset.game) return;
        e.preventDefault();
        history.replaceState(null, '', '#' + t.dataset.game);
        show(t.dataset.game);
      });
    }
    addEventListener('hashchange', () => show(location.hash.slice(1)));
    show(location.hash.slice(1));
  }

  // =====================================================================
  // WHACK-A-PING
  // =====================================================================
  {
    const ROUND = 20;
    const yard = $('#holes');
    const startBtn = $('#whack-start');
    const holes = [];
    for (let i = 0; i < 9; i++) {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'hole';
      el.setAttribute('aria-label', 'empty slot');
      const critter = document.createElement('span');
      critter.className = 'critter';
      el.append(critter);
      yard.append(el);
      const h = { el, critter, kind: null, timer: 0 };
      el.addEventListener('click', () => bonk(h));
      holes.push(h);
    }
    let playing = false, score = 0, started = 0, spawnTimer = 0, clockTimer = 0;
    let best = store.get('whackBest', 0);
    const sync = () => {
      $('#whack-score').textContent = score;
      $('#whack-best').textContent = best;
    };
    sync();

    function hide(h) {
      clearTimeout(h.timer);
      h.kind = null;
      h.el.classList.remove('up', 'gold');
      h.el.setAttribute('aria-label', 'empty slot');
    }
    function popUp() {
      if (!playing) return;
      const elapsed = (performance.now() - started) / 1000;
      const free = holes.filter((h) => !h.kind);
      if (free.length) {
        const h = pick(free);
        clearTimeout(h.timer); // a just-bonked hole may still have its sink-away timer pending
        const r = Math.random();
        h.kind = r < .2 ? 'tendie' : r < .27 ? 'gold' : 'ping';
        h.critter.textContent = h.kind === 'tendie' ? '🍗' : '🔔';
        h.el.classList.remove('bonked', 'oops');
        h.el.classList.add('up');
        h.el.classList.toggle('gold', h.kind === 'gold');
        h.el.setAttribute('aria-label', h.kind === 'tendie' ? 'tendies! do not bonk' : h.kind === 'gold' ? '@everyone ping! bonk it' : 'ping! bonk it');
        h.timer = setTimeout(() => hide(h), Math.max(480, 1150 - elapsed * 32) * (h.kind === 'gold' ? .7 : 1));
      }
      spawnTimer = setTimeout(popUp, Math.max(260, 760 - elapsed * 26) * rand(.7, 1.2));
    }
    function bonk(h) {
      if (!playing) { toast('press START BONKING first. bonking without a permit is illegal.'); return; }
      if (!h.kind) { squelch(.6, .15); return; } // whiff: you hit the desk
      const r = h.el.getBoundingClientRect();
      if (h.kind === 'tendie') {
        score = Math.max(0, score - 3);
        h.el.classList.add('oops');
        toast(pick(['🍗 you bonked the tendies. −3. unforgivable.', '🍗 −3. those were for later.', '🍗 −3. slop is very disappointed in you.']), 1400);
        squelch(2.2, .3);
      } else {
        score += h.kind === 'gold' ? 5 : 1;
        if (h.kind === 'gold') toast('✨ @everyone! +5 ✨', 1200);
        h.critter.textContent = '💫';
        h.el.classList.add('bonked');
        squelch(rand(.7, 1), .45);
        if (Math.random() < .4) setTimeout(sigh, 90);
        splat(r.left + r.width / 2, r.top + r.height * .6, h.kind === 'gold' ? 16 : 6, .55);
      }
      clearTimeout(h.timer);
      h.kind = null;
      h.el.setAttribute('aria-label', 'empty slot');
      h.timer = setTimeout(() => h.el.classList.remove('up', 'gold'), 220);
      sync();
    }
    function end() {
      playing = false;
      clearTimeout(spawnTimer); clearInterval(clockTimer);
      holes.forEach(hide);
      yard.classList.remove('playing');
      startBtn.disabled = false;
      startBtn.textContent = '🔨 BONK AGAIN';
      const record = score > best;
      if (record) { best = score; store.set('whackBest', best); }
      emit('game', { game: 'whack', score });
      sync();
      const verdict = score >= 40 ? 'certified ping bonker. frame this.' : score >= 25 ? 'the bots fear you.' : score >= 12 ? 'respectable bonking.' : score > 0 ? 'the bots are laughing at you.' : 'zero. did you fall asleep in the chair?';
      toast(`⏰ time! ${score} bonks. ${record && score ? '🏆 NEW RECORD. ' : ''}${verdict}`, 3200);
    }
    startBtn.addEventListener('click', () => {
      if (playing) return;
      playing = true; score = 0; started = performance.now();
      startBtn.disabled = true;
      startBtn.textContent = '🔨 BONKING…';
      yard.classList.add('playing');
      sync();
      $('#whack-time').textContent = ROUND;
      clockTimer = setInterval(() => {
        const left = Math.max(0, ROUND - Math.floor((performance.now() - started) / 1000));
        $('#whack-time').textContent = left;
        if (left <= 0) end();
      }, 200);
      spawnTimer = setTimeout(popUp, 400);
    });
  }

  // =====================================================================
  // FLAPPY SLOP
  // =====================================================================
  {
    const H = 340, GROUND = 304, R = 15, PW = 64;
    const canvas = $('#flappy-canvas');
    const a = arena(canvas, H, () => draw());
    const { ctx, toScreen } = a;
    let W = a.W, GX = 150;
    let best = store.get('flappyBest', 0);
    let deaths = store.get('flappyDeaths', 0);
    let g;
    const clouds = Array.from({ length: 4 }, (_, i) => ({ x: i * 170 + rand(0, 80), y: rand(30, 140), s: rand(.7, 1.3) }));
    function reset() { g = { state: 'ready', y: 150, vy: 0, pipes: [], score: 0, t: 0, spawn: .9, deadAt: 0, scroll: 0, wing: 0 }; }
    reset();
    a.fit();
    const sync = () => {
      $('#flappy-score').textContent = g.score;
      $('#flappy-best').textContent = best;
      $('#flappy-deaths').textContent = deaths;
    };
    sync();

    const game = loop(step);
    function flap() {
      if (g.state === 'dead') {
        if (performance.now() - g.deadAt < 700) return; // no accidental instant restarts
        reset(); sync();
      }
      if (g.state === 'ready') { g.state = 'play'; canvas.classList.add('playing'); game.start(); }
      g.vy = -390; g.wing = 1;
      squelch(rand(1.6, 2), .12);
    }
    function die() {
      g.state = 'dead'; g.deadAt = performance.now();
      canvas.classList.remove('playing');
      deaths++; store.set('flappyDeaths', deaths);
      const record = g.score > best;
      if (record) { best = g.score; store.set('flappyBest', best); }
      emit('game', { game: 'flappy', score: g.score });
      sync();
      squelch(.45, .7);
      splat(...toScreen(GX, g.y), 26, .9);
      toast(record && g.score ? `🏆 NEW RECORD: ${g.score}! slop is a legend (in her own mind).` : pick(["🌱 slop touched grass. it's over.", '🪦 gamers cannot fly. this has now been proven.', '🪦 slop has rage-quit.', '🪦 the wings were decorative.']), 2400);
    }
    function step(dt) {
      g.t += dt;
      g.wing = Math.max(0, g.wing - dt * 5);
      if (g.state === 'play') {
        const speed = 165 + Math.min(90, g.score * 4);
        g.scroll += speed * dt;
        g.vy = Math.min(g.vy + 1300 * dt, 620);
        g.y += g.vy * dt;
        g.spawn -= dt;
        if (g.spawn <= 0) {
          const gap = Math.max(100, 138 - g.score * 2);
          g.pipes.push({ x: W + 10, top: rand(36, GROUND - gap - 36), gap, passed: false, drip: rand(0, 6) });
          g.spawn = 1.5;
        }
        for (const p of g.pipes) {
          p.x -= speed * dt;
          if (!p.passed && p.x + PW < GX - R) {
            p.passed = true; g.score++; sync();
            squelch(1.3, .25);
            if (g.score % 10 === 0) { sigh(); toast(`🖤 ${g.score} pillars! slop is soaring (falling slowly)`, 1600); }
          }
          const hitX = GX + R > p.x + 4 && GX - R < p.x + PW - 4;
          if (hitX && (g.y - R < p.top || g.y + R > p.top + p.gap)) { die(); break; }
        }
        g.pipes = g.pipes.filter((p) => p.x > -PW - 20);
        if (g.state === 'play' && (g.y + R > GROUND || g.y < -40)) die();
      } else if (g.state === 'dead') {
        g.vy = Math.min(g.vy + 1600 * dt, 700);
        g.y = Math.min(GROUND - R, g.y + g.vy * dt);
      }
      draw();
      if (g.state === 'dead' && g.y >= GROUND - R) return false; // slop has touched grass. stop rendering.
    }

    function pillar(x, y0, y1, capAtBottom, t, seed) {
      ctx.fillStyle = SLIME; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.rect(x, y0, PW, y1 - y0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 9, y0, 8, y1 - y0);
      // lumpy cap
      const cy = capAtBottom ? y1 : y0;
      ctx.fillStyle = SLIME_DARK;
      ctx.beginPath(); ctx.roundRect(x - 7, cy - 11, PW + 14, 22, 9); ctx.fill(); ctx.stroke();
      if (capAtBottom) { // drips hanging from the upper pillar
        for (let i = 0; i < 2; i++) {
          const dx = x + 16 + i * 30, len = 10 + 9 * Math.abs(Math.sin(t * 1.6 + seed + i * 2));
          ctx.fillStyle = SLIME_DARK;
          ctx.beginPath(); ctx.ellipse(dx, cy + 9 + len / 2, 5, len / 2 + 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
    }
    function draw() {
      W = a.W; GX = W < 600 ? 110 : 150;
      const t = g.t;
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#bfe6ff'); sky.addColorStop(1, '#f2fbff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = .9;
      for (const c of clouds) {
        const x = ((c.x - g.scroll * .2) % (W + 160) + W + 160) % (W + 160) - 80;
        ctx.fillStyle = '#fff';
        for (const [ox, oy, r] of [[0, 0, 22], [22, -8, 26], [46, 0, 20]]) {
          ctx.beginPath(); ctx.arc(x + ox * c.s, c.y + oy * c.s, r * c.s, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      for (const p of g.pipes) {
        pillar(p.x, -10, p.top, true, t, p.drip);
        pillar(p.x, p.top + p.gap, GROUND, false, t, p.drip);
      }

      // the grass. slop's natural enemy
      ctx.fillStyle = GRASS; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#4a8f2c';
      for (let x = -(g.scroll % 46); x < W; x += 46) { ctx.beginPath(); ctx.moveTo(x + 10, GROUND + 24); ctx.lineTo(x + 16, GROUND + 6); ctx.lineTo(x + 22, GROUND + 24); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();

      // slop, airborne
      const bob = g.state === 'ready' ? Math.sin(performance.now() / 300) * 6 : 0;
      ctx.save();
      ctx.translate(GX, g.y + bob);
      ctx.rotate(g.state === 'dead' ? Math.PI * .9 : clamp(g.vy / 700, -.45, 1.1));
      // the glued-on wing
      ctx.save();
      ctx.translate(-2, -14);
      ctx.rotate(-.5 - g.wing * .9);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, -10, 8, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (portrait.complete && portrait.naturalWidth) ctx.drawImage(portrait, -19, -19, 38, 38);
      else emoji(ctx, '🖤', 0, 2, 36);
      ctx.restore();

      if (g.state !== 'ready') label(ctx, String(g.score), W / 2, 42, 44);
      if (g.state === 'ready') {
        label(ctx, 'FLAPPY SLOP', W / 2, 110, W < 600 ? 38 : 46, SLIME);
        label(ctx, 'click / tap / space to flap', W / 2, 160, 22);
        if (best) label(ctx, `best: ${best}`, W / 2, 194, 18, '#fff58a');
      } else if (g.state === 'dead') {
        label(ctx, 'TOUCHED GRASS', W / 2, 120, W < 600 ? 34 : 46, RED);
        label(ctx, 'flap to try again (respawn)', W / 2, 168, 22);
      }
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      canvas.focus({ preventScroll: true });
      flap();
    });
    canvas.addEventListener('keydown', (e) => {
      if (!keyIs(e, ' ', 'Space', 'ArrowUp', 'Enter', 'w')) return;
      e.preventDefault();
      if (!e.repeat) flap();
    });
    $('#flappy-start').addEventListener('click', () => { canvas.focus({ preventScroll: true }); flap(); });
  }

  // =====================================================================
  // CATCH THE TENDIES
  // =====================================================================
  {
    const H = 340, BY = 296, BW = 86;
    const canvas = $('#catcher-canvas');
    const a = arena(canvas, H, () => draw());
    const { ctx, toWorld, toScreen } = a;
    let W = a.W;
    const startBtn = $('#catcher-start');
    let best = store.get('catcherBest', 0);
    let c;
    const keys = { left: false, right: false };
    function reset() { W = a.W; c = { state: 'ready', x: W / 2, tx: W / 2, items: [], parts: [], score: 0, lives: 3, t: 0, spawn: .5, shake: 0 }; }
    reset();
    a.fit();
    const sync = () => {
      $('#catcher-score').textContent = c.score;
      $('#catcher-best').textContent = best;
    };
    sync();

    const game = loop(step);
    function start() {
      if (c.state === 'play') return;
      reset(); sync();
      c.state = 'play';
      canvas.classList.add('playing');
      startBtn.disabled = true;
      game.start();
    }
    function over() {
      c.state = 'over';
      canvas.classList.remove('playing');
      startBtn.disabled = false;
      startBtn.textContent = '🍗 AGAIN';
      const record = c.score > best;
      if (record) { best = c.score; store.set('catcherBest', best); }
      emit('game', { game: 'catcher', score: c.score });
      sync();
      squelch(.4, .6);
      toast(record && c.score ? `🏆 NEW RECORD: ${c.score} tendies! slop eats well tonight.` : pick([`🍗 ${c.score} tendies. slop has been fed (barely).`, '🌱 too much grass. slop is outdoorsy now. tragic.', '📞 a phone call got through. slop has left the chat.']), 2800);
    }
    function burst(x, y, color, n = 8) {
      for (let i = 0; i < n; i++) c.parts.push({ x, y, vx: rand(-140, 140), vy: rand(-260, -60), r: rand(2.5, 5), life: rand(.4, .8), color });
    }
    function step(dt) {
      c.t += dt;
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (dir) c.tx = clamp(c.tx + dir * 460 * dt, BW / 2, W - BW / 2);
      c.x += (c.tx - c.x) * Math.min(1, dt * 16);
      c.shake = Math.max(0, c.shake - dt);

      if (c.state === 'play') {
        c.spawn -= dt;
        if (c.spawn <= 0) {
          const bad = Math.random() < Math.min(.38, .16 + c.t * .004);
          c.items.push({
            x: rand(22, W - 22), y: -24, vy: rand(95, 140) + c.t * 3.2, bad,
            ch: bad ? pick(['🌱', '☀️', '🥗', '📞', '🌱']) : pick(['🍗', '🍗', '🍗', '🥤', '🍕']),
            r: rand(9, 13), rot: rand(-1, 1), vr: rand(-3, 3),
          });
          c.spawn = Math.max(.28, .85 - c.t * .011) * rand(.7, 1.3);
        }
      }
      for (let i = c.items.length - 1; i >= 0; i--) {
        const it = c.items[i];
        it.vy += 60 * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
        const inMouth = c.state === 'play' && it.y > BY - 14 && it.y < BY + 10 && Math.abs(it.x - c.x) < BW / 2 - 4;
        if (inMouth) {
          c.items.splice(i, 1);
          if (it.bad) {
            c.lives--; c.shake = .35;
            burst(it.x, BY - 6, '#ffffff', 10);
            squelch(2.4, .35);
            toast({ '🌱': '🌱 grass! −1 life', '☀️': '☀️ sunlight! it burns! −1 life', '🥗': '🥗 vegetables?! −1 life', '📞': '📞 a phone call?! −1 life' }[it.ch] || '🤢 that was NOT a tendie. −1 life', 1200);
            if (c.lives <= 0) over();
          } else {
            c.score++; sync();
            burst(it.x, BY - 8, TENDIE, 6);
            squelch(rand(.9, 1.3), .3);
            if (c.score % 30 === 0) { // bucket full: empty it onto the page
              sigh();
              splat(...toScreen(c.x, BY - 10), 20, .8);
              toast('🍗 tupperware full! emptied it onto the page. sorry.', 1600);
            }
          }
          continue;
        }
        if (it.y > H + 30) {
          c.items.splice(i, 1);
          if (!it.bad && c.state === 'play') burst(it.x, H - 4, TENDIE, 4);
        }
      }
      for (let i = c.parts.length - 1; i >= 0; i--) {
        const p = c.parts[i];
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) c.parts.splice(i, 1);
      }
      draw();
      if (c.state !== 'play' && !c.items.length && !c.parts.length) return false;
    }

    function draw() {
      if (W !== a.W) { c.x = c.tx = clamp((c.x * a.W) / W, BW / 2, a.W - BW / 2); W = a.W; } // resized
      // dingy kitchen tiles
      ctx.fillStyle = '#fffdf3'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(80, 140, 220, .18)'; ctx.lineWidth = 2;
      for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // leaky ceiling
      ctx.fillStyle = SLIME; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, 12 + Math.sin(x * .07 + c.t * 2) * 4 + (x % 90 === 0 ? 8 : 0));
      ctx.lineTo(W, 0); ctx.closePath(); ctx.fill(); ctx.stroke();

      for (const it of c.items) {
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
        emoji(ctx, it.ch, 0, 0, 30);
        ctx.restore();
      }
      for (const p of c.parts) {
        ctx.fillStyle = p.color; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }

      // mom's tupperware (the lid went missing in 2014)
      const bx = c.x + (c.shake ? Math.sin(c.t * 80) * 6 : 0);
      const fill = Math.min(1, (c.score % 30) / 30 + (c.score ? .08 : 0));
      ctx.save(); ctx.translate(bx, BY);
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -4, BW / 2 - 6, Math.PI, 0); ctx.stroke(); // handle
      ctx.beginPath();
      ctx.moveTo(-BW / 2, -6); ctx.lineTo(BW / 2, -6); ctx.lineTo(BW / 2 - 12, 40); ctx.lineTo(-BW / 2 + 12, 40); ctx.closePath();
      ctx.fillStyle = 'rgba(200, 215, 255, .85)'; ctx.fill();
      if (fill > 0) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = TENDIE; ctx.fillRect(-BW / 2, 40 - 46 * fill, BW, 46);
        ctx.restore();
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-BW / 2 + 12, 2, 7, 30);
      ctx.restore();

      label(ctx, `tendies: ${c.score}`, 14, 36, 22, '#fff', 'left');
      label(ctx, '💚'.repeat(Math.max(0, c.lives)) + '🖤'.repeat(3 - Math.max(0, c.lives)), W - 14, 36, 20, '#fff', 'right');
      if (c.state === 'ready') {
        label(ctx, 'CATCH THE TENDIES', W / 2, 130, W < 600 ? 32 : 44, SLIME);
        label(ctx, 'click / tap / enter to start', W / 2, 176, 22);
      } else if (c.state === 'over') {
        label(ctx, "IT'S OVER", W / 2, 130, W < 600 ? 34 : 44, RED);
        label(ctx, `${c.score} tendies caught · click to go again`, W / 2, 176, W < 600 ? 19 : 22);
      }
    }

    canvas.addEventListener('pointermove', (e) => { c.tx = clamp(toWorld(e).x, BW / 2, W - BW / 2); });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      canvas.focus({ preventScroll: true });
      c.tx = clamp(toWorld(e).x, BW / 2, W - BW / 2);
      if (c.state !== 'play') { e.preventDefault(); start(); }
    });
    canvas.addEventListener('keydown', (e) => {
      if (keyIs(e, 'ArrowLeft', 'a')) keys.left = true;
      else if (keyIs(e, 'ArrowRight', 'd')) keys.right = true;
      else if (keyIs(e, 'Enter', ' ', 'Space')) { if (c.state !== 'play') start(); }
      else return;
      e.preventDefault();
    });
    canvas.addEventListener('keyup', (e) => {
      if (keyIs(e, 'ArrowLeft', 'a')) keys.left = false;
      if (keyIs(e, 'ArrowRight', 'd')) keys.right = false;
    });
    canvas.addEventListener('blur', () => { keys.left = keys.right = false; });
    startBtn.addEventListener('click', () => { canvas.focus({ preventScroll: true }); start(); });
  }

  // =====================================================================
  // SLOP MEMORY
  // =====================================================================
  {
    const POOL = ['🖤', '🍗', '🥤', '🎧', '🖥️', '🎮', '🪑', '🧦', '🕸️', '🌚', '💀', '🫠', '📉', '🗿', '🛌', '🍜', '🔔', '🧃'];
    const grid = $('#mem-grid');
    let cards = [], open = [], lock = false, moves = 0, pairs = 0, started = 0;
    let best = store.get('memBest', null);
    const sync = () => {
      $('#mem-moves').textContent = moves;
      $('#mem-pairs').textContent = pairs;
      $('#mem-best').textContent = best == null ? '–' : best;
    };
    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
    function deal() {
      const picks = shuffle(POOL.slice()).slice(0, 8);
      const deck = shuffle(picks.concat(picks));
      grid.textContent = '';
      open = []; lock = false; moves = 0; pairs = 0; started = 0;
      cards = deck.map((ch, i) => {
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'mcard';
        el.setAttribute('aria-label', `card ${i + 1}, face down`);
        const back = document.createElement('span'); back.className = 'back'; back.textContent = '?';
        back.setAttribute('aria-hidden', 'true');
        const face = document.createElement('span'); face.className = 'face'; face.textContent = ch;
        face.setAttribute('aria-hidden', 'true');
        el.append(back, face);
        const card = { el, ch, i, done: false };
        el.addEventListener('click', () => flip(card));
        grid.append(el);
        return card;
      });
      sync();
    }
    function show(card, up) {
      card.el.classList.toggle('up', up);
      card.el.setAttribute('aria-label', up ? `card ${card.i + 1}: ${card.ch}` : `card ${card.i + 1}, face down`);
    }
    function flip(card) {
      if (lock || card.done || open.includes(card)) return;
      if (!started) started = performance.now();
      show(card, true);
      squelch(rand(1.4, 1.8), .15);
      open.push(card);
      if (open.length < 2) return;
      moves++;
      const [a, b] = open;
      open = [];
      if (a.ch === b.ch) {
        a.done = b.done = true;
        a.el.classList.add('matched'); b.el.classList.add('matched');
        pairs++;
        squelch(.9, .4);
        const r = b.el.getBoundingClientRect();
        splat(r.left + r.width / 2, r.top, 8, .5);
        if (pairs === 8) win();
      } else {
        lock = true;
        setTimeout(() => { show(a, false); show(b, false); lock = false; }, 850);
      }
      sync();
    }
    function win() {
      const secs = Math.round((performance.now() - started) / 1000);
      const record = best == null || moves < best;
      if (record) { best = moves; store.set('memBest', best); }
      emit('game', { game: 'memory', score: moves });
      sigh();
      toast(`🧠 all pairs in ${moves} moves (${secs}s)! ${record ? '🏆 NEW RECORD. ' : ''}${moves <= 12 ? 'suspiciously good.' : moves <= 18 ? 'big brain slop.' : 'you got there. eventually.'}`, 3200);
      sync();
    }
    $('#mem-new').addEventListener('click', () => { deal(); toast(pick(['🔀 reshuffled. the cards are still sticky.', '🔀 fresh deck! (it is not fresh)', '🔀 shuffled with a ladle.']), 1400); });
    deal();
  }
})();
