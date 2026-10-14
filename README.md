# slop.kyouma.net

The landing page for https://slop.kyouma.net. Static, no build step, no dependencies.

- `site/index.html`, `site/slop.css`, `site/slop.js`: the page
- `site/404.html`: served by Caddy for missing pages (`handle_errors 404` in `/etc/caddy/Caddyfile`)
- `site/fonts/`: self-hosted Rubik Wet Paint + Comic Neue (SIL Open Font License, from Google Fonts)

- `backend/slopd.py`: guestbook + visitor counter API (Python stdlib + SQLite), with
  `slopd.service` (sandboxed systemd unit), `slopd.sysusers` and the `slopctl` moderation wrapper

Features: metaball slime engine (canvas; drips, splats on click, pool that slurps itself),
the Slop-o-matic 3000 (buzzword generator, intensity 1–11), Gerald the pig (explodes after
12 ladles), a real guestbook and visitor counter, and a Konami-code MAXIMUM SLOP mode.
Respects `prefers-reduced-motion`. Sounds are opt-in.

## API (slopd, 127.0.0.1:8787, proxied by Caddy at `/api/*`)

    GET  /api/guestbook[?before=<id>]               newest visible entries, 30 per page
    POST /api/guestbook {"name","message","website"} sign ("website" is a bot honeypot)
    GET  /api/visits                                {"total"}
    POST /api/visits                                count a visit -> {"visitor","total","counted"}

Guestbook rules: name ≤ 40, message ≤ 280 chars; control/bidi chars stripped, zalgo capped,
no links; per IP 1 post / 30 s, 5 / h, 15 / day; 300 posts / h globally. Visits are deduplicated
per IP for 30 min. IPs are only held in memory (salted hash), never stored.
Data: `/var/lib/slopd/slopd.sqlite3`.

## Moderation

    slopctl list [-n 50]      # recent entries incl. hidden, with ids
    slopctl hide 12 13        # hide from the page (reversible: slopctl unhide 12)
    slopctl delete 12         # gone for good
    slopctl set-visits 1000   # adjust the counter

## Deploy

    ./deploy.sh    # site/ -> /srv/http/slop.kyouma.net; installs + restarts slopd if backend changed (uses sudo)
