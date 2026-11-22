import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { BingoStore, ROOT_DIR } from './store.js';
import { getAuthProviders, getSessionUserId, registerAuthRoutes } from './auth.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const app = express();
const store = new BingoStore();

// Trust Cloudflare Tunnel / reverse proxy headers (X-Forwarded-Proto, etc.)
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

// Attach current user from signed session cookie
app.use((req, _res, next) => {
  const userId = getSessionUserId(req);
  req.user = userId ? store.state.users[userId] || null : null;
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  next();
}

function requireHost(req, res, next) {
  if (!req.user?.isHost) {
    return res.status(403).json({ error: 'Host permission required' });
  }
  next();
}

// Auth routes (Google, Discord, Dev)
registerAuthRoutes(app, store);

// --- API Routes ---

app.get('/api/me', (req, res) => {
  res.json({
    user: req.user
      ? {
          id: req.user.id,
          provider: req.user.provider,
          name: req.user.name,
          avatar: req.user.avatar,
          isHost: req.user.isHost,
          teamId: req.user.teamId,
          onboarded: req.user.onboarded
        }
      : null,
    providers: getAuthProviders(),
    publicUrl: process.env.PUBLIC_URL || null
  });
});

app.get('/api/state', (_req, res) => {
  res.json(store.getPublicState());
});

app.get('/api/challenges', (_req, res) => {
  res.json(store.challenges);
});

// Live Server-Sent Events stream
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send immediate initial snapshot
  const initial = JSON.stringify({ type: 'init', state: store.getPublicState() });
  res.write(`event: update\ndata: ${initial}\n\n`);

  const unsubscribe = store.subscribe(res);
  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepAlive);
      unsubscribe();
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

// Onboarding & Team selection
app.post('/api/onboarding/solo', requireAuth, (req, res) => {
  try {
    const result = store.assignUserSolo(req.user.id, req.body?.color || null);
    res.json({ ok: true, ...result, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/onboarding/team/create', requireAuth, (req, res) => {
  try {
    const result = store.createTeamAndJoin(req.user.id, {
      name: req.body?.name,
      color: req.body?.color
    });
    res.json({ ok: true, ...result, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/onboarding/team/join', requireAuth, (req, res) => {
  try {
    const result = store.joinTeam(req.user.id, req.body?.teamId);
    res.json({ ok: true, ...result, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Profile updates (display name, team name/color)
app.patch('/api/profile', requireAuth, (req, res) => {
  try {
    const result = store.updateProfile(req.user.id, {
      name: req.body?.name,
      teamName: req.body?.teamName,
      teamColor: req.body?.teamColor
    });
    res.json({ ok: true, ...result, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Check / Uncheck Bingo tile (Honor system)
app.post('/api/board/toggle', requireAuth, (req, res) => {
  try {
    const result = store.toggleCell(
      req.user.id,
      req.body?.cellIndex,
      req.body?.teamId || null
    );
    res.json({ ok: true, ...result, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Host Controls
app.post('/api/host/redeal', requireAuth, requireHost, (req, res) => {
  try {
    const game = store.redealBoards(req.user.id);
    res.json({ ok: true, game, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/host/reset-all', requireAuth, requireHost, (req, res) => {
  try {
    const result = store.resetAllState(req.user.id);
    res.json({ ok: true, ...result, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/host/reload-challenges', requireAuth, requireHost, (_req, res) => {
  try {
    store.reloadChallenges();
    store.broadcast('challenges', { message: 'Reloaded challenges.json' });
    res.json({ ok: true, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/host/reroll-team', requireAuth, requireHost, (req, res) => {
  try {
    const team = store.rerollTeamBoard(req.user.id, req.body?.teamId);
    res.json({ ok: true, team, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/host/team/:teamId', requireAuth, requireHost, (req, res) => {
  try {
    store.deleteTeam(req.user.id, req.params.teamId);
    res.json({ ok: true, state: store.getPublicState() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Static frontend
app.use(express.static(path.join(ROOT_DIR, 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Minecraft Bingo server listening on http://${HOST}:${PORT}`);
  if (process.env.PUBLIC_URL) {
    console.log(`Public URL configured: ${process.env.PUBLIC_URL}`);
  }
  const providers = getAuthProviders();
  console.log('Auth providers enabled:', providers);
});
