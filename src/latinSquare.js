import crypto from 'node:crypto';

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Generates a 5x5 Doubly-Diagonal Latin Square (Knut Vik design) of tier numbers 1..5.
 * Mathematical property:
 *   Every row, every column, the main diagonal, and the anti-diagonal contain
 *   {1, 2, 3, 4, 5} each exactly once.
 */
export function generateTierMatrix({ pinCenterTier1 = false } = {}) {
  const step = crypto.randomInt(0, 2) === 0 ? 2 : 3;
  const flipRow = crypto.randomInt(0, 2) === 1;
  const flipCol = crypto.randomInt(0, 2) === 1;
  const transpose = crypto.randomInt(0, 2) === 1;
  const rowShift = crypto.randomInt(0, 5);
  const colShift = crypto.randomInt(0, 5);

  const rawIdx = (r, c) => {
    const rr = flipRow ? 4 - r : r;
    const cc = flipCol ? 4 - c : c;
    const a = transpose ? cc : rr;
    const b = transpose ? rr : cc;
    return ((a + rowShift) + step * (b + colShift)) % 5;
  };

  let tierPerm;
  if (pinCenterTier1) {
    const centerIdx = rawIdx(2, 2);
    const others = shuffle([2, 3, 4, 5]);
    tierPerm = Array(5).fill(0);
    let oi = 0;
    for (let i = 0; i < 5; i++) {
      tierPerm[i] = i === centerIdx ? 1 : others[oi++];
    }
  } else {
    tierPerm = shuffle([1, 2, 3, 4, 5]);
  }

  const matrix = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      matrix[r][c] = tierPerm[rawIdx(r, c)];
    }
  }

  return matrix;
}

/**
 * Verifies that a 25-cell board (row-major 5x5) is a valid doubly-diagonal Latin square.
 */
export function verifyLatinSquare(cells) {
  if (!Array.isArray(cells) || cells.length !== 25) {
    return { valid: false, reason: 'Board must have 25 cells' };
  }
  const hasAllFive = (arr) => {
    const set = new Set(arr);
    return set.size === 5 && [1, 2, 3, 4, 5].every((t) => set.has(t));
  };

  for (let r = 0; r < 5; r++) {
    const row = [0, 1, 2, 3, 4].map((c) => cells[r * 5 + c].tier);
    if (!hasAllFive(row)) return { valid: false, reason: `Row ${r} failed` };
  }
  for (let c = 0; c < 5; c++) {
    const col = [0, 1, 2, 3, 4].map((r) => cells[r * 5 + c].tier);
    if (!hasAllFive(col)) return { valid: false, reason: `Col ${c} failed` };
  }
  const diag1 = [0, 1, 2, 3, 4].map((i) => cells[i * 5 + i].tier);
  if (!hasAllFive(diag1)) return { valid: false, reason: 'Main diagonal failed' };

  const diag2 = [0, 1, 2, 3, 4].map((i) => cells[i * 5 + (4 - i)].tier);
  if (!hasAllFive(diag2)) return { valid: false, reason: 'Anti-diagonal failed' };

  return { valid: true };
}

/**
 * Generates a balanced 5x5 Bingo board (25 cells) from challenges.json data.
 */
export function generateBalancedBoard(challengesData) {
  const freeSpace = challengesData.freeSpace || null;
  const tierMap = new Map();
  for (const tierObj of challengesData.tiers || []) {
    const minRequired = (freeSpace && tierObj.tier === 1) ? 4 : 5;
    if (!tierObj.challenges || tierObj.challenges.length < minRequired) {
      throw new Error(`Tier ${tierObj.tier} (${tierObj.name}) needs at least ${minRequired} challenges, found ${tierObj.challenges?.length ?? 0}`);
    }
    tierMap.set(tierObj.tier, {
      meta: tierObj,
      pool: shuffle(tierObj.challenges)
    });
  }

  for (let t = 1; t <= 5; t++) {
    if (!tierMap.has(t)) {
      throw new Error(`Missing tier ${t} in challenges.json`);
    }
  }

  const matrix = generateTierMatrix({ pinCenterTier1: Boolean(freeSpace) });
  const tierCursor = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const cells = [];

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const tierNum = matrix[r][c];
      const entry = tierMap.get(tierNum);
      const isCenterFree = Boolean(freeSpace && r === 2 && c === 2);
      const challenge = isCenterFree ? freeSpace : entry.pool[tierCursor[tierNum]++];
      cells.push({
        index: r * 5 + c,
        row: r,
        col: c,
        id: challenge.id,
        title: challenge.title,
        icon: challenge.icon || null,
        description: challenge.description || '',
        tags: challenge.tags || [],
        tier: tierNum,
        tierName: isCenterFree ? 'Free Space' : entry.meta.name,
        tierColor: entry.meta.color,
        isFreeSpace: isCenterFree,
        checked: false,
        checkedByTeamId: null,
        checkedByUserId: null,
        checkedByName: null,
        checkedAt: null
      });
    }
  }

  const check = verifyLatinSquare(cells);
  if (!check.valid) {
    throw new Error(`Generated board failed Latin square verification: ${check.reason}`);
  }

  return cells;
}

export const BINGO_LINES = [
  // Rows
  { id: 'row-0', label: 'Row 1', indices: [0, 1, 2, 3, 4] },
  { id: 'row-1', label: 'Row 2', indices: [5, 6, 7, 8, 9] },
  { id: 'row-2', label: 'Row 3', indices: [10, 11, 12, 13, 14] },
  { id: 'row-3', label: 'Row 4', indices: [15, 16, 17, 18, 19] },
  { id: 'row-4', label: 'Row 5', indices: [20, 21, 22, 23, 24] },
  // Columns
  { id: 'col-0', label: 'Col 1', indices: [0, 5, 10, 15, 20] },
  { id: 'col-1', label: 'Col 2', indices: [1, 6, 11, 16, 21] },
  { id: 'col-2', label: 'Col 3', indices: [2, 7, 12, 17, 22] },
  { id: 'col-3', label: 'Col 4', indices: [3, 8, 13, 18, 23] },
  { id: 'col-4', label: 'Col 5', indices: [4, 9, 14, 19, 24] },
  // Diagonals
  { id: 'diag-main', label: 'Diagonal ↘', indices: [0, 6, 12, 18, 24] },
  { id: 'diag-anti', label: 'Diagonal ↙', indices: [4, 8, 12, 16, 20] }
];

/**
 * Returns all completed Bingo lines for a board.
 * If teamId is passed (Lockout mode), only counts cells claimed by that teamId.
 */
export function detectBingos(cells, teamId = null) {
  if (!Array.isArray(cells) || cells.length !== 25) return [];
  return BINGO_LINES.filter((line) =>
    line.indices.every((idx) => {
      const cell = cells[idx];
      if (!cell || !cell.checked) return false;
      if (teamId) return cell.checkedByTeamId === teamId;
      return true;
    })
  );
}
