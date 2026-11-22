import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'public', 'icons', 'bingo.ico');

// 16x16 Minecraft Grass Block pixel art scaled 2x to 32x32
const PALETTE = {
  d: [0x14, 0x53, 0x2d, 0xff], // dark green edge
  g: [0x22, 0xc5, 0x5e, 0xff], // grass green
  l: [0x4a, 0xde, 0x80, 0xff], // light grass
  b: [0x78, 0x4b, 0x2a, 0xff], // dirt brown
  m: [0x5c, 0x38, 0x1e, 0xff], // dark dirt
  s: [0x9a, 0x6b, 0x43, 0xff], // light dirt speck
  k: [0x2b, 0x1a, 0x0e, 0xff]  // border brown
};

const GRID = [
  'dddddddddddddddd',
  'dglglgglglgglgld',
  'dgglggggglgglggd',
  'dglgglgglgglggld',
  'dggdgggdgggdgggd',
  'dbgdgbddggdbgdgd',
  'dbbdbsbdbbdbbdgd',
  'dbmbmbbbsbbmbmbk',
  'kbsbbmbbbmbbsbbk',
  'kbbmbbsbbmbbbmbk',
  'kbmbbbbmbbbsbbbk',
  'kbbbsbbmbbbbmbbk',
  'kbmbbmbbbsbbmbbk',
  'kbsbbbbmbbmbbbsk',
  'kbmmbmmbbmmbmmbk',
  'kkkkkkkkkkkkkkkk'
];

const size = 32;
const bmpHeaderSize = 40;
const pixelBytes = size * size * 4;
const maskBytes = size * (size / 8); // 1-bit AND mask (all 0 = opaque)
const imageSize = bmpHeaderSize + pixelBytes + maskBytes;

const buf = Buffer.alloc(6 + 16 + imageSize);

// ICONDIR (6 bytes)
buf.writeUInt16LE(0, 0); // reserved
buf.writeUInt16LE(1, 2); // type 1 = ICO
buf.writeUInt16LE(1, 4); // 1 image

// ICONDIRENTRY (16 bytes)
buf.writeUInt8(size, 6);
buf.writeUInt8(size, 7);
buf.writeUInt8(0, 8);
buf.writeUInt8(0, 9);
buf.writeUInt16LE(1, 10);  // planes
buf.writeUInt16LE(32, 12); // bpp
buf.writeUInt32LE(imageSize, 14);
buf.writeUInt32LE(22, 18); // offset

// BITMAPINFOHEADER (40 bytes)
let off = 22;
buf.writeUInt32LE(bmpHeaderSize, off);
buf.writeInt32LE(size, off + 4);
buf.writeInt32LE(size * 2, off + 8); // height * 2 (XOR + AND)
buf.writeUInt16LE(1, off + 12);
buf.writeUInt16LE(32, off + 14);
buf.writeUInt32LE(0, off + 16); // BI_RGB
buf.writeUInt32LE(pixelBytes + maskBytes, off + 20);
off += bmpHeaderSize;

// Pixels (bottom-up BGRA)
for (let y = size - 1; y >= 0; y--) {
  const gy = Math.floor(y / 2);
  for (let x = 0; x < size; x++) {
    const gx = Math.floor(x / 2);
    const [r, g, b, a] = PALETTE[GRID[gy][gx]];
    buf.writeUInt8(b, off++);
    buf.writeUInt8(g, off++);
    buf.writeUInt8(r, off++);
    buf.writeUInt8(a, off++);
  }
}

fs.writeFileSync(OUT_PATH, buf);
console.log('Created Minecraft grass block icon:', OUT_PATH);
