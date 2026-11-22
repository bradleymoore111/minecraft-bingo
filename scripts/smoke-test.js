import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'data', 'smoke-test-state.json');
const PORT = 3456;
const BASE = `http://127.0.0.1:${PORT}`;

// Clean slate for smoke test (isolated from real data/state.json)
if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);

const server = spawn(process.execPath, ['src/server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), ALLOW_DEV_LOGIN: 'true', STATE_FILE },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
server.stdout.on('data', (d) => { logs += d.toString(); });
server.stderr.on('data', (d) => { logs += d.toString(); });

async function waitForServer(timeoutMs = 5000) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/me`);
      if (r.ok) return;
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server did not start in time: ${lastErr?.cause?.message || lastErr?.message}`);
}

async function req(urlPath, { method = 'GET', body = null, cookie = '' } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  const nextCookie = setCookie ? setCookie.split(';')[0] : cookie;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, cookie: nextCookie };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

try {
  await waitForServer();

  // 1. Static HTML served
  const home = await req('/');
  assert(home.status === 200 && home.text.includes('Minecraft Bingo'), 'GET / serves index.html');

  // 2. Player 1 signs in (first dev user becomes Host)
  const p1Login = await req('/auth/dev', { method: 'POST', body: { name: 'Steve' } });
  assert(p1Login.status === 200 && p1Login.json.user.isHost === true, 'Player 1 signed in as Host');
  assert(p1Login.json.user.onboarded === false, 'New user starts not onboarded');
  const c1 = p1Login.cookie;

  // 3. Player 1 chooses Play Solo
  const solo = await req('/api/onboarding/solo', { method: 'POST', body: { color: '#22c55e' }, cookie: c1 });
  assert(solo.status === 200 && solo.json.team.board.length === 25, 'Solo onboarding dealt 25-cell board');

  // 4. Complete Row 1 (indices 0..4) with a real PNG proof upload on cell 0 and verify Bingo detection
  const tinyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+1bQAAAAASUVORK5CYII=';
  const firstCheck = await req('/api/board/toggle', {
    method: 'POST',
    body: { cellIndex: 0, proofDataUrl: tinyPngDataUrl },
    cookie: c1
  });
  assert(firstCheck.status === 200 && firstCheck.json.cell.proofUrl?.startsWith('/api/proofs/'), 'Cell 0 uploaded proof image');
  const proofRes = await fetch(`${BASE}${firstCheck.json.cell.proofUrl}`);
  assert(proofRes.status === 200 && proofRes.headers.get('content-type') === 'image/png', 'Uploaded proof image served cleanly');

  // Replace proof via /api/board/proof
  const replaceProof = await req('/api/board/proof', {
    method: 'POST',
    body: { cellIndex: 0, proofDataUrl: tinyPngDataUrl },
    cookie: c1
  });
  assert(replaceProof.status === 200 && replaceProof.json.cell.proofUrl !== firstCheck.json.cell.proofUrl, 'Proof replaced cleanly');

  for (let i = 1; i < 4; i++) {
    const t = await req('/api/board/toggle', { method: 'POST', body: { cellIndex: i }, cookie: c1 });
    assert(t.status === 200 && t.json.newBingo === false, `Cell ${i} checked without premature bingo`);
  }
  const win = await req('/api/board/toggle', { method: 'POST', body: { cellIndex: 4 }, cookie: c1 });
  assert(win.status === 200 && win.json.newBingo === true && win.json.bingos.length === 1, '5th cell in row triggered Bingo');

  // 4b. Unchecking removes the feed entry instead of adding an 'uncheck' entry
  const countBeforeUncheck = win.json.state.activity.length;
  const uncheck = await req('/api/board/toggle', { method: 'POST', body: { cellIndex: 4 }, cookie: c1 });
  assert(uncheck.status === 200 && uncheck.json.state.activity.length === countBeforeUncheck - 1, 'Unchecking removed feed entry');
  assert(!uncheck.json.state.activity.some((a) => a.kind === 'uncheck'), 'No uncheck activity entry added');

  // 5. Switch from Profile to creating a Team, then Player 2 joins it
  const createTeam = await req('/api/onboarding/team/create', {
    method: 'POST',
    body: { name: 'Nether Rats', color: '#f97316' },
    cookie: c1
  });
  assert(createTeam.status === 200 && !createTeam.json.team.isSolo, 'Switched to newly created team');
  const teamId = createTeam.json.team.id;

  const p2Login = await req('/auth/dev', { method: 'POST', body: { name: 'Alex' } });
  const c2 = p2Login.cookie;
  const join = await req('/api/onboarding/team/join', { method: 'POST', body: { teamId }, cookie: c2 });
  assert(join.status === 200 && join.json.user.teamId === teamId, 'Player 2 joined Nether Rats');

  // 6. Profile rename
  const prof = await req('/api/profile', {
    method: 'PATCH',
    body: { name: 'AlexTheMiner', teamName: 'Nether Squad', teamColor: '#38bdf8' },
    cookie: c2
  });
  assert(prof.status === 200 && prof.json.user.name === 'AlexTheMiner' && prof.json.team.name === 'Nether Squad', 'Profile update succeeded');

  // 7. Host redeals fresh boards (keeps teams, resets boards with Obtain wood center)
  const redeal = await req('/api/host/redeal', { method: 'POST', cookie: c1 });
  assert(redeal.status === 200 && redeal.json.state.teams.length === 2, 'Redeal preserved existing teams');
  assert(redeal.json.state.teams.every((t) => t.board[12].id === 'obtain-wood' && t.checkedCount === 0), 'Redeal placed Obtain wood at center and cleared checkoffs');

  // 8. Host resets all state (clears teams, feed, other users; keeps host ready for onboarding)
  const resetAll = await req('/api/host/reset-all', { method: 'POST', cookie: c1 });
  assert(resetAll.status === 200 && resetAll.json.state.teams.length === 0, 'Reset all cleared teams');
  assert(resetAll.json.state.activity.length === 0, 'Reset all cleared activity feed');
  assert(Object.keys(resetAll.json.state.users).length === 1 && resetAll.json.user.onboarded === false, 'Reset all kept only host');

  console.log('ALL SMOKE TESTS PASSED!');
} catch (err) {
  console.error('Server logs:\n', logs);
  throw err;
} finally {
  server.kill();
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}
