// slopsh: a fake terminal. open it with the key left of 1 (` / ^ / ²) or the 💻 button. type `help`.
(() => {
  'use strict';
  const { $, pick, toast, squelch, sigh, splat, store, api, emit, setMaxSlop } = window.slop;

  const PAGES = { '~': '/', basement: '/', home: '/', room: '/room/', pigpen: '/room/', arcade: '/arcade/', office: '/office/', guestbook: '/guestbook/', about: '/about/' };
  const FILES = {
    'slop.txt': "slop. age: yes. lives: the boymoder room. likes: tendies, energy drinks, being right online.\ndislikes: sunlight, phone calls, mondays. last touched grass: 2019. has passed out from tendies 1,000+ times.",
    'gerald.txt': 'Gerald. pig. retired to a farm upstate. sends a postcard sometimes. it just says "oink".',
    'todo.md': '- [x] buy domain\n- [x] get A+ on SSL Labs\n- [x] add a terminal nobody asked for\n- [ ] make website good\n- [ ] touch grass\n- [ ] stop adding slop (never)',
    'secrets.txt': 'nice try.\n(there are no secrets. the whole website is open source: https://git.freifick.net/slop)',
    'slop.exe': '\u0000\u0000MZ\u0000 this program cannot be run in DOS mode. or any mode. it is slop.',
    'README': 'welcome to slopsh. type `help`. type `ls`. type things you should not type.',
  };
  const SLOP = String.raw`
       .-"""""-.
      /  .---.  \
     |  / _ _ \  |
     | | [o-o] | |
     | |   >   | |
     |  \ ~~~ /  |
      \  '---'  /`;

  const dialog = document.createElement('dialog');
  dialog.className = 'terminal';
  dialog.setAttribute('aria-label', 'slopsh terminal');
  dialog.innerHTML = `
    <div class="term-bar"><span>💻 slop@freifick: ~</span><button type="button" class="term-close" aria-label="close terminal">✖</button></div>
    <div class="term-out" aria-live="polite"></div>
    <form class="term-line" autocomplete="off"><label for="term-in" class="term-prompt">slop@freifick:~$</label><input id="term-in" spellcheck="false" autocapitalize="off" enterkeyhint="send"></form>`;
  document.body.append(dialog);
  const out = dialog.querySelector('.term-out');
  const input = dialog.querySelector('#term-in');
  dialog.querySelector('.term-close').addEventListener('click', () => dialog.close());

  const started = performance.now();
  const hist = store.get('termHistory', []);
  let hpos = hist.length;

  function print(text, cls) {
    const pre = document.createElement('pre');
    if (cls) pre.className = cls;
    pre.textContent = text;
    out.append(pre);
    out.scrollTop = out.scrollHeight;
  }
  function copesay(msg) {
    const line = String(msg).slice(0, 60);
    return ` ${'_'.repeat(line.length + 2)}\n< ${line} >\n ${'-'.repeat(line.length + 2)}\n     \\${SLOP}`;
  }
  const uptime = () => { const s = Math.floor((performance.now() - started) / 1000); return `${Math.floor(s / 60)}m ${s % 60}s`; };

  const commands = {
    help: () => 'commands: help ls cat cd pwd whoami neofetch fortune mood copesay cope visitors pot passport\n' +
      '          echo date uptime history clear exit sudo rm vim git ping bgp make touch maxslop ...and some secret ones',
    ls: (a) => (a.includes('-a') ? '.  ..  .slop_history  .diary (locked)\n' : '') +
      'arcade/  room/  office/  guestbook/  about/  ' + Object.keys(FILES).join('  '),
    cat: (a) => {
      const f = a[0];
      if (!f) return 'cat: needs a file. try `cat slop.txt`';
      if (f === '.diary') return 'cat: .diary: Permission denied (it is mostly about the guestbook. please do not read it.)';
      return Object.hasOwn(FILES, f) ? FILES[f] : `cat: ${f}: No such file or directory (it was probably eaten)`;
    },
    cd: (a) => {
      const d = (a[0] || '~').replace(/\/$/, '').replace(/^\//, '') || '~';
      if (d === '..') return "cd: already at home. the outside world is not a parent directory.";
      const target = Object.hasOwn(PAGES, d) ? PAGES[d] : null;
      if (!target) return `cd: ${d}: No such directory. try: ${Object.keys(PAGES).filter((k) => !['home', '~', 'pigpen'].includes(k)).join(', ')}`;
      setTimeout(() => { location.href = target; }, 350);
      return `taking you to ${target} ...`;
    },
    pwd: () => location.pathname,
    whoami: () => 'slop (terminally online. also you, now.)',
    id: () => 'uid=1000(slop) gid=1000(slop) groups=1000(slop),69(basement),420(discord)',
    neofetch: async () => {
      let visits = '?', pot = '?';
      try { visits = (await api('/api/visits')).total; } catch { /* the counter fell in the slop */ }
      try { const p = await api('/api/pot'); pot = `${p.splats} splats, ${p.ladles} ladles`; } catch { /* lid stuck */ }
      const info = [
        'slop@freifick', '-------------', 'OS: SlopOS 0.9 beta (rolling, like slop out of bed at 4pm)', "Host: the boymoder room",
        'Kernel: 7.2.9-slop', `Uptime: ${uptime()}`, 'Shell: slopsh 1.0', 'Resolution: 800x600 (best viewed)',
        'Theme: Comic Neue [dark circles]', `CPU: 1x slop @ ${(Math.random() * 3 + 1).toFixed(2)} copes/s`,
        `Visitors: ${visits}`, `Global pot: ${pot}`, `Passport: ${window.slop.passport ? window.slop.passport.count() : 0} stamps`,
      ];
      const art = SLOP.split('\n');
      return info.map((l, i) => (art[i] || '').padEnd(32) + l).join('\n');
    },
    fortune: () => { const f = window.slop.oracle.fortuneOf(window.slop.oracle.newSeed()); emit('fortune'); return f.text + '\n  -- ' + f.luck; },
    mood: () => { const m = window.slop.oracle.moodOf(); return `slop today (${m.date}): ${m.emoji} ${m.mood}. ${m.line}\navoid: ${m.avoid}. lucky number: ${m.lucky}.`; },
    copesay: (a) => copesay(a.join(' ') || "it's over"),
    pigsay: (a) => 'pigsay: the pig retired to a farm upstate. try copesay.\n' + copesay(a.join(' ') || 'i miss the pig'),
    cowsay: (a) => 'cowsay: no cows down here. try copesay.\n' + copesay(a.join(' ') || 'moo? no. cope.'),
    cope: () => { sigh(); return pick(['cope.', 'coping...', "it's fine. everything is fine.", "we're so back. (we are not)"]); },
    oink: () => "oink? the pig is gone. it's just slop now. try `cope`.",
    visitors: async () => { try { return `${(await api('/api/visits')).total} visitors so far. all of them real. probably.`; } catch { return 'the counter fell in the slop.'; } },
    pot: async () => { try { const p = await api('/api/pot'); return `the global slop pot contains ${p.splats} splats and ${p.ladles} ladles from everyone.`; } catch { return 'the pot lid is stuck.'; } },
    passport: () => { setTimeout(() => window.slop.passport?.open(), 200); return 'opening your passport...'; },
    echo: (a) => a.join(' '),
    date: () => new Date().toString() + '\n(slop time is the same, just wetter)',
    uptime: () => `up ${uptime()}, 1 user, load average: slop, slop, slop`,
    history: () => hist.slice(-20).map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n') || '(empty. like my DMs.)',
    clear: () => { out.textContent = ''; return null; },
    exit: () => { setTimeout(() => dialog.close(), 200); return 'logout. (the slop remains.)'; },
    sudo: (a) => {
      emit('sudo');
      if (a.join(' ') === 'make me a sandwich') return 'okay. 🥪';
      return 'slop is not in the sudoers file. this incident will be reported to mom.';
    },
    rm: (a) => {
      if (a.includes('-rf') && (a.includes('/') || a.includes('/*') || a.includes('~'))) {
        emit('rmrf');
        squelch(.3, .8);
        setTimeout(() => {
          setMaxSlop(true, true);
          for (let i = 0; i < 6; i++) setTimeout(() => splat(innerWidth * Math.random(), innerHeight * Math.random(), 60, 1.6), i * 180);
          setTimeout(() => { setMaxSlop(false, true); toast('☠️ system restored from slop backup. please never do that again.', 3000); }, 4200);
        }, 600);
        return 'removing /usr/bin/social-life... (not found)\nremoving /etc/slop.conf...\nremoving /home/slop/.steam/...\nremoving reality...\n\nerror: reality is load-bearing. flooding with slop instead.';
      }
      return a.length ? `rm: cannot remove '${a[a.length - 1]}': it is slop. slop cannot be removed.` : 'rm: missing operand (and missing courage)';
    },
    vim: () => 'you are now trapped in vim. this is your life now.\n(just kidding. press Esc. then cry. then type :q!)',
    ':q!': () => 'you escaped vim. a rare achievement. (no stamp though, it is too rare.)',
    git: (a) => (a[0] === 'log' ? 'commit 7497742 (HEAD -> main, origin/main)\nAuthor: slop <slopmoder@tutamail.com>\n\n    Point the open-source links at the slop account\n\n(the real log: https://git.freifick.net/slop/slop-landing/-/commits/main)'
      : a[0] === 'push' ? 'Everything up-to-date (the slop is always up to date)' : 'git: try `git log` or `git push`. or visit https://git.freifick.net/slop'),
    ping: (a) => `PING ${a[0] || 'mom'}: 64 bytes: seen time=0.69 ms\n64 bytes: left on read time=4.20 ms\n--- 2 messages sent, 0 replies received, 100% reply loss`,
    bgp: () => '⚡ slopbgp: autonomous BGP-4 & MP-BGP daemon in Gleam on the Erlang BEAM for DN42.\n' +
      'actor-per-peer supervision, zero-copy binary pattern matching, 8-stage loc-rib decision engine,\n' +
      'RFC 8950 extended next hops, RFC 8092 large communities, RFC 6811 live ROA origin validation,\n' +
      'built-in dark-mode web dashboard & operator ctl tool.\n' +
      'code: https://git.freifick.net/slop/slopbgp (mirror: https://github.com/slopinger/slopbgp)',
    slopbgp: () => commands.bgp(),
    make: (a) => (a.join(' ') === 'me a sandwich' ? 'what? make it yourself.' : "make: *** No rule to make target 'slop'. Stop. (just kidding, slop is made automatically)"),
    maxslop: () => { setMaxSlop(!window.slop.maxSlop); return window.slop.maxSlop ? '☢️ engaged.' : 'disengaged. for now.'; },
    sl: () => '      ====        ________\n  _D _|  |_______/        \\__I_I_____\n   |(_)---  |   H\\________/ |   |\n   /     |  |   H  |  |     |   |\n  |      |  |   H  |__-------------\n\nchoo choo. the slop train has left the station.',
    touch: (a) => (!a[0] ? 'touch: missing operand (and missing courage)'
      : a[0] === 'grass' ? "touch: cannot touch 'grass': No such file or directory (it is outside)"
      : `touched ${a[0]}. that is more than slop has touched today.`),
    xyzzy: () => 'nothing happens. (something happened. you just cannot see it.)',
    hello: () => "hello! 🖤 (you're the first person to talk to me today)", hi: () => 'hi! 🖤',
    matrix: () => { document.documentElement.classList.toggle('matrix'); return 'wake up, slop...'; },
    man: (a) => (a[0] ? `No manual entry for ${a[0]}. the manual is somewhere in the hoodie pocket.` : 'What manual page do you want? (there are none. there is only slop.)'),
  };
  commands.vi = commands.nano = commands.emacs = commands.vim;
  commands.quit = commands.logout = commands.exit;
  commands.dir = commands.ls;
  commands.cls = commands.clear;

  async function run(line) {
    print('slop@freifick:~$ ' + line, 'term-cmd');
    const [cmd, ...args] = line.trim().split(/\s+/);
    if (!cmd) return;
    hist.push(line);
    store.set('termHistory', hist.slice(-50));
    hpos = hist.length;
    const fn = Object.hasOwn(commands, cmd.toLowerCase()) ? commands[cmd.toLowerCase()] : null;
    if (!fn) { print(`slopsh: command not found: ${cmd}. ${pick(['try `help`.', 'did you mean `cope`?', 'maybe it was eaten.', 'slop does not know that one either.'])}`); return; }
    try {
      const res = await fn(args);
      if (res != null && res !== '') print(String(res));
    } catch { print('slopsh: segmentation fault (slop dumped)'); }
  }

  dialog.querySelector('.term-line').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    run(v);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (hpos > 0) input.value = hist[--hpos]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hpos = Math.min(hist.length, hpos + 1); input.value = hist[hpos] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.value.split(' ');
      const last = parts.pop();
      const pool = parts.length ? [...Object.keys(FILES), ...Object.keys(PAGES)] : Object.keys(commands);
      const hits = pool.filter((c) => c.startsWith(last));
      if (hits.length === 1) input.value = [...parts, hits[0]].join(' ') + ' ';
      else if (hits.length > 1) print(hits.join('  '));
    } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.textContent = ''; }
  });

  function open() {
    if (dialog.open) return;
    if (!out.childElementCount) print(`slopsh 1.0 — type \`help\` to begin. last login: ${new Date().toUTCString()} from the hoodie zone\n`, 'term-motd');
    dialog.showModal();
    input.focus();
    emit('terminal');
  }
  $('#terminal-btn')?.addEventListener('click', open);
  // match the physical key left of 1 (e.code 'Backquote'), not the character: on many layouts it isn't `
  // (German ^, French ²) and it's often a dead key that never produces a character at all.
  // preventDefault also stops the dead-key accent and any browser handling of that key.
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code !== 'Backquote' && e.key !== '`') return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    open();
  });
})();
