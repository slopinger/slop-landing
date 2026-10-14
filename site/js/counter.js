// the hit counter (real! counted by slopd, one count per visitor per 30 min). needs #counter on the page.
(() => {
  'use strict';
  if (!document.querySelector('#counter')) return;
  const { $, toast, api, store, emit } = window.slop;

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
      store.set('visitorNo', j.visitor);
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
    emit('nan');
    clearTimeout(nanTimer);
    nanTimer = setTimeout(() => { counter.textContent = pad(myNumber); }, 1500);
    toast('counter reset. (just kidding. it is a real counter now. no take-backs.)', 2600);
  });
})();
