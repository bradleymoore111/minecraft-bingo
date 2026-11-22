import crypto from 'node:crypto';

const SESSION_COOKIE = 'mcbingo_session';
const OAUTH_STATE_COOKIE = 'mcbingo_oauth_state';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function getSecret() {
  return process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';
}

export function signPayload(payloadObj) {
  const json = JSON.stringify(payloadObj);
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifyPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = crypto.createHmac('sha256', getSecret()).update(b64).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSessionCookie(res, userId, req) {
  const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
  const token = signPayload({ uid: userId, exp: Date.now() + SESSION_MAX_AGE_MS });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/'
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function getSessionUserId(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  const parsed = verifyPayload(token);
  return parsed?.uid || null;
}

export function getPublicOrigin(req) {
  if (process.env.PUBLIC_URL) {
    const configured = process.env.PUBLIC_URL.replace(/\/+$/, '');
    // If testing strictly on localhost, prefer localhost callback when host is localhost
    const reqHost = req.get('host') || '';
    if (reqHost.startsWith('localhost:') || reqHost.startsWith('127.0.0.1:')) {
      return `${req.protocol}://${reqHost}`;
    }
    return configured;
  }
  const proto = req.get('x-forwarded-proto') || req.protocol;
  return `${proto}://${req.get('host')}`;
}

export function getAuthProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    discord: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
    dev: String(process.env.ALLOW_DEV_LOGIN).toLowerCase() === 'true'
  };
}

function issueOAuthState(res, req, provider) {
  const state = crypto.randomBytes(16).toString('hex');
  const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
  const signed = signPayload({ state, provider, exp: Date.now() + 1000 * 60 * 10 });
  res.cookie(OAUTH_STATE_COOKIE, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    maxAge: 1000 * 60 * 10,
    path: '/'
  });
  return state;
}

function consumeOAuthState(req, res, expectedProvider) {
  const cookie = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
  const parsed = verifyPayload(cookie);
  if (!parsed || parsed.provider !== expectedProvider) return false;
  return Boolean(req.query.state && req.query.state === parsed.state);
}

export function registerAuthRoutes(app, store) {
  // --- Google OAuth2 ---
  app.get('/auth/google', (req, res) => {
    if (!getAuthProviders().google) {
      return res.redirect('/?error=google_not_configured');
    }
    const state = issueOAuthState(res, req, 'google');
    const redirectUri = `${getPublicOrigin(req)}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account'
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get('/auth/google/callback', async (req, res) => {
    try {
      if (req.query.error) {
        return res.redirect(`/?error=${encodeURIComponent(String(req.query.error))}`);
      }
      if (!consumeOAuthState(req, res, 'google')) {
        return res.redirect('/?error=invalid_oauth_state');
      }
      const code = String(req.query.code || '');
      const redirectUri = `${getPublicOrigin(req)}/auth/google/callback`;

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      if (!tokenRes.ok) {
        console.error('Google token exchange failed:', await tokenRes.text());
        return res.redirect('/?error=google_token_failed');
      }
      const tokenData = await tokenRes.json();

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (!profileRes.ok) {
        console.error('Google userinfo failed:', await profileRes.text());
        return res.redirect('/?error=google_profile_failed');
      }
      const profile = await profileRes.json();

      const user = store.upsertUser({
        id: `google:${profile.sub}`,
        provider: 'google',
        providerId: profile.sub,
        name: profile.name || profile.given_name || 'Player',
        avatar: profile.picture || null,
        email: profile.email || null
      });

      setSessionCookie(res, user.id, req);
      res.redirect('/');
    } catch (err) {
      console.error('Google OAuth error:', err);
      res.redirect('/?error=google_auth_error');
    }
  });

  // --- Discord OAuth2 ---
  app.get('/auth/discord', (req, res) => {
    if (!getAuthProviders().discord) {
      return res.redirect('/?error=discord_not_configured');
    }
    const state = issueOAuthState(res, req, 'discord');
    const redirectUri = `${getPublicOrigin(req)}/auth/discord/callback`;
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify email',
      state
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  app.get('/auth/discord/callback', async (req, res) => {
    try {
      if (req.query.error) {
        return res.redirect(`/?error=${encodeURIComponent(String(req.query.error))}`);
      }
      if (!consumeOAuthState(req, res, 'discord')) {
        return res.redirect('/?error=invalid_oauth_state');
      }
      const code = String(req.query.code || '');
      const redirectUri = `${getPublicOrigin(req)}/auth/discord/callback`;

      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        })
      });
      if (!tokenRes.ok) {
        console.error('Discord token exchange failed:', await tokenRes.text());
        return res.redirect('/?error=discord_token_failed');
      }
      const tokenData = await tokenRes.json();

      const profileRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (!profileRes.ok) {
        console.error('Discord userinfo failed:', await profileRes.text());
        return res.redirect('/?error=discord_profile_failed');
      }
      const profile = await profileRes.json();

      const avatar = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(profile.id) >> 22n) % 6}.png`;

      const user = store.upsertUser({
        id: `discord:${profile.id}`,
        provider: 'discord',
        providerId: profile.id,
        name: profile.global_name || profile.username || 'Player',
        avatar,
        email: profile.email || null
      });

      setSessionCookie(res, user.id, req);
      res.redirect('/');
    } catch (err) {
      console.error('Discord OAuth error:', err);
      res.redirect('/?error=discord_auth_error');
    }
  });

  // --- Dev / Local Quick Sign-In (optional, controlled by ALLOW_DEV_LOGIN=true) ---
  app.post('/auth/dev', (req, res) => {
    if (!getAuthProviders().dev) {
      return res.status(403).json({ error: 'Dev login is disabled' });
    }
    const rawName = String(req.body?.name || '').trim().slice(0, 32);
    if (!rawName) {
      return res.status(400).json({ error: 'Enter a display name' });
    }
    const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player';
    const user = store.upsertUser({
      id: `dev:${slug}`,
      provider: 'dev',
      providerId: slug,
      name: rawName,
      avatar: null,
      email: null
    });
    setSessionCookie(res, user.id, req);
    res.json({ user });
  });

  app.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });
}
