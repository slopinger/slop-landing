# slop.kyouma.net

The landing page for https://slop.kyouma.net. Static, no build step, no dependencies.

- `site/index.html`, `site/slop.css`, `site/slop.js`: the page
- `site/404.html`: served by Caddy for missing pages (`handle_errors 404` in `/etc/caddy/Caddyfile`)
- `site/fonts/`: self-hosted Rubik Wet Paint + Comic Neue (SIL Open Font License, from Google Fonts)

Features: metaball slime engine (canvas; drips, splats on click, pool that slurps itself),
the Slop-o-matic 3000 (buzzword generator, intensity 1–11), Gerald the pig (explodes after
12 ladles), a guestbook that stores to `/dev/null` (and localStorage), a fake hit counter,
and a Konami-code MAXIMUM SLOP mode. Respects `prefers-reduced-motion`. Sounds are opt-in.

## Deploy

    ./deploy.sh    # copies site/ to /srv/http/slop.kyouma.net (uses sudo)
