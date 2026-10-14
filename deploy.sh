#!/usr/bin/env bash
# Deploy freifick.net: static site -> Caddy web root, backend -> slopd.service.
set -euo pipefail
repo="$(dirname "$(readlink -f "$0")")"
dest=/srv/http/freifick.net

# --- static site ---
sudo find "$dest" -mindepth 1 -delete
sudo cp -r "$repo/site/." "$dest"/
sudo find "$dest" -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} +
echo "site deployed to $dest"

# --- backend (slopd) ---
changed=0
install_if_changed() { # mode src dst
  if ! sudo cmp -s "$2" "$3" 2>/dev/null; then sudo install -Dm"$1" "$2" "$3"; changed=1; fi
}
install_if_changed 644 "$repo/backend/slopd.sysusers" /etc/sysusers.d/slopd.conf
install_if_changed 644 "$repo/backend/slopd.service" /etc/systemd/system/slopd.service
install_if_changed 644 "$repo/backend/slopd.py" /usr/local/lib/slopd/slopd.py
install_if_changed 755 "$repo/backend/slopctl" /usr/local/bin/slopctl
if [ "$changed" = 1 ] || ! systemctl is-active -q slopd; then
  sudo systemd-sysusers /etc/sysusers.d/slopd.conf
  sudo systemctl daemon-reload
  sudo systemctl enable -q slopd
  sudo systemctl restart slopd
  echo "slopd (re)started"
else
  echo "slopd unchanged"
fi
