import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generateBalancedBoard, detectBingos } from './latinSquare.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STATE_PATH = process.env.STATE_FILE
  ? path.resolve(ROOT_DIR, process.env.STATE_FILE)
  : path.join(DATA_DIR, 'state.json');
const CHALLENGES_PATH = path.join(ROOT_DIR, 'challenges.json');

export const TEAM_COLORS = [
  '#22c55e', // Emerald
  '#38bdf8', // Diamond
  '#facc15', // Gold
  '#f97316', // Copper
  '#a855f7', // Amethyst
  '#ef4444', // Redstone
  '#ec4899', // Pink Wool
  '#14b8a6', // Prismarine
  '#6366f1', // Lapis
  '#84cc16'  // Slime
];

export class BingoStore {
  constructor() {
    this.challenges = this.loadChallenges();
    this.state = this.loadState();
    this.sseClients = new Set();
  }

  loadChallenges() {
    const raw = fs.readFileSync(CHALLENGES_PATH, 'utf8');
    return JSON.parse(raw);
  }

  reloadChallenges() {
    this.challenges = this.loadChallenges();
    return this.challenges;
  }

  createDefaultState() {
    return {
      version: 1,
      game: {
        mode: 'classic',
        startedAt: new Date().toISOString(),
        sharedBoard: generateBalancedBoard(this.challenges)
      },
      users: {},
      teams: {},
      activity: []
    };
  }

  loadState() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STATE_PATH)) {
      const initial = this.createDefaultState();
      this.persist(initial);
      return initial;
    }
    try {
      const raw = fs.readFileSync(STATE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed.game || !parsed.users || !parsed.teams) {
        throw new Error('Malformed state.json');
      }
      if (!Array.isArray(parsed.game.sharedBoard) || parsed.game.sharedBoard.length !== 25) {
        parsed.game.sharedBoard = generateBalancedBoard(this.challenges);
      }
      if (!Array.isArray(parsed.activity)) {
        parsed.activity = [];
      }
      return parsed;
    } catch (err) {
      console.error('Failed to read state.json, starting fresh:', err.message);
      const initial = this.createDefaultState();
      this.persist(initial);
      return initial;
    }
  }

  persist(stateObj = this.state) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STATE_PATH}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(stateObj, null, 2), 'utf8');
    fs.renameSync(tmpPath, STATE_PATH);
  }

  saveAndBroadcast(eventType = 'state', payload = null) {
    this.persist();
    this.broadcast(eventType, payload);
  }

  addActivity(entry) {
    const item = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      ...entry
    };
    this.state.activity.unshift(item);
    if (this.state.activity.length > 80) {
      this.state.activity.length = 80;
    }
    return item;
  }

  removeCellActivity(cell, teamId, cellIndex) {
    if (cell.activityId) {
      const idx = this.state.activity.findIndex((a) => a.id === cell.activityId);
      if (idx !== -1) {
        this.state.activity.splice(idx, 1);
        return;
      }
    }
    const quoted = `"${cell.title}"`;
    const fallbackIdx = this.state.activity.findIndex(
      (a) =>
        (a.kind === 'check' || a.kind === 'bingo') &&
        a.teamId === teamId &&
        (a.cellIndex === cellIndex || (typeof a.text === 'string' && a.text.includes(quoted)))
    );
    if (fallbackIdx !== -1) {
      this.state.activity.splice(fallbackIdx, 1);
    }
  }

  subscribe(res) {
    this.sseClients.add(res);
    return () => this.sseClients.delete(res);
  }

  broadcast(eventType = 'state', extra = null) {
    const data = JSON.stringify({
      type: eventType,
      event: extra,
      state: this.getPublicState()
    });
    const chunk = `event: update\ndata: ${data}\n\n`;
    for (const res of this.sseClients) {
      try {
        res.write(chunk);
      } catch {
        this.sseClients.delete(res);
      }
    }
  }

  isHostCandidate(user) {
    const hostEmails = (process.env.HOST_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const hostIds = (process.env.HOST_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (user.email && hostEmails.includes(user.email.toLowerCase())) return true;
    if (hostIds.includes(user.id)) return true;

    // If no host exists yet, grant host to first user when no explicit host list is configured,
    // or to the first local dev user when testing locally.
    const anyExistingHost = Object.values(this.state.users).some((u) => u.isHost);
    if (!anyExistingHost && (user.provider === 'dev' || (hostEmails.length === 0 && hostIds.length === 0))) {
      return true;
    }
    return false;
  }

  upsertUser({ id, provider, providerId, name, avatar, email }) {
    const existing = this.state.users[id];
    const now = new Date().toISOString();
    if (existing) {
      existing.avatar = avatar || existing.avatar;
      existing.email = email || existing.email;
      existing.lastSeenAt = now;
      if (this.isHostCandidate(existing)) {
        existing.isHost = true;
      }
      this.saveAndBroadcast('user', { message: `${existing.name} signed in` });
      return existing;
    }

    const user = {
      id,
      provider,
      providerId,
      name: (name || 'Player').trim().slice(0, 32),
      avatar: avatar || null,
      email: email || null,
      isHost: false,
      teamId: null,
      onboarded: false,
      createdAt: now,
      lastSeenAt: now
    };
    user.isHost = this.isHostCandidate(user);
    this.state.users[id] = user;
    this.addActivity({
      kind: 'join',
      text: `${user.name} joined the party`,
      userId: user.id
    });
    this.saveAndBroadcast('user', { message: `${user.name} joined the party` });
    return user;
  }

  pickNextColor() {
    const used = new Set(Object.values(this.state.teams).map((t) => t.color));
    const available = TEAM_COLORS.find((c) => !used.has(c));
    return available || TEAM_COLORS[Object.keys(this.state.teams).length % TEAM_COLORS.length];
  }

  getTeamMembers(teamId) {
    return Object.values(this.state.users).filter((u) => u.teamId === teamId);
  }

  cleanupIfEmptySolo(oldTeamId) {
    if (!oldTeamId) return;
    const team = this.state.teams[oldTeamId];
    if (!team) return;
    const members = this.getTeamMembers(oldTeamId);
    if (members.length === 0 && team.isSolo) {
      // Keep solo team only if it already has progress, otherwise clean up clutter
      const hasChecks = team.board.some((c) => c.checked);
      if (!hasChecks) {
        delete this.state.teams[oldTeamId];
      }
    }
  }

  assignUserSolo(userId, preferredColor = null) {
    const user = this.state.users[userId];
    if (!user) throw new Error('User not found');

    const oldTeamId = user.teamId;

    // Check if user already owns an existing solo team we can reconnect them to
    let soloTeam = Object.values(this.state.teams).find(
      (t) => t.isSolo && t.ownerId === userId
    );

    if (!soloTeam) {
      const teamId = `solo_${crypto.randomBytes(4).toString('hex')}`;
      soloTeam = {
        id: teamId,
        name: user.name,
        color: preferredColor || this.pickNextColor(),
        isSolo: true,
        ownerId: userId,
        board: generateBalancedBoard(this.challenges),
        firstBingoAt: null,
        createdAt: new Date().toISOString()
      };
      this.state.teams[teamId] = soloTeam;
    } else {
      soloTeam.name = user.name;
      if (preferredColor) soloTeam.color = preferredColor;
    }

    user.teamId = soloTeam.id;
    user.onboarded = true;

    if (oldTeamId && oldTeamId !== soloTeam.id) {
      this.cleanupIfEmptySolo(oldTeamId);
    }

    this.addActivity({
      kind: 'team',
      text: `${user.name} is playing Solo`,
      userId: user.id,
      teamId: soloTeam.id
    });
    this.saveAndBroadcast('team', { message: `${user.name} is playing Solo` });
    return { user, team: soloTeam };
  }

  createTeamAndJoin(userId, { name, color }) {
    const user = this.state.users[userId];
    if (!user) throw new Error('User not found');

    const cleanName = String(name || '').trim().slice(0, 32);
    if (!cleanName) throw new Error('Team name is required');

    const duplicate = Object.values(this.state.teams).find(
      (t) => !t.isSolo && t.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) throw new Error('A team with that name already exists');

    const oldTeamId = user.teamId;
    const teamId = `team_${crypto.randomBytes(4).toString('hex')}`;
    const team = {
      id: teamId,
      name: cleanName,
      color: color || this.pickNextColor(),
      isSolo: false,
      ownerId: userId,
      board: generateBalancedBoard(this.challenges),
      firstBingoAt: null,
      createdAt: new Date().toISOString()
    };

    this.state.teams[teamId] = team;
    user.teamId = teamId;
    user.onboarded = true;

    if (oldTeamId && oldTeamId !== teamId) {
      this.cleanupIfEmptySolo(oldTeamId);
    }

    this.addActivity({
      kind: 'team',
      text: `${user.name} created team "${team.name}"`,
      userId: user.id,
      teamId: team.id
    });
    this.saveAndBroadcast('team', { message: `${user.name} created team "${team.name}"` });
    return { user, team };
  }

  joinTeam(userId, teamId) {
    const user = this.state.users[userId];
    if (!user) throw new Error('User not found');

    const team = this.state.teams[teamId];
    if (!team) throw new Error('Team not found');
    if (team.isSolo && team.ownerId !== userId) {
      throw new Error('Cannot join another player\'s solo card');
    }

    const oldTeamId = user.teamId;
    user.teamId = team.id;
    user.onboarded = true;

    if (oldTeamId && oldTeamId !== team.id) {
      this.cleanupIfEmptySolo(oldTeamId);
    }

    this.addActivity({
      kind: 'team',
      text: `${user.name} joined "${team.name}"`,
      userId: user.id,
      teamId: team.id
    });
    this.saveAndBroadcast('team', { message: `${user.name} joined "${team.name}"` });
    return { user, team };
  }

  updateProfile(userId, { name, teamName, teamColor }) {
    const user = this.state.users[userId];
    if (!user) throw new Error('User not found');

    if (typeof name === 'string' && name.trim()) {
      user.name = name.trim().slice(0, 32);
      const currentTeam = user.teamId ? this.state.teams[user.teamId] : null;
      if (currentTeam && currentTeam.isSolo && currentTeam.ownerId === userId) {
        currentTeam.name = user.name;
      }
    }

    const team = user.teamId ? this.state.teams[user.teamId] : null;
    if (team) {
      if (typeof teamName === 'string' && teamName.trim() && !team.isSolo) {
        const clean = teamName.trim().slice(0, 32);
        const dup = Object.values(this.state.teams).find(
          (t) => t.id !== team.id && !t.isSolo && t.name.toLowerCase() === clean.toLowerCase()
        );
        if (dup) throw new Error('Another team already uses that name');
        team.name = clean;
      }
      if (typeof teamColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(teamColor)) {
        team.color = teamColor;
      }
    }

    this.saveAndBroadcast('profile', { message: `${user.name} updated their profile` });
    return { user, team };
  }

  toggleCell(userId, cellIndex, overrideTeamId = null) {
    const user = this.state.users[userId];
    if (!user) throw new Error('User not found');

    const idx = Number(cellIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= 25) {
      throw new Error('Invalid cell index');
    }

    const targetTeamId = overrideTeamId && user.isHost ? overrideTeamId : user.teamId;
    if (!targetTeamId || !this.state.teams[targetTeamId]) {
      throw new Error('Join a team or play solo before checking off squares');
    }
    const team = this.state.teams[targetTeamId];
    const mode = this.state.game.mode;

    if (mode === 'lockout') {
      const board = this.state.game.sharedBoard;
      const cell = board[idx];
      const beforeBingos = detectBingos(board, team.id).length;

      if (cell.checked) {
        if (cell.checkedByTeamId !== team.id && !user.isHost) {
          const owner = this.state.teams[cell.checkedByTeamId];
          throw new Error(`Locked by ${owner ? owner.name : 'another team'}`);
        }
        const prevTeamId = cell.checkedByTeamId || team.id;
        this.removeCellActivity(cell, prevTeamId, idx);
        cell.checked = false;
        cell.checkedByTeamId = null;
        cell.checkedByUserId = null;
        cell.checkedByName = null;
        cell.checkedAt = null;
        cell.activityId = null;
        this.saveAndBroadcast('uncheck', { cellIndex: idx, teamId: prevTeamId });
        return { cell, newBingo: false };
      }

      cell.checked = true;
      cell.checkedByTeamId = team.id;
      cell.checkedByUserId = user.id;
      cell.checkedByName = user.name;
      cell.checkedAt = new Date().toISOString();

      const afterBingos = detectBingos(board, team.id);
      const newBingo = afterBingos.length > beforeBingos;
      if (newBingo && !team.firstBingoAt) {
        team.firstBingoAt = cell.checkedAt;
      }

      const act = this.addActivity({
        kind: newBingo ? 'bingo' : 'check',
        text: newBingo
          ? `BINGO! ${team.name} completed a line with "${cell.title}"!`
          : `${user.name} (${team.name}) locked "${cell.title}"`,
        userId: user.id,
        teamId: team.id,
        cellIndex: idx
      });
      cell.activityId = act.id;
      this.saveAndBroadcast(newBingo ? 'bingo' : 'check', {
        cellIndex: idx,
        teamId: team.id,
        teamName: team.name,
        title: cell.title,
        newBingo
      });
      return { cell, newBingo, bingos: afterBingos };
    }

    // Classic mode: each team has its own balanced board
    const board = team.board;
    const cell = board[idx];
    const beforeBingos = detectBingos(board).length;

    if (cell.checked) {
      this.removeCellActivity(cell, team.id, idx);
      cell.checked = false;
      cell.checkedByTeamId = null;
      cell.checkedByUserId = null;
      cell.checkedByName = null;
      cell.checkedAt = null;
      cell.activityId = null;
      const remaining = detectBingos(board);
      if (remaining.length === 0) team.firstBingoAt = null;

      this.saveAndBroadcast('uncheck', { cellIndex: idx, teamId: team.id });
      return { cell, newBingo: false, bingos: remaining };
    }

    cell.checked = true;
    cell.checkedByTeamId = team.id;
    cell.checkedByUserId = user.id;
    cell.checkedByName = user.name;
    cell.checkedAt = new Date().toISOString();

    const afterBingos = detectBingos(board);
    const newBingo = afterBingos.length > beforeBingos;
    if (newBingo && !team.firstBingoAt) {
      team.firstBingoAt = cell.checkedAt;
    }

    const act = this.addActivity({
      kind: newBingo ? 'bingo' : 'check',
      text: newBingo
        ? `BINGO! ${team.name} completed ${afterBingos.length === 1 ? 'a Bingo' : `${afterBingos.length} Bingos`} with "${cell.title}"!`
        : `${user.name}${team.isSolo ? '' : ` (${team.name})`} completed "${cell.title}"`,
      userId: user.id,
      teamId: team.id,
      cellIndex: idx
    });
    cell.activityId = act.id;
    this.saveAndBroadcast(newBingo ? 'bingo' : 'check', {
      cellIndex: idx,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      checkedByName: user.name,
      bingoCount: afterBingos.length,
      title: cell.title,
      newBingo
    });
    return { cell, newBingo, bingos: afterBingos };
  }

  redealBoards(hostUserId) {
    const host = this.state.users[hostUserId];
    if (!host?.isHost) throw new Error('Host permission required');

    this.reloadChallenges();
    this.state.game.mode = 'classic';
    this.state.game.startedAt = new Date().toISOString();
    this.state.game.sharedBoard = generateBalancedBoard(this.challenges);
    this.state.activity = [];

    for (const team of Object.values(this.state.teams)) {
      team.board = generateBalancedBoard(this.challenges);
      team.firstBingoAt = null;
    }

    this.addActivity({
      kind: 'reset',
      text: `${host.name} dealt fresh Bingo boards`,
      userId: host.id
    });
    this.saveAndBroadcast('reset', { kind: 'redeal' });
    return this.state.game;
  }

  resetAllState(hostUserId) {
    const host = this.state.users[hostUserId];
    if (!host?.isHost) throw new Error('Host permission required');

    this.reloadChallenges();
    const freshHost = {
      ...host,
      teamId: null,
      onboarded: false,
      lastSeenAt: new Date().toISOString()
    };

    this.state = {
      version: 1,
      game: {
        mode: 'classic',
        startedAt: new Date().toISOString(),
        sharedBoard: generateBalancedBoard(this.challenges)
      },
      users: {
        [freshHost.id]: freshHost
      },
      teams: {},
      activity: []
    };

    this.saveAndBroadcast('reset', { kind: 'reset-all' });
    return { user: freshHost, game: this.state.game };
  }

  rerollTeamBoard(hostUserId, teamId) {
    const host = this.state.users[hostUserId];
    if (!host?.isHost) throw new Error('Host permission required');

    this.reloadChallenges();
    const team = this.state.teams[teamId];
    if (!team) throw new Error('Team not found');

    team.board = generateBalancedBoard(this.challenges);
    team.firstBingoAt = null;
    this.addActivity({
      kind: 'reset',
      text: `${host.name} rerolled the Bingo card for "${team.name}"`,
      userId: host.id,
      teamId: team.id
    });
    this.saveAndBroadcast('reset', { teamId: team.id });
    return team;
  }

  deleteTeam(hostUserId, teamId) {
    const host = this.state.users[hostUserId];
    if (!host?.isHost) throw new Error('Host permission required');

    const team = this.state.teams[teamId];
    if (!team) throw new Error('Team not found');

    for (const user of Object.values(this.state.users)) {
      if (user.teamId === teamId) {
        user.teamId = null;
        user.onboarded = false;
      }
    }
    delete this.state.teams[teamId];
    this.addActivity({
      kind: 'team',
      text: `${host.name} removed team "${team.name}"`,
      userId: host.id
    });
    this.saveAndBroadcast('team', { deletedTeamId: teamId });
  }

  getChallengeByIdMap() {
    const map = new Map();
    if (this.challenges.freeSpace?.id) {
      map.set(this.challenges.freeSpace.id, this.challenges.freeSpace);
    }
    for (const tierObj of this.challenges.tiers || []) {
      for (const ch of tierObj.challenges || []) {
        map.set(ch.id, ch);
      }
    }
    return map;
  }

  hydrateBoard(board, challengeMap) {
    if (!Array.isArray(board)) return [];
    return board.map((cell) => {
      const latest = challengeMap.get(cell.id);
      if (!latest) return cell;
      return {
        ...cell,
        icon: latest.icon || cell.icon || null,
        description: latest.description || cell.description || '',
        tags: latest.tags || cell.tags || []
      };
    });
  }

  getPublicState() {
    const mode = this.state.game.mode;
    const challengeMap = this.getChallengeByIdMap();
    const sharedBoard = this.hydrateBoard(this.state.game.sharedBoard, challengeMap);

    const users = {};
    for (const [id, u] of Object.entries(this.state.users)) {
      users[id] = {
        id: u.id,
        provider: u.provider,
        name: u.name,
        avatar: u.avatar,
        isHost: u.isHost,
        teamId: u.teamId,
        onboarded: u.onboarded
      };
    }

    const teams = Object.values(this.state.teams).map((t) => {
      const members = Object.values(users).filter((u) => u.teamId === t.id);
      const hydratedBoard = this.hydrateBoard(t.board, challengeMap);
      const bingos = mode === 'lockout'
        ? detectBingos(sharedBoard, t.id)
        : detectBingos(hydratedBoard);
      const checkedCount = mode === 'lockout'
        ? sharedBoard.filter((c) => c.checked && c.checkedByTeamId === t.id).length
        : hydratedBoard.filter((c) => c.checked).length;

      return {
        id: t.id,
        name: t.name,
        color: t.color,
        isSolo: t.isSolo,
        ownerId: t.ownerId,
        members,
        board: hydratedBoard,
        checkedCount,
        bingos,
        bingoCount: bingos.length,
        firstBingoAt: t.firstBingoAt,
        createdAt: t.createdAt
      };
    });

    // Leaderboard order: Bingos DESC -> First Bingo ASC -> Checked Count DESC -> Name ASC
    teams.sort((a, b) => {
      if (b.bingoCount !== a.bingoCount) return b.bingoCount - a.bingoCount;
      if (a.firstBingoAt && b.firstBingoAt && a.firstBingoAt !== b.firstBingoAt) {
        return a.firstBingoAt.localeCompare(b.firstBingoAt);
      }
      if (b.checkedCount !== a.checkedCount) return b.checkedCount - a.checkedCount;
      return a.name.localeCompare(b.name);
    });

    return {
      game: {
        mode,
        startedAt: this.state.game.startedAt,
        sharedBoard
      },
      teams,
      users,
      activity: this.state.activity.slice(0, 40),
      tiers: (this.challenges.tiers || []).map((t) => ({
        tier: t.tier,
        name: t.name,
        color: t.color,
        estimatedMinutes: t.estimatedMinutes,
        count: t.challenges?.length || 0
      })),
      teamColors: TEAM_COLORS
    };
  }
}
