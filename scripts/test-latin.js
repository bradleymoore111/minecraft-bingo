import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateBalancedBoard, verifyLatinSquare } from '../src/latinSquare.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const challenges = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'challenges.json'), 'utf8'));

const ITERATIONS = 1000;
const layouts = new Set();

for (let i = 0; i < ITERATIONS; i++) {
  const board = generateBalancedBoard(challenges);
  const res = verifyLatinSquare(board);
  if (!res.valid) {
    console.error(`Board #${i} failed:`, res.reason);
    process.exit(1);
  }
  const uniqueIds = new Set(board.map((c) => c.id));
  if (uniqueIds.size !== 25) {
    console.error(`Board #${i} had duplicate challenges (${uniqueIds.size}/25)`);
    process.exit(1);
  }
  const center = board[12];
  if (!center.isFreeSpace || center.id !== 'obtain-wood' || center.tier !== 1 || center.checked !== false) {
    console.error(`Board #${i} had invalid center free space:`, center);
    process.exit(1);
  }
  layouts.add(board.map((c) => c.tier).join(''));
}

console.log(`PASS: All ${ITERATIONS} generated 5x5 boards satisfied Doubly-Diagonal Latin Square fairness with shared center "Obtain wood" (${layouts.size} unique tier layouts observed).`);
