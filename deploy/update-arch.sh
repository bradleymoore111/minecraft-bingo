#!/usr/bin/env bash
# Pull latest changes from GitHub and restart minecraft-bingo cleanly.
# Usage: sudo bash /opt/minecraft-bingo/deploy/update-arch.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root: sudo bash /opt/minecraft-bingo/deploy/update-arch.sh"
  exit 1
fi

cd /opt/minecraft-bingo
git pull --ff-only
npm ci --omit=dev
chown -R root:mcbingo /opt/minecraft-bingo
chmod -R u=rwX,g=rX,o= /opt/minecraft-bingo
chown -R mcbingo:mcbingo /opt/minecraft-bingo/data
chmod 700 /opt/minecraft-bingo/data
systemctl restart minecraft-bingo.service
systemctl --no-pager --brief status minecraft-bingo.service || true
