// the slop passport: stamps for doing dumb things on every page. stored in your browser only.
(() => {
  'use strict';
  const { $, rand, store, squelch, on, emit } = window.slop;

  const STAMPS = [
    // [id, emoji, title, hint]
    ['splat1', '💦', 'First Splat', 'click anywhere. go on.'],
    ['splat100', '🌊', 'Splat Veteran', 'splat 100 times. it adds up.'],
    ['janitor', '🧽', 'Professional Janitor', 'mop the slop'],
    ['trough', '🥄', 'Certified Trough Enjoyer', 'feed Gerald'],
    ['boom', '💥', 'Pig Whisperer (Explosive)', 'feed Gerald... too much'],
    ['thought-leader', '🤖', 'Thought Leader', 'generate slop at the slop office'],
    ['eleven', '☢️', 'This One Goes To Eleven', 'max out the slop intensity'],
    ['influencer', '📋', 'LinkedIn Influencer', 'copy your slop to share it'],
    ['certified', '📜', 'Officially Certified', 'download your slop certificate'],
    ['author', '✍️', 'Published Author', 'sign the guestbook'],
    ['fortune', '🥠', 'Fortune Favors The Slop', 'crack a fortune in the pigpen'],
    ['arcade', '🕹️', 'Arcade Rat', 'finish any arcade game'],
    ['bonker', '🔨', 'Licensed Bonker', 'score 15+ in whack-a-gerald'],
    ['aviator', '🪽', 'Pig Aviator', 'fly 10+ pillars in flappy gerald'],
    ['catcher', '🪣', 'Bucket Legend', 'catch 30+ in catch the slop'],
    ['brain', '🧠', 'Big Brain Slop', 'win slop memory'],
    ['konami', '🎮', 'Cheat Code Enjoyer', '↑ ↑ ↓ ↓ ...you know the rest'],
    ['hacker', '💻', 'Hacker Voice: "I\'m In"', 'open the terminal (hint: the key left of 1)'],
    ['not-root', '🔐', 'I Am Root (I Am Not)', 'try sudo in the terminal'],
    ['survivor', '☠️', 'rm -rf Survivor', 'do the one thing you must never do'],
    ['cookie', '🍪', 'Cookie Rebel', 'try to reject the cookies'],
    ['nan', '🔢', 'NaN Enjoyer', 'reset the visitor counter'],
    ['lost', '🗺️', 'Lost In The Slop', 'find a page that does not exist'],
    ['tourist', '🧳', 'Slop Tourist', 'visit every page of freifick'],
  ];
  const PAGES = ['/', '/pigpen/', '/arcade/', '/office/', '/guestbook/', '/about/'];

  let got = store.get('stamps', {});
  const count = () => STAMPS.filter(([id]) => got[id]).length;

  // ---------- popup sticker ----------
  const pop = document.createElement('div');
  pop.className = 'stamp-pop';
  pop.setAttribute('role', 'status');
  document.body.append(pop);
  let popTimer, queue = [];
  function showNext() {
    if (pop.classList.contains('show') || !queue.length) return;
    const [, e, title] = queue.shift();
    pop.innerHTML = '';
    const big = document.createElement('span'); big.className = 'stamp-pop-emoji'; big.textContent = e;
    const txt = document.createElement('span');
    txt.innerHTML = '<small>🛂 NEW PASSPORT STAMP</small>';
    const b = document.createElement('b'); b.textContent = title;
    const n = document.createElement('small'); n.textContent = `${count()}/${STAMPS.length} collected`;
    txt.append(b, n);
    pop.append(big, txt);
    pop.style.rotate = rand(-4, 4).toFixed(1) + 'deg';
    pop.classList.add('show');
    clearTimeout(popTimer);
    popTimer = setTimeout(() => { pop.classList.remove('show'); setTimeout(showNext, 350); }, 2600);
  }

  function earn(id) {
    if (got[id]) return;
    const s = STAMPS.find(([i]) => i === id);
    if (!s) return;
    got = { ...store.get('stamps', {}), [id]: Date.now() }; // re-read: other tabs may have stamped too
    store.set('stamps', got);
    squelch(1.6, .3);
    queue.push(s);
    showNext();
    syncButton();
    if (dialog.open) render();
    emit('stamp', id);
  }

  // ---------- the passport booklet ----------
  const btn = $('#passport-btn');
  const dialog = document.createElement('dialog');
  dialog.className = 'passport';
  dialog.setAttribute('aria-labelledby', 'passport-h');
  dialog.innerHTML = `
    <div class="passport-head">
      <h2 id="passport-h">🛂 SLOP PASSPORT</h2>
      <button type="button" class="passport-close" aria-label="close passport">✖</button>
    </div>
    <p class="small passport-holder"></p>
    <ol class="stamps"></ol>
    <p class="small">stamps live in your browser only. clear your cookies and you become a stateless slop refugee.</p>`;
  document.body.append(dialog);
  dialog.querySelector('.passport-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // click outside

  function render() {
    const no = store.get('visitorNo', null);
    dialog.querySelector('.passport-holder').textContent =
      `holder: slop citizen ${no ? '#' + no : '(unregistered)'} · ${count()}/${STAMPS.length} stamps · ${count() === STAMPS.length ? '👑 FULLY SLOPPED. seek help.' : 'keep slopping.'}`;
    const list = dialog.querySelector('.stamps');
    list.textContent = '';
    for (const [id, e, title, hint] of STAMPS) {
      const li = document.createElement('li');
      const has = got[id];
      li.className = has ? 'stamp got' : 'stamp';
      if (has) li.style.rotate = ((id.length * 37) % 17 - 8) + 'deg';
      const em = document.createElement('span'); em.className = 'stamp-emoji'; em.textContent = has ? e : '❓';
      const t = document.createElement('b'); t.textContent = has ? title : '???';
      const h = document.createElement('small');
      h.textContent = has ? new Date(has).toISOString().slice(0, 10) : hint;
      li.append(em, t, h);
      list.append(li);
    }
  }
  function syncButton() { if (btn) btn.textContent = `🛂 ${count()}/${STAMPS.length}`; }
  if (btn) btn.addEventListener('click', () => { render(); dialog.showModal(); });
  syncButton();

  // ---------- who earns what ----------
  on('splat', () => {
    const n = store.get('splats', 0) + 1;
    store.set('splats', n);
    earn('splat1');
    if (n >= 100) earn('splat100');
  });
  on('mop', () => earn('janitor'));
  on('ladle', () => earn('trough'));
  on('explode', () => earn('boom'));
  on('slop-generated', (lvl) => { earn('thought-leader'); if (lvl >= 11) earn('eleven'); });
  on('slop-copied', () => earn('influencer'));
  on('certificate', () => earn('certified'));
  on('signed', () => earn('author'));
  on('fortune', () => earn('fortune'));
  on('maxslop', (v) => { if (v) earn('konami'); });
  on('terminal', () => earn('hacker'));
  on('sudo', () => earn('not-root'));
  on('rmrf', () => earn('survivor'));
  on('cookie-reject', () => earn('cookie'));
  on('nan', () => earn('nan'));
  on('game', ({ game, score }) => {
    earn('arcade');
    if (game === 'whack' && score >= 15) earn('bonker');
    if (game === 'flappy' && score >= 10) earn('aviator');
    if (game === 'catcher' && score >= 30) earn('catcher');
    if (game === 'memory') earn('brain');
  });

  // pages visited (the 404 page leaves a note, it doesn't load all this machinery)
  const path = location.pathname.replace(/index\.html$/, '');
  const pages = new Set(store.get('pages', []));
  if (PAGES.includes(path)) { pages.add(path); store.set('pages', [...pages]); }
  addEventListener('load', () => {
    if (store.get('found404', false)) earn('lost');
    if (PAGES.every((p) => pages.has(p))) earn('tourist');
  });

  window.slop.passport = { earn, STAMPS, PAGES, count, open() { render(); dialog.showModal(); } };
})();
