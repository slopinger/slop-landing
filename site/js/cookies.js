// a parody cookie banner. freifick uses no cookies at all; this banner is the only cookie.
(() => {
  'use strict';
  const { $, rand, pick, toast, store, emit, reduceMotion } = window.slop;
  if (store.get('cookieChoice', null)) return;

  const FIRST = ['Big Tendie', 'Mom’s Wi-Fi', 'Big Slop', 'The Basement', 'Gaming Chair', 'Sir Cope', 'Lord Seethe', 'Reply Guy', 'Chief Slop', 'Count Crumb'];
  const LAST = ['Analytics', 'Holdings', '& Sons', 'Ad Network', 'Tracking Co.', 'Data Brokers', 'Synergy Labs', 'Marketing GmbH', 'Pixel Farm', 'Inc.'];
  const PARTNERS = 1312;

  const banner = document.createElement('section');
  banner.className = 'cookie-banner';
  banner.setAttribute('aria-label', 'cookie consent (parody)');
  banner.innerHTML = `
    <p><b>🍪 we value your slop-vacy.</b> we and our <b>${PARTNERS.toLocaleString('en-US')}</b> partners would like to put slop on your device
    to personalize your slop, measure slop performance and develop new slop.</p>
    <p class="small">(this is a parody. freifick uses zero cookies and zero trackers. this banner is the only cookie.)</p>
    <div class="cookie-buttons">
      <button type="button" data-c="accept" class="big">accept all slop</button>
      <button type="button" data-c="more">accept even more slop</button>
      <button type="button" data-c="reject" class="cookie-reject">reject all</button>
      <button type="button" data-c="manage" class="linklike">manage partners</button>
    </div>
    <div class="cookie-partners" hidden></div>`;
  document.body.append(banner);
  setTimeout(() => banner.classList.add('show'), 2500);

  const reject = banner.querySelector('.cookie-reject');
  let attempts = 0;
  function close(choice, msg) {
    store.set('cookieChoice', choice);
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 400);
    if (msg) toast(msg, 3000);
  }
  function dodge() { // hop somewhere else inside the banner (never off-screen: it must stay clickable)
    if (reduceMotion || attempts > 4) return;
    const row = reject.parentElement;
    const minX = -reject.offsetLeft, maxX = row.clientWidth - reject.offsetLeft - reject.offsetWidth;
    reject.style.translate = `${Math.round(rand(minX, Math.max(minX, maxX)))}px ${Math.round(rand(-reject.offsetTop, 0))}px`;
    reject.style.rotate = `${Math.round(rand(-20, 20))}deg`;
  }
  reject.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { attempts++; dodge(); } });

  banner.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-c]');
    if (!b) return;
    const c = b.dataset.c;
    if (c === 'accept') close('accept', pick(['🍪 slop accepted. good choice. the only choice.', '🍪 thank you for your slop.']));
    else if (c === 'more') { close('more', '🍪 MORE SLOP it is.'); $('#more')?.click(); }
    else if (c === 'manage') {
      const box = banner.querySelector('.cookie-partners');
      if (!box.childElementCount) {
        const ul = document.createElement('ul');
        for (let i = 0; i < 40; i++) {
          const li = document.createElement('li');
          const lab = document.createElement('label');
          const cb = document.createElement('input');
          cb.type = 'checkbox'; cb.checked = true;
          cb.addEventListener('change', () => { cb.checked = true; toast(pick(['legitimate interest: cope.', 'this partner cannot be disabled. it has feelings.', 'nope. mom insists.']), 1600); });
          lab.append(cb, ` ${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]} — legitimate interest: cope`);
          li.append(lab); ul.append(li);
        }
        const more = document.createElement('p');
        more.className = 'small';
        more.textContent = `…and ${(PARTNERS - 40).toLocaleString('en-US')} more partners, all of them slop’s alt accounts.`;
        box.append(ul, more);
      }
      box.hidden = !box.hidden;
    } else if (c === 'reject') {
      attempts++;
      emit('cookie-reject');
      if (attempts < 4) { toast(pick(['❌ rejection rejected.', '❌ are you sure? (you are not)', '❌ that button is decorative.']), 1600); dodge(); }
      else close('reject', '😔 fine. rejected. we will add more slop anyway, out of spite.');
    }
  });
})();
