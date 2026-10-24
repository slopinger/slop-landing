# freifick.net

The landing page for https://freifick.net. Static HTML/CSS/JS with a handwritten assembly game
compiled to WebAssembly by the Nix build; no browser runtime dependencies.
Source: https://github.com/slopinger/slop-landing. Code under the MIT license (see `LICENSE`);
the fonts in `site/fonts/` are under the SIL Open Font License 1.1.

Pages (plain HTML; the marquee, nav, controls and footer are copied into each page, so keep them in sync):

- `site/index.html`: home ("the hoodie zone"): doors to every page, dn42 + fediverse links, slop's mood, counter, global slop pot
- `site/room/`: slop's room: bring slop tendies, her daily brainworm forecast, the fortune oracle (shareable `#f=<seed>` links)
- `site/pigpen/`: redirect stub: the old pig page forwards to `/room/` (keeping `#f=` fortune links)
- `site/arcade/`: whack-a-ping, flappy slop, catch the tendies, slop memory (one cabinet at a time, `#<game>`)
- `site/arcade/bloons/`: Bloon Assembly, an assembly/Wasm tower-defense development build;
  six partial towers, standard rounds 1–40, a 17-type balloon sandbox and selectable targeting.
  BTD6 feature parity is the target, not yet achieved. See [engine notes and remaining scope](assembly/README.md).
- `site/office/`: the slop-o-matic 3000 and the slop certificate generator (client-side canvas PNG)
- `site/guestbook/`: the real guestbook
- `site/about/`: who slop is, open source, secrets, colophon/privacy

Scripts (every page loads the core ones; page modules return early if their section is missing):

- `site/slop.js`: core: slime engine, toast, sounds, event bus (`slop.on` / `slop.emit`), API helper, MAXIMUM SLOP
- `site/js/passport.js`: 24 achievement stamps (localStorage), popup + passport dialog
- `site/js/oracle.js`: daily mood (seeded by UTC date) and seeded fortunes
- `site/js/pot.js`: batches splats/ladles to `/api/pot`, draws the cauldron on the home page
- `site/js/terminal.js`: slopsh, the fake terminal (` key or 💻 button)
- `site/js/cookies.js`: the parody cookie banner (the site sets no cookies)
- page modules: `js/room.js`, `js/arcade.js`, `js/slopomatic.js`, `js/certificate.js`, `js/guestbook.js`, `js/counter.js`
- `site/slop.css`: all styles
- `site/404.html`: served by Caddy for missing pages (`handle_errors 404` in `/etc/caddy/Caddyfile`)
- `assets/slop-avatar.svg` (+ `.png`): slop's avatar (GitHub, fediverse, this site); export the PNG with `rsvg-convert -w 512 -h 512`
- `site/fonts/`: self-hosted Rubik Wet Paint + Comic Neue (SIL Open Font License, from Google Fonts)

- `backend/slopd.py`: guestbook + visitor counter + global slop pot API (Python stdlib + SQLite), with
  `slopd.service` (sandboxed systemd unit), `slopd.sysusers` and the `slopctl` moderation wrapper

Features: metaball slime engine (canvas; drips, splats on click, pool that slurps itself),
the Slop-o-matic 3000 (buzzword generator, intensity 1–11), slop at his desk (food coma after
12 tendies), 5 arcade games, a real guestbook, visitor counter and global slop pot, a passport
with 24 stamps, a fake terminal, slop's daily brainworm forecast and fortunes, a certificate generator,
a parody cookie banner, and a Konami-code MAXIMUM SLOP mode that persists across pages.
Respects `prefers-reduced-motion`. Sounds are opt-in. Feature ideas were brainstormed with an AI model.

## Identity

slop is an adult trans woman and boymoder (she/her): long dark hair, a shy expression,
and an oversized charcoal `b♂y` hoodie. Her voice is lowercase greentext, anxious overthinking,
brainworm jokes and occasional hopeposting. Boymoding describes her public presentation;
she is a woman. The palette combines imageboard blue with charcoal, lavender and dusty pink.
The portrait is hand-drawn SVG, exported to PNG for the site and public profiles.

Research before this revision: [boymoder meme history](https://knowyourmeme.com/memes/boymoder),
[boymode usage](https://en.wiktionary.org/wiki/boymode), and
[4tran community discussion](https://www.reddit.com/r/4tran4/comments/1ugxd76/our_culture_is_not_their_costume/).
The hoodie/presentation tension and community-specific humor inform the persona. Brainworms
are an unreliable narrator, not factual judgments about trans bodies. No slurs, harassment,
violence or self-harm jokes. Keep the joke on slop herself.

The previous gamer/basement persona and the older slime pig are retired. `/pigpen/` still
redirects to `/room/`. Keep the about page, GitHub profile and trough profile synchronized
when deploying identity changes.

## API (slopd, 127.0.0.1:8787, proxied by Caddy at `/api/*`)

    GET  /api/guestbook[?before=<id>]               newest visible entries, 30 per page
    POST /api/guestbook {"name","message","website"} sign ("website" is a bot honeypot)
    GET  /api/visits                                {"total"}
    POST /api/visits                                count a visit -> {"visitor","total","counted"}
    GET  /api/pot                                   global slop pot {"splats","ladles"}
    POST /api/pot {"splats","ladles"}               add to the pot (≤50 splats, ≤20 ladles per request)

Guestbook rules: name ≤ 40, message ≤ 280 chars; control/bidi chars stripped, zalgo capped,
no links; per IP 1 post / 30 s, 5 / h, 15 / day; 300 posts / h globally. Visits are deduplicated
per IP for 30 min. IPs are only held in memory (salted hash), never stored.
Data: `/var/lib/slopd/slopd.sqlite3`.

## Moderation

    slopctl list [-n 50]      # recent entries incl. hidden, with ids
    slopctl hide 12 13        # hide from the page (reversible: slopctl unhide 12)
    slopctl delete 12         # gone for good
    slopctl set-visits 1000   # adjust the counter

## Backend tests

    python3 -m unittest discover -s backend/tests -v

These HTTP integration tests start a loopback server with a temporary SQLite database. They cover
posting, pagination, moderation visibility, visit deduplication, pot caps, JSON validation and origins
without changing the live guestbook or counters.

## HTTP health observations

    python3 tools/watch-health.py --duration 3600 --interval 60 --output /tmp/slop-health.jsonl

This checks the public website, API read endpoints, fediverse NodeInfo and the GitHub profile page.
It sends only GET requests and writes timestamped JSONL observations, exiting with a failure status
if any check failed. Pass explicit URLs after the options to observe other endpoints.

## Deploy

Push signed commits to GitHub, then deploy through the host configuration:

```sh
cd ~/src/nixfiles
nix flake update slop-landing
nix flake check --no-build
sudo nixos-rebuild switch --flake .#slopbox
git add flake.lock
git commit -m "Deploy slop-landing"
git push origin main
```

Wait for the relevant Hydra checks, inspect the lock diff before rebuilding, and verify the live
page and Wasm after the switch. Caddy serves the immutable Nix package. Never copy files directly
into the old web root. `deploy.sh` is retained only as an obsolete Arch artifact.

## slopbox announcement

The home page `#mayfly` card links https://slopbox.freifick.net and its
[public Gleam source](https://github.com/slopinger/mayfly). slopbox (formerly mayfly) is a separate
service: anonymous temporary uploads up to 200 MiB with 1/12/24/72-hour lifetimes.
The compact announcement mentions the anime artwork and uses existing card/sticker styles and introduces no new site API.

Identity verification: browser review at 1280, 390 and 320 CSS pixels covers all six pages,
room feeding, image loading, console errors and horizontal overflow. Public profile bios
and PNG avatars are kept in sync on the GitHub profile and through trough
`update_credentials`; revoke temporary OAuth credentials after use.

## Nix

`nix build` encodes checked-in round data, assembles and validates the balloon engine from
`assembly/bloons.wat`, tests its rules
and full 40-round campaign (the standard opening rounds), validates named early upgrade paths,
projectile travel/pierce and specialized attacks with `tools/test-bloons-projectiles.mjs`, and builds the static site. `nix build .#slopd` builds the backend
with Python and runs isolated HTTP regression tests. `nix flake check` builds both.
`nix develop` provides Python, Node and WABT. Linux x86_64 and aarch64 are supported.
`hydraJobs` exposes site and backend checks for both architectures; CI is
https://hydra.kyouma.net/jobset/slop-landing/main.

For a source-tree preview, first run `nix develop -c bash tools/build-bloons.sh`, then
`python3 -m http.server 8768 --bind 127.0.0.1 --directory site`. The generated Wasm and its
public WAT source are ignored locally and reproduced by Nix.

Import `inputs.slop-landing.nixosModules.default` and enable
`freifick.slopd.enable` for the hardened loopback API service and `slopctl`.
Options include `package`, `host`, `port` and `user`; state is in
`/var/lib/slopd`. Point a web server at the `site` package and proxy `/api/*`
to the backend separately. NixOS deployment is described above.
