// the oracle: slop's mood of the day (same for everyone, changes at 00:00 UTC) and seeded
// fortunes you can share as links (#f=<seed>). also used by the terminal (slop.oracle).
(() => {
  'use strict';
  const { $, toast, squelch, sigh, emit, reduceMotion } = window.slop;

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
    ["IT'S OVER", '📉', "checked the mirror. checked the timeline. it's over."], ["WE'RE SO BACK", '📈', 'someone replied "lol" to his post. we are so back.'],
    ['COPING', '🫠', 'everything is fine. he said it 4 times, so it is true.'], ['SEETHING (QUIETLY)', '😤', 'lost an argument online. drafted 11 replies. sent 0.'],
    ['BED-ROTTING', '🛌', 'horizontal since friday. productivity is a social construct.'], ['GOBLIN MODE', '👺', 'hoarding energy drink cans under the desk. it is a collection.'],
    ['MOGGED', '🗿', 'a stock photo model mogged him. he will never recover.'], ['LOOKSMAXXING', '🪞', 'mewing for 9 hours straight. jaw: unchanged.'],
    ['DOOMSCROLLING', '📱', 'has reached the end of the internet. it was mostly ads.'], ['MAIN CHARACTER', '🎬', 'is narrating his own life out loud. nobody is listening. perfect.'],
    ['NPC', '🤖', 'says the same 3 lines to everyone who walks by.'], ['TOUCHED GRASS', '🌱', "allegedly. there is no photo. we don't believe him."],
    ['BUFFERING', '⏳', "please wait. slop is loading. (mom's wi-fi)"], ['SIGMA (IN HIS HEAD)', '🐺', 'has a 4am routine. it is the same as his 4pm routine: bed.'],
    ["RATIO'D", '💀', "posted a take. got ratio'd by a bot. a bot."], ['HOPEFUL', '🌸', 'drank water. opened the blinds 2cm. growth.'],
  ];
  const AVOID = ['sunlight', 'phone calls', 'eye contact', 'the mirror', 'mom saying "we need to talk"', 'job portals', 'leaving the house',
    'reply-all', 'Mondays', 'voice chat', 'LinkedIn', 'the gym (it scares him)', 'his screen time report', 'kale (again)', 'standing desks', 'the comments'];
  const LUCKY = ['a 2-litre energy drink', 'the good chair', 'a cold tendie', 'an unread DM (spam)', 'RGB lighting', 'a single sock',
    'dipping sauce', 'a USB stick of unknown origin', 'the hoodie (the only one)', 'a mysterious puddle', 'leftover pizza', 'his steam backlog', 'a traffic cone'];
  const COMPAT = ['his discord server (3 bots and a guy)', 'a raccoon', 'the delivery driver (one sentence a week)', 'a sentient spreadsheet',
    'his mom (she has no choice)', 'his alt account', 'a sad pigeon', 'a crow with a criminal record', 'a slightly damp frog', 'Clippy'];
  const ADVICE = ['touch grass. (or don\'t. it is cold out there.)', 'drink some water. we mean it.', "it's not over until you log off.",
    "log off for 5 minutes. we'll wait.", 'the tendies you seek are already in the fridge.', 'never trust a guy whose desk is clean.',
    'nap aggressively.', 'open the blinds 2cm. baby steps.', 'text someone back. just once.', 'cope, but hydrate.'];

  function moodOf(d = today()) {
    const r = rng(daySeed(d));
    const [mood, emoji, line] = pickR(r, MOODS);
    return { date: d, mood, emoji, line, lucky: Math.floor(r() * 99) + 1, luckyThing: pickR(r, LUCKY),
      avoid: pickR(r, AVOID), compat: pickR(r, COMPAT), advice: pickR(r, ADVICE), slop: Math.floor(r() * 101) };
  }

  const F_START = ['you will soon', 'within 3 business days you will', 'a stranger will help you', 'beware: you may',
    'the stars say you will', 'slop foresees that you will', 'it is written that you shall', 'before the next full moon you will'];
  const F_DO = ["get ratio'd by a bot", 'touch grass by accident', 'be left on read', 'finally finish your backlog (you will not)',
    'be promoted to discord moderator', 'reply-all by accident', 'be mistaken for a thought leader', 'win an argument with a toaster',
    'lose a sock to the void', 'find a tendie you forgot about', 'accidentally say "you too" to a waiter', 'achieve a perfect 10 in flappy slop',
    'eat cereal for dinner and feel powerful', 'become the main character for 4 minutes', 'open the blinds and survive'];
  const F_END = [". it's over.", ". we're so back.", ', and it will be glorious.', '. tell no one.', ', but only on a Tuesday.',
    '. cope accordingly.', '. bring snacks.', '. do not question it.', ', then nap.', '. slop is proud of you.'];
  const LUCK = ['lucky numbers: 4, 8, 15, 16, 23, 42', 'lucky snack: whatever is closest', 'lucky direction: down (to the basement)',
    'lucky color: monitor blue', 'lucky day: yesterday (you slept through it)', 'lucky animal: the discord mod (biased)'];

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
    squelch(2, .3); setTimeout(sigh, 120);
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
