// slop-o-matic 3000: industrial-grade thought leadership. needs #slopomatic on the page.
(() => {
  'use strict';
  if (!document.querySelector('#slopomatic')) return;
  const { $, rand, pick, reduceMotion, squelch, toast, on, emit } = window.slop;

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
  on('maxslop', (v) => { intensity.value = v ? 11 : 5; syncIntensity(); });
  syncIntensity();

  $('#generate').addEventListener('click', () => {
    currentSlop = generateSlop(+intensity.value);
    emit('slop-generated', +intensity.value);
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
      emit('slop-copied');
      toast(pick(['📋 copied! go forth and post.', '📋 copied. your network will be thrilled.', '📋 copied. #grateful']));
    } catch { toast('clipboard said no. select it manually like a peasant.'); }
  });
})();
