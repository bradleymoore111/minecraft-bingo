# Minecraft Bingo Party Tracker

Self-hosted Node.js + JSON Minecraft Bingo web app with mathematically fair 5×5 cards, Google & Discord OAuth2, Solo/Team play, live leaderboard, and festive Bingo celebrations.

## Features
- **Doubly-Diagonal Latin Square 5×5 cards:** Every row, column, and both diagonals contain exactly one challenge from each difficulty tier (`T1`–`T5`), with **Obtain wood** shared in the center Free Space.
- **Google + Discord OAuth2:** Clean server-side OAuth2 with signed `HttpOnly` session cookies (plus an optional `ALLOW_DEV_LOGIN=true` toggle for local testing).
- **Solo & Team Play:** New sign-ins choose **Play Solo** or **Join / Create a Team**, and can switch or customize name/color anytime from **Profile**.
- **Live Sync & Spectating:** Real-time updates via Server-Sent Events (SSE), live leaderboard (click any player/team to spectate), live feed, pixel-art Minecraft icons, anchored hovercards, and an **Info** page (`/info`) with full challenge rules.
- **Zero-Database Persistence:** Atomic JSON state persistence (`data/state.json`) — easy to inspect, back up, or reset from Host Controls.

---

## Quick Start (Local / Windows)
1. Copy `.env.example` to `.env` and fill in your OAuth keys + `SESSION_SECRET`.
2. Install dependencies and start:
   ```bash
   npm install
   npm start
   ```
   On Windows with a Cloudflare Tunnel token in `.env`, run `.\scripts\start-party.ps1`.

### OAuth Redirect URIs
- **Discord** (https://discord.com/developers/applications → OAuth2):
  - `https://<your-domain>/auth/discord/callback`
- **Google** (https://console.cloud.google.com/auth/clients → Web application):
  - `https://<your-domain>/auth/google/callback`

---

## Hardened Arch Linux Server Deployment (Cloudflare Tunnel, Zero Open Ports)

[deploy/setup-arch.sh](deploy/setup-arch.sh) installs Node.js + `cloudflared` and runs them as **two separate unprivileged, `systemd`-jailed system users** (`mcbingo` and `mcbingo-cf`):
- Node binds strictly to **`127.0.0.1:3000`** (unreachable from LAN or public IP).
- `ProtectSystem=strict` (read-only OS filesystem; only `/opt/minecraft-bingo/data` is writable by `mcbingo`), `ProtectHome=yes`, `NoNewPrivileges=yes`, all Linux capabilities dropped.
- OAuth/session secrets live in `/etc/minecraft-bingo/app.env` (readable only by `mcbingo`), while `CLOUDFLARE_TUNNEL_TOKEN` lives separately in `/etc/minecraft-bingo/tunnel.env` (readable only by `mcbingo-cf`).

```bash
git clone https://github.com/<your-username>/minecraft-bingo.git /tmp/minecraft-bingo
sudo bash /tmp/minecraft-bingo/deploy/setup-arch.sh
```

After setup, update anytime with:
```bash
sudo bash /opt/minecraft-bingo/deploy/update-arch.sh
```
