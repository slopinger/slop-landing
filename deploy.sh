#!/usr/bin/env bash
# Deploy site/ to the Caddy web root for slop.kyouma.net.
set -euo pipefail
src="$(dirname "$(readlink -f "$0")")/site/"
dest=/srv/http/slop.kyouma.net
sudo find "$dest" -mindepth 1 -delete
sudo cp -r "$src". "$dest"/
sudo find "$dest" -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} +
echo "deployed to $dest"
