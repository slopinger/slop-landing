// slop's room: bring him tendies, watch him grow, watch him pass out. needs #tendies on the page.
(() => {
  'use strict';
  if (!document.querySelector('#tendies')) return;
  const { $, rand, pick, reduceMotion, squelch, oink, splat, blob, store, toast, emit } = window.slop;

  // =====================================================================
  // TENDIES FOR SLOP
  // =====================================================================
  const MAX_TENDIES = 12;
  const guy = $('#guy');
  const bubble = $('#bubble');
  const feedBtn = $('#feed');
  let full = 0;
  // the old pig counters carry over: a ladle was a tendie all along
  let served = store.get('ladles', 0);
  let comas = store.get('exploded', 0);
  const slopSays = [
    ['thanks mom', 'tendies 🙏', 'is this organic? doesn\'t matter', 'we\'re so back', 'nom', 'ah yes. sustenance.', 'any dipping sauce?', 'ty'],
    ['*chewing with the headset on*', 'one more. just one more.', 'this is my passion', 'i am thriving (indoors)', 'gaming fuel acquired', 'don\'t tell my discord'],
    ['i feel... horizontal', 'tell my discord i was a good mod', 'my hoodie is tight (it was always tight)', 'it\'s over', 'this is fine', 'logging off... forever... (10 min)'],
  ];
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function sync() {
    guy.style.setProperty('--fat', (1 + full * .085).toFixed(3));
    $('#meter').style.width = (full / MAX_TENDIES) * 100 + '%';
    $('#plate').style.setProperty('--slop', 15 + (full % 4) * 20 + '%');
    $('#served').textContent = served;
    $('#comas').textContent = comas;
  }
  sync();

  feedBtn.addEventListener('click', () => {
    full++; served++;
    store.set('ladles', served);
    bubble.textContent = pick(slopSays[full < 5 ? 0 : full < 9 ? 1 : 2]);
    restart(guy, 'chomp');
    squelch(rand(.9, 1.2), .4);
    setTimeout(oink, 180);
    const r = $('.desk').getBoundingClientRect();
    for (let i = 0; i < 3; i++) blob(r.left + rand(10, r.width - 10), r.top + 6, rand(-60, 60), rand(-220, -80), rand(4, 8));
    emit('ladle');
    if (full >= MAX_TENDIES) {
      feedBtn.disabled = true;
      bubble.textContent = 'slop.exe has stopped responding';
      guy.classList.remove('chomp');
      guy.classList.add('coma');
      setTimeout(() => {
        const g = guy.getBoundingClientRect();
        if (!reduceMotion) { splat(g.left + g.width / 2, g.top + g.height / 2, 40, 1.1); squelch(.4, .8); }
        comas++;
        emit('explode');
        store.set('exploded', comas);
        toast('💤 FOOD COMA. slop will wake up at 4pm, as usual.', 2600);
        full = 0;
        sync();
      }, 380);
      setTimeout(() => {
        guy.classList.remove('coma');
        restart(guy, 'respawn');
        bubble.textContent = pick(['i\'m up. what year is it', 'who turned off my monitor', 'did i miss the raid?', 'slop v' + (comas + 1) + '.0 online (still in the chair)']);
        feedBtn.disabled = false;
      }, 1800);
    }
    sync();
  });
})();
