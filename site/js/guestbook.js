// the guestbook (real! stored by slopd). needs #guestbook on the page.
(() => {
  'use strict';
  if (!document.querySelector('#guestbook')) return;
  const { $, pick, reduceMotion, splat, toast, api, emit } = window.slop;

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
    else if (gb.status === 'down') entriesEl.append(statusEl('the guestbook server is eating tendies. try again later. 🤓'));
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
      emit('signed');
      toast(pick(['✅ signed! the whole internet can see it now.', '✅ signed. slop has read it 14 times already.', '✅ your slop has been immortalized.']));
      const r = btn.getBoundingClientRect();
      if (!reduceMotion) splat(r.left + r.width / 2, r.top, 18, .8);
    } catch (err) {
      toast('❌ ' + err.message, 3000);
    } finally {
      btn.disabled = false;
      btn.textContent = '✍️ sign';
    }
  });
})();
