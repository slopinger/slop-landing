// the oracle: Gerald's mood of the day (same for everyone, changes at 00:00 UTC) and seeded
// fortunes you can share as links (#f=<seed>). also used by the terminal (slop.oracle).
(() => {
  'use strict';
  const { $, toast, squelch, oink, emit, reduceMotion } = window.slop;

  // tiny seeded PRNG (mulberry32) so a seed always gives the same slop
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pickR = (r, a) => a[Math.floor(r() * a.length)];
  const today = () => new Date().toISOString().slice(0, 10);
  const daySeed = (d = today()) => [...d].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

  const MOODS = [
    ['DAMP', '💧', 'not wet. not dry. just... damp.'], ['UNSTOPPABLE', '🚀', 'has eaten 4 breakfasts and is thinking about a 5th.'],
    ['BUFFERING', '⏳', 'please wait. the pig is loading.'], ['FERAL', '🐗', 'do not make eye contact. do not offer salad.'],
    ['ZEN', '🧘', 'has achieved inner slop. is one with the trough.'], ['DRAMATIC', '🎭', 'is lying face-down in the mud for no reason.'],
    ['CORPORATE', '💼', 'has scheduled a meeting about the meeting.'], ['SPICY', '🌶️', 'ate something orange. regrets nothing.'],
    ['SOGGY', '🥣', 'fell asleep in the slop again.'], ['CHAOTIC NEUTRAL', '🎲', 'might oink. might not. nobody knows.'],
    ['GOBLIN MODE', '👺', 'hoarding shiny things under the trough.'], ['WHOLESOME', '🌸', 'wants you to drink some water. and also slop.'],
    ['SUSPICIOUS', '🤨', 'thinks the farmer is up to something.'], ['MAIN CHARACTER', '🎬', 'is narrating his own life out loud.'],
    ['SLEEPY', '😴', 'zzz. zzz. oink. zzz.'], ['LEGALLY A SANDWICH', '🥪', 'do not ask. he has the paperwork.'],
  ];
  const AVOID = ['meetings', 'salad', 'soap', 'the farmer', 'stairs', 'eye contact', 'reply-all', 'Mondays', 'clean surfaces',
    'self-reflection', 'the number 7', 'people who say "circle back"', 'baths', 'jogging', 'kale (again)', 'standing desks'];
  const LUCKY = ['a spoon', 'a soggy cracker', 'the color brown', 'an unread email', 'a mysterious puddle', 'a single sock',
    'the ladle', 'expired yoghurt', 'a rubber duck', 'mud', 'a USB stick of unknown origin', 'leftover pizza', 'a traffic cone'];
  const COMPAT = ['a raccoon', 'a sentient spreadsheet', 'another pig (obviously)', 'a golden retriever', 'a sad pigeon',
    'the printer at work', 'a crow with a criminal record', 'a slightly damp frog', 'Clippy', 'a very large snail'];
  const ADVICE = ['eat first, think later.', 'if it fits in the trough, it is food.', 'roll in something today. you deserve it.',
    'the slop you seek is already within you.', 'never trust a pig in a suit.', 'nap aggressively.',
    'today is a good day to oink at a stranger.', 'say yes to snacks, no to synergy.', 'the mud is always warmer than it looks.'];

  function moodOf(d = today()) {
    const r = rng(daySeed(d));
    const [mood, emoji, line] = pickR(r, MOODS);
    return { date: d, mood, emoji, line, lucky: Math.floor(r() * 99) + 1, luckyThing: pickR(r, LUCKY),
      avoid: pickR(r, AVOID), compat: pickR(r, COMPAT), advice: pickR(r, ADVICE), slop: Math.floor(r() * 101) };
  }

  const F_START = ['you will soon', 'within 3 business days you will', 'a stranger will help you', 'beware: you may',
    'the stars say you will', 'Gerald foresees that you will', 'it is written that you shall', 'before the next full moon you will'];
  const F_DO = ['find a sandwich you forgot about', 'be promoted to Chief Slop Officer', 'step in something warm',
    'reply-all by accident', 'discover your true calling: napping', 'receive an email that could have been a meeting',
    'be mistaken for a thought leader', 'win an argument with a toaster', 'lose a sock to the void', 'adopt a pig (emotionally)',
    'accidentally say "you too" to a waiter', 'achieve a perfect 10 in flappy gerald', 'eat cereal for dinner and feel powerful',
    'become the main character for 4 minutes', 'find a slightly better parking spot'];
  const F_END = ['. this is fine.', '. oink.', ', and it will be glorious.', '. tell no one.', ', but only on a Tuesday.',
    '. the slop will guide you.', '. bring snacks.', '. do not question it.', ', then nap.', '. Gerald is proud of you.'];
  const LUCK = ['lucky numbers: 4, 8, 15, 16, 23, 42', 'lucky snack: whatever is closest', 'lucky direction: down (into the mud)',
    'lucky color: slop green', 'lucky day: yesterday (you missed it)', 'lucky animal: the pig (biased)'];

  function fortuneOf(seed) {
    const r = rng(seed);
    return { seed, text: pickR(r, F_START) + ' ' + pickR(r, F_DO) + pickR(r, F_END), luck: pickR(r, LUCK) };
  }
  const newSeed = () => Math.floor(Math.random() * 1e9);

  window.slop.oracle = { moodOf, fortuneOf, newSeed };

  // ---------- mood widgets ----------
  const m = moodOf();
  const teaser = $('#mood');
  if (teaser) {
    teaser.querySelector('.mood-emoji').textContent = m.emoji;
    teaser.querySelector('.mood-word').textContent = m.mood;
    teaser.querySelector('.mood-line').textContent = m.line;
  }
  const full = $('#mood-full');
  if (full) {
    const set = (k, v) => { const el = full.querySelector(`[data-mood="${k}"]`); if (el) el.textContent = v; };
    set('date', m.date); set('emoji', m.emoji); set('mood', m.mood); set('line', m.line); set('lucky', m.lucky);
    set('luckyThing', m.luckyThing); set('avoid', m.avoid); set('compat', m.compat); set('advice', m.advice); set('slop', m.slop + '%');
    const bar = full.querySelector('.slop-meter-fill');
    if (bar) bar.style.width = m.slop + '%';
  }

  // ---------- fortune oracle ----------
  const oracle = $('#oracle');
  if (!oracle) return;
  const out = $('#fortune-out');
  const cookie = $('#fortune-cookie');
  let current = null;
  function show(f, fromLink) {
    current = f;
    out.textContent = '';
    const p = document.createElement('p'); p.className = 'fortune-text'; p.textContent = '“' + f.text + '”';
    const s = document.createElement('p'); s.className = 'small'; s.textContent = `${f.luck} · fortune #${f.seed}`;
    out.append(p, s);
    $('#fortune-share').hidden = false;
    if (!fromLink) history.replaceState(null, '', '#f=' + f.seed);
  }
  cookie.addEventListener('click', () => {
    if (!reduceMotion) { cookie.classList.remove('crack'); void cookie.offsetWidth; cookie.classList.add('crack'); }
    squelch(2, .3); setTimeout(oink, 120);
    show(fortuneOf(newSeed()));
    emit('fortune');
  });
  $('#fortune-share').addEventListener('click', async () => {
    if (!current) return;
    const url = `${location.origin}${location.pathname}#f=${current.seed}`;
    try { await navigator.clipboard.writeText(url); toast('🔗 fortune link copied. inflict it on a friend.'); }
    catch { toast('clipboard refused. the link is in your address bar, peasant.'); }
  });
  const hm = location.hash.match(/^#f=(\d{1,10})$/);
  if (hm) show(fortuneOf(+hm[1]), true);
})();
