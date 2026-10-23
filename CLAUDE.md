# slop-landing development notes

Static HTML/CSS/JS website plus Python stdlib SQLite API. `AGENTS.md` points here. Keep these notes
and README current as part of every behavior, page structure, test or operational change.

- slop's identity (adult boymoder, she/her, long dark hair and oversized b♂y hoodie) is described in README "Identity".
  Keep the joke on slop herself: no misogyny or "-cel" slang about women, no violence, self-harm or
  suicide jokes, nothing aimed at real people or groups. The previous gamer persona is retired.
- Source site is `site/`; Nix assembles `assembly/bloons.wat` for the balloon-defense game.
  The six main page files copy marquee/nav/controls/footer:
  keep shared markup synchronized when editing it. Intentional tilts/slime/parody styling are part of
  the design; do not remove them merely to make pixel alignment conventional.
- `site/slop.js` is shared core; optional modules start only where their elements exist. Preserve
  reduced-motion behavior, opt-in sound, accessibility labels and existing interactive features.
- Home `#mayfly` uses a short announcement (upload limits + anime artwork) to advertise slopbox, the Gleam temporary file host at https://slopbox.freifick.net,
  linking its public MIT source at https://github.com/slopinger/mayfly. Keep limits in sync
  with that service (200 MiB, 1/12/24/72 hours).
- Home `#network` describes dn42 + trough software/instance. Verify dn42 facts against the live BIRD/
  dummy interface and registry objects before changing published network details.
- Backend regression tests: `python3 -m unittest discover -s backend/tests -v`, isolated DB/server.
  For browser QA use a throwaway Caddy on 127.0.0.1 proxying `/api/*` to slopd with
  `header_up Origin https://freifick.net`, Playwright via Nix, and block API POSTs for layout checks.
  Do not change the live guestbook/counters merely to test layout; if a test intentionally writes to
  live counters/pot, undo only its own contributions.
- `tools/watch-health.py` is a GET-only observer with timestamped JSONL output; see README.
- Deploy through `~/src/nixfiles`: push this repo, update its `slop-landing` input, evaluate/build
  and rebuild `slopbox`, then commit/push the lock. `deploy.sh` is an obsolete Arch script; do not use it.
  Caddy serves the Nix site package. slopd is `127.0.0.1:8787`, data `/var/lib/slopd/slopd.sqlite3`.
- Local backups are handled by `~/src/server-backups` and its daily timer; README there has restore steps.
  Public guestbook entries are user content: do not moderate or delete them without an actual reason.
- Check git status, sign commits and push only your changes; preserve concurrent sessions' work.
  The repo lives on GitHub only: push to `origin` (https://github.com/slopinger/slop-landing),
  `git push origin main`. There is no second remote or mirror.
- Use small commits: one logical change per commit (with its tests/docs), each passing the checks above.
  Don't bundle unrelated changes or a whole session's work into one commit.

- Boymoder identity deployed 2026-10-15; site/GitHub/trough share the PNG portrait and she/her bio.
  Canvas slime, games, certificate and error-page accents use the lavender palette.

- Every software change must maintain project-owned Nix flake packaging, a committed lockfile,
  development tools and checks. Export a reusable NixOS module where host/service integration
  applies. Verify package builds and relevant flake checks; document supported commands in README.

## Live host
- Caddy serves the Nix-built `site` package (declared in nixfiles `config/services/freifick-net.nix`;
  missing pages get `404.html` via `handle_errors 404`). `www.freifick.net` and `slop.kyouma.net` redirect (308)
  to `https://freifick.net{uri}`. `/api/*` is proxied to slopd.
- slopd: `slopd.service` (user `slopd`, `127.0.0.1:8787`), source `backend/`, packaged by this flake
  and started from the Nix store by its reusable NixOS module. Logs: `journalctl -u slopd`. POSTs presenting `Origin` must
  match `ALLOWED_ORIGINS` (update it when adding a domain); requests without Origin are accepted.
- The guestbook is public and user-written: moderate with `slopctl list` / `slopctl hide <id>` /
  `slopctl delete <id>`.

## Assembly arcade
- `/arcade/bloons/` is Bloon Assembly, an independent game built toward the user's explicit
  **Bloons TD 6 feature parity** goal. Current build is intermediate: six partial towers, three generic
  linear upgrades each, one map, the first 40 standard rounds, and a 17-type balloon sandbox. Do not claim BTD6 parity or shrink that scope.
- `assembly/README.md` documents the ABI, current rules and remaining feature scope. All game
  rules belong in handwritten WAT; browser JavaScript handles rendering/input/audio only.
- `nix build` assembles/validates the Wasm and runs `tools/test-bloons.mjs` against the real binary,
  including a complete 40-round campaign using earned cash, exact scheduled-spawn checks,
  child families, property/immunity/targeting cases and capacity pressure. `nix flake check` also tests the backend.
- `nix develop -c bash tools/build-bloons.sh` encodes checked-in `assembly/rounds.json` data,
  then assembles ignored Wasm/WAT assets for local preview. Rules and scheduling stay in WAT.
  ABI v2 has a 4096-slot balloon pool with child splits, camo/regrow/fortified properties and
  First/Last/Close/Strong targeting. Do not add browser-side simulation shortcuts.
  Use `python3 -m http.server 8768 --bind 127.0.0.1 --directory site` for game-only browser QA.
  This standalone game page makes no API requests and does not affect guestbook/counter state.
- Hydra project `slop-landing`, flake jobset `main` on hydra.kyouma.net checks site/slopd for
  x86_64-linux and aarch64-linux. Keep `hydraJobs` exported.

## Profiles and persona sync
- Profile texts live in: the GitHub profile (`gh api -X PATCH user -f bio=...`) and its profile README
  repo `~/src/slopinger`, the trough `@slop` profile (Mastodon API `update_credentials` or `/settings`;
  its "Code" field links https://github.com/slopinger) and `site/about/`. Update them together.
- Bios stay plain and understated ("i write code, run servers, and love slopping. she/her") with
  website links; don't explain the persona or list meme vocabulary. The avatar everywhere is
  `assets/slop-avatar.png` (Tsukasa Hiiragi with yellow ribbon and sweatdrop), same as GitHub.
- Last full sync 2026-10-17; browser QA covered all six pages at 1280/390/320px with API writes
  intercepted. `/pigpen/` still redirects to `/room/`.
