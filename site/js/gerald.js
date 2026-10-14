// Gerald the pig: feed him, watch him grow, watch him explode. needs #pig on the page.
(() => {
  'use strict';
  if (!document.querySelector('#pig')) return;
  const { $, rand, pick, reduceMotion, squelch, oink, splat, blob, store, toast, emit } = window.slop;

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
    for (let i = 0; i < 3; i++) blob(r.left + rand(10, r.width - 10), r.top + 6, rand(-60, 60), rand(-220, -80), rand(4, 8));
    emit('ladle');
    if (fat >= MAX_FAT) {
      feedBtn.disabled = true;
      bubble.textContent = 'pig.exe has stopped responding';
      gerald.classList.remove('chomp');
      gerald.classList.add('boom');
      setTimeout(() => {
        const g = gerald.getBoundingClientRect();
        if (!reduceMotion) { splat(g.left + g.width / 2, g.top + g.height / 2, 70, 1.5); squelch(.4, .8); }
        exploded++;
        emit('explode');
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
})();
