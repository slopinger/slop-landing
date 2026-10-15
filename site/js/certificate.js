// the slop certificate: draws an official-looking diploma on a canvas, right in your browser.
// the name you type never leaves your device. needs #certificate on the page.
(() => {
  'use strict';
  if (!document.querySelector('#certificate')) return;
  const { $, pick, store, toast, squelch, emit } = window.slop;

  const canvas = $('#cert-canvas');
  const ctx = canvas.getContext('2d');
  const W = 1200, H = 850;
  canvas.width = W; canvas.height = H;
  const INK = '#16152a', SLIME = '#7bd43a', ACCENT = '#5865f2', GOLD = '#f5c400';
  const RANKS = [
    [0, 'Casual Lurker'], [4, 'Certified Reply Guy'], [9, 'Senior Discord Moderator'],
    [15, 'Principal Basement Dweller'], [21, 'Grand Copelord'], [24, 'Terminally Online (final form)'],
  ];
  const avatar = new Image();
  avatar.src = '/slop-avatar.png';

  function rank() {
    const n = window.slop.passport ? window.slop.passport.count() : 0;
    return RANKS.filter(([at]) => n >= at).pop()[1];
  }
  let serial = Math.floor(Math.random() * 1e6);

  function wrapText(text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = test;
    }
    ctx.fillText(line, x, y);
  }

  async function draw() {
    try { await Promise.all([document.fonts.load('80px "Rubik Wet Paint"'), document.fonts.load('700 40px "Comic Neue"')]); } catch { /* draw with fallbacks */ }
    const name = ($('#cert-name').value.trim() || 'Anonymous').slice(0, 40);
    // paper
    ctx.fillStyle = '#fbf3dc'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(80,140,220,.18)'; ctx.lineWidth = 2;
    for (let y = 40; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // borders (slightly crooked, obviously)
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.006);
    ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.strokeRect(-W / 2 + 30, -H / 2 + 30, W - 60, H - 60);
    ctx.strokeStyle = SLIME; ctx.lineWidth = 8; ctx.strokeRect(-W / 2 + 52, -H / 2 + 52, W - 104, H - 104);
    ctx.setLineDash([18, 10]); ctx.strokeStyle = ACCENT; ctx.lineWidth = 4; ctx.strokeRect(-W / 2 + 68, -H / 2 + 68, W - 136, H - 136);
    ctx.restore(); ctx.setLineDash([]);
    // slime drips from the top border
    ctx.fillStyle = SLIME; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    for (const [x, len] of [[180, 60], [320, 30], [560, 80], [760, 40], [930, 70], [1050, 25]]) {
      ctx.beginPath(); ctx.moveTo(x - 14, 40); ctx.lineTo(x - 10, 40 + len); ctx.arc(x, 40 + len, 10, Math.PI, 0, true); ctx.lineTo(x + 14, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.textAlign = 'center';
    // title
    ctx.fillStyle = INK; ctx.font = '700 34px "Comic Neue", "Comic Sans MS", cursive';
    ctx.fillText('THE REPUBLIC OF FREIFICK HEREBY CERTIFIES THAT', W / 2, 190);
    ctx.font = '76px "Rubik Wet Paint", "Comic Neue", cursive';
    ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.fillStyle = SLIME;
    ctx.strokeText(name, W / 2, 300, W - 220); ctx.fillText(name, W / 2, 300, W - 220);
    ctx.fillStyle = INK; ctx.font = '700 32px "Comic Neue", "Comic Sans MS", cursive';
    ctx.fillText('is an officially recognized', W / 2, 375);
    ctx.font = '700 54px "Comic Neue", "Comic Sans MS", cursive'; ctx.fillStyle = ACCENT;
    ctx.fillText(rank().toUpperCase(), W / 2, 450, W - 220);
    ctx.fillStyle = INK; ctx.font = '26px "Comic Neue", "Comic Sans MS", cursive';
    wrapText(pick([
      'having demonstrated exceptional sloppiness, an unwavering commitment to the hoodie zone, and a frankly concerning number of clicks.',
      'for outstanding contributions to the field of slop, including but not limited to splatting, coping and never once touching grass.',
      'in recognition of their tireless dedication to doing absolutely nothing useful on the internet.',
    ]), W / 2, 510, W - 300, 36);
    // footer: date, citizen no, serial, signature
    const no = store.get('visitorNo', null);
    ctx.textAlign = 'left'; ctx.font = '700 24px "Comic Neue", "Comic Sans MS", cursive';
    ctx.fillText(`date: ${new Date().toISOString().slice(0, 10)}`, 120, 690);
    ctx.fillText(`slop citizen: ${no ? '#' + no : 'unregistered'}`, 120, 725);
    ctx.fillText(`serial: SLOP-${String(serial).padStart(6, '0')}`, 120, 760);
    if (avatar.complete && avatar.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.arc(W - 330, 700, 55, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(avatar, W - 385, 645, 110, 110); ctx.restore(); }
    ctx.textAlign = 'center'; ctx.font = '44px "Rubik Wet Paint", cursive'; ctx.fillStyle = INK;
    ctx.fillText('slop', W - 200, 715);
    ctx.beginPath(); ctx.moveTo(W - 280, 728); ctx.lineTo(W - 120, 728); ctx.lineWidth = 3; ctx.stroke();
    ctx.font = '20px "Comic Neue", cursive'; ctx.fillText('Chief Slop Officer', W - 200, 752);
    // the stamp
    ctx.save(); ctx.translate(W / 2 + 40, 715); ctx.rotate(-0.28);
    ctx.strokeStyle = 'rgba(200, 20, 60, .85)'; ctx.fillStyle = 'rgba(200, 20, 60, .85)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '700 22px "Comic Neue", cursive'; ctx.fillText('APPROVED', 0, -14); ctx.fillText('BY MOM', 0, 14);
    ctx.font = '30px sans-serif'; ctx.fillText('🖤', 0, 50);
    ctx.restore();
    ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(W - 120, 150, 40, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '700 16px "Comic Neue", cursive'; ctx.fillText('100%', W - 120, 146); ctx.fillText('SLOP', W - 120, 166);
  }

  $('#cert-name').addEventListener('input', () => draw());
  $('#cert-new').addEventListener('click', () => { serial = Math.floor(Math.random() * 1e6); squelch(1.4, .3); draw(); });
  $('#cert-download').addEventListener('click', async () => {
    await draw();
    canvas.toBlob((blob) => {
      if (!blob) { toast('the printer is out of slop. try again.'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `slop-certificate-SLOP-${String(serial).padStart(6, '0')}.png`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      emit('certificate');
      toast('📜 certificate printed. frame it. show your mom.');
    }, 'image/png');
  });
  avatar.addEventListener('load', () => draw());
  draw();
})();
