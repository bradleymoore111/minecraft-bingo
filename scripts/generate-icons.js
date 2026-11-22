import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * Renders a 16x16 character grid + color palette into a crisp Minecraft pixel-art SVG.
 */
function renderPixelSvg(grid, palette) {
  const rects = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects.join('')}</svg>\n`;
}

const ICONS = {
  'oak-log': {
    palette: { d: '#452b14', b: '#6b4423', m: '#855830', l: '#a67647', r: '#d4b07c', c: '#ebd0a2' },
    grid: [
      '................',
      '.dddddddddddddd.',
      '.drrrrrrrrrrrrd.',
      '.drcccccccccrdd.',
      '.drcrrrrrrrrcrd.',
      '.drcrccccccrcrd.',
      '.drcrcrrrrcrcrd.',
      '.drcrcrbbrcrcrd.',
      '.drcrcrrrrcrcrd.',
      '.drcrccccccrcrd.',
      '.drcrrrrrrrrcrd.',
      '.drccccccccccrd.',
      '.drrrrrrrrrrrrd.',
      '.dbmblbmblbmbmd.',
      '.dddddddddddddd.',
      '................'
    ]
  },
  'cactus': {
    palette: { d: '#14532d', g: '#16a34a', l: '#4ade80', s: '#052e16' },
    grid: [
      '.....dddddd.....',
      '....dglgglgd....',
      '....dsgllgsd....',
      '....dglgglgd....',
      '.ddd.dglggd.ddd.',
      'dglgdglgglgdglgd',
      'dsgldsgllgsdsgld',
      'dglgdglgglgdglgd',
      '.ddgdglgglgdgdd.',
      '...ddglgglgdd...',
      '....dglgglgd....',
      '....dsgllgsd....',
      '....dglgglgd....',
      '....dsgllgsd....',
      '....dglgglgd....',
      '....dddddddd....'
    ]
  },
  'cake': {
    palette: { w: '#f8fafc', s: '#cbd5e1', r: '#ef4444', b: '#b45309', d: '#78350f', o: '#451a03' },
    grid: [
      '................',
      '................',
      '....rr....rr....',
      '...rrrrrrrrrr...',
      '..wwwwwwwwwwww..',
      '.wwwwrwwwwrwwww.',
      '.wwwwwwwwwwwwww.',
      '.wwsswwsswwssww.',
      '.wbbbwbbbwbbbbw.',
      '.bbbbbbbbbbbbbb.',
      '.bbddbbddbbddbb.',
      '.bbbbbbbbbbbbbb.',
      '.dddddddddddddd.',
      '.oooooooooooooo.',
      '................',
      '................'
    ]
  },
  'suspicious-stew': {
    palette: { b: '#92400e', d: '#5c2808', l: '#b45309', g: '#84cc16', p: '#c084fc', y: '#fde047', w: '#f8fafc' },
    grid: [
      '.....y....p.....',
      '....p..w........',
      '........y.......',
      '................',
      '..dddddddddddd..',
      '.dggggpgggpgggd.',
      '.dgpgygggggpggd.',
      '.dddddddddddddd.',
      '.dbbbbbbbbbbbbd.',
      '..dbblbbbblbbd..',
      '..dbbbbbbbbbbd..',
      '...dbbbbbbbbd...',
      '....dddddddd....',
      '................',
      '................',
      '................'
    ]
  },
  'water-bucket': {
    palette: { d: '#475569', m: '#94a3b8', l: '#e2e8f0', b: '#2563eb', c: '#38bdf8', w: '#bae6fd' },
    grid: [
      '................',
      '.....dddddd.....',
      '....d......d....',
      '...d........d...',
      '..ddbbbbbbbbdd..',
      '.dlmbcwbcbcwmd..',
      '.dlmbbccbbcbmd..',
      '..ddllllllllmd..',
      '..dlmmmmmmmmdd..',
      '...dlmmmmmmmd...',
      '...dlmmmmmmmd...',
      '....dlmmmmmd....',
      '....dlmmmmmd....',
      '.....dddddd.....',
      '................',
      '................'
    ]
  },
  'cat': {
    palette: { o: '#d97706', l: '#f59e0b', w: '#fef3c7', d: '#78350f', g: '#22c55e', p: '#fb7185', k: '#111827' },
    grid: [
      '................',
      '..dd........dd..',
      '..dod......dod..',
      '..dooddddddoood.',
      '..doolllllloood.',
      '..dlllllllllld..',
      '..dlggllllggld..',
      '..dlkgllllgkld..',
      '..dlllwwwwllld..',
      '..dllwwppwwlld..',
      '..dllwwwwwwlld..',
      '...dllwwwwlld...',
      '....dddddddd....',
      '................',
      '................',
      '................'
    ]
  },
  'diamond-hoe': {
    palette: { k: '#0e7490', c: '#22d3ee', l: '#a5f3fc', b: '#78350f', w: '#a16207' },
    grid: [
      '................',
      '......kkkkkk....',
      '.....kclllcck...',
      '....kcclkkcck...',
      '....kck..kcck...',
      '....kk...kck....',
      '........bwk.....',
      '.......bwk......',
      '......bwk.......',
      '.....bwk........',
      '....bwk.........',
      '...bwk..........',
      '..bwk...........',
      '..bk............',
      '................',
      '................'
    ]
  },
  'wolf-armor': {
    palette: { d: '#7c2d12', m: '#c2785c', l: '#e7b29c', s: '#9a523c', k: '#1e293b', w: '#f1f5f9' },
    grid: [
      '................',
      '...dd......dd...',
      '..dmmd....dmmd..',
      '..dmmddddddmmd..',
      '..dmlmmmmmmlmd..',
      '..dmllmmmmllmd..',
      '..dmmkmmmmkmmd..',
      '..dmmmmmmmmmmmd.',
      '.ddsmmmmmmmmsdd.',
      '.dmmllssssllmmmd',
      '.dmmsmmmmmmmsmd.',
      '..ddsmmmmmmsdd..',
      '...dsmmmmmmsd...',
      '...dd......dd...',
      '................',
      '................'
    ]
  },
  'gold-hoe': {
    palette: { k: '#a16207', g: '#facc15', l: '#fef08a', p: '#c084fc', b: '#78350f', w: '#a16207' },
    grid: [
      '....p...........',
      '......kkkkkk..p.',
      '.....kglllggk...',
      '....kgglkkggk...',
      '..p.kgk..kggk...',
      '....kk...kgk..p.',
      '........bwk.....',
      '.......bwk......',
      '......bwk.......',
      '.....bwk...p....',
      '....bwk.........',
      '...bwk..........',
      '..bwk...........',
      '..bk............',
      '................',
      '................'
    ]
  },
  'jukebox': {
    palette: { d: '#451a03', b: '#78350f', m: '#92400e', l: '#b45309', k: '#0f172a', c: '#38bdf8' },
    grid: [
      '................',
      '.dddddddddddddd.',
      '.dmmmmmmmmmmmmd.',
      '.dmllllllllllmd.',
      '.dmlkkkkkkkkldm.',
      '.dmlkkkkkkkkldm.',
      '.dmllllllllllmd.',
      '.dmmmmmmmmmmmmd.',
      '.dmmbmmbbmmbmmd.',
      '.dmmbmccccmbmmd.',
      '.dmmbmmbbmmbmmd.',
      '.dmmmmmmmmmmmmd.',
      '.dbbbbbbbbbbbbd.',
      '.dddddddddddddd.',
      '................',
      '................'
    ]
  },
  'sand': {
    palette: { d: '#ca8a04', m: '#eab308', l: '#fde047', p: '#fef08a', s: '#d4a359' },
    grid: [
      '................',
      '.dddddddddddddd.',
      '.dmlplmspmllpmd.',
      '.dplmmllmsplmmd.',
      '.dmmsplmllmmpld.',
      '.dlmllmsplmmlmd.',
      '.dplmsmmllmspld.',
      '.dmmlplmsplmmpd.',
      '.dsplmmllmmllmd.',
      '.dmlmsplmsplmld.',
      '.dplmmlplmmlmpd.',
      '.dmmllmsplmslmd.',
      '.dmlplmmlplmmpd.',
      '.dddddddddddddd.',
      '................',
      '................'
    ]
  },
  'armor-trim': {
    palette: { d: '#334155', s: '#64748b', l: '#94a3b8', c: '#2dd4bf', g: '#5eead4' },
    grid: [
      '................',
      '...dddddddddd...',
      '..dssssssssssd..',
      '..dslccccccsld..',
      '..dscggggggcsd..',
      '..dscgsllsgcsd..',
      '..dscgsccsgcsd..',
      '..dscgsccsgcsd..',
      '..dscgsllsgcsd..',
      '..dscggggggcsd..',
      '..dslccccccsld..',
      '..dssssssssssd..',
      '..dsllllllllsd..',
      '...dddddddddd...',
      '................',
      '................'
    ]
  },
  'allay': {
    palette: { d: '#0284c7', c: '#38bdf8', l: '#7dd3fc', w: '#e0f2fe', k: '#0f172a' },
    grid: [
      '................',
      '.....dddddd.....',
      '....dccccccd....',
      '....dccllccd....',
      '.dd.dckcckcd.dd.',
      'dwwddccccccddwwd',
      'dwwwdcllllcdwwwd',
      '.dwwddccccddwwd.',
      '..ddd.dccd.ddd..',
      '.....dcllcd.....',
      '....dccccccd....',
      '....dcllllcd....',
      '.....dc..cd.....',
      '.....d....d.....',
      '................',
      '................'
    ]
  },
  'panda': {
    palette: { k: '#111827', w: '#f8fafc', s: '#cbd5e1', g: '#facc15', y: '#fef08a', e: '#22c55e' },
    grid: [
      '................',
      '..kkk......kkk..',
      '.kkkkk....kkkkk.',
      '.kkkwwwwwwwwkkk.',
      '..kwwwwwwwwwwk..',
      '..kwwkkwwkkwwk..',
      '..kwkskwwkskwk..',
      '..kwwwwkkwwwwk..',
      '..kwwwksskwwwk..',
      '...kwwwwwwwwk...',
      '....kkkkkkkk..y.',
      '.............gyg',
      '..............g.',
      '..............e.',
      '.............ee.',
      '................'
    ]
  },
  'happy-ghast': {
    palette: { s: '#cbd5e1', w: '#f8fafc', r: '#ef4444', c: '#38bdf8', k: '#1e293b', p: '#fb7185' },
    grid: [
      '................',
      '..ssssssssssss..',
      '.swwwwwwwwwwwws.',
      '.srrrrrwwrrrrrs.',
      '.srcccrwwrccrs..',
      '.srrrrrwwrrrrrs.',
      '.swwwwwwwwwwwws.',
      '.swwkwwwwwwkwws.',
      '.swwpwwwwwwpwws.',
      '.swwwwkwwkwwwws.',
      '.swwwwwkkwwwwws.',
      '..ssssssssssss..',
      '..sw.sw.sw.sw...',
      '..sw.sw.sw.sw...',
      '..ss.ss.ss.ss...',
      '................'
    ]
  },
  'golden-apple': {
    palette: { b: '#78350f', g: '#eab308', l: '#facc15', h: '#fef9c3', d: '#a16207' },
    grid: [
      '................',
      '........bb......',
      '.......b........',
      '....ddd..ddd....',
      '...dgggddgggd...',
      '..dglhgggggggd..',
      '..dglhgggggggd..',
      '..dggggggggggd..',
      '..dggggggggggd..',
      '..dggggggggggd..',
      '...dggggggggd...',
      '...dggggggggd...',
      '....dggggggd....',
      '.....dddddd.....',
      '................',
      '................'
    ]
  },
  'trident': {
    palette: { d: '#0f766e', t: '#14b8a6', l: '#5eead4', w: '#ccfbf1' },
    grid: [
      '...........t....',
      '..........tl..t.',
      '.........tld.tl.',
      '........tld.tld.',
      '.........t.tld..',
      '.........tttd...',
      '........dttd....',
      '.......dttd.....',
      '......dttd......',
      '.....dttd.......',
      '....dttd........',
      '...dttd.........',
      '..dttd..........',
      '.dttd...........',
      '.dd.............',
      '................'
    ]
  },
  'froglight': {
    palette: { d: '#d97706', o: '#f59e0b', y: '#fde047', w: '#fefce8', p: '#f0abfc' },
    grid: [
      '................',
      '.dddddddddddddd.',
      '.dooooooooooood.',
      '.doyyyyyyyyyyod.',
      '.doywwwwwwwwyod.',
      '.doywyyyyyywyod.',
      '.doywywwwwywyod.',
      '.doywywppwywyod.',
      '.doywywppwywyod.',
      '.doywywwwwywyod.',
      '.doywyyyyyywyod.',
      '.doywwwwwwwwyod.',
      '.dooooooooooood.',
      '.dddddddddddddd.',
      '................',
      '................'
    ]
  },
  'wither-skull': {
    palette: { k: '#09090b', d: '#27272a', m: '#3f3f46', l: '#52525b', e: '#a1a1aa' },
    grid: [
      '................',
      '...kkkkkkkkkk...',
      '..kmmmmmmmmmmk..',
      '..kmllllllllmk..',
      '..kmmmmmmmmmmk..',
      '..kmmddmmddmmk..',
      '..kmkdkmmkdkmk..',
      '..kmmmmmmmmmmk..',
      '..kmmmmmddmmmk..',
      '..kmdmdmdmdmmk..',
      '...kddddddddk...',
      '...kdkdkdkdkk...',
      '....kkkkkkkk....',
      '................',
      '................',
      '................'
    ]
  },
  'sniffer-egg': {
    palette: { d: '#7f1d1d', r: '#dc2626', l: '#f87171', t: '#14b8a6', c: '#5eead4' },
    grid: [
      '................',
      '.....dddddd.....',
      '....drrrrrrd....',
      '...drtttrrrrd...',
      '..drtcttrrrrrd..',
      '..drrttrrrlrrd..',
      '..drrrrrrtttrd..',
      '..drlrrrtcttrd..',
      '..drrrrrrttrrd..',
      '..drttrrrrrrrd..',
      '..drcttrrrttrd..',
      '...drrrrrtctd...',
      '....drrrrrrd....',
      '.....dddddd.....',
      '................',
      '................'
    ]
  },
  'mushroom': {
    palette: { d: '#7f1d1d', r: '#ef4444', w: '#f8fafc', s: '#e2e8f0', b: '#94a3b8' },
    grid: [
      '................',
      '....dddddddd....',
      '...drrwwrrrrd...',
      '..drrrwwrrrrrd..',
      '.drrrrrrrrwwrrd.',
      '.drwwrrrrrwwrrd.',
      '.drwwrrrrrrrrrd.',
      '.dddddddddddddd.',
      '.....bssssb.....',
      '.....bssssb.....',
      '.....bssssb.....',
      '.....bssssb.....',
      '.....bssssb.....',
      '.....bbbbbb.....',
      '................',
      '................'
    ]
  },
  'warden': {
    palette: { k: '#020617', d: '#0f172a', t: '#115e59', c: '#2dd4bf', l: '#99f6e4', b: '#e2e8f0' },
    grid: [
      '.cc..........cc.',
      'ccl..........lcc',
      '.cc.dddddddd.cc.',
      '..cdttttttttdc..',
      '...dtddddtdtd...',
      '...dtdccddttd...',
      '...dttttttttd...',
      '...dtddddddtd...',
      '..dddbbbbbbd....',
      '..dttdbccbdttd..',
      '..dttdbclbdttd..',
      '..dttdbccbdttd..',
      '...dddbbbbddd...',
      '....dddddddd....',
      '................',
      '................'
    ]
  },
  'netherite-armor': {
    palette: { k: '#18181b', d: '#27272a', m: '#3f3f46', l: '#52525b', p: '#71717a' },
    grid: [
      '................',
      '.kkkk......kkkk.',
      'kmmmmk....kmmmmk',
      'kmlmmkkkkkkmmlmk',
      'kmmmmmmmmmmmmmmk',
      'kmmpmmmmmmmmpmmk',
      '.kkkmmmmmmmmkkk.',
      '...kmmddddmmk...',
      '...kmmmmmmmmk...',
      '...kmpmmmpmmk...',
      '...kmmmmmmmmk...',
      '...kmmddddmmk...',
      '...kmmmmmmmmk...',
      '...kkkkkkkkkk...',
      '................',
      '................'
    ]
  },
  'mace': {
    palette: { k: '#1e293b', d: '#334155', m: '#64748b', l: '#cbd5e1', b: '#93c5fd', p: '#e0f2fe' },
    grid: [
      '.......kkkkkk...',
      '......kmmmmmmk..',
      '......kmlmmlmk..',
      '......kmmmmmmk..',
      '......kmdmmdmk..',
      '......kmmmmmmk..',
      '.......kkkkkk...',
      '.......bp.......',
      '......bp........',
      '.....bp.........',
      '....bp..........',
      '...bp...........',
      '..bp............',
      '.bp.............',
      '................',
      '................'
    ]
  },
  'ender-dragon': {
    palette: { k: '#09090b', d: '#18181b', m: '#27272a', g: '#52525b', p: '#d946ef', l: '#f5d0fe' },
    grid: [
      '...gg......gg...',
      '...gg......gg...',
      '..kkkkkkkkkkkk..',
      '..kddddddddddk..',
      '..kdmmddddmmdk..',
      '..kdplddddlpdk..',
      '..kddddddddddk..',
      '...kddddddddk...',
      '...kdmmddmmdk...',
      '...kddddddddk...',
      '....kdkddkdk....',
      '....kkkkkkkk....',
      '................',
      '................',
      '................',
      '................'
    ]
  },
  'creeper-boat': {
    palette: { d: '#14532d', g: '#22c55e', l: '#4ade80', k: '#09090b', b: '#78350f', w: '#b45309', o: '#451a03' },
    grid: [
      '....dddddddd....',
      '...dglgggglgd...',
      '...dgkkggkkgd...',
      '...dgkkggkkgd...',
      '...dgggkkgggd...',
      '...dggkkkkggd...',
      '...dggkggkggd...',
      '...dglgggglgd...',
      '.ooddddddddddoo.',
      'obwwwwwwwwwwwwbo',
      'obwbbbbbbbbbbwbo',
      '.obwwwwwwwwwwbo.',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
      '................',
      '................'
    ]
  },
  'cloud-bed': {
    palette: { w: '#f8fafc', s: '#cbd5e1', r: '#ef4444', d: '#991b1b', b: '#78350f', l: '#e2e8f0' },
    grid: [
      '................',
      '................',
      '..bb............',
      '..bwwwrrrrrrrr..',
      '..bwwwrrrrrrrrb.',
      '..bdddddddddddb.',
      '..bb..........bb',
      '....wwwwww......',
      '..wwwwwwwwww....',
      '.wwwwwwwwwwwww..',
      'wwwwwwwwwwwwwww.',
      'swwwwwwwwwwwwws.',
      '.sssssssssssss..',
      '................',
      '................',
      '................'
    ]
  },
  'carrot-stick': {
    palette: { b: '#78350f', w: '#a16207', s: '#cbd5e1', o: '#f97316', l: '#fb923c', d: '#c2410c', g: '#22c55e' },
    grid: [
      '................',
      '..........bw....',
      '.........bw.s...',
      '........bw..s...',
      '.......bw...s...',
      '......bw....s...',
      '.....bw....gg...',
      '....bw....good..',
      '...bw....goold..',
      '..bw.....dood...',
      '.bw......dood...',
      '.b........dd....',
      '................',
      '................',
      '................',
      '................'
    ]
  },
  'nether-bed': {
    palette: { y: '#fef08a', o: '#f97316', r: '#ef4444', d: '#991b1b', w: '#f8fafc', b: '#78350f', k: '#450a0a' },
    grid: [
      '....y......y....',
      '..o...y..o...o..',
      '....o..yy..r....',
      '.y...oyyyyo...y.',
      '...o.yrrrry.o...',
      '....oyrwwryo....',
      '..bb.yyyyyy.r...',
      '..bwwwrrrrrrrr..',
      '..bwwwrrrrrrrrb.',
      '..bdddddddddddb.',
      '..bb..........bb',
      '....k..k..k.....',
      '..k...o..o...k..',
      '................',
      '................',
      '................'
    ]
  },
  'anvil': {
    palette: { k: '#0f172a', d: '#334155', m: '#64748b', l: '#94a3b8' },
    grid: [
      '................',
      '................',
      '..kkkkkkkkkkkk..',
      '.kllllllllllllk.',
      '.kmmmmmmmmmmmmk.',
      '.kddddddddddddk.',
      '..kkddddddddkk..',
      '....kddmmddk....',
      '.....kddddk.....',
      '....kddddddk....',
      '...kdmddddmdk...',
      '..kddddddddddk..',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
      '................'
    ]
  },
  'elytra': {
    palette: { k: '#1e293b', d: '#475569', m: '#94a3b8', l: '#cbd5e1', w: '#f1f5f9' },
    grid: [
      '................',
      '....kk....kk....',
      '...kllk..kllk...',
      '..klmmk..kmmlk..',
      '..klmmdkkdmmlk..',
      '.klmmmddddmmmlk.',
      '.klmmdk..kdmmlk.',
      '.kmmmdk..kdmmmk.',
      '.kmmddk..kddmmk.',
      '.kmddk....kddmk.',
      '.kmddk....kddmk.',
      '..kddk....kddk..',
      '..kdk......kdk..',
      '...k........k...',
      '................',
      '................'
    ]
  },
  'nether-star': {
    palette: { c: '#67e8f9', b: '#bae6fd', w: '#ffffff', y: '#fef08a' },
    grid: [
      '.......c........',
      '.......b........',
      '......bwb.......',
      '......bwb.......',
      '.....bwwwb......',
      '....bwwywwb.....',
      '..bbwwyyywwbb...',
      'cbwwwwyyywwwwbc.',
      '..bbwwyyywwbb...',
      '....bwwywwb.....',
      '.....bwwwb......',
      '......bwb.......',
      '......bwb.......',
      '.......b........',
      '.......c........',
      '................'
    ]
  }
};

for (const [name, def] of Object.entries(ICONS)) {
  const svg = renderPixelSvg(def.grid, def.palette);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.svg`), svg, 'utf8');
}

console.log(`Generated ${Object.keys(ICONS).length} pixel-art SVG icons in public/icons/`);
