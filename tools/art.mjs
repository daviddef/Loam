#!/usr/bin/env node
/**
 * art.mjs — build Loam's item art.
 *
 * Every item is drawn on a 60x60 field from circles, arcs and tangent joins.
 * The method is constructive: shapes are placed on a grid, never freehand, so
 * item 340 still matches item 12 after a six-month gap.
 *
 * THE ONE RULE: geometry never names a colour. Each shape carries a *role*
 * ('lo' | 'bs' | 'hi' | 'ik' | 'gh'), and the theme decides what a role looks
 * like. That is what makes the whole art set re-skinnable — a light "field
 * manual" theme is a role table, not a redraw.
 *
 * Roles
 *   lo  darker chip from the item's Munsell hue page
 *   bs  the item's category colour
 *   hi  lighter chip from the same hue page
 *   ik  ink — outline and structure
 *   gh  ghost — barely-there detail
 *
 * A role may instead be a literal '#RRGGBB'. That is reserved for atoms, which
 * use the Jmol/RasMol CPK convention because that is what a chemist expects to
 * see; every other colour in the game comes from the Munsell table.
 *
 * Usage:  node tools/art.mjs            write data/art.json
 *         node tools/art.mjs check      report coverage, write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const elements = JSON.parse(readFileSync(join(root, 'data/elements.json'), 'utf8'));

/* ── shape constructors ───────────────────────────────────────────────── */
/* Compact array form keeps the payload small once inlined in the build.   */

const P = (d, r) => ['p', d, r];                       // filled path
const S = (d, r, w = 2) => ['s', d, r, w];             // stroked path
const C = (cx, cy, rad, r) => ['c', cx, cy, rad, r];   // filled circle
const E = (cx, cy, rx, ry, r) => ['e', cx, cy, rx, ry, r]; // filled ellipse

const n = v => Math.round(v * 100) / 100;

/* ── kit: the ~40 parts that compose almost everything ────────────────── */

/** A heap of loose material — soil, flour, salt, ash, sand. */
const mound = (r, y = 46, w = 23, h = 22) =>
  P(`M${n(30 - w)} ${y} Q30 ${n(y - h * 1.5)} ${n(30 + w)} ${y} Z`, r);

/** A rounded lump — stone, bread, fruit, cheese. */
const lump = (r, cx = 30, cy = 32, rx = 21, ry = 18) => E(cx, cy, rx, ry, r);

/** A faceted solid — stone, ice, crystal, mineral. */
const facet = (r, s = 1) => P(
  `M${n(30 - 22 * s)} ${n(30 + 12 * s)} L${n(30 - 10 * s)} ${n(30 - 16 * s)} ` +
  `L${n(30 + 10 * s)} ${n(30 - 18 * s)} L${n(30 + 22 * s)} ${n(30 + 4 * s)} ` +
  `L${n(30 + 14 * s)} ${n(30 + 18 * s)} L${n(30 - 14 * s)} ${n(30 + 20 * s)} Z`, r);

/** One band of liquid. Stack three for water. */
const wave = (r, y, amp = 8, w = 24) =>
  P(`M${n(30 - w)} ${y} Q30 ${n(y - amp)} ${n(30 + w)} ${y} Q30 ${n(y + amp * .5)} ${n(30 - w)} ${y} Z`, r);

/** A vessel — pot, jar, barrel, crock. Everything fermented lives in one. */
const vessel = (r, rim = 18, base = 48) => P(
  `M18 ${rim} L42 ${rim} L${n(42 + 3)} ${n(base - 8)} Q${n(42 + 3)} ${base} 38 ${base} ` +
  `L22 ${base} Q${n(18 - 3)} ${base} ${n(18 - 3)} ${n(base - 8)} Z`, r);

/** A flame — nested teardrops. */
const flame = (r, s = 1, dy = 0) => P(
  `M30 ${n(8 + dy + 14 * (1 - s))} Q${n(30 + 16 * s)} ${n(28 + dy)} ${n(30 + 14 * s)} ${n(40 + dy)} ` +
  `A${n(14 * s)} ${n(14 * s)} 0 0 1 ${n(30 - 14 * s)} ${n(40 + dy)} ` +
  `Q${n(30 - 16 * s)} ${n(28 + dy)} 30 ${n(8 + dy + 14 * (1 - s))} Z`, r);

/** A leaf, pointing up-right. */
const leaf = (r, cx = 30, cy = 30, s = 1, rot = 0) => {
  const d = `M${n(cx)} ${n(cy + 14 * s)} Q${n(cx - 14 * s)} ${n(cy)} ${n(cx)} ${n(cy - 14 * s)} ` +
            `Q${n(cx + 14 * s)} ${n(cy)} ${n(cx)} ${n(cy + 14 * s)} Z`;
  return rot ? ['g', rot, cx, cy, [P(d, r)]] : P(d, r);
};

/** A stalk with a head — wheat, grass, any standing crop. */
const stalk = (r, cx = 30, base = 52, top = 12) =>
  S(`M${cx} ${base} Q${n(cx - 3)} ${n((base + top) / 2)} ${cx} ${top}`, r, 2.4);

/** A seed / grain — a pointed oval. */
const grain = (r, cx, cy, s = 1, rot = 0) => {
  const d = `M${n(cx)} ${n(cy - 7 * s)} Q${n(cx + 5 * s)} ${n(cy)} ${n(cx)} ${n(cy + 7 * s)} ` +
            `Q${n(cx - 5 * s)} ${n(cy)} ${n(cx)} ${n(cy - 7 * s)} Z`;
  return rot ? ['g', rot, cx, cy, [P(d, r)]] : P(d, r);
};

/** Scattered granules. Deterministic from a seed so it never re-rolls. */
const granules = (r, count, seed, box = [10, 34, 50, 52]) => {
  const out = [];
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const x = box[0] + rnd() * (box[2] - box[0]);
    const y = box[1] + rnd() * (box[3] - box[1]);
    out.push(C(n(x), n(y), n(1.2 + rnd() * 1.6), r));
  }
  return out;
};

/** A disc seen slightly from above — a loaf, a plate, a round of cheese. */
const round = (r, cy = 32, rx = 20, ry = 15) => E(30, cy, rx, ry, r);

/** A cut face — the "everything is drawn open" rule. */
const cutFace = (r, cy = 32, rx = 20, ry = 15) =>
  P(`M${n(30 - rx)} ${cy} A${rx} ${ry} 0 0 1 ${n(30 + rx)} ${cy} Z`, r);

/** Ring — a cell wall, a hoop, a barrel band. */
const ring = (r, cx = 30, cy = 30, rad = 20, w = 3) =>
  ['s', `M${n(cx - rad)} ${cy} A${rad} ${rad} 0 1 1 ${n(cx + rad)} ${cy} A${rad} ${rad} 0 1 1 ${n(cx - rad)} ${cy}`, r, w];

/* ── molecular kit ────────────────────────────────────────────────────── */
/* Skeletal convention: one fixed bond length, 120 degrees, uniform stroke.  */

const BOND = 13;

/** A zig-zag carbon backbone of `len` bonds, centred. */
function backbone(r, len, cx = 30, cy = 34, up = true) {
  const pts = [];
  const dx = BOND * Math.cos(Math.PI / 6), dy = BOND * Math.sin(Math.PI / 6);
  const x0 = cx - (len * dx) / 2;
  for (let i = 0; i <= len; i++) {
    pts.push([n(x0 + i * dx), n(cy + ((i % 2 === 0) === up ? -dy / 2 : dy / 2))]);
  }
  return { pts, shape: S('M' + pts.map(p => p.join(' ')).join(' L'), r, 2.2) };
}

/** An atom marker sitting on a vertex. */
const atom = (cx, cy, r, rad = 4.2) => C(cx, cy, rad, r);

/** A double bond — two parallel lines, close, clearly a pair. */
const double = (a, b, r) => {
  const [x1, y1] = a, [x2, y2] = b;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ox = (-(y2 - y1) / len) * 1.6, oy = ((x2 - x1) / len) * 1.6;
  return [
    S(`M${n(x1 + ox)} ${n(y1 + oy)} L${n(x2 + ox)} ${n(y2 + oy)}`, r, 1.8),
    S(`M${n(x1 - ox)} ${n(y1 - oy)} L${n(x2 - ox)} ${n(y2 - oy)}`, r, 1.8),
  ];
};

/** A hexagonal ring, flat-bottomed, as IUPAC draws it. */
const hex = (r, cx = 30, cy = 30, rad = 15, w = 2.2) => {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    p.push(`${n(cx + rad * Math.cos(a))} ${n(cy + rad * Math.sin(a))}`);
  }
  return S(`M${p.join(' L')} Z`, r, w);
};

/* CPK / Jmol convention. Used for atoms only — see the header note. */
const CPK = {
  H: '#FFFFFF', C: '#909090', N: '#3050F8', O: '#FF0D0D', S: '#FFFF30',
  P: '#FF8000', Ca: '#3DFF00', Fe: '#E06633', Na: '#AB5CF2', Cl: '#1FF01F',
  K: '#8F40D4', Mg: '#8AFF00',
};

/** A ball-and-stick molecule from a tiny spec: centre atom + ligands. */
function ballStick(centre, ligands) {
  const out = [];
  const R = 15;
  ligands.forEach(([sym, ang, len = 1]) => {
    const a = (ang * Math.PI) / 180;
    const x = 30 + R * len * Math.cos(a), y = 30 + R * len * Math.sin(a);
    out.push(S(`M30 30 L${n(x)} ${n(y)}`, 'ik', 3));
  });
  ligands.forEach(([sym, ang, len = 1]) => {
    const a = (ang * Math.PI) / 180;
    const x = 30 + R * len * Math.cos(a), y = 30 + R * len * Math.sin(a);
    out.push(C(n(x), n(y), 6, CPK[sym] || '#909090'));
  });
  out.push(C(30, 30, 9, CPK[centre] || '#909090'));
  return out;
}

/* ── category assignment ──────────────────────────────────────────────── */

/**
 * Items whose tags put them in the wrong visual family. The molecular tier is
 * tagged `microbe`/`earth`/`water` in the data because those tags describe
 * where they *come from*, not what they *are*. Drawing an amino acid like a
 * mushroom would be a lie the art tells about the data.
 */
const MOLECULAR = new Set([
  'carbon', 'sulfur', 'phosphorus', 'oxygen', 'hydrogen', 'nitrogen',
  'carbon_dioxide', 'glucose', 'starch', 'amino_acid', 'cysteine',
  'dipeptide', 'polypeptide', 'protein', 'disulfide', 'atp', 'nucleotide',
  'dna', 'membrane', 'enzyme', 'denatured_protein', 'gelatin', 'keratin',
  'collagen', 'alpha_helix', 'beta_sheet', 'ribosome', 'messenger_rna',
]);

const TAG_CATEGORY = {
  earth: 'mineral', build: 'mineral',
  tool: 'craft', myth: 'craft',
  food: 'grain', sweet: 'grain',
  dish: 'dish', drink: 'dish',
  ferment: 'ferment', preserve: 'ferment', dairy: 'ferment',
  plant: 'plant', crop: 'plant',
  microbe: 'living', animal: 'living',
  water: 'water',
  fire: 'fire',
};

export function categoryOf(el) {
  if (MOLECULAR.has(el.id)) return 'molecule';
  for (const t of el.tags || []) if (TAG_CATEGORY[t]) return TAG_CATEGORY[t];
  return 'craft';
}

/* ── the item art ─────────────────────────────────────────────────────── */
/*
 * Each entry returns a flat array of shapes. Read a few and the vocabulary
 * becomes obvious: heaps are mounds, liquids are stacked waves, anything
 * fermented is in a vessel, anything cooked is drawn cut open.
 */

const ART = {};
const def = (id, fn) => { ART[id] = fn; };

/* starters ─────────────────────────────────────────────────────────────── */
def('stone',  () => [facet('lo'), facet('bs', .72), facet('hi', .34)]);
def('water',  () => [wave('lo', 42), wave('bs', 33), wave('hi', 24)]);
def('sun',    () => [C(30, 30, 13, 'bs'), ...Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return S(`M${n(30 + 17 * Math.cos(a))} ${n(30 + 17 * Math.sin(a))} L${n(30 + 24 * Math.cos(a))} ${n(30 + 24 * Math.sin(a))}`, 'hi', 2.6);
}), C(30, 30, 8, 'hi')]);
def('seed',   () => [grain('lo', 30, 32, 2.2), grain('bs', 30, 32, 1.9), grain('hi', 27, 29, .8)]);

/* mineral ──────────────────────────────────────────────────────────────── */
def('soil',   () => [
  // Drawn as a profile, because a profile is what soil *is* — you cannot see
  // soil from above, only dirt. O over A over B over C, boundaries irregular.
  P('M6 46 L54 46 L54 54 L6 54 Z', 'ground'),                 // C, parent material
  P('M6 34 Q18 31 30 34 Q42 37 54 33 L54 47 L6 47 Z', 'lo'),  // B, subsoil
  P('M6 24 Q20 21 32 24 Q44 27 54 23 L54 35 Q42 38 30 35 Q18 32 6 35 Z', 'bs'), // A, topsoil
  P('M6 17 Q20 14 32 17 Q44 20 54 16 L54 24 Q44 28 32 25 Q20 22 6 25 Z', 'hi'), // O, litter
  ...granules('craft-lo', 5, 11, [12, 37, 48, 45]),           // stones in the B
  S('M22 17 L20 33 M34 18 L37 31', 'plant-lo', 1.6),          // roots, reaching down
  leaf('plant-bs', 22, 12, .38, -30), leaf('plant-bs', 36, 11, .34, 30),
]);
def('sand',   () => [mound('bs'), ...granules('hi', 16, 3), ...granules('lo', 9, 91)]);
def('clay',   () => [E(30, 36, 20, 14, 'bs'), E(30, 32, 15, 9, 'hi'),
                     S('M14 40 Q30 46 46 40', 'lo', 2)]);
def('mud',    () => [wave('lo', 44, 5), E(30, 38, 20, 12, 'bs'), E(26, 34, 8, 4, 'hi')]);
def('limestone', () => [facet('bs'), facet('hi', .5),
                        ...granules('lo', 5, 7, [18, 24, 42, 38])]);
def('carbon',  () => [C(30, 30, 11, CPK.C), C(26, 26, 4, '#B8B8B8'),
                      ...[0, 72, 144, 216, 288].map(a => S(`M30 30 L${n(30 + 21 * Math.cos(a * Math.PI / 180))} ${n(30 + 21 * Math.sin(a * Math.PI / 180))}`, 'ik', 2))]);
def('sulfur',  () => {                                   // S8, the puckered crown
  const p = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return [n(30 + 17 * Math.cos(a)), n(30 + 17 * Math.sin(a) * 0.78 + (i % 2 ? 3 : -3))];
  });
  return [S('M' + p.map(q => q.join(' ')).join(' L') + ' Z', 'ik', 2.2),
          ...p.map(q => C(q[0], q[1], 4.6, CPK.S))];
});
def('phosphorus', () => ballStick('P', [['O', -90], ['O', 30], ['O', 150], ['O', 270, .7]]));
def('ash',    () => [mound('lo', 48, 20, 16), ...granules('hi', 12, 5, [12, 34, 48, 48]),
                     ...granules('bs', 8, 55, [14, 36, 46, 46])]);
def('cement', () => [mound('bs', 48, 18, 18), ...granules('hi', 20, 17, [14, 32, 46, 48])]);
def('concrete', () => [P('M10 24 L50 24 L50 48 L10 48 Z', 'bs'),
                       ...granules('lo', 9, 23, [14, 28, 46, 44]),
                       ...granules('hi', 6, 71, [14, 28, 46, 44])]);
def('mortar', () => [P('M10 30 L50 30 L50 40 L10 40 Z', 'bs'), S('M10 35 L50 35', 'hi', 1.6)]);
def('brick',  () => [P('M10 22 L50 22 L50 38 L10 38 Z', 'bs'),
                     P('M10 38 L50 38 L50 46 L10 46 Z', 'lo'),
                     S('M10 30 L50 30', 'hi', 1.2)]);
def('adobe',  () => [P('M10 24 L50 24 L50 44 L10 44 Z', 'bs'),
                     ...Array.from({ length: 5 }, (_, i) => S(`M${14 + i * 8} 26 L${16 + i * 8} 42`, 'hi', 1.4))]);
def('tempered_clay', () => [E(30, 36, 20, 14, 'bs'), ...granules('hi', 10, 41, [16, 30, 44, 42])]);
def('cement_meal', () => [mound('bs', 48, 19, 17), ...granules('hi', 14, 29, [14, 34, 46, 48]),
                          S('M10 48 L50 48', 'ik', 1.4)]);

/* water ────────────────────────────────────────────────────────────────── */
def('sea',    () => [wave('lo', 46), wave('bs', 37), wave('hi', 28),
                     ...granules('hi', 5, 13, [14, 20, 46, 26])]);   // salt, above the water
def('ice',    () => [facet('hi'), facet('bs', .6),
                     S('M30 12 L30 48 M16 22 L44 40 M44 22 L16 40', 'hi', 1.6)]);
def('river',  () => [S('M10 50 Q22 34 30 30 Q38 26 50 12', 'lo', 8),
                     S('M10 50 Q22 34 30 30 Q38 26 50 12', 'bs', 5),
                     S('M12 48 Q24 34 32 30', 'hi', 1.8)]);
def('steam',  () => [S('M22 46 Q14 36 22 28 Q30 20 24 12', 'bs', 3),
                     S('M34 48 Q26 38 34 30 Q42 22 36 14', 'hi', 3),
                     S('M44 46 Q38 38 44 32', 'bs', 2.4)]);
def('oxygen',   () => [...double([20, 30], [40, 30], 'ik'),          // O=O, a double bond
                       C(20, 30, 8.5, CPK.O), C(40, 30, 8.5, CPK.O)]);
def('hydrogen', () => [S('M25 30 L35 30', 'ik', 2.6),                // H-H, one short bond
                       C(25, 30, 5.5, CPK.H), C(35, 30, 5.5, CPK.H)]);
def('carbon_dioxide', () => [S('M14 30 L46 30', 'ik', 3),
                             C(14, 30, 7.5, CPK.O), C(46, 30, 7.5, CPK.O), C(30, 30, 9, CPK.C)]);

/* fire ─────────────────────────────────────────────────────────────────── */
def('spark',  () => [...[0, 60, 120, 180, 240, 300].map(a =>
  S(`M30 30 L${n(30 + 18 * Math.cos(a * Math.PI / 180))} ${n(30 + 18 * Math.sin(a * Math.PI / 180))}`, 'bs', 2.4)),
  C(30, 30, 6, 'hi')]);
def('fire',   () => [flame('lo'), flame('bs', .72, 4), flame('hi', .4, 9)]);
def('charcoal', () => [facet('lo'), facet('ik', .55),
                       ...granules('bs', 4, 33, [20, 26, 40, 36])]);

/* plant ────────────────────────────────────────────────────────────────── */
def('sprout', () => [stalk('bs', 30, 50, 30), leaf('hi', 24, 26, .6, -35), leaf('bs', 36, 26, .6, 35)]);
def('seedling', () => [stalk('bs', 30, 52, 22), leaf('hi', 22, 24, .7, -40), leaf('bs', 38, 24, .7, 40),
                       leaf('hi', 30, 16, .55, 0)]);
def('plant',  () => [stalk('lo', 30, 52, 16), leaf('bs', 20, 30, .9, -50), leaf('hi', 40, 30, .9, 50),
                     leaf('bs', 30, 16, .7, 0)]);
def('tree',   () => [S('M30 52 L30 32', 'lo', 4),
                     E(30, 24, 18, 15, 'lo'), E(28, 22, 14, 11, 'bs'), E(25, 19, 8, 6, 'hi')]);
def('leaf',   () => [leaf('bs', 30, 30, 1.5), S('M30 44 L30 16', 'lo', 1.6)]);
def('grass',  () => [stalk('bs', 20, 52, 22), stalk('hi', 28, 52, 14), stalk('bs', 36, 52, 20),
                     stalk('lo', 44, 52, 28)]);
def('root',   () => [S('M30 12 L30 34', 'bs', 4), S('M30 34 Q22 42 16 52', 'bs', 3),
                     S('M30 34 Q38 42 44 52', 'bs', 3), S('M30 34 L30 52', 'lo', 2.4)]);
def('bulb',   () => [E(30, 32, 12, 14, 'bs'), E(30, 30, 7, 9, 'hi'),
                     ...[-8, -3, 3, 8].map(dx => S(`M${30 + dx} 44 Q${30 + dx * 1.6} 50 ${30 + dx * 2} 54`, 'lo', 1.8)),
                     stalk('plant-bs', 30, 20, 8)]);                      // roots below, shoot above
def('flower', () => [stalk('lo', 30, 52, 30), ...[0, 72, 144, 216, 288].map(a =>
  E(n(30 + 11 * Math.cos(a * Math.PI / 180)), n(24 + 11 * Math.sin(a * Math.PI / 180)), 7, 7, 'bs')),
  C(30, 24, 6, 'hi')]);
def('straw',  () => [...[[-24, 8], [-8, -6], [8, 4], [22, -8]].map(([dx, r]) =>
  ['g', r, 30 + dx, 40, [P(`M${n(30 + dx - 2)} 26 L${n(30 + dx + 2)} 26 L${n(30 + dx + 2)} 52 L${n(30 + dx - 2)} 52 Z`, 'bs')]])]);
def('vine',   () => [S('M12 52 Q24 42 20 30 Q16 18 30 14 Q44 10 48 22', 'bs', 3),
                     leaf('hi', 22, 34, .5, -30), leaf('hi', 36, 15, .5, 40)]);
def('wood',   () => [P('M14 20 L46 20 L46 44 L14 44 Z', 'bs'),
                     ...[24, 30, 36].map(y => S(`M14 ${y} Q30 ${y - 3} 46 ${y}`, 'lo', 1.4))]);
def('meadow', () => [wave('lo', 48, 4, 24), stalk('bs', 16, 48, 26), stalk('hi', 24, 48, 20),
                     stalk('bs', 32, 48, 28), stalk('lo', 40, 48, 22), stalk('bs', 46, 48, 30)]);
def('nectar', () => [E(30, 38, 12, 10, 'bs'), E(28, 35, 6, 5, 'hi'),
                     ...[0, 72, 144, 216, 288].map(a => E(n(30 + 13 * Math.cos(a * Math.PI / 180)), n(26 + 13 * Math.sin(a * Math.PI / 180)), 6, 6, 'gh'))]);
def('nitrogen', () => [S('M16 24 L44 24 M16 30 L44 30 M16 36 L44 36', 'ik', 1.8),  // N#N, triple
                       C(16, 30, 9.5, CPK.N), C(44, 30, 9.5, CPK.N)]);

/* crops ────────────────────────────────────────────────────────────────── */
def('wheat',  () => [stalk('lo', 30, 54, 22),
                     ...Array.from({ length: 5 }, (_, i) => [
                       grain('bs', 25, 18 + i * 6, .8, -30),
                       grain('hi', 35, 18 + i * 6, .8, 30)]).flat()]);
def('grain',  () => [grain('bs', 22, 34, 1.5, -18), grain('hi', 32, 30, 1.5, 8),
                     grain('bs', 40, 38, 1.4, 24)]);
def('rice',   () => [...Array.from({ length: 7 }, (_, i) =>
  grain('bs', 16 + (i % 4) * 10, 26 + Math.floor(i / 4) * 12, .9, -20 + i * 12))]);
def('legume', () => [P('M14 30 Q30 18 46 30 Q30 40 14 30 Z', 'bs'),
                     C(22, 30, 4, 'hi'), C(30, 30, 4, 'hi'), C(38, 30, 4, 'hi')]);
def('fruit',  () => [E(30, 34, 16, 16, 'bs'), E(25, 29, 6, 5, 'hi'), stalk('lo', 30, 20, 12)]);
def('apple',  () => [P('M30 20 Q16 20 15 34 Q14 50 30 50 Q46 50 45 34 Q44 20 30 20 Z', 'bs'),
                     E(24, 30, 5, 6, 'hi'), S('M30 20 L30 13', 'lo', 2.4), leaf('gh', 36, 13, .4, 40)]);
def('grape',  () => [...[[30, 20], [22, 28], [38, 28], [26, 37], [34, 37], [30, 46]].map(([x, y], i) =>
  C(x, y, 7, i % 3 === 0 ? 'hi' : 'bs'))]);
def('olive',  () => [E(24, 32, 8, 10, 'bs'), E(38, 36, 8, 10, 'lo'), E(22, 29, 3, 4, 'hi')]);
def('chilli', () => [P('M22 14 Q20 34 30 48 Q42 40 40 22 Q38 16 30 16 Z', 'bs'),
                     S('M30 16 Q30 10 36 8', 'lo', 2.4), P('M26 20 Q26 34 31 44', 'hi')]);
def('cucumber', () => [['g', -30, 30, 30, [P('M30 12 Q40 30 30 48 Q20 30 30 12 Z', 'bs')]],
                       ...granules('hi', 5, 61, [24, 22, 36, 40])]);
def('tomato', () => [E(30, 34, 16, 15, 'bs'), E(25, 29, 5, 5, 'hi'),
                     ...[0, 72, 144, 216, 288].map(a => S(`M30 20 L${n(30 + 9 * Math.cos(a * Math.PI / 180))} ${n(20 + 9 * Math.sin(a * Math.PI / 180))}`, 'lo', 2))]);
def('potato', () => [E(30, 34, 18, 13, 'bs'), ...granules('lo', 5, 43, [18, 28, 42, 40])]);
def('onion',  () => [E(30, 36, 14, 14, 'bs'), E(30, 36, 9, 10, 'hi'), E(30, 36, 4, 5, 'bs'),
                     stalk('lo', 30, 22, 10)]);
def('garlic', () => [E(30, 38, 13, 13, 'bs'), S('M30 25 L30 50', 'hi', 1.4),
                     S('M22 30 Q30 46 38 30', 'hi', 1.4), stalk('lo', 30, 25, 12)]);
def('cabbage', () => [C(30, 34, 17, 'lo'), C(30, 34, 13, 'bs'), C(30, 34, 8, 'hi'),
                      S('M30 17 L30 51', 'lo', 1.2)]);
def('sugarcane', () => [P('M25 10 L35 10 L35 52 L25 52 Z', 'bs'),
                        ...[20, 30, 40].map(y => S(`M25 ${y} L35 ${y}`, 'lo', 2))]);
def('field',  () => [P('M6 34 L54 34 L48 52 L12 52 Z', 'bs'),
                     ...[0, 1, 2, 3].map(i => S(`M${16 + i * 9} 36 L${13 + i * 11} 50`, 'lo', 1.6)),
                     wave('gh', 30, 4, 24)]);
def('harvest', () => [P('M8 36 L52 36 L46 52 L14 52 Z', 'lo'),
                      grain('bs', 22, 26, 1.3, -20), grain('hi', 30, 22, 1.3, 0), grain('bs', 38, 26, 1.3, 20)]);
def('herb',   () => [stalk('lo', 30, 52, 20), leaf('bs', 22, 32, .55, -50), leaf('hi', 38, 32, .55, 50),
                     leaf('bs', 24, 22, .45, -35), leaf('hi', 36, 22, .45, 35)]);
def('pasture', () => [wave('lo', 46, 4, 24), stalk('bs', 18, 46, 30), stalk('bs', 26, 46, 34),
                      E(38, 34, 9, 6, 'hi'), C(45, 31, 3.4, 'hi')]);
def('early_crop', () => [P('M8 40 L52 40 L48 52 L12 52 Z', 'lo'),
                         stalk('bs', 22, 40, 18), stalk('hi', 30, 40, 14), stalk('bs', 38, 40, 20)]);

/* fermenting and preserving — everything lives in a vessel ─────────────── */
def('yeast',  () => [...[[24, 28, 8], [38, 32, 7], [29, 42, 6], [42, 44, 5]].map(([x, y, r], i) => [
  C(x, y, r, 'bs'), C(n(x - r * .3), n(y - r * .3), n(r * .38), 'hi')]).flat()]);
def('mould',  () => [S('M14 50 Q22 40 30 42 Q40 44 46 34', 'bs', 2.4),
                     ...[[18, 44], [26, 40], [34, 42], [42, 36], [30, 30]].map(([x, y]) =>
                       [S(`M${x} ${y + 8} L${x} ${y}`, 'lo', 1.6), C(x, y, 4.4, 'bs'),
                        C(n(x - 1.4), n(y - 1.4), 1.8, 'hi')]).flat()]);
def('malt',   () => [grain('bs', 22, 34, 1.3, -14), grain('hi', 31, 30, 1.3, 6), grain('bs', 39, 36, 1.2, 22),
                     S('M20 44 Q30 48 42 44', 'lo', 1.6)]);
def('wort',   () => [vessel('lo'), wave('bs', 34, 5, 12), wave('hi', 29, 4, 11),
                     ...granules('gh', 4, 19, [22, 38, 38, 46])]);
def('sourdough_starter', () => [vessel('lo'), wave('bs', 36, 4, 12),
                                ...[[24, 30, 3], [32, 27, 4], [38, 31, 2.6], [28, 24, 2.2]].map(([x, y, r]) => C(x, y, r, 'hi'))]);
def('risen_dough', () => [vessel('lo', 24), E(30, 24, 15, 11, 'bs'), E(26, 21, 6, 4, 'hi')]);
def('brine',  () => [vessel('lo'), wave('bs', 28, 4, 12),             // clear, with salt undissolved
                     ...Array.from({ length: 5 }, (_, i) =>
                       P(`M${22 + i * 4} ${42 + (i % 2) * 3} l3.4 0 l0 3.4 l-3.4 0 Z`, 'hi'))]);
def('pickle', () => [vessel('lo'), ['g', -20, 30, 36, [P('M30 24 Q37 36 30 48 Q23 36 30 24 Z', 'bs')]],
                     wave('gh', 30, 3, 12)]);
def('sauerkraut', () => [vessel('lo'), ...Array.from({ length: 6 }, (_, i) =>
  S(`M${22 + (i % 3) * 8} ${30 + Math.floor(i / 3) * 8} Q${26 + (i % 3) * 8} ${34 + Math.floor(i / 3) * 8} ${22 + (i % 3) * 8} ${38 + Math.floor(i / 3) * 8}`, i % 2 ? 'hi' : 'bs', 2.4))]);
def('kimchi', () => [vessel('lo'),                                        // clumped, not shredded
                     ...[[25, 32, 7], [36, 30, 6], [30, 41, 6]].map(([x, y, r]) => C(x, y, r, 'bs')),
                     ...[[22, 28], [34, 24], [40, 38], [27, 45]].map(([x, y]) => C(x, y, 2.4, 'fire-bs'))]);
def('vinegar', () => [vessel('lo'), wave('bs', 34, 4, 12), wave('hi', 30, 3, 11),
                      E(30, 40, 8, 3, 'gh')]);
def('salt',   () => [mound('hi', 46, 18, 16), ...granules('bs', 12, 37, [16, 34, 44, 46]),
                     facet('gh', .3)]);

/* dairy ────────────────────────────────────────────────────────────────── */
def('milk',   () => [vessel('lo', 20), wave('hi', 30, 4, 12), wave('bs', 36, 3, 12)]);
def('cream',  () => [vessel('lo', 20), wave('bs', 34, 3, 12), wave('hi', 28, 5, 12)]);
def('butter', () => [P('M14 28 L46 28 L46 44 L14 44 Z', 'bs'),
                     P('M14 28 L46 28 L46 33 L14 33 Z', 'hi'),
                     S('M22 33 L22 44 M30 33 L30 44 M38 33 L38 44', 'lo', 1.2)]);
def('ghee',   () => [vessel('lo', 24), wave('bs', 36, 3, 12), wave('hi', 31, 4, 12), C(30, 27, 3, 'hi')]);
def('curd',   () => [vessel('lo'), ...[[24, 32, 5], [34, 30, 6], [29, 40, 5], [39, 39, 4]].map(([x, y, r], i) =>
  P(`M${x - r} ${y} L${x} ${y - r} L${x + r} ${y} L${x} ${y + r} Z`, i % 2 ? 'hi' : 'bs'))]);
def('cheese', () => [P('M12 26 L48 26 L48 44 L12 44 Z', 'bs'),
                     P('M12 26 L48 26 L48 31 L12 31 Z', 'hi'),
                     C(22, 37, 3.4, 'lo'), C(33, 35, 2.6, 'lo'), C(40, 39, 3, 'lo')]);
def('aged_cheese', () => [P('M12 26 L48 26 L48 44 L12 44 Z', 'lo'),
                          P('M12 26 L48 26 L48 30 L12 30 Z', 'bs'),
                          C(22, 37, 3, 'hi'), C(32, 34, 2.2, 'hi'), C(40, 38, 2.6, 'hi'),
                          S('M12 44 L48 44', 'ik', 1.6)]);
def('blue_cheese', () => [P('M12 26 L48 26 L48 44 L12 44 Z', 'hi'),
                          ...[[20, 33], [28, 39], [36, 32], [42, 40], [31, 30]].map(([x, y]) =>
                            S(`M${x - 3} ${y} Q${x} ${y - 3} ${x + 3} ${y}`, 'lo', 2))]);
def('yoghurt', () => [vessel('lo', 24), wave('hi', 32, 3, 12),
                      ...[[26, 38, 2.4], [34, 40, 2], [30, 44, 1.8]].map(([x, y, r]) => C(x, y, r, 'bs'))]);

/* animals ──────────────────────────────────────────────────────────────── */
def('bee',    () => [E(30, 32, 13, 9, 'bs'),
                     ...[-6, 0, 6].map(dx => S(`M${30 + dx} 24 L${30 + dx} 40`, 'lo', 2.6)),
                     E(20, 26, 7, 4, 'gh'), E(40, 26, 7, 4, 'gh'), C(43, 32, 3.4, 'lo')]);
def('aurochs', () => [P('M8 30 Q16 24 30 26 Q44 28 46 34 L46 44 L10 44 Z', 'lo'),  // heavy shoulder
                      E(28, 36, 19, 11, 'bs'), C(45, 29, 7.4, 'bs'),
                      S('M40 22 Q34 12 42 8', 'hi', 3.4), S('M50 22 Q56 12 48 8', 'hi', 3.4),
                      ...[-11, -4, 5, 12].map(dx => S(`M${28 + dx} 45 L${28 + dx} 54`, 'lo', 3))]);
def('cow',    () => [E(28, 36, 15, 10, 'hi'), C(42, 32, 6.4, 'hi'),   // smaller, patched, hornless
                     E(23, 33, 6, 4.4, 'lo'), E(33, 39, 5, 3, 'lo'), E(38, 31, 3, 2.4, 'lo'),
                     E(30, 46, 4, 3, 'lo'),                            // udder
                     ...[-8, -3, 4, 9].map(dx => S(`M${28 + dx} 44 L${28 + dx} 52`, 'lo', 2.4))]);
def('goat',   () => [E(29, 36, 15, 10, 'bs'), C(43, 31, 6, 'bs'),
                     S('M42 25 Q42 18 47 17', 'lo', 2.4),
                     ...[-8, -2, 5, 10].map(dx => S(`M${30 + dx} 44 L${30 + dx} 52`, 'lo', 2.2))]);
def('chicken', () => [E(28, 36, 13, 12, 'bs'), C(40, 26, 7, 'bs'),
                      P('M40 19 L37 15 L43 15 Z', 'fire-bs'),
                      S('M28 47 L26 53 M34 47 L36 53', 'lo', 2.2),
                      E(20, 34, 8, 6, 'hi')]);
def('egg',    () => [P('M30 16 Q44 26 42 38 A13 13 0 0 1 18 38 Q16 26 30 16 Z', 'hi'),
                     P('M25 25 Q22 32 24 38', 'gh')]);
def('boiled_egg', () => [P('M30 14 Q44 24 42 36 A13 13 0 0 1 18 36 Q16 24 30 14 Z', 'hi'),
                         S('M17 36 L43 36', 'ik', 1.4),
                         P('M18 36 A13 13 0 0 0 42 36 Z', 'hi'),
                         E(30, 41, 6, 5, 'grain-bs')]);
def('fish',   () => [P('M12 32 Q26 20 42 32 Q26 44 12 32 Z', 'bs'),
                     P('M42 32 L52 25 L52 39 Z', 'lo'), C(20, 30, 2.4, 'ik'),
                     S('M26 24 Q28 32 26 40', 'hi', 1.4)]);
def('meat',   () => [P('M16 26 Q30 18 44 26 Q48 38 38 46 Q26 50 18 42 Q12 34 16 26 Z', 'bs'),
                     P('M22 30 Q30 26 38 30 Q40 38 32 42 Q24 42 22 36 Z', 'hi'),
                     S('M16 26 Q30 22 44 26', 'lo', 2)]);
def('bone',   () => [S('M20 40 L40 24', 'hi', 6), C(18, 43, 5, 'hi'), C(23, 37, 5, 'hi'),
                     C(42, 21, 5, 'hi'), C(37, 27, 5, 'hi')]);
def('tissue', () => [E(30, 32, 19, 14, 'bs'), ...[22, 30, 38].map(x =>
  S(`M${x} 20 Q${x + 3} 32 ${x} 44`, 'hi', 2))]);
def('muscle', () => [P('M14 30 Q30 20 46 30 Q30 42 14 30 Z', 'bs'),
                     ...[-6, 0, 6].map(dy => S(`M16 ${30 + dy} Q30 ${26 + dy} 44 ${30 + dy}`, 'lo', 1.4))]);

/* prepared food ────────────────────────────────────────────────────────── */
def('flour',  () => [mound('hi', 46, 20, 18), ...granules('bs', 10, 47, [16, 34, 44, 46])]);
def('dough',  () => [E(30, 34, 18, 14, 'bs'), E(25, 30, 7, 5, 'hi')]);
def('pasta_dough', () => [P('M8 30 L52 30 L48 42 L12 42 Z', 'bs'),        // rolled flat
                          S('M8 30 L52 30', 'hi', 2),
                          S('M20 30 L18 42 M32 30 L30 42 M44 30 L42 42', 'lo', 1.2)]);
def('salted_dough', () => [E(30, 34, 18, 14, 'bs'), E(25, 30, 7, 5, 'hi'),
                           ...granules('hi', 6, 57, [20, 26, 40, 40])]);
def('rubbed_flour', () => [mound('hi', 46, 19, 16), ...granules('bs', 16, 67, [16, 32, 44, 46])]);
def('pastry', () => [P('M12 30 L48 30 L48 42 L12 42 Z', 'bs'),
                     ...[34, 38].map(y => S(`M12 ${y} L48 ${y}`, 'hi', 1.2)),
                     S('M12 30 L48 30', 'lo', 1.6)]);
def('breadcrumb', () => [...granules('bs', 22, 77, [12, 28, 48, 48]),
                         ...granules('hi', 10, 87, [14, 30, 46, 46])]);
def('batter', () => [vessel('lo', 26), wave('bs', 38, 4, 12),
                     S('M30 12 Q34 22 30 32', 'hi', 3),   // a ribbon falling off the whisk
                     C(30, 34, 3, 'hi')]);
def('cake_batter', () => [vessel('lo', 26), E(30, 32, 12, 8, 'bs'), E(27, 29, 5, 3, 'hi'),
                          ...granules('grain-hi', 5, 313, [22, 24, 38, 30])]);
def('cake_mix', () => [vessel('lo', 26), wave('bs', 35, 4, 12), ...granules('hi', 5, 97, [22, 28, 38, 34])]);
def('creamed_butter', () => [vessel('lo', 26), E(30, 34, 11, 8, 'hi'), E(27, 31, 4, 3, 'bs')]);
def('sweet_cream', () => [vessel('lo', 24), wave('hi', 32, 5, 12), C(30, 26, 3.4, 'hi')]);
def('noodle', () => [...[24, 30, 36, 42].map(y => S(`M12 ${y} Q22 ${y - 5} 30 ${y} Q38 ${y + 5} 48 ${y}`, 'bs', 3))]);
def('mince',  () => [...granules('bs', 18, 107, [14, 28, 46, 46]),
                     ...granules('lo', 8, 117, [16, 30, 44, 44])]);
def('cured_mince', () => [P('M12 26 L48 26 L48 44 L12 44 Z', 'bs'),   // pressed into a block
                          S('M12 26 L48 26', 'hi', 2),
                          ...granules('hi', 9, 137, [16, 30, 44, 42])]);
def('broth',  () => [vessel('lo'), wave('bs', 34, 4, 12), wave('hi', 30, 3, 11),
                     ...granules('gh', 4, 147, [22, 36, 38, 44])]);
def('olive_oil', () => [vessel('lo', 22), wave('bs', 36, 3, 11), wave('hi', 32, 3, 10),
                        E(24, 24, 5, 6, 'plant-bs')]);
def('herb_oil', () => [vessel('lo', 22), wave('bs', 36, 3, 11), leaf('plant-bs', 30, 30, .45, 20)]);
def('garlic_butter', () => [P('M14 30 L46 30 L46 44 L14 44 Z', 'bs'), E(24, 26, 6, 6, 'hi'),
                            S('M22 34 L22 44 M32 34 L32 44', 'lo', 1.2)]);
def('garlic_yoghurt', () => [vessel('lo', 24), wave('hi', 32, 3, 12), E(30, 40, 5, 5, 'bs')]);
def('mayonnaise', () => [vessel('lo', 24), wave('hi', 32, 4, 12), C(30, 40, 4, 'hi')]);
def('egg_mayo', () => [vessel('lo', 26), wave('hi', 34, 3, 12),
                       ...granules('grain-bs', 5, 157, [22, 30, 38, 40])]);
def('passata', () => [vessel('lo', 22), wave('bs', 34, 4, 11),
                      ...granules('grain-hi', 6, 317, [22, 36, 38, 44]),   // seeds
                      E(30, 18, 7, 3, 'lo')]);
def('meatball_mix', () => [vessel('lo', 26), ...[[25, 36, 5], [35, 34, 5], [30, 42, 4]].map(([x, y, r]) => C(x, y, r, 'bs'))]);
def('meatball_sauce', () => [vessel('lo', 24), wave('bs', 34, 4, 12), C(26, 38, 4.4, 'lo'), C(35, 40, 4, 'lo')]);
def('olive_salad', () => [round('lo', 38, 20, 10), E(24, 32, 6, 7, 'bs'), E(36, 34, 6, 7, 'lo'),
                          leaf('plant-bs', 30, 27, .4, 30)]);
def('kimchi_paste', () => [vessel('lo', 26), wave('bs', 36, 3, 11), C(30, 30, 4, 'fire-bs')]);
def('salted_cabbage', () => [vessel('lo'), C(30, 36, 11, 'hi'), C(30, 36, 7, 'bs'),
                             ...granules('hi', 6, 167, [22, 26, 38, 32])]);
def('caramel_sauce', () => [vessel('lo', 30), wave('bs', 40, 4, 12),
                            S('M30 8 Q26 22 30 34', 'bs', 4)]);       // a thread, poured
def('pizza_base', () => [round('bs', 34, 20, 15), round('hi', 33, 16, 11)]);
def('battered_fish', () => [P('M14 32 Q28 22 44 32 Q28 42 14 32 Z', 'bs'),
                            ...granules('hi', 8, 177, [18, 28, 40, 38])]);
def('fried_fish', () => [P('M14 32 Q28 22 44 32 Q28 42 14 32 Z', 'lo'),
                         ...granules('bs', 9, 187, [18, 28, 40, 38])]);

/* dishes — the rule is: anything cooked is drawn cut open ──────────────── */
def('flatbread', () => [round('bs', 34, 21, 14), round('hi', 33, 15, 9),
                        ...granules('lo', 5, 197, [22, 28, 38, 38])]);
def('bread',  () => [P('M12 42 Q12 24 30 24 Q48 24 48 42 Z', 'bs'),
                     P('M16 42 Q16 30 30 30 Q44 30 44 42 Z', 'hi'),
                     S('M12 42 L48 42', 'ik', 1.6),
                     ...granules('lo', 6, 207, [20, 33, 40, 40])]);   // crumb, in section
def('sourdough', () => [P('M12 42 Q12 22 30 22 Q48 22 48 42 Z', 'bs'),
                        P('M16 42 Q16 30 30 30 Q44 30 44 42 Z', 'hi'),
                        S('M12 42 L48 42', 'ik', 1.6),
                        ...granules('lo', 9, 217, [19, 32, 41, 41]),
                        S('M22 26 L34 22', 'lo', 1.6)]);
def('garlic_bread', () => [P('M12 42 Q12 26 30 26 Q48 26 48 42 Z', 'bs'),
                           S('M12 42 L48 42', 'ik', 1.6),
                           E(24, 32, 4, 4, 'hi'), E(36, 33, 4, 4, 'hi')]);
def('granary', () => [P('M12 42 Q12 24 30 24 Q48 24 48 42 Z', 'lo'),
                      P('M16 42 Q16 30 30 30 Q44 30 44 42 Z', 'bs'),
                      ...granules('hi', 8, 227, [18, 28, 42, 40])]);
def('cake',   () => [P('M14 44 L46 44 L46 30 L14 30 Z', 'bs'),
                     P('M14 30 L46 30 L46 25 L14 25 Z', 'hi'),
                     S('M14 37 L46 37', 'lo', 1.4), S('M14 44 L46 44', 'ik', 1.6)]);
def('apple_pie', () => [P('M10 44 Q10 28 30 28 Q50 28 50 44 Z', 'bs'),
                        S('M10 44 L50 44', 'ik', 1.8),
                        ...[22, 30, 38].map(x => S(`M${x} 30 L${x} 44`, 'lo', 1.2)),
                        E(30, 38, 12, 5, 'hi')]);
def('gingerbread_man', () => [C(30, 18, 7, 'bs'), P('M24 26 L36 26 L34 40 L26 40 Z', 'bs'),
                              S('M24 28 L16 34 M36 28 L44 34', 'bs', 4),
                              S('M27 40 L24 52 M33 40 L36 52', 'bs', 4),
                              C(27, 17, 1.6, 'hi'), C(33, 17, 1.6, 'hi')]);
def('pasta',  () => [round('lo', 38, 20, 10), ...[30, 34, 38].map(y =>
  S(`M16 ${y} Q24 ${y - 4} 30 ${y} Q38 ${y + 4} 44 ${y}`, 'grain-hi', 3))]);
def('spaghetti_meatballs', () => [round('lo', 40, 21, 10),
                                  ...[30, 34, 38].map(y => S(`M15 ${y} Q24 ${y - 4} 30 ${y} Q38 ${y + 4} 45 ${y}`, 'grain-hi', 3)),
                                  C(24, 33, 5.4, 'bs'), C(36, 36, 5, 'bs'), C(30, 41, 4.4, 'lo')]);
def('roast',  () => [P('M16 28 Q30 20 44 28 Q48 40 36 46 Q24 48 18 42 Z', 'lo'),
                     P('M22 32 Q30 28 38 32 Q40 40 32 43 Q25 43 22 38 Z', 'bs'),
                     S('M20 46 L40 46', 'ik', 1.6)]);
def('sausage', () => [['g', -25, 30, 32, [P('M16 32 Q30 22 44 32 Q30 42 16 32 Z', 'bs')]],
                      S('M20 36 L24 30 M38 33 L42 27', 'lo', 1.6)]);
def('meatball', () => [C(30, 34, 14, 'bs'), C(25, 29, 5, 'hi'),
                       ...granules('lo', 5, 237, [22, 26, 38, 42])]);
def('aspic',  () => [P('M14 44 L46 44 L44 26 L16 26 Z', 'gh'),
                     P('M14 44 L46 44 L44 26 L16 26 Z', 'bs'),
                     C(26, 34, 3.4, 'lo'), C(35, 37, 3, 'lo'), S('M16 26 L44 26', 'hi', 1.6)]);
def('soup',   () => [round('lo', 40, 21, 9), wave('bs', 36, 4, 15), wave('hi', 32, 3, 12),
                     ...granules('gh', 4, 247, [22, 32, 38, 38])]);
def('cooked_rice', () => [round('lo', 40, 20, 9),
                          ...Array.from({ length: 8 }, (_, i) =>
                            grain('hi', 18 + (i % 4) * 8, 30 + Math.floor(i / 4) * 7, .8, -20 + i * 14))]);
def('sushi_rice', () => [round('lo', 42, 19, 8),
                         ...Array.from({ length: 7 }, (_, i) =>
                           grain('hi', 19 + (i % 4) * 8, 32 + Math.floor(i / 4) * 7, .8, i * 15)),
                         S('M16 44 L44 44', 'ferment-bs', 2)]);
def('baked_potato', () => [E(30, 34, 18, 13, 'lo'), S('M22 34 L38 34', 'ik', 2),
                           P('M23 33 Q30 28 37 33 Q30 38 23 33 Z', 'hi')]);
def('chips',  () => [...[[18, -8], [26, 4], [34, -4], [42, 8]].map(([x, r]) =>
  ['g', r, x, 38, [P(`M${x - 3} 24 L${x + 3} 24 L${x + 3} 50 L${x - 3} 50 Z`, 'bs')]])]);
def('salad',  () => [round('lo', 40, 20, 9), leaf('plant-bs', 23, 32, .7, -30),
                     leaf('plant-hi', 36, 33, .7, 30), leaf('plant-bs', 30, 27, .6, 5)]);
def('greek_salad', () => [round('lo', 40, 20, 9), leaf('plant-bs', 22, 33, .6, -30),
                          E(36, 32, 5, 5, 'fire-bs'), P('M28 30 L36 30 L36 38 L28 38 Z', 'grain-hi'),
                          E(42, 38, 4, 5, 'ferment-lo')]);
def('potato_salad', () => [round('lo', 40, 20, 9), ...[[24, 34, 5], [34, 32, 5], [30, 40, 4]].map(([x, y, r]) => C(x, y, r, 'bs')),
                           wave('hi', 42, 3, 14)]);
def('tzatziki', () => [vessel('lo', 26), wave('hi', 34, 3, 12), ['g', -25, 30, 40, [E(30, 40, 3, 6, 'plant-bs')]]]);
def('cheese_toastie', () => [P('M12 26 L48 26 L48 42 L12 42 Z', 'grain-bs'),
                             S('M12 34 L48 34', 'bs', 3.4),
                             S('M12 42 L48 42', 'ik', 1.6)]);
def('pizza',  () => [round('bs', 34, 21, 15), round('hi', 33, 16, 11),
                     C(24, 31, 3.4, 'fire-bs'), C(34, 30, 3, 'fire-bs'), C(30, 38, 3, 'fire-bs')]);
def('grilled_fish', () => [P('M12 32 Q26 22 42 32 Q26 42 12 32 Z', 'bs'),
                           P('M42 32 L52 26 L52 38 Z', 'lo'),
                           S('M18 27 L18 37 M26 25 L26 39 M34 26 L34 38', 'ik', 1.4)]);
def('smoked_fish', () => [P('M12 32 Q26 22 42 32 Q26 42 12 32 Z', 'lo'),
                          P('M42 32 L52 26 L52 38 Z', 'lo'),
                          S('M20 20 Q26 14 22 8 M32 20 Q38 14 34 8', 'gh', 2)]);
def('fish_and_chips', () => [P('M10 34 Q24 24 38 34 Q24 44 10 34 Z', 'bs'),
                             ...[[42, -8], [48, 6]].map(([x, r]) => ['g', r, x, 38, [P(`M${x - 3} 26 L${x + 3} 26 L${x + 3} 50 L${x - 3} 50 Z`, 'grain-bs')]])]);
def('wrap',   () => [['g', -18, 30, 32, [P('M20 16 L40 16 L40 48 L20 48 Z', 'grain-hi')]],
                     ['g', -18, 30, 32, [S('M24 20 L24 44', 'plant-bs', 3)]]]);
def('egg_sandwich', () => [P('M12 24 L48 24 L48 30 L12 30 Z', 'grain-hi'),
                           P('M12 30 L48 30 L48 38 L12 38 Z', 'bs'),
                           P('M12 38 L48 38 L48 44 L12 44 Z', 'grain-hi')]);
def('pilaf',  () => [round('lo', 44, 21, 8),
                     P('M14 42 Q30 18 46 42 Z', 'bs'),                    // heaped into a dome
                     ...granules('hi', 7, 323, [20, 30, 40, 40]),
                     C(36, 28, 2.6, 'fire-bs'), C(25, 33, 2.2, 'plant-bs')]);
def('choucroute', () => [round('lo', 42, 20, 8),
                         ...Array.from({ length: 5 }, (_, i) => S(`M${20 + i * 5} 30 Q${23 + i * 5} 36 ${20 + i * 5} 42`, 'ferment-hi', 2.2)),
                         ['g', -20, 38, 36, [P('M34 28 Q42 22 46 32 Q40 40 34 28 Z', 'bs')]]]);
def('breakfast', () => [round('lo', 42, 21, 8),
                        P('M18 28 Q26 22 30 30 Q26 38 18 32 Z', 'grain-hi'),
                        C(38, 30, 6, 'hi'), C(38, 30, 2.6, 'grain-bs'),
                        S('M22 40 L40 40', 'bs', 3)]);
def('cheeseboard', () => [P('M10 40 L50 40 L50 46 L10 46 Z', 'craft-lo'),
                          P('M16 28 L28 28 L28 40 L16 40 Z', 'ferment-hi'),
                          P('M32 30 L44 30 L44 40 L32 40 Z', 'ferment-bs'),
                          C(22, 33, 2, 'ferment-lo')]);
def('dinner', () => [round('lo', 40, 21, 10), P('M18 32 Q26 26 32 32 Q26 40 18 34 Z', 'bs'),
                     leaf('plant-bs', 38, 32, .5, 25), ...granules('grain-hi', 5, 257, [30, 36, 42, 42])]);
def('feast',  () => [round('lo', 44, 22, 8),
                     P('M14 34 Q20 28 26 34 Q20 40 14 36 Z', 'bs'),
                     C(34, 32, 6, 'grain-hi'), C(44, 34, 5, 'plant-bs'),
                     C(24, 24, 4, 'fire-bs'), S('M10 44 L50 44', 'ik', 1.6)]);
def('sundae', () => [P('M22 30 L38 30 L34 50 L26 50 Z', 'gh'),
                     P('M22 30 L38 30 L34 50 L26 50 Z', 'craft-hi'),
                     C(25, 26, 6, 'hi'), C(34, 25, 6, 'bs'), C(30, 20, 5.4, 'grain-hi'),
                     C(30, 14, 3, 'fire-bs')]);
def('ice_cream', () => [P('M22 32 L38 32 L34 52 L26 52 Z', 'craft-hi'),
                        C(26, 28, 7, 'hi'), C(35, 27, 7, 'bs'), C(30, 21, 6, 'hi')]);
def('clean_hands', () => [P('M22 46 L22 30 Q22 22 26 22 Q30 22 30 30 L30 24 Q30 18 34 18 Q38 18 38 26 L38 32 Q42 30 42 36 L42 46 Z', 'bs'),
                          ...[[20, 20], [40, 18], [30, 14]].map(([x, y]) => C(x, y, 3, 'water-hi'))]);

/* ── the molecular tier ───────────────────────────────────────────────────
 * Drawn to IUPAC convention: one fixed bond length, 120 degrees, uniform
 * hairline, heteroatoms as coloured vertices in the Jmol/RasMol CPK scheme.
 * This is a different drawing language from the material tier, and the switch
 * is deliberate — it is the moment the player leaves the world of things.
 */

def('glucose', () => {
  const p = [];
  for (let i = 0; i < 6; i++) {                          // Haworth-ish flat ring
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    p.push([n(30 + 15 * Math.cos(a)), n(32 + 13 * Math.sin(a))]);
  }
  return [
    S('M' + p.map(q => q.join(' ')).join(' L') + ' Z', 'ik', 2.2),
    C(p[1][0], p[1][1], 4.2, CPK.O),                     // ring oxygen
    ...[0, 2, 3, 4].map(i => C(p[i][0], p[i][1], 3.4, CPK.O)),
    S(`M${p[5][0]} ${p[5][1]} L${p[5][0]} ${n(p[5][1] - 10)}`, 'ik', 2),
    C(p[5][0], n(p[5][1] - 10), 3.4, CPK.O),
  ];
});

def('starch', () => {                                    // glucose units, chained
  const out = [];
  for (let i = 0; i < 4; i++) {
    const cx = 12 + i * 12;
    out.push(hex('ik', cx, i % 2 ? 26 : 36, 7, 1.8));
    if (i) out.push(S(`M${12 + (i - 1) * 12 + 6} ${i % 2 ? 34 : 28} L${cx - 6} ${i % 2 ? 28 : 34}`, 'ik', 1.8));
  }
  out.push(...[0, 1, 2, 3].map(i => C(12 + i * 12, i % 2 ? 19 : 29, 3, CPK.O)));
  return out;
});

def('amino_acid', () => {
  //  H2N — Cα — COOH  with the R group hanging below. The canonical drawing.
  const a = [16, 34], b = [30, 26], c = [44, 34];
  return [
    S(`M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]}`, 'ik', 2.4),
    S(`M${b[0]} ${b[1]} L${b[0]} ${b[1] + 14}`, 'ik', 2.4),
    ...double(c, [52, 28], 'ik'), S(`M${c[0]} ${c[1]} L52 40`, 'ik', 2.2),
    C(a[0], a[1], 5.4, CPK.N),                            // amine
    C(52, 28, 4.6, CPK.O), C(52, 40, 4.6, CPK.O),         // carboxyl
    C(b[0], b[1], 5, CPK.C),
    C(b[0], b[1] + 14, 5.4, 'bs'),                        // R — the variable bit
  ];
});

def('cysteine', () => {
  const a = [14, 32], b = [28, 24], c = [42, 32];
  return [
    S(`M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]}`, 'ik', 2.4),
    S(`M${b[0]} ${b[1]} L${b[0]} 40 L${b[0] + 10} 48`, 'ik', 2.4),
    C(a[0], a[1], 5, CPK.N), C(c[0], c[1], 4.4, CPK.O),
    C(b[0] + 10, 48, 5.6, CPK.S),                         // the thiol — the whole point
  ];
});

def('dipeptide', () => {
  const bond = [30, 30];
  return [
    P('M8 22 L24 22 L24 38 L8 38 Z', 'bs'),               // residue one
    P('M36 22 L52 22 L52 38 L36 38 Z', 'bs'),             // residue two
    S('M24 30 L36 30', 'ik', 3),                          // the peptide bond
    C(bond[0] - 3, 24, 4, CPK.O), C(bond[0] + 3, 36, 4, CPK.N),
  ];
});

def('polypeptide', () => {
  const { pts, shape } = backbone('ik', 4, 30, 34);
  return [shape, ...pts.map((p, i) => C(p[0], p[1], 4.4, i % 2 ? 'bs' : 'hi'))];
});

def('protein', () => [                                    // space-filling silhouette
  ...[[24, 26, 11], [38, 30, 10], [28, 40, 9], [42, 42, 7], [18, 36, 8]]
    .map(([x, y, r]) => C(x, y, r, 'lo')),
  ...[[24, 26, 8], [38, 30, 7], [28, 40, 6], [42, 42, 5], [18, 36, 5.4]]
    .map(([x, y, r]) => C(x, y, r, 'bs')),
  C(21, 23, 3.4, 'hi'),
]);

def('denatured_protein', () => {                          // the fold, undone
  const { pts, shape } = backbone('ik', 5, 30, 32);
  return [S('M8 44 Q18 30 26 40 Q34 50 42 34 Q48 24 54 32', 'lo', 5),
          S('M8 44 Q18 30 26 40 Q34 50 42 34 Q48 24 54 32', 'bs', 2.4)];
});

def('disulfide', () => [                                  // two cysteines, joined
  S('M10 40 L20 32', 'ik', 2.4), S('M50 40 L40 32', 'ik', 2.4),
  S('M20 32 L40 32', 'ik', 3),
  C(20, 32, 6.4, CPK.S), C(40, 32, 6.4, CPK.S),
  C(10, 40, 4.4, 'bs'), C(50, 40, 4.4, 'bs'),
]);

def('collagen', () => [                                   // the triple helix
  ...[0, 1, 2].map(k => S(
    Array.from({ length: 13 }, (_, i) =>
      `${i ? 'L' : 'M'}${n(8 + i * 3.7)} ${n(30 + 11 * Math.sin(i * 0.8 + k * 2.1))}`).join(' '),
    k === 1 ? 'hi' : 'bs', 3)),
]);

def('keratin', () => [                                    // coiled coil
  ...[0, 1].map(k => S(
    Array.from({ length: 13 }, (_, i) =>
      `${i ? 'L' : 'M'}${n(8 + i * 3.7)} ${n(32 + 10 * Math.sin(i * 0.9 + k * 3.14))}`).join(' '),
    k ? 'hi' : 'bs', 3.4)),
  C(20, 32, 3.4, CPK.S), C(40, 32, 3.4, CPK.S),
]);

def('gelatin', () => [                                    // collagen, unwound
  S('M8 26 Q20 18 28 30 Q36 42 50 34', 'bs', 3.4),
  S('M8 40 Q22 34 30 44 Q40 52 52 44', 'hi', 3),
  S('M10 32 Q24 28 34 22', 'lo', 2.4),
]);

def('nucleotide', () => [
  hex('ik', 22, 26, 9, 2),                                // base
  P('M30 34 L38 30 L44 36 L38 44 L30 42 Z', 'ik'),        // sugar — as an outline
  P('M31 34.6 L37.6 31.2 L42.6 36.2 L37.6 42.6 L31 41.2 Z', 'bs'),
  C(50, 40, 5.4, CPK.P),                                  // phosphate
  S('M44 38 L50 40', 'ik', 2),
]);

def('dna', () => {
  const out = [];
  for (let i = 0; i <= 14; i++) {                         // two antiparallel strands
    const y = 8 + i * 3.2;
    const x1 = 30 + 13 * Math.sin(i * 0.62), x2 = 30 - 13 * Math.sin(i * 0.62);
    if (i % 2 === 0) out.push(S(`M${n(x1)} ${n(y)} L${n(x2)} ${n(y)}`, 'gh', 1.8));
  }
  ['bs', 'hi'].forEach((r, k) => out.push(S(
    Array.from({ length: 15 }, (_, i) =>
      `${i ? 'L' : 'M'}${n(30 + (k ? -13 : 13) * Math.sin(i * 0.62))} ${n(8 + i * 3.2)}`).join(' '), r, 3.4)));
  return out;
});

def('atp', () => [
  hex('ik', 18, 22, 8, 2),                                // adenine
  P('M26 30 L33 27 L38 32 L33 39 L26 37 Z', 'ik'),        // ribose
  ...[0, 1, 2].map(i => C(40 + i * 6, 40 + i * 2, 5, CPK.P)),
  S('M38 34 L40 40 L46 42 L52 44', 'ik', 2.2),
]);

def('membrane', () => [                                   // a bilayer, in section
  ...Array.from({ length: 9 }, (_, i) => {
    const x = 8 + i * 5.6;
    return [C(n(x), 22, 3.4, 'bs'), S(`M${n(x)} 25 L${n(x)} 30`, 'lo', 1.8),
            C(n(x), 42, 3.4, 'bs'), S(`M${n(x)} 39 L${n(x)} 34`, 'lo', 1.8)];
  }).flat(),
]);

def('cell', () => [                                       // cut open, per the rule
  C(30, 32, 20, 'lo'), C(30, 32, 17.5, 'bs'),
  C(25, 28, 7, 'living-lo'),                              // nucleus
  C(38, 38, 3.6, 'hi'), C(20, 38, 2.8, 'hi'), C(36, 24, 2.4, 'hi'),
  // The wall is drawn as a broken ring, so it reads as a section rather than
  // as a ball. A closed arc across the middle read as a handle.
  ...[[200, 320], [340, 40], [60, 160]].map(([a, b]) => S(
    `M${n(30 + 20 * Math.cos(a * Math.PI / 180))} ${n(32 + 20 * Math.sin(a * Math.PI / 180))} ` +
    `A20 20 0 0 1 ${n(30 + 20 * Math.cos(b * Math.PI / 180))} ${n(32 + 20 * Math.sin(b * Math.PI / 180))}`,
    'hi', 2)),
]);

def('enzyme', () => [                                     // a protein with a cleft
  ...[[24, 28, 11], [40, 32, 9], [28, 42, 8]].map(([x, y, r]) => C(x, y, r, 'lo')),
  ...[[24, 28, 8], [40, 32, 6.4], [28, 42, 5.4]].map(([x, y, r]) => C(x, y, r, 'bs')),
  P('M30 22 Q36 30 30 36 Q26 30 30 22 Z', 'ground'),      // the active site
  C(30, 29, 2.6, 'discovery'),                            // the substrate, held
]);

def('alpha_helix', () => [                               // a spring, seen side on
  ...[0, 1].map(k => S(
    Array.from({ length: 17 }, (_, i) =>
      `${i ? 'L' : 'M'}${n(30 + 13 * Math.sin(i * 0.78))} ${n(6 + i * 2.9)}`).join(' '),
    k ? 'hi' : 'bs', k ? 2 : 4.4)),
  // the hydrogen bonds that hold it: residue n to residue n+4
  ...[0, 1, 2, 3].map(i => S(`M20 ${n(14 + i * 9)} L40 ${n(14 + i * 9)}`, 'gh', 1.4)),
]);

def('beta_sheet', () => [                                // pleated, strands side by side
  ...[0, 1, 2].map(k => S(
    Array.from({ length: 8 }, (_, i) =>
      `${i ? 'L' : 'M'}${n(6 + i * 5.6)} ${n(18 + k * 12 + (i % 2 ? 4 : -4))}`).join(' '),
    k === 1 ? 'hi' : 'bs', 3.4)),
  // hydrogen bonds across the gap — the thing that holds a sheet together
  ...[0, 1].map(k => Array.from({ length: 4 }, (_, i) =>
    S(`M${n(11 + i * 11)} ${n(22 + k * 12)} L${n(11 + i * 11)} ${n(26 + k * 12)}`, 'gh', 1.4))).flat(),
  // Each strand ends in an arrowhead: the convention is that a sheet runs N to C.
  ...[0, 1, 2].map(k => P(
    `M${n(45.2)} ${n(18 + k * 12 - 4 - 4.5)} L${n(56)} ${n(18 + k * 12 - 4)} ` +
    `L${n(45.2)} ${n(18 + k * 12 - 4 + 4.5)} Z`, k === 1 ? 'hi' : 'bs')),
]);

def('ribosome', () => [                                  // two subunits, message between
  P('M12 12 Q30 4 48 14 Q54 24 46 29 L14 29 Q6 24 12 12 Z', 'lo'),        // large subunit
  P('M16 35 Q30 31 44 35 Q50 42 40 47 Q24 49 18 43 Q12 39 16 35 Z', 'bs'), // small subunit
  S('M4 32 L56 32', 'ik', 2.4),                          // the message, threaded between them
  ...[10, 20, 30, 40, 50].map(x => C(x, 32, 1.9, 'discovery')),   // codons going past
  C(24, 18, 3.6, 'hi'), C(37, 20, 2.6, 'hi'), C(31, 41, 2.6, 'hi'),
]);

def('messenger_rna', () => [                             // one strand, not two, with bases
  S(Array.from({ length: 17 }, (_, i) =>
      `${i ? 'L' : 'M'}${n(6 + i * 3)} ${n(30 + 12 * Math.sin(i * 0.62))}`).join(' '), 'bs', 3.4),
  ...Array.from({ length: 6 }, (_, i) => {
    const x = n(9 + i * 8), y = n(30 + 12 * Math.sin(((x - 6) / 3) * 0.62));
    return C(x, y, 3, ['#FF0D0D', '#3050F8', '#FFD030', '#3DFF00'][i % 4]);
  }),
]);

def('penicillin', () => [                                 // the beta-lactam ring
  P('M20 26 L32 26 L32 38 L20 38 Z', 'ik'),
  P('M21.4 27.4 L30.6 27.4 L30.6 36.6 L21.4 36.6 Z', 'bs'),
  ...[0, 1, 2, 3, 4].map(i => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return S(`M32 32 L${n(32 + 12 * Math.cos(a))} ${n(32 + 12 * Math.sin(a))}`, 'ik', 1.8);
  }),
  C(20, 26, 4, CPK.N), C(32, 38, 4, CPK.S),
]);

/* tools ────────────────────────────────────────────────────────────────── */
def('pot',    () => [vessel('bs', 22), S('M14 22 L46 22', 'hi', 3), E(30, 22, 15, 3, 'lo')]);
def('stoneware', () => [vessel('bs', 20), E(30, 20, 15, 3.4, 'lo'), S('M18 30 L42 30', 'hi', 1.4)]);
def('barrel', () => [P('M18 18 Q12 32 18 48 L42 48 Q48 32 42 18 Z', 'bs'),
                     ...[26, 40].map(y => S(`M${y === 26 ? 15 : 15} ${y} Q30 ${y - 2} 45 ${y}`, 'lo', 2.4)),
                     E(30, 18, 12, 3, 'hi')]);
def('glass',  () => [P('M20 18 L40 18 L36 48 L24 48 Z', 'gh'),
                     S('M20 18 L40 18 L36 48 L24 48 Z', 'hi', 2),
                     S('M24 24 L23 42', 'hi', 1.4)]);
def('flint',  () => [facet('lo', .9), facet('bs', .55),
                     S('M14 34 L26 22 M30 20 L40 30', 'hi', 1.6)]);
def('sickle', () => [S('M16 44 Q16 18 44 20', 'hi', 3.4), S('M14 48 L24 40', 'lo', 5)]);
def('lye',    () => [vessel('lo', 24), wave('hi', 34, 3, 12), ...granules('bs', 6, 267, [22, 38, 38, 46])]);
def('soap',   () => [P('M14 28 L46 28 L46 42 L14 42 Z', 'bs'),
                     P('M14 28 L46 28 L46 32 L14 32 Z', 'hi'),
                     ...[[22, 20], [32, 16], [40, 21]].map(([x, y]) => C(x, y, 3.4, 'gh'))]);
def('beeswax', () => [...Array.from({ length: 4 }, (_, i) =>
  hex('bs', 20 + (i % 2) * 14, 28 + Math.floor(i / 2) * 14, 8, 2.6))]);
def('candle', () => [P('M25 24 L35 24 L35 50 L25 50 Z', 'bs'),
                     S('M30 24 L30 18', 'lo', 1.6),
                     P('M30 6 Q36 14 34 20 A5 5 0 0 1 26 20 Q24 14 30 6 Z', 'fire-bs')]);
def('greenhouse', () => [P('M12 46 L12 28 L30 16 L48 28 L48 46 Z', 'gh'),
                         S('M12 46 L12 28 L30 16 L48 28 L48 46 Z', 'hi', 2),
                         S('M30 16 L30 46 M12 28 L48 28', 'hi', 1.4),
                         leaf('plant-bs', 22, 38, .45, -20), leaf('plant-bs', 38, 38, .45, 20)]);
def('corn_dolly', () => [S('M30 50 L30 22', 'grain-bs', 4),
                         S('M18 30 L42 30', 'grain-bs', 3.4),
                         C(30, 18, 6, 'grain-hi'),
                         ...[22, 38].map(x => S(`M${x} 30 L${x} 44`, 'grain-bs', 2.4))]);
def('scarecrow', () => [S('M30 52 L30 20', 'craft-lo', 3.4), S('M14 28 L46 28', 'craft-lo', 3),
                        C(30, 16, 7, 'grain-bs'),
                        P('M20 28 L40 28 L38 42 L22 42 Z', 'dish-bs'),
                        ...[16, 44].map(x => S(`M${x} 28 L${x} 34`, 'grain-hi', 2))]);

/* drinks ───────────────────────────────────────────────────────────────── */
def('tea',    () => [leaf('bs', 24, 32, .7, -30), leaf('lo', 36, 34, .7, 30), leaf('hi', 30, 24, .6, 0)]);
def('brewed_tea', () => [                                  // a wide cup, a handle, a saucer
  P('M18 26 L42 26 L38 42 L22 42 Z', 'bs'),
  S('M18 26 L42 26 L38 42 L22 42 Z', 'craft-hi', 2),
  S('M42 30 Q50 32 42 38', 'craft-hi', 2.4),
  S('M14 46 L46 46', 'craft-hi', 2.4),
  S('M27 20 Q31 15 29 10 M34 21 Q38 17 36 13', 'gh', 1.8)]);
def('grape_juice', () => [                                 // a straight tumbler, grapes above
  P('M22 28 L38 28 L37 50 L23 50 Z', 'bs'),
  S('M21 24 L39 24 L38 50 L22 50 Z', 'craft-hi', 2),
  ...[[26, 12], [34, 12], [30, 18]].map(([x, y]) => C(x, y, 4.4, 'plant-lo'))]);
def('apple_juice', () => [                                 // a tapered glass, an apple above
  P('M23 30 L37 30 L39 50 L21 50 Z', 'bs'),
  S('M22 26 L38 26 L40 50 L20 50 Z', 'craft-hi', 2),
  P('M30 8 Q23 8 22.5 14 Q22 20 30 20 Q38 20 37.5 14 Q37 8 30 8 Z', 'plant-bs'),
  S('M30 8 L30 4', 'plant-lo', 1.8)]);
def('beer',   () => [P('M20 20 L40 20 L38 50 L22 50 Z', 'gh'),
                     P('M22 28 L38 28 L36 48 L24 48 Z', 'bs'),
                     ...[[24, 24, 4], [31, 22, 5], [38, 24, 4]].map(([x, y, r]) => C(x, y, r, 'grain-hi')),
                     S('M20 20 L40 20 L38 50 L22 50 Z', 'craft-hi', 2)]);
def('cider',  () => [                                      // a tankard — handle, not a stem
  P('M20 22 L40 22 L38 50 L22 50 Z', 'bs'),
  S('M19 18 L41 18 L39 50 L21 50 Z', 'craft-hi', 2),
  S('M41 26 Q52 32 41 42', 'craft-hi', 3),
  P('M30 6 Q24 6 23.5 10 Q23 15 30 15 Q37 15 36.5 10 Q36 6 30 6 Z', 'plant-hi')]);
def('wine',   () => [P('M22 14 L38 14 L38 26 Q38 34 30 34 Q22 34 22 26 Z', 'gh'),
                     P('M23 22 L37 22 L37 26 Q37 33 30 33 Q23 33 23 26 Z', 'bs'),
                     S('M30 34 L30 46 M22 46 L38 46', 'craft-hi', 2.4),
                     S('M22 14 L38 14 L38 26 Q38 34 30 34 Q22 34 22 26 Z', 'craft-hi', 2)]);
def('mead',   () => [                                      // a horn, because it is mead
  P('M10 20 Q34 18 48 40 Q44 48 36 46 Q18 38 10 20 Z', 'craft-hi'),
  P('M14 23 Q34 23 44 40 Q40 44 35 42 Q20 36 14 23 Z', 'bs'),
  ...Array.from({ length: 3 }, (_, i) => hex('grain-lo', 16 + i * 7, 10, 4.4, 1.6))]);
def('mead_must', () => [vessel('lo'), wave('bs', 34, 4, 12), C(30, 28, 3.4, 'grain-hi')]);
def('honey',  () => [...Array.from({ length: 3 }, (_, i) => hex('grain-lo', 20 + i * 10, 26, 7, 2.4)),
                     P('M20 34 Q30 52 40 34 Q30 42 20 34 Z', 'bs')]);
def('cane_juice', () => [vessel('lo', 28), wave('bs', 38, 4, 12),
                         P('M26 8 L34 8 L34 26 L26 26 Z', 'plant-bs'),    // the cane, pressed
                         S('M26 14 L34 14 M26 20 L34 20', 'plant-lo', 1.6)]);
def('sugar',  () => [...Array.from({ length: 5 }, (_, i) =>
  P(`M${16 + i * 7} ${30 + (i % 2) * 8} l5 0 l0 5 l-5 0 Z`, i % 2 ? 'hi' : 'bs'))]);
def('caramel', () => [facet('lo', .8), facet('bs', .5),   // set hard — a shard, not a syrup
                      S('M18 24 L26 40', 'hi', 1.6)]);
def('malt_vinegar', () => [vessel('lo', 22), wave('bs', 34, 4, 11), wave('lo', 30, 3, 10)]);
def('aged_wine', () => [P('M24 12 L36 12 L38 40 Q38 48 30 48 Q22 48 22 40 Z', 'lo'),
                        P('M25 24 L35 24 L36 40 Q36 46 30 46 Q24 46 24 40 Z', 'bs'),
                        P('M25 30 L35 30 L35 34 L25 34 Z', 'craft-hi')]);
def('salt_fish', () => [P('M12 32 Q26 22 42 32 Q26 42 12 32 Z', 'hi'),
                        P('M42 32 L52 26 L52 38 Z', 'hi'),
                        ...granules('bs', 8, 277, [18, 27, 40, 38])]);
def('cured_meat', () => [P('M16 26 Q30 18 44 26 Q48 38 38 46 Q26 50 18 42 Z', 'lo'),
                         ...granules('hi', 7, 287, [22, 28, 40, 42])]);
def('bacon', () => [...[26, 34, 42].map(y => [
  S(`M12 ${y} Q24 ${y - 4} 30 ${y} Q38 ${y + 4} 48 ${y}`, 'bs', 5),
  S(`M12 ${y} Q24 ${y - 4} 30 ${y} Q38 ${y + 4} 48 ${y}`, 'hi', 1.8)]).flat()]);

/* folklore — no accession, no source. The absence is the lesson. ───────── */
def('philosopher_stone', () => [facet('lo'), facet('bs', .66), facet('hi', .3),
                                ...[0, 90, 180, 270].map(a => S(`M${n(30 + 24 * Math.cos(a * Math.PI / 180))} ${n(30 + 24 * Math.sin(a * Math.PI / 180))} L${n(30 + 30 * Math.cos(a * Math.PI / 180))} ${n(30 + 30 * Math.sin(a * Math.PI / 180))}`, 'gh', 1.6))]);
def('stone_soup', () => [round('lo', 40, 21, 9), wave('bs', 36, 4, 15), facet('craft-bs', .38)]);
def('cornucopia', () => [P('M46 22 Q26 20 16 34 Q12 44 22 46 Q34 46 40 36 Q46 28 46 22 Z', 'lo'),
                         C(42, 26, 5, 'grain-bs'), C(34, 32, 5, 'plant-bs'), C(27, 39, 4.4, 'fire-bs')]);
def('ambrosia', () => [P('M22 16 L38 16 L38 28 Q38 36 30 36 Q22 36 22 28 Z', 'gh'),
                       P('M23 22 L37 22 L37 28 Q37 35 30 35 Q23 35 23 28 Z', 'bs'),
                       S('M30 36 L30 46 M22 46 L38 46', 'hi', 2.4),
                       ...[0, 120, 240].map(a => C(n(30 + 20 * Math.cos(a * Math.PI / 180)), n(20 + 20 * Math.sin(a * Math.PI / 180)), 2, 'gh'))]);
def('manna',  () => [...granules('hi', 20, 297, [12, 20, 48, 44]),
                     ...granules('gh', 10, 307, [10, 16, 50, 48])]);
def('golden_egg', () => [P('M30 14 Q45 25 43 38 A14 14 0 0 1 17 38 Q15 25 30 14 Z', 'grain-bs'),
                         P('M25 24 Q21 32 24 40', 'grain-hi'),
                         ...[0, 120, 240].map(a => C(n(30 + 22 * Math.cos(a * Math.PI / 180)), n(30 + 22 * Math.sin(a * Math.PI / 180)), 1.8, 'gh'))]);

/* ── the six verbs ────────────────────────────────────────────────────────
 * A process is an ingredient, so it gets drawn like one. These are marks
 * rather than objects: a verb is an action, and an action has no silhouette.
 */
const VERB = {
  wait: () => [                                          // an hourglass, half run
    S('M18 12 L42 12 M18 48 L42 48', 'ik', 3),
    P('M20 14 L40 14 L32 30 L40 46 L20 46 L28 30 Z', 'gh'),
    S('M20 14 L40 14 L32 30 L40 46 L20 46 L28 30 Z', 'ik', 2.2),
    P('M22 42 L38 42 L32 32 L28 32 Z', 'ik'),
    C(30, 24, 1.8, 'ik'),
  ],
  crush: () => [                                         // a pestle, mid-strike
    S('M30 8 L30 26', 'ik', 5), C(30, 28, 5, 'ik'),
    P('M14 38 Q30 32 46 38 Q44 50 30 50 Q16 50 14 38 Z', 'gh'),
    S('M14 38 Q30 32 46 38 Q44 50 30 50 Q16 50 14 38 Z', 'ik', 2.2),
  ],
  chill: () => [                                         // a six-fold crystal
    ...[0, 60, 120].map(a => S(
      `M${n(30 - 20 * Math.cos(a * Math.PI / 180))} ${n(30 - 20 * Math.sin(a * Math.PI / 180))} ` +
      `L${n(30 + 20 * Math.cos(a * Math.PI / 180))} ${n(30 + 20 * Math.sin(a * Math.PI / 180))}`, 'ik', 2.4)),
    ...[0, 60, 120, 180, 240, 300].map(a => S(
      `M${n(30 + 12 * Math.cos(a * Math.PI / 180))} ${n(30 + 12 * Math.sin(a * Math.PI / 180))} ` +
      `L${n(30 + 17 * Math.cos((a + 22) * Math.PI / 180))} ${n(30 + 17 * Math.sin((a + 22) * Math.PI / 180))}`, 'ik', 1.8)),
  ],
  heat: () => [                                          // rising heat, not a flame
    ...[0, 1, 2].map(i => S(
      `M${16 + i * 14} 48 Q${11 + i * 14} 38 ${16 + i * 14} 30 Q${21 + i * 14} 22 ${16 + i * 14} 12`, 'ik', 3)),
  ],
  cut: () => [                                           // a blade edge and its line
    P('M10 34 L40 20 L46 28 L14 40 Z', 'gh'),
    S('M10 34 L40 20 L46 28 L14 40 Z', 'ik', 2.2),
    S('M10 34 L46 28', 'ik', 2.6),
    S('M18 48 L48 44', 'gh', 2),
  ],
  ferment: () => [                                       // gas coming out of solution
    S('M14 50 Q30 46 46 50', 'ik', 2.4),
    ...[[22, 38, 5], [32, 30, 6.4], [40, 40, 4], [28, 18, 4.4], [44, 24, 3]]
      .map(([x, y, r]) => [C(x, y, r, 'gh'), ring('ik', x, y, r, 1.8)]).flat(),
  ],
};

/* ── fallback ─────────────────────────────────────────────────────────────
 * Anything not yet drawn by hand gets a constructed form derived from its id
 * and category. It is deterministic, so an item looks the same every session,
 * and it is built from the same kit as everything else — so it reads as part
 * of the set rather than as a missing asset. It is still a placeholder, and
 * `node tools/art.mjs check` says exactly how many remain.
 */

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

const FAMILY = {
  mineral:  id => [facet('lo', .95), facet('bs', .6), ...granules('hi', 4, hash(id), [20, 26, 40, 38])],
  craft:    id => [P('M16 24 L44 24 L44 44 L16 44 Z', 'lo'), P('M20 28 L40 28 L40 40 L20 40 Z', 'bs')],
  grain:    id => [mound('bs', 46, 19, 17), ...granules('hi', 8, hash(id), [16, 32, 44, 46])],
  dish:     id => [round('lo', 40, 21, 9), E(30, 34, 13, 8, 'bs'), E(26, 31, 5, 3, 'hi')],
  ferment:  id => [vessel('lo'), wave('bs', 34, 4, 12), wave('hi', 30, 3, 11)],
  plant:    id => [stalk('lo', 30, 52, 20), leaf('bs', 22, 32, .7, -40), leaf('hi', 38, 32, .7, 40)],
  living:   id => [C(30, 32, 16, 'lo'), C(30, 32, 12, 'bs'), C(25, 27, 4.4, 'hi')],
  water:    id => [wave('lo', 42), wave('bs', 34), wave('hi', 26)],
  fire:     id => [flame('lo'), flame('bs', .68, 4)],
  molecule: id => {
    const { pts, shape } = backbone('ik', 3, 30, 32);
    return [shape, ...pts.map((p, i) => C(p[0], p[1], 4, i % 2 ? 'bs' : 'hi'))];
  },
};

/* ── build ────────────────────────────────────────────────────────────────*/

const out = {};
const missing = [];

for (const el of elements) {
  const cat = categoryOf(el);
  if (ART[el.id]) {
    out[el.id] = { c: cat, s: ART[el.id](), drawn: 1 };
  } else {
    out[el.id] = { c: cat, s: FAMILY[cat](el.id), drawn: 0 };
    missing.push(`${el.id} (${cat})`);
  }
}

/* Sanity: no shape may reference a role we cannot resolve. */
const ROLES = new Set(['lo', 'bs', 'hi', 'ik', 'gh', 'ground', 'discovery']);
const CATS = new Set(['mineral', 'craft', 'grain', 'dish', 'ferment', 'plant', 'living', 'water', 'fire', 'molecule']);
const badRoles = new Set();
const checkRole = r => {
  if (typeof r !== 'string') return;
  if (r.startsWith('#') || ROLES.has(r)) return;
  const [c, sub] = r.split('-');
  if (CATS.has(c) && ROLES.has(sub)) return;
  badRoles.add(r);
};
const walk = shapes => shapes.forEach(s => {
  if (!Array.isArray(s)) return;
  if (s[0] === 'g') return walk(s[4] || []);
  checkRole(s[s[0] === 'c' ? 4 : s[0] === 'e' ? 5 : 2]);
});
for (const v of Object.values(out)) walk(v.s);

const drawn = elements.length - missing.length;
console.log(`  ${drawn}/${elements.length} items drawn by hand, ${missing.length} on the family fallback`);

const byCat = {};
for (const [id, v] of Object.entries(out)) {
  byCat[v.c] = byCat[v.c] || { drawn: 0, total: 0 };
  byCat[v.c].total++; if (v.drawn) byCat[v.c].drawn++;
}
for (const [c, v] of Object.entries(byCat).sort((a, b) => b[1].total - a[1].total)) {
  const bar = '#'.repeat(Math.round((v.drawn / v.total) * 20)).padEnd(20, '.');
  console.log(`    ${c.padEnd(9)} ${bar} ${v.drawn}/${v.total}`);
}

if (badRoles.size) {
  console.error(`\n  unresolvable roles: ${[...badRoles].join(', ')}`);
  process.exit(1);
}

/* ── sameness check ───────────────────────────────────────────────────────
 * The way a 226-item set dies is not by any one item being bad. It is by
 * forty of them quietly becoming the same vessel with a different label. So
 * we measure it: reduce each item to a coarse structural fingerprint and
 * report any pair inside a category that is too close.
 */
function fingerprint(shapes) {
  const parts = [];
  const walk = arr => arr.forEach(s => {
    if (!Array.isArray(s)) return;
    if (s[0] === 'g') return walk(s[4] || []);
    const q = v => Math.round(v / 6);                    // 6-unit buckets
    if (s[0] === 'c') parts.push(`c${q(s[1])},${q(s[2])},${q(s[3])}`);
    else if (s[0] === 'e') parts.push(`e${q(s[1])},${q(s[2])},${q(s[3])},${q(s[4])}`);
    else parts.push(s[0] + s[1].replace(/[\d.]+/g, m => q(+m)));
  });
  walk(shapes);
  return parts.sort();
}

function similarity(a, b) {
  const A = new Set(a), B = new Set(b);
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return (2 * hit) / (A.size + B.size);
}

function samenessReport() {
  const fp = {};
  for (const [id, v] of Object.entries(out)) fp[id] = { c: v.c, f: fingerprint(v.s) };
  const ids = Object.keys(fp);
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (fp[ids[i]].c !== fp[ids[j]].c) continue;
      const sim = similarity(fp[ids[i]].f, fp[ids[j]].f);
      if (sim >= 0.72) pairs.push([sim, ids[i], ids[j], fp[ids[i]].c]);
    }
  }
  pairs.sort((a, b) => b[0] - a[0]);
  return pairs;
}

const same = samenessReport();
if (same.length) {
  console.log(`\n  ${same.length} pair(s) too alike to tell apart at shelf size:`);
  for (const [sim, a, b, c] of same.slice(0, 40)) {
    console.log(`    ${(sim * 100).toFixed(0)}%  ${c.padEnd(9)} ${a}  ~  ${b}`);
  }
  if (same.length > 40) console.log(`    ... and ${same.length - 40} more`);
} else {
  console.log('\n  no two items in a category are too alike');
}

if (process.argv[2] === 'check') {
  if (missing.length) console.log(`\n  still to draw:\n    ${missing.join('\n    ')}`);
  process.exit(same.length ? 1 : 0);
}

/* Strip the authoring flag; the game only needs category and shapes. */
const ship = {};
for (const [id, v] of Object.entries(out)) ship[id] = { c: v.c, s: v.s };
for (const [id, fn] of Object.entries(VERB)) ship['verb_' + id] = { c: 'craft', s: fn() };

/* Interface marks. The gear and the stack render as full-colour emoji on some
   platforms and as text glyphs on others, which is exactly the inconsistency
   leaving emoji behind was meant to end. */
ship.ui_settings = { c: 'craft', s: [
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return S(`M${n(30 + 13 * Math.cos(a))} ${n(30 + 13 * Math.sin(a))} ` +
             `L${n(30 + 21 * Math.cos(a))} ${n(30 + 21 * Math.sin(a))}`, 'ik', 5);
  }),
  C(30, 30, 15, 'ik'), C(30, 30, 6.5, 'ground'),
] };
ship.ui_tidy = { c: 'craft', s: [
  S('M12 20 L48 20', 'ik', 4), S('M12 30 L48 30', 'ik', 4), S('M12 40 L40 40', 'ik', 4),
] };

/* One water MOLECULE, not a body of water. It is what leaves in a condensation
   reaction, and the whole point of showing it is that it is a molecule. */
ship.mol_water = { c: 'molecule', s: [
  S('M30 34 L16 22', 'ik', 3), S('M30 34 L44 22', 'ik', 3),
  C(30, 34, 11, CPK.O), C(16, 22, 6.5, CPK.H), C(44, 22, 6.5, CPK.H),
] };

writeFileSync(join(root, 'data/art.json'), JSON.stringify(ship) + '\n');
const kb = (JSON.stringify(ship).length / 1024).toFixed(1);
console.log(`\n  wrote data/art.json — ${kb} kB`);
