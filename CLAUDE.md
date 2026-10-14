# slop-landing development notes

Static HTML/CSS/JS website plus Python stdlib SQLite API. `AGENTS.md` points here. Keep these notes
and README current as part of every behavior, page structure, test or operational change.

- Source site is `site/`; there is no build step. Six page files copy marquee/nav/controls/footer:
  keep shared markup synchronized when editing it. Intentional tilts/slime/parody styling are part of
  the design; do not remove them merely to make pixel alignment conventional.
- `site/slop.js` is shared core; optional modules start only where their elements exist. Preserve
  reduced-motion behavior, opt-in sound, accessibility labels and existing interactive features.
- Home `#network` describes dn42 + trough software/instance. Verify dn42 facts against the live BIRD/
  dummy interface and registry objects before changing published network details.
- Backend regression tests: `python3 -m unittest discover -s backend/tests -v`, isolated DB/server.
  For browser QA use a loopback preview, proxy GET /api to slopd, and block POSTs for layout checks.
  Do not change the live guestbook/counters merely to test layout.
- `tools/watch-health.py` is a GET-only observer with timestamped JSONL output; see README.
- Deploy with `./deploy.sh`; it copies to `/srv/http/freifick.net` and only restarts slopd if needed.
  Never edit the deployed web root directly. slopd is `127.0.0.1:8787`, data `/var/lib/slopd/slopd.sqlite3`.
- Local backups are handled by `slop/server-backups` and its daily timer; README there has restore steps.
  Public guestbook entries are user content: do not moderate or delete them without an actual reason.
- Check git status, sign commits and push only your changes; preserve concurrent sessions' work.
