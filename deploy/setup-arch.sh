#!/usr/bin/env bash
# Hardened Arch Linux installer for Minecraft Bingo + Cloudflare Tunnel
# Runs Node.js and cloudflared as two separate unprivileged, systemd-jailed users
# with zero open inbound ports (loopback 127.0.0.1 only).
#
# Usage (from the cloned repo directory):
#   sudo bash deploy/setup-arch.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root: sudo bash deploy/setup-arch.sh"
  exit 1
fi

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/minecraft-bingo"
ETC_DIR="/etc/minecraft-bingo"

echo "==> Installing Arch packages (git, nodejs, npm, cloudflared)..."
pacman -S --needed --noconfirm git nodejs npm cloudflared

echo "==> Creating unprivileged system users (mcbingo & mcbingo-cf)..."
id -u mcbingo >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/bin/nologin mcbingo
id -u mcbingo-cf >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/bin/nologin mcbingo-cf

echo "==> Installing app into ${APP_DIR}..."
mkdir -p "${APP_DIR}" "${APP_DIR}/data"
if [[ "${SRC_DIR}" != "${APP_DIR}" ]]; then
  cp -a "${SRC_DIR}/." "${APP_DIR}/"
  rm -rf "${APP_DIR}/.env" "${APP_DIR}/bin" "${APP_DIR}/node_modules"
fi

cd "${APP_DIR}"
npm ci --omit=dev

# Code is owned by root and read-only to mcbingo; ONLY data/ is writable by mcbingo
chown -R root:mcbingo "${APP_DIR}"
chmod -R u=rwX,g=rX,o= "${APP_DIR}"
chown -R mcbingo:mcbingo "${APP_DIR}/data"
chmod 700 "${APP_DIR}/data"

echo "==> Setting up isolated env files in ${ETC_DIR}..."
mkdir -p "${ETC_DIR}"
chmod 755 "${ETC_DIR}"

if [[ ! -f "${ETC_DIR}/app.env" ]]; then
  if [[ -f "${SRC_DIR}/.env" ]]; then
    grep -v '^CLOUDFLARE_TUNNEL_TOKEN=' "${SRC_DIR}/.env" > "${ETC_DIR}/app.env"
  else
    grep -v '^CLOUDFLARE_TUNNEL_TOKEN=' "${APP_DIR}/.env.example" > "${ETC_DIR}/app.env"
  fi
fi
chown mcbingo:mcbingo "${ETC_DIR}/app.env"
chmod 600 "${ETC_DIR}/app.env"

if [[ ! -f "${ETC_DIR}/tunnel.env" ]]; then
  if [[ -f "${SRC_DIR}/.env" ]] && grep -q '^CLOUDFLARE_TUNNEL_TOKEN=' "${SRC_DIR}/.env"; then
    grep '^CLOUDFLARE_TUNNEL_TOKEN=' "${SRC_DIR}/.env" > "${ETC_DIR}/tunnel.env"
  else
    echo "CLOUDFLARE_TUNNEL_TOKEN=" > "${ETC_DIR}/tunnel.env"
  fi
fi
chown mcbingo-cf:mcbingo-cf "${ETC_DIR}/tunnel.env"
chmod 600 "${ETC_DIR}/tunnel.env"

echo "==> Writing hardened systemd service: minecraft-bingo.service..."
cat > /etc/systemd/system/minecraft-bingo.service <<'EOF'
[Unit]
Description=Minecraft Bingo Web App (loopback-only)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=mcbingo
Group=mcbingo
WorkingDirectory=/opt/minecraft-bingo
EnvironmentFile=/etc/minecraft-bingo/app.env
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node /opt/minecraft-bingo/src/server.js
Restart=on-failure
RestartSec=3

# Hardening / Kernel Sandboxing
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ReadWritePaths=/opt/minecraft-bingo/data
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
LockPersonality=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
RestrictNamespaces=yes
RestrictAddressFamilies=AF_INET AF_INET6
SystemCallArchitectures=native
UMask=0077

[Install]
WantedBy=multi-user.target
EOF

echo "==> Writing hardened systemd service: cloudflared-mcbingo.service..."
cat > /etc/systemd/system/cloudflared-mcbingo.service <<'EOF'
[Unit]
Description=Cloudflare Tunnel for Minecraft Bingo
After=network-online.target minecraft-bingo.service
Wants=network-online.target

[Service]
Type=simple
User=mcbingo-cf
Group=mcbingo-cf
EnvironmentFile=/etc/minecraft-bingo/tunnel.env
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
Restart=on-failure
RestartSec=5

# Hardening / Kernel Sandboxing
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
RestrictNamespaces=yes
RestrictAddressFamilies=AF_INET AF_INET6
SystemCallArchitectures=native
UMask=0077

[Install]
WantedBy=multi-user.target
EOF

echo "==> Reloading systemd..."
systemctl daemon-reload
systemctl enable minecraft-bingo.service cloudflared-mcbingo.service

if grep -q '^CLOUDFLARE_TUNNEL_TOKEN=.\+' "${ETC_DIR}/tunnel.env"; then
  systemctl restart minecraft-bingo.service cloudflared-mcbingo.service
  echo ""
  echo "SUCCESS! Both jailed services are running:"
  systemctl --no-pager status minecraft-bingo.service cloudflared-mcbingo.service || true
else
  systemctl restart minecraft-bingo.service
  echo ""
  echo "minecraft-bingo.service is running on 127.0.0.1:3000."
  echo "Next: add your secrets to:"
  echo "  sudo nano ${ETC_DIR}/app.env"
  echo "  sudo nano ${ETC_DIR}/tunnel.env"
  echo "Then start both services:"
  echo "  sudo systemctl restart minecraft-bingo cloudflared-mcbingo"
fi
