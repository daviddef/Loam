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
  K: '#8F40D4', Mg: '#8AFF00', He: '#D9FFFF', Ne: '#B3E3F5',
  F: '#90E050', Xe: '#429EB0', Kr: '#5CB8D1',
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
  'hydrogen_gas', 'oxygen_gas', 'helium', 'neon',
  // The twenty. They are molecules, whatever the tag says about where they
  // come from — the same reason cysteine and amino_acid are already here.
  'glycine', 'alanine', 'valine', 'leucine', 'isoleucine', 'proline',
  'phenylalanine', 'tyrosine', 'tryptophan', 'serine', 'threonine',
  'methionine', 'asparagine', 'glutamine', 'aspartic_acid', 'glutamic_acid',
  'lysine', 'arginine', 'histidine',
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
  metal: 'mineral',
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
// A second def() for the same id silently replaces the first, and the loser is
// invisible — the file still parses, the item still draws, and the drawing you
// are looking at is not the one you edited. That cost a genuinely confusing
// half hour when ribose and deoxyribose kept coming back identical no matter
// how differently they were redrawn.
const def = (id, fn) => {
  if (ART[id]) { console.error(`  ✗ "${id}" is defined twice — the later one silently wins`); process.exitCode = 1; }
  ART[id] = fn;
};

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

/* metal-bearing rock — new mineral intermediates the metal branch stands on */
def('quicklime', () => [                                 // burnt lime: porous, chalky, hungry for water
  P('M14 40 Q12 26 24 22 Q38 18 44 28 Q48 38 38 46 Q24 50 14 40 Z', 'hi'),
  ...granules('lo', 6, 449, [20, 28, 40, 42]),
  S('M18 30 Q30 26 42 32', 'bs', 1.4),
]);
def('ore',      () => [facet('lo', .95), facet('bs', .6),
                       ...granules('hi', 7, 41, [16, 24, 44, 40])]);
def('cinnabar', () => [facet('lo'), facet('bs', .62),
                       S('M16 40 L44 20', 'hi', 2.2)]);
def('rutile',   () => [                                  // a single prismatic grain, not a rock
  P('M22 38 L27 16 L32 15 L38 36 L33 44 L26 44 Z', 'bs'),
  S('M25 34 L30 20', 'hi', 1.6),
]);

/* metal — opaque and reflective, never faceted like a crystal. The one
   shared signature across the family is a bright glint; everything else
   about the silhouette is where each metal earns its own shape. */
def('iron', () => [                                       // a spongy bloomery bloom, pitted
  P('M14 34 Q12 22 26 18 Q40 14 46 26 Q50 36 40 44 Q28 50 18 44 Q12 40 14 34 Z', 'bs'),
  C(22, 26, 3, 'gh'), C(34, 34, 3.4, 'gh'), C(28, 40, 2.6, 'gh'),
  S('M18 22 L26 30', 'hi', 2),
]);
def('copper', () => [E(30, 32, 19, 15, 'bs'), E(24, 26, 7, 4, 'hi')]);   // smooth native nugget
def('gold', () => [                                       // an asymmetric panned nugget
  P('M16 36 Q14 24 24 20 Q34 16 42 24 Q48 30 42 38 Q36 46 26 44 Q18 42 16 36 Z', 'bs'),
  C(26, 26, 3.6, 'hi'), C(36, 32, 2.4, 'hi'),
]);
def('silver', () => [C(30, 32, 13, 'bs'), C(25, 27, 4, 'hi')]);          // a cupellation bead
def('tin', () => [                                         // cast ingot, low melt = rounded corners
  P('M18 22 L42 22 Q46 22 46 26 L46 40 Q46 44 42 44 L18 44 Q14 44 14 40 L14 26 Q14 22 18 22 Z', 'bs'),
  S('M18 26 L18 40', 'hi', 2.2),
]);
def('lead', () => [                                         // dense, and deliberately dull
  E(30, 32, 18, 15, 'lo'), E(30, 32, 15, 12, 'bs'), S('M24 28 L28 31', 'hi', 1.2),
]);
def('zinc', () => [                                         // distilled plates, stacked
  P('M16 24 L44 20 L44 28 L16 32 Z', 'bs'),
  P('M18 32 L46 28 L46 36 L18 40 Z', 'lo'),
  P('M20 40 L48 36 L48 44 L20 48 Z', 'bs'),
  S('M20 26 L40 23', 'hi', 1.6),
]);
def('mercury', () => [                                      // liquid: a bead, and one rolling away
  C(30, 34, 12, 'bs'), C(25, 29, 3.4, 'hi'),
  C(44, 42, 3.5, 'bs'), C(42.5, 40.5, 1, 'hi'),
]);
def('aluminum', () => [                                     // sharp, uniform, modern
  P('M16 24 L44 24 L44 42 L16 42 Z', 'bs'), S('M16 24 L44 24', 'hi', 2.4), S('M20 28 L20 38', 'ik', 1),
]);
def('nickel', () => [                                       // the ore-mimic: angular, one fleck
  P('M18 30 L28 16 L44 22 L46 38 L32 48 L16 42 Z', 'bs'), S('M24 26 L30 34', 'hi', 1.8), C(36, 30, 2.2, 'gh'),
]);
def('chromium', () => [                                     // a reduced powder, nothing solid at all
  ...granules('bs', 10, 613, [16, 20, 44, 44]), ...granules('hi', 4, 271, [20, 24, 40, 40]),
]);
def('titanium', () => [                                     // the Kroll-process sponge
  P('M16 26 Q14 18 24 16 Q38 12 46 22 Q50 30 44 40 Q36 48 24 46 Q14 42 16 32 Z', 'bs'),
  C(24, 24, 2.6, 'gh'), C(34, 22, 2.2, 'gh'), C(38, 34, 2.8, 'gh'), C(26, 38, 2.4, 'gh'), C(30, 30, 2, 'gh'),
  S('M20 20 L26 26', 'hi', 1.6),
]);
def('platinum', () => [                                     // sintered river grains, fused
  C(24, 30, 8, 'bs'), C(36, 26, 7, 'bs'), C(33, 38, 7.5, 'bs'), C(21, 27, 2, 'hi'), C(34, 23, 1.8, 'hi'),
]);
def('uranium', () => [                                      // heavy and blocky, plainly drawn
  P('M16 22 L44 22 L48 34 L38 48 L20 46 L14 32 Z', 'bs'), S('M20 26 L26 20', 'hi', 1.8), C(34, 36, 2.4, 'gh'),
]);

/* mineral — batch additions: fuel and casting, either side of the blast furnace */
def('coke', () => [                                          // coal, driven past 1,000°C — carbon left behind, porous
  P('M12 44 L18 20 L30 14 L46 22 L48 44 L34 50 L20 50 Z', 'ik'),
  ...[[20, 32], [30, 26], [38, 36], [26, 42]].map(([x, y]) => C(x, y, 2.6, 'ground')),
]);
def('pig_iron', () => [                                       // one channel — the sow — feeding the small casts beside it
  S('M10 44 L50 44', 'bs', 4),
  ...[16, 26, 36, 46].map(x => P(`M${x - 4} 44 L${x - 4} 32 L${x + 4} 32 L${x + 4} 44 Z`, 'lo')),
]);

/* the reagents — reactive metals, drawn as what they are used AS: a ribbon,
   a turning, a cut bar kept under oil. Never a nugget; you never find these
   lying about, which is the whole reason they had to be made. */
def('magnesium', () => [                                    // the ribbon, and the light it makes
  S('M16 44 Q24 34 22 26 Q20 18 30 14', 'bs', 4),
  ...[0, 72, 144, 216, 288].map(a =>
    S(`M30 14 L${n(30 + 15 * Math.cos((a - 90) * Math.PI / 180))} ${n(14 + 15 * Math.sin((a - 90) * Math.PI / 180))}`, 'hi', 1.8)),
  C(30, 14, 5, 'hi'),
]);
def('calcium', () => [                                      // a turned bar, softly cut
  P('M20 18 L40 18 L40 44 L20 44 Z', 'bs'),
  S('M20 18 L40 18', 'hi', 2.6), S('M24 24 L24 40 M30 24 L30 40', 'lo', 1.2),
]);
def('sodium', () => [                                       // a cut cube kept under oil
  P('M18 22 L42 22 L42 44 L18 44 Z', 'lo'),
  P('M18 22 L42 22 L38 30 L22 30 Z', 'bs'),
  S('M22 34 L34 34', 'hi', 1.6),
]);
def('potassium', () => [                                    // same family, but the lilac flame
  P('M20 26 L40 26 L40 46 L20 46 Z', 'lo'),
  P('M20 26 L40 26 L36 33 L24 33 Z', 'bs'),
  P('M30 6 Q35 14 33 20 A4 4 0 0 1 27 20 Q25 14 30 6 Z', 'hi'),
]);
def('yellowcake', () => [                                   // a drum of powder, not a metal
  P('M16 24 Q30 20 44 24 L44 46 Q30 50 16 46 Z', 'bs'),
  E(30, 24, 14, 4.5, 'hi'),
  ...granules('lo', 7, 907, [20, 30, 40, 42]),
]);

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
// The atom and the gas are drawn in the same language as everywhere else in
// the molecular tier: a lone sphere is a lone atom; two bonded spheres are the
// molecule. Splitting hydrogen and oxygen into an atom tier and a gas tier
// (25 Aug) is what makes that distinction actually mean something here — the
// atom used to BE this double/single-bond drawing under the atom's name,
// which drew a molecule and called it an element.
def('oxygen',   () => [C(30, 30, 16, CPK.O), C(25, 25, 5.5, '#FF8A6E')]);   // a lone O atom
def('hydrogen', () => [C(30, 30, 13, CPK.H), C(26, 26, 4.4, '#DADADA')]);   // a lone H atom
def('oxygen_gas', () => [...double([20, 30], [40, 30], 'ik'),        // O=O, a double bond
                         C(20, 30, 8.5, CPK.O), C(40, 30, 8.5, CPK.O)]);
def('hydrogen_gas', () => [S('M25 30 L35 30', 'ik', 2.6),            // H-H, one short bond
                           C(25, 30, 5.5, CPK.H), C(35, 30, 5.5, CPK.H)]);
def('carbon_dioxide', () => [S('M14 30 L46 30', 'ik', 3),
                             C(14, 30, 7.5, CPK.O), C(46, 30, 7.5, CPK.O), C(30, 30, 9, CPK.C)]);
// Noble gases never bond — nothing reaches out from them the way a stick
// does from hydrogen or oxygen. A thin closed ring stands for the full
// electron shell that makes them inert, which is also what keeps the
// silhouette from just being a recoloured bare atom.
def('helium', () => [
  ring('gh', 30, 30, 18, 1.4), C(30, 30, 9, CPK.He),
  ...[45, 135, 225, 315].map(a => C(n(30 + 18 * Math.cos(a * Math.PI / 180)), n(30 + 18 * Math.sin(a * Math.PI / 180)), 2.6, 'hi')),
]);
def('neon', () => [
  ring('gh', 30, 30, 20, 1.6), C(30, 30, 10, CPK.Ne),
  ...[0, 60, 120, 180, 240, 300].map(a => C(n(30 + 20 * Math.cos(a * Math.PI / 180)), n(30 + 20 * Math.sin(a * Math.PI / 180)), 2.4, 'hi')),
]);

/* fire ─────────────────────────────────────────────────────────────────── */
def('spark',  () => [...[0, 60, 120, 180, 240, 300].map(a =>
  S(`M30 30 L${n(30 + 18 * Math.cos(a * Math.PI / 180))} ${n(30 + 18 * Math.sin(a * Math.PI / 180))}`, 'bs', 2.4)),
  C(30, 30, 6, 'hi')]);
def('fire',   () => [flame('lo'), flame('bs', .72, 4), flame('hi', .4, 9)]);
def('charcoal', () => [facet('lo'), facet('ik', .55),
                       ...granules('bs', 4, 33, [20, 26, 40, 36])]);
def('phosphorus_sesquisulfide', () => [                   // red phosphorus and sulfur, melted together above 450 K
  P('M25 40 L25 54 L35 54 L35 40 Z', 'lo'),                // the stick
  E(30, 28, 12, 13, 'bs'),                                 // the bulbous head
  C(25, 22, 2, 'hi'), C(35, 24, 1.6, 'hi'), C(30, 18, 1.4, 'hi'),
]);

/* plant ────────────────────────────────────────────────────────────────── */
def('sprout', () => [stalk('bs', 30, 50, 30), leaf('hi', 24, 26, .6, -35), leaf('bs', 36, 26, .6, 35)]);
def('seedling', () => [stalk('bs', 30, 52, 22), leaf('hi', 22, 24, .7, -40), leaf('bs', 38, 24, .7, 40),
                       leaf('hi', 30, 16, .55, 0)]);
def('plant',  () => [stalk('lo', 30, 52, 16), leaf('bs', 20, 30, .9, -50), leaf('hi', 40, 30, .9, 50),
                     leaf('bs', 30, 16, .7, 0)]);
def('tree',   () => [S('M30 52 L30 32', 'lo', 4),
                     E(30, 24, 18, 15, 'lo'), E(28, 22, 14, 11, 'bs'), E(25, 19, 8, 6, 'hi')]);
def('acacia', () => [S('M30 52 L30 26', 'lo', 3),
                     E(30, 20, 26, 6, 'lo'), E(30, 18, 21, 4.5, 'bs'), E(28, 16, 14, 3, 'hi'),
                     S('M12 22 L6 14', 'ik', 1.4), S('M48 22 L54 14', 'ik', 1.4)]);
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
/* the wider animal roster ─────────────────────────────────────────────────
   Same grammar as cow/goat/chicken above: a body ellipse, a head, legs. What
   distinguishes each one is the single true thing the fact line is about —
   the pig's snout, the giraffe's neck, the zebra's stripes — not decoration. */
def('pig',    () => [E(28, 36, 16, 11, 'bs'), C(43, 33, 7, 'bs'),
                     E(49, 34, 3.4, 4, 'lo'),                        // the snout, flat and forward
                     S('M40 26 L38 21 M46 26 L48 21', 'lo', 2),      // ears
                     S('M14 34 Q9 32 11 28', 'lo', 2),               // curl of tail
                     ...[-8, -2, 5, 10].map(dx => S(`M${28 + dx} 45 L${28 + dx} 52`, 'lo', 2.6))]);
def('lard',   () => [P('M16 30 Q30 24 44 30 L44 44 Q30 48 16 44 Z', 'hi'),
                     S('M16 34 Q30 30 44 34', 'gh', 1.6), E(30, 30, 14, 3.4, 'bs')]);
def('sheep',  () => [...[[20, 32], [28, 28], [36, 31], [24, 38], [33, 38]]
                       .map(([x, y]) => C(x, y, 8, 'hi')),           // fleece, as cloud of curls
                     C(44, 34, 6, 'lo'), E(47, 36, 2.6, 2, 'lo'),
                     ...[-6, 0, 6].map(dx => S(`M${28 + dx} 45 L${28 + dx} 52`, 'lo', 2.2))]);
def('wool',   () => [...[[22, 26], [32, 24], [40, 30], [20, 36], [30, 34], [40, 40], [24, 44], [34, 44]]
                       .map(([x, y]) => C(x, y, 7, 'hi')),
                     ...[[26, 30], [34, 38]].map(([x, y]) => C(x, y, 3, 'bs'))]);
def('carded_wool', () => [                                 // every fibre now runs the same way
  P('M10 20 L50 20 L50 44 L10 44 Z', 'hi'),
  ...[16, 22, 28, 34, 40, 46].map(x => S(`M${x} 22 L${x} 42`, 'bs', 1.4))]);
def('felt',   () => [                                       // no thread, no loom — just locked scales
  P('M10 18 L50 18 L50 44 L10 44 Z', 'bs'),
  ...[[16, 24], [26, 30], [36, 26], [44, 34], [20, 38], [32, 40]].map(([x, y]) => C(x, y, 2, 'hi'))]);
def('horse',  () => [E(27, 34, 16, 9, 'bs'),
                     P('M40 32 Q46 24 46 16 L52 16 Q52 28 45 36 Z', 'bs'),   // neck up to head
                     S('M40 28 Q44 18 50 14', 'lo', 3),                       // mane
                     S('M11 32 Q6 38 8 46', 'lo', 2.6),                       // tail
                     ...[-10, -4, 4, 9].map(dx => S(`M${27 + dx} 42 L${27 + dx} 53`, 'lo', 2.4))]);
def('duck',   () => [E(27, 34, 15, 10, 'bs'), C(41, 26, 6.5, 'bs'),
                     P('M46 26 L54 27 L46 30 Z', 'fire-bs'),                  // flat bill
                     wave('water-bs', 48, 4, 22),
                     S('M14 32 Q9 28 12 25', 'lo', 2.2)]);
def('turkey', () => [...Array.from({ length: 7 }, (_, i) => {                 // the fan
                       const a = (-150 + i * 25) * Math.PI / 180;
                       return S(`M26 36 L${n(26 + 22 * Math.cos(a))} ${n(36 + 22 * Math.sin(a))}`, 'lo', 3);
                     }),
                     E(30, 38, 12, 10, 'bs'), C(41, 28, 5.5, 'bs'),
                     S('M41 33 Q40 38 43 40', 'fire-bs', 2.2)]);              // wattle
def('wolf',   () => [E(27, 35, 16, 9, 'bs'), C(42, 30, 7, 'bs'),
                     P('M37 24 L39 17 L43 23 Z', 'bs'), P('M45 23 L48 17 L50 24 Z', 'bs'),
                     P('M48 29 L54 31 L48 33 Z', 'lo'),                        // long muzzle
                     S('M11 34 Q4 32 6 25', 'lo', 3),
                     ...[-9, -3, 4, 10].map(dx => S(`M${27 + dx} 43 L${27 + dx} 52`, 'lo', 2.2))]);
def('deer',   () => [E(27, 36, 15, 9, 'bs'), C(41, 29, 6, 'bs'),
                     S('M38 23 Q36 14 30 11 M38 23 Q40 15 45 13', 'lo', 2.2),  // antlers
                     S('M44 23 Q46 15 51 14', 'lo', 2),
                     ...[-8, -2, 5, 10].map(dx => S(`M${27 + dx} 44 L${27 + dx} 53`, 'lo', 2.2))]);
def('bear',   () => [E(29, 36, 18, 13, 'bs'), C(45, 28, 8, 'bs'),
                     C(41, 20, 3.4, 'bs'), C(50, 21, 3.4, 'bs'),               // small round ears
                     E(52, 30, 3, 2.4, 'lo'),
                     ...[-10, 0, 9].map(dx => S(`M${29 + dx} 47 L${29 + dx} 53`, 'lo', 3.4))]);
def('kangaroo', () => [P('M20 46 Q18 30 28 24 Q36 20 38 14 L44 14 Q44 24 36 30 Q30 36 32 46 Z', 'bs'),
                       C(44, 12, 6, 'bs'), S('M41 7 L40 2 M47 7 L49 2', 'lo', 2),
                       S('M18 46 Q6 46 4 38', 'lo', 4),                        // the heavy tail
                       P('M20 46 L36 46 L38 52 L16 52 Z', 'lo')]);             // long foot
def('koala',  () => [C(30, 34, 14, 'bs'), C(18, 26, 7.5, 'hi'), C(42, 26, 7.5, 'hi'),
                     C(18, 26, 4, 'lo'), C(42, 26, 4, 'lo'),
                     E(30, 38, 4.4, 5.4, 'ik'),                                // the big nose
                     C(25, 30, 1.8, 'ik'), C(35, 30, 1.8, 'ik')]);
def('dingo',  () => [E(28, 36, 15, 8.5, 'bs'), C(43, 30, 6.5, 'bs'),
                     P('M39 24 L40 17 L44 23 Z', 'bs'), P('M46 23 L49 17 L51 24 Z', 'bs'),
                     P('M49 29 L55 31 L49 33 Z', 'hi'),
                     S('M13 34 Q6 30 9 24', 'hi', 2.6),
                     ...[-8, -2, 5, 10].map(dx => S(`M${28 + dx} 43 L${28 + dx} 52`, 'lo', 2))]);
def('platypus', () => [E(28, 34, 17, 10, 'bs'),
                       P('M43 30 Q54 30 54 36 Q54 40 43 39 Z', 'lo'),          // the bill
                       C(38, 29, 1.8, 'ik'),
                       P('M11 34 Q2 30 4 42 Q10 42 12 38 Z', 'lo'),            // flat tail
                       wave('water-bs', 49, 4, 22)]);
def('elephant', () => [E(26, 34, 18, 14, 'bs'), C(44, 30, 9, 'bs'),
                       P('M50 32 Q56 40 52 50 Q47 50 48 40 Q48 34 46 33 Z', 'bs'),  // trunk
                       E(38, 30, 8, 10, 'lo'),                                  // the ear
                       S('M50 28 Q56 30 57 34', 'hi', 2),                       // tusk
                       ...[-12, -3, 7].map(dx => S(`M${26 + dx} 46 L${26 + dx} 54`, 'lo', 4))]);
def('lion',   () => [...Array.from({ length: 10 }, (_, i) => {                  // the mane
                       const a = (i * 36) * Math.PI / 180;
                       return C(n(40 + 11 * Math.cos(a)), n(28 + 11 * Math.sin(a)), 5, 'lo');
                     }),
                     E(24, 38, 14, 8, 'bs'), C(40, 28, 8, 'bs'),
                     C(37, 27, 1.6, 'ik'), C(43, 27, 1.6, 'ik'),
                     S('M10 38 Q4 34 7 28', 'lo', 2.4),
                     ...[-8, 0, 8].map(dx => S(`M${24 + dx} 45 L${24 + dx} 52`, 'bs', 2.2))]);
def('zebra',  () => [E(27, 34, 16, 9, 'hi'),
                     ...[-11, -6, -1, 4, 9].map(dx => S(`M${27 + dx} 26 L${27 + dx + 2} 42`, 'ik', 2.6)),
                     C(42, 28, 6.5, 'hi'), S('M40 23 L43 33', 'ik', 2),
                     S('M12 32 Q5 30 7 24', 'ik', 2.4),
                     ...[-9, -3, 4, 10].map(dx => S(`M${27 + dx} 42 L${27 + dx} 52`, 'ik', 2.2))]);
def('giraffe', () => [E(24, 44, 13, 8, 'bs'),
                      P('M28 42 L34 10 L42 10 L38 44 Z', 'bs'),                 // the neck, the point
                      C(40, 8, 5.5, 'bs'), S('M37 3 L36 -1 M43 3 L44 -1', 'lo', 1.8),
                      ...[[30, 18], [33, 26], [29, 32], [22, 42], [30, 46]]
                        .map(([x, y]) => C(x, y, 3.4, 'lo')),                    // patches
                      ...[-7, 0, 7].map(dx => S(`M${24 + dx} 50 L${24 + dx} 56`, 'lo', 2.2))]);
def('camel',  () => [E(26, 38, 16, 8, 'bs'),
                     P('M18 34 Q26 20 34 34 Z', 'bs'),                           // the single hump
                     P('M38 36 Q44 26 44 18 L50 18 Q50 30 43 38 Z', 'bs'),
                     C(48, 16, 5, 'bs'),
                     ...[-9, -3, 5, 10].map(dx => S(`M${26 + dx} 45 L${26 + dx} 54`, 'lo', 2.2))]);

/* living — sharks, rays & the open ocean (chunk-01 batch) ──────────────────
   Nineteen sharks share one torpedo grammar — a body, a dorsal fin, a tail —
   but never the same silhouette. Each one gets the single real trait its
   fact line is about: a whip tail, a hammer head, a pair of barbels, a
   saddle-and-spot pattern, a fin twice the size it should be. Orientation,
   proportion and posture do the rest of the differentiating work: some face
   right, some left, some are mid-leap, some lie flat on the sea floor. */
def('thresher_shark', () => [
  P('M22 28 Q34 22 46 28 Q42 36 30 37 Q22 36 22 28 Z', 'bs'),           // compact torso
  P('M46 28 L54 26 L54 32 Z', 'lo'),                                    // pointed nose
  S('M24 30 Q10 18 2 4', 'lo', 3.6),                                    // the scythe tail — as long as the body
  P('M32 22 L36 14 L38 23 Z', 'lo'),
  C(48, 28, 1.4, 'ik'),
]);
def('goblin_shark', () => [
  P('M8 30 Q20 24 34 30 Q30 38 16 38 Q8 36 8 30 Z', 'bs'),
  P('M34 29 L56 27 L56 31 L34 31 Z', 'lo'),                             // the long flat blade of a snout
  S('M40 33 Q46 40 54 38', 'ik', 2.4),                                  // the jaw, catapulted forward
  P('M18 25 L21 18 L23 25 Z', 'lo'),
  P('M8 30 L1 24 L4 30 L1 36 Z', 'bs'),
  C(15, 29, 1.3, 'ik'),
]);
def('catshark', () => [
  P('M10 40 Q20 35 32 40 Q26 46 16 46 Q10 45 10 40 Z', 'bs'),           // small, low on the canvas
  P('M32 40 L40 38 L40 42 Z', 'lo'),
  P('M10 40 L4 37 L6 40 L4 43 Z', 'bs'),
  E(35, 40, .9, 2, 'ik'),                                               // the vertical cat-slit pupil
  ...granules('lo', 8, 401, [12, 36, 30, 45]),                          // small-spotted
]);
def('tope_shark', () => [
  P('M8 30 Q22 24 40 30 Q34 38 20 38 Q8 36 8 30 Z', 'bs'),              // plain, unmarked, built to migrate
  P('M40 29 L50 28 L50 32 Z', 'lo'),
  P('M8 30 L2 26 L4 30 L2 34 Z', 'bs'),
  P('M20 23 L23 16 L25 23 Z', 'lo'),
  C(43, 30, 1.6, 'hi'),                                                 // a tagged individual
  S('M4 34 Q2 44 8 52 Q14 58 22 56', 'gh', 1.4),                        // Britain to Iceland, one long crossing
]);
def('leopard_shark', () => [
  P('M8 30 Q22 23 42 29 Q36 39 20 39 Q8 37 8 30 Z', 'bs'),
  P('M42 28 L52 27 L52 31 Z', 'lo'),
  P('M8 30 L2 25 L4 30 L2 35 Z', 'bs'),
  ...[[16, 27], [24, 25], [32, 27]].map(([x, y]) => E(x, y, 3.4, 2.2, 'lo')), // dark saddles down the back
  ...granules('lo', 6, 501, [18, 32, 40, 37]),                          // and the spots between them
]);
def('tiger_shark', () => [
  P('M8 28 Q24 20 44 28 Q40 40 22 40 Q8 38 8 28 Z', 'bs'),              // heavy, blunt-bodied
  P('M44 27 L54 26 L54 31 Z', 'lo'),
  P('M8 28 L2 23 L4 28 L2 33 Z', 'bs'),
  P('M24 20 L28 12 L30 21 Z', 'lo'),
  ...[14, 20, 26, 32, 38].map(x => S(`M${x} 23 L${x - 3} 39`, 'ik', 2)), // vertical bars, no two stripes alike
]);
def('lemon_shark', () => [
  P('M8 32 Q22 25 42 32 Q36 42 20 42 Q8 40 8 32 Z', 'bs'),
  P('M42 31 L52 30 L52 34 Z', 'lo'),
  P('M8 32 L2 27 L4 32 L2 37 Z', 'bs'),
  P('M20 25 L23 17 L26 25 Z', 'lo'),                                    // first dorsal
  P('M32 26 L35 19 L37 26 Z', 'lo'),                                    // second dorsal, almost the same size
]);
def('bull_shark', () => [
  E(28, 32, 20, 12, 'bs'),                                              // stocky and broad-bodied
  E(46, 30, 6, 5, 'lo'),                                                // very short, blunt, rounded snout
  P('M8 32 L2 26 L4 32 L2 38 Z', 'bs'),
  P('M24 22 L28 13 L30 23 Z', 'lo'),
  C(48, 28, 1.2, 'ik'),
]);
def('blacktip_shark', () => [
  P('M12 40 Q28 24 44 14 Q40 26 26 34 Q14 42 12 40 Z', 'bs'),           // mid-leap, angled clear of the water
  P('M44 14 L52 10 L50 17 Z', 'lo'),
  P('M28 26 L34 16 L36 25 Z', 'lo'), P('M34 17 L38 12 L37 19 Z', 'ik'), // dorsal, black tip inked in
  P('M12 40 L6 45 L10 39 Z', 'lo'), P('M6 44 L3 48 L8 42 Z', 'ik'),     // tail, black tip inked in
  S('M4 44 Q20 48 36 46', 'water-bs', 1.6),
]);
def('oceanic_whitetip_shark', () => [
  P('M8 32 Q22 26 40 32 Q34 42 18 42 Q8 40 8 32 Z', 'bs'),
  P('M40 31 L50 30 L50 34 Z', 'lo'),
  P('M8 32 L2 27 L4 32 L2 37 Z', 'bs'),
  P('M20 26 Q26 12 34 24 Q28 30 20 26 Z', 'lo'),                        // the huge, rounded, paddle-shaped fin
  E(28, 15, 3, 2, 'hi'),                                                // its mottled white tip
  C(44, 40, 2.2, 'hi'), S('M44 40 L48 42', 'hi', 1),                    // once nicknamed the shipwreck shark
]);
def('silky_shark', () => [
  P('M6 32 Q22 27 46 32 Q40 38 24 38 Q6 36 6 32 Z', 'bs'),              // long, slender, and smooth-skinned
  P('M46 31 L54 30 L54 33 Z', 'lo'),
  P('M6 32 L1 29 L2 32 L1 35 Z', 'bs'),
  P('M22 28 L24 23 L26 28 Z', 'lo'),
  E(30, 12, 6, 2.4, 'gh'), E(40, 15, 5, 2, 'gh'),                       // trailing beneath a school of tuna
]);
def('blacktip_reef_shark', () => [
  ...[[10, 50], [20, 50], [32, 50], [44, 50]].map(([x, y], i) => E(x, y, 5, 4 - (i % 2), 'craft-lo')), // the reef, below
  P('M14 38 Q26 32 40 38 Q34 46 20 46 Q14 44 14 38 Z', 'bs'),           // the most common shark on the reef
  P('M40 37 L48 36 L48 40 Z', 'lo'),
  P('M14 38 L9 34 L11 38 L9 42 Z', 'bs'),
  P('M23 32 L26 25 L28 32 Z', 'lo'), P('M26 26 L28 22 L27 29 Z', 'ik'),
]);
def('grey_reef_shark', () => [
  P('M10 36 Q22 16 40 22 Q46 26 40 34 Q26 44 10 36 Z', 'bs'),           // the stiffened, arched threat display
  P('M40 22 L50 18 L48 26 Z', 'lo'),
  P('M10 36 L4 40 L8 34 Z', 'lo'),
  P('M24 22 L27 12 L30 23 Z', 'lo'),
  S('M18 32 L8 42 M30 30 L26 42', 'gh', 2.4),                           // pectorals, spread flat and wide
]);
def('whitetip_reef_shark', () => [
  S('M4 48 L56 48', 'ground', 1.6),                                     // resting, still, on the sea floor
  P('M8 44 Q24 40 44 44 Q38 48 20 48 Q8 47 8 44 Z', 'bs'),
  P('M44 43 L52 43 L52 45 Z', 'lo'),
  P('M22 40 L25 34 L27 40 Z', 'lo'), C(25, 35, 1.2, 'hi'),               // white-tipped dorsal
  P('M8 44 L3 41 L5 44 L3 47 Z', 'lo'), C(3, 41, 1, 'hi'),               // and white-tipped tail
]);
def('great_hammerhead', () => [
  P('M18 30 Q30 26 46 30 Q40 38 24 38 Q18 36 18 30 Z', 'bs'),
  P('M2 26 L20 28 L20 32 L2 34 Z', 'lo'),                               // the wide flat hammer, squared off
  C(5, 28, 1, 'ik'), C(5, 32, 1, 'ik'),                                 // an eye at either end of it
  P('M28 22 L32 8 L35 23 Z', 'lo'),                                     // a tall dorsal fin
  P('M46 29 L54 28 L54 32 Z', 'bs'),
  E(30, 48, 12, 4, 'gh'),                                                // a stingray, pinned beneath
]);
def('scalloped_hammerhead', () => [
  ...[[10, 18, 1], [30, 30, .72], [42, 42, .56]].map(([x, y, s]) => [
    P(`M${n(x + 6 * s)} ${n(y - 4 * s)} Q${n(x + 14 * s)} ${n(y - 8 * s)} ${n(x + 22 * s)} ${n(y - 4 * s)} Q${n(x + 16 * s)} ${n(y + 2 * s)} ${n(x + 6 * s)} ${n(y + 2 * s)} Z`, 'bs'),
    P(`M${n(x)} ${n(y - 5 * s)} L${n(x + 6 * s)} ${n(y - 7 * s)} L${n(x + 6 * s)} ${n(y - 1 * s)} L${n(x)} ${n(y + 1 * s)} Z`, 'lo'),
  ]).flat(),
  S('M4 12 Q8 8 12 12 Q16 16 20 12', 'ik', 1.4),                        // the scalloped front margin, on the lead one
]);
def('whale_shark', () => [
  P('M4 30 Q22 20 46 26 Q52 30 46 34 Q22 40 4 30 Z', 'bs'),             // the largest fish alive
  P('M4 30 Q0 26 0 30 Q0 34 4 30 Z', 'lo'),                             // and a filter feeder, mouth wide open
  P('M46 27 L54 26 L54 32 L46 33 Z', 'lo'),
  ...[[14, 26], [22, 29], [30, 26], [38, 30], [16, 34], [26, 34]].map(([x, y]) => C(x, y, 1.6, 'hi')), // the checkerboard spots
]);
def('zebra_shark', () => [
  P('M6 32 Q16 27 28 32 Q22 40 12 40 Q6 38 6 32 Z', 'bs'),              // compact body
  P('M28 31 L36 30 L36 34 Z', 'lo'),
  S('M28 32 Q42 26 54 32 Q42 38 28 33', 'bs', 1.6),                     // a tail nearly as long as the body
  ...granules('lo', 9, 601, [8, 34, 26, 39]),                           // the adult, leopard-like spots
]);
def('nurse_shark', () => [
  S('M4 48 L56 48', 'ground', 1.4),
  P('M10 44 Q24 38 40 44 Q34 48 20 48 Q10 47 10 44 Z', 'bs'),           // hunting the muddy floor, by night
  E(44, 43, 6, 4, 'lo'),                                                // the broad, flattened head
  S('M48 45 L54 48 M48 43 L54 41', 'lo', 1.2),                          // the barbels, by the mouth
  P('M10 44 L5 41 L7 44 L5 47 Z', 'bs'), C(38, 42, 1, 'ik'),
]);

def('eagle_ray', () => [
  S('M2 40 Q30 50 58 40', 'water-bs', 1.6),                             // clearing the water
  P('M14 26 Q30 14 46 26 Q30 34 14 26 Z', 'bs'),                        // diamond wings
  P('M30 14 L34 4 L36 14 Z', 'lo'),                                     // a pointed snout, shaped to crush shell
  S('M30 34 Q28 44 22 50', 'lo', 1.8),
  ...[[22, 22], [30, 20], [38, 22]].map(([x, y]) => C(x, y, 1.4, 'hi')), // white spots
]);
def('manta_ray', () => [
  P('M6 32 Q30 16 54 32 Q30 44 6 32 Z', 'bs'),                          // the largest ray alive
  P('M22 18 L18 10 L24 16 Z', 'lo'), P('M38 18 L42 10 L36 16 Z', 'lo'), // the two cephalic horns, by the mouth
  S('M30 40 Q30 50 26 54', 'lo', 1.6),
  C(30, 26, 1.2, 'ik'),
]);
def('orca', () => [
  P('M6 34 Q20 20 40 24 Q52 27 54 34 Q48 42 32 44 Q16 46 6 34 Z', 'lo'), // the largest dolphin alive
  P('M22 34 Q34 30 46 36 Q34 42 22 40 Z', 'hi'),                        // the white belly patch
  E(14, 27, 3, 2, 'hi'),                                                // the white eye patch
  P('M30 22 L32 4 L34 22 Z', 'lo'),                                     // the tall, straight dorsal fin
]);
def('nautilus', () => {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, ang = t * Math.PI * 2.6, rad = 3 + t * 15;
    pts.push([n(24 + rad * Math.cos(ang)), n(28 + rad * Math.sin(ang))]);
  }
  return [
    S('M' + pts.map(p => p.join(' ')).join(' L'), 'bs', 5),             // little changed in hundreds of millions of years
    ...[8, 14, 20].map(i => C(pts[i][0], pts[i][1], 1, 'lo')),          // chamber walls
    ...[-2, -1, 0, 1, 2].map(k => S(`M18 42 L${n(18 + k * 6)} ${n(54 + Math.abs(k))}`, 'gh', 1.6)), // up to 90 tentacles
  ];
});

/* living — octopuses, squid & the drifting stingers (chunk-01 batch) ──────
   Arms hang below a round mantle for the octopuses, but never the same way
   twice — a fan of curls, then suckers on it, then blue rings on it. The
   squid get long tentacles a true octopus never has; the vampire squid gets
   none at all, just one webbed cloak. The cnidarians are drawn by their one
   real shape: a cube bell, a mane of trailing threads, a sail above water
   with the sting hanging below it, a crown of tentacles, a ring of spikes. */
def('octopus', () => [
  C(28, 22, 12, 'bs'),
  ...[-20, -12, -4, 4, 12, 20].map(dx => S(`M${28 + dx * .4} 32 Q${28 + dx} 44 ${28 + dx * .6} 54`, 'lo', 2.4)),
  C(23, 19, 1.4, 'ik'), C(33, 19, 1.4, 'ik'),
]);
def('giant_pacific_octopus', () => [
  C(28, 18, 14, 'bs'),                                                  // the largest octopus species
  ...[-24, -14, -4, 6, 16, 26].map(dx => S(`M${28 + dx * .3} 30 Q${28 + dx} 44 ${28 + dx * .7} 56`, 'lo', 2.6)),
  ...[-24, -14, -4, 6, 16, 26].map(dx => C(n(28 + dx * .6), 40, 1, 'hi')), // suckers, down every arm
  C(22, 15, 1.6, 'ik'), C(34, 15, 1.6, 'ik'),
]);
def('blue_ringed_octopus', () => [
  C(30, 24, 8, 'bs'),                                                   // small, and the most dangerous
  ...[-14, -7, 0, 7, 14].map(dx => S(`M${30 + dx * .5} 30 Q${30 + dx} 38 ${30 + dx * .7} 46`, 'lo', 1.8)),
  ...[[22, 20], [38, 20], [26, 32], [34, 32], [30, 42]].map(([x, y]) => ring('hi', x, y, 2.2, 1)), // the blue rings
  C(26, 22, 1, 'ik'), C(34, 22, 1, 'ik'),
]);
def('giant_squid', () => [
  E(30, 20, 10, 16, 'bs'),                                              // a long torpedo mantle
  P('M22 8 L30 2 L38 8 Z', 'lo'),
  C(24, 24, 4, 'ik'),                                                   // the huge eye, built to watch the dark
  S('M24 34 Q16 46 12 58', 'lo', 2), C(11, 58, 2.2, 'hi'),              // two feeding tentacles, clubbed
  S('M36 34 Q44 46 48 58', 'lo', 2), C(49, 58, 2.2, 'hi'),
  ...[-6, 0, 6].map(dx => S(`M${30 + dx} 34 L${30 + dx} 40`, 'lo', 1.6)), // the shorter fringe of ordinary arms
]);
def('vampire_squid', () => [
  P('M14 20 Q30 10 46 20 Q46 40 30 46 Q14 40 14 20 Z', 'lo'),           // the dark, webbed cloak
  ...[-16, -8, 0, 8, 16].map(dx => S(`M${30 + dx} 20 L${30 + dx * 1.3} 44`, 'ik', 1)), // arms webbed together, not separate
  C(22, 20, 3, 'ik'), C(38, 20, 3, 'ik'),                               // its huge eyes
]);
def('box_jellyfish', () => [
  P('M16 14 L44 14 L44 34 L16 34 Z', 'bs'),                             // a boxy, cube-shaped bell
  S('M18 14 L14 10 M42 14 L46 10 M18 34 L14 38 M42 34 L46 38', 'lo', 1.4), // the cube's far edges
  ...[16, 24, 36, 44].map(x => S(`M${x} 34 Q${x} 46 ${x} 58`, 'gh', 1.6)), // tentacles, from all four corners
]);
def('lions_mane_jellyfish', () => [
  P('M8 16 Q30 4 52 16 Q52 26 30 28 Q8 26 8 16 Z', 'bs'),               // the largest jellyfish species
  S('M8 16 Q30 22 52 16', 'hi', 1.6),
  ...[6, 14, 22, 30, 38, 46, 54].map(x => S(`M${x} 26 Q${x - 2} 40 ${x + 2} 58`, 'gh', 1.4)), // the mane, trailing past 36 m
]);
def('man_o_war', () => [
  S('M2 30 L58 30', 'water-bs', 1.6),                                   // the waterline
  P('M14 28 Q30 6 46 28 Q30 20 14 28 Z', 'hi'),                         // the sail, catching wind above it
  ...[16, 24, 32, 40].map(x => S(`M${x} 30 Q${x - 2} 44 ${x + 2} 58`, 'gh', 1.4)), // a colony of stinging zooids, below
]);
def('sea_anemone', () => [
  P('M18 32 Q18 50 30 50 Q42 50 42 32 Z', 'bs'),                        // one stalked polyp, no stony skeleton
  ...Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30) * Math.PI / 180;
    return S(`M30 32 L${n(30 + 16 * Math.cos(a))} ${n(20 + 8 * Math.sin(a))}`, 'hi', 1.8);
  }),
  C(26, 42, 1.4, 'lo'),                                                 // a clownfish, immune, at home in it
]);
def('crown_of_thorns', () => [
  C(30, 30, 7, 'bs'),
  ...Array.from({ length: 9 }, (_, i) => {
    const a = (i * 40) * Math.PI / 180;
    return P(`M${n(30 + 6 * Math.cos(a))} ${n(30 + 6 * Math.sin(a))} L${n(30 + 22 * Math.cos(a))} ${n(30 + 22 * Math.sin(a))} L${n(30 + 6 * Math.cos(a + .15))} ${n(30 + 6 * Math.sin(a + .15))} Z`, 'lo');
  }),                                                                   // up to 21 venomous, strippping arms
]);

/* living — reef & deep-sea fish, and the cats that came before the cat
   family split (chunk-01 batch) ────────────────────────────────────────── */
def('anglerfish', () => [
  E(24, 32, 16, 14, 'bs'),                                              // a bulbous body, in the permanent dark
  P('M38 30 L52 26 L52 34 Z', 'lo'),
  ...[42, 46, 50].map(x => S(`M${x} 27 L${x} 31 M${x} 33 L${x} 29`, 'ik', 1)),
  S('M22 18 Q22 6 34 4', 'lo', 2),                                      // the lure's stalk, grown from its own fin
  C(35, 4, 3, 'hi'),
]);
def('pink_frogmouth', () => [
  S('M4 48 L56 48', 'ground', 1.4),
  P('M12 30 Q30 20 48 30 Q50 42 30 46 Q10 42 12 30 Z', 'bs'),           // rosy, loose-skinned — a 'sea toad'
  P('M18 36 Q30 44 42 36 Q30 40 18 36 Z', 'lo'),
  C(38, 28, 1.4, 'ik'),
]);
def('psychedelic_frogfish', () => [
  C(30, 28, 15, 'bs'),
  S('M20 24 Q30 18 40 24 Q34 30 26 30 Q22 30 24 34', 'hi', 1.6),        // no two share the same swirling pattern
  S('M18 36 L14 46 M42 36 L46 46 M30 40 L30 50', 'lo', 2.4),            // it walks the sea floor on its fins
]);
def('giant_grouper', () => [
  P('M6 30 Q22 16 42 24 Q52 28 52 32 Q46 42 26 42 Q6 40 6 30 Z', 'bs'), // the largest bony fish on the reef
  P('M42 24 Q50 26 52 30 Q46 34 40 30 Z', 'lo'),                        // big enough to swallow a turtle whole
  ...[[16, 26], [24, 32], [34, 24], [40, 36]].map(([x, y]) => E(x, y, 3, 2, 'lo')), // mottled markings
]);
def('stonefish', () => [
  S('M4 48 L56 48', 'ground', 1.4),
  P('M10 44 Q8 30 22 26 Q34 22 44 30 Q50 38 42 44 Q26 50 10 44 Z', 'bs'), // camouflaged as a lump of rock
  ...granules('lo', 8, 701, [12, 30, 44, 44]),                          // the encrusted texture
  ...[24, 30, 36].map(x => S(`M${x} 26 L${x} 16`, 'ik', 1.8)),          // the most potent venom of any fish alive
]);
def('common_lionfish', () => [
  E(24, 32, 12, 9, 'bs'),
  ...[18, 24, 30].map(x => S(`M${x} 24 L${x} 40`, 'ik', 1.8)),          // the venomous bands
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (-90 + i * 22) * Math.PI / 180;
    return S(`M32 26 L${n(32 + 22 * Math.cos(a))} ${n(26 + 22 * Math.sin(a))}`, 'lo', 1.4); // spines, fanned wide
  }),
]);
def('proailurus', () => [
  S('M6 54 L50 14', 'lo', 3),                                           // at least partly a tree-climber
  E(26, 30, 11, 7, 'bs'),                                               // about the size of a house cat
  C(38, 24, 5, 'bs'),
  S('M17 34 L14 42 M35 33 L37 40', 'lo', 2),                            // legs, gripping the branch
  S('M18 30 Q10 26 12 20', 'lo', 2),
]);
def('pseudaelurus', () => [
  P('M10 40 Q8 28 22 26 Q36 22 46 30 Q48 38 38 42 Q22 46 10 40 Z', 'bs'), // plain, unmarked — the ancestor before the split
  C(41, 27, 6.5, 'bs'),
  S('M13 40 Q6 38 8 32', 'lo', 2.2),
  ...[-7, 1, 9].map(dx => S(`M${24 + dx} 43 L${24 + dx} 50`, 'lo', 2.6)),
]);
def('homotherium', () => [
  P('M10 40 Q10 26 26 24 Q42 22 48 32 Q44 40 30 42 Q16 44 10 40 Z', 'bs'), // robust, sloped high at the shoulder
  C(44, 28, 6, 'bs'),
  S('M46 32 Q48 42 44 46', 'hi', 2.6),                                  // the long, curving sabre
  S('M12 40 Q6 40 6 34', 'lo', 3),                                      // a short, scimitar tail
  ...[-8, 0, 8].map(dx => S(`M${28 + dx} 42 L${28 + dx} 50`, 'lo', 3)),
]);
def('panthera_zdanskyi', () => [
  E(30, 32, 14, 12, 'gh'),                                              // known only from a 2.5-million-year-old skull
  S('M18 28 Q30 20 42 28 Q40 40 30 42 Q20 40 18 28 Z', 'bs'),
  C(35, 30, 5, 'lo'),                                                   // the eye socket
  ...[26, 30, 34].map(x => S(`M${x} 40 L${x} 46`, 'ik', 1.6)),
]);
def('tiger', () => [
  E(27, 36, 17, 10, 'bs'),
  C(43, 30, 7, 'bs'),
  S('M12 36 Q5 34 7 27', 'lo', 2.4),
  ...[16, 22, 28, 34, 40].map(x => S(`M${x} 27 L${x - 3} 44`, 'ik', 2.2)), // no two share the same stripes
  ...[-9, -2, 5, 10].map(dx => S(`M${27 + dx} 45 L${27 + dx} 53`, 'lo', 2.2)),
]);
def('javan_tiger', () => [
  E(28, 38, 14, 8, 'gh'),                                               // faded — declared extinct in 2008
  C(41, 33, 5.5, 'gh'),
  ...[15, 20, 25, 30, 35].map(x => S(`M${x} 32 L${x - 2} 44`, 'lo', 1.6)),
  ...[-7, -1, 4, 8].map(dx => S(`M${28 + dx} 45 L${28 + dx} 51`, 'gh', 1.8)),
]);

/* living — the walk into the sea, and nine dogs since the wolf (chunk-01
   batch) ──────────────────────────────────────────────────────────────────
   pakicetus through llanocetus is one story told in six frames: legs, then
   paddling hind feet, then flippers doing the work instead, then a
   serpentine body with a useless leg-nub, then the first true fluke, then
   teeth where a later whale would grow baleen. The dogs share wolf's
   grammar — body, head, ears, tail, legs — but never wolf's silhouette: an
   erect ear here, a saddle patch there, a barrel round the neck, a dog at
   full stretched-out gallop. */
def('pakicetus', () => [
  S('M4 52 L56 52', 'water-bs', 1.6),                                   // foraging along Eocene rivers
  E(28, 40, 15, 8, 'bs'),                                               // wolf-sized, and four-legged
  P('M42 38 L52 33 L52 41 Z', 'lo'),
  ...[-8, -2, 5, 10].map(dx => S(`M${28 + dx} 47 L${28 + dx} 54`, 'lo', 2.2)),
]);
def('ambulocetus', () => [
  S('M2 44 L58 44', 'water-bs', 1.6),
  P('M6 40 Q6 32 20 32 Q40 30 50 38 Q50 44 40 44 Q20 46 6 40 Z', 'bs'), // 'the walking whale' — crocodile-like
  P('M50 36 L58 34 L58 40 Z', 'lo'),
  S('M14 44 L10 50 M24 44 L20 50', 'lo', 2),                            // front legs, still walking
  P('M36 44 L32 52 L40 52 Z', 'hi'),                                    // hind feet, already paddling
]);
def('rodhocetus', () => [
  S('M2 44 L58 44', 'water-bs', 1.6),
  P('M8 38 Q8 30 24 30 Q40 30 48 36 Q48 42 36 42 Q18 44 8 38 Z', 'bs'), // paddled with the hind feet, not the legs
  P('M48 34 L56 33 L56 39 Z', 'lo'),
  S('M16 42 L14 46', 'lo', 1.6),                                        // front legs, nearly gone
  P('M34 42 L26 50 L38 50 Q40 46 34 42 Z', 'hi'),                       // hind flippers doing all the work
]);
def('basilosaurus', () => [
  S('M2 34 Q14 20 24 34 Q34 48 44 34 Q50 26 56 20', 'bs', 8),           // fully aquatic, up to 20 m, serpentine
  C(3, 33, 3, 'lo'),
  S('M30 40 L28 44', 'gh', 2),                                          // hind legs, shrunk to a useless 35 cm
]);
def('dorudon', () => [
  P('M8 32 Q18 22 34 26 Q48 29 54 32 Q48 40 32 42 Q16 44 8 32 Z', 'lo'), // a smaller basilosaurid
  P('M2 30 L2 34 Q2 38 8 40 Q4 36 4 32 Q4 28 8 26 Q2 26 2 30 Z', 'bs'), // the first true tail fluke
  C(50, 30, 1.6, 'ground'),
]);
def('llanocetus', () => [
  P('M6 32 Q18 22 36 26 Q50 29 56 34 Q50 41 36 44 Q18 46 6 32 Z', 'lo'), // an early mysticete
  P('M36 26 L44 14 L46 28 Z', 'lo'),
  ...[38, 41, 44].map(x => S(`M${x} 30 L${x} 34`, 'ik', 1.4)),          // teeth, not baleen — it gripped and sheared
]);
def('dog', () => [
  E(25, 38, 14, 8, 'bs'),
  C(40, 34, 6.5, 'bs'),
  P('M43 30 Q48 27 46 34 Q44 34 43 30 Z', 'lo'),                        // one floppy ear
  S('M12 38 Q7 34 9 29 Q12 34 12 38 Z', 'lo', 1),                       // a tail, curled and wagging
  ...[-7, -1, 6, 11].map(dx => S(`M${25 + dx} 46 L${25 + dx} 53`, 'lo', 2)),
]);
def('german_shepherd', () => [
  P('M10 42 Q10 30 24 28 Q40 24 48 34 Q46 42 34 44 Q18 46 10 42 Z', 'bs'), // the sloped, alert working back
  P('M40 24 Q36 32 42 40 Q48 34 48 26 Q46 22 40 24 Z', 'lo'),           // the saddle patch of colour
  C(44, 26, 5.5, 'bs'),
  S('M40 20 L38 14 M46 21 L48 15', 'lo', 2),                            // pointed, erect ears
  ...[-8, 0, 8].map(dx => S(`M${28 + dx} 44 L${28 + dx} 52`, 'lo', 2.4)),
]);
def('border_collie', () => [
  E(26, 42, 17, 7, 'bs'),                                               // low, crouched, ready to stalk
  C(45, 40, 6, 'bs'),
  E(38, 30, 6, 8, 'lo'),                                                // the black-and-white coat
  C(48, 39, 1, 'ik'),                                                   // 'the eye' — a silent, fixed stare
  ...[-9, 10].map(dx => S(`M${26 + dx} 48 L${26 + dx} 53`, 'lo', 2.4)),
]);
def('rottweiler', () => [
  E(27, 34, 16, 11, 'bs'),                                              // stocky, blocky, a butcher's cart-dog
  C(43, 29, 8, 'bs'),
  E(43, 34, 3, 2, 'lo'),                                                // the tan muzzle
  C(38, 24, 1.4, 'lo'), C(48, 24, 1.4, 'lo'),                           // tan eyebrow marks
  C(13, 38, 2, 'bs'),                                                   // the docked, short tail
  ...[-10, 0, 9].map(dx => S(`M${27 + dx} 45 L${27 + dx} 53`, 'lo', 3)),
]);
def('saint_bernard', () => [
  E(27, 36, 19, 13, 'bs'),                                              // huge, and heavy in the shoulder
  C(45, 27, 9, 'bs'),
  P('M40 32 Q38 40 42 44 Q48 42 46 34 Z', 'lo'),                        // the drooping jowls
  P('M18 40 L34 40 L33 48 L19 48 Z', 'hi'), S('M18 40 L34 40 M18 48 L34 48', 'lo', 1.4), // the famous barrel, round its neck
]);
def('siberian_husky', () => [
  E(27, 34, 16, 9, 'bs'),
  C(43, 28, 7, 'bs'),
  ...[[20, 30], [26, 26], [34, 30]].map(([x, y]) => C(x, y, 3.6, 'hi')), // the thick, tufted, cold-proof coat
  S('M40 21 L38 15 M46 22 L48 16', 'lo', 2),
  S('M13 34 Q7 26 12 20', 'lo', 2.4),                                   // tail curled over the back
  ...[-9, 10].map(dx => S(`M${27 + dx} 43 L${27 + dx} 53`, 'lo', 2.4)),
]);
def('basenji', () => [
  E(28, 38, 12, 7, 'bs'),                                               // small and compact
  C(41, 33, 5.5, 'bs'),
  S('M37 28 Q41 25 45 28', 'lo', 1.2),                                  // the wrinkled forehead
  S('M38 27 L36 22 M44 27 L46 22', 'lo', 1.8),
  C(19, 38, 2.4, 'lo'),                                                 // the tightly curled tail — 'the barkless dog'
  ...[-6, 10].map(dx => S(`M${28 + dx} 45 L${28 + dx} 52`, 'lo', 2)),
]);
def('greyhound', () => [
  P('M8 36 Q10 26 26 28 Q36 20 40 26 Q44 32 40 36 Q26 42 8 36 Z', 'bs'), // deep-chested, lean, aerodynamic
  C(44, 24, 5, 'bs'),
  S('M6 36 L2 44 M18 30 L14 20 M32 36 L36 46 M38 24 L44 16', 'lo', 2),  // legs, at full stretched-out stride
]);
def('afghan_hound', () => [
  E(27, 38, 14, 8, 'bs'),
  P('M40 34 Q48 28 47 20 L51 20 Q52 30 43 37 Z', 'bs'),                 // the long, narrow head and neck
  ...[16, 22, 28].map(x => S(`M${x} 32 Q${x - 2} 42 ${x} 52`, 'hi', 1.6)), // the long, flowing silky coat
  S('M13 38 Q7 34 9 28', 'hi', 2),
]);

/* reptiles ─────────────────────────────────────────────────────────────────
   No sprawled-mammal legs, no fleece, no fur — the one thing every reptile
   drawing here has to get right is the thing its fact line is about: a
   splayed sprawl for the lizard, a legless sinuous body for the snake, a
   domed and seamed shell for the turtle, a diamond back and rattle tail
   for the rattlesnake. */
def('lizard', () => [E(26, 35, 16, 7, 'bs'),                                    // low, flat body
                     P('M41 35 L52 31 L52 39 Z', 'bs'),                          // pointed head
                     S('M10 35 Q1 40 4 48', 'bs', 3),                            // long tapering tail
                     S('M16 40 L9 48 M24 41 L20 49', 'lo', 2),                   // hind legs, splayed
                     S('M30 28 L26 20 M38 29 L35 21', 'lo', 2)]);                // fore legs, splayed
def('snake',  () => [S('M8 44 Q18 17 30 32 Q42 47 52 16', 'bs', 7),              // one sinuous stroke
                     C(52, 14, 4, 'bs'),                                         // the head
                     S('M55 11 L59 8 M55 13 L59 14', 'ik', 1.4)]);               // forked tongue
def('turtle', () => [E(30, 32, 20, 15, 'bs'),                                    // domed carapace
                     ...[[30, 16], [14, 25], [46, 25], [17, 42], [43, 42]]
                       .map(([x, y]) => S(`M30 32 L${x} ${y}`, 'lo', 1.6)),       // scute seams
                     C(48, 33, 5, 'hi'),                                         // head, poking clear
                     P('M12 39 L6 43 L12 45 Z', 'hi')]);                         // a leg, poking clear
def('rattlesnake', () => [S('M10 40 Q22 15 32 30 Q42 45 50 20', 'bs', 7),
                          C(50, 18, 4, 'bs'),                                    // the head
                          ...[[16, 36], [24, 25], [32, 32], [40, 30]]
                            .map(([x, y]) => C(x, y, 2.2, 'lo')),                // diamond back pattern
                          ...[[6, 44], [10, 47], [14, 49]]
                            .map(([x, y], i) => C(x, y, n(3 - i * 0.5), 'hi'))]); // tapering rattle

/* living — dog breeds, aquarium fish, arthropods, dinosaurs & kin, canid
   ancestors, one toadstool. Same grammar as the zoo above: a body, a head,
   and only the one or two marks that are actually THIS animal's tell — a
   bloodhound's drowning ears, a stegosaur's plates, a dragonfly's four wings
   spread flat. Nothing here is a generic quadruped with a new label. ────── */

/* dog breeds — same cow/wolf grammar, told apart by the one real trait ─── */
def('bloodhound', () => [                                       // enormous drowning ears, heavy jowls
                     E(27, 37, 15, 8.5, 'bs'), C(43, 31, 7.4, 'bs'),
                     P('M38 27 Q33 41 39 47 Q44 45 41 30 Z', 'lo'),   // left ear, hanging past the jaw
                     P('M48 27 Q54 42 48 48 Q43 45 46 30 Z', 'lo'),   // right ear, mirrored
                     S('M49 35 Q52 37 49 40', 'ik', 1.6),             // a fold of loose skin
                     C(51, 33, 1.6, 'ik'),
                     ...[-9, -2, 5, 10].map(dx => S(`M${27 + dx} 45 L${27 + dx} 53`, 'lo', 2.2))]);
def('beagle', () => [                                            // tricolour saddle, tail flagged white
                     E(27, 35, 15, 8, 'hi'),
                     P('M17 30 Q27 25 38 30 L36 40 Q27 43 18 40 Z', 'lo'),  // the saddle patch
                     C(41, 30, 6.5, 'bs'),
                     P('M37 25 Q32 35 37 41 Q40 39 39 28 Z', 'lo'),   // one modest floppy ear
                     S('M13 33 Q7 26 10 20', 'bs', 3), C(10, 19, 2, 'hi'), // the flagged tail, white tip
                     ...[-8, -2, 5, 9].map(dx => S(`M${27 + dx} 43 L${27 + dx} 51`, 'lo', 2))]);
def('dachshund', () => [                                         // absurdly long low body, stub legs
                     E(30, 40, 22, 6, 'bs'),
                     C(52, 36, 5, 'bs'),
                     P('M49 32 L44 27 L48 34 Z', 'lo'),
                     S('M8 40 Q3 44 6 49', 'lo', 2.4),
                     ...[-16, -6, 6, 16].map(dx => S(`M${30 + dx} 46 L${30 + dx} 50`, 'lo', 2.4))]);  // legs barely reach the ground
def('jack_russell_terrier', () => [                              // small, mostly white, ears pricked alert
                     E(29, 37, 13, 7, 'hi'),
                     E(21, 35, 5, 4, 'lo'),                        // the one patch, over an eye
                     C(41, 30, 6, 'hi'),
                     P('M37 25 L34 19 L40 24 Z', 'lo'), P('M45 24 L46 18 L49 23 Z', 'lo'),  // pricked ears
                     S('M15 38 L11 33', 'hi', 2.4),                 // short upright tail
                     ...[-7, -2, 4, 8].map(dx => S(`M${29 + dx} 43 L${29 + dx} 51`, 'lo', 2))]);
def('bull_terrier', () => [                                      // the egg-profile head, no stop at the nose
                     E(24, 37, 14, 8, 'bs'),
                     P('M34 33 Q34 20 45 18 Q56 18 55 30 Q54 38 44 38 Q37 38 34 33 Z', 'bs'),  // skull curving straight into snout
                     P('M46 26 L49 24 L47 28 Z', 'ik'),             // the famously triangular eye
                     ...[-6, 0, 6].map(dx => S(`M${24 + dx} 44 L${24 + dx} 52`, 'lo', 3))]);
def('labrador_retriever', () => [                                // broad head, thick otter tail, sitting patiently
                     P('M13 53 Q13 33 27 33 Q41 33 41 53 Z', 'bs'),  // haunches down — a sit, not a stand
                     C(45, 27, 7.8, 'bs'),
                     P('M41 22 Q36 30 41 37 Q44 35 43 25 Z', 'lo'),
                     P('M12 44 Q4 44 3 51 Q9 55 15 47 Z', 'lo'),    // thick tail, curled by the haunch
                     S('M19 53 L19 59 M33 53 L33 59', 'lo', 2.8)]); // just the two front legs, sitting
def('golden_retriever', () => [                                  // feathered coat everywhere it can be
                     E(27, 35, 16, 9, 'bs'), C(42, 29, 7, 'bs'),
                     ...[[38, 24], [43, 23], [37, 34], [42, 35]].map(([x, y]) =>
                       S(`M${x} ${y} L${x - 3} ${y + 4}`, 'hi', 1.4)),   // feathering on ear and chest
                     S('M12 33 Q5 30 6 22', 'bs', 3),
                     ...[[10, 20], [7, 24], [5, 28]].map(([x, y]) => S(`M${x} ${y} L${x - 3} ${y + 2}`, 'hi', 1.2)),  // and along the tail
                     ...[-9, -2, 5, 10].map(dx => S(`M${27 + dx} 43 L${27 + dx} 52`, 'lo', 2.2))]);
def('chihuahua', () => [                                         // the huge apple head, tiny body
                     E(31, 46, 8, 4.4, 'bs'),
                     C(29, 28, 10, 'bs'),                          // head is BIGGER than the body
                     C(21, 22, 2.4, 'ik'), C(35, 24, 2.4, 'ik'),   // enormous round eyes
                     P('M19 20 L14 10 L23 17 Z', 'lo'), P('M37 18 L40 8 L44 18 Z', 'lo'),  // huge ears
                     ...[-4, 3].map(dx => S(`M${31 + dx} 50 L${31 + dx} 54`, 'lo', 1.8))]);
def('pug', () => [                                                // flat wrinkled face, curled tail
                     E(28, 38, 14, 9, 'bs'), C(42, 30, 9, 'bs'),
                     S('M35 24 Q42 20 49 24', 'lo', 1.6), S('M35 29 Q42 26 49 29', 'lo', 1.4),  // forehead wrinkles
                     C(38, 33, 2, 'ik'), C(46, 33, 2, 'ik'),
                     C(11, 40, 3.2, 'lo'),                          // the curled tail, seen end-on
                     ...[-8, -2, 5, 9].map(dx => S(`M${28 + dx} 46 L${28 + dx} 52`, 'lo', 2.4))]);

/* aquarium & wild fish — the fish/salmon/tuna grammar, one real trait each ─ */
def('goldfish', () => [                                          // plump, and the flowing veil tail
                     E(24, 32, 12, 9, 'bs'),
                     P('M34 32 Q46 18 52 24 Q48 32 52 40 Q46 46 34 32 Z', 'hi'),  // the big flowing veil
                     C(15, 29, 1.8, 'ik')]);
def('koi', () => [                                                // longer body, barbels, colour blotches
                     P('M8 32 Q20 20 40 24 Q52 26 52 32 Q52 38 40 40 Q20 44 8 32 Z', 'bs'),
                     P('M40 32 L52 27 L52 37 Z', 'lo'),
                     S('M10 33 L5 31 M10 34 L5 36', 'ik', 1),        // the barbels at the mouth
                     E(24, 28, 4, 3, 'lo'), E(34, 37, 4, 3, 'lo'),   // the ornamental blotches
                     C(14, 29, 1.6, 'ik')]);
def('european_eel', () => [                                       // a ribbon, not a fish shape at all
                     S('M6 20 Q20 44 30 22 Q40 4 54 34', 'bs', 5),
                     S('M6 20 Q20 44 30 22 Q40 4 54 34', 'hi', 1),   // the fin running its whole length
                     C(6, 20, 1.6, 'ik')]);
def('seahorse', () => [                                           // upright S-curve, curled tail, horse head
                     S('M30 10 Q40 16 34 26 Q26 34 34 42', 'bs', 8),
                     P('M34 8 Q44 8 44 16 Q44 20 38 18 Z', 'bs'),    // the horse-like snout
                     S('M34 42 Q26 46 30 52 Q34 55 30 50', 'lo', 3.4), // the curled prehensile tail tip
                     C(38, 10, 1.4, 'ik')]);
def('clownfish', () => [                                          // banded, and a few tentacles around it
                     ...[[14, 22], [46, 22], [10, 40], [50, 40]].map(([x, y]) =>
                       S(`M${x} ${y} Q${x} ${y - 8} ${x + (x < 30 ? 4 : -4)} ${y - 14}`, 'gh', 2)),  // anemone tentacles
                     E(30, 32, 15, 10, 'bs'),
                     ...[22, 30, 38].map(x => P(`M${x - 2} 22 L${x + 2} 22 L${x + 2} 42 L${x - 2} 42 Z`, 'hi')),  // three white bands
                     P('M45 32 L54 27 L54 37 Z', 'lo')]);
def('piranha', () => [                                            // deep round body, the underbite of teeth
                     E(26, 32, 15, 12, 'bs'),
                     P('M38 34 L48 28 L48 40 Z', 'lo'),
                     P('M38 38 L44 40 L38 42 L34 40 Z', 'ik'),       // the jutting jaw, teeth bared
                     S('M18 22 Q26 18 34 22', 'hi', 2)]);            // the dorsal ridge

/* insects & other arthropods — one real anatomical tell each ────────────── */
def('butterfly', () => [                                          // four wings, symmetric, patterned
                     ...[-1, 1].map(s => P(`M30 26 Q${30 + s * 22} 8 ${30 + s * 24} 22 Q${30 + s * 14} 30 30 26 Z`, 'bs')),
                     ...[-1, 1].map(s => P(`M30 30 Q${30 + s * 18} 32 ${30 + s * 16} 46 Q${30 + s * 6} 40 30 30 Z`, 'hi')),
                     ...[-1, 1].map(s => C(30 + s * 14, 18, 2, 'lo')),
                     S('M30 16 L30 44', 'ik', 1.6),
                     S('M30 16 Q27 10 24 8 M30 16 Q33 10 36 8', 'ik', 1)]);  // clubbed antennae
def('ant', () => [                                                // three segments, a pinched waist, elbowed feelers
                     C(14, 30, 3.6, 'bs'), C(26, 30, 3, 'bs'),      // head, then the narrow thorax
                     E(42, 30, 9, 6.4, 'bs'),                       // the big abdomen
                     S('M14 27 Q10 20 6 22 M14 27 Q13 19 18 20', 'ik', 1.2),  // bent antennae
                     ...[[19, 32], [30, 33], [36, 32]].flatMap(([x, y]) => [
                       S(`M${x} ${y} L${x - 3} ${y + 8}`, 'lo', 1.4),
                       S(`M${x} ${y} L${x + 3} ${y + 8}`, 'lo', 1.4)])]);
def('ladybird', () => [                                           // a red dome, black spots, seamed in half
                     E(30, 32, 17, 13, 'bs'),
                     E(30, 22, 15, 5, 'lo'),
                     S('M30 20 L30 44', 'ik', 1.4),
                     ...[[22, 28], [38, 28], [24, 40], [36, 40]].map(([x, y]) => C(x, y, 2, 'ik'))]);
def('dung_beetle', () => [                                        // the ball, and the beetle steering it
                     C(14, 40, 9, 'lo'),
                     E(34, 33, 11, 8, 'bs'),
                     P('M43 30 L48 26 L48 33 Z', 'bs'),
                     S('M27 38 L18 41 M31 39 L21 45', 'lo', 2)]);  // hind legs braced against the ball
def('firefly', () => [                                            // a soft body, the glowing lantern at the tip
                     P('M18 28 Q30 20 42 28 Q42 34 30 36 Q18 34 18 28 Z', 'lo'),
                     E(44, 32, 6, 4.4, 'gh'),                       // the aura of light
                     E(44, 32, 3.4, 2.6, 'hi'),
                     S('M28 26 L48 26', 'ik', 1)]);                 // the split of the wing covers
def('dragonfly', () => [                                          // four wings flat, and the huge compound eyes
                     S('M30 20 L30 50', 'bs', 3.4),
                     ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) =>
                       E(30 + sx * 16, 30 + sy * 4, 15, 3.4, 'gh')),
                     C(26, 18, 3.6, 'bs'), C(34, 18, 3.6, 'bs')]);   // eyes wrapping nearly the whole head
def('locust', () => [                                              // grasshopper build, the cocked hind leg
                     E(26, 32, 13, 6.4, 'bs'),
                     P('M36 32 L52 27 L52 37 Z', 'hi'),              // wings folded along the back
                     P('M22 34 L10 34 L14 44 L26 40 Z', 'lo'),       // the big bent hind leg, cocked to jump
                     S('M13 22 L9 14', 'ik', 1.2)]);
def('mantis', () => [                                              // the raised, spiked, praying forelegs
                     S('M18 40 Q28 20 44 16', 'bs', 4),
                     P('M40 12 L48 14 L44 18 Z', 'lo'),
                     P('M20 38 Q10 32 14 24 Q18 24 20 30 Z', 'lo'),  // one raised, serrated foreleg
                     P('M22 40 Q13 36 16 28 Q20 28 22 33 Z', 'lo')]);
def('cockroach', () => [                                           // flat wide oval, splayed legs, long feelers
                     E(30, 32, 18, 10, 'bs'),
                     E(30, 24, 10, 5, 'lo'),
                     S('M22 22 Q14 12 8 8 M38 22 Q46 12 52 8', 'ik', 1.2),
                     ...[16, 26, 36].map(x => S(`M${x} 40 L${x - 4} 50 M${x} 40 L${x + 4} 50`, 'lo', 1.2))]);
def('termite', () => [                                             // pale, no waist, short straight feelers
                     E(30, 32, 14, 9, 'hi'),
                     S('M20 25 L14 21 M40 25 L46 21', 'ik', 1.2),    // straight, not elbowed
                     P('M18 30 L12 28 L18 34 Z', 'lo'),
                     ...[22, 30, 38].map(x => S(`M${x} 40 L${x} 46`, 'gh', 1.4))]);
def('flea', () => [                                                // tiny, laterally flat, one huge coiled leg
                     E(28, 30, 8, 5.4, 'bs'),
                     C(34, 27, 1.6, 'ik'),
                     S('M22 34 Q14 34 15 42 Q22 48 27 40 Q29 36 22 34 Z', 'lo')]);  // the enormous jumping leg, coiled
def('spider', () => [                                              // round abdomen, eight radiating legs
                     C(32, 34, 10, 'bs'), C(24, 27, 6, 'bs'),
                     ...[-1, 1].flatMap(s => [-24, -8, 8, 24].map(a =>
                       S(`M27 30 Q${27 + s * 14} ${30 + a * 0.3} ${27 + s * 20} ${30 + a}`, 'lo', 1.6))),
                     S('M32 44 L32 54', 'gh', 1)]);                  // a dropped thread of silk
def('scorpion', () => [                                            // pincers forward, tail curled over its back
                     E(24, 34, 12, 6.4, 'bs'),
                     P('M14 30 L6 24 L10 32 Z', 'lo'), P('M16 38 L10 44 L16 41 Z', 'lo'),  // the two pincers
                     S('M34 32 Q46 30 48 20 Q49 12 44 10', 'bs', 3.4),  // segmented tail, arcing up and over
                     C(44, 10, 1.6, 'ik'),
                     ...[16, 24, 32].map(x => S(`M${x} 38 L${x - 2} 44`, 'lo', 1.2))]);
def('tick', () => [                                                // small, engorged, legs bunched forward
                     C(30, 34, 8, 'bs'),
                     C(30, 34, 4, 'lo'),
                     ...[-16, -6, 6, 16].map(a => S(`M26 28 L${22 - a * 0.3} ${18 - Math.abs(a) * 0.2}`, 'ik', 1.4))]);  // all legs reach forward, questing
def('centipede', () => [                                           // flat and fast, one leg pair per segment
                     S('M8 30 Q30 16 52 30', 'bs', 5),
                     ...[12, 18, 24, 30, 36, 42, 48].map(x =>
                       S(`M${x} ${30 - (x - 30) * (x - 30) / 130} L${x - 3} ${38 - (x - 30) * (x - 30) / 130} M${x} ${30 - (x - 30) * (x - 30) / 130} L${x + 3} ${38 - (x - 30) * (x - 30) / 130}`, 'lo', 1)),
                     P('M8 30 L3 26 L5 33 Z', 'ik')]);              // the venomous forcipules
def('millipede', () => [                                           // arched and cylindrical, legs packed dense
                     P('M8 34 Q30 14 52 34 Q30 44 8 34 Z', 'bs'),
                     ...[14, 20, 26, 32, 38, 44].flatMap(x => [
                       S(`M${x} 36 L${x - 2} 44`, 'lo', 1),
                       S(`M${x} 36 L${x + 2} 44`, 'lo', 1)]),        // two pairs per segment, tightly spaced
                     C(9, 33, 2.4, 'hi')]);
def('woodlouse', () => [                                           // segmented armour plates, a curling isopod
                     E(30, 32, 17, 11, 'bs'),
                     ...[20, 26, 32, 38].map(x => S(`M${x} 22 L${x} 42`, 'ik', 1.2)),  // the transverse armour seams
                     S('M15 28 L9 24 M15 36 L9 40', 'lo', 1.2)]);    // short antennae, the only thing that pokes out

/* prehistoric — dinosaurs, a pterosaur, a plesiosaur, told apart by the one
   feature its fact line is actually about, not by scale alone. ─────────── */
def('eoraptor', () => [                                            // small, lean, no ornament at all — the basal form
                     E(28, 34, 11, 5.4, 'bs'),
                     P('M38 32 L48 28 L46 35 Z', 'bs'),
                     S('M14 34 Q4 32 3 24', 'bs', 2.4),
                     S('M22 40 L20 50 M32 40 L33 50', 'lo', 2)]);
def('coelophysis', () => [                                         // slender, a long narrow skull on a long neck
                     E(27, 34, 10, 4.6, 'bs'),
                     S('M35 32 Q44 26 50 26', 'bs', 3),
                     P('M50 26 L58 24 L52 29 Z', 'bs'),
                     S('M13 34 Q2 32 2 22', 'bs', 2),
                     S('M20 39 L18 50 M30 39 L31 50', 'lo', 2)]);
def('compsognathus', () => [                                       // chicken-sized, a lizard gripped in its jaws
                     E(30, 36, 8, 4, 'bs'),
                     P('M36 34 L44 31 L42 37 Z', 'bs'),
                     S('M42 33 Q47 30 51 33 Q47 35 42 34', 'lo'),   // the lizard in the gut, per the fossils
                     S('M23 40 L22 48 M31 40 L32 48', 'lo', 1.6)]);
def('allosaurus', () => [                                          // the brow ridges above the eye, robust jaws
                     E(26, 34, 16, 8, 'bs'),
                     P('M38 30 L54 24 L50 38 Z', 'bs'),
                     C(43, 27, 1.6, 'ik'), C(48, 26, 1.4, 'lo'),     // the paired brow-ridge bumps
                     S('M48 33 L52 34 L48 36 L46 34 Z', 'ik'),
                     ...[-8, 0, 9].map(dx => S(`M${26 + dx} 41 L${26 + dx} 51`, 'lo', 3))]);
def('spinosaurus', () => [                                         // the sail, and the long crocodile snout
                     E(24, 38, 14, 7, 'bs'),
                     ...[0, 6, 12, 18, 24].map(dx => P(`M${8 + dx} 34 L${11 + dx} 12 L${14 + dx} 34 Z`, 'lo')),  // the fan of spines
                     P('M36 36 L56 32 L54 40 L38 40 Z', 'bs'),       // elongated croc-like snout
                     wave('water-bs', 50, 3, 20)]);
def('tyrannosaurus', () => [                                        // the massive head, the famously tiny arms
                     E(24, 36, 15, 9, 'bs'),
                     P('M35 28 L56 24 L52 42 L35 42 Z', 'bs'),
                     S('M52 30 L44 30 L48 34 Z', 'ik'),
                     S('M30 34 L26 36', 'lo', 2),                    // the joke-small arm, barely reaching the chest
                     ...[-9, 6].map(dx => S(`M${24 + dx} 44 L${24 + dx} 54`, 'lo', 3.6))]);
def('velociraptor', () => [                                        // feathered, and the raised sickle claw
                     E(26, 36, 11, 5, 'bs'),
                     P('M34 34 L44 31 L42 37 Z', 'bs'),
                     ...[[16, 30], [20, 28], [24, 27]].map(([x, y]) => S(`M${x} ${y} L${x - 2} ${y - 4}`, 'hi', 1)),  // feather texture
                     P('M28 42 Q24 44 24 50 Q28 50 30 45 Z', 'ik'),  // the raised sickle claw, off the ground
                     S('M12 36 Q4 40 8 48', 'bs', 2)]);
def('deinonychus', () => [                                          // larger, the sickle claw more pronounced
                     E(25, 35, 14, 7, 'bs'),
                     P('M36 32 L48 28 L46 36 Z', 'bs'),
                     P('M30 44 Q24 47 25 54 Q31 54 33 47 Z', 'ik'),  // the enormous curved claw
                     S('M11 35 L2 34', 'bs', 3),                     // tail held stiff and straight
                     ...[-8, 6].map(dx => S(`M${25 + dx} 42 L${25 + dx} 52`, 'lo', 3))]);
def('archaeopteryx', () => [                                        // spread feathered wings, a long feathered tail
                     P('M30 30 Q10 20 4 30 Q16 34 30 32 Z', 'bs'),
                     P('M30 30 Q50 20 56 30 Q44 34 30 32 Z', 'bs'),
                     S('M30 30 Q30 44 24 52', 'lo', 2.4),
                     P('M20 50 L24 56 L28 49 Z', 'hi'),              // the fan of tail feathers
                     P('M28 24 L34 22 L30 27 Z', 'lo')]);            // small toothed beak-head
def('plateosaurus', () => [                                         // long neck, the thumb spike held out
                     E(24, 38, 12, 7, 'bs'),
                     S('M32 34 Q42 22 46 12', 'bs', 4),
                     P('M46 12 L52 9 L48 16 Z', 'bs'),
                     P('M22 40 L15 38 L18 44 Z', 'ik'),              // the diagnostic thumb spike
                     S('M13 40 Q4 42 5 50', 'lo', 2.6)]);
def('brachiosaurus', () => [                                        // forelimbs longer than hind — the giraffe build
                     E(26, 34, 14, 7, 'bs'),
                     S('M34 30 Q44 12 46 2', 'bs', 5),
                     C(46, 2, 4, 'bs'),
                     S('M20 40 L18 56', 'lo', 4), S('M34 40 L34 52', 'lo', 3.4)]);  // front leg taller than the back
def('apatosaurus', () => [                                          // a level neck, a whip-thin tail out far
                     E(26, 32, 16, 8, 'bs'),
                     S('M38 28 Q48 22 54 18', 'bs', 4.4),
                     C(54, 18, 3.4, 'bs'),
                     S('M12 34 Q4 40 1 34', 'bs', 3),                // the whip tail, tapering to almost nothing
                     ...[18, 34].map(x => S(`M${x} 40 L${x} 50`, 'lo', 3))]);
def('stegosaurus', () => [                                          // the double plates, the spiked thagomizer
                     P('M12 38 Q30 18 48 34 Q30 46 12 38 Z', 'bs'),
                     ...[16, 24, 32, 40].map(x => P(`M${x} 22 L${x - 4} 10 L${x + 4} 10 Z`, 'lo')),  // the back plates
                     ...[0, 1].map(i => P(`M${45 + i * 5} 32 L${53 + i * 5} 24 L${49 + i * 5} 38 Z`, 'ik')),  // spiked tail tip
                     C(10, 38, 3, 'bs')]);
def('ankylosaurus', () => [                                         // low, wide, studded, the club tail
                     P('M10 36 Q30 22 50 36 Q30 48 10 36 Z', 'bs'),
                     ...[[18, 28], [26, 24], [34, 24], [42, 28], [22, 40], [38, 40]].map(([x, y]) => C(x, y, 2.4, 'lo')),
                     S('M50 36 Q56 34 55 30', 'bs', 3),
                     C(55, 30, 4, 'ik')]);                           // the bone club at the tail tip
def('protoceratops', () => [                                        // small, a hooked beak, a modest frill only
                     E(26, 36, 12, 7, 'bs'),
                     P('M18 32 Q10 30 12 24 Q18 24 20 30 Z', 'lo'),  // small fan-shaped frill, no horns
                     P('M14 38 L6 38 L10 42 Z', 'hi'),               // the curved beak
                     ...[-6, 4, 12].map(dx => S(`M${26 + dx} 42 L${26 + dx} 50`, 'lo', 2.4))]);
def('triceratops', () => [                                          // three horns, and the huge bony frill
                     E(25, 38, 12, 7, 'bs'),
                     P('M14 34 Q2 30 4 20 Q14 20 18 30 Z', 'lo'),    // the large frill
                     P('M15 40 L7 40 L11 44 Z', 'hi'),
                     S('M14 30 L9 18 M18 28 L20 15 M13 34 L7 27', 'ik', 1.6),  // two brow horns and a nose horn
                     ...[-6, 4, 12].map(dx => S(`M${25 + dx} 44 L${25 + dx} 52`, 'lo', 3))]);
def('pachycephalosaurus', () => [                                   // the huge smooth dome, bipedal
                     C(38, 24, 12, 'bs'),
                     ...[26, 32, 44, 50].map(x => C(x, 32, 1.8, 'lo')),  // small nubs ringing the dome's base
                     E(24, 40, 11, 6, 'bs'),
                     ...[-6, 5].map(dx => S(`M${24 + dx} 45 L${24 + dx} 54`, 'lo', 3))]);
def('stegoceras', () => [                                          // a smaller, bumpier dome — no smooth crown
                     C(36, 26, 8, 'bs'),
                     ...[28, 32, 40, 44].map(x => C(x, 20, 1.4, 'ik')),  // bony knobs texture the whole dome
                     E(24, 40, 9, 5, 'bs'),
                     ...[-5, 4].map(dx => S(`M${24 + dx} 44 L${24 + dx} 51`, 'lo', 2.2))]);
def('iguanodon', () => [                                           // the famous thumb spike, once mistaken for a horn
                     E(24, 36, 13, 7, 'bs'),
                     P('M16 32 L8 28 L12 36 Z', 'hi'),
                     P('M14 40 L6 38 L11 46 Z', 'ik'),               // the diagnostic conical thumb spike
                     ...[-6, 4, 12].map(dx => S(`M${24 + dx} 42 L${24 + dx} 51`, 'lo', 2.6))]);
def('parasaurolophus', () => [                                     // the long backswept tubular crest
                     E(26, 38, 12, 6.4, 'bs'),
                     S('M32 32 Q40 14 54 12', 'bs', 4.4),           // the hollow crest, sweeping back over the neck
                     P('M18 38 L10 40 L18 43 Z', 'hi'),             // the duck-bill snout
                     ...[-6, 4, 12].map(dx => S(`M${26 + dx} 44 L${26 + dx} 52`, 'lo', 2.6))]);
def('quetzalcoatlus', () => [                                      // a pterosaur, not a dinosaur — huge wing membranes
                     P('M30 30 Q4 12 2 26 Q16 30 30 30 Z', 'bs'),
                     P('M30 30 Q56 12 58 26 Q44 30 30 30 Z', 'bs'),
                     S('M30 30 Q40 40 44 50', 'lo', 2.2),
                     P('M44 50 L52 56 L46 46 Z', 'hi')]);           // the long pointed beak-head
def('elasmosaurus', () => [                                        // the neck is almost the whole animal
                     E(20, 44, 9, 6, 'bs'),
                     S('M24 40 Q30 24 20 12 Q10 2 22 4', 'bs', 4),  // the impossibly long neck, 72 vertebrae
                     C(22, 4, 2.4, 'ik'),
                     ...[[13, 42], [27, 42]].map(([x, y]) => E(x, y, 5, 2.4, 'lo')),  // paddle flippers
                     wave('water-bs', 52, 3, 20)]);

/* canid ancestors — the family tree, told apart by build not just size ──── */
def('leptocyon', () => [                                           // fox-sized, and the fluffy fan of a tail
                     E(29, 39, 9, 4.6, 'bs'), C(38, 35, 4, 'bs'),
                     P('M35 31 L33 26 L37 32 Z', 'lo'),
                     ...[[16, 38], [12, 41], [10, 45]].map(([x, y], i) => C(x, y, n(3.4 - i * 0.6), 'hi')),  // bushy fox tail
                     ...[-4, 3].map(dx => S(`M${29 + dx} 43 L${29 + dx} 48`, 'lo', 1.6))]);
def('eucyon', () => [                                              // jackal-sized, large pricked ears, rangy legs
                     E(28, 37, 12, 6, 'bs'), C(40, 31, 5.4, 'bs'),
                     P('M36 26 L34 19 L39 25 Z', 'lo'), P('M43 25 L45 18 L47 25 Z', 'lo'),  // tall pricked ears
                     S('M17 39 Q10 36 12 30', 'lo', 2),
                     ...[-8, -2, 4, 9].map(dx => S(`M${28 + dx} 42 L${28 + dx} 53`, 'lo', 2))]);  // long rangy legs
def('canis_lepophagus', () => [                                    // coyote-sized, narrow chest, low to the ground
                     E(23, 42, 10, 4.6, 'bs'),                       // notably lower and leaner than eucyon
                     C(36, 36, 4.4, 'bs'),
                     P('M33 32 L34 26 L37 32 Z', 'lo'),               // a single small, close-set ear
                     S('M11 43 Q4 49 7 55', 'lo', 2),                 // tail hangs low, further down
                     S('M16 46 L14 56 M30 46 L32 56', 'lo', 1.8)]);   // just two legs, caught mid-trot
def('canis_etruscus', () => [                                      // larger, wolf-like build, tail held level
                     E(26, 35, 16, 9, 'bs'), C(43, 29, 7, 'bs'),
                     P('M39 24 L38 18 L42 23 Z', 'lo'), P('M46 23 L48 17 L50 24 Z', 'lo'),
                     S('M10 35 L2 34', 'lo', 3),                    // tail carried straight out, level
                     ...[-9, -2, 5, 10].map(dx => S(`M${26 + dx} 43 L${26 + dx} 53`, 'lo', 2.6))]);
def('canis_mosbachensis', () => [                                  // stocky, mid-size wolf, built low and heavy
                     P('M9 41 Q9 25 27 27 Q45 25 46 41 Q46 48 27 48 Q9 48 9 41 Z', 'bs'),  // a stocky path body, not an ellipse
                     C(39, 28, 6.6, 'bs'),
                     C(35, 22, 2, 'lo'), C(43, 22, 2, 'lo'),         // small rounded ears, not pricked
                     S('M11 43 Q3 47 6 52', 'lo', 2.6),              // short tail, curved down
                     ...[-6, 3].map(dx => S(`M${19 + dx} 48 L${19 + dx} 56`, 'lo', 3.4))]);  // two thick, heavy legs

/* fly_agaric — the classic red-and-white toadstool, cap ring and all ────── */
def('fly_agaric', () => [
                     P('M9 25 Q9 8 30 8 Q51 8 51 25 Z', 'bs'),
                     ...[[18, 15], [30, 11], [42, 15], [24, 20], [37, 20]].map(([x, y]) => C(x, y, 2.2, 'hi')),  // the spots
                     P('M25 25 L35 25 L33 53 L27 53 Z', 'hi'),
                     S('M25 32 Q30 30 35 32', 'lo', 1.4)]);          // the ring around the stem

/* living — wild mammal, bird, reptile & amphibian batch ─────────────────────
 * Same rule as the roster above: find the one thing the fact line is really
 * about — a tear-streak, a Mickey-Mouse ear, a facial disc, a gill stalk —
 * and let that carry the drawing. Nothing here repeats another animal's
 * silhouette-plus-marking combination. */
def('cheetah', () => [                                     // built for speed, not strength
  E(27, 35, 17, 8, 'bs'),
  C(43, 27, 6, 'bs'),
  S('M40 24 L37 30 M46 24 L48 30', 'lo', 1.6),              // the tear-streaks, eye to mouth
  ...[[20, 30], [26, 33], [33, 29], [38, 34], [24, 38]].map(([x, y]) => C(x, y, 1.8, 'lo')),
  S('M11 34 Q4 30 8 24', 'lo', 2.4),
  ...[-9, -2, 6, 11].map(dx => S(`M${27 + dx} 42 L${27 + dx} 52`, 'lo', 2))]);
def('cougar', () => [                                       // plain-coated, and built to range far
  E(26, 35, 17, 10, 'bs'),
  C(42, 29, 7, 'bs'),
  C(38, 24, 2, 'bs'), C(45, 25, 2, 'bs'),                    // small rounded ears
  S('M11 36 Q2 40 4 50 Q8 52 10 46', 'bs', 4),                // the heavy tail, curling at the tip
  ...[-9, -2, 6, 11].map(dx => S(`M${26 + dx} 44 L${26 + dx} 53`, 'lo', 2.4))]);
def('red_fox', () => [                                       // tall ears, and the white-tipped brush
  E(25, 36, 14, 8, 'bs'),
  C(39, 29, 6, 'bs'),
  P('M36 24 L34 16 L40 22 Z', 'bs'), P('M42 23 L46 15 L48 23 Z', 'bs'),
  S('M12 37 Q2 34 4 26 Q6 20 14 24 Q16 30 12 37 Z', 'bs'),
  C(7, 23, 3.4, 'hi'),                                        // the white tip, the tell
  ...[-6, 0, 6].map(dx => S(`M${25 + dx} 43 L${25 + dx} 50`, 'lo', 2))]);
def('coyote', () => [                                         // head thrown back, mid-howl
  E(24, 38, 14, 8, 'bs'),
  P('M34 34 Q40 22 38 12 L44 12 Q48 24 42 36 Z', 'bs'),
  P('M39 12 L36 6 L42 9 Z', 'lo'), P('M44 12 L46 5 L48 11 Z', 'lo'),
  S('M40 8 Q44 2 48 4', 'gh', 1.6),
  ...[-8, -2, 5, 10].map(dx => S(`M${24 + dx} 45 L${24 + dx} 54`, 'lo', 2.2))]);
def('african_wild_dog', () => [                               // the enormous round ears are the tell
  E(26, 36, 15, 8.5, 'bs'),
  C(41, 30, 6.5, 'bs'),
  C(37, 22, 4.6, 'lo'), C(45, 23, 4.6, 'lo'),
  ...[[20, 32], [28, 38], [35, 34], [16, 40]].map(([x, y]) => E(x, y, 3.4, 2.4, 'hi')),  // the patchwork coat
  ...[-9, -2, 5, 10].map(dx => S(`M${26 + dx} 43 L${26 + dx} 52`, 'lo', 2))]);
def('polar_bear', () => [                                     // low-slung neck, small ears, ice ahead
  E(24, 38, 15, 10, 'bs'),
  P('M36 34 Q46 30 48 20 Q49 14 45 14 Q42 22 34 28 Z', 'bs'),
  C(45, 15, 2, 'lo'), C(40, 16, 1.8, 'lo'),
  E(50, 50, 7, 2.6, 'water-hi'),                               // the breathing hole it is watching
  ...[-9, -2, 6].map(dx => S(`M${24 + dx} 47 L${24 + dx} 53`, 'lo', 3))]);
def('giant_panda', () => [                                    // the black eye patches read from across a room
  C(28, 34, 15, 'hi'),
  C(40, 27, 7, 'hi'),
  C(35, 21, 3, 'lo'), C(45, 23, 3, 'lo'),
  E(34, 26, 3, 4, 'lo'), E(41, 26, 3, 4, 'lo'),
  S('M46 34 L52 20', 'plant-bs', 3),                            // bamboo, gripped with the wrist "thumb"
  E(22, 44, 6, 3, 'lo')]);
def('sun_bear', () => [                                       // the pale chest crescent gives it its name
  E(26, 38, 13, 9, 'lo'),
  C(39, 32, 6.6, 'lo'),
  P('M18 34 Q26 27 34 34 Q26 41 18 34 Z', 'hi'),
  S('M42 38 Q42 45 45 49', 'bs', 2.6),                          // the very long tongue
  ...[-6, 1, 7].map(dx => S(`M${26 + dx} 45 L${26 + dx} 51`, 'lo', 2))]);
def('gorilla', () => [                                         // broad shoulders, silver saddle
  P('M14 44 Q10 24 30 20 Q50 24 46 44 Z', 'bs'),
  C(30, 18, 8, 'bs'),
  E(26, 19, 2, 1.6, 'lo'), E(34, 19, 2, 1.6, 'lo'),
  P('M18 44 Q16 30 20 30 Q22 30 22 44 Z', 'hi'),
  S('M14 44 L10 54 M46 44 L50 54', 'lo', 4)]);                  // knuckle-walking arms
def('chimpanzee', () => [                                      // the twig, and what it is fished into
  E(26, 38, 12, 9, 'bs'),
  C(37, 30, 7, 'bs'),
  S('M40 34 L52 44', 'lo', 2.4),
  P('M46 44 Q52 46 50 50 Q46 52 44 47 Z', 'craft-lo'),          // the termite mound
  S('M18 40 L10 50', 'lo', 3)]);
def('orangutan', () => [                                       // arms too long to ever need the ground
  S('M8 8 L52 8', 'craft-lo', 3),
  E(30, 34, 12, 15, 'bs'),
  C(30, 18, 7, 'bs'),
  S('M22 22 Q10 14 10 8 M38 22 Q50 14 50 8', 'lo', 3.4),
  E(30, 33, 4, 5, 'hi')]);
def('baboon', () => [                                          // the dog-like snout is the tell
  E(26, 37, 14, 9, 'bs'),
  E(41, 32, 7, 6, 'bs'),
  E(46, 34, 3, 2.6, 'lo'),
  S('M13 36 Q6 30 10 20 Q12 16 14 22', 'bs', 2.4),               // tail, arched high
  ...[-8, -2, 5, 10].map(dx => S(`M${26 + dx} 44 L${26 + dx} 52`, 'lo', 2.2))]);
def('lemur', () => [                                           // the ring-tail is the whole name
  C(27, 38, 10, 'bs'),
  C(27, 24, 7, 'bs'),
  C(22, 22, 5.5, 'hi'),
  C(20, 21, 1.4, 'ik'), C(25, 21, 1.4, 'ik'),
  S('M36 40 Q50 38 52 22 Q53 14 48 12', 'bs', 4),
  ...[[42, 33], [47, 26], [51, 18]].map(([x, y]) => C(x, y, 2, 'lo'))]);  // the rings

def('bald_eagle', () => [                                      // the white head is unmistakable
  P('M14 36 Q10 26 20 22 Q34 18 46 24 Q52 28 48 34 Q34 40 14 36 Z', 'lo'),
  C(46, 20, 7, 'hi'),
  P('M52 20 L58 22 L52 24 Z', 'fire-bs'),
  P('M16 36 L10 44 L18 40 Z', 'hi')]);                          // the white tail, too
def('peregrine_falcon', () => [                                // folded into the stoop
  P('M30 10 Q22 26 26 46 Q30 52 34 46 Q38 26 30 10 Z', 'bs'),
  P('M14 18 Q24 20 27 28 Q16 26 10 20 Z', 'lo'),
  P('M33 28 Q44 30 50 24 Q40 22 33 20 Z', 'lo'),
  S('M27 20 L24 26', 'ik', 2.2)]);                              // the dark malar stripe
def('snowy_owl', () => [                                       // face-on, for the disc and the eyes
  C(30, 32, 17, 'hi'),
  C(30, 32, 12, 'hi'),
  ...[[24, 30], [36, 30]].map(([x, y]) => [C(x, y, 5.6, 'ik'), C(x, y, 3, 'discovery')]).flat(),
  P('M30 36 L27 40 L33 40 Z', 'fire-bs'),
  ...granules('lo', 5, 991, [18, 40, 42, 46])]);
def('turkey_vulture', () => [                                  // wings held in a shallow soaring V
  P('M8 30 Q20 18 30 26 Q40 18 52 30 Q40 26 30 34 Q20 26 8 30 Z', 'lo'),
  C(30, 24, 6, 'fire-lo'),                                      // the small bald red head
  S('M30 30 Q28 40 30 48', 'lo', 3)]);

def('king_cobra', () => [                                      // reared up, hood fully flared
  P('M20 52 Q18 30 26 20 Q22 14 30 12 Q38 14 34 20 Q42 30 40 52 Z', 'bs'),
  C(30, 12, 5, 'bs'),
  S('M28 8 L26 3 M32 8 L34 3', 'ik', 1.4),
  S('M20 24 Q30 17 40 24', 'hi', 2)]);                          // the hood's rim
def('komodo_dragon', () => [                                    // sheer bulk, the biggest lizard there is
  E(26, 36, 18, 8, 'bs'),
  P('M42 34 L54 30 L54 38 Z', 'bs'),
  S('M54 34 L58 31 M54 34 L58 37', 'ik', 1.4),
  S('M10 36 Q2 42 5 50', 'bs', 4),
  S('M16 42 L11 50 M26 43 L22 51', 'lo', 2.4),
  S('M34 30 L31 22 M42 30 L40 22', 'lo', 2.4)]);
def('gila_monster', () => [                                     // beaded skin, in place of scales
  E(28, 36, 15, 7.5, 'bs'),
  P('M42 34 L50 32 L50 38 Z', 'bs'),
  ...Array.from({ length: 10 }, (_, i) => C(16 + (i % 5) * 6, 32 + Math.floor(i / 5) * 7, 1.8, i % 2 ? 'hi' : 'lo')),
  S('M14 37 Q6 40 8 48', 'bs', 3)]);
def('nile_crocodile', () => [                                   // eyes and teeth, and little else showing
  P('M8 36 Q8 32 14 32 L48 30 Q56 30 56 34 Q56 38 48 38 L14 38 Q8 38 8 36 Z', 'bs'),
  ...[0, 1, 2, 3, 4].map(i => P(`M${16 + i * 8} 30 L${19 + i * 8} 25 L${22 + i * 8} 30 Z`, 'hi')),
  C(14, 28, 2.2, 'lo'), C(20, 28, 2.2, 'lo')]);
def('american_alligator', () => [                                // the snout is a wide U, not a V
  P('M6 34 Q6 30 12 30 L44 28 Q54 28 54 34 Q54 40 44 38 L12 38 Q6 38 6 34 Z', 'bs'),
  P('M44 28 Q54 28 54 34 Q54 40 44 38 Z', 'lo'),
  C(16, 27, 2, 'lo'), C(22, 27, 2, 'lo'),
  S('M12 34 L48 34', 'hi', 1)]);

def('golden_poison_frog', () => [                                // small, smooth, and lethally bright
  E(30, 34, 15, 12, 'hi'),
  C(21, 24, 4.4, 'hi'), C(39, 24, 4.4, 'hi'),
  C(21, 24, 1.6, 'ik'), C(39, 24, 1.6, 'ik'),
  ...[-9, 9].map(dx => S(`M${30 + dx} 44 L${30 + dx - 2} 52 L${30 + dx + 3} 52`, 'bs', 2.6))]);
def('american_bullfrog', () => [                                 // the eardrum, bigger than the eye
  E(28, 36, 18, 12, 'bs'),
  C(18, 26, 5, 'bs'), C(30, 24, 5, 'bs'),
  C(24, 32, 6, 'hi'),
  S('M12 40 Q28 46 44 38', 'lo', 2.4)]);
def('cane_toad', () => [                                         // the swollen parotoid glands, the tell
  E(30, 38, 17, 11, 'lo'),
  E(18, 27, 6, 8, 'bs'), E(42, 27, 6, 8, 'bs'),
  C(24, 26, 3, 'lo'), C(36, 26, 3, 'lo'),
  ...granules('hi', 8, 331, [16, 32, 44, 46])]);
def('axolotl', () => [                                           // the feathery gills it never outgrows
  E(24, 36, 16, 10, 'hi'),
  C(38, 32, 3.2, 'ik'),
  S('M40 26 Q48 22 52 16', 'bs', 2.2), S('M40 30 Q49 28 54 26', 'bs', 2.2), S('M40 34 Q48 36 52 40', 'bs', 2.2),
  S('M12 38 Q4 42 7 50', 'hi', 3.6)]);
def('fire_salamander', () => [                                   // black, with the warning blotches on it
  S('M8 40 Q20 20 30 32 Q40 44 52 24', 'lo', 7),
  C(52, 22, 3.4, 'lo'),
  ...[[16, 32], [24, 26], [34, 34], [44, 28]].map(([x, y]) => C(x, y, 2.6, 'hi'))]);

/* living — dinosaurs, one real distinguishing feature each ─────────────────
 * No two are drawn as "generic biped with a tail" — the crest, the frill,
 * the claws, the neck length are what the fact line is actually about, so
 * that is what carries the silhouette. */
def('herrerasaurus', () => [                                     // lean, early, an ordinary predatory build
  P('M14 46 Q10 30 22 24 Q34 18 44 22 L52 26 L44 30 Q36 24 26 28 Q18 32 20 46 Z', 'bs'),
  S('M44 30 L38 22', 'lo', 2),
  S('M20 46 L18 54 M30 46 L28 54', 'lo', 2.6),
  S('M22 26 L14 20', 'lo', 1.8)]);
def('dilophosaurus', () => [                                     // the paired crests, not weapons at all
  P('M14 48 Q10 30 24 26 Q36 22 46 30 L44 42 Q30 34 20 38 Q16 42 18 48 Z', 'bs'),
  S('M40 26 Q38 14 34 10 M44 27 Q46 15 50 11', 'hi', 2),
  S('M20 48 L18 56 M30 47 L28 55', 'lo', 2.6)]);
def('ceratosaurus', () => [                                      // the display horn on the snout
  P('M12 48 Q8 28 24 24 Q38 20 48 28 L44 40 Q30 30 18 36 Q14 40 16 48 Z', 'bs'),
  P('M42 26 L45 18 L47 27 Z', 'hi'),
  S('M46 28 L52 30 L46 32', 'lo', 1.6),
  S('M18 48 L16 56 M28 47 L26 55', 'lo', 2.6)]);
def('carnotaurus', () => [                                       // the bull-like brow horns, and the tiny arms
  E(26, 38, 18, 11, 'bs'),
  C(46, 30, 7, 'bs'),
  S('M43 25 L40 18 M48 25 L51 18', 'hi', 2.6),
  S('M20 34 L14 35 M22 37 L16 39', 'lo', 1.6),
  ...[-8, 0, 9].map(dx => S(`M${26 + dx} 48 L${26 + dx} 55`, 'lo', 3))]);
def('giganotosaurus', () => [                                    // built to slice, not to crush bone
  P('M10 46 Q6 26 24 22 Q40 18 54 26 L56 32 L48 34 Q34 26 20 32 Q14 38 16 46 Z', 'bs'),
  ...[0, 1, 2, 3, 4].map(i => P(`M${34 + i * 4.5} 26 L${36 + i * 4.5} 20 L${38 + i * 4.5} 26 Z`, 'hi')),
  S('M20 46 L17 55 M30 45 L27 54', 'lo', 2.8)]);
def('baryonyx', () => [                                          // the crocodile snout, and the giant thumb claw
  E(24, 40, 15, 9, 'bs'),
  S('M36 36 Q50 34 54 30 Q50 32 36 34', 'bs', 6),
  C(52, 30, 1.4, 'ik'),
  S('M18 38 L10 44', 'lo', 2.4), P('M10 44 L4 46 L8 40 Z', 'hi'),
  ...[-6, 4].map(dx => S(`M${24 + dx} 48 L${24 + dx} 55`, 'lo', 2.6))]);
def('therizinosaurus', () => [                                   // the longest claws of any known animal
  E(26, 34, 16, 14, 'bs'),
  C(42, 20, 6, 'bs'),
  S('M22 24 L8 12 M26 22 L14 8 M30 24 L20 10', 'hi', 2.2),
  ...[-7, 4].map(dx => S(`M${26 + dx} 46 L${26 + dx} 55`, 'lo', 3))]);
def('oviraptor', () => [                                         // caught brooding, not stealing, its own eggs
  C(38, 24, 8, 'bs'),
  P('M36 18 Q38 10 42 12 Q42 18 38 20 Z', 'hi'),
  P('M45 24 L52 25 L45 27 Z', 'lo'),
  ...[[18, 44], [24, 46], [30, 44]].map(([x, y]) => E(x, y, 4, 3, 'craft-hi')),
  S('M28 30 L20 40', 'bs', 3)]);
def('gallimimus', () => [                                        // an ostrich-mimic, built to run
  E(22, 34, 10, 7, 'bs'),
  P('M28 32 Q42 26 46 14 L50 14 Q48 28 32 36 Z', 'bs'),
  P('M48 13 L56 13 L49 17 Z', 'lo'),
  S('M16 40 L10 54 M26 40 L34 54', 'lo', 2.8)]);
def('microraptor', () => [                                       // four wings, crow-sized, a glider
  E(28, 32, 9, 6, 'bs'),
  P('M20 28 Q8 18 4 24 Q12 30 22 32 Z', 'lo'),
  P('M22 36 Q10 42 8 50 Q16 48 24 40 Z', 'lo'),
  P('M36 33 Q46 40 44 48 Q38 44 34 36 Z', 'hi')]);
def('diplodocus', () => [                                        // the whip-tail is half its length
  P('M18 40 Q14 34 22 32 Q34 30 40 34 Q46 36 46 40 Q34 44 18 40 Z', 'bs'),
  S('M22 33 Q10 24 4 10', 'bs', 5),
  S('M42 38 Q54 38 58 50', 'bs', 3.4),
  ...[-8, 2, 12].map(dx => S(`M${22 + dx} 42 L${22 + dx} 50`, 'lo', 2.6))]);
def('massospondylus', () => [                                    // basal, bipedal, a modest neck
  P('M18 44 Q14 30 24 26 Q34 22 40 30 Q44 36 40 44 Q28 48 18 44 Z', 'bs'),
  S('M24 27 Q16 18 14 10', 'bs', 3.6),
  C(13, 9, 2.4, 'lo'),
  S('M22 44 L20 54 M32 44 L30 54', 'lo', 2.6)]);
def('euoplocephalus', () => [                                    // plated everywhere, even the eyelids
  E(26, 34, 20, 10, 'bs'),
  ...[[14, 28], [22, 26], [30, 26], [38, 28], [46, 30]].map(([x, y]) => P(`M${x - 3} ${y} L${x} ${y - 4} L${x + 3} ${y} L${x} ${y + 4} Z`, 'hi')),
  S('M46 36 L56 42', 'bs', 5),
  C(56, 42, 5, 'lo')]);                                           // the bone-fracturing club
def('psittacosaurus', () => [                                    // parrot beak, quills down the tail
  E(26, 38, 13, 8, 'bs'),
  C(41, 32, 7, 'bs'),
  P('M46 30 L54 32 L46 35 Z', 'hi'),
  ...[10, 16, 22, 28].map(x => S(`M${x} 42 L${x - 1} 48`, 'lo', 1.6)),
  S('M16 42 L12 50 M24 43 L22 50', 'lo', 2.2)]);
def('styracosaurus', () => [                                     // a spiked frill, fanned wide
  E(24, 40, 14, 9, 'bs'),
  P('M32 26 Q46 20 54 24 Q58 30 52 34 Q58 26 50 28 Q54 20 46 24 Q40 18 32 26 Z', 'hi'),
  P('M32 32 L26 22 L36 30 Z', 'lo'),
  ...[-8, 2].map(dx => S(`M${24 + dx} 48 L${24 + dx} 55`, 'lo', 2.6))]);
def('pentaceratops', () => [                                     // five horns, and the name means exactly that
  E(24, 40, 14, 9, 'bs'),
  E(42, 26, 15, 13, 'hi'),
  P('M32 24 L28 14 L36 22 Z', 'lo'),
  S('M38 22 L36 12 M44 22 L48 13', 'lo', 2),
  C(52, 30, 2, 'lo'), C(50, 38, 2, 'lo'),
  ...[-8, 2].map(dx => S(`M${24 + dx} 48 L${24 + dx} 55`, 'lo', 2.6))]);
def('camptosaurus', () => [                                      // a blunt beak, teeth worn down to nubs
  P('M14 44 Q12 30 26 28 Q40 26 48 34 L48 44 Q30 48 14 44 Z', 'bs'),
  P('M46 30 L54 30 L48 35 Z', 'lo'),
  S('M40 36 L44 38', 'hi', 1.4),
  ...[-8, 0, 8, 16].map(dx => S(`M${16 + dx} 44 L${16 + dx} 52`, 'lo', 2.4))]);
def('maiasaura', () => [                                         // the duck-bill, and the nest it tends
  E(24, 36, 15, 9, 'bs'),
  P('M38 32 L48 30 L48 36 L38 36 Z', 'lo'),
  P('M10 46 Q26 40 42 46 Q26 52 10 46 Z', 'craft-hi'),
  C(20, 46, 2.4, 'hi'), C(28, 47, 2, 'hi'), C(35, 46, 2.2, 'hi')]);

def('fish',   () => [P('M12 32 Q26 20 42 32 Q26 44 12 32 Z', 'bs'),
                     P('M42 32 L52 25 L52 39 Z', 'lo'), C(20, 30, 2.4, 'ik'),
                     S('M26 24 Q28 32 26 40', 'hi', 1.4)]);
def('meat',   () => [P('M16 26 Q30 18 44 26 Q48 38 38 46 Q26 50 18 42 Q12 34 16 26 Z', 'bs'),
                     P('M22 30 Q30 26 38 30 Q40 38 32 42 Q24 42 22 36 Z', 'hi'),
                     S('M16 26 Q30 22 44 26', 'lo', 2)]);
def('bone',   () => [S('M20 40 L40 24', 'hi', 6), C(18, 43, 5, 'hi'), C(23, 37, 5, 'hi'),
                     C(42, 21, 5, 'hi'), C(37, 27, 5, 'hi')]);
/* A scallop: the fan, its radiating ribs, and the hinge they all run back to. */
def('shell',  () => [P('M30 47 Q9 39 13 23 Q30 13 47 23 Q51 39 30 47 Z', 'bs'),
                     ...[-15, -8, 0, 8, 15].map(dx =>
                       S(`M30 45 L${n(30 + dx)} ${n(19 + Math.abs(dx) * 0.42)}`, 'lo', 1.6)),
                     E(30, 46, 6, 3, 'hi')]);
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

/* The twenty, drawn as themselves ────────────────────────────────────────
 * Every amino acid shares one backbone — amine, alpha carbon, carboxyl —
 * and differs only in the side chain hanging off it. That is not a stylistic
 * choice, it is the definition, so the drawings are built the same way: one
 * shared backbone function, and one R group each. The R group is therefore
 * doing all the work of telling nineteen cards apart, which is exactly the
 * job it does in the chemistry.
 */
const BB_A = [12, 30], BB_B = [26, 22], BB_C = [40, 30];   // amine, alpha C, carboxyl
const R0 = [26, 36];                                        // where the side chain starts
// Deliberately only three shapes. The sameness check fingerprints by shape,
// so a seven-shape backbone repeated across all twenty made every pair look
// 70%+ identical no matter how different the side chains were — the shared
// part drowned out the part that carries the meaning. Drawn as one polyline
// plus the two atoms that matter, the backbone stays legible and the R group
// is what the fingerprint actually sees.
function aminoBackbone() {
  return [
    S(`M${BB_A[0]} ${BB_A[1]} L${BB_B[0]} ${BB_B[1]} L${BB_C[0]} ${BB_C[1]} L50 24 M${BB_C[0]} ${BB_C[1]} L50 38`, 'ik', 2.2),
    C(BB_A[0], BB_A[1], 4.6, CPK.N),
    C(50, 38, 4, CPK.O),
  ];
}
/** def() an amino acid: shared backbone, plus whatever its R group is. */
const amino = (id, r) => def(id, () => [...aminoBackbone(), ...r()]);
const chain = (pts, w = 2.2) =>
  S('M' + [R0, ...pts].map(p => p.join(' ')).join(' L'), 'ik', w);

amino('glycine', () => [C(R0[0], R0[1], 4, CPK.H)]);                       // side chain: one H
amino('alanine', () => [chain([[26, 46]]), C(26, 46, 4.6, CPK.C)]);        // one methyl
amino('valine', () => [chain([[26, 40]]),                                   // branches at the first carbon
  S('M26 40 L15 45', 'ik', 2), S('M26 40 L37 45', 'ik', 2),
  C(15, 45, 4.2, CPK.C), C(37, 45, 4.2, CPK.C)]);
amino('leucine', () => [chain([[20, 42], [20, 50]]),                        // one carbon further, then branches
  S('M20 50 L10 57', 'ik', 2), S('M20 50 L30 57', 'ik', 2),
  C(10, 57, 4, CPK.C), C(30, 57, 4, CPK.C)]);
amino('isoleucine', () => [chain([[24, 41]]),                               // branch AND continue — two chiral centres
  S('M24 41 L12 44', 'ik', 2), S('M24 41 L33 47 L33 57', 'ik', 2),
  C(12, 44, 4, CPK.C), C(33, 57, 4, CPK.C)]);
amino('proline', () => [                                                    // the ring closes back onto the N
  S(`M${BB_B[0]} ${BB_B[1]} L34 34 L30 46 L18 46 L${BB_A[0]} ${BB_A[1]}`, 'ik', 2.2),
  C(30, 46, 3.4, CPK.C), C(18, 46, 3.4, CPK.C)]);
amino('phenylalanine', () => [chain([[26, 40]]), hex('ik', 26, 50, 9, 2)]);  // plain benzene ring
amino('tyrosine', () => [chain([[26, 38]]), hex('ik', 26, 47, 8.4, 2),       // ...with an OH on it
  S('M26 56 L26 58', 'ik', 2), C(26, 58, 4.4, CPK.O)]);
amino('tryptophan', () => [chain([[26, 38]]),                                // two fused rings — the biggest
  hex('ik', 22, 47, 8, 1.8),
  S('M29 43 L38 44 L38 52 L29 51', 'ik', 1.8),
  C(38, 44, 3.4, CPK.N)]);
amino('serine', () => [chain([[26, 44]]), C(26, 44, 4.6, CPK.O),             // short, ends in OH
  S('M26 44 L34 51', 'ik', 1.8), C(34, 51, 3.2, CPK.H)]);
amino('threonine', () => [chain([[30, 44]]),                                 // O and a methyl
  S('M30 44 L22 53', 'ik', 2), S('M30 44 L40 51', 'ik', 2),
  C(22, 53, 4.4, CPK.O), C(40, 51, 4, CPK.C)]);
amino('methionine', () => [chain([[34, 41], [34, 52]]),                      // sulfur mid-chain, then a cap
  C(34, 52, 5.4, CPK.S), S('M34 52 L46 56', 'ik', 2), C(46, 56, 4, CPK.C)]);
amino('asparagine', () => [chain([[26, 42]]),                                // short amide
  ...double([26, 42], [14, 46], 'ik'), S('M26 42 L38 46', 'ik', 2),
  C(14, 46, 4.2, CPK.O), C(38, 46, 4.4, CPK.N)]);
amino('glutamine', () => [chain([[20, 38], [20, 47]]),                       // the same, one carbon longer
  ...double([20, 47], [9, 53], 'ik'), S('M20 47 L31 53', 'ik', 2),
  C(9, 53, 4, CPK.O), C(31, 53, 4.2, CPK.N)]);
amino('aspartic_acid', () => [chain([[22, 46]]),                             // short acid — two O
  ...double([22, 46], [11, 54], 'ik'), S('M22 46 L33 55', 'ik', 2),
  C(11, 54, 4.2, CPK.O), C(33, 55, 4.2, CPK.O)]);
amino('glutamic_acid', () => [chain([[28, 39], [28, 49]]),                   // the same, one carbon longer
  ...double([28, 49], [18, 57], 'ik'), S('M28 49 L39 56', 'ik', 2),
  C(18, 57, 4, CPK.O), C(39, 56, 4, CPK.O)]);
amino('lysine', () => [chain([[26, 38], [26, 45], [26, 52]]),                // long, plain, ends in N
  C(26, 52, 4.6, CPK.N)]);
amino('arginine', () => [chain([[26, 38], [26, 45]]),                        // the guanidinium fan
  S('M26 45 L26 52', 'ik', 2), C(26, 52, 4, CPK.N),
  S('M26 52 L17 57 M26 52 L35 57', 'ik', 1.8),
  C(17, 57, 3.6, CPK.N), C(35, 57, 3.6, CPK.N)]);
amino('histidine', () => [chain([[26, 40]]),                                 // five-membered ring, two N
  S('M26 40 L18 47 L21 56 L31 56 L34 47 Z', 'ik', 2),
  C(18, 47, 3.6, CPK.N), C(31, 56, 3.6, CPK.N)]);

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

def('resistance', () => [
  // A row of cells, most of them ghosts, one still solid. The picture IS the
  // definition: what is left after an antibiotic is what it did not kill.
  ...[[14, 24], [26, 20], [38, 25], [48, 21], [18, 42], [30, 46], [44, 42]]
    .map(([x, y]) => C(x, y, 6, 'gh')),
  C(30, 33, 8.5, 'lo'), C(30, 33, 6.5, 'bs'), C(27.5, 30.5, 2.4, 'hi'),
  S('M8 33 L52 33', 'ik', 1.2),
]);

/* living — genetics & inheritance, one diagram idea each ────────────────────
 * Same schematic language as cell/gene/chromosome above, not the animal
 * silhouette grammar — these are concepts, and each drawing IS the concept,
 * not decoration next to it. */
def('nerve', () => [                                       // the cable, and the impulse travelling it
  S('M4 30 Q30 14 56 30', 'bs', 6),
  ...[12, 22, 32, 42].map(x => S(`M${x} 24 L${x + 4} 36`, 'lo', 2)),
  C(46, 24, 3, 'hi'),
]);
def('mutation', () => [                                     // a sequence, and the one base that copied wrong
  S('M6 30 L54 30', 'gh', 3),
  ...[14, 22, 38, 46].map(x => C(x, 30, 3, 'bs')),
  C(30, 30, 4.2, 'hi'),
  S('M30 22 L30 16 M27 18 L33 18', 'ik', 1.6),
]);
def('natural_selection', () => [                            // one branch fades, the other carries on
  S('M10 46 L30 30 L50 14', 'gh', 2),
  S('M10 46 L30 30 L52 38', 'bs', 3),
  C(10, 46, 4, 'hi'), C(30, 30, 4, 'hi'), C(52, 38, 5, 'lo'),
]);
def('evolution', () => [                                    // change, traced across generations
  ...[[10, 42, 4], [24, 38, 5.5], [38, 32, 7], [50, 24, 9]].map(([x, y, r]) => C(x, y, r, 'bs')),
  S('M10 42 Q24 38 38 32 Q46 28 50 24', 'gh', 1.4),
]);
def('common_ancestor', () => [                              // every lineage, traced back to one point
  ...[[10, 10], [30, 8], [50, 12], [16, 20], [44, 18]].map(([x, y]) => S(`M30 46 L${x} ${y}`, 'gh', 1.6)),
  C(30, 46, 6, 'bs'),
  ...[[10, 10], [30, 8], [50, 12]].map(([x, y]) => C(x, y, 3, 'hi')),
]);
def('allele', () => [                                        // two versions, one from each parent
  S('M14 14 L14 46', 'gh', 3), S('M46 14 L46 46', 'gh', 3),
  S('M10 26 L18 26', 'bs', 6), S('M42 30 L50 30', 'hi', 6),
]);
def('genetic_diversity', () => [                             // the pool, and how many kinds fill it
  ...[[12, 16], [24, 12], [38, 18], [48, 14], [16, 30], [30, 26], [44, 32], [10, 42], [26, 44], [40, 44]]
    .map(([x, y], i) => C(x, y, 3 + (i % 3), i % 3 === 0 ? 'bs' : i % 3 === 1 ? 'hi' : 'lo')),
]);
def('cystic_fibrosis', () => [                                // the channel, narrowed, and what backs up behind it
  P('M20 12 L40 12 L40 48 L20 48 Z', 'gh'),
  P('M26 12 L34 12 L34 48 L26 48 Z', 'lo'),
  ...[[16, 20], [44, 24], [14, 34], [46, 38], [20, 44]].map(([x, y]) => C(x, y, 4, 'hi')),
]);
def('sickle_cell_anemia', () => [                             // one round cell, one bent into the sickle
  C(16, 22, 9, 'hi'),
  P('M38 12 Q50 16 48 30 Q44 44 34 48 Q30 42 34 32 Q38 22 38 12 Z', 'lo'),
]);
def('cancer', () => [                                         // a mass, dividing with no brakes left
  ...[[22, 26, 8], [34, 22, 7], [40, 32, 8], [26, 38, 7], [16, 36, 6], [32, 42, 6], [44, 44, 6]]
    .map(([x, y, r]) => C(x, y, r, 'lo')),
  C(30, 32, 3, 'hi'),
]);
def('gene_therapy', () => [                                   // a working copy, delivered into the cell
  C(38, 34, 16, 'gh'),
  S('M6 12 L20 26', 'ik', 3),
  P('M2 8 L10 8 L10 16 Z', 'lo'),
  S('M28 34 L48 34', 'bs', 5),
]);
def('crispr', () => [                                         // molecular scissors, closing on one site
  S('M6 30 L54 30', 'bs', 3),
  S('M22 20 L30 30 L22 40', 'ik', 2.4), S('M38 20 L30 30 L38 40', 'ik', 2.4),
  C(30, 30, 2.6, 'hi'),
]);
def('cloning', () => [                                        // two stalks, identical down to the leaf
  stalk('bs', 20, 52, 14), stalk('bs', 40, 52, 14),
  leaf('hi', 20, 12, .6, -20), leaf('hi', 40, 12, .6, -20),
  S('M20 52 Q30 56 40 52', 'gh', 1.4),
]);

/* cells and reproduction ─────────────────────────────────────────────────
   The asymmetry is the whole point of this tier, so the drawings carry it:
   sperm is small and directional, ovum is large and round, and the polar
   body is the same cell drawn with everything taken away. */
def('chromatin', () => [                                  // beads on a string
  S('M8 38 Q18 26 30 34 Q42 42 52 30', 'ik', 1.6),
  ...[[12, 34], [22, 29], [32, 35], [42, 39], [50, 31]].map(([x, y]) => C(x, y, 5, 'bs')),
]);
def('chromosome', () => [                                 // the X, condensed
  S('M20 14 Q30 30 20 46', 'bs', 6), S('M40 14 Q30 30 40 46', 'bs', 6),
  C(30, 30, 4, 'lo'),
]);
def('gene', () => [                                       // one lit stretch of a longer strand
  S('M6 30 L54 30', 'gh', 3),
  S('M20 30 L38 30', 'bs', 6),
  S('M20 22 L20 38 M38 22 L38 38', 'ik', 1.4),
]);
def('nucleus', () => [                                    // double membrane, pores in it
  ring('lo', 30, 30, 21, 2.4), ring('lo', 30, 30, 17, 2.4),
  ...[0, 60, 120, 180, 240, 300].map(a =>
    C(n(30 + 19 * Math.cos(a * Math.PI / 180)), n(30 + 19 * Math.sin(a * Math.PI / 180)), 2.6, 'ground')),
  ...[[26, 28], [34, 33]].map(([x, y]) => C(x, y, 6, 'bs')),
]);
def('microtubule', () => [                                // a hollow tube, tubulin pairs
  ...[0, 1, 2, 3, 4, 5].map(i => C(14 + i * 6.4, 24, 3.4, i % 2 ? 'bs' : 'hi')),
  ...[0, 1, 2, 3, 4, 5].map(i => C(14 + i * 6.4, 36, 3.4, i % 2 ? 'hi' : 'bs')),
  S('M10 24 L52 24 M10 36 L52 36', 'ik', 1),
]);
def('mitosis', () => [                                    // two identical daughters
  S('M6 30 L54 30', 'gh', 1.2),
  C(18, 30, 12, 'bs'), C(42, 30, 12, 'bs'),
  S('M14 26 Q18 30 14 34', 'ik', 1.6), S('M38 26 Q42 30 38 34', 'ik', 1.6),
]);
def('meiosis', () => [                                    // four, and each one different
  ...[[18, 20], [42, 20], [18, 40], [42, 40]].map(([x, y], i) =>
    [C(x, y, 9, 'bs'), S(`M${x - 3} ${y - 2} Q${x} ${y + i - 1} ${x + 3} ${y + 2}`, 'ik', 1.4)]).flat(),
]);
def('sperm', () => [                                      // small, and going somewhere
  E(16, 30, 8, 6.5, 'bs'), C(13, 27, 2, 'hi'),
  S('M24 30 Q32 22 38 30 Q44 38 52 30', 'ik', 2.2),
]);
def('ovum', () => [                                       // large, round, and haloed
  ...Array.from({ length: 16 }, (_, i) => {
    const a = (i * 22.5) * Math.PI / 180;
    return C(n(30 + 24 * Math.cos(a)), n(30 + 24 * Math.sin(a)), 2.4, 'gh');
  }),
  C(30, 30, 19, 'bs'), C(30, 30, 7, 'lo'), C(25, 25, 3.4, 'hi'),
]);
def('polar_body', () => [                                 // the same cell, with nothing kept
  C(38, 34, 17, 'gh'),
  C(16, 18, 7, 'bs'), C(14, 16, 2.2, 'lo'),
]);
def('zygote', () => [                                     // one cell, two pronuclei meeting
  C(30, 30, 19, 'bs'),
  C(24, 30, 7, 'lo'), C(36, 30, 7, 'lo'),
  C(22, 27, 2.4, 'hi'),
]);
def('morula', () => [                                     // sixteen, packed like a mulberry
  ...[[24, 22], [36, 22], [18, 30], [30, 28], [42, 30], [24, 38], [36, 38], [30, 46]]
    .map(([x, y]) => C(x, y, 7, 'bs')),
  ...[[24, 22], [42, 30], [30, 46]].map(([x, y]) => C(x - 2, y - 2, 2.4, 'hi')),
]);
def('blastocyst', () => [                                 // a hollow ball, cells at the rim
  ...Array.from({ length: 14 }, (_, i) => {
    const a = (i * 25.7) * Math.PI / 180;
    return C(n(30 + 19 * Math.cos(a)), n(30 + 19 * Math.sin(a)), 4.6, 'bs');
  }),
  C(30, 30, 15, 'gh'),
  ...[[24, 36], [31, 38], [27, 43]].map(([x, y]) => C(x, y, 4.6, 'lo')),   // inner cell mass
]);
def('stem_cell', () => [                                  // one cell, many possible futures
  C(22, 34, 11, 'bs'), C(19, 31, 3, 'hi'),
  ...[[42, 18], [48, 30], [42, 44]].map(([x, y]) =>
    [S(`M32 34 L${x - 4} ${y}`, 'gh', 1.4), C(x, y, 5, 'gh')]).flat(),
]);
def('gastrula', () => [                                   // layers, and the infold
  P('M10 22 Q30 14 50 22 Q30 30 10 22 Z', 'hi'),
  P('M10 31 Q30 23 50 31 Q30 39 10 31 Z', 'bs'),
  P('M10 40 Q30 32 50 40 Q30 48 10 40 Z', 'lo'),
  S('M30 18 Q30 30 30 42', 'ik', 2.4),
]);
def('embryo', () => [                                     // curled, and beginning to have parts
  P('M36 14 Q48 22 44 34 Q40 46 26 46 Q14 44 14 32 Q16 22 26 20 Q32 18 30 12 Z', 'bs'),
  C(34, 24, 6, 'lo'), C(32, 22, 2, 'hi'),
  S('M22 34 Q26 40 24 44', 'lo', 2),
]);
def('fetus', () => [                                      // the same curl, further along
  P('M38 12 Q52 22 46 36 Q40 50 24 50 Q10 47 11 32 Q13 20 25 18 Q32 16 31 10 Z', 'bs'),
  C(36, 22, 8, 'lo'), C(33, 19, 2.4, 'hi'), C(38, 21, 1.6, 'ik'),
  S('M20 34 Q26 42 22 48', 'lo', 2.4), S('M28 36 Q34 40 34 46', 'lo', 2),
]);
def('human', () => [                                      // uncurled at last: upright, on two legs
  C(30, 13, 7, 'bs'), C(27, 11, 2, 'hi'),                  // head
  P('M22 21 L38 21 L36 40 L24 40 Z', 'bs'),                // torso
  S('M23 23 L13 34', 'bs', 3.6), S('M37 23 L47 34', 'bs', 3.6),  // arms, out and down
  S('M27 40 L23 55', 'bs', 4), S('M33 40 L37 55', 'bs', 4),      // legs, apart
  S('M25 28 Q30 32 35 28', 'lo', 1.6),                     // waistline
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

/* ── the periodic table, drawn as what you would actually be holding ──────
 * Sixty-odd new elements land in one category, so "a grey lump" sixty times
 * would fail the sameness check and deserve to. Each one gets the physical
 * form it really takes: bromine is the only liquid non-metal, iodine sublimes
 * off crystals, molybdenite flakes into hexagonal plates, bismuth grows
 * stairstep hopper crystals, caesium melts just above room temperature. The
 * form IS the fact.
 */
const ingot = (r, w = 17, h = 11, sk = 4) => [
  P(`M${30 - w} ${34 - h} L${30 + w - sk} ${34 - h} L${30 + w} ${34 + h} L${30 - w + sk} ${34 + h} Z`, r),
  P(`M${30 - w} ${34 - h} L${30 + w - sk} ${34 - h} L${30 + w - sk - 3} ${30 - h} L${30 - w + 3} ${30 - h} Z`, 'hi'),
];
const rod = (r, len = 30, th = 6, ang = -25) =>
  ['g', ang, 30, 32, [P(`M${30 - len / 2} ${32 - th} L${30 + len / 2} ${32 - th} L${30 + len / 2} ${32 + th} L${30 - len / 2} ${32 + th} Z`, r),
                      S(`M${30 - len / 2} ${32 - th + 2} L${30 + len / 2} ${32 - th + 2}`, 'hi', 1.6)]];
const coil = (r, turns = 4, rad = 8) =>
  Array.from({ length: turns }, (_, i) =>
    ring(r, 30, 18 + i * 9, rad - i * 0.6, 2.4));
const foil = (r, folds = 3) =>
  Array.from({ length: folds }, (_, i) =>
    P(`M${12 + i * 3} ${22 + i * 8} L${48 - i * 3} ${18 + i * 8} L${48 - i * 3} ${26 + i * 8} L${12 + i * 3} ${30 + i * 8} Z`,
      i % 2 ? 'hi' : r));
const sponge = (r, seed = 7) => [
  P('M13 34 Q11 20 26 17 Q42 13 47 26 Q50 40 38 47 Q22 51 13 34 Z', r),
  ...granules('ground', 7, seed, [18, 22, 42, 44]),
];
const dendrite = (r, seed = 3) => {
  const out = [S('M30 52 L30 14', r, 3)];
  for (let i = 0; i < 5; i++) {
    const y = 20 + i * 7, w = 14 - i * 1.6, up = ((seed + i) % 2) ? 1 : -1;
    out.push(S(`M30 ${y} L${30 - w} ${y - 5 * up}`, r, 2));
    out.push(S(`M30 ${y + 2} L${30 + w} ${y - 3 * up}`, r, 2));
  }
  return out;
};
const prisms = (r, n = 3) =>
  Array.from({ length: n }, (_, i) => {
    const x = 30 + (i - (n - 1) / 2) * 13, h = 16 + (i % 2) * 7;
    return P(`M${x - 6} 46 L${x - 6} ${46 - h} L${x} ${40 - h} L${x + 6} ${46 - h} L${x + 6} 46 Z`, i % 2 ? 'hi' : r);
  });
const shot = (r, n = 5, seed = 11) => {
  const out = []; let sd = seed >>> 0;
  const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) out.push(C(n2(16 + rnd() * 28), n2(24 + rnd() * 20), 5.4 - rnd() * 1.4, i % 2 ? 'hi' : r));
  return out;
};
const n2 = v => Math.round(v * 100) / 100;
const flakes = (r, n = 4) =>
  Array.from({ length: n }, (_, i) =>
    hex(i % 2 ? 'hi' : r, 20 + (i % 2) * 18, 24 + Math.floor(i / 2) * 16, 9, 2.2));
const gasTube = (r, bulbs = 3) => [
  P('M14 26 Q14 20 20 20 L40 20 Q46 20 46 26 L46 38 Q46 44 40 44 L20 44 Q14 44 14 38 Z', 'gh'),
  S('M14 26 Q14 20 20 20 L40 20 Q46 20 46 26 L46 38 Q46 44 40 44 L20 44 Q14 44 14 38 Z', r, 2),
  ...Array.from({ length: bulbs }, (_, i) => C(22 + i * 8, 32, 3.4, r)),
];
const pool = (r) => [
  E(30, 40, 19, 7, r), E(24, 38, 6, 2.4, 'hi'),
  C(44, 28, 4.4, r), C(43, 27, 1.4, 'hi'),
];
const needles = (r, n = 6) =>
  Array.from({ length: n }, (_, i) => {
    const a = (-70 + i * 28) * Math.PI / 180;
    return S(`M30 44 L${n2(30 + 26 * Math.sin(a))} ${n2(44 - 26 * Math.cos(a))}`, i % 2 ? 'hi' : r, 2.4);
  });
const cubes = (r) => [
  P('M14 32 L24 26 L34 32 L24 38 Z', r), P('M14 32 L24 38 L24 48 L14 42 Z', 'lo'), P('M34 32 L24 38 L24 48 L34 42 Z', 'hi'),
  P('M30 22 L38 17 L46 22 L38 27 Z', r), P('M30 22 L38 27 L38 36 L30 31 Z', 'lo'), P('M46 22 L38 27 L38 36 L46 31 Z', 'hi'),
];
const hopper = (r) =>                                    // bismuth's stairstep
  Array.from({ length: 4 }, (_, i) => {
    const k = i * 5;
    return P(`M${16 + k} ${46 - k} L${44 - k} ${46 - k} L${44 - k} ${40 - k} L${16 + k} ${40 - k} Z`, i % 2 ? 'hi' : r);
  });
const disc = (r, n = 3) =>
  Array.from({ length: n }, (_, i) => E(30, 42 - i * 7, 16 - i, 5, i % 2 ? 'hi' : r));

/* halogens and the metalloids */
def('chlorine',  () => [vessel('gh', 20, 50), wave('bs', 44, 5, 13), wave('bs', 38, 4, 12), wave('lo', 32, 3, 10), E(30, 20, 12, 3, 'lo')]);  // denser than air, and it settles
def('fluorine',  () => [P('M16 20 L44 20 L44 30 Q38 36 44 42 L44 48 L16 48 Q22 42 16 36 Q22 30 16 24 Z', 'gh'), S('M16 20 L44 20 M16 48 L44 48', 'hi', 2.2), ...granules('bs', 7, 211, [20, 24, 40, 44])]);  // it attacks whatever holds it
def('bromine',   () => [P('M22 12 L38 12 L38 20 L42 26 L42 48 L18 48 L18 26 L22 20 Z', 'gh'), P('M19 34 L41 34 L41 47 Q30 50 19 47 Z', 'bs'), E(30, 34, 11, 3, 'lo'), S('M26 24 Q30 20 34 24', 'lo', 1.6)]);  // the only liquid non-metal, in a sealed ampoule
def('iodine',    () => [...prisms('lo', 2), S('M20 18 Q26 12 22 6 M38 18 Q44 12 40 6', 'bs', 2)]);  // subliming
def('silicon',   () => [P('M22 50 L22 20 Q30 10 38 20 L38 50 Z', 'bs'), S('M26 24 L26 46', 'hi', 2)]); // a boule
def('boron',     () => [mound('lo', 46, 19, 18), ...granules('ik', 14, 91, [14, 32, 46, 46])]);
def('arsenic',   () => [facet('lo', .95), facet('bs', .5), S('M18 24 L28 34', 'hi', 1.6)]);
def('selenium',  () => [...needles('bs', 5)]);
def('antimony',  () => [...Array.from({ length: 6 }, (_, i) => {
  const a = (i * 60) * Math.PI / 180;
  return S(`M30 32 L${n2(30 + 20 * Math.cos(a))} ${n2(32 + 20 * Math.sin(a))}`, 'bs', 3);
}), C(30, 32, 6, 'hi')]);                                 // the star of antimony
def('germanium', () => [...prisms('bs', 1), ...granules('hi', 5, 33, [22, 20, 38, 30])]);
def('tellurium', () => [...prisms('bs', 2), ...needles('lo', 3)]);
/* noble gases: tubes, differing by how many bulbs are lit */
def('argon',     () => [P('M12 44 Q12 20 30 18 Q48 20 48 44 Z', 'gh'), S('M12 44 Q12 20 30 18 Q48 20 48 44', 'bs', 2.4), E(30, 46, 13, 4, 'lo'), C(30, 40, 4, 'hi')]);  // an inert blanket over the weld
def('krypton',   () => [...gasTube('lo', 5)]);
def('xenon',     () => [S('M18 32 L27 32 M33 32 L42 32', 'lo', 4), C(30, 32, 9, 'hi'), C(30, 32, 4.4, 'bs'), ...Array.from({ length: 8 }, (_, i) => { const a = (i * 45) * Math.PI / 180; return S(`M${n2(30 + 12 * Math.cos(a))} ${n2(32 + 12 * Math.sin(a))} L${n2(30 + 18 * Math.cos(a))} ${n2(32 + 18 * Math.sin(a))}`, 'hi', 1.6); })]);  // the short-arc lamp
def('noble_mix', () => [...[[22, 26], [36, 24], [26, 38], [40, 36]].map(([x, y]) => C(x, y, 10, 'gh')), ...[[22, 26], [26, 38]].map(([x, y]) => C(x, y, 4, 'bs')), ...[[36, 24], [40, 36]].map(([x, y]) => C(x, y, 4, 'lo'))]);  // two gases, still mingled

/* the minerals the metals come out of */
def('fluorite',   () => cubes('bs'));
def('kelp',       () => [S('M30 54 Q22 40 30 28 Q38 16 30 6', 'bs', 3),
                         ...[[24, 44], [37, 36], [24, 26], [36, 16]].map(([x, y]) => leaf('lo', x, y, .7, 40))]);
def('borax',      () => [...prisms('hi', 4)]);
def('pyrolusite', () => dendrite('ik', 3));               // manganese dendrites in rock
def('molybdenite',() => [...flakes('lo', 4), S('M12 46 L48 42', 'ik', 1.6)]);
def('osmiridium', () => shot('lo', 7, 71));
def('pollucite',  () => [...prisms('bs', 2), ...granules('hi', 4, 17, [18, 18, 42, 26])]);
def('monazite',   () => [mound('bs', 47, 21, 17), ...granules('lo', 18, 53, [12, 32, 48, 47])]);
def('rare_earth', () => [mound('hi', 46, 18, 16), ...granules('bs', 9, 29, [16, 32, 44, 44]),
                         ...granules('lo', 7, 83, [18, 34, 42, 44])]);
def('baryte',     () => [...disc('bs', 4)]);              // tabular, heavy

/* transition metals — each in the form it is actually handled in */
def('manganese',  () => shot('bs', 6, 13));
def('cobalt',     () => [...ingot('bs', 15, 9, 3), C(22, 28, 2.6, 'hi')]);
def('tungsten',   () => coil('bs', 5, 9));                // the filament
def('molybdenum', () => [rod('bs', 34, 5, -18)]);
def('vanadium',   () => [...prisms('bs', 3)]);
def('cadmium',    () => [...disc('bs', 2), ...granules('lo', 4, 47, [20, 22, 40, 28])]);
def('palladium',  () => [...foil('bs', 3)]);
def('rhodium',    () => [...shot('hi', 4, 97), ring('bs', 30, 32, 20, 1.6)]);
def('iridium',    () => [...ingot('lo', 14, 12, 2), S('M18 26 L40 24', 'hi', 2)]);
def('osmium',     () => [mound('lo', 47, 16, 20), ...granules('bs', 11, 61, [16, 34, 44, 46])]);
def('ruthenium',  () => sponge('bs', 23));
def('rhenium',    () => [...foil('lo', 2), ...granules('hi', 6, 37, [18, 20, 42, 44])]);
def('hafnium',    () => [rod('lo', 22, 9, 62), C(30, 14, 4, 'hi'), C(30, 50, 4, 'hi')]);
def('zirconium',  () => sponge('hi', 41));
def('tantalum',   () => [...coil('bs', 3, 11), E(30, 50, 14, 4, 'lo')]);   // rolled into a capacitor
def('niobium',    () => [rod('hi', 30, 7, 14)]);
def('scandium',   () => [...prisms('hi', 2), C(40, 22, 3.4, 'bs')]);
def('yttrium',    () => [...prisms('hi', 1), ...granules('bs', 9, 59, [16, 30, 44, 46])]);

/* alkali, alkaline earth, and the heavy end */
def('lithium',    () => [...ingot('hi', 13, 10, 6), S('M20 26 L38 24', 'lo', 2.2)]);
def('caesium',    () => pool('hi'));                        // molten just above room temperature
def('rubidium',   () => [vessel('gh', 22, 48), ...shot('bs', 3, 181), wave('hi', 40, 3, 11)]);  // pellets, kept under oil
def('beryllium',  () => [...prisms('lo', 1), ...flakes('hi', 2)]);   // beryl, and how light it is
def('strontium',  () => [...shot('lo', 4, 101), ring('hi', 30, 32, 18, 1.4)]);
def('barium',     () => [...ingot('lo', 16, 8, 5), ...granules('hi', 4, 67, [20, 24, 40, 30])]);
def('radium',     () => [...Array.from({ length: 10 }, (_, i) => {
  const a = (i * 36) * Math.PI / 180;
  return S(`M30 32 L${n2(30 + 23 * Math.cos(a))} ${n2(32 + 23 * Math.sin(a))}`, 'gh', 1.6);
}), C(30, 32, 10, 'hi'), C(30, 32, 5, 'bs')]);            // it glowed, and that was the problem
def('thorium',    () => [...ingot('bs', 15, 12, 7)]);
def('plutonium',  () => [C(30, 34, 15, 'lo'), C(30, 34, 9, 'bs'), C(26, 30, 3, 'hi'), ring('gh', 30, 34, 22, 1.4)]);
def('polonium',   () => [...shot('bs', 2, 149), ...Array.from({ length: 6 }, (_, i) => {
  const a = (i * 60 + 15) * Math.PI / 180;
  return S(`M30 34 L${n2(30 + 22 * Math.cos(a))} ${n2(34 + 22 * Math.sin(a))}`, 'gh', 1.4);
})]);
def('bismuth',    () => hopper('bs'));                     // the stairstep hopper crystal
def('cerium',     () => [...shot('lo', 5, 151), S('M14 46 L46 44', 'bs', 2)]);
def('lanthanum',  () => [rod('bs', 28, 6, -62), ...granules('hi', 5, 233, [20, 20, 40, 44])]);
def('neodymium',  () => [...ingot('bs', 12, 13, 0), S('M22 22 L38 22 M22 46 L38 46', 'hi', 2.4)]);  // a magnet
def('samarium',   () => [...prisms('bs', 2), ...disc('lo', 2)]);
def('europium',   () => [...shot('hi', 3, 173), ...needles('bs', 3)]);
def('gadolinium', () => [...coil('lo', 3, 10)]);
def('promethium', () => [...disc('hi', 2), ...Array.from({ length: 5 }, (_, i) => {
  const a = (i * 72) * Math.PI / 180;
  return C(n2(30 + 20 * Math.cos(a)), n2(32 + 20 * Math.sin(a)), 2.4, 'gh');
})]);

/* the actinides finished, and the transactinides beyond them — synthetic,
   made an atom or a handful at a time. Drawn as the small bulk that little
   ever amounts to: an ingot, a rod, shot, foil, a sponge — never elaborate,
   just dense grey metal in whatever form the little of it that exists
   actually takes. */
def('neptunium',     () => [...ingot('bs', 17, 10, 4), C(21, 27, 1.8, 'hi')]);
def('protactinium',  () => [rod('bs', 24, 4, 48), C(30, 32, 2, 'hi')]);
def('actinium',       () => [...coil('bs', 4, 8), C(30, 13, 2, 'hi')]);
def('americium',      () => [...shot('bs', 5, 401)]);
def('curium',          () => [...flakes('bs', 3), ...granules('hi', 4, 521, [16, 20, 44, 26])]);
def('berkelium',       () => [...disc('bs', 1), S('M18 30 L42 30', 'hi', 1.4)]);
def('californium',    () => [                              // a small irregular nugget, not the palladium foil
  P('M14 24 L28 14 L46 20 L44 38 L26 46 L12 36 Z', 'bs'),
  C(34, 22, 2, 'hi'), C(20, 34, 1.6, 'gh'),
]);
def('technetium',     () => [                               // a thin blade, not the selenium needle-fan
  P('M20 30 L30 14 L40 30 L30 46 Z', 'bs'), S('M30 14 L30 46', 'hi', 1.4),
]);
def('astatine',        () => [                             // the rarest element on earth, drawn as barely there
  ring('gh', 30, 30, 15, 1), C(34, 26, 1.6, 'bs'),
  ...granules('gh', 2, 887, [22, 30, 38, 38]),
]);
def('rutherfordium',   () => [...sponge('bs', 727)]);
def('dubnium',          () => [...ingot('bs', 11, 14, 8), ...granules('hi', 3, 613, [20, 24, 40, 30])]);
def('seaborgium',      () => [hex('bs', 30, 30, 14, 2.4), C(30, 30, 4, 'hi')]);
def('bohrium',          () => [...dendrite('bs', 6)]);
def('hassium',          () => [rod('bs', 18, 3, 20), rod('lo', 18, 3, -20)]);
def('meitnerium',      () => [                             // a briquette, not the rare_earth heap
  P('M18 20 L42 20 L46 34 L36 46 L24 46 L14 34 Z', 'bs'), S('M22 26 L38 26', 'hi', 1.6),
]);
def('darmstadtium',    () => [                             // a handful of atoms, decaying as they're made
  ...Array.from({ length: 7 }, (_, i) => {
    const a = (i * 51.43) * Math.PI / 180;
    return S(`M30 30 L${n2(30 + 19 * Math.cos(a))} ${n2(30 + 19 * Math.sin(a))}`, 'gh', 1.4);
  }), C(30, 30, 4, 'bs'),
]);
def('roentgenium',     () => [ring('hi', 30, 30, 17, 2), ring('bs', 30, 30, 10, 2), C(30, 30, 3, 'hi')]);
def('copernicium',     () => [                             // the heaviest confirmed, held in orbit rather than a lump
  ring('gh', 30, 30, 19, 1.2),
  ...[0, 90, 180, 270].map(a => C(n2(30 + 19 * Math.cos(a * Math.PI / 180)), n2(30 + 19 * Math.sin(a * Math.PI / 180)), 2.6, 'bs')),
  C(30, 30, 5, 'hi'),
]);

/* the wider crop roster ───────────────────────────────────────────────── */
def('cotton', () => [                                      // the boll, split, fibre escaping
  ...[[24, 26], [36, 26], [22, 36], [38, 36], [30, 22], [30, 40]].map(([x, y]) => C(x, y, 9, 'hi')),
  C(30, 32, 8, 'hi'),
  ...[[26, 30], [34, 34]].map(([x, y]) => C(x, y, 2.4, 'lo')),   // the seeds inside
  S('M30 44 L30 54', 'plant-lo', 2.2),
]);
def('maize', () => [                                       // a cob, kernels stuck fast
  P('M22 12 Q30 8 38 12 L38 44 Q30 50 22 44 Z', 'bs'),
  ...[0, 1, 2, 3, 4, 5].map(i => S(`M23 ${17 + i * 5.5} L37 ${17 + i * 5.5}`, 'lo', 1.2)),
  ...[24, 30, 36].map(x => S(`M${x} 14 L${x} 46`, 'lo', 1)),
  P('M20 16 Q10 26 18 46 Z', 'plant-bs'), P('M40 16 Q50 26 42 46 Z', 'plant-bs'),
]);
def('popcorn', () => [                                     // burst, irregular, white
  ...[[22, 24], [34, 20], [40, 30], [30, 30], [20, 36], [34, 38], [26, 44]]
    .map(([x, y]) => C(x, y, 8, 'hi')),
  ...[[24, 24], [36, 30]].map(([x, y]) => C(x, y, 3, 'bs')),
]);
def('barley', () => [                                      // long awns, that is the tell
  stalk('plant-lo', 30, 54, 26),
  ...Array.from({ length: 6 }, (_, i) => grain('bs', 26 + (i % 2) * 8, 16 + i * 5, .8)),
  ...Array.from({ length: 6 }, (_, i) =>
    S(`M${26 + (i % 2) * 8} ${13 + i * 5} L${22 + (i % 2) * 16} ${2 + i * 4}`, 'hi', 1)),
]);
def('oat', () => [                                         // loose drooping panicle
  stalk('plant-lo', 30, 54, 20),
  ...[[18, 20], [42, 18], [22, 32], [38, 30], [30, 14]].map(([x, y]) =>
    [S(`M30 ${y + 4} Q${x} ${y + 2} ${x} ${y}`, 'plant-lo', 1.2), grain('bs', x, y, 1.1)]).flat(),
]);
def('soybean', () => [                                     // a pod, beans showing through
  P('M12 34 Q30 20 48 34 Q30 44 12 34 Z', 'bs'),
  ...[20, 30, 40].map(x => C(x, 33, 4.6, 'hi')),
]);
def('tofu', () => [                                        // a pressed block, cut clean
  P('M14 24 L40 20 L46 28 L46 44 L20 48 L14 40 Z', 'hi'),
  P('M14 24 L40 20 L46 28 L20 32 Z', 'bs'),
  S('M20 32 L20 48', 'lo', 1.4),
]);
def('pea', () => [                                         // pod split, peas in a row
  P('M10 30 Q30 18 50 30 Q30 34 10 30 Z', 'lo'),
  ...[18, 27, 36, 44].map(x => C(x, 34, 6, 'bs')),
  ...[18, 36].map(x => C(x - 2, 32, 2, 'hi')),
]);
def('carrot', () => [                                      // the taproot, and its feathery top
  P('M26 22 L34 22 L31 50 L29 50 Z', 'bs'),
  ...[28, 34, 40].map(y => S(`M${26.6 + (y - 22) * 0.07} ${y} L${33.4 - (y - 22) * 0.07} ${y}`, 'lo', 1)),
  ...[[22, 12], [30, 8], [38, 12]].map(([x, y]) => leaf('plant-bs', x, y, .5)),
  S('M30 22 L30 14', 'plant-lo', 1.6),
]);
def('lettuce', () => [                                     // loose leaves, all outer
  ...[[30, 34, 1.3, 0], [20, 32, 1, -35], [40, 32, 1, 35], [24, 40, .85, -15], [36, 40, .85, 15]]
    .map(([x, y, s, r]) => leaf('bs', x, y, s, r)),
  leaf('hi', 30, 32, .8),
]);
def('pumpkin', () => [                                     // ribbed, and squat
  E(30, 36, 20, 15, 'bs'),
  ...[-11, 0, 11].map(dx => S(`M${30 + dx} 22 Q${30 + dx * 1.35} 36 ${30 + dx} 50`, 'lo', 1.6)),
  S('M30 21 L30 14', 'plant-lo', 3.4),
  S('M32 15 Q38 10 36 6', 'plant-lo', 1.6),
]);
def('beet', () => [                                        // round root, tapering, leaves up
  C(30, 34, 14, 'bs'), P('M28 46 L32 46 L30 54 Z', 'bs'),
  S('M26 22 L24 10 M30 21 L30 8 M34 22 L36 10', 'plant-lo', 1.8),
  ...[[24, 9], [30, 7], [36, 9]].map(([x, y]) => leaf('plant-bs', x, y, .55)),
  S('M24 30 Q30 34 36 30', 'lo', 1.2),
]);
def('lemon', () => [                                       // the nipple at each end is the tell
  E(30, 32, 15, 12, 'bs'),
  P('M13 32 Q9 32 11 30 Z', 'bs'), P('M47 32 Q51 32 49 30 Z', 'bs'),
  E(25, 27, 5, 3.4, 'hi'),
  S('M30 20 L30 16', 'plant-lo', 1.6),
]);
def('strawberry', () => [                                  // achenes drawn ON the outside
  P('M30 50 Q14 40 16 28 Q18 18 30 18 Q42 18 44 28 Q46 40 30 50 Z', 'bs'),
  ...[[24, 26], [34, 25], [29, 32], [22, 35], [37, 34], [30, 41]].map(([x, y]) => C(x, y, 1.8, 'hi')),
  ...[[22, 16], [30, 13], [38, 16]].map(([x, y]) => leaf('plant-bs', x, y, .45)),
]);
def('banana', () => [                                      // the curve, and the ridges
  P('M12 22 Q16 42 34 48 Q48 50 50 40 Q36 42 26 34 Q18 28 18 20 Z', 'bs'),
  S('M16 24 Q22 40 36 45', 'hi', 1.4),
  S('M12 22 L10 18', 'lo', 3),
]);
def('pear', () => [                                        // narrow at the top, heavy at the base
  P('M30 14 Q34 22 34 26 Q44 32 44 40 A14 14 0 0 1 16 40 Q16 32 26 26 Q26 22 30 14 Z', 'bs'),
  E(24, 36, 5, 4, 'hi'),
  S('M30 14 L31 7', 'lo', 1.8),
]);
def('cherry', () => [                                      // a pair, on one stem
  S('M30 10 Q22 20 20 30 M30 10 Q38 22 40 32', 'plant-lo', 1.8),
  C(20, 36, 9, 'bs'), C(40, 38, 9, 'bs'),
  C(17, 33, 2.6, 'hi'), C(37, 35, 2.6, 'hi'),
]);
def('fig', () => [                                         // teardrop, and the ostiole at the tip
  P('M30 12 Q40 18 42 30 A14 14 0 0 1 18 30 Q20 18 30 12 Z', 'bs'),
  C(30, 41, 2.4, 'ik'),                                    // the opening the wasp goes in
  ...[[26, 26], [34, 28], [30, 33]].map(([x, y]) => C(x, y, 1.6, 'hi')),
  S('M30 12 L30 7', 'plant-lo', 1.6),
]);
def('coffee', () => [                                      // two seeds, flat faces together
  E(22, 32, 8, 12, 'bs'), E(38, 32, 8, 12, 'bs'),
  S('M22 21 Q19 32 22 43', 'lo', 1.6), S('M38 21 Q41 32 38 43', 'lo', 1.6),
]);
def('brewed_coffee', () => [                               // a cup, and what is in it
  P('M16 24 L42 24 L40 44 Q30 48 18 44 Z', 'hi'),
  E(29, 25, 13, 3.4, 'lo'),
  P('M42 28 Q50 28 50 34 Q50 40 42 40', 'hi'),
  S('M24 18 Q26 14 24 10 M32 18 Q34 14 32 10', 'gh', 1.6),
]);
def('cocoa', () => [                                       // the pod, ridged, off a trunk
  P('M30 10 Q42 16 42 32 Q42 48 30 52 Q18 48 18 32 Q18 16 30 10 Z', 'bs'),
  ...[-7, 0, 7].map(dx => S(`M${30 + dx} 13 Q${30 + dx * 1.4} 31 ${30 + dx} 49`, 'lo', 1.4)),
  S('M8 20 L18 24', 'craft-lo', 3.4),
]);
def('cocoa_bean', () => [                                  // fermented beans, out of the pod
  ...[[22, 26], [36, 24], [28, 34], [40, 36], [22, 42]].map(([x, y]) => E(x, y, 7, 5, 'lo')),
  ...[[22, 26], [28, 34]].map(([x, y]) => S(`M${x - 4} ${y} L${x + 4} ${y}`, 'bs', 1.2)),
]);
def('chocolate', () => [                                   // a moulded bar, squares scored in
  P('M12 20 L46 16 L48 40 L14 44 Z', 'bs'),
  S('M12 28 L47 24 M12 36 L47.5 32', 'lo', 1.6),
  S('M23 19 L24 43 M35 18 L36 42', 'lo', 1.6),
  P('M12 20 L46 16 L46.4 20 L12.2 24 Z', 'hi'),
]);

/* fibre, paper, ink — the made things ──────────────────────────────────── */
def('flax', () => [
  ...[22, 30, 38].map((x, i) => stalk('bs', x, 52, 14 + i * 2)),
  ...[[22, 14], [30, 12], [38, 16]].map(([x, y]) => C(x, y, 3.4, 'hi')),
]);
def('fibre', () => [                                       // loose, unspun, still a bundle
  ...[0, 1, 2, 3, 4].map(i =>
    S(`M${14 + i * 8} 48 Q${16 + i * 8} 30 ${13 + i * 8} 14`, i % 2 ? 'bs' : 'hi', 2)),
]);
def('thread', () => [                                      // the twist is the whole point
  S('M16 46 Q30 40 24 32 Q18 24 30 18 Q42 12 36 6', 'bs', 3.2),
  S('M20 44 Q30 39 25 33', 'hi', 1.2),
]);
def('cloth', () => [                                       // warp and weft, at right angles
  ...[20, 28, 36, 44].map(y => S(`M14 ${y} L46 ${y}`, 'bs', 2.6)),
  ...[18, 26, 34, 42].map(x => S(`M${x} 16 L${x} 48`, 'lo', 2)),
]);
def('clothing', () => [                                    // a cut and stitched shape
  P('M18 20 L24 16 L36 16 L42 20 L38 26 L38 46 L22 46 L22 26 Z', 'bs'),
  S('M24 16 Q30 22 36 16', 'lo', 1.8),
  S('M22 46 L38 46', 'hi', 1.4),
]);
def('pulp', () => [vessel('lo', 24), wave('bs', 34, 4, 13), ...granules('hi', 9, 331, [21, 30, 39, 44])]);
def('paper', () => [                                       // a sheet, one corner turned
  P('M16 12 L40 12 L44 20 L44 48 L16 48 Z', 'hi'),
  P('M40 12 L44 20 L40 20 Z', 'lo'),
  ...[26, 32, 38].map(y => S(`M22 ${y} L38 ${y}`, 'gh', 1.4)),
]);
def('oak_gall', () => [                                    // a hard ball on a twig
  S('M44 12 Q36 20 34 26', 'lo', 2.2),
  C(28, 34, 13, 'bs'), C(24, 29, 4, 'hi'), C(30, 38, 2, 'lo'),
]);
def('ink', () => [                                         // a well, and a nib above it
  P('M18 32 Q30 28 42 32 L40 46 Q30 50 20 46 Z', 'ik'),
  E(30, 32, 12, 4, 'lo'),
  P('M30 6 L34 22 L30 26 L26 22 Z', 'bs'), S('M30 16 L30 24', 'hi', 1),
]);
def('mirror', () => [                                      // glass, and the silver behind it
  P('M18 12 L42 12 Q46 12 46 16 L46 44 Q46 48 42 48 L18 48 Q14 48 14 44 L14 16 Q14 12 18 12 Z', 'lo'),
  P('M20 16 L40 16 L40 44 L20 44 Z', 'hi'),
  S('M24 40 L36 22', 'ground', 3),
]);
def('enriched_uranium', () => [                            // separated: the rare one, apart
  ...granules('gh', 12, 77, [12, 18, 34, 46]),
  C(44, 30, 9, 'bs'), C(41, 27, 3, 'hi'),
  S('M36 18 L36 44', 'ik', 1.4),
]);
def('warhead', () => [                                     // a cone, and the implosion ring
  ring('lo', 30, 34, 17, 2),
  P('M30 8 Q40 26 40 40 L20 40 Q20 26 30 8 Z', 'bs'),
  S('M22 46 L38 46', 'ik', 3),
  C(30, 32, 4, 'hi'),
]);

def('book', () => [                                        // a codex: bound at one edge
  P('M14 14 L30 18 L30 48 L14 44 Z', 'bs'),
  P('M46 14 L30 18 L30 48 L46 44 Z', 'lo'),
  S('M30 18 L30 48', 'ik', 2),
  ...[24, 30, 36].map(y => S(`M18 ${y} L27 ${y + 1}`, 'hi', 1.2)),
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
  // Blow and Smother are opposites and are drawn as opposites: air arriving,
  // and air shut out. Heat already owns the three rising wavy lines, so Blow
  // uses a narrowing cone of straight ones — a draught aimed at something,
  // not warmth drifting off it.
  blow: () => [
    P('M6 22 L20 30 L6 38 Z', 'ik'),                     // the nozzle
    ...[[24, 30, 46, 30], [24, 26, 42, 18], [24, 34, 42, 42]].map(([x1, y1, x2, y2]) =>
      S(`M${x1} ${y1} L${x2} ${y2}`, 'ik', 2.6)),
    ...[[48, 14], [50, 30], [48, 46]].map(([x, y]) => C(x, y, 2.2, 'gh')),
  ],
  smother: () => [
    flame('gh', .5, 12),                                 // a flame going out
    P('M8 20 L52 20 L52 27 L8 27 Z', 'ik'),              // the lid coming down on it
    S('M30 20 L30 10', 'ik', 3),
    S('M20 10 L40 10', 'ik', 3),
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


/* weather and the air ───────────────────────────────────────────────────
   Thirteen of these fall under one category, so the risk is thirteen grey
   blobs. Each is drawn from the geometry that actually distinguishes it:
   rain falls in strokes, snow is six-fold, hail is solid and bouncing,
   dew sits still on a leaf, frost grows on a surface, a hurricane spirals. */

/** The horizon every atmospheric drawing stands on. */
const horizon = (r, y = 46) => S(`M8 ${y} L52 ${y}`, r, 1.6);
/** A cloud: three overlapping lobes on a flat base. */
const puff = (r, cx = 30, cy = 26, s = 1) => [
  E(n(cx - 9 * s), n(cy + 3 * s), n(9 * s), n(7 * s), r),
  E(n(cx + 2 * s), n(cy - 3 * s), n(12 * s), n(10 * s), r),
  E(n(cx + 11 * s), n(cy + 4 * s), n(8 * s), n(6 * s), r),
];
/** A bolt: the zig-zag, drawn as a solid so it reads at 18px. */
const bolt = (r, cx = 30, top = 22, s = 1) => P(
  `M${n(cx + 4 * s)} ${n(top)} L${n(cx - 8 * s)} ${n(top + 14 * s)} ` +
  `L${n(cx - 1 * s)} ${n(top + 14 * s)} L${n(cx - 6 * s)} ${n(top + 28 * s)} ` +
  `L${n(cx + 9 * s)} ${n(top + 11 * s)} L${n(cx + 1 * s)} ${n(top + 11 * s)} Z`, r);

def('air',    () => [...[18, 28, 38].map((y, i) =>
                       S(`M${12 + i * 3} ${y} Q30 ${y - 6} ${48 - i * 3} ${y}`, i === 1 ? 'hi' : 'bs', 2.2)),
                     C(46, 44, 2.4, 'lo'), C(16, 44, 2, 'lo')]);
def('sky',    () => [P('M6 10 L54 10 L54 40 L6 40 Z', 'bs'),
                     P('M6 10 L54 10 L54 22 L6 22 Z', 'hi'),
                     C(41, 17, 4.5, 'lo'), horizon('lo', 46)]);
def('wind',   () => [S('M10 22 Q34 14 44 20 A6 6 0 1 0 40 30', 'hi', 2.8),
                     S('M12 34 Q32 28 40 34', 'bs', 2.4),
                     S('M16 43 Q30 39 36 43 A4.5 4.5 0 1 0 33 50', 'bs', 2.2)]);
def('dust',   () => [horizon('lo', 48),
                     P('M8 48 Q18 30 32 34 Q46 38 52 48 Z', 'bs'),
                     ...granules('hi', 12, 91, [12, 22, 48, 42])]);
def('cloud',  () => [...puff('bs'), ...puff('hi', 26, 22, .55)]);
def('mist',   () => [...[24, 31, 38, 45].map((y, i) =>
                       S(`M${10 + (i % 2) * 8} ${y} L${48 - (i % 2) * 6} ${y}`, i % 2 ? 'hi' : 'bs', 3.4))]);
def('fog',    () => [P('M12 20 L44 20 L40 46 L16 46 Z', 'lo'),          // a shape gone soft
                     ...[26, 33, 40].map((y, i) =>
                       S(`M8 ${y} L52 ${y}`, i === 1 ? 'hi' : 'bs', 5))]);
def('dew',    () => [leaf('lo', 30, 34, 1.35, 15),
                     E(26, 30, 4, 5, 'hi'), E(35, 37, 3, 3.8, 'hi'), E(31, 41, 2.2, 2.8, 'bs')]);
def('frost',  () => [horizon('lo', 48),
                     ...[16, 30, 44].map(x => [S(`M${x} 48 L${x} 26`, 'hi', 1.6),
                       S(`M${x} 34 L${x - 6} 28`, 'hi', 1.3), S(`M${x} 34 L${x + 6} 28`, 'hi', 1.3),
                       S(`M${x} 42 L${x - 5} 37`, 'bs', 1.2), S(`M${x} 42 L${x + 5} 37`, 'bs', 1.2)]).flat()]);
def('rain',   () => [...puff('lo', 28, 18, .8),
                     ...[[16, 32], [25, 36], [34, 32], [43, 37]].map(([x, y]) =>
                       S(`M${x} ${y} L${x - 3} ${y + 14}`, 'hi', 2.6))]);
def('snow',   () => [...[0, 60, 120].map(a =>
                       ['g', a, 30, 32, [S('M30 14 L30 50', 'hi', 2.2),
                                         S('M30 20 L25 25', 'hi', 1.6), S('M30 20 L35 25', 'hi', 1.6),
                                         S('M30 44 L25 39', 'hi', 1.6), S('M30 44 L35 39', 'hi', 1.6)]]),
                     C(30, 32, 3, 'bs')]);
def('hail',   () => [horizon('lo', 50),
                     C(20, 24, 6, 'hi'), C(37, 18, 5, 'bs'), C(31, 36, 7, 'hi'), C(45, 34, 4.5, 'bs'),
                     S('M20 44 Q24 40 28 44', 'lo', 1.6), S('M38 46 Q42 42 46 46', 'lo', 1.6)]);
def('storm',  () => [...puff('lo', 30, 20, 1.05),
                     bolt('hi', 30, 28, .8),
                     ...[[16, 34], [45, 36]].map(([x, y]) => S(`M${x} ${y} L${x - 2} ${y + 11}`, 'bs', 2.2))]);
def('lightning', () => [bolt('hi', 30, 8, 1.35), bolt('bs', 44, 20, .55)]);
def('thunder',() => [bolt('lo', 22, 10, .8),
                     ...[13, 20, 27].map((rad, i) =>                 // the sound going out
                       ['s', `M${n(38 - rad * .35)} ${n(34 - rad)} A${rad} ${rad} 0 0 1 ${n(38 - rad * .35)} ${n(34 + rad)}`,
                        i === 1 ? 'hi' : 'bs', 2.2])]);
def('rainbow',() => [...[22, 17, 12].map((rad, i) =>
                       ['s', `M${30 - rad} 44 A${rad} ${rad} 0 0 1 ${30 + rad} 44`,
                        ['lo', 'bs', 'hi'][i], 4.2]),
                     horizon('lo', 46)]);
def('ozone',  () => [C(30, 20, 6.5, 'hi'), C(19, 38, 6.5, 'bs'), C(41, 38, 6.5, 'bs'),
                     S('M30 20 L19 38', 'ik', 2), S('M30 20 L41 38', 'ik', 2)]);   // bent, three
def('hurricane', () => [S('M30 32 Q46 30 44 16 Q42 6 28 10 Q10 15 12 32 Q14 52 34 52', 'bs', 3.4),
                        S('M30 32 Q14 34 16 48 Q18 58 32 54', 'hi', 3),
                        C(30, 32, 4, 'lo')]);
def('blizzard', () => [...[[10, 18], [10, 30], [10, 42]].map(([x, y]) =>
                         S(`M${x} ${y} L${x + 34} ${y - 5}`, 'bs', 2.4)),
                       ...[[24, 14], [40, 26], [20, 38], [44, 44]].map(([x, y]) =>
                         [S(`M${x - 4} ${y} L${x + 4} ${y}`, 'hi', 1.6),
                          S(`M${x} ${y - 4} L${x} ${y + 4}`, 'hi', 1.6)]).flat()]);
def('flood',  () => [P('M10 34 L18 34 L18 24 L26 24 L26 34 L34 34 L34 18 L42 18 L42 34 L50 34 L50 52 L10 52 Z', 'lo'),
                     wave('bs', 38, 6, 22), wave('hi', 32, 5, 20)]);   // water above the rooftops
def('dune',   () => [P('M6 50 Q18 24 34 30 Q46 34 54 50 Z', 'bs'),
                     S('M6 50 Q18 24 34 30', 'hi', 2),                 // the sharp crest
                     P('M34 30 Q46 34 54 50 L34 50 Z', 'lo'),
                     horizon('lo', 50)]);
def('loess',  () => [...[[46, 'bs'], [40, 'lo'], [34, 'bs'], [28, 'lo']].map(([y, r]) =>
                       P(`M10 ${y} L50 ${y} L50 ${y + 6} L10 ${y + 6} Z`, r)),
                     ...granules('hi', 10, 233, [14, 30, 46, 50])]);
def('fulgurite', () => [P('M28 10 L34 10 L33 24 L38 26 L34 38 L37 40 L31 52 L27 40 L30 38 L26 26 L31 24 Z', 'gh'),
                        ...granules('bs', 8, 77, [16, 40, 46, 52])]);  // glass tube in the sand

/* what the two new verbs make ──────────────────────────────────────────── */
def('smoke',  () => [...[[20, 'bs'], [30, 'hi'], [40, 'bs']].map(([x, r]) =>
                       S(`M${x} 52 Q${x - 8} 40 ${x} 30 Q${x + 8} 20 ${x - 3} 10`, r, 3.2))]);
def('forge',  () => [P('M10 42 L50 42 L46 54 L14 54 Z', 'lo'),         // the hearth
                     flame('hi', .48, 8),
                     S('M50 30 Q58 34 52 40', 'ik', 3),                // the tuyere
                     E(30, 42, 14, 4, 'bs')]);
def('stockfish', () => [S('M14 12 L46 12', 'ik', 2),                   // the rack
                        ...[22, 38].map(x => [S(`M${x} 12 L${x} 20`, 'ik', 1.6),
                          P(`M${x} 20 Q${x - 7} 34 ${x} 48 Q${x + 7} 34 ${x} 20 Z`, 'bs'),
                          S(`M${x} 24 L${x} 44`, 'lo', 1.2)]).flat()]);
def('bottle', () => [P('M26 8 L34 8 L34 20 Q42 26 42 34 L42 50 Q42 54 38 54 L22 54 Q18 54 18 50 L18 34 Q18 26 26 20 Z', 'gh'),
                     P('M24 34 L28 34 L28 48 L24 48 Z', 'hi')]);       // the highlight down the glass
def('bone_char', () => [P('M18 42 L42 22', 'ik') && S('M18 42 L42 22', 'ik', 7),
                        C(16, 45, 5.5, 'ik'), C(21, 39, 5.5, 'ik'),
                        C(44, 19, 5.5, 'ik'), C(39, 25, 5.5, 'ik'),
                        ...granules('lo', 6, 41, [14, 46, 46, 54])]);
def('blackware', () => [P('M20 20 L40 20 L44 42 Q44 50 30 50 Q16 50 16 42 Z', 'ik'),
                        E(30, 20, 10, 3.5, 'lo'),
                        S('M22 30 Q30 34 38 30', 'gh', 1.6)]);         // a burnished line


/* made things ───────────────────────────────────────────────────────────
   Sixteen of these land in the `craft` category, whose fallback is a plain
   box, so they are the batch most at risk of turning into sixteen boxes.
   Each is drawn as its own silhouette — the shape you would recognise across
   a room — rather than as its material. */

def('steel',  () => [...ingot('bs', 18, 10), ...granules('ik', 5, 51, [16, 28, 44, 38])]);   // carbon in the iron
def('bronze', () => [...ingot('bs', 16, 9), C(22, 40, 3.4, 'lo'), C(38, 40, 3.4, 'lo')]);
def('brass',  () => [...ingot('hi', 16, 9), S('M14 40 L46 40', 'lo', 2)]);
def('solder', () => [P('M18 44 Q20 30 30 30 Q40 30 42 44 Z', 'hi'),                          // a bead run out
                     E(30, 44, 12, 4, 'bs'), C(24, 24, 4, 'bs'), C(37, 21, 3, 'bs')]);

def('hide',   () => [P('M14 18 Q10 30 16 40 L20 50 L28 44 L32 50 L40 44 L44 50 L48 38 Q52 28 46 18 L38 22 L30 16 L22 22 Z', 'bs'),
                     ...granules('lo', 6, 63, [20, 24, 40, 42])]);                            // still hairy
def('leather',() => [P('M14 18 Q10 30 16 40 L20 50 L28 44 L32 50 L40 44 L44 50 L48 38 Q52 28 46 18 L38 22 L30 16 L22 22 Z', 'lo'),
                     S('M18 26 Q30 22 44 26', 'hi', 1.6), S('M18 34 Q30 30 44 34', 'hi', 1.6)]);  // tanned, and grained
def('tannin', () => [hex('bs', 22, 26, 9, 2.2), hex('bs', 38, 34, 9, 2.2),
                     S('M28 30 L32 30', 'ik', 2), C(22, 17, 3, 'hi'), C(38, 43, 3, 'hi')]);   // a polyphenol, two rings
def('latex',  () => [S('M20 12 L20 34', 'lo', 3),                                             // the cut in the bark
                     S('M20 22 L34 30', 'lo', 2.6),
                     P('M34 30 Q40 38 40 44 A6 6 0 0 1 28 44 Q28 38 34 30 Z', 'hi')]);        // the drop hanging
def('rubber', () => [P('M16 26 Q16 16 30 16 Q44 16 44 26 Q44 40 30 46 Q16 40 16 26 Z', 'bs'),
                     ring('lo', 30, 28, 8, 2.4)]);
def('vulcanised_rubber', () => [ring('ik', 30, 32, 19, 7),                                    // a tyre, not a blob
                                ring('lo', 30, 32, 9, 2.4),
                                ...granules('hi', 5, 87, [22, 24, 38, 40])]);                 // the sulfur bridges

def('silkworm', () => [P('M12 34 Q12 26 20 26 L42 26 Q50 26 50 34 Q50 42 42 42 L20 42 Q12 42 12 34 Z', 'hi'),
                       ...[20, 27, 34, 41].map(x => S(`M${x} 27 L${x} 41`, 'lo', 1.4)),
                       C(48, 31, 1.6, 'ik')]);
def('cocoon',   () => [E(30, 32, 13, 19, 'hi'),
                       ...[0, 1, 2].map(i => ['s', `M${18 + i * 2} ${24 + i * 8} Q30 ${20 + i * 8} ${42 - i * 2} ${24 + i * 8}`, 'lo', 1.4])]);
def('silk',     () => [P('M10 20 Q30 14 50 20 L50 26 Q30 20 10 26 Z', 'hi'),                  // cloth with a sheen
                       P('M10 30 Q30 24 50 30 L50 36 Q30 30 10 36 Z', 'bs'),
                       P('M10 40 Q30 34 50 40 L50 46 Q30 40 10 46 Z', 'hi')]);
def('canvas',   () => [P('M12 16 L48 16 L48 48 L12 48 Z', 'bs'),                              // coarse, visible weave
                       ...[20, 28, 36, 44].map(x => S(`M${x} 16 L${x} 48`, 'lo', 2)),
                       ...[24, 32, 40].map(y => S(`M12 ${y} L48 ${y}`, 'hi', 2))]);

def('coin',   () => [C(30, 32, 17, 'bs'), ring('lo', 30, 32, 13, 1.6), C(30, 32, 6, 'hi')]);
def('nail',   () => [P('M27 14 L33 14 L32 42 L30 50 L28 42 Z', 'bs'), E(30, 14, 9, 3, 'hi')]);
def('knife',  () => [P('M12 30 L36 22 L40 30 L36 34 L12 34 Z', 'gh'),                          // blade, then tang
                     P('M36 24 L50 27 L50 33 L36 32 Z', 'lo'),
                     S('M14 32 L34 32', 'hi', 1.4)]);
def('needle', () => [P('M26 12 L30 10 L34 12 L32 48 L30 52 L28 48 Z', 'gh'),
                     E(30, 18, 3.4, 5, 'ground')]);                                            // the eye
def('rope',   () => [...[0, 1, 2].map(i =>
                       S(`M8 ${22 + i * 9} Q18 ${16 + i * 9} 28 ${22 + i * 9} Q38 ${28 + i * 9} 52 ${22 + i * 9}`,
                         i === 1 ? 'hi' : 'bs', 5))]);                                         // laid strands
def('wheel',  () => [ring('lo', 30, 32, 20, 5), ring('bs', 30, 32, 6, 3),
                     ...[0, 45, 90, 135].map(a =>
                       ['g', a, 30, 32, [S('M30 14 L30 50', 'bs', 2.2)]])]);
def('lamp',   () => [P('M16 40 Q16 30 30 30 Q44 30 44 40 Q44 46 30 46 Q16 46 16 40 Z', 'bs'),  // a pinched oil lamp
                     P('M44 36 L54 32 L54 38 L44 40 Z', 'bs'),
                     flame('hi', .22, -14)]);
def('shoe',   () => [P('M12 44 L12 32 Q12 26 20 26 L26 26 L30 32 Q38 34 46 38 Q52 40 52 44 Z', 'bs'),
                     S('M12 44 L52 44', 'lo', 3),
                     ...[16, 21].map(x => S(`M${x} 28 L${x + 6} 34`, 'hi', 1.4))]);            // the lacing
def('pipe',   () => [P('M10 26 L50 26 L50 38 L10 38 Z', 'lo'),
                     E(10, 32, 4, 6, 'bs'), E(50, 32, 4, 6, 'hi'),
                     S('M10 29 L50 29', 'hi', 1.6)]);                                          // seen down the bore
def('plough', () => [S('M12 18 L34 34', 'ik', 3.4),                                            // the beam
                     P('M34 34 Q46 36 48 46 L30 46 Q30 38 34 34 Z', 'gh'),                     // the share
                     S('M20 24 L20 44', 'ik', 2.4)]);

/* the road to plastic, which never once passes through petroleum */
def('peat',   () => [...[44, 38, 32].map((y, i) =>
                       P(`M12 ${y} L48 ${y} L48 ${y + 6} L12 ${y + 6} Z`, i % 2 ? 'lo' : 'bs')),
                     ...[18, 30, 42].map(x => S(`M${x} 26 Q${x + 2} 20 ${x} 14`, 'hi', 1.8))]);  // the plants still showing
def('coal',   () => [facet('ik'), facet('lo', .55),
                     S('M20 26 L28 20', 'hi', 1.6), S('M36 40 L44 34', 'hi', 1.6)]);            // conchoidal glints
def('coal_tar', () => [vessel('lo', 22, 48), P('M16 32 L44 32 L43 46 Q30 50 17 46 Z', 'ik'),
                       E(30, 32, 14, 3.4, 'ground')]);
def('wood_tar',  () => [P('M22 12 Q22 26 30 32 Q38 26 38 12 Z', 'lo'),                          // a retort dripping
                        P('M30 34 Q35 42 35 47 A5 5 0 0 1 25 47 Q25 42 30 34 Z', 'ik'),
                        E(30, 52, 9, 3, 'ik')]);
def('phenol', () => [hex('bs', 26, 34, 13, 2.4), S('M37 26 L45 20', 'ik', 2), C(46, 19, 4, 'hi')]);  // the ring and its -OH
def('methanol', () => [C(24, 32, 6, 'ik'), C(38, 28, 5, 'hi'), S('M30 31 L34 29', 'ik', 2),
                       S('M24 32 L16 38', 'ik', 1.8), S('M24 32 L18 24', 'ik', 1.8)]);
def('formaldehyde', () => [C(26, 34, 6, 'ik'), C(40, 26, 5.4, 'bs'),
                           ...double([26, 34], [40, 26], 'ik'),
                           S('M26 34 L18 42', 'ik', 1.8), S('M26 34 L18 27', 'ik', 1.8)]);
def('ethylene', () => [C(21, 32, 5.4, 'ik'), C(39, 32, 5.4, 'ik'),
                       ...double([21, 32], [39, 32], 'hi'),
                       ...[[14, 24], [14, 40], [46, 24], [46, 40]].map(([x, y]) => S(`M${x < 30 ? 21 : 39} 32 L${x} ${y}`, 'ik', 1.6))]);
def('ethanol', () => [vessel('gh', 24, 48), P('M18 34 L42 34 L41 46 Q30 49 19 46 Z', 'hi'),
                      E(30, 34, 12, 3, 'ground'), C(30, 20, 3, 'hi')]);
def('galalith', () => [...[[20, 24], [40, 24], [20, 42], [40, 42]].map(([x, y]) =>
                         [C(x, y, 8, 'hi'), C(x - 2.6, y, 1.6, 'ground'), C(x + 2.6, y, 1.6, 'ground')]).flat()]);  // buttons, which is what it was
def('bakelite', () => [P('M14 40 Q14 24 30 24 Q46 24 46 40 Z', 'ik'),                           // a moulded case
                       P('M14 40 L46 40 L46 46 L14 46 Z', 'lo'),
                       C(30, 33, 5, 'lo'), ring('hi', 30, 33, 8, 1.4)]);
def('polyethylene', () => [...backbone('ik', 6, 30, 26).shape ? [backbone('ik', 6, 30, 26).shape] : [],
                           ...backbone('hi', 6, 30, 40).shape ? [backbone('hi', 6, 30, 40).shape] : [],
                           ...granules('bs', 4, 141, [16, 30, 44, 38])]);                        // the chain, repeating


/* rock, and what heat and pressure do to it ─────────────────────────────
   The metamorphic ladder is drawn as a ladder: mudstone's random specks
   become slate's one flat cleavage, then phyllite's sheen, then schist's
   coarse mica bands, then gneiss's separated light and dark stripes. You
   should be able to see the grade rise across five cards. */
const banded = (r1, r2, n = 5, wob = 0) =>
  Array.from({ length: n }, (_, i) =>
    P(`M10 ${12 + i * 8} Q30 ${12 + i * 8 - wob} 50 ${12 + i * 8} L50 ${18 + i * 8} Q30 ${18 + i * 8 - wob} 10 ${18 + i * 8} Z`,
      i % 2 ? r2 : r1));
const gem = (r, facets = 6) => [
  P('M30 8 L48 24 L30 52 L12 24 Z', r),
  P('M30 8 L48 24 L30 30 L12 24 Z', 'hi'),
  ...Array.from({ length: facets }, (_, i) =>
    S(`M30 30 L${n(12 + i * 7.2)} 24`, 'ground', 1.2)),
];

def('magma',  () => [P('M8 46 Q14 26 30 30 Q46 34 52 46 Z', 'bs'), ...granules('hi', 9, 31, [14, 32, 46, 44]), S('M8 46 L52 46', 'lo', 2.4)]);
def('lava',   () => [P('M6 24 L54 24 L54 30 Q40 34 30 30 Q18 26 6 32 Z', 'lo'),   // the crust it flows out from under
                     P('M8 34 Q20 40 30 38 Q44 36 52 44 L52 52 L8 52 Z', 'hi'),
                     ...granules('bs', 5, 77, [14, 40, 46, 50])]);
def('basalt', () => [...[16, 30, 44].map((x, i) =>                                 // columnar jointing
                       P(`M${x - 7} 50 L${x - 7} ${18 + i * 4} L${x} ${13 + i * 4} L${x + 7} ${18 + i * 4} L${x + 7} 50 Z`, i === 1 ? 'bs' : 'lo')),
                     S('M9 50 L51 50', 'ik', 2)]);
def('granite',() => [lump('lo', 30, 32, 22, 19),
                     ...granules('hi', 7, 12, [14, 20, 46, 44]),
                     ...granules('ik', 5, 91, [16, 22, 44, 42]),
                     ...granules('bs', 6, 44, [15, 21, 45, 43])]);              // three minerals, visibly
def('obsidian', () => [P('M12 40 L22 12 L40 16 L50 36 L34 50 Z', 'ik'),
                       S('M22 14 Q30 26 26 46', 'gh', 1.6), S('M40 18 Q34 30 42 44', 'gh', 1.4)]);  // conchoidal
def('pumice', () => [lump('hi', 30, 32, 21, 17), ...granules('ground', 16, 5, [13, 18, 47, 46])]);   // full of holes
def('quartz', () => [P('M22 50 L22 22 L30 10 L38 22 L38 50 Z', 'gh'),
                     S('M22 22 L38 22', 'hi', 1.6), S('M30 10 L30 50', 'hi', 1.2)]);
def('feldspar', () => [P('M16 46 L20 18 L42 14 L46 42 Z', 'hi'),
                       S('M20 18 L46 42', 'lo', 1.6), S('M18 32 L44 28', 'lo', 1.4)]);   // two cleavages at 90°
def('mica',   () => [...[0, 1, 2, 3].map(i =>
                       P(`M${12 + i * 2} ${40 - i * 6} L${48 - i * 2} ${36 - i * 6} L${48 - i * 2} ${40 - i * 6} L${12 + i * 2} ${44 - i * 6} Z`,
                         i % 2 ? 'hi' : 'bs'))]);                                        // splits into sheets
def('sandstone', () => [P('M10 20 L50 20 L50 48 L10 48 Z', 'bs'), ...granules('hi', 22, 8, [13, 23, 47, 45])]);
def('mudstone',  () => [P('M10 20 L50 20 L50 48 L10 48 Z', 'lo'), ...granules('bs', 7, 63, [14, 24, 46, 44])]);
def('shale',     () => [...banded('lo', 'bs', 5)]);
def('conglomerate', () => [P('M10 20 L50 20 L50 48 L10 48 Z', 'lo'),
                           ...[[20, 30, 6], [34, 27, 8], [44, 38, 5], [24, 42, 6], [36, 42, 4]]
                             .map(([x, y, r]) => C(x, y, r, 'hi'))]);                    // pebbles in a matrix
def('slate',    () => [P('M10 16 L50 12 L50 20 L10 24 Z', 'ik'), P('M10 26 L50 22 L50 32 L10 36 Z', 'lo'),
                       P('M10 38 L50 34 L50 46 L10 50 Z', 'ik')]);                        // splits into flat plates
def('phyllite', () => [P('M10 22 Q30 14 50 22 L50 42 Q30 50 10 42 Z', 'lo'),             // crinkled, and it shines
                       ...[26, 32, 38].map(y => S(`M12 ${y} Q30 ${y - 6} 48 ${y}`, 'hi', 2))]);
def('schist',   () => [...banded('lo', 'hi', 5, 5),
                       ...granules('ik', 8, 23, [14, 18, 46, 46])]);                     // coarse mica
def('gneiss',   () => [...banded('ik', 'hi', 5, 7)]);                                    // light and dark separated
def('marble',   () => [lump('hi', 30, 32, 21, 18),
                       S('M14 26 Q26 34 30 24 Q36 14 46 22', 'lo', 1.8),
                       S('M16 40 Q28 46 34 38 Q40 32 48 36', 'bs', 1.4)]);               // veining
def('quartzite',() => [lump('gh', 30, 32, 21, 18), ...granules('hi', 14, 39, [16, 20, 44, 44])]);
def('lignite',  () => [P('M12 24 L48 24 L48 46 L12 46 Z', 'lo'),
                       ...[28, 34, 40].map(y => S(`M14 ${y} Q30 ${y - 3} 46 ${y}`, 'bs', 1.6)),
                       ...granules('hi', 4, 55, [16, 26, 44, 44])]);                     // wood still legible
def('anthracite', () => [facet('ik'), facet('lo', .5), S('M18 24 L26 16', 'gh', 2.2), S('M36 44 L46 36', 'gh', 1.8)]);
def('corundum', () => [P('M20 50 L20 20 L30 8 L40 20 L40 50 Z', 'bs'),
                       P('M20 20 L40 20 L40 26 L20 26 Z', 'hi'), S('M30 8 L30 50', 'lo', 1.4)]);
def('diamond',  () => [...gem('gh', 6), S('M12 24 L48 24', 'hi', 1.6)]);
def('ruby',     () => [P('M20 50 L20 24 L30 12 L40 24 L40 50 Z', 'bs'),
                       P('M20 24 L40 24 L40 32 L20 32 Z', 'hi'),
                       ...[26, 34].map(x => S(`M${x} 32 L${x} 50`, 'lo', 1.4))]);   // corundum's barrel
def('sapphire', () => [P('M30 8 L44 26 L38 52 L22 52 L16 26 Z', 'lo'),
                       P('M30 8 L44 26 L16 26 Z', 'hi'),
                       S('M22 52 L30 26 L38 52', 'ground', 1.2)]);
def('emerald',  () => [P('M18 12 L42 12 L48 20 L48 42 L42 50 L18 50 L12 42 L12 20 Z', 'bs'),   // the emerald cut
                       P('M18 12 L42 12 L48 20 L12 20 Z', 'hi'),
                       S('M12 20 L48 20 M12 42 L48 42', 'ground', 1.2)]);
def('opal',     () => [lump('gh', 30, 32, 20, 17),
                       ...[[22, 26, 'bs'], [36, 24, 'hi'], [30, 38, 'lo'], [40, 38, 'bs'], [21, 38, 'hi']]
                         .map(([x, y, r]) => E(x, y, 6, 4, r))]);                        // play of colour

/* mineral — batch additions: real carbonate/silicate/phosphate gem species,
   each in its own actual crystal habit rather than another faceted lump. */
def('nephrite',  () => [                                   // felted fibres, no cleavage at all — too tough to facet
  lump('bs', 30, 32, 21, 17),
  S('M14 26 Q30 20 46 28 M13 33 Q30 27 47 35 M15 40 Q30 35 45 42', 'hi', 1.4),
]);
def('chrysocolla', () => [                                 // botryoidal blue-green, black manganese oxide bleeding through
  ...[[20, 34, 8], [32, 27, 7], [41, 37, 6], [24, 44, 6]].map(([x, y, r]) => C(x, y, r, 'bs')),
  S('M18 41 Q28 34 24 25 M37 42 Q41 34 44 27', 'ik', 1.2),
]);
def('dioptase',  () => [                                   // short glassy rhombs, emerald-green but never cut like emerald
  ...[[21, 35], [34, 25], [41, 40]].map(([x, y]) =>
    P(`M${x - 6} ${y} L${x} ${y - 7} L${x + 6} ${y} L${x} ${y + 7} Z`, 'bs')),
  S('M21 28 L21 42 M34 18 L34 32', 'hi', 1),
]);
def('dolomite',  () => [                                   // saddle dolomite: curved rhomb faces, not calcite's flat ones
  P('M14 32 Q22 16 30 28 Q38 16 46 32 Q38 46 30 34 Q22 46 14 32 Z', 'bs'),
  S('M22 20 Q30 26 30 30 Q30 26 38 20', 'hi', 1.2),
]);
def('aragonite', () => [                                   // same CaCO3 as calcite, twinned into a six-rayed spray instead
  ...[0, 60, 120, 180, 240, 300].map(a =>
    S(`M30 32 L${n(30 + 20 * Math.cos(a * Math.PI / 180))} ${n(32 + 20 * Math.sin(a * Math.PI / 180))}`, 'bs', 2.4)),
  C(30, 32, 3, 'hi'),
]);
def('rhodochrosite', () => [                                // concentric rose-red bands, grown stalactite-style
  ...[18, 14, 10, 6].map((rad, i) => S(`M${30 - rad} 36 A${rad} ${rad} 0 0 1 ${30 + rad} 36`, i % 2 ? 'hi' : 'bs', 2.4)),
]);
def('rhodonite', () => [                                   // pink, until metamorphism drives the carbon off rhodochrosite —
  E(30, 32, 20, 16, 'bs'),                                 // what is left is this, laced with black dendrites instead of rings
  ...dendrite('ik', 5),
]);
def('smithsonite', () => [                                 // a fine mint-blue druse, not chrysocolla's few fat blobs
  ...[[18, 40], [24, 34], [30, 42], [36, 33], [42, 39], [22, 46], [34, 46], [40, 46]]
    .map(([x, y], i) => [C(x, y, 3.6, 'bs'), C(x - 1, y - 1, 1, 'hi')]).flat(),
]);
def('cerussite', () => [                                   // reticulated: crystals twinned into a lattice net, not a mass
  ...[16, 24, 32, 40].map(x => S(`M${x} 14 L${x + 12} 50`, 'gh', 1.6)),
  ...[16, 24, 32, 40].map(x => S(`M${x + 12} 14 L${x} 50`, 'gh', 1.6)),
  C(30, 32, 2.6, 'hi'),
]);
def('anglesite', () => [                                   // the pale crust galena weathers into, still sitting on it
  P('M16 40 L44 40 L44 50 L16 50 Z', 'lo'),
  P('M20 22 L40 22 L38 40 L22 40 Z', 'hi'), S('M22 26 L38 26', 'gh', 1.2),
]);
def('celestine', () => [                                   // pale blue, tabular blades fanned from one root
  ...[-24, 0, 24].map(a =>
    ['g', a, 30, 44, [P('M26 44 L34 44 L32 12 L28 12 Z', 'bs')]]),
  S('M28 12 L32 12', 'hi', 1.4),
]);
def('titanite',  () => [                                   // sphene's wedge — an envelope shape, unlike anything else here
  P('M16 40 L30 12 L44 40 L36 46 L24 46 Z', 'bs'),
  S('M16 40 L44 40', 'hi', 1.4),
]);
def('epidote',   () => [                                   // pistachio-green, striated the length of one long prism
  P('M24 50 L20 18 L30 6 L36 20 L34 50 Z', 'bs'),
  ...[22, 44].map(y => S(`M22 ${y} L32 ${y - 26}`, 'hi', 1)),
]);
def('staurolite', () => [                                  // the fairy cross: two prisms genuinely twinned near 90°
  P('M14 30 L46 30 L46 36 L14 36 Z', 'lo'),
  P('M27 8 L33 8 L33 52 L27 52 Z', 'bs'),
]);
def('danburite', () => [                                   // pale, double-terminated — topaz's habit, a borosilicate's chemistry
  P('M30 6 L38 16 L38 44 L30 54 L22 44 L22 16 Z', 'hi'),
  S('M22 16 L38 16 M22 44 L38 44', 'gh', 1.2),
]);
def('datolite',  () => [                                   // glassy nodules packed into a basalt gas cavity
  ...[[20, 36, 8], [32, 30, 9], [42, 38, 7], [26, 46, 6]].map(([x, y, r]) => C(x, y, r, 'hi')),
  C(32, 27, 2.4, 'gh'),
]);
def('axinite',   () => [                                   // the axe-blade its name describes — thin, sharp, brown
  P('M30 8 L36 26 L48 34 L30 40 L12 34 L24 26 Z', 'bs'),
  S('M30 8 L30 40', 'hi', 1),
]);
def('dumortierite', () => [                                // fibrous, blue, growing as one parallel bundle
  ...[16, 21, 26, 30, 34, 39, 44].map(x => S(`M${x} 50 L${x + (30 - x) * .3} 10`, 'bs', 2)),
]);
def('prehnite',  () => [                                   // pale green, scalloped into a botryoidal fan at the vug wall
  P('M12 44 Q12 20 30 18 Q48 20 48 44 Z', 'lo'),
  ...[18, 24, 30, 36, 42].map(x => E(x, 42, 4, 5, 'hi')),
]);
def('petalite',  () => [                                   // one flat tabular plate, splitting along a perfect cleavage
  P('M18 14 L42 18 L40 48 L16 44 Z', 'hi'),
  S('M22 22 L38 26 M20 32 L37 35', 'gh', 1),
]);
def('euclase',   () => [                                   // "good fracture" — a slender prism, shown cleanly broken
  P('M26 10 L34 10 L32 30 L36 32 L34 52 L26 52 L28 32 L24 30 Z', 'bs'),
]);
def('brazilianite', () => [                                // a cluster of stubby yellow-green prisms
  ...[[22, 44, 0], [30, 46, 8], [38, 42, -6]].map(([x, base, tilt]) =>
    P(`M${x - 5} ${base} L${x - 5 + tilt * .3} ${base - 26} L${x + 5 + tilt * .3} ${base - 26} L${x + 5} ${base} Z`, 'bs')),
]);
def('beryllonite', () => [                                 // colourless, a single flat monoclinic tablet
  P('M30 10 L46 30 L34 50 L14 34 Z', 'gh'),
  S('M30 10 L34 50', 'hi', 1),
]);
def('amblygonite', () => [                                 // massive and blocky, cleaving off in clean steps
  P('M16 20 L44 20 L44 32 L38 32 L38 44 L16 44 Z', 'lo'),
  S('M16 32 L38 32 M28 20 L28 44', 'hi', 1),
]);
def('phosphophyllite', () => [                              // blue-green, cleaving leaf-thin — drawn as the leaf it is named for
  leaf('bs', 30, 30, 1.7, 8),
  S('M30 14 L30 46', 'hi', 1),
]);
def('hambergite', () => [                                  // colourless, needle-thin, always growing in a pair
  S('M22 50 L26 8', 'gh', 2), S('M34 50 L38 8', 'gh', 2),
]);
def('scheelite', () => [                                   // dipyramidal — two pyramids base to base — and it glows blue under UV
  P('M30 6 L44 30 L30 32 L16 30 Z', 'bs'), P('M30 32 L44 30 L30 54 L16 30 Z', 'hi'),
  ring('gh', 30, 30, 22, 1),
]);
def('cassiterite', () => [                                 // visor-twinned: two prisms elbowed together, dark and heavy
  P('M14 44 L18 20 L26 16 L24 34 Z', 'lo'), P('M24 34 L34 24 L46 26 L38 44 Z', 'bs'),
]);
def('jet',       () => [                                   // lignite, carved smooth and polished for jewellery — never faceted
  P('M30 10 Q42 14 42 30 Q42 46 30 52 Q18 46 18 30 Q18 14 30 10 Z', 'ik'),
  C(30, 12, 2, 'gh'), S('M24 20 Q22 30 26 40', 'hi', 1.4),
]);
def('amber',     () => [                                   // resin, set with whatever wandered in before it hardened
  P('M30 8 Q44 16 42 32 Q40 48 30 52 Q20 48 18 32 Q16 16 30 8 Z', 'hi'),
  E(30, 32, 5, 2, 'ik'), S('M25 32 L27 30 M33 32 L35 34', 'ik', 1),
]);
def('ochre',     () => [                                   // an iron earth, ground fine enough to paint or stain skin with
  mound('bs', 46, 19, 16), ...granules('hi', 10, 19, [14, 32, 46, 46]),
  S('M18 50 Q26 44 34 50', 'lo', 3),
]);

/* the very small and the very large ─────────────────────────────────────
   Two ends of the same ladder, so they share one visual language: the
   subatomic tier is flat discs with a mark, the cosmic tier is light
   against dark. Nothing here is a generic glow — photon and gamma ray are
   the same phenomenon at different wavelength and are drawn as such. */
def('up_quark',   () => [C(30, 32, 13, 'hi'), S('M23 32 L37 32', 'ik', 3), S('M30 25 L30 39', 'ik', 3)]);   // +
def('down_quark', () => [P('M30 17 L44 40 L16 40 Z', 'bs'), S('M23 33 L37 33', 'ik', 3)]);   // −, and a different body
def('proton',     () => [C(30, 32, 17, 'bs'), S('M22 32 L38 32', 'hi', 3.4), S('M30 24 L30 40', 'hi', 3.4)]);
def('neutron',    () => [C(30, 32, 17, 'lo'), C(30, 32, 8, 'ground')]);                                     // no charge
def('electron',   () => [C(30, 32, 7, 'ik'), S('M24 32 L36 32', 'hi', 2.4),
                         ['g', -25, 30, 32, [ring('bs', 30, 32, 21, 1.6)]]]);
def('atomic_nucleus', () => [...[[24, 28], [36, 28], [30, 38]].map(([x, y]) => C(x, y, 9, 'bs')),
                             ...[[30, 24], [24, 36], [37, 37]].map(([x, y]) => C(x, y, 8, 'lo'))]);
def('photon',   () => [S('M8 32 Q14 18 20 32 Q26 46 32 32 Q38 18 44 32 Q50 46 54 34', 'hi', 3)]);
def('gamma_ray',() => [S('M6 32 Q9 20 12 32 Q15 44 18 32 Q21 20 24 32 Q27 44 30 32 Q33 20 36 32 Q39 44 42 32 Q45 20 48 32 Q51 44 54 32', 'bs', 3)]);  // same wave, far shorter
def('plasma',   () => [...[[18, 22], [34, 18], [26, 40], [42, 36]].map(([x, y], i) =>
                         [C(x, y, 4, i % 2 ? 'hi' : 'bs'), C(x + 8, y + 6, 2.2, 'ik')]).flat(),
                       ...[[14, 30, 46, 26], [16, 44, 44, 40]].map(([a, b, c2, d]) => S(`M${a} ${b} L${c2} ${d}`, 'lo', 1.2))]);
def('deuterium',() => [C(24, 32, 9, 'bs'), C(36, 32, 9, 'lo'), C(30, 14, 4, 'ik'), ring('hi', 30, 30, 20, 1.4)]);
def('tritium',  () => [C(22, 34, 8, 'bs'), C(34, 36, 8, 'lo'), C(30, 24, 8, 'lo'), C(46, 14, 4, 'ik'), ring('hi', 30, 32, 21, 1.4)]);
def('fission_product', () => [P('M30 30 L14 16 L20 34 L10 44 Z', 'bs'), P('M32 30 L50 18 L42 36 L52 46 Z', 'lo'),
                              ...granules('hi', 5, 17, [22, 24, 40, 42])]);
def('cosmic_dust', () => [...granules('bs', 16, 3, [10, 12, 50, 50]), ...granules('hi', 8, 29, [14, 16, 46, 46])]);

/* mineral — batch additions: what falls, and what falling makes */
def('meteorite', () => [                                   // regmaglypts — thumbprint dimples the passage through air leaves
  P('M14 32 Q13 18 28 15 Q44 12 48 28 Q50 42 36 48 Q20 52 14 40 Z', 'lo'),
  ...[[22, 24], [34, 22], [30, 38], [40, 36]].map(([x, y]) => E(x, y, 3.4, 2.6, 'ik')),
  S('M16 20 Q26 14 38 16', 'hi', 2),                        // the fusion crust, on the leading edge
]);
def('impact_crater', () => [                                // a rim, a bowl, and rays thrown out past it — Tycho, not an atoll
  ...[-70, -30, 10, 50, 100, 140, 200].map(a =>
    S(`M30 32 L${n(30 + 27 * Math.cos(a * Math.PI / 180))} ${n(32 + 27 * Math.sin(a * Math.PI / 180))}`, 'gh', 1.2)),
  ring('lo', 30, 32, 19, 3), C(30, 32, 13, 'bs'), C(30, 32, 5, 'lo'),
]);
def('tektite',   () => [                                   // quenched airborne into glass, no crystals at all — a smooth dumbbell
  P('M20 24 Q20 14 30 16 Q40 14 40 24 Q44 30 40 34 Q40 44 30 42 Q20 44 20 34 Q16 30 20 24 Z', 'ik'),
  E(25, 20, 4, 2, 'hi'),
]);
def('moldavite', () => [                                   // green tektite glass, its surface etched into flow ridges
  P('M16 30 L24 14 L40 16 L46 32 L38 48 L20 46 Z', 'bs'),
  S('M20 26 Q30 22 36 28 M18 36 Q28 34 34 40', 'ik', 1.2),
]);
def('australite', () => [                                  // a tektite reshaped a second time into a flanged button
  E(30, 34, 22, 5, 'hi'),                                   // the flange, sheared thin at the edge
  E(30, 28, 15, 10, 'bs'), E(28, 23, 5, 3, 'lo'),
]);

def('nebula',   () => [E(28, 30, 22, 16, 'lo'), E(34, 36, 15, 11, 'bs'), E(24, 26, 8, 6, 'hi'),
                       ...granules('hi', 7, 61, [12, 14, 48, 48])]);
def('star',     () => [C(30, 32, 14, 'hi'), ...[0, 45, 90, 135].map(a =>
                         ['g', a, 30, 32, [S('M30 10 L30 54', 'bs', 2)]]), C(30, 32, 8, 'ground')]);
def('red_giant',() => [C(30, 32, 22, 'bs'), C(30, 32, 15, 'lo'), C(24, 26, 5, 'hi')]);
def('white_dwarf', () => [C(30, 32, 7, 'hi'), ring('gh', 30, 32, 15, 1.2), ring('lo', 30, 32, 22, 1)]);
def('supernova',() => [...Array.from({ length: 12 }, (_, i) =>
                         ['g', i * 30, 30, 32, [S('M30 32 L30 6', 'hi', i % 2 ? 2.6 : 1.4)]]),
                       C(30, 32, 8, 'bs')]);
def('neutron_star', () => [C(30, 32, 9, 'hi'),
                           ...[[30, 6], [30, 58]].map(([x, y]) => P(`M${x - 6} ${y > 30 ? y - 12 : y + 12} L${x} ${y} L${x + 6} ${y > 30 ? y - 12 : y + 12} Z`, 'bs')),
                           ['g', 20, 30, 32, [ring('lo', 30, 32, 19, 1.4)]]]);   // the beams
def('black_hole', () => [ring('hi', 30, 32, 20, 3), C(30, 32, 15, 'ground'),
                         ['g', -18, 30, 32, [E(30, 32, 26, 5, 'bs')]]]);         // the disc, edge on
def('planetesimal', () => [lump('lo', 30, 32, 17, 15), ...granules('bs', 8, 71, [16, 20, 44, 44]),
                           C(22, 24, 4, 'ground'), C(38, 40, 3, 'ground')]);
def('planet',   () => [C(30, 32, 19, 'bs'), P('M13 26 Q30 34 47 26 L47 38 Q30 30 13 38 Z', 'lo'),
                       C(22, 22, 5, 'hi')]);
def('moon',     () => [C(30, 32, 18, 'hi'), C(22, 26, 5, 'lo'), C(37, 38, 4, 'lo'), C(33, 22, 2.6, 'lo')]);
def('comet',    () => [C(44, 20, 7, 'hi'),
                       ...[[38, 24, 8, 48], [40, 20, 14, 44], [41, 27, 10, 52]].map(([a, b, c2, d]) =>
                         S(`M${a} ${b} L${c2} ${d}`, 'bs', 2.4))]);
def('asteroid', () => [P('M14 30 L22 14 L40 12 L50 28 L42 46 L20 46 Z', 'lo'),
                       C(26, 26, 5, 'ground'), C(38, 34, 4, 'ground'), C(31, 40, 2.6, 'ground')]);
def('gas_giant',() => [C(30, 32, 21, 'bs'),
                       ...[24, 30, 36, 42].map((y, i) => P(`M${11 + i} ${y} Q30 ${y + 3} ${49 - i} ${y} L${49 - i} ${y + 4} Q30 ${y + 7} ${11 + i} ${y + 4} Z`, i % 2 ? 'lo' : 'hi')),
                       E(38, 26, 6, 4, 'lo')]);                                  // the storm
def('ice_giant',() => [C(30, 32, 20, 'lo'), C(30, 32, 13, 'hi'),
                       ['g', -70, 30, 32, [E(30, 32, 27, 3, 'bs')]]]);           // the tilted rings

/* mineral — batch additions: neutron_star already has straight static beams
   and nebula is already a soft cloud, so this run keeps clear of both —
   pulsar sweeps, crab_nebula shreds into filaments around its own dot, and
   the twelve galaxy scales climb from one disc to a web of clusters, no two
   sharing a silhouette: face-on arms, edge-on lens, a band seen from inside. */
def('pulsar',    () => [                                   // a lighthouse beam, swept at an angle, with the pulse train ticking off
  C(30, 32, 6, 'hi'),
  ['g', -30, 30, 32, [P('M30 32 L18 8 Q30 14 42 8 Z', 'gh'), P('M30 32 L18 56 Q30 50 42 56 Z', 'gh')]],
  ...[10, 16, 22].map(d => C(n(30 + d * .6), n(32 - d), .9, 'bs')),
]);
def('crab_nebula', () => [                                 // supernova wreckage, still expanding — ragged filaments, pulsar at the core
  ...[-60, -20, 20, 60, 100, 140, 180, 220, 260, 300].map(a =>
    S(`M30 32 L${n(30 + (16 + (a % 40)) * Math.cos(a * Math.PI / 180))} ${n(32 + (16 + (a % 40)) * Math.sin(a * Math.PI / 180))}`, 'lo', 1.6)),
  C(30, 32, 3.4, 'hi'),
]);
def('galaxy',    () => [                                   // the plain case: one disc, two arms, face on
  E(30, 32, 21, 8, 'bs'),
  S('M12 32 Q22 20 34 24 Q44 27 48 32', 'hi', 2),
  S('M48 32 Q38 44 26 40 Q16 37 12 32', 'hi', 2),
  C(30, 32, 4, 'gh'),
]);
def('milky_way', () => [                                   // seen from inside it, not from outside — a hazy band across the sky
  P('M4 38 Q30 22 56 38 L56 44 Q30 30 4 44 Z', 'gh'),
  ...granules('hi', 20, 41, [6, 34, 54, 44]),
  C(34, 39, 1.6, 'bs'),                                     // the Sun, on one arm, nothing special from in here
]);
def('andromeda_galaxy', () => [                             // the nearest spiral, with its two satellites still visible beside it
  E(28, 32, 20, 7, 'bs'),
  S('M12 32 Q20 22 30 26 Q40 29 46 32', 'hi', 2),
  E(46, 20, 4, 3, 'lo'), E(42, 46, 3.4, 2.6, 'lo'),         // M32 and M110
]);
def('spiral_galaxy', () => [                                // a tighter two-armed pinwheel, face on
  C(30, 32, 5, 'gh'),
  ['g', 0, 30, 32, [S('M30 32 Q40 24 46 30 Q50 34 44 40', 'bs', 2.4)]],
  ['g', 180, 30, 32, [S('M30 32 Q40 24 46 30 Q50 34 44 40', 'bs', 2.4)]],
]);
def('elliptical_galaxy', () => [                            // smooth, featureless, red with old stars — no arms at all
  E(30, 32, 19, 13, 'lo'),
  ...granules('gh', 10, 71, [16, 22, 44, 42]),
]);
def('barred_spiral_galaxy', () => [                         // a spiral, but with the straight stellar bar through its core
  P('M14 32 L46 32 L46 35 L14 35 Z', 'bs'),
  S('M14 33 Q6 22 16 16', 'hi', 2), S('M46 34 Q54 44 44 48', 'hi', 2),
]);
def('lenticular_galaxy', () => [                            // lens-shaped, seen edge on — a disc with the arms already used up
  E(30, 32, 22, 5, 'lo'), E(30, 32, 12, 3, 'hi'),
]);
def('local_group', () => [                                  // two spirals dominate it — the Milky Way and Andromeda — plus small satellites
  E(20, 26, 8, 3, 'bs'), E(38, 38, 7, 3, 'hi'),
  ...[[12, 38], [46, 24], [28, 46], [8, 22]].map(([x, y]) => C(x, y, 1.6, 'gh')),
]);
def('galaxy_cluster', () => [                                // hundreds to thousands, drawn as a crowd, not a couple
  ...[[18, 20], [30, 16], [42, 22], [14, 32], [26, 30], [38, 34], [46, 30], [20, 44], [32, 46], [44, 42]]
    .map(([x, y], i) => C(x, y, 2.6, i % 3 ? 'gh' : 'bs')),
]);
def('supercluster', () => [                                 // clusters strung on filaments — the cosmic web, not one crowd
  S('M8 46 L24 26 M24 26 L44 30 M24 26 L20 10 M44 30 L54 16 M44 30 L50 48', 'gh', 1.2),
  C(24, 26, 4, 'bs'), C(8, 46, 2.4, 'lo'), C(44, 30, 3, 'lo'), C(20, 10, 2, 'lo'), C(54, 16, 2, 'lo'), C(50, 48, 2, 'lo'),
]);

/* things that live together ─────────────────────────────────────────────
   The whole point of this tier is that two organisms make a third, so the
   partnerships are drawn as two visibly different things sharing one body. */
const rod3 = (r, x, y, w = 14, h = 6) => P(`M${x - w} ${y - h} L${x + w} ${y - h} Q${x + w + 4} ${y} ${x + w} ${y + h} L${x - w} ${y + h} Q${x - w - 4} ${y} ${x - w} ${y - h} Z`, r);
def('bacteria',     () => [rod3('bs', 24, 24), rod3('hi', 36, 42), S('M46 46 Q54 42 52 34', 'lo', 1.8)]);
def('archaea',      () => [rod3('lo', 30, 26, 13, 6), rod3('lo', 28, 42, 11, 5),
                           ...[16, 44].map(x => S(`M${x} 34 Q${x < 30 ? 8 : 52} 30 ${x < 30 ? 12 : 48} 20`, 'ik', 1.6))]);
def('cyanobacteria',() => [...[0, 1, 2, 3].map(i => rod3(i % 2 ? 'bs' : 'hi', 30, 16 + i * 10, 15, 4))]);   // a filament
def('mitochondrion',() => [E(30, 32, 21, 13, 'bs'),
                           ...[20, 28, 36, 44].map(x => S(`M${x} 22 Q${x - 6} 32 ${x} 42`, 'hi', 2.2))]);   // cristae
def('chloroplast',  () => [E(30, 32, 21, 14, 'lo'),
                           ...[[22, 27], [22, 37], [38, 27], [38, 37]].map(([x, y]) => disc('hi', 3).map(d => d) && E(x, y, 6, 4, 'hi'))]);  // grana stacks
def('alga',         () => [...[0, 1, 2].map(i => leaf('hi', 22 + i * 8, 34 - i * 6, .8, -30 + i * 30)),
                           S('M30 50 L30 40', 'lo', 2.4)]);
def('fungus',       () => [P('M12 34 Q12 16 30 16 Q48 16 48 34 Z', 'hi'),      // a cap
                           P('M26 34 L34 34 L33 50 L27 50 Z', 'bs'),
                           ...[18, 26, 34, 42].map(x => S(`M${x} 34 L${x} 38`, 'lo', 1.4))]);
def('spore',        () => [C(30, 32, 8, 'bs'), ring('hi', 30, 32, 13, 1.6),
                           ...granules('lo', 6, 88, [14, 16, 46, 48])]);
def('mycelium',     () => [...[[30, 32, 0], [30, 32, 60], [30, 32, 120], [30, 32, 180], [30, 32, 240], [30, 32, 300]]
                             .map(([x, y, a]) => ['g', a, x, y, [S('M30 32 L30 10', 'hi', 1.8), S('M30 18 L24 12', 'hi', 1.2), S('M30 18 L36 12', 'hi', 1.2)]])]);
def('lichen',       () => [P('M10 42 Q10 24 30 24 Q50 24 50 42 Z', 'hi'),      // fungal crust
                           ...[[20, 36], [30, 33], [40, 36]].map(([x, y]) => C(x, y, 5, 'lo')),  // the alga inside it
                           S('M8 44 Q30 50 52 44', 'bs', 2.4)]);
def('mycorrhiza',   () => [S('M30 8 L30 34', 'lo', 3.4),                       // the root
                           ...[[30, 20], [30, 28], [30, 34]].map(([x, y]) =>
                             [S(`M${x} ${y} Q${x - 14} ${y + 6} ${x - 20} ${y + 14}`, 'hi', 1.6),
                              S(`M${x} ${y} Q${x + 14} ${y + 6} ${x + 20} ${y + 14}`, 'hi', 1.6)]).flat()]);
def('root_nodule',  () => [S('M30 8 L30 50', 'lo', 3.4),
                           ...[[20, 24], [40, 32], [22, 42]].map(([x, y]) => [C(x, y, 7, 'bs'), C(x - 2, y - 2, 2.4, 'hi')])
                             .flat()]);
def('rhizobium',    () => [rod3('bs', 24, 26, 11, 5), rod3('bs', 38, 38, 11, 5),
                           S('M18 44 Q30 48 44 46', 'lo', 1.6)]);
def('ammonia',      () => [C(30, 26, 8, 'bs'),
                           ...[[18, 42], [30, 46], [42, 42]].map(([x, y]) => [S(`M30 26 L${x} ${y}`, 'ik', 2), C(x, y, 4.4, 'hi')]).flat()]);  // NH3, and it is pyramidal
def('pollen',       () => [C(30, 32, 14, 'hi'), ...Array.from({ length: 10 }, (_, i) =>
                             ['g', i * 36, 30, 32, [S('M30 18 L30 12', 'bs', 2.2)]])]);
def('polyp',        () => [P('M22 50 L22 32 Q22 26 30 26 Q38 26 38 32 L38 50 Z', 'bs'),
                           ...Array.from({ length: 7 }, (_, i) =>
                             S(`M30 26 L${n(30 + (i - 3) * 7)} ${n(12 + Math.abs(i - 3) * 2)}`, 'hi', 2))]);
def('zooxanthellae',() => [...[[22, 26], [36, 24], [28, 40], [42, 38]].map(([x, y]) =>
                             [C(x, y, 6, 'hi'), C(x - 1.6, y - 1.6, 2, 'lo')]).flat()]);
def('coral',        () => [...[[18, 50, 18], [30, 52, 8], [42, 50, 24]].map(([x, base, top]) =>
                             [S(`M${x} ${base} L${x} ${top}`, 'bs', 5),
                              S(`M${x} ${n(top + 10)} L${n(x - 8)} ${n(top + 2)}`, 'bs', 3.4),
                              S(`M${x} ${n(top + 14)} L${n(x + 8)} ${n(top + 6)}`, 'bs', 3.4)]).flat()]);
def('reef',         () => [wave('lo', 16, 5, 26),
                           ...[[14, 30], [24, 24], [34, 28], [44, 22]].map(([x, top]) =>
                             [S(`M${x} 50 L${x} ${top}`, 'bs', 4.4), S(`M${x} ${top + 8} L${x + 7} ${top + 2}`, 'hi', 3)]).flat(),
                           S('M8 50 L52 50', 'ik', 2)]);
def('atoll',        () => [ring('bs', 30, 32, 20, 6), E(30, 32, 13, 10, 'lo'),
                           ...[[14, 24], [46, 40]].map(([x, y]) => C(x, y, 4, 'hi'))]);   // a ring, and a lagoon
def('bleached_coral', () => [...[[18, 50, 18], [30, 52, 8], [42, 50, 24]].map(([x, base, top]) =>
                               [S(`M${x} ${base} L${x} ${top}`, 'gh', 5),
                                S(`M${x} ${n(top + 10)} L${n(x - 8)} ${n(top + 2)}`, 'gh', 3.4)]).flat()]);
def('detritus',     () => [...granules('lo', 10, 13, [12, 30, 48, 48]),
                           ...[[18, 34], [36, 30], [28, 42]].map(([x, y]) => leaf('bs', x, y, .5, 40))]);
def('earthworm',    () => [S('M12 46 Q20 26 30 34 Q40 42 48 20', 'bs', 7),
                           ...[18, 26, 34, 42].map(x => S(`M${x} ${x < 30 ? 40 - (x - 18) : 34 + (x - 30) * .4} L${x + 2} ${x < 30 ? 34 - (x - 18) : 28 + (x - 30) * .4}`, 'lo', 1.2))]);
def('humus',        () => [mound('ik', 48, 22, 20), ...granules('lo', 10, 27, [14, 32, 46, 48])]);
def('compost',      () => [mound('lo', 48, 22, 19),
                           ...[[20, 36], [38, 34]].map(([x, y]) => leaf('bs', x, y, .55, 30)),
                           ...[24, 34].map(x => S(`M${x} 26 Q${x - 4} 18 ${x} 12`, 'hi', 2))]);   // it is warm
def('cellulose',    () => [...[0, 1, 2].map(i => {
                             const bb = backbone('ik', 4, 30, 20 + i * 12);
                             return bb.shape; }),
                           ...[[16, 26], [16, 38]].map(([x, y]) => S(`M${x} ${y} L${x + 28} ${y}`, 'gh', 1.2))]);  // the hydrogen bonds between chains
def('rumen',        () => [P('M12 30 Q12 16 30 16 Q48 16 48 30 Q48 48 30 48 Q12 48 12 30 Z', 'bs'),
                           ...[[22, 28], [34, 26], [28, 38], [40, 36]].map(([x, y]) => C(x, y, 4, 'hi')),
                           S('M30 16 L30 8', 'lo', 3)]);
def('fatty_acid',   () => [(() => backbone('ik', 6, 32, 34).shape)(),
                           C(12, 30, 5, 'bs'), S('M12 30 L18 34', 'ik', 2)]);            // the carboxyl head


/* current, and the things built once it existed ─────────────────────────
   Drawn as circuit-diagram shapes wherever a real one exists — a coil is a
   coil, a cell is long-plate-short-plate, a diode is a triangle against a
   bar. Anyone who has seen a schematic already knows how to read these. */
/** A lightning-bolt run of current, as a schematic draws it. */
const zig = (r, y = 32, amp = 3.5, steps = 6) =>
  S(`M10 ${y} ` + Array.from({ length: steps }, (_, i) =>
      `L${14 + i * 6} ${y + (i % 2 ? -amp : amp)}`).join(' ') + ` L50 ${y}`, r, 2.4);
const coilOf = (r, turns = 4, x0 = 16, y = 32, rad = 5) =>
  Array.from({ length: turns }, (_, i) =>
    ['s', `M${x0 + i * rad * 2} ${y} A${rad} ${rad} 0 0 1 ${x0 + (i + 1) * rad * 2} ${y}`, r, 2.6]);
const cellBars = (r, x = 30) => [
  S(`M${x - 5} 18 L${x - 5} 46`, r, 3.4), S(`M${x + 5} 24 L${x + 5} 40`, r, 5),
];
def('lodestone',   () => [facet('lo'), ...[[20, 24], [40, 40]].map(([x, y]) => C(x, y, 3.4, 'hi')),
                          ...[[14, 18], [46, 46]].map(([x, y]) => S(`M${x} ${y} L${x + (x < 30 ? -4 : 4)} ${y + (y < 30 ? -4 : 4)}`, 'bs', 1.6))]);
def('magnet',      () => [P('M14 46 L14 26 A16 16 0 0 1 46 26 L46 46 L36 46 L36 26 A6 6 0 0 0 24 26 L24 46 Z', 'bs'),
                          P('M14 40 L24 40 L24 46 L14 46 Z', 'lo'), P('M36 40 L46 40 L46 46 L36 46 Z', 'hi')]);
def('magnetic_field', () => [C(30, 32, 5, 'ik'),
                             ...[10, 16, 22].map((rx, i) => E(30, 32, rx, rx * 1.5, i % 2 ? 'hi' : 'bs') && ring(i % 2 ? 'hi' : 'bs', 30, 32, rx, 1.6))]);
def('copper_wire', () => [...coilOf('bs', 3, 12, 32, 6), S('M8 32 L12 32', 'bs', 2.6), S('M48 32 L52 32', 'bs', 2.6)]);
def('voltaic_pile',() => [...Array.from({ length: 5 }, (_, i) =>
                            P(`M18 ${44 - i * 7} L42 ${44 - i * 7} L42 ${38 - i * 7} L18 ${38 - i * 7} Z`, i % 2 ? 'hi' : 'bs')),
                          S('M30 10 L30 4', 'ik', 2)]);
def('current',     () => [zig('hi', 32), ...[[10, 32], [50, 32]].map(([x, y]) => C(x, y, 3, 'ik'))]);
def('electromagnet', () => [S('M12 32 L48 32', 'lo', 8), ...coilOf('bs', 4, 14, 32, 5),
                            S('M6 32 L10 32', 'ik', 2.2), S('M50 32 L54 32', 'ik', 2.2)]);
def('generator',   () => [ring('ik', 30, 32, 18, 2.6), S('M30 14 L30 50', 'bs', 3.4),
                          ...[[16, 22], [44, 42]].map(([x, y]) => C(x, y, 3.4, 'hi')), zig('hi', 32, 2.5, 4)]);
def('electric_motor', () => [ring('ik', 30, 32, 18, 2.6), C(30, 32, 6, 'bs'),
                             ...[0, 120, 240].map(a => ['g', a, 30, 32, [S('M30 32 L30 16', 'lo', 3.4)]]),
                             ['g', 40, 30, 32, [ring('hi', 30, 32, 23, 1.4)]]]);
def('transformer', () => [P('M22 12 L38 12 L38 52 L22 52 Z', 'lo'),
                          ...coilOf('bs', 2, 8, 32, 5), ...coilOf('hi', 2, 40, 32, 5)]);
def('nichrome',    () => [...coilOf('bs', 5, 10, 32, 4), S('M6 32 L10 32', 'ik', 2), S('M50 32 L54 32', 'ik', 2),
                          ...granules('hi', 4, 121, [16, 22, 44, 42])]);
def('heating_element', () => [...coilOf('bs', 6, 8, 30, 3.6),
                              ...[20, 32, 44].map(x => S(`M${x} 44 Q${x - 4} 50 ${x} 56`, 'hi', 2))]);
def('filament',    () => [P('M12 20 L48 20 L48 24 L12 24 Z', 'ground'),
                          ...coilOf('hi', 5, 16, 34, 3.4),
                          S('M20 24 L20 34', 'lo', 1.8), S('M40 24 L40 34', 'lo', 1.8)]);
def('light_bulb',  () => [P('M18 26 A12 12 0 1 1 42 26 Q42 36 36 40 L24 40 Q18 36 18 26 Z', 'gh'),
                          ...coilOf('hi', 3, 22, 28, 3),
                          ...[42, 46, 50].map(y => S(`M24 ${y} L36 ${y}`, 'ik', 2.2))]);
def('sulfuric_acid', () => [P('M22 10 L38 10 L38 22 L46 44 Q46 50 30 50 Q14 50 14 44 L22 22 Z', 'gh'),  // a flask, not a jar
                            P('M18 34 L42 34 L46 44 Q46 50 30 50 Q14 50 14 44 Z', 'hi'),
                            ...granules('bs', 3, 9, [24, 38, 36, 46])]);
def('lead_acid_cell', () => [P('M12 18 L48 18 L48 50 L12 50 Z', 'lo'),
                             ...cellBars('hi', 24), ...cellBars('bs', 40),
                             S('M18 14 L18 18', 'ik', 3), S('M42 14 L42 18', 'ik', 3)]);
def('electrolysis',() => [vessel('gh', 20, 48), P('M16 28 L44 28 L43 46 Q30 49 17 46 Z', 'lo'),
                          S('M22 12 L22 42', 'ik', 3), S('M38 12 L38 42', 'ik', 3),
                          ...[[22, 34], [22, 26], [38, 32], [38, 24]].map(([x, y]) => C(x + (x < 30 ? -4 : 4), y, 2.4, 'hi'))]);
def('electroplating', () => [vessel('gh', 20, 48), P('M16 28 L44 28 L43 46 Q30 49 17 46 Z', 'lo'),
                             S('M22 12 L22 42', 'ik', 3),
                             P('M34 16 L42 16 L42 42 L34 42 Z', 'bs'), P('M34 16 L42 16 L42 20 L34 20 Z', 'hi')]);
def('p_type',      () => [P('M14 18 L46 18 L46 46 L14 46 Z', 'lo'),
                          ...granules('ground', 6, 33, [18, 22, 42, 42]),
                          S('M30 8 L30 18', 'ik', 2)]);                       // holes
def('n_type',      () => [P('M14 18 L46 18 L46 46 L14 46 Z', 'lo'),
                          ...granules('hi', 6, 47, [18, 22, 42, 42]),
                          S('M30 8 L30 18', 'ik', 2)]);                       // extra electrons
def('diode',       () => [P('M20 18 L20 46 L44 32 Z', 'bs'), S('M44 18 L44 46', 'ik', 3.4),
                          S('M8 32 L20 32', 'ik', 2.4), S('M44 32 L54 32', 'ik', 2.4)]);
def('led',         () => [P('M20 18 L20 46 L44 32 Z', 'bs'), S('M44 18 L44 46', 'ik', 3.4),
                          ...[[46, 14], [52, 22]].map(([x, y]) => S(`M${x} ${y} L${x + 6} ${y - 6}`, 'hi', 2.2))]);
def('transistor',  () => [ring('ik', 30, 32, 17, 2.4), S('M24 20 L24 44', 'bs', 3.4),
                          S('M10 32 L24 32', 'ik', 2.2),
                          S('M24 26 L46 16', 'ik', 2.2), S('M24 38 L46 48', 'ik', 2.2)]);
def('solar_cell',  () => [P('M10 20 L50 20 L50 46 L10 46 Z', 'lo'),
                          ...[18, 26, 34, 42].map(x => S(`M${x} 20 L${x} 46`, 'hi', 1.4)),
                          S('M10 33 L50 33', 'hi', 1.4),
                          ...[[16, 12], [26, 10]].map(([x, y]) => S(`M${x} ${y} L${x + 5} ${y + 6}`, 'bs', 2))]);
def('refrigerator',() => [P('M16 10 L44 10 L44 52 L16 52 Z', 'gh'), S('M16 30 L44 30', 'ik', 2.2),
                          S('M40 18 L40 24', 'ik', 3), S('M40 36 L40 42', 'ik', 3),
                          ...[22, 28].map(x => S(`M${x} 40 Q${x - 3} 44 ${x} 48`, 'bs', 1.6))]);

/* invention milestones ───────────────────────────────────────────────────
   Mechanical, communications and computing devices, each drawn from its own
   working part rather than a generic box: the press's screw and platen, the
   telegraph's key and coil, the transistor chip's pins, the Flyer's wing and
   propeller. Where a device shares real kinship with something already drawn
   here — a coil, a diaphragm, a filament — it reuses that same piece. */
def('movable_type', () => [...[15, 24, 33, 42].map((x, i) =>
                            P(`M${x - 4} 16 L${x + 4} 16 L${x + 4} 46 L${x - 4} 46 Z`, i % 2 ? 'hi' : 'bs')),
                           ...[15, 24, 33, 42].map(x => S(`M${x - 2} 24 L${x + 2} 24 M${x - 2} 32 L${x + 2} 32`, 'ik', 1.4))]);
def('printing_press', () => [P('M14 8 L20 8 L20 48 L14 48 Z', 'lo'), P('M40 8 L46 8 L46 48 L40 48 Z', 'lo'),
                             P('M13 22 L47 22 L47 29 L13 29 Z', 'bs'),      // the platen
                             S('M30 8 L30 22', 'ik', 3.4),                  // the screw
                             P('M17 44 L43 44 L43 50 L17 50 Z', 'hi')]);    // the bed
def('telescope', () => [P('M9 36 L47 21 L51 29 L13 44 Z', 'lo'),
                        E(11, 40, 5, 7, 'hi'), E(49, 25, 4, 5.4, 'bs')]);
def('steam_engine', () => [P('M12 24 L34 24 L34 40 L12 40 Z', 'lo'), S('M34 32 L44 32', 'ik', 3.4),
                           ring('bs', 46, 32, 8, 3), ['g', 0, 46, 32, [S('M46 24 L46 40', 'ik', 1.6)]],
                           ['g', 90, 46, 32, [S('M46 24 L46 40', 'ik', 1.6)]]]);
def('barometer', () => [P('M27 6 L33 6 L33 46 L27 46 Z', 'gh'), P('M28 20 L32 20 L32 46 L28 46 Z', 'bs'),
                        E(30, 48, 14, 5, 'lo')]);
def('pendulum_clock', () => [P('M18 8 L42 8 L42 40 Q42 48 30 48 Q18 48 18 40 Z', 'lo'),
                             ring('bs', 30, 22, 8, 2.4), S('M30 30 L30 42', 'ik', 2), C(30, 44, 4, 'hi')]);
def('cotton_gin', () => [ring('lo', 20, 32, 11, 3),
                         ...Array.from({ length: 8 }, (_, i) => ['g', i * 45, 20, 32, [S('M20 21 L20 15', 'ik', 1.6)]]),
                         ring('hi', 44, 32, 8, 4)]);
def('sewing_machine', () => [P('M26 8 L30 6 L34 8 L32 38 L30 42 L28 38 Z', 'gh'), E(30, 14, 3, 4.4, 'ground'),
                             ring('bs', 30, 47, 10, 3)]);
def('elevator', () => [P('M18 6 L42 6 L42 52 L18 52 Z', 'gh'), P('M22 18 L38 18 L38 38 L22 38 Z', 'bs'),
                       S('M14 6 L14 52', 'ik', 2), S('M46 6 L46 52', 'ik', 2),
                       ...[14, 22, 30, 38, 46].map(y => [S(`M11 ${y} L16 ${y}`, 'ik', 1.4), S(`M44 ${y} L49 ${y}`, 'ik', 1.4)]).flat()]);
def('telegraph', () => [P('M10 40 L50 40 L50 46 L10 46 Z', 'lo'), P('M18 40 L18 34 L38 34 L38 40 Z', 'bs'),
                        S('M12 28 L28 34', 'ik', 3), ...coilOf('hi', 3, 30, 18, 3)]);
def('telephone', () => [ring('lo', 20, 32, 14, 3), C(20, 32, 4, 'bs'), ...coilOf('hi', 3, 32, 32, 4)]);
def('radio', () => [S('M30 4 L30 18', 'ik', 2.4), P('M18 18 L42 18 L42 40 L18 40 Z', 'lo'),
                    ...coilOf('bs', 2, 20, 29, 4), S('M27 34 L33 34', 'hi', 2.2)]);
def('vacuum_tube', () => [P('M18 12 A12 12 0 1 1 42 12 L42 46 L18 46 Z', 'gh'),
                          ...coilOf('hi', 3, 22, 36, 3), S('M22 18 L38 18', 'ik', 2.4)]);
def('phonograph', () => [ring('lo', 18, 32, 10, 3.4), P('M26 30 L46 16 Q52 12 50 20 L32 36 Z', 'bs')]);
def('x_ray', () => [P('M12 24 L48 24 L48 38 L12 38 Z', 'gh'), S('M18 24 L18 38', 'ik', 3), S('M42 24 L42 38', 'ik', 3),
                    ...[24, 30, 36].map(x => S(`M${x} 24 L${x} 38`, 'hi', 2))]);
def('camera_obscura', () => [P('M12 14 L48 14 L48 46 L12 46 Z', 'lo'), C(14, 30, 2.2, 'ik'),
                             P('M38 22 L46 22 L46 38 L38 38 Z', 'hi')]);
def('photographic_plate', () => [P('M14 14 L46 14 L46 46 L14 46 Z', 'lo'), ...granules('hi', 10, 51, [18, 18, 42, 42])]);
def('photograph', () => [P('M12 10 L48 10 L48 50 L12 50 Z', 'ik'), P('M18 16 L42 16 L42 44 L18 44 Z', 'hi'),
                         C(30, 28, 6, 'lo')]);
def('ether', () => [P('M24 10 L36 10 L36 22 L44 44 Q44 50 30 50 Q16 50 16 44 L24 22 Z', 'gh'),
                    P('M18 34 L42 34 L44 44 Q44 50 30 50 Q16 50 16 44 Z', 'hi'),
                    S('M20 8 Q24 4 20 2', 'lo', 1.4), S('M36 8 Q40 4 36 2', 'lo', 1.4)]);
def('integrated_circuit', () => [P('M18 18 L42 18 L42 42 L18 42 Z', 'ik'),
                                 ...[22, 30, 38].map(x => [S(`M${x} 18 L${x} 12`, 'bs', 2), S(`M${x} 42 L${x} 48`, 'bs', 2)]).flat(),
                                 ...granules('hi', 4, 71, [22, 22, 38, 38])]);
def('microprocessor', () => [P('M16 16 L44 16 L44 44 L16 44 Z', 'ik'),
                             ...[20, 26, 32, 38].map(x => [S(`M${x} 16 L${x} 10`, 'bs', 2), S(`M${x} 44 L${x} 50`, 'bs', 2)]).flat(),
                             ...[20, 26, 32, 38].map(y => [S(`M16 ${y} L10 ${y}`, 'bs', 2), S(`M44 ${y} L50 ${y}`, 'bs', 2)]).flat(),
                             C(30, 30, 6, 'hi')]);
def('internal_combustion_engine', () => [P('M18 14 L42 14 L42 40 L18 40 Z', 'lo'), P('M22 40 L38 40 L38 50 L22 50 Z', 'bs'),
                                         S('M30 8 L30 14', 'ik', 2.6), C(30, 8, 2.4, 'hi')]);
def('airplane', () => [P('M8 30 L52 30 L52 34 L8 34 Z', 'bs'), P('M24 20 L36 20 L40 44 L20 44 Z', 'lo'),
                       ring('hi', 14, 32, 4, 2), S('M14 24 L14 40', 'ik', 1.8)]);

/* trades, wonders-of-the-world figures, Egyptian deities, weather instruments,
   Viking/Age-of-Sail history and pre-industrial inventions — book batch,
   chunk 06. Each one draws the single object or attribute that actually
   identifies it rather than a stand-in box; people are drawn the way the
   philosophers elsewhere in this file are — through a signature attribute,
   never a face. */

/* trades — the tool of the job, not a generic figure */
def('astronomer', () => [
  S('M30 40 L16 54 M30 40 L30 56 M30 40 L44 54', 'lo', 2.2),                  // tripod
  P('M26 40 L18 16 L24 13 L34 12 L38 36 Z', 'bs'),                            // tube, tilted up
  E(20, 15, 4, 5, 'hi'), C(36, 34, 3, 'lo'),                                   // objective lens, eyepiece
  S('M46 10 L46 18 M42 14 L50 14', 'hi', 2),                                  // a star, found
]);
def('meteorologist', () => [
  ring('lo', 30, 32, 16, 2), ring('bs', 30, 32, 10, 2), ring('hi', 30, 32, 4, 2), // isobars round a low
  S('M30 32 L44 20', 'ik', 2.4), S('M44 20 L38 20 M44 20 L44 26', 'ik', 2),   // the wind barb
]);
def('astronaut', () => [
  P('M14 34 Q14 12 30 12 Q46 12 46 34 Q46 46 30 46 Q14 46 14 34 Z', 'gh'),    // helmet dome
  E(30, 28, 13, 14, 'lo'), E(25, 24, 5, 6, 'hi'),                             // visor, and its glint
  S('M14 34 L8 30 M46 34 L52 30', 'bs', 2.4),                                 // comm studs
]);
def('veterinarian', () => [
  S('M16 14 Q16 28 24 28 Q32 28 32 16', 'lo', 3),                             // stethoscope tube
  C(16, 12, 3, 'hi'), C(32, 12, 3, 'hi'),                                     // earpieces
  C(24, 34, 5.5, 'bs'),                                                       // chestpiece
  E(42, 44, 6, 4.5, 'ik'),                                                    // a paw, not a chest
  C(34, 36, 2, 'ik'), C(38, 32, 2, 'ik'), C(44, 32, 2, 'ik'), C(48, 36, 2, 'ik'),
]);
def('farm_manager', () => [
  P('M16 10 L44 10 L44 50 L16 50 Z', 'bs'),                                   // the clipboard, not the plough
  P('M25 7 L35 7 L35 13 L25 13 Z', 'lo'),
  S('M21 22 L39 22 M21 30 L39 30 M21 38 L33 38', 'hi', 2.2),
  S('M35 36 L38 40 L44 32', 'ik', 2.4),                                       // sowing to harvest, checked off
]);
def('medical_doctor', () => [
  S('M30 8 L30 52', 'lo', 3),                                                 // the rod
  S('M30 14 Q17 20 30 26 Q43 32 30 38 Q17 44 30 48', 'bs', 2.4),              // and its snake
  P('M27 12 L33 12 L30 6 Z', 'hi'),
]);
def('dentist', () => [
  P('M18 16 Q18 8 30 8 Q42 8 42 16 Q42 24 36 26 L34 46 L30 34 L26 46 L24 26 Q18 24 18 16 Z', 'bs'), // molar, roots and all
  S('M46 14 L52 8', 'ik', 2.2), C(44, 16, 5, 'gh'),                           // the mouth mirror
]);
def('railroad_engineer', () => [
  ring('lo', 24, 32, 14, 3.5), C(24, 32, 4, 'hi'),                            // the drive wheel
  S('M24 32 L46 32', 'ik', 3), C(46, 32, 3, 'bs'),                            // its connecting rod
  S('M10 46 L50 46', 'ik', 2.4),                                              // the rail
]);
def('ships_captain', () => [
  ring('lo', 30, 30, 16, 3), C(30, 30, 5, 'bs'),                              // the helm
  ...[0, 60, 120, 180, 240, 300].map(a => ['g', a, 30, 30, [S('M30 14 L30 6', 'hi', 2.6)]]),
]);
def('airline_pilot', () => [
  P('M14 28 Q14 16 30 16 Q46 16 46 28 L46 32 L14 32 Z', 'lo'),                // cap crown
  P('M9 32 L51 32 L51 38 L9 38 Z', 'bs'),                                     // brim
  C(30, 24, 3, 'hi'), S('M30 24 Q20 20 12 22 M30 24 Q40 20 48 22', 'hi', 1.8), // wings badge
]);
def('firefighter', () => [
  P('M14 24 Q14 12 30 12 Q46 12 46 24 L46 30 Q30 26 14 30 Z', 'bs'),          // helmet dome
  S('M14 30 L46 30', 'lo', 2.6),                                              // brim
  P('M22 30 L38 30 L36 44 L30 48 L24 44 Z', 'hi'),                            // front shield
]);
def('paramedic', () => [
  P('M14 24 L46 24 L46 48 L14 48 Z', 'bs'),                                   // the kit bag
  P('M22 18 L38 18 L38 24 L22 24 Z', 'lo'),                                   // its handle
  S('M30 30 L30 42 M24 36 L36 36', 'hi', 3.4),                                // the cross on it
]);
def('chef', () => [
  E(30, 20, 16, 14, 'gh'),                                                    // the pleated toque
  P('M16 28 L44 28 L44 42 L16 42 Z', 'lo'),                                   // its band
  S('M22 14 Q22 6 30 8 Q38 6 38 14', 'hi', 2),                                // a pleat
]);
def('photographer', () => [
  P('M12 20 L48 20 L48 44 L12 44 Z', 'lo'),                                   // the body
  P('M22 12 L34 12 L34 20 L22 20 Z', 'bs'),                                   // viewfinder hump
  C(30, 32, 9, 'bs'), C(30, 32, 5, 'hi'),                                     // the lens
  P('M40 10 L46 10 L46 16 L40 16 Z', 'hi'),                                   // the flash
]);
def('jewelry_designer', () => [
  ring('lo', 30, 40, 12, 3.4),                                                // the band
  P('M22 22 L38 22 L30 10 Z', 'bs'), P('M22 22 L38 22 L34 30 L26 30 Z', 'hi'), // the faceted gem
  S('M22 24 L18 30 M38 24 L42 30', 'lo', 1.8),                                // its prongs
]);
def('textile_designer', () => [
  P('M10 12 L50 12 L50 16 L10 16 Z', 'lo'),                                   // the top beam
  ...[16, 24, 32, 40, 48].map(x => S(`M${x} 16 L${x} 46`, 'hi', 1.6)),        // warp threads
  P('M20 28 L40 28 L44 32 L40 36 L20 36 L16 32 Z', 'bs'),                     // the shuttle, mid-pass
]);
def('teacher', () => [
  P('M10 12 L50 12 L50 40 L10 40 Z', 'ik'),                                   // the board
  S('M16 20 L34 20 M16 28 L40 28', 'hi', 1.8),                                // chalked lines
  S('M44 44 L54 54', 'lo', 2.4), C(54, 54, 2, 'bs'),                          // the pointer
]);

/* Seven Wonders — the people around them, drawn by what history left of each */
def('khufu', () => [
  P('M24 46 L36 46 L36 52 L24 52 Z', 'lo'),                                   // pedestal
  P('M27 20 L33 20 L34 46 L26 46 Z', 'gh'), E(30, 16, 4, 5, 'gh'),            // the 3-inch ivory statuette — all that survives
  P('M22 8 L38 8 L30 2 Z', 'hi'),                                             // the monument he is remembered by instead
]);
def('pheidias', () => [
  P('M14 20 L30 20 L26 50 L18 50 Z', 'gh'),                                   // the block, still rough
  E(22, 26, 4, 5, 'hi'),                                                      // the face emerging from it
  S('M40 14 L48 22', 'ik', 3), P('M44 10 L52 10 L52 16 L44 16 Z', 'lo'),      // chisel and mallet
]);
def('nebuchadnezzar', () => [
  P('M10 30 L50 30 L50 46 L10 46 Z', 'lo'),                                   // the wall
  ...[14, 26, 38].map(x => P(`M${x} 22 L${x + 8} 22 L${x + 8} 30 L${x} 30 Z`, 'bs')), // crenellations
  ...[16, 28, 40].map(x => S(`M${x} 34 L${x} 42`, 'hi', 1.4)),                // brick coursing
]);
def('croesus', () => [
  ...[[20, 44], [30, 46], [40, 44], [24, 38], [36, 38], [30, 40]].map(([x, y]) => C(x, y, 5, 'bs')), // the heap
  P('M22 26 L38 26 L36 34 L24 34 Z', 'hi'), P('M22 26 L26 18 L30 26 L34 18 L38 26 Z', 'lo'), // the crown above it
]);
def('herostratus', () => [
  P('M24 8 L36 8 L36 40 L24 40 Z', 'gh'),                                     // the column
  P('M20 6 L40 6 L40 10 L20 10 Z', 'lo'),                                     // its capital
  P('M26 40 Q22 48 26 54 Q28 50 30 54 Q32 50 34 54 Q38 48 34 40 Z', 'bs'),     // fire at the base, on purpose
]);
def('sostratus', () => [
  P('M22 14 L38 14 L42 46 L18 46 Z', 'lo'),                                   // the tapering tower
  P('M27 14 Q24 6 30 2 Q36 6 33 14 Z', 'hi'),                                 // its beacon
  P('M16 48 L28 48 L28 54 L16 54 Z', 'bs'), S('M18 50 L26 50 M18 52 L24 52', 'ik', 1), // the tablet Ptolemy let him sign
]);
def('mausolus', () => [
  P('M14 36 L46 36 L46 44 L14 44 Z', 'gh'),                                   // the colonnade base
  ...[20, 30, 40].map(x => S(`M${x} 22 L${x} 36`, 'ik', 2.2)),                // its columns
  P('M16 22 L44 22 L38 12 L22 12 Z', 'bs'), P('M22 12 L38 12 L34 6 L26 6 Z', 'lo'), // the stepped pyramidal roof
]);
def('artemisia_ii', () => [
  P('M20 46 Q20 30 30 30 Q40 30 40 46 Z', 'bs'), S('M30 30 L30 20', 'lo', 3), // the mourning chalice
  P('M22 46 L38 46 L36 50 L24 50 Z', 'lo'),
  P('M25 14 L35 14 L32 6 L30 12 L28 6 Z', 'hi'),                              // the crown she ruled alone under
]);
def('chares', () => [
  P('M14 40 L44 40 L46 48 L12 48 Z', 'bs'),                                   // the colossus's sandalled foot
  P('M18 40 L18 30 Q18 24 24 24 L36 24 Q40 24 40 30 L40 40 Z', 'hi'),         // the leg fragment above it
  ...[0, 45, 90, 135, 180].map(a => S(`M30 14 L${n(30 + 14 * Math.cos((a - 90) * Math.PI / 180))} ${n(14 + 14 * Math.sin((a - 90) * Math.PI / 180))}`, 'lo', 1.8)), // Helios's crown of rays
]);

/* mineral — batch additions: the Wonders themselves, full and whole, next to
   the fragments their people already left behind above. An Ice Age shelter
   opens the set, built the same way — of what was on hand, load-bearing. */
def('mammoth_bone_hut', () => [
  P('M10 50 Q10 30 30 26 Q50 30 50 50 Z', 'lo'),                              // hide, stretched over the frame
  S('M12 46 Q30 6 48 46', 'hi', 2.2), S('M8 50 Q30 14 52 50', 'ik', 1.8),     // two curved tusks, crossed
  C(14, 50, 3, 'bs'), C(46, 50, 3, 'bs'),                                     // skulls, weighting the base
]);
def('great_pyramid', () => [
  P('M8 50 L30 10 L52 50 Z', 'lo'),
  P('M30 10 L52 50 L30 50 Z', 'bs'),                                          // the sunlit face
  ...[[13, 18, 47], [17, 26, 43], [21, 34, 39], [25, 42, 35]]
    .map(([x1, y, x2]) => S(`M${x1} ${y} L${x2} ${y}`, 'hi', 1)),             // 2.3 million blocks, coursed
  P('M27 44 L33 44 L33 50 L27 50 Z', 'ik'),                                   // the entrance
]);
def('chryselephantine', () => [                                              // "gold and ivory" — a cutaway of the technique itself
  P('M22 12 L38 12 L36 50 L24 50 Z', 'gh'),                                   // the wooden core, hidden inside
  P('M22 12 L30 12 L28 50 L24 50 Z', 'hi'),                                   // ivory, laid over the flesh
  P('M30 12 L38 12 L36 50 L28 50 Z', 'bs'),                                   // gold leaf, over the robed half
  S('M30 12 L28 50', 'ik', 1),
]);
def('statue_of_zeus', () => [
  P('M20 50 L20 30 Q20 16 30 16 Q40 16 40 30 L40 50 Z', 'bs'),                // seated, head almost touching the temple roof
  C(30, 12, 5, 'hi'),
  S('M40 30 L48 16', 'lo', 2.4), C(48, 14, 2.4, 'gh'),                        // the sceptre, raised
  C(20, 34, 3, 'hi'),                                                         // the small Nike in his other hand
]);
def('ziggurat', () => [
  P('M8 50 L52 50 L52 42 L8 42 Z', 'lo'),
  P('M12 42 L48 42 L48 34 L12 34 Z', 'bs'),
  P('M16 34 L44 34 L44 26 L16 26 Z', 'lo'),
  P('M20 26 L40 26 L40 18 L20 18 Z', 'bs'),
  S('M30 50 L30 18', 'ik', 2),                                                // the staircase, straight up the face
]);
def('ishtar_gate', () => [
  P('M12 50 L12 22 Q12 14 22 14 L38 14 Q48 14 48 22 L48 50 Z', 'bs'),         // fired mudbrick under a lapis-blue glaze
  ...[16, 22, 28, 34, 40].map(x => P(`M${x - 2} 14 L${x - 2} 10 L${x + 2} 10 L${x + 2} 14 Z`, 'lo')),
  P('M22 50 Q22 34 30 34 Q38 34 38 50 Z', 'hi'),                              // the archway
  S('M18 26 Q24 22 30 26 Q36 30 42 26', 'gh', 1.6),                           // the mušḫuššu dragon, relief on the face
]);
def('hanging_gardens', () => [
  P('M10 46 L50 46 L50 52 L10 52 Z', 'lo'),
  P('M14 34 L46 34 L46 40 L14 40 Z', 'bs'),
  P('M18 22 L42 22 L42 28 L18 28 Z', 'lo'),
  ...[16, 30, 44].map(x => S(`M${x} 46 L${x} 40`, 'gh', 1.4)),                // the arcading each terrace stands on
  ...[[14, 30, -30], [46, 30, 30], [18, 18, -30], [42, 18, 30]]
    .map(([x, y, rot]) => leaf('hi', x, y, .7, rot)),                        // vines, cascading over every edge
]);
def('temple_of_artemis', () => [
  P('M10 20 L50 20 L44 12 L16 12 Z', 'lo'),                                   // the pediment
  ...[14, 21, 28, 35, 42, 49].map(x => S(`M${x} 20 L${x} 48`, 'bs', 2.6)),    // over a hundred columns — six stand for it
  S('M8 48 L52 48', 'ik', 2),
]);
def('lighthouse_of_alexandria', () => [
  P('M18 50 L42 50 L40 36 L20 36 Z', 'lo'),                                   // square base
  P('M22 36 L38 36 L35 20 L25 20 Z', 'bs'),                                   // octagonal middle
  P('M26 20 L34 20 L32 8 L28 8 Z', 'hi'),                                     // cylindrical lantern
  P('M30 3 Q34 8 30 14 Q26 8 30 3 Z', 'hi'),                                  // the fire it was seen by, a thousand years
]);
def('mausoleum_halicarnassus', () => [
  P('M10 48 L50 48 L50 54 L10 54 Z', 'ground'),                               // the stepped platform
  ...[16, 24, 32, 40].map(x => S(`M${x} 24 L${x} 48`, 'bs', 2.4)),            // the colonnade
  P('M14 24 L46 24 L38 12 L22 12 Z', 'lo'),                                   // the stepped pyramidal roof
  P('M27 8 L33 8 L33 4 L27 4 Z', 'hi'),                                       // the quadriga on top, left off mausolus's own card
]);
def('colossus_of_rhodes', () => [
  P('M16 54 L20 30 L26 12 L34 12 L40 30 L44 54 Z', 'bs'),                     // the standing giant, whole this time
  ...[0, 45, 90, 135, 180].map(a =>
    S(`M30 10 L${n(30 + 13 * Math.cos((a - 90) * Math.PI / 180))} ${n(10 + 13 * Math.sin((a - 90) * Math.PI / 180))}`, 'lo', 1.6)),
  P('M22 42 L38 42 L36 46 L24 46 Z', 'hi'), S('M20 44 L40 44', 'gh', 1.4),    // a ship, passing beneath
]);

/* instruments and materials with no working precedent in the file yet */
def('spectroscope', () => [
  S('M8 30 L20 30', 'ik', 2.4),                                               // incoming light
  P('M20 20 L32 30 L20 40 Z', 'gh'),                                          // the prism
  ...[[34, 16], [40, 24], [44, 30], [40, 36], [34, 44]].map(([x, y], i) => S(`M32 30 L${x} ${y}`, i % 2 ? 'hi' : 'bs', 2)), // the spread spectrum
  S('M38 22 L39 26 M39 34 L38 38', 'ik', 1.6),                                // dark lines crossing it — an element's name
]);
def('radio_telescope', () => [
  P('M10 30 Q30 14 50 30 L50 34 Q30 22 10 34 Z', 'lo'),                       // the dish
  S('M30 30 L30 46', 'ik', 3), P('M22 46 L38 46 L40 52 L20 52 Z', 'bs'),      // mount and base
  C(30, 26, 2, 'hi'),                                                         // the receiver, at focus
]);
def('biomimicry', () => [
  leaf('bs', 22, 30, 1.4, -20),                                               // the engineered blade
  S('M14 22 L18 26 M14 30 L18 32 M14 38 L18 38', 'hi', 1.6),                  // its borrowed bumps
  leaf('hi', 42, 22, .8, 30),                                                 // the flipper it copies
]);
def('aerogel', () => [
  P('M14 14 L46 14 L46 46 L14 46 Z', 'gh'),                                   // a block that is almost nothing
  S('M20 20 Q30 26 24 34 Q18 40 28 44', 'hi', 1.4),
  S('M36 18 Q42 26 34 30 Q28 34 38 40', 'hi', 1.2),                           // frozen smoke, still moving
]);
def('lichtenberg_figure', () => [...dendrite('bs')]);                         // the branching scar a discharge burns
def('fuel_cell', () => [
  P('M14 14 L26 14 L26 48 L14 48 Z', 'lo'), P('M34 14 L46 14 L46 48 L34 48 Z', 'bs'), // the two plates
  S('M26 30 L34 30', 'ik', 4),                                                // the membrane between them
  S('M6 20 L14 20', 'ik', 2), S('M6 30 L14 30', 'ik', 2), S('M46 20 L54 20', 'ik', 2), // hydrogen and oxygen, in
  C(50, 40, 3, 'hi'),                                                         // water, out — no soot
]);

/* the Egyptian pantheon, each by its one recorded emblem */
def('neith', () => [
  S('M14 14 Q30 30 14 46', 'lo', 2.4), S('M46 14 Q30 30 46 46', 'lo', 2.4),   // crossed bows — her own emblem
  S('M14 14 L46 46', 'ik', 1.8), S('M46 14 L14 46', 'ik', 1.8), C(30, 30, 2, 'hi'),
]);
def('seshat', () => [
  S('M16 44 L44 44', 'lo', 2.6), C(16, 44, 2.2, 'ik'), C(44, 44, 2.2, 'ik'),  // the stretched cord and stakes
  ...[0, 72, 144, 216, 288].map(a => S(`M30 20 L${n(30 + 10 * Math.cos((a - 90) * Math.PI / 180))} ${n(20 + 10 * Math.sin((a - 90) * Math.PI / 180))}`, 'bs', 2)), // her star headdress
  S('M30 26 L30 40', 'hi', 1.6),
]);
def('nefertem', () => [
  P('M30 46 Q18 36 22 20 Q26 30 30 30 Q34 30 38 20 Q42 36 30 46 Z', 'bs'),    // the open lotus he rose from
  S('M22 20 Q26 28 30 30 M38 20 Q34 28 30 30', 'hi', 1.4),
  S('M30 46 L30 54', 'lo', 2.4),
]);
def('nekhbet', () => [
  E(30, 26, 6, 8, 'lo'), C(30, 18, 3, 'hi'),                                  // vulture body and head
  P('M24 24 Q4 14 4 30 Q16 26 24 30 Z', 'bs'), P('M36 24 Q56 14 56 30 Q44 26 36 30 Z', 'bs'), // spread wings
  E(30, 42, 6, 3, 'ik'),                                                      // the shen-ring she grips
]);
def('min', () => [
  stalk('bs', 22, 50, 18), stalk('hi', 30, 50, 14), stalk('bs', 38, 50, 18),  // the harvest sheaf carried to the fields
  S('M30 8 L30 20', 'ik', 2.4),                                               // the flail's handle
  ...[[22, 8], [30, 4], [38, 8]].map(([x, y]) => S(`M30 20 L${x} ${y}`, 'lo', 1.8)), // its strands
]);
def('renenutet', () => [
  P('M18 46 L42 46 L42 30 Q30 24 18 30 Z', 'bs'),                             // the granary
  S('M30 44 Q14 40 16 24 Q18 12 30 12 Q26 18 30 24 Q34 30 30 38', 'lo', 3),   // the cobra coiled around it
  P('M28 10 L34 10 L30 4 Z', 'hi'),
]);
def('bes', () => [
  E(30, 30, 15, 16, 'bs'),                                                    // a face turned to meet you, not in profile
  E(22, 26, 3.4, 4, 'ik'), E(38, 26, 3.4, 4, 'ik'),                           // both eyes, forward
  S('M20 38 Q30 46 40 38', 'lo', 2.4),
  ...[16, 24, 32, 40].map(x => S(`M${x} 12 L${x} 18`, 'hi', 2)),              // the mane
]);
def('mut', () => [
  P('M24 46 L36 46 L34 20 Q30 10 26 20 Z', 'hi'),                             // the white crown
  P('M18 46 L42 46 L42 38 Q46 32 40 30 L20 30 Q14 32 18 38 Z', 'bs'),         // the red crown, worn together
  S('M42 32 Q48 30 46 24', 'lo', 2.2),                                        // its curling wire
]);
def('tefnut', () => [
  C(30, 20, 8, 'hi'),                                                         // the solar disc
  S('M30 28 Q24 38 26 46 Q28 50 30 46 Q32 50 34 46 Q36 38 30 28', 'bs', 2.4), // the rearing uraeus beneath it
  C(24, 40, 2, 'lo'), C(36, 44, 2, 'lo'), C(30, 50, 2, 'lo'),                 // moisture, sneezed into being
]);
def('sokar', () => [
  P('M10 40 Q10 46 16 46 L44 46 Q50 46 50 40 Q40 44 30 42 Q20 44 10 40 Z', 'bs'), // the solar barque
  E(30, 26, 6, 8, 'lo'), P('M26 20 L20 14 L28 20 Z', 'hi'),                   // his falcon head and beak
]);
def('wepwawet', () => [
  S('M30 12 L30 52', 'lo', 2.6),                                              // the standard's pole
  E(30, 12, 7, 8, 'bs'), P('M24 8 L27 2 L30 8 Z', 'hi'), P('M30 8 L33 2 L36 8 Z', 'hi'), // the wolf head, ears up
  S('M18 30 L30 30 M18 40 L30 40', 'ik', 1.6),                                // streamers, carried out ahead
]);

/* weather instruments — none of these had a working precedent yet either */
def('anemometer', () => [
  S('M30 30 L14 18 M30 30 L46 18 M30 30 L14 42 M30 30 L46 42', 'ik', 2.2),   // the crossed arms
  ...[[14, 18], [46, 18], [14, 42], [46, 42]].map(([x, y], i) => E(x, y, 5, 4, i % 2 ? 'hi' : 'bs')), // the cups, Robinson's design
  S('M30 30 L30 52', 'lo', 3),
]);
def('rain_gauge', () => [
  P('M16 12 L44 12 L32 26 L28 26 Z', 'bs'),                                   // the funnel
  P('M24 26 L36 26 L36 50 L24 50 Z', 'lo'),                                   // the graduated cylinder
  ...[32, 38, 44].map(y => S(`M24 ${y} L28 ${y}`, 'hi', 1.4)),
]);
def('weather_vane', () => [
  S('M30 12 L30 50', 'lo', 2.4),                                              // the pole
  P('M30 14 L44 20 L30 26 Z', 'bs'), P('M30 14 L18 17 L30 20 Z', 'hi'),       // the asymmetric pointer
  S('M20 40 L40 40 M30 34 L30 46', 'ik', 1.4),                                // the compass ticks it swings across
]);
def('hygrometer', () => [
  ring('lo', 30, 30, 15, 2.6), S('M30 30 L38 20', 'ik', 2.4), C(30, 30, 2, 'hi'), // the dial
  ...coilOf('bs', 3, 20, 50, 3),                                              // the hair strand that drives it
]);

/* Viking, Roman and Age-of-Sail history */
def('longship', () => [
  P('M8 40 Q30 48 52 40 L46 46 Q30 50 14 46 Z', 'lo'),                        // the clinker-built hull
  S('M30 40 L30 10', 'ik', 2.4), P('M18 14 L42 14 L38 34 L22 34 Z', 'bs'),    // mast and one square sail
  S('M8 40 Q4 36 10 32', 'hi', 2.2),                                          // the prow's curl
]);
def('viking', () => [
  C(24, 30, 13, 'bs'), ring('lo', 24, 30, 13, 2), C(24, 30, 3, 'hi'),         // the round shield
  S('M40 14 L48 46', 'ik', 3), P('M40 14 L52 10 L52 20 L40 22 Z', 'lo'),      // and the axe, not a horned helm
]);
def('gladiator', () => [
  C(20, 34, 11, 'bs'), ring('lo', 20, 34, 11, 1.8),                           // the round shield
  P('M32 10 L36 10 L34 42 L38 46 L30 46 L34 42 Z', 'hi'),                     // the short gladius
  S('M28 14 L44 22', 'ik', 2.6),
]);
def('caravel', () => [
  P('M14 42 Q30 48 46 42 L42 46 Q30 50 18 46 Z', 'bs'),                       // the narrow hull
  S('M26 42 L26 10', 'ik', 2.2), P('M26 12 L44 38 L26 38 Z', 'hi'),           // mast and lateen sail — sails closer to the wind
]);
def('columbus', () => [
  P('M14 20 Q10 20 10 30 Q10 40 14 40 L14 20 Z', 'lo'), P('M14 20 L44 20 L44 40 L14 40 Z', 'bs'), // the chart, unrolling
  ...[0, 90, 180, 270].map(a => S(`M30 30 L${n(30 + 10 * Math.cos(a * Math.PI / 180))} ${n(30 + 10 * Math.sin(a * Math.PI / 180))}`, 'ik', 1.6)), // the compass rose
  C(30, 30, 2, 'hi'),
]);

/* pre-industrial machines, each from its one working mechanism */
def('archimedes_screw', () => [
  S('M14 46 L46 14', 'lo', 9),                                                // the tube, tilted
  ...[[18, 42], [24, 36], [30, 30], [36, 24], [42, 18]].map(([x, y]) => S(`M${x - 4} ${y - 4} L${x + 4} ${y + 4}`, 'hi', 2)), // the helix inside it
  S('M10 50 L18 42', 'bs', 3.4),                                              // water, lifted
]);
def('elephant_clock', () => [
  E(30, 48, 20, 8, 'bs'),                                                     // the elephant's back
  P('M20 46 L20 20 Q20 12 30 12 Q40 12 40 20 L40 46 Z', 'lo'),                // the housing it carries
  C(30, 14, 3, 'hi'), C(30, 34, 2, 'ik'),                                     // the bell, and the ball mid-drop
]);
def('crankshaft', () => [
  C(18, 30, 5, 'lo'),                                                         // the main journal
  P('M18 30 L42 14 L48 20 L24 36 Z', 'bs'), C(42, 16, 5, 'hi'),               // the offset web and crank pin
  S('M8 30 L18 30 M42 16 L52 16', 'ik', 2.2),
]);
def('submarine', () => [
  E(30, 32, 22, 10, 'lo'),                                                    // the leather-covered hull
  S('M14 32 L4 26 M14 34 L4 40 M46 32 L56 26 M46 34 L56 40', 'bs', 2.2),      // oars sealed through the sides
  wave('hi', 16, 4, 20),                                                      // the surface, above it
]);
def('thermostat', () => [
  C(18, 42, 6, 'lo'), S('M18 36 L18 14', 'lo', 3),                            // the mercury bulb and its column
  S('M18 14 L42 14', 'ik', 2.4), P('M42 10 L50 10 L50 26 L42 26 Z', 'bs'),    // the lever, and the damper it closes
]);
def('lightning_rod', () => [
  P('M12 46 L30 24 L48 46 Z', 'gh'), S('M30 24 L30 10', 'ik', 2.6),           // the roof, and the point on it
  bolt('bs', 30, 8, .8),                                                      // a stroke given somewhere safe to go
  S('M30 46 L30 54', 'lo', 2),                                                // the ground wire
]);
def('bifocals', () => [
  ring('lo', 18, 30, 9, 2.4), ring('lo', 42, 30, 9, 2.4),                     // two lenses
  S('M27 30 L33 30', 'ik', 2.2), S('M9 30 L4 26 M51 30 L56 26', 'ik', 1.8),   // bridge and temples
  S('M9 33 L27 33 M33 33 L51 33', 'hi', 1.4),                                 // the split — near below, far above
]);
def('centrifugal_governor', () => [
  S('M30 10 L30 50', 'lo', 3),                                                // the spindle
  S('M30 20 L14 34 M30 20 L46 34', 'ik', 2.4),                                // arms, swinging outward with speed
  C(14, 34, 5, 'bs'), C(46, 34, 5, 'bs'),                                     // the flyweights
  P('M24 44 L36 44 L36 50 L24 50 Z', 'hi'),                                   // the collar that chokes the throttle
]);


/* craft — myth, hominin and trade batch ─────────────────────────────────
 * Sixty ids that would otherwise share the two-rectangle craft fallback.
 * Every Greek god/hero gets the one attribute the myths actually hang on
 * them — Zeus is his thunderbolt, Poseidon his trident, Athena her owl —
 * rather than a generic robed figure, since the attribute is what a reader
 * actually recognises. The five hominins share one skull-profile silhouette
 * on purpose (they ARE one lineage) but each carries its own tell: a faint
 * brow on the small-brained early ones, a heavier bar on erectus and
 * heidelbergensis, an occipital bun on neanderthalensis, plus one accent
 * shape tied to the fact on its card (footprints, a flake, a spear, a
 * flower). The Ramayana/Krishna figures get the same treatment as the
 * Greeks: the object the story remembers them by. */

/* Greek myth — gods, Titans, heroes, and the arrow and hound among them */
def('arrow', () => [S('M12 48 L44 16', 'bs', 3), P('M44 16 L50 8 L38 14 Z', 'ik'),
                    S('M12 48 L18 42 M12 48 L6 44', 'hi', 2)]);                       // shaft, head, fletching
def('cerberus', () => [E(30, 46, 20, 10, 'lo'),
                       C(16, 26, 7.5, 'bs'), C(30, 20, 8.5, 'bs'), C(44, 26, 7.5, 'bs'), // three heads
                       P('M12 20 L16 12 L20 21 Z', 'ik'), P('M40 21 L44 12 L48 20 Z', 'ik'),
                       S('M30 46 Q42 52 48 44', 'hi', 3)]);
def('zeus', () => [P('M26 4 L14 28 L23 28 L17 56 L40 24 L28 24 Z', 'bs'),             // the thunderbolt
                   S('M20 26 L36 26', 'ik', 2),
                   P('M22 2 L28 2 L25 8 Z', 'hi'), P('M20 52 L26 52 L23 58 Z', 'hi')]);
def('hera', () => [S('M30 16 L30 52', 'ik', 3),                                       // the peacock-feather sceptre
                   E(30, 12, 9, 12, 'bs'), E(30, 12, 5, 7, 'hi'), C(30, 10, 2, 'lo'),
                   S('M30 16 L18 22 M30 16 L42 22', 'hi', 1.6)]);
def('poseidon', () => [S('M30 20 L30 54', 'bs', 3.6),                                 // the trident
                       S('M30 20 L18 4 M30 20 L30 2 M30 20 L42 4', 'ik', 2.8),
                       S('M21 30 L39 30', 'lo', 2.2)]);
def('hades', () => [P('M16 34 Q16 14 30 12 Q44 14 44 34 L44 40 L16 40 Z', 'lo'),      // the helm of darkness
                    P('M20 40 L20 46 L40 46 L40 40 Z', 'bs'),
                    S('M26 34 L26 26 M34 34 L34 26', 'ik', 2.6), P('M28 12 L32 12 L32 4 L28 4 Z', 'hi')]);
def('athena', () => [E(30, 34, 16, 14, 'bs'),                                         // the owl
                     P('M18 22 L24 12 L26 24 Z', 'ik'), P('M42 22 L36 12 L34 24 Z', 'ik'),
                     C(23, 28, 5, 'hi'), C(37, 28, 5, 'hi'), C(23, 28, 2, 'lo'), C(37, 28, 2, 'lo'),
                     P('M28 34 L32 34 L30 39 Z', 'lo')]);
def('apollo', () => [P('M16 48 Q12 30 20 14 Q22 30 20 48 Z', 'bs'), P('M44 48 Q48 30 40 14 Q38 30 40 48 Z', 'bs'), // the lyre
                     S('M20 14 L40 14', 'ik', 2.4), S('M24 18 L24 46 M30 16 L30 47 M36 18 L36 46', 'hi', 1.4)]);
def('artemis', () => [S('M18 10 Q10 30 18 50', 'bs', 3), S('M18 10 L18 50', 'ik', 1.4), // the bow, drawn and nocked
                      S('M18 30 L44 30', 'hi', 2.2), P('M44 30 L38 26 L38 34 Z', 'lo')]);
def('ares', () => [C(20, 36, 12, 'lo'), S('M20 24 L20 48 M12 36 L28 36', 'ik', 1.6),   // shield and spear
                   S('M14 12 L48 46', 'bs', 3.4), P('M48 46 L42 40 L44 50 Z', 'ik')]);
def('aphrodite', () => [P('M30 12 Q10 20 12 42 Q20 52 30 46 Q40 52 48 42 Q50 20 30 12 Z', 'bs'), // the scallop shell
                        S('M30 16 L30 46 M20 20 L24 44 M40 20 L36 44', 'hi', 1.4)]);
def('hermes', () => [S('M30 8 L30 50', 'ik', 2.6),                                    // the caduceus
                     S('M30 14 Q18 20 30 28 Q42 36 30 42', 'bs', 2.2),
                     S('M30 14 Q42 20 30 28 Q18 36 30 42', 'lo', 2.2),
                     P('M22 6 L38 6 L36 12 L24 12 Z', 'hi')]);
def('dionysus', () => [P('M18 26 L42 26 L38 46 Q30 50 22 46 Z', 'bs'),                // the kantharos, and its spilling grapes
                       S('M18 30 Q10 30 10 22 M42 30 Q50 30 50 22', 'ik', 2.4),
                       C(24, 16, 3.4, 'lo'), C(30, 12, 3.6, 'lo'), C(36, 16, 3.4, 'lo')]);
def('demeter', () => [S('M18 50 L14 14 M30 50 L30 6 M42 50 L46 14', 'bs', 2.4),       // the wheat sheaf
                      grain('hi', 14, 12, 1.1), grain('hi', 30, 5, 1.1), grain('hi', 46, 12, 1.1),
                      S('M16 34 L44 34', 'lo', 3)]);
def('persephone', () => [P('M18 24 Q16 12 30 12 Q44 12 42 24 Q46 38 30 48 Q14 38 18 24 Z', 'lo'), // the pomegranate, split open
                         P('M22 26 Q30 20 38 26 Q40 36 30 44 Q20 36 22 26 Z', 'bs'),
                         ...[[26, 30], [32, 28], [28, 36], [34, 34], [30, 40]].map(([x, y]) => C(x, y, 2, 'hi')),
                         P('M27 8 L33 8 L30 14 Z', 'gh')]);
def('hephaestus', () => [P('M16 44 L44 44 L40 50 L20 50 Z', 'lo'), P('M22 38 L38 38 L38 44 L22 44 Z', 'bs'), // anvil and hammer
                         S('M32 10 L20 26', 'ik', 4), P('M14 20 L30 14 L34 22 L18 28 Z', 'hi')]);
def('cronus', () => [S('M20 52 L34 14', 'ik', 3), P('M34 14 Q50 10 48 26 Q40 30 30 22 Z', 'bs')]); // the harvest scythe
def('gaia', () => [C(30, 34, 18, 'lo'), S('M14 28 Q30 34 46 24 M18 42 Q30 38 44 44', 'bs', 2),      // the world, and what grows from her
                   S('M30 16 L30 6', 'hi', 2.4), leaf('hi', 26, 6, .55, -20), leaf('hi', 34, 6, .5, 20)]);
def('uranus', () => [P('M6 40 Q6 12 30 12 Q54 12 54 40 Z', 'lo'),                     // the starry dome of the sky
                     ...[[16, 26], [30, 18], [44, 26], [24, 34], [38, 34]].map(([x, y]) => C(x, y, 1.6, 'hi')),
                     S('M6 40 L54 40', 'ik', 2)]);
def('rhea', () => [P('M16 34 L16 20 L22 20 L22 14 L27 14 L27 20 L33 20 L33 14 L38 14 L38 20 L44 20 L44 34 Z', 'bs'), // the towered crown
                   E(30, 44, 16, 8, 'lo')]);
def('eros', () => [P('M30 44 Q10 28 16 16 Q22 6 30 18 Q38 6 44 16 Q50 28 30 44 Z', 'bs'), // the pierced heart
                   S('M10 22 L50 42', 'ik', 2.4), P('M50 42 L44 38 L46 46 Z', 'lo')]);
def('nike', () => [P('M30 30 Q10 14 6 32 Q16 34 30 30 Z', 'bs'), P('M30 30 Q50 14 54 32 Q44 34 30 30 Z', 'bs'), // the wings
                   S('M14 22 L24 26 M46 22 L36 26', 'hi', 1.4)]);
def('helios', () => [C(30, 38, 11, 'bs'),                                             // the radiant crown, not the full sun
                     S('M30 27 L30 8 M20 30 L8 18 M40 30 L52 18 M14 36 L2 32 M46 36 L58 32', 'hi', 2.4)]);
def('selene', () => [P('M38 12 A20 20 0 1 0 38 52 A15 15 0 1 1 38 12 Z', 'bs'),       // the crescent, and her chariot wheel
                     C(18, 46, 5, 'lo'), S('M18 41 L18 51 M13 46 L23 46', 'hi', 1.4)]);
def('eos', () => [S('M8 42 L52 42', 'ik', 2), P('M14 42 A16 16 0 0 1 46 42 Z', 'bs'), // dawn, breaking low over the horizon
                  S('M20 30 L14 18 M30 24 L30 10 M40 30 L46 18', 'hi', 2)]);
def('pan', () => [P('M14 48 L14 20 L20 20 L20 48 Z', 'bs'), P('M22 48 L22 26 L28 26 L28 48 Z', 'hi'), // the panpipes
                  P('M30 48 L30 32 L36 32 L36 48 Z', 'bs'), P('M38 48 L38 38 L44 38 L44 48 Z', 'hi'),
                  S('M12 48 L46 48', 'ik', 2)]);
def('hypnos', () => [E(30, 34, 13, 16, 'bs'), S('M22 22 L20 14 M30 20 L30 10 M38 22 L40 14', 'hi', 1.6), // the poppy pod
                     S('M30 50 L30 56', 'ik', 2)]);
def('heracles', () => [S('M22 50 L34 14', 'lo', 5),                                   // the knotted club, and the lion's pelt
                       C(31, 18, 3, 'gh'), C(35, 24, 2.4, 'gh'), C(30, 28, 2, 'gh'),
                       P('M40 44 L52 38 L50 50 Z', 'hi')]);
def('odysseus', () => [P('M10 42 Q30 50 50 42 L46 48 Q30 54 14 48 Z', 'bs'),          // the ship, sail catching wind
                       S('M30 42 L30 10', 'ik', 2.6), P('M30 12 Q46 18 44 30 Q36 26 30 24 Z', 'hi')]);

def('liquid_nitrogen', () => [vessel('gh', 20, 48), wave('bs', 40, 3, 12),            // it boils, and floats on its own vapour
                              C(38, 22, 3, 'hi'), S('M38 26 Q34 30 38 34 Q42 38 38 42', 'hi', 1.6),
                              S('M20 28 Q16 22 20 16 M28 24 Q24 18 28 12', 'gh', 1.6)]);

/* early hominins — one skull silhouette, since they are one lineage, but
   each with its own brow, its own jaw, and one accent tied to its own fact */
def('australopithecus_afarensis', () => [
  P('M14 34 Q12 22 20 16 Q26 10 32 14 Q38 16 40 22 Q48 24 48 32 Q46 38 40 38 L36 44 Q28 46 20 42 Q14 40 14 34 Z', 'bs'),
  S('M30 18 L38 20', 'ik', 1.4),                                  // only a faint brow yet
  C(14, 52, 1.6, 'gh'), C(22, 54, 1.6, 'gh'),                      // the Laetoli footprints — upright already
]);
def('homo_habilis', () => [
  P('M12 32 Q9 18 20 12 Q28 7 35 12 Q41 15 42 21 Q49 24 48 32 Q46 37 40 37 L35 43 Q27 46 18 41 Q12 38 12 32 Z', 'bs'),
  S('M31 17 L40 19', 'ik', 1.6),
  P('M44 46 L52 44 L48 52 Z', 'gh'),                               // the flake it knapped
]);
def('homo_erectus', () => [
  P('M10 32 Q8 20 18 15 Q26 11 34 14 Q40 16 42 22 Q50 24 49 32 Q47 37 41 36 L37 42 Q28 45 18 41 Q10 38 10 32 Z', 'bs'),
  S('M28 20 L44 18', 'ik', 3),                                     // a heavier brow
  S('M14 52 L26 52 L38 52', 'gh', 1.4),                            // the long stride out of Africa
]);
def('homo_heidelbergensis', () => [
  P('M9 30 Q6 15 20 9 Q30 4 38 10 Q44 14 44 20 Q52 23 50 32 Q48 37 42 36 L38 43 Q28 46 17 41 Q9 37 9 30 Z', 'bs'),
  S('M26 17 L44 15', 'ik', 3),                                     // the biggest braincase yet
  S('M46 46 L54 40', 'gh', 2.4),                                   // the hunting spear, organized and thrown
]);
def('homo_neanderthalensis', () => [
  P('M8 32 Q3 27 8 20 Q7 12 20 8 Q30 3 38 9 Q44 13 44 20 Q52 22 50 32 Q48 38 42 37 L38 43 Q27 46 16 42 Q8 38 8 32 Z', 'bs'),
  S('M24 18 L42 16', 'ik', 3.6),                                   // the heaviest brow, and the bun at the back
  leaf('gh', 46, 48, .4, 20),                                      // flowers laid with the dead, at Shanidar
]);

/* the stone-tool and fire-making kit, and the first art */
def('oldowan_tool', () => [P('M16 40 L14 26 L26 14 L40 18 L42 32 L30 46 Z', 'lo'),    // a stone core, roughly flaked
                           P('M40 18 L48 14 L44 24 Z', 'hi'), S('M20 30 L28 22', 'gh', 1.4)]);
def('acheulean_handaxe', () => [P('M30 10 Q40 16 38 30 Q37 44 30 52 Q23 44 22 30 Q20 16 30 10 Z', 'bs'), // struck symmetrically both faces
                                S('M30 12 L30 50', 'hi', 1.2), S('M24 20 L28 34 M36 20 L32 34', 'gh', 1)]);
def('fire_drill', () => [P('M14 46 L46 46 L46 52 L14 52 Z', 'lo'), S('M30 46 L30 10', 'bs', 3.4),   // spindle spun by hand
                         C(30, 46, 3, 'ik'), S('M30 12 L24 10 M30 12 L36 10', 'hi', 1.6), E(30, 48, 4, 2, 'hi')]);
def('bow_drill', () => [P('M14 48 L46 48 L46 53 L14 53 Z', 'lo'), S('M30 48 L30 12', 'bs', 3),      // bow-driven, faster
                        S('M12 20 Q30 4 48 20', 'ik', 2.4), S('M12 20 Q30 24 48 20', 'hi', 1)]);
def('cave_painting', () => [P('M8 12 L52 12 L52 50 L8 50 Z', 'gh'),                   // ochre on a rock wall
                            S('M16 34 Q24 24 34 28 Q44 32 42 40 Q34 44 26 40 Q18 38 16 34 Z', 'lo', 2.4),
                            S('M22 30 L14 24 M40 34 L48 30', 'bs', 1.6)]);
def('venus_figurine', () => [C(30, 14, 5, 'bs'),                                       // faceless, wide-hipped
                             P('M22 18 Q14 24 18 34 Q10 42 22 50 Q30 54 38 50 Q50 42 42 34 Q46 24 38 18 Q30 24 22 18 Z', 'bs')]);
def('atlatl', () => [S('M12 46 L44 20', 'lo', 3.4), P('M44 20 L48 16 L46 22 Z', 'ik'), // the throwing board, and its hook
                     S('M16 42 L52 12', 'hi', 2), P('M52 12 L58 6 L48 14 Z', 'gh')]);

/* Krishna, Rama, and the figures around them — one object each, the way
   the Greek gods above get theirs */
def('krishna', () => [S('M14 30 L48 24', 'bs', 3.4), S('M20 29 L20 33 M28 27 L28 31 M36 26 L36 30', 'ik', 1.2), // the bansuri
                      P('M46 12 Q54 16 50 24 Q44 20 46 12 Z', 'hi')]);                                          // the peacock feather
def('radha', () => [...[-60, -30, 0, 30, 60].map(rot => leaf('bs', 30, 32, .9, rot)), C(30, 34, 4, 'hi')]); // the Golden Lotus
def('yashoda', () => [P('M18 26 L42 26 L39 48 Q30 52 21 48 Z', 'bs'),                 // the butter pot
                      S('M30 14 L30 40', 'ik', 2.4), S('M22 20 L38 20', 'hi', 1.6)]);
def('kansa', () => [P('M16 32 L16 20 L22 20 L22 14 L27 14 L27 20 L33 20 L27 32 Z', 'lo'), // the crown, split by prophecy
                    P('M33 20 L38 14 L38 20 L44 20 L44 32 L33 32 Z', 'lo'), S('M30 12 L26 34', 'ik', 1.6)]);
def('rama', () => [S('M14 12 Q10 30 16 30', 'bs', 3), S('M44 12 Q48 30 42 30', 'bs', 3), // Shiva's bow, broken to win Sita
                   S('M16 30 L20 34 M42 30 L38 34', 'ik', 1.6)]);
def('sita', () => [...[16, 26, 36, 46].map(y => S(`M8 ${y} Q30 ${y - 4} 52 ${y}`, y === 26 ? 'bs' : 'lo', 2)), // the furrow she is named for
                   leaf('hi', 30, 20, .5, 0)]);
def('ravana', () => [...[10, 20, 30, 40, 50].map(x => P(`M${x - 4} 30 L${x} 14 L${x + 4} 30 Z`, x === 30 ? 'bs' : 'lo')), // ten heads, stylised
                     S('M8 30 L52 30', 'ik', 2)]);
def('lakshmana', () => [P('M12 34 Q10 24 18 22 Q26 20 26 30 Q26 40 16 40 Q10 40 12 34 Z', 'bs'),     // sandals, kept side by side
                        P('M34 30 Q34 20 42 22 Q50 24 48 34 Q46 40 40 40 Q32 40 34 30 Z', 'hi'),
                        S('M18 24 L18 36 M42 24 L42 36', 'ik', 1.4)]);
def('arjuna', () => [S('M20 8 Q10 30 20 52', 'bs', 3), S('M20 8 L20 52', 'ik', 1.4),  // Gandiva, drawn taut
                     S('M20 30 L46 30', 'hi', 2), P('M46 30 L40 26 L40 34 Z', 'lo'),
                     C(50, 46, 5, 'gh'), S('M50 41 L50 51 M45 46 L55 46', 'gh', 1.2)]); // the chariot wheel beneath

/* hand tools and the trades that carry them */
def('chisel', () => [P('M14 30 L38 26 L40 32 L16 36 Z', 'bs'), P('M38 26 L48 22 L50 30 L40 32 Z', 'lo'),
                     P('M14 30 L8 28 L8 36 L14 36 Z', 'hi')]);
def('stethoscope', () => [S('M20 12 Q20 4 28 4 M40 12 Q40 4 32 4', 'ik', 2.6),
                          S('M20 12 L22 30 Q22 40 32 40 Q42 40 42 30', 'bs', 2.6),
                          C(46, 34, 6, 'lo'), C(46, 34, 3, 'hi')]);
def('dental_drill', () => [S('M14 40 Q14 20 34 18', 'lo', 4), C(38, 16, 3.4, 'bs'),
                           S('M40 12 L44 8 M42 16 L48 14 M40 20 L46 22', 'hi', 1.4)]);
def('compass', () => [ring('lo', 30, 32, 15, 2.4), P('M30 20 L34 32 L30 44 L26 32 Z', 'bs'),
                      C(30, 32, 2, 'ik'), S('M30 15 L30 18', 'hi', 1.4)]);
def('fire_hose', () => [...coil('bs', 3, 14), S('M30 42 L48 52', 'lo', 5), P('M48 52 L56 48 L56 56 Z', 'ik')]);
def('chalk', () => [P('M22 14 L34 14 L36 46 Q28 50 20 46 Z', 'hi'), S('M24 14 L32 14', 'lo', 2),
                    ...granules('gh', 5, 331, [18, 46, 38, 54])]);
def('carpenter', () => [S('M14 46 L34 18', 'lo', 4), P('M28 12 L42 14 L40 24 L26 22 Z', 'bs'),
                        S('M20 20 L48 44', 'hi', 2.4), S('M22 24 L26 20 M30 32 L34 28 M38 40 L42 36', 'ik', 1.4)]);
def('electrician', () => [S('M14 20 L14 46', 'ik', 3), S('M46 20 L46 46', 'ik', 3), bolt('bs', 30, 16, .8)]);
def('plumber', () => [S('M14 44 L34 24', 'lo', 5), P('M30 16 L42 16 L42 26 L36 26 L36 30 L30 30 Z', 'bs'),
                      S('M16 46 L48 46', 'hi', 3), C(50, 50, 1.6, 'gh'), C(52, 54, 1.2, 'gh')]);


/* flight ─────────────────────────────────────────────────────────────────
   Each craft is drawn from the one part that actually explains how it stays
   up: the turbofan's duct and blades, the glider's bare wing with no engine
   at all, the balloon's heated envelope, the rotor's own spinning blade pair
   standing apart from helicopter's full airframe. */
def('turbofan', () => [
  ring('lo', 30, 32, 19, 4),
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return S(`M${n(30 + 8 * Math.cos(a))} ${n(32 + 8 * Math.sin(a))} L${n(30 + 16 * Math.cos(a))} ${n(32 + 16 * Math.sin(a))}`, 'bs', 3);
  }),
  C(30, 32, 6, 'hi'),
]);
def('glider', () => [
  P('M4 33 L56 33 L56 36 L4 36 Z', 'bs'),
  P('M27 18 L33 18 L34 50 L26 50 Z', 'lo'),
  P('M27 46 L33 46 L37 54 L23 54 Z', 'hi'),
]);
def('hot_air_balloon', () => [
  E(30, 22, 16, 18, 'bs'),
  S('M18 14 Q30 24 18 34', 'lo', 1.2),
  S('M42 14 Q30 24 42 34', 'lo', 1.2),
  P('M23 40 L37 40 L34 48 L26 48 Z', 'gh'),
  P('M28 38 Q30 32 32 38 Z', 'hi'),
]);
def('airship', () => [
  E(30, 24, 24, 10, 'bs'),
  P('M46 20 L54 24 L46 28 Z', 'lo'),
  P('M22 32 L38 32 L36 40 L24 40 Z', 'gh'),
  S('M24 34 L24 40', 'hi', 1),
  S('M36 34 L36 40', 'hi', 1),
]);
def('rotor', () => [
  ['g', -8, 30, 32, [P('M6 31 L54 31 L54 33 L6 33 Z', 'bs')]],
  ['g', 82, 30, 32, [P('M6 31 L54 31 L54 33 L6 33 Z', 'lo')]],
  C(30, 32, 4, 'ik'),
]);
def('helicopter', () => [
  E(26, 34, 14, 10, 'lo'),
  S('M40 36 L54 38', 'bs', 4),
  C(53, 30, 4, 'gh'), S('M49 30 L57 30', 'ik', 1.4),
  S('M10 18 L50 18', 'ik', 2.4), S('M26 24 L26 18', 'lo', 2),
]);
def('parachute', () => [
  P('M10 20 A20 20 0 0 1 50 20 Q30 28 10 20 Z', 'bs'),
  ...[14, 22, 30, 38, 46].map(x => S(`M${x} 20 L30 46`, 'ik', 1)),
  C(30, 50, 4, 'lo'),
]);
def('jet_airliner', () => [
  P('M6 31 Q6 28 10 28 L48 28 Q54 28 54 31 Q54 34 48 34 L10 34 Q6 34 6 31 Z', 'lo'),
  P('M24 22 L40 31 L24 34 Z', 'bs'),
  P('M44 20 L50 28 L44 28 Z', 'hi'),
  ...[14, 20, 26, 32, 38].map(x => C(x, 31, 0.9, 'ground')),
]);
def('airport', () => [
  P('M6 40 L54 40 L54 46 L6 46 Z', 'lo'),
  ...[12, 20, 28, 36, 44].map(x => S(`M${x} 43 L${x + 4} 43`, 'ground', 1.6)),
  P('M24 14 L36 14 L34 40 L26 40 Z', 'gh'),
  E(30, 12, 8, 5, 'bs'),
]);

/* the mining chain ───────────────────────────────────────────────────────
   Exploration through logistics, drawn as the working step each one actually
   is: the contour map, the bullseye a magnetic anomaly gets drilled through,
   the block model's graded cubes, the hopper a rotary dumper empties into. */
def('geological_mapping', () => [
  P('M10 10 L50 10 L50 50 L10 50 Z', 'gh'),
  S('M14 20 Q30 16 46 20', 'lo', 1.4), S('M14 30 Q30 24 46 30', 'lo', 1.4), S('M14 40 Q30 36 46 40', 'lo', 1.4),
  S('M18 12 L42 48', 'ik', 1.8),
]);
def('target_generation', () => [
  ring('lo', 30, 32, 18, 2.2), ring('bs', 30, 32, 11, 2.2), ring('hi', 30, 32, 5, 2.2),
  S('M30 8 L30 20', 'ik', 1.6), S('M30 44 L30 56', 'ik', 1.6),
  S('M6 32 L18 32', 'ik', 1.6), S('M42 32 L54 32', 'ik', 1.6),
]);
def('exploration_drilling', () => [
  P('M8 46 L52 46 L52 56 L8 56 Z', 'lo'),
  S('M28 6 L28 46', 'ik', 4),
  P('M24 46 L32 46 L31 54 L25 54 Z', 'bs'),
  C(28, 6, 3, 'hi'),
]);
def('resource_estimation', () => [
  ...[0, 1, 2].flatMap(row => [0, 1, 2].map(col =>
    P(`M${14 + col * 11} ${16 + row * 11} L${23 + col * 11} ${16 + row * 11} L${23 + col * 11} ${25 + row * 11} L${14 + col * 11} ${25 + row * 11} Z`,
      (row + col) % 2 ? 'hi' : 'bs'))),
]);
def('feasibility_study', () => [
  P('M14 8 L38 8 L46 16 L46 52 L14 52 Z', 'gh'),
  P('M38 8 L38 16 L46 16 Z', 'lo'),
  ...[20, 27, 34].map((x, i) => P(`M${x} ${44 - i * 6} L${x + 5} ${44 - i * 6} L${x + 5} 44 L${x} 44 Z`, 'bs')),
]);
def('blasting', () => [
  P('M6 20 L54 20 L54 50 L6 50 Z', 'lo'),
  ...[16, 26, 36, 46].map(x => C(x, 26, 1.6, 'ik')),
  ...Array.from({ length: 8 }, (_, i) => ['g', i * 45, 30, 38, [S('M30 38 L30 26', 'hi', 2)]]),
]);
def('excavator', () => [
  mound('lo', 50, 20, 12),
  P('M20 44 L34 44 L34 48 L20 48 Z', 'gh'),
  S('M27 44 L38 24 L50 30', 'ik', 4),
  P('M46 26 L56 26 L54 36 L44 34 Z', 'bs'),
]);
def('assay', () => [
  P('M20 40 Q20 50 30 50 Q40 50 40 40 L38 30 L22 30 Z', 'gh'),
  C(30, 36, 3, 'hi'),
  S('M14 20 L46 20', 'ik', 2),
  S('M14 20 L14 26', 'ik', 1.4), S('M46 20 L46 26', 'ik', 1.4),
  C(30, 20, 2, 'ik'),
]);
def('grade_control', () => [
  facet('bs', .7),
  S('M8 44 L52 44', 'ik', 2),
  S('M40 40 L44 46 L52 34', 'hi', 2.6),
]);
def('magnetic_separation', () => [
  C(30, 16, 9, 'lo'),
  C(14, 50, 2, 'gh'), C(22, 52, 2, 'gh'), C(38, 52, 2, 'gh'), C(46, 50, 2, 'gh'),
  C(24, 30, 2.2, 'bs'), C(36, 30, 2.2, 'bs'),
  S('M24 30 Q26 22 30 18', 'hi', 1), S('M36 30 Q34 22 30 18', 'hi', 1),
]);
def('gravity_separation', () => [
  P('M8 46 L52 46 L48 56 L12 56 Z', 'gh'),
  P('M12 42 L48 42 L48 48 L12 48 Z', 'lo'),
  P('M12 34 L48 34 L48 40 L12 40 Z', 'bs'),
  P('M12 26 L48 26 L48 32 L12 32 Z', 'hi'),
]);
def('heap_leach', () => [
  mound('bs', 34, 20, 16),
  ...[16, 24, 32, 40, 48].map(x => S(`M${x} 6 L${x} 16`, 'gh', 1)),
  E(30, 52, 18, 6, 'lo'),
]);
def('road_freight', () => [
  P('M8 34 L20 34 L20 24 L28 24 L28 34 L8 34 Z', 'lo'),
  P('M28 24 L52 24 L52 40 L28 40 Z', 'bs'),
  C(16, 42, 4, 'ik'), C(44, 42, 4, 'ik'),
]);
def('slurry_pipeline', () => [
  S('M6 20 L54 44', 'bs', 5),
  S('M16 25 L16 37', 'ik', 2), S('M30 32 L30 44', 'ik', 2), S('M44 39 L44 51', 'ik', 2),
  wave('gh', 56, 3, 26),
]);
def('car_dumper', () => [
  ['g', 35, 26, 30, [P('M10 24 L42 24 L42 36 L10 36 Z', 'lo')]],
  ...granules('bs', 6, 19, [22, 30, 44, 50]),
  P('M14 46 L46 46 L40 56 L20 56 Z', 'gh'),
]);
def('stacker_reclaimer', () => [
  mound('bs', 48, 20, 14),
  S('M14 14 L14 40', 'ik', 3), S('M46 14 L46 40', 'ik', 3), S('M10 14 L50 14', 'ik', 3),
  S('M30 14 L44 30', 'lo', 4),
]);
def('ship_loader', () => [
  P('M8 44 Q8 52 20 52 L46 52 Q52 52 50 46 L44 40 L14 40 Z', 'lo'),
  S('M20 10 L20 38', 'ik', 3), S('M20 12 L48 24', 'bs', 4),
  ...granules('hi', 5, 43, [40, 20, 48, 36]),
]);

/* orisha and the pantheons that travelled with the diaspora ──────────────
   No figure here is a drawn body — every one of these reads by its own
   attribute, the same way the game already lets a knife's blade or a
   telescope's tube stand for the whole tool. Shango is his double axe and
   the thunder it calls, not a crowned king; Ganesha is the one silhouette
   in the set specific enough to need no attribute beyond itself. */
def('shango', () => [
  S('M30 10 L30 34', 'ik', 3),
  P('M18 6 L30 10 L18 14 Z', 'bs'), P('M42 6 L30 10 L42 14 Z', 'bs'),
  zig('hi', 46, 4, 5),
]);
def('obatala', () => [
  mound('lo', 50, 20, 14),
  C(30, 18, 5, 'hi'),
  E(30, 30, 6, 8, 'hi'),
  P('M14 10 Q30 4 46 10 L44 18 Q30 12 16 18 Z', 'gh'),
]);
def('orisha', () => [
  C(30, 32, 4, 'ik'),
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return C(n(30 + 14 * Math.cos(a)), n(32 + 14 * Math.sin(a)), 2.6, 'bs');
  }),
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    return C(n(30 + 22 * Math.cos(a)), n(32 + 22 * Math.sin(a)), 1.6, 'hi');
  }),
]);
def('eshu', () => [
  S('M8 10 L52 54', 'lo', 3), S('M52 10 L8 54', 'lo', 3),
  P('M25 26 Q25 20 30 20 Q35 20 35 26 L35 36 Q35 40 30 40 Q25 40 25 36 Z', 'bs'),
  S('M27 22 L33 22', 'ik', 1.4),
]);
def('elegua', () => [
  C(20, 32, 11, 'lo'),
  E(16, 30, 1.8, 1.2, 'hi'), E(24, 30, 1.8, 1.2, 'hi'),
  ring('bs', 44, 12, 5, 2.4),
  S('M44 17 L44 40', 'bs', 3),
  S('M44 34 L50 34', 'bs', 2), S('M44 40 L48 40', 'bs', 2),
]);
def('olorun', () => [
  C(30, 14, 7, 'gh'),
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return S(`M${n(30 + 10 * Math.cos(a))} ${n(14 + 10 * Math.sin(a))} L${n(30 + 15 * Math.cos(a))} ${n(14 + 15 * Math.sin(a))}`, 'gh', 1.2);
  }),
  S('M30 24 L30 50', 'lo', 1.2),
  wave('bs', 52, 3, 16),
]);
def('yemoja', () => [
  wave('lo', 46, 6, 24), wave('bs', 38, 5, 20),
  E(26, 26, 8, 4, 'hi'), P('M34 26 L40 21 L40 31 Z', 'hi'),
]);
def('anansi', () => [
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return S(`M30 30 L${n(30 + 22 * Math.cos(a))} ${n(32 + 22 * Math.sin(a))}`, 'gh', 1);
  }),
  ring('gh', 30, 32, 12, 1),
  C(30, 32, 5, 'ik'),
  S('M30 32 L20 24', 'ik', 1.4), S('M30 32 L40 24', 'ik', 1.4),
  S('M30 32 L20 40', 'ik', 1.4), S('M30 32 L40 40', 'ik', 1.4),
]);
def('oya', () => [
  S('M30 32 Q42 32 42 22 Q42 12 30 14 Q20 16 22 26 Q24 34 32 32', 'lo', 2.6),
  S('M30 14 Q22 6 17 8', 'bs', 2.4), S('M30 14 Q38 6 43 8', 'bs', 2.4),
]);
def('babalu_aye', () => [
  P('M22 52 L22 14 Q30 8 38 14 L38 52 Z', 'lo'),
  S('M22 18 L38 18', 'hi', 1.2), S('M22 24 L38 24', 'hi', 1.2), S('M22 30 L38 30', 'hi', 1.2),
  S('M22 36 L38 36', 'hi', 1.2), S('M22 42 L38 42', 'hi', 1.2),
  C(26, 20, 1.6, 'gh'), C(34, 30, 1.6, 'gh'), C(27, 40, 1.6, 'gh'),
]);
def('abassi', () => [
  stalk('lo', 20, 48, 14),
  S('M10 20 L30 44', 'ik', 2), S('M30 20 L10 44', 'ik', 2),
  E(42, 34, 6, 8, 'hi'),
  S('M36 26 L48 42', 'ik', 2),
]);
def('bumba', () => [
  P('M10 30 Q10 14 30 14 Q50 14 50 30 Q50 40 30 40 Q10 40 10 30 Z', 'ik'),
  C(20, 24, 4, 'hi'),
  P('M38 20 A5 5 0 1 0 38 30 A4 4 0 1 1 38 20 Z', 'gh'),
  C(30, 50, 3, 'bs'), S('M30 50 L30 44', 'lo', 1.4),
]);
def('veena', () => [
  S('M14 30 L48 30', 'ik', 3),
  E(16, 30, 6, 9, 'bs'), E(50, 26, 4, 5, 'lo'),
  S('M20 27 L20 33', 'hi', 1), S('M26 27 L26 33', 'hi', 1), S('M32 27 L32 33', 'hi', 1), S('M38 27 L38 33', 'hi', 1),
  C(12, 22, 1.6, 'ik'), C(12, 27, 1.6, 'ik'),
]);
def('trident', () => [
  S('M30 20 L30 54', 'ik', 3.4),
  P('M16 6 L22 24 L18 24 Z', 'bs'), P('M44 6 L38 24 L42 24 Z', 'bs'), P('M28 2 L32 2 L31 24 L29 24 Z', 'bs'),
  S('M18 20 L42 20', 'hi', 1.6),
]);
def('boat', () => [
  P('M8 38 Q8 48 20 48 L40 48 Q52 48 52 38 L46 30 L14 30 Z', 'lo'),
  S('M16 30 L16 38', 'hi', 1), S('M24 30 L24 38', 'hi', 1), S('M32 30 L32 38', 'hi', 1), S('M40 30 L40 38', 'hi', 1),
  S('M8 38 L52 38', 'gh', 1),
]);
def('brahma', () => [
  P('M26 4 L34 4 L34 14 L26 14 Z', 'bs'),
  P('M40 16 L50 20 L46 28 L38 24 Z', 'bs'),
  P('M20 16 L10 20 L14 28 L22 24 Z', 'bs'),
  P('M25 26 L35 26 L35 36 L25 36 Z', 'bs'),
  C(30, 20, 3, 'hi'),
  P('M16 46 Q30 40 44 46 Q44 54 30 56 Q16 54 16 46 Z', 'lo'),
]);
def('vishnu', () => [
  wave('lo', 44, 5, 22),
  S('M14 40 Q22 34 14 30 Q6 26 14 22 Q22 18 16 14', 'bs', 3),
  S('M42 18 Q50 18 50 26 Q50 32 44 30 Q40 28 42 24 Q44 20 42 18', 'hi', 2.6),
]);
def('shiva', () => [
  S('M30 22 L30 52', 'ik', 3),
  P('M20 10 L24 24 L20 20 Z', 'bs'), P('M40 10 L36 24 L40 20 Z', 'bs'), P('M28 6 L32 6 L31 24 L29 24 Z', 'bs'),
  P('M14 12 A6 6 0 1 0 14 24 A5 5 0 1 1 14 12 Z', 'gh'),
  S('M42 16 Q48 20 44 26 Q40 30 46 32', 'lo', 2.2),
]);
def('saraswati', () => [
  S('M14 34 L46 34', 'ik', 2.6),
  E(16, 34, 5, 7, 'bs'),
  S('M22 31 L22 37', 'hi', 0.9), S('M28 31 L28 37', 'hi', 0.9), S('M34 31 L34 37', 'hi', 0.9), S('M40 31 L40 37', 'hi', 0.9),
  P('M22 48 Q30 43 38 48 Q38 53 30 54 Q22 53 22 48 Z', 'lo'),
]);
def('lakshmi', () => [
  leaf('bs', 30, 30, .9, 0), leaf('hi', 30, 30, .9, 60), leaf('bs', 30, 30, .9, 120),
  leaf('hi', 30, 30, .9, 180), leaf('bs', 30, 30, .9, 240), leaf('hi', 30, 30, .9, 300),
  C(30, 30, 3, 'lo'),
  C(18, 50, 2, 'hi'), C(30, 54, 2, 'hi'), C(42, 50, 2, 'hi'),
]);
def('parvati', () => [
  P('M10 46 L26 14 L42 46 Z', 'lo'),
  P('M20 46 L26 14 L32 46 Z', 'hi'),
  P('M30 40 Q42 36 50 42 Q50 48 42 50 Q34 50 30 44 Z', 'bs'),
  S('M36 44 L40 44', 'ik', 1.2), S('M40 46 L44 46', 'ik', 1.2),
]);
def('durga', () => [
  C(30, 30, 7, 'lo'),
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return S(`M${n(30 + 8 * Math.cos(a))} ${n(30 + 8 * Math.sin(a))} L${n(30 + 20 * Math.cos(a))} ${n(30 + 20 * Math.sin(a))}`, i % 2 ? 'bs' : 'hi', 2.2);
  }),
  S('M23 50 Q19 44 23 40', 'gh', 2.4), S('M37 50 Q41 44 37 40', 'gh', 2.4),
]);
def('kali', () => [
  C(14, 22, 3, 'ik'), C(22, 15, 3, 'ik'), C(30, 12, 3, 'ik'), C(38, 15, 3, 'ik'), C(46, 22, 3, 'ik'),
  P('M30 26 L34 42 L30 56 L26 42 Z', 'bs'),
]);
def('ganesha', () => [
  C(30, 26, 13, 'bs'),
  E(15, 22, 6, 8, 'lo'), E(45, 22, 6, 8, 'lo'),
  S('M26 34 Q22 44 28 50 Q30 52 32 50', 'ik', 3),
  P('M36 32 L40 40 L37 41 Z', 'hi'),
  S('M23 33 L21 37', 'gh', 2),
  C(30, 56, 2.6, 'lo'),
]);
def('hanuman', () => [
  P('M18 12 L30 2 L42 12 L38 20 L22 20 Z', 'bs'),
  C(30, 34, 8, 'lo'),
  C(23, 27, 2.4, 'hi'), C(37, 27, 2.4, 'hi'),
  S('M30 42 L30 54', 'ik', 3),
  S('M30 24 L20 16', 'ik', 2.4), S('M30 24 L40 16', 'ik', 2.4),
]);
def('indra', () => [
  S('M22 26 L38 26', 'ik', 4),
  C(17, 26, 5, 'bs'), C(43, 26, 5, 'bs'),
  E(30, 46, 13, 7, 'lo'),
  P('M17 46 L9 50 L17 52 Z', 'hi'),
  C(24, 43, 1.6, 'gh'),
]);
def('agni', () => [
  flame('bs', 1, -6),
  flame('hi', .6, 10),
  S('M40 14 L36 22 L42 22 L38 30', 'ik', 1.6),
]);
def('surya', () => [
  C(30, 30, 10, 'bs'),
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return S(`M${n(30 + 10 * Math.cos(a))} ${n(30 + 10 * Math.sin(a))} L${n(30 + 18 * Math.cos(a))} ${n(30 + 18 * Math.sin(a))}`, 'hi', 2);
  }),
  ring('ik', 30, 30, 18, 1.6),
]);
def('vayu', () => [
  S('M6 20 Q20 14 34 20 Q48 26 56 20', 'lo', 2.2),
  S('M6 32 Q20 26 34 32 Q48 38 56 32', 'bs', 2.2),
  S('M6 44 Q20 38 34 44 Q48 50 56 44', 'hi', 2.2),
  leaf('gh', 44, 16, .5, 40),
]);
def('ra', () => [
  P('M10 44 Q10 52 30 52 Q50 52 50 44 L46 38 L14 38 Z', 'bs'),
  C(30, 22, 10, 'hi'),
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return S(`M${n(30 + 10 * Math.cos(a))} ${n(22 + 10 * Math.sin(a))} L${n(30 + 15 * Math.cos(a))} ${n(22 + 15 * Math.sin(a))}`, 'lo', 1.6);
  }),
  S('M30 32 L30 38', 'ik', 2),
]);
def('osiris', () => [
  S('M20 46 L20 14 Q20 6 28 10 Q32 12 26 16', 'bs', 3),
  S('M40 46 L40 10', 'lo', 3),
  S('M40 12 L48 9', 'hi', 1.6), S('M40 18 L48 15', 'hi', 1.6), S('M40 24 L48 21', 'hi', 1.6),
]);
def('isis', () => [
  ring('bs', 30, 18, 8, 3),
  S('M30 26 L30 44', 'ik', 3.4),
  S('M20 34 Q30 30 20 26', 'hi', 2.6), S('M40 34 Q30 30 40 26', 'hi', 2.6),
]);
def('horus', () => [
  P('M10 30 Q30 16 50 30 Q30 40 10 30 Z', 'bs'),
  C(30, 30, 5, 'ik'),
  S('M30 40 Q26 48 20 50', 'lo', 2.6),
  S('M50 30 Q56 26 54 20', 'hi', 2.2),
]);
def('set', () => [
  P('M20 20 L40 20 L40 34 Q40 42 30 42 Q20 42 20 34 Z', 'bs'),
  P('M40 26 L54 24 L52 32 L40 32 Z', 'lo'),
  P('M20 8 L24 20 L16 20 Z', 'hi'), P('M40 8 L44 20 L36 20 Z', 'hi'),
]);


/* imaging & appliance devices ─────────────────────────────────────────── */
def('magnetron', () => [P('M20 16 L40 16 L40 46 L20 46 Z', 'lo'),
                        ...[20, 26, 32, 38, 44].map(y => S(`M16 ${y} L44 ${y}`, 'bs', 2)),
                        S('M30 16 L30 8', 'ik', 2.2), S('M24 6 Q30 2 36 6', 'hi', 1.6)]);
def('microwave_oven', () => [P('M8 14 L52 14 L52 46 L8 46 Z', 'lo'),
                             P('M12 18 L38 18 L38 42 L12 42 Z', 'gh'),
                             ...[24, 30, 36].map(y => S(`M15 ${y} Q25 ${y - 4} 35 ${y}`, 'bs', 1.6)),
                             C(45, 22, 2, 'hi'), C(45, 28, 2, 'hi')]);
def('scanner', () => [P('M8 30 L52 30 L52 44 L8 44 Z', 'lo'),
                      P('M8 24 L52 24 L52 30 L8 30 Z', 'gh'),
                      S('M12 27 L48 27', 'bs', 3)]);
def('barcode_scanner', () => [P('M12 20 L34 20 L34 28 L22 28 L20 40 L14 40 L16 28 L12 28 Z', 'lo'),
                              S('M34 24 L52 24', 'bs', 1.6),
                              ...[40, 44, 48, 52].map((x, i) => S(`M${x} 16 L${x} 30`, i % 2 ? 'hi' : 'ik', i % 2 ? 1.4 : 2.2))]);
def('fingerprint_scanner', () => [P('M10 14 L50 14 L50 46 L10 46 Z', 'gh'),
                                  ...[8, 12, 16, 20].map(rad => S(`M${30 - rad} 40 Q30 ${40 - rad * 1.6} ${30 + rad} 40`, 'bs', 1.8))]);
def('wii_remote', () => [P('M24 8 L36 8 L36 52 L24 52 Z', 'lo'),
                         C(30, 16, 3, 'bs'), E(30, 8, 5, 2, 'hi'),
                         C(30, 34, 2, 'ik')]);

/* photography, film & broadcast ──────────────────────────────────────── */
def('digital_camera', () => [P('M10 20 L50 20 L50 44 L10 44 Z', 'lo'),
                             P('M20 14 L34 14 L34 20 L20 20 Z', 'hi'),
                             C(30, 32, 9, 'ik'), C(30, 32, 5, 'bs'),
                             C(44, 24, 1.8, 'hi')]);
def('magnetic_tape', () => [C(18, 30, 10, 'lo'), C(42, 30, 10, 'lo'),
                            C(18, 30, 3, 'ik'), C(42, 30, 3, 'ik'),
                            S('M18 30 Q30 44 42 30', 'bs', 2.2)]);
def('vhs', () => [P('M8 18 L52 18 L52 42 L8 42 Z', 'bs'),
                  P('M8 18 L52 18 L52 24 L8 24 Z', 'hi'),
                  C(20, 33, 6, 'lo'), C(40, 33, 6, 'lo'),
                  C(20, 33, 2, 'ik'), C(40, 33, 2, 'ik')]);
def('film_reel', () => [ring('lo', 30, 30, 18, 3),
                        ...[0, 60, 120, 180, 240, 300].map(a => ['g', a, 30, 30, [C(30, 14, 2.4, 'bs')]]),
                        C(30, 30, 5, 'ik')]);
def('movie_camera', () => [P('M10 26 L38 26 L38 44 L10 44 Z', 'lo'),
                           C(38, 20, 9, 'bs'), C(38, 20, 3, 'ik'),
                           P('M38 32 L52 26 L52 38 Z', 'hi'),
                           S('M14 26 L14 14', 'ik', 2.4), C(14, 12, 2.4, 'hi')]);
def('film_projector', () => [P('M8 32 L40 32 L40 46 L8 46 Z', 'lo'),
                             C(40, 39, 6, 'bs'),
                             P('M46 35 L58 26 L58 52 L46 43 Z', 'gh'),
                             C(18, 22, 7, 'hi'), C(30, 22, 7, 'hi')]);
def('cinematography', () => [P('M10 24 L50 24 L50 48 L10 48 Z', 'lo'),
                             P('M10 14 L50 20 L50 26 L10 24 Z', 'bs'),
                             ...[16, 24, 32, 40].map((x, i) => P(`M${x} 14 L${x + 5} 14 L${x + 2} 24 L${x - 3} 24 Z`, i % 2 ? 'hi' : 'ik'))]);
def('television', () => [P('M12 16 L48 16 L48 42 L12 42 Z', 'lo'),
                         P('M18 20 L42 20 L42 38 L18 38 Z', 'ik'),
                         S('M24 16 L16 6', 'bs', 1.8), S('M36 16 L44 6', 'bs', 1.8),
                         S('M20 42 L16 50', 'hi', 2), S('M40 42 L44 50', 'hi', 2)]);

/* medicine, imaging & big physics ─────────────────────────────────────── */
def('superconducting_magnet', () => [ring('lo', 30, 32, 18, 5),
                                     ...[0, 45, 90, 135, 180, 225, 270, 315].map(a => ['g', a, 30, 32, [S('M30 14 L30 22', 'bs', 2)]])]);
def('mri_scan', () => [P('M8 10 L52 10 L52 46 L8 46 Z', 'lo'),
                       C(30, 28, 13, 'ik'),
                       P('M14 40 L46 40 L46 46 L14 46 Z', 'bs'),
                       S('M20 50 L34 50', 'hi', 3)]);
def('pet_scan', () => [...[0, 45, 90, 135, 180, 225, 270, 315].map(a => ['g', a, 30, 32, [P('M27 12 L33 12 L33 18 L27 18 Z', 'lo')]]),
                       S('M12 32 L48 32', 'ik', 1.4), C(30, 32, 2.6, 'bs'),
                       C(12, 32, 2, 'hi'), C(48, 32, 2, 'hi')]);
def('transducer', () => [P('M22 8 L38 8 L36 30 L24 30 Z', 'lo'),
                         P('M24 30 L36 30 L34 40 L26 40 Z', 'bs'),
                         ...[6, 11, 16].map(r => S(`M${30 - r} 46 A${r} ${r * 0.6} 0 0 1 ${30 + r} 46`, 'hi', 1.4))]);
def('ultrasound_scan', () => [P('M30 10 L14 46 A22 22 0 0 0 46 46 Z', 'gh'),
                              ...granules('lo', 10, 77, [18, 22, 42, 42]),
                              P('M24 4 L36 4 L34 12 L26 12 Z', 'bs')]);
def('icsi_needle', () => [C(28, 34, 14, 'gh'), C(28, 34, 5, 'lo'),
                          S('M52 12 L30 32', 'ik', 2), C(52, 12, 1.6, 'hi')]);
def('bionic_arm', () => [P('M22 8 L34 8 L36 34 L20 34 Z', 'lo'),
                         P('M18 34 L38 34 L40 44 L16 44 Z', 'bs'),
                         ...[[20, 48], [26, 50], [32, 50], [38, 48]].map(([x, y]) => S(`M${x} 44 L${x} ${y}`, 'ik', 2))]);
def('robotic_surgery', () => [S('M12 12 L28 20', 'lo', 3.4), C(28, 20, 2.4, 'ik'),
                              S('M28 20 L24 36', 'lo', 3.4), C(24, 36, 2.4, 'ik'),
                              S('M24 36 L34 48', 'bs', 3), C(34, 48, 1.8, 'hi')]);
def('hydraulic_pump', () => [P('M10 20 L24 20 L24 44 L10 44 Z', 'lo'),
                             P('M36 20 L50 20 L50 44 L36 44 Z', 'lo'),
                             S('M24 32 L36 32', 'bs', 5),
                             S('M14 24 L20 24', 'ik', 2), S('M40 40 L46 40', 'ik', 2)]);
def('artificial_heart', () => [P('M30 46 Q10 30 10 18 A10 10 0 0 1 30 14 A10 10 0 0 1 50 18 Q50 30 30 46 Z', 'bs'),
                               S('M30 46 Q10 30 10 18 A10 10 0 0 1 30 14 A10 10 0 0 1 50 18 Q50 30 30 46 Z', 'ik', 1.6),
                               S('M30 20 L30 40', 'lo', 2), C(30, 20, 2, 'hi')]);
def('laser', () => [P('M10 26 L44 26 L44 38 L10 38 Z', 'lo'),
                    S('M44 32 L54 32', 'bs', 2.4),
                    ...[0, 45, 90, 135].map(a => ['g', a, 54, 32, [S('M54 32 L58 32', 'hi', 1.6)]])]);
def('holographic_plate', () => [P('M10 12 L50 12 L50 48 L10 48 Z', 'gh'),
                                ...[16, 22, 28, 34, 40, 46].map((y, i) => S(`M10 ${y} Q30 ${y - (i % 2 ? 3 : -3)} 50 ${y}`, i % 2 ? 'bs' : 'hi', 1.4))]);
def('hologram', () => [S('M30 10 L44 20 L44 36 L30 46 L16 36 L16 20 Z', 'ik', 1.6),
                       S('M30 10 L30 46', 'gh', 1), S('M16 20 L44 36', 'gh', 1), S('M44 20 L16 36', 'gh', 1),
                       E(30, 50, 14, 3, 'bs'), S('M22 50 L16 20', 'hi', 1), S('M38 50 L44 20', 'hi', 1)]);
def('stm_tip', () => [P('M26 8 L34 8 L30 30 Z', 'ik'),
                      S('M30 30 L30 36', 'gh', 1),
                      ...[18, 30, 42].map(x => C(x, 44, 4, 'lo'))]);
def('scanning_tunneling_microscope', () => [P('M10 10 L50 10 L50 16 L10 16 Z', 'lo'),
                                            S('M30 16 L30 30', 'ik', 2.2),
                                            ...[[14, 44], [22, 46], [30, 44], [38, 46], [46, 44]].map(([x, y]) => C(x, y, 3, 'bs')),
                                            S('M12 38 L48 38', 'hi', 1)]);
def('hadron_collider', () => [ring('lo', 30, 32, 20, 4),
                              ...[0, 60, 120, 180, 240, 300].map(a => ['g', a, 30, 32, [P('M27 10 L33 10 L33 16 L27 16 Z', 'bs')]]),
                              S('M14 32 L28 32', 'ik', 1.8), S('M46 32 L32 32', 'ik', 1.8),
                              C(30, 32, 3, 'hi')]);

/* textile technology ───────────────────────────────────────────────────── */
def('wool_card', () => [P('M14 14 L46 14 L46 38 L14 38 Z', 'lo'),
                        S('M30 38 L30 50', 'ik', 3),
                        ...[20, 26, 32].flatMap(y => [19, 25, 31, 37, 43].map(x => C(x, y, 1, 'bs')))]);
def('spindle', () => [S('M30 6 L30 54', 'ik', 2.4),
                      E(30, 38, 8, 3, 'bs'),
                      ...[16, 20, 24].map(y => S(`M24 ${y} Q30 ${y - 2} 36 ${y}`, 'hi', 1.4))]);
def('spinning_wheel', () => [ring('lo', 22, 32, 16, 2.2),
                             ...[0, 60, 120, 180, 240, 300].map(a => ['g', a, 22, 32, [S('M22 16 L22 32', 'ik', 1.2)]]),
                             S('M38 32 Q48 26 54 30', 'bs', 2),
                             E(54, 30, 4, 2, 'hi')]);
def('loom', () => [P('M8 10 L52 10 L52 14 L8 14 Z', 'lo'), P('M8 46 L52 46 L52 50 L8 50 Z', 'lo'),
                   ...[14, 22, 30, 38, 46].map(x => S(`M${x} 14 L${x} 46`, 'gh', 1.2)),
                   P('M20 26 L40 30 L20 34 Z', 'bs')]);
def('flying_shuttle', () => [P('M12 30 L48 30 L40 36 L20 36 Z', 'bs'),
                             C(20, 38, 2, 'ik'), C(40, 38, 2, 'ik'),
                             S('M48 30 L56 24', 'hi', 1.4)]);
def('knitting_needles', () => [S('M12 46 L44 10', 'lo', 2.4), S('M18 10 L50 46', 'lo', 2.4),
                               ...[20, 28, 36].map(x => S(`M${x} 30 Q${x + 4} 26 ${x + 8} 30`, 'bs', 1.6))]);
def('knitted_fabric', () => [...[18, 26, 34, 42].flatMap((y, i) => [14, 22, 30, 38, 46].map(x => S(`M${x - 3} ${y} Q${x} ${y - 5} ${x + 3} ${y}`, i % 2 ? 'hi' : 'bs', 1.6)))]);
def('dyed_cloth', () => [P('M10 14 Q30 8 50 14 L50 46 Q30 52 10 46 Z', 'gh'),
                         C(20, 24, 7, 'bs'), C(38, 20, 5, 'lo'),
                         C(26, 38, 6, 'lo'), C(42, 40, 5, 'bs')]);

/* timekeeping, orbit & the network ─────────────────────────────────────── */
def('atomic_clock', () => [ring('lo', 30, 30, 18, 2.4),
                           ...[0, 90, 180, 270].map(a => ['g', a, 30, 30, [S('M30 14 L30 17', 'ik', 1.6)]]),
                           E(30, 30, 10, 4, 'bs'), C(30, 30, 2, 'hi')]);
def('communications_satellite', () => [P('M24 22 L36 22 L36 38 L24 38 Z', 'lo'),
                                       P('M6 24 L22 24 L22 36 L6 36 Z', 'bs'), P('M38 24 L54 24 L54 36 L38 36 Z', 'bs'),
                                       P('M36 26 Q46 24 46 34 Q40 34 36 30 Z', 'hi')]);
def('gps_satellite', () => [P('M26 20 L34 20 L34 40 L26 40 Z', 'lo'),
                            P('M8 26 L24 26 L24 34 L8 34 Z', 'bs'), P('M36 26 L52 26 L52 34 L36 34 Z', 'bs'),
                            ...[6, 11, 16].map(r => S(`M${30 - r} 48 A${r} ${r * 0.5} 0 0 1 ${30 + r} 48`, 'hi', 1.4))]);
def('gps', () => [P('M30 8 A16 16 0 0 1 46 24 Q46 38 30 54 Q14 38 14 24 A16 16 0 0 1 30 8 Z', 'bs'),
                  C(30, 24, 6, 'ik'), ring('hi', 30, 24, 10, 1.4)]);
def('cellular_telephone', () => [P('M20 10 L40 10 L40 50 L20 50 Z', 'lo'),
                                 S('M34 10 L36 4', 'ik', 2),
                                 ...[[25, 20], [31, 20], [25, 26], [31, 26], [25, 32], [31, 32]].map(([x, y]) => C(x, y, 1.6, 'bs'))]);
def('smartphone', () => [P('M20 8 L40 8 L40 52 L20 52 Z', 'ik'),
                         P('M22 12 L38 12 L38 46 L22 46 Z', 'bs'),
                         C(30, 10, 1, 'hi')]);
def('computer', () => [P('M12 10 L48 10 L48 36 L12 36 Z', 'lo'),
                       P('M26 36 L34 36 L34 42 L26 42 Z', 'ik'),
                       P('M10 46 L50 46 L50 54 L10 54 Z', 'bs'),
                       ...[16, 22, 28, 34, 40, 44].map(x => C(x, 50, 1, 'hi'))]);
def('router', () => [P('M10 32 L50 32 L50 44 L10 44 Z', 'lo'),
                     S('M20 32 L14 14', 'ik', 2), S('M40 32 L46 14', 'ik', 2),
                     ...[18, 26, 34, 42].map(x => C(x, 38, 1.4, 'bs'))]);
def('internet', () => [C(30, 30, 20, 'bs'),
                       S('M10 30 A20 8 0 1 1 50 30 A20 8 0 1 1 10 30', 'ik', 1.4),
                       S('M30 10 A8 20 0 1 1 30 50 A8 20 0 1 1 30 10', 'ik', 1.4),
                       S('M10 30 L50 30', 'hi', 1.2)]);

/* airframe structure ───────────────────────────────────────────────────── */
def('wing_spar', () => [P('M8 32 Q20 22 40 26 Q52 28 52 32 Q40 38 20 36 Q8 34 8 32 Z', 'gh'),
                        S('M14 30 L48 31', 'bs', 4)]);
def('wing', () => [P('M8 40 L20 18 L52 22 L44 40 Z', 'bs'),
                   S('M20 24 L20 40', 'lo', 1.4), S('M32 21 L32 40', 'lo', 1.4)]);
def('fuselage', () => [P('M6 30 Q6 20 18 20 L42 20 Q54 20 54 30 Q54 40 42 40 L18 40 Q6 40 6 30 Z', 'lo'),
                       ...[16, 24, 32, 40].map(x => C(x, 30, 1.6, 'hi')),
                       S('M14 20 L14 40', 'ik', 1)]);
def('tail_stabilizer', () => [S('M30 10 L30 44', 'gh', 3),
                              P('M10 30 L50 30 L46 38 L14 38 Z', 'bs')]);
def('aileron', () => [P('M10 26 L40 20 L40 30 L10 32 Z', 'gh'),
                      P('M40 20 L54 14 L54 24 L40 30 Z', 'bs'),
                      C(40, 25, 1.6, 'ik'), S('M44 12 Q48 10 50 6', 'hi', 1.4)]);
def('rudder', () => [P('M22 10 L38 10 L38 46 L22 46 Z', 'gh'),
                     P('M38 14 L52 6 L52 20 L38 26 Z', 'bs'),
                     C(38, 18, 1.6, 'ik'), S('M46 4 Q52 2 54 8', 'hi', 1.4)]);
def('tail_elevator', () => [P('M8 30 L52 30 L52 36 L8 36 Z', 'gh'),
                            P('M8 36 L30 36 L30 44 L8 42 Z', 'bs'),
                            S('M40 30 Q40 24 44 22', 'hi', 1.4), S('M40 36 Q40 42 44 44', 'hi', 1.4)]);
def('landing_gear', () => [C(30, 48, 9, 'lo'), C(30, 48, 3, 'ik'),
                           S('M30 39 L30 14', 'bs', 3.4),
                           ...[18, 24, 30].map(y => S(`M26 ${y} L34 ${y}`, 'hi', 1.6))]);
def('propeller', () => [C(30, 30, 4, 'ik'),
                        P('M30 30 Q22 14 30 4 Q38 14 30 30 Z', 'bs'),
                        P('M30 30 Q46 22 56 30 Q46 38 30 30 Z', 'lo'),
                        P('M30 30 Q38 46 30 56 Q22 46 30 30 Z', 'hi')]);

/* jet engine, stage by stage ────────────────────────────────────────────── */
def('compressor', () => [P('M8 14 L52 22 L52 38 L8 46 Z', 'lo'),
                         S('M18 18 L18 42', 'ik', 1.8), S('M28 20 L28 40', 'ik', 1.8),
                         S('M38 21 L38 39', 'ik', 1.8), S('M48 22 L48 38', 'ik', 1.8)]);
def('combustor', () => [P('M14 16 L46 16 L46 44 L14 44 Z', 'lo'),
                        flame('bs', .55, 2)]);
def('turbine', () => [C(30, 30, 5, 'ik'),
                      ...[0, 45, 90, 135, 180, 225, 270, 315].map(a => ['g', a, 30, 30, [P('M28 8 L32 8 L33 22 L27 22 Z', 'bs')]]),
                      ring('hi', 30, 30, 22, 1.6)]);
def('jet_engine', () => [P('M6 22 L46 16 L54 24 L54 36 L46 44 L6 38 Z', 'lo'),
                         C(14, 30, 9, 'ik'),
                         ...[0, 45, 90, 135, 180, 225, 270, 315].map(a => ['g', a, 14, 30, [S('M14 22 L14 26', 'bs', 1.4)]]),
                         P('M50 26 L58 30 L50 34 Z', 'hi')]);

def('typewriter', () => [P('M12 34 L48 34 L48 46 L12 46 Z', 'lo'), ...[18, 26, 34, 42].map(x => C(x, 30, 3, 'bs')),
                         S('M30 30 L30 14', 'ik', 2.2), C(30, 12, 3, 'hi')]);

/* craft — mining, railways & consumer electronics additions ─────────────
   Mining methods drawn as cross-sections of their actual working principle
   (open-pit's terraced rings, room-and-pillar's grid, block caving's funnel)
   rather than a generic hole. Plant drawn as the one part that does the job
   (the crusher's V, the ball mill's tumbling drum, flotation's rising froth).
   Rolling stock differentiated by what is actually different about each car
   — hopper's sloped floor and gates, tank's cylinder, caboose's cupola —
   the four locomotive types by nose shape, stack, hood or pantograph rather
   than a shared box. The iPod-era electronics tier by the part that makes
   each one unique: the click wheel's electrode ring, the LCD's crossed-
   polarizer pixel grid, the CCD's bucket-brigade row of wells. */

/* how ore comes out of the ground */
def('open_pit_mining', () => [
  ring('lo', 30, 32, 20, 4), ring('bs', 30, 32, 13, 4), ring('hi', 30, 32, 7, 4),
  S('M30 12 A18 18 0 0 1 47 24', 'ik', 2),
]);
def('strip_mining', () => [
  P('M6 14 L26 14 L26 24 L6 24 Z', 'gh'),
  P('M18 26 L38 26 L38 36 L18 36 Z', 'lo'),
  P('M30 38 L50 38 L50 48 L30 48 Z', 'bs'),
]);
def('mountaintop_removal', () => [
  P('M8 48 L18 24 L27 16 L33 16 L42 24 L52 48 Z', 'lo'),
  S('M27 16 L33 16', 'ik', 3),
  P('M40 40 L54 40 L54 48 L40 48 Z', 'bs'),
]);
def('placer_mining', () => [
  P('M10 38 L50 38 L44 50 L16 50 Z', 'lo'),
  wave('bs', 36, 4, 18),
  ...granules('hi', 5, 301, [20, 42, 40, 48]),
]);
def('room_and_pillar_mining', () => [
  S('M8 16 L52 16', 'ik', 3),
  ...[16, 30, 44].map(x => P(`M${x - 4} 16 L${x + 4} 16 L${x + 4} 46 L${x - 4} 46 Z`, 'bs')),
  S('M8 46 L52 46', 'lo', 2),
]);
def('longwall_mining', () => [
  C(14, 30, 6, 'bs'),
  ...[0, 90, 180, 270].map(a => ['g', a, 14, 30, [S('M14 24 L14 20', 'ik', 1.6)]]),
  ...[26, 34, 42].map(x => P(`M${x - 3} 18 L${x + 3} 18 L${x + 3} 42 L${x - 3} 42 Z`, 'lo')),
  S('M48 16 L52 24 L46 32 L52 40 L48 46', 'gh', 2),
]);
def('block_caving', () => [
  P('M14 14 L46 14 L34 40 L26 40 Z', 'lo'),
  ...granules('bs', 6, 401, [22, 36, 38, 44]),
  P('M20 46 L28 46 L26 54 L22 54 Z', 'ik'),
  P('M32 46 L40 46 L38 54 L34 54 Z', 'ik'),
]);

/* the plant that processes it */
def('drilling_rig', () => [
  P('M27 8 L33 8 L33 48 L27 48 Z', 'bs'),
  S('M18 16 L42 16', 'ik', 2.2),
  P('M16 48 L44 48 L44 54 L16 54 Z', 'lo'),
  P('M27 48 L33 48 L30 54 Z', 'ik'),
]);
def('dragline_excavator', () => [
  S('M14 46 L44 12', 'ik', 3.4),
  S('M44 12 L40 34', 'hi', 1.6), S('M44 12 L28 40', 'hi', 1.6),
  P('M24 38 L38 38 L34 48 L20 48 Z', 'bs'),
]);
def('diesel_electric_drive', () => [
  P('M6 18 L22 18 L22 42 L6 42 Z', 'lo'),
  S('M24 30 L28 25 L32 35 L36 25 L40 35 L44 30', 'bs', 2.4),
  ring('ik', 48, 30, 9, 2.6), C(48, 30, 3, 'hi'),
]);
def('haul_truck', () => [
  P('M8 34 L44 34 L48 24 L20 24 L14 34 Z', 'lo'),
  P('M8 26 L14 26 L14 34 L8 34 Z', 'bs'),
  C(16, 44, 9, 'ik'), C(40, 44, 9, 'ik'),
  C(16, 44, 3, 'hi'), C(40, 44, 3, 'hi'),
]);
def('continuous_miner', () => [
  P('M12 22 L38 22 L38 42 L12 42 Z', 'lo'),
  C(46, 32, 10, 'bs'),
  ...[0, 60, 120, 180, 240, 300].map(a => ['g', a, 46, 32, [S('M46 24 L46 20', 'ik', 1.4)]]),
]);
def('longwall_shearer', () => [
  S('M8 42 L52 42', 'ik', 2.6),
  P('M18 26 L42 26 L42 38 L18 38 Z', 'lo'),
  C(13, 32, 6.4, 'bs'), C(47, 32, 6.4, 'bs'),
]);
def('locomotive', () => [
  P('M6 26 Q6 20 14 20 L44 20 L50 26 L50 40 L6 40 Z', 'lo'),
  C(14, 44, 6, 'ik'), C(38, 44, 6, 'ik'),
  C(10, 26, 2.2, 'hi'),
]);
def('crusher', () => [
  P('M14 14 L26 14 L20 46 L10 46 Z', 'lo'),
  P('M46 14 L34 14 L40 46 L50 46 Z', 'lo'),
  ...granules('bs', 5, 551, [24, 26, 36, 42]),
]);
def('ball_mill', () => [
  C(30, 28, 18, 'lo'),
  ...[[22, 24], [34, 20], [26, 34], [37, 32], [30, 26]].map(([x, y]) => C(x, y, 3, 'bs')),
  C(14, 48, 3, 'ik'), C(46, 48, 3, 'ik'),
]);
def('flotation_cell', () => [
  P('M10 14 L50 14 L50 46 L10 46 Z', 'gh'),
  P('M10 14 L50 14 L50 22 L10 22 Z', 'bs'),
  ...[20, 32, 44].map((x, i) => C(x, 38 - i * 2, 2, 'hi')),
]);
def('conveyor_belt', () => [
  S('M10 34 L50 34', 'bs', 7),
  C(10, 34, 7, 'ik'), C(50, 34, 7, 'ik'),
  ...[20, 30, 40].map(x => C(x, 26, 3, 'hi')),
]);

/* getting it to market */
def('stockpile', () => [
  mound('lo', 48, 22, 20),
  mound('hi', 48, 15, 13),
  S('M8 48 L52 48', 'ik', 2),
]);
def('ore_railway', () => [
  S('M6 48 L54 48', 'ik', 2.4),
  ...[14, 30, 46].map(x => P(`M${x - 8} 34 L${x + 8} 34 L${x + 6} 44 L${x - 6} 44 Z`, 'bs')),
]);
def('port', () => [
  wave('lo', 48, 4, 26),
  P('M8 20 L8 44 L18 44 L18 20 Z', 'gh'),
  S('M18 24 L48 30', 'bs', 4), C(48, 30, 3, 'hi'),
]);
def('bulk_carrier', () => [
  wave('lo', 46, 4, 26),
  P('M10 30 L50 30 L46 42 L14 42 Z', 'bs'),
  ...[18, 26, 34, 42].map(x => P(`M${x - 3} 26 L${x + 3} 26 L${x + 3} 30 L${x - 3} 30 Z`, 'hi')),
]);

/* the rolling stock, part by part */
def('piston', () => [
  P('M16 10 L44 10 L44 34 L16 34 Z', 'gh'),
  P('M18 14 L42 14 L42 30 L18 30 Z', 'bs'),
  S('M18 20 L42 20 M18 25 L42 25', 'ik', 1.4),
  S('M30 34 L30 50', 'ik', 3),
]);
def('axle', () => [
  S('M14 30 L46 30', 'ik', 4),
  C(14, 30, 9, 'bs'), C(46, 30, 9, 'bs'),
  C(14, 30, 3, 'hi'), C(46, 30, 3, 'hi'),
]);
def('bogie', () => [
  P('M8 30 L52 30 L52 36 L8 36 Z', 'lo'),
  C(18, 44, 6, 'bs'), C(42, 44, 6, 'bs'),
  C(18, 44, 2, 'hi'), C(42, 44, 2, 'hi'),
  C(30, 24, 3, 'ik'),
]);
def('steam_locomotive', () => [
  P('M10 24 L44 24 L44 38 L10 38 Z', 'lo'),
  P('M8 16 L14 16 L14 24 L8 24 Z', 'bs'),
  C(34, 44, 8, 'ik'),
  S('M34 44 L46 38', 'hi', 2.2), C(46, 38, 2, 'hi'),
]);
def('diesel_electric_locomotive', () => [
  P('M6 22 L54 22 L54 40 L6 40 Z', 'lo'),
  P('M10 14 L26 14 L26 22 L10 22 Z', 'bs'),
  ...[16, 26, 36, 46].map(x => C(x, 31, 2, 'hi')),
]);
def('electric_locomotive', () => [
  P('M10 26 L50 26 L50 40 L10 40 Z', 'lo'),
  S('M22 26 L22 14 L28 10 L32 10 L38 14 L38 26', 'ik', 2),
  S('M6 10 L54 10', 'hi', 2),
]);
def('freight_wagon', () => [
  P('M10 22 L50 22 L50 34 L10 34 Z', 'lo'),
  S('M10 34 L50 34', 'ik', 2),
  C(17, 41, 4.4, 'bs'), C(43, 41, 4.4, 'bs'),
]);
def('hopper_car', () => [
  P('M10 20 L50 20 L42 40 L18 40 Z', 'bs'),
  S('M27 40 L27 46 M33 40 L33 46', 'ik', 2.4),
  C(20, 47, 3.6, 'lo'), C(40, 47, 3.6, 'lo'),
]);
def('tank_car', () => [
  E(30, 28, 22, 10, 'bs'),
  S('M8 28 L52 28', 'hi', 1.6),
  P('M12 38 L48 38 L48 42 L12 42 Z', 'lo'),
  C(18, 48, 4, 'ik'), C(42, 48, 4, 'ik'),
]);
def('flatcar', () => [
  P('M8 30 L52 30 L52 34 L8 34 Z', 'lo'),
  S('M14 30 L46 20', 'bs', 4),
  C(18, 42, 4, 'ik'), C(42, 42, 4, 'ik'),
]);
def('boxcar', () => [
  P('M8 18 L52 18 L52 38 L8 38 Z', 'lo'),
  P('M24 18 L36 18 L36 38 L24 38 Z', 'bs'),
  C(16, 46, 4, 'ik'), C(44, 46, 4, 'ik'),
]);
def('caboose', () => [
  P('M10 26 L50 26 L50 40 L10 40 Z', 'lo'),
  P('M22 14 L38 14 L38 26 L22 26 Z', 'bs'),
  S('M26 18 L26 22 M34 18 L34 22', 'hi', 1.6),
  C(18, 46, 4, 'ik'), C(42, 46, 4, 'ik'),
]);
def('coupler', () => [
  P('M10 26 Q10 20 18 20 L18 28 Q14 30 14 34 L10 34 Z', 'lo'),
  P('M50 26 Q50 20 42 20 L42 28 Q46 30 46 34 L50 34 Z', 'bs'),
  C(30, 30, 3, 'hi'),
]);
def('roller_bearing', () => [
  ring('lo', 30, 30, 18, 3), ring('lo', 30, 30, 10, 3),
  ...Array.from({ length: 8 }, (_, i) => ['g', i * 45, 30, 30, [E(30, 16, 2.6, 4, 'bs')]]),
]);
def('plain_bearing', () => [
  C(30, 30, 8, 'bs'),
  S('M13 30 A17 17 0 1 1 47 30', 'lo', 6),
  S('M18 46 L18 52 M42 46 L42 52', 'gh', 1.4),
]);
def('air_brake', () => [
  C(30, 32, 14, 'ik'),
  P('M30 46 L38 40 L38 48 L30 52 Z', 'bs'),
  S('M12 20 L20 26', 'hi', 2.4), C(12, 20, 2.4, 'hi'),
]);
def('block_signal', () => [
  S('M20 50 L20 12', 'ik', 3),
  C(20, 16, 3, 'bs'),
  P('M22 20 L36 16 L36 22 L22 26 Z', 'lo'),
]);
def('points_switch', () => [
  S('M10 46 L30 46 L50 20', 'ik', 3),
  S('M30 46 L50 46', 'bs', 3),
  S('M22 46 L26 40', 'hi', 1.6),
]);
def('rail_yard', () => [
  S('M6 30 L20 30', 'ik', 2.4),
  S('M20 30 L54 14', 'ik', 2), S('M20 30 L54 22', 'ik', 2),
  S('M20 30 L54 38', 'ik', 2), S('M20 30 L54 46', 'ik', 2),
]);

/* the iPod, part by part */
def('capacitor', () => [
  S('M20 10 L20 50', 'ik', 4), S('M40 10 L40 50', 'ik', 4),
  S('M6 30 L20 30', 'bs', 2.4), S('M40 30 L54 30', 'bs', 2.4),
]);
def('accelerometer', () => [
  P('M10 10 L50 10 L50 50 L10 50 Z', 'gh'),
  P('M24 24 L36 24 L36 36 L24 36 Z', 'bs'),
  S('M12 30 L16 27 L20 33 L24 30', 'ik', 1.6),
  S('M36 30 L40 27 L44 33 L48 30', 'ik', 1.6),
]);
def('photodiode', () => [
  P('M20 20 L40 20 L40 40 L20 40 Z', 'bs'),
  S('M30 40 L30 50', 'ik', 2.2),
  S('M12 10 L20 18 M20 10 L26 16', 'hi', 1.8),
]);
def('click_wheel', () => [
  ring('lo', 30, 30, 18, 4),
  C(30, 30, 8, 'bs'),
  ...Array.from({ length: 8 }, (_, i) => ['g', i * 45, 30, 30, [S('M30 12 L30 16', 'ik', 1.6)]]),
]);
def('flash_memory', () => [
  P('M14 16 L46 16 L46 44 L14 44 Z', 'ik'),
  P('M14 26 L46 26 L46 34 L14 34 Z', 'bs'),
  ...[22, 30, 38].map(x => C(x, 30, 1.8, 'hi')),
]);
def('ipod', () => [
  P('M18 6 L42 6 Q46 6 46 10 L46 50 Q46 54 42 54 L18 54 Q14 54 14 50 L14 10 Q14 6 18 6 Z', 'lo'),
  P('M20 12 L40 12 L40 30 L20 30 Z', 'bs'),
  ring('hi', 30, 42, 9, 2),
]);
def('nike_plus_sensor', () => [
  E(30, 38, 14, 8, 'bs'),
  S('M30 26 Q30 20 30 14', 'ik', 2),
  S('M22 20 Q22 10 14 6 M38 20 Q38 10 46 6', 'hi', 1.6),
]);
def('midsole_foam', () => [
  P('M8 44 Q8 30 24 28 Q40 26 52 40 L52 48 L8 48 Z', 'bs'),
  ...granules('hi', 10, 881, [14, 32, 46, 46]),
]);
def('athletic_shoe', () => [
  P('M10 34 L14 24 Q22 20 32 22 L48 30 Q54 32 54 38 L10 38 Z', 'lo'),
  P('M10 38 L54 38 L54 44 L10 44 Z', 'bs'),
  S('M14 44 L14 48 M22 44 L22 48 M30 44 L30 48 M38 44 L38 48', 'ik', 1.6),
]);

/* the LCD stack, layer by layer */
def('polarizer', () => [
  P('M14 10 L46 10 L46 50 L14 50 Z', 'gh'),
  ...[20, 26, 32, 38, 44].map(x => S(`M${x} 12 L${x} 48`, 'bs', 2)),
]);
def('liquid_crystal', () => [
  ...[[18, 20, -10], [30, 16, 5], [42, 22, -6], [16, 36, 8], [30, 40, -4], [44, 34, 10]]
    .map(([x, y, rot]) => ['g', rot, x, y, [P(`M${x - 6} ${y} L${x + 6} ${y} L${x + 6} ${y + 2.4} L${x - 6} ${y + 2.4} Z`, 'bs')]]),
]);
def('thin_film_transistor', () => [
  P('M8 42 L52 42 L52 46 L8 46 Z', 'gh'),
  P('M22 24 L38 24 L38 38 L22 38 Z', 'bs'),
  S('M22 42 L22 38 M38 42 L38 38', 'ik', 1.6),
  S('M14 30 L22 30', 'hi', 1.8),
]);
def('liquid_crystal_cell', () => [
  P('M14 14 L46 14 L46 46 L14 46 Z', 'gh'),
  P('M24 27 L36 27 L36 33 L24 33 Z', 'bs'),
  P('M14 38 L22 38 L22 46 L14 46 Z', 'lo'),
]);
def('lcd_screen', () => [
  P('M8 10 L52 10 L52 50 L8 50 Z', 'ik'),
  P('M12 14 L48 14 L48 46 L12 46 Z', 'gh'),
  ...[[18, 20, 'bs'], [30, 20, 'hi'], [42, 20, 'lo'], [18, 32, 'hi'], [30, 32, 'lo'], [42, 32, 'bs'], [18, 42, 'lo'], [30, 42, 'bs'], [42, 42, 'hi']]
    .map(([x, y, r]) => C(x, y, 2.2, r)),
]);
def('imax_3d_projection', () => [
  C(18, 30, 10, 'bs'), C(42, 30, 10, 'lo'),
  S('M10 22 L26 38', 'hi', 1.6), S('M34 38 L50 22', 'hi', 1.6),
]);
def('laser_diode', () => [
  P('M14 22 L14 42 L32 32 Z', 'bs'),
  S('M14 18 L14 46', 'ik', 2.6), S('M32 20 L32 44', 'hi', 2),
  S('M36 32 L54 32', 'bs', 3),
]);
def('dvd_player', () => [
  C(30, 30, 21, 'lo'), C(30, 30, 2, 'gh'),
  S('M30 12 Q42 14 46 24 Q50 34 42 42 Q34 50 22 46 Q12 42 12 30 Q12 20 20 14', 'hi', 1.4),
  P('M42 44 L50 44 L50 48 L42 48 Z', 'bs'),
]);
def('photosite', () => [
  P('M20 16 L40 16 L40 44 L20 44 Z', 'gh'),
  P('M20 32 L40 32 L40 44 L20 44 Z', 'bs'),
  ...[26, 34].map(x => C(x, 40, 1.8, 'hi')),
  S('M16 6 L24 14 M36 6 L44 14', 'ik', 1.6),
]);
def('ccd_sensor', () => [
  ...[13, 23, 33, 43].map((x, i) => P(`M${x - 4} 18 L${x + 4} 18 L${x + 4} 38 L${x - 4} 38 Z`, i % 2 ? 'hi' : 'bs')),
  S('M8 46 L52 46', 'ik', 2),
  S('M44 46 L50 46 L47 42 M44 46 L47 50', 'hi', 1.8),
]);

/* what the elements do inside a body ────────────────────────────────────
   The porphyrin family shares one square-planar ring with a metal at its
   centre, because that IS the fact: change the metal and you change what
   the ring does. Heme is iron, chlorophyll magnesium, cobalamin cobalt. */
const porph = (metal) => [
  ...[[30, 14], [46, 32], [30, 50], [14, 32]].map(([x, y]) => ring('ik', x, y, 7, 2)),
  ...[[30, 14], [46, 32], [30, 50], [14, 32]].map(([x, y]) => S(`M30 32 L${x} ${y}`, 'ik', 1.6)),
  C(30, 32, 6, metal),
];
// Four pyrrole rings joined by four bridges, and nothing in the middle yet.
def('porphyrin',   () => [
  ...[[30, 14], [46, 32], [30, 50], [14, 32]].map(([x, y]) => ring('ik', x, y, 7, 2)),
  ...[[30, 14, 46, 32], [46, 32, 30, 50], [30, 50, 14, 32], [14, 32, 30, 14]].map(([a, b, c2, d]) =>
    S(`M${a} ${b} L${c2} ${d}`, 'gh', 2.2)),
  ring('lo', 30, 32, 9, 1.2),
]);
// The same ring with iron in it, and the two propionate arms that hold it in.
def('heme',        () => [...porph('bs'),
  S('M22 46 L14 56', 'ik', 2), S('M38 46 L46 56', 'ik', 2),
  ...[[24, 10], [36, 10]].map(([x, y]) => S(`M${x} ${y} L${x < 30 ? x - 6 : x + 6} ${y - 6}`, 'ik', 1.8)),
]);
// Not a porphyrin at all: a corrin, one bridging carbon short, so two of the
// rings are bonded straight to each other. Cobalt, and the arm above and below.
def('cobalamin',   () => [
  ...[[30, 15], [46, 30], [36, 48], [16, 34]].map(([x, y]) => ring('ik', x, y, 6.5, 2)),
  ...[[30, 15, 46, 30], [46, 30, 36, 48], [36, 48, 16, 34]].map(([a, b, c2, d]) =>
    S(`M${a} ${b} L${c2} ${d}`, 'gh', 2.2)),
  S('M16 34 L30 15', 'lo', 3.4),
  C(31, 32, 5.4, 'lo'),
  S('M31 32 L31 56', 'ik', 2), S('M31 32 L48 18', 'ik', 1.6),
]);
// Magnesium, not iron — and the long phytol tail that anchors it in the
// membrane, which is the reason a leaf's green will not wash out in water.
def('chlorophyll', () => [...porph('hi'),
  P('M40 42 L50 40 L48 50 L38 48 Z', 'gh'),                       // the fifth ring
  S('M48 50 L54 58', 'ik', 2.2),
  S('M14 44 Q6 50 10 58', 'lo', 2.6),
]);
def('hemoglobin',  () => [...[[20, 22], [40, 22], [20, 42], [40, 42]].map(([x, y]) => E(x, y, 11, 9, 'lo')),
                          ...[[20, 22], [40, 42]].map(([x, y]) => C(x, y, 4, 'bs'))]);   // four subunits, four hemes
def('myoglobin',   () => [E(30, 32, 18, 14, 'lo'), C(30, 32, 5, 'bs'),
                          ...[0, 60, 120].map(a => ['g', a, 30, 32, [S('M18 32 L42 32', 'hi', 2)]])]);
def('photosystem_ii', () => [P('M12 20 L48 20 L48 44 L12 44 Z', 'lo'),
                             ...[[22, 28], [34, 26], [28, 38], [40, 36]].map(([x, y]) => C(x, y, 4, 'hi')),
                             ...[[16, 12], [26, 10]].map(([x, y]) => S(`M${x} ${y} L${x + 5} ${y + 7}`, 'bs', 2))]);
def('iron_sulfur_cluster', () => [...[[22, 26], [38, 26], [22, 40], [38, 40]].map(([x, y], i) => C(x, y, 6, i % 2 ? 'bs' : 'hi')),
                                  ...[[22, 26, 38, 40], [38, 26, 22, 40]].map(([a, b, c2, d]) => S(`M${a} ${b} L${c2} ${d}`, 'ik', 1.6))]);
def('cytochrome_c_oxidase', () => [E(30, 32, 19, 15, 'lo'), C(24, 28, 5, 'bs'), C(37, 36, 5, 'hi'),
                                   S('M24 28 L37 36', 'ik', 1.6)]);
def('ferritin',    () => [ring('lo', 30, 32, 19, 4), ...granules('bs', 9, 19, [20, 22, 40, 42])]);   // a cage full of iron
def('zinc_finger', () => [S('M18 48 Q18 20 30 14 Q42 20 42 48', 'lo', 3.4), C(30, 34, 6, 'hi'),
                          ...[[22, 30], [38, 30], [26, 42], [34, 42]].map(([x, y]) => S(`M${x} ${y} L30 34`, 'ik', 1.4))]);
def('carbonic_anhydrase', () => [E(30, 32, 18, 15, 'lo'), C(30, 30, 5, 'hi'),
                                 ...[[20, 24], [40, 24], [30, 44]].map(([x, y]) => S(`M${x} ${y} L30 30`, 'ik', 1.4))]);
def('superoxide_dismutase', () => [E(30, 32, 18, 15, 'lo'), C(24, 30, 5, 'bs'), C(37, 32, 5, 'hi'),
                                   ring('ik', 30, 31, 11, 1.2)]);
def('sulfite_oxidase', () => [E(30, 32, 18, 15, 'lo'), C(30, 32, 6, 'ik'), ring('hi', 30, 32, 10, 1.6)]);
def('glutathione_peroxidase', () => [E(30, 32, 18, 15, 'lo'), C(30, 32, 5.4, 'bs'),
                                     S('M30 32 L30 18', 'ik', 1.8), C(30, 16, 3, 'hi')]);
def('selenocysteine', () => [(() => backbone('ik', 2, 26, 34).shape)(),
                            C(14, 30, 4.4, 'hi'), C(42, 34, 5.4, 'bs')]);       // the 21st, and its selenium
def('thyroxine',   () => [hex('ik', 20, 36, 10, 2), hex('ik', 40, 26, 10, 2), S('M28 32 L32 30', 'ik', 2),
                          ...[[12, 26], [26, 44], [46, 16], [50, 34]].map(([x, y]) => C(x, y, 4, 'bs'))]);  // four iodines
def('ascorbate',   () => [P('M18 40 L24 22 L40 22 L46 40 L32 50 Z', 'hi'),
                          ...[[24, 22], [40, 22]].map(([x, y]) => C(x, y - 6, 3.4, 'bs')),
                          S('M46 40 L54 46', 'ik', 1.8)]);
def('hydroxyproline', () => [P('M20 44 L18 26 L34 18 L46 30 L38 46 Z', 'ik'),
                             C(46, 30, 4.4, 'bs'), C(20, 44, 4, 'hi')]);
def('triple_helix',() => [...[0, 1, 2].map(i =>
                            S(`M${14 + i * 6} 52 Q${34 + i * 4} 42 ${14 + i * 6} 32 Q${34 + i * 4} 22 ${14 + i * 6} 12`, i === 1 ? 'hi' : 'bs', 2.6))]);
def('hydroxyapatite', () => [...prisms('gh', 3), ...granules('hi', 5, 71, [18, 30, 42, 44])]);
def('fluorapatite',   () => [P('M22 48 L22 22 L30 12 L38 22 L38 48 Z', 'hi'), S('M22 22 L38 22', 'gh', 1.6),
                             ...[[14, 30], [46, 30], [30, 54]].map(([x, y]) => C(x, y, 3.4, 'bs'))]);  // one hexagonal prism, fluoride at its centre
def('sodium_potassium_pump', () => [P('M18 12 L26 12 L26 52 L18 52 Z', 'lo'), P('M34 12 L42 12 L42 52 L34 52 Z', 'lo'),
                                    ...[[30, 20], [30, 30]].map(([x, y]) => C(x, y, 4, 'bs')),
                                    ...[[30, 42], [30, 50]].map(([x, y]) => C(x, y, 4, 'hi'))]);
def('action_potential', () => [S('M8 46 L20 46 L26 12 L32 50 L38 42 L52 42', 'hi', 3),
                               ...[[20, 46], [52, 42]].map(([x, y]) => C(x, y, 2.4, 'ik'))]);
def('retinal',     () => [(() => backbone('ik', 5, 28, 30).shape)(),
                          ring('ik', 12, 34, 8, 2), C(48, 32, 4.4, 'bs')]);
def('rhodopsin',   () => [P('M14 12 L46 12 L46 52 L14 52 Z', 'lo'),
                          ...[0, 1, 2, 3].map(i => S(`M${20 + i * 6} 16 L${20 + i * 6} 48`, 'gh', 3)),
                          C(32, 32, 5, 'bs')]);

/* what two elements make when you put them together ─────────────────────
   The oxides, sulfides and halides. Drawn as the material you would hold,
   not as a formula — zinc oxide is the white powder, galena is the cubes,
   tarnish is the film on the spoon. */
def('magnesium_oxide', () => [P('M14 46 L46 46 L46 30 Q30 22 14 30 Z', 'gh'),      // a pressed brick of it
                              S('M14 30 Q30 22 46 30', 'hi', 2),
                              ...granules('hi', 5, 3, [18, 34, 42, 44])]);
def('zinc_oxide',   () => [P('M10 48 L26 20 L34 20 L50 48 Z', 'hi'),               // tipped from a scoop
                           ...granules('gh', 7, 91, [16, 34, 44, 46])]);
def('copper_oxide', () => [E(30, 40, 20, 11, 'ik'), E(30, 34, 14, 7, 'bs'),        // a shallow dish of it
                           ...granules('lo', 5, 17, [20, 32, 40, 42])]);
def('litharge',     () => [...flakes('hi', 4), ...granules('bs', 4, 45, [16, 20, 44, 44])]);
def('mercuric_oxide', () => [vessel('gh', 26, 48), P('M20 34 L40 34 L39 46 Q30 48 21 46 Z', 'bs'),
                             ...granules('lo', 4, 63, [23, 36, 37, 44])]);
def('alumina',      () => [P('M14 26 L46 26 L46 32 L14 32 Z', 'gh'),           // the 5 nm film on the metal
                           P('M12 32 L48 32 L48 48 L12 48 Z', 'hi'),
                           S('M14 26 L46 26', 'lo', 1.6)]);
def('rust',         () => [P('M12 30 Q12 18 30 18 Q48 18 48 30 Q48 46 30 46 Q12 46 12 30 Z', 'bs'),
                           ...granules('lo', 12, 29, [16, 22, 44, 42]),
                           ...[[20, 40], [40, 26]].map(([x, y]) => E(x, y, 7, 4, 'ground'))]);   // it flakes away
def('copper_sulfide', () => [facet('ik'), facet('bs', .5), ...granules('lo', 4, 81, [20, 26, 40, 38])]);
def('zinc_sulfide',   () => [facet('gh'), ...granules('hi', 8, 5, [18, 24, 42, 40])]);
def('lead_sulfide',   () => [P('M12 34 L26 26 L40 34 L26 42 Z', 'lo'), P('M12 34 L26 42 L26 54 L12 46 Z', 'ik'), P('M40 34 L26 42 L26 54 L40 46 Z', 'hi'),
                             P('M32 20 L42 14 L52 20 L42 26 Z', 'lo'), P('M32 20 L42 26 L42 38 L32 32 Z', 'ik')]);  // galena, stepped

/* four more sulfides, direct reactions every one */
def('aluminum_sulfide',  () => [                           // ignite the two together and the melt runs straight through steel
  P('M10 18 L50 18 L50 42 L10 42 Z', 'bs'),
  C(34, 30, 7, 'ground'),
  flame('hi', .4, 26),
]);
def('magnesium_sulfide', () => [                           // sulfur, or even just hydrogen sulfide gas, meets the ribbon
  S('M16 46 Q24 34 22 24', 'lo', 4),
  ...granules('bs', 9, 131, [28, 20, 50, 46]),
]);
def('sodium_sulfide',    () => [                           // sodium and sulfur combine, but the tonnage all pulps wood into paper
  P('M20 20 L48 20 L48 52 L20 52 Z', 'lo'),
  P('M12 14 L40 14 L40 46 L12 46 Z', 'hi'),
  S('M16 22 L36 22 M16 28 L36 28 M16 34 L36 34', 'gh', 1.2),
]);
def('potassium_sulfide', () => [                           // kept in check by dissolving the reaction in liquid ammonia
  P('M22 10 L38 10 L38 40 Q38 48 30 48 Q22 48 22 40 Z', 'gh'),
  E(30, 34, 7, 4, 'bs'),
  S('M12 44 Q30 38 48 44', 'lo', 2.4), S('M12 50 Q30 44 48 50', 'lo', 1.8),
]);
def('tarnish',      () => [E(30, 36, 21, 9, 'gh'), E(30, 33, 18, 7, 'ik'), E(24, 31, 6, 2.4, 'lo')]);  // the film on a spoon
def('potassium_chloride', () => [...[[20, 28], [38, 24], [30, 42]].map(([x, y]) =>
                                   [P(`M${x - 8} ${y} L${x} ${y - 5} L${x + 8} ${y} L${x} ${y + 5} Z`, 'gh'),
                                    P(`M${x - 8} ${y} L${x} ${y + 5} L${x} ${y + 13} L${x - 8} ${y + 8} Z`, 'lo')]).flat()]);
def('sodium_fluoride',    () => [P('M16 24 L44 24 L44 44 L16 44 Z', 'hi'),
                                 ...[24, 32, 40].map(x => S(`M${x} 24 L${x} 44`, 'gh', 1.4)),
                                 ...[30, 36].map(y => S(`M16 ${y} L44 ${y}`, 'gh', 1.4))]);   // the lattice itself
def('potassium_iodide',   () => [mound('lo', 46, 19, 17), ...granules('ik', 6, 37, [18, 34, 42, 44])]);
def('hydrogen_chloride',  () => [...gasTube('bs', 2), C(30, 32, 4, 'hi')]);
// A glass vessel, not a gas tube like hydrogen_chloride — the one acid that
// eats the container itself, so the cloudy patch IS the drawing's subject.
def('hydrogen_fluoride',  () => [vessel('gh', 20, 46), E(30, 34, 9, 12, 'ik'),
                                 S('M22 24 L38 24', 'ik', 2)]);
def('hydrogen_sulfide',   () => [C(30, 28, 8, 'hi'), C(16, 42, 5.4, 'gh'), C(44, 42, 5.4, 'gh'),
                                 S('M30 28 L16 42', 'ik', 2), S('M30 28 L44 42', 'ik', 2)]);   // bent, like water
def('carbon_monoxide',    () => [C(22, 32, 8, 'ik'), C(40, 32, 8, 'bs'),
                                 ...double([22, 32], [40, 32], 'hi'), S('M31 32 L31 32', 'hi', 2)]);
def('sulfur_dioxide',     () => [C(30, 26, 8, 'hi'), C(16, 40, 6.4, 'bs'), C(44, 40, 6.4, 'bs'),
                                 S('M30 26 L16 40', 'ik', 2), S('M30 26 L44 40', 'ik', 2)]);   // bent, not linear
def('nitric_oxide',       () => [C(22, 32, 7.4, 'lo'), C(40, 32, 7.4, 'bs'), S('M22 32 L40 32', 'ik', 2.4),
                                 C(48, 22, 2.4, 'hi')]);                                        // the odd electron
def('nitrogen_dioxide',   () => [C(30, 24, 7.4, 'lo'), C(16, 40, 6.4, 'bs'), C(44, 40, 6.4, 'bs'),
                                 S('M30 24 L16 40', 'ik', 2), S('M30 24 L44 40', 'ik', 2),
                                 ...granules('bs', 4, 99, [18, 12, 44, 20])]);                   // and it is brown
def('nitrate',      () => [C(30, 32, 7.4, 'lo'),
                           ...[[30, 14], [15, 42], [45, 42]].map(([x, y]) => [S(`M30 32 L${x} ${y}`, 'ik', 2), C(x, y, 5.4, 'bs')]).flat()]);
def('tungsten_carbide', () => [P('M18 46 L18 22 L30 14 L42 22 L42 46 Z', 'ik'),
                               P('M18 22 L30 14 L42 22 L30 30 Z', 'lo'),
                               S('M30 30 L30 46', 'gh', 1.6)]);                     // an insert, as it is sold
def('calcium_carbide',  () => [P('M14 44 L22 20 L40 16 L48 38 L34 50 Z', 'lo'),
                               ...granules('hi', 6, 23, [20, 24, 42, 42]),
                               ...[[46, 18], [50, 26]].map(([x, y]) => C(x, y, 2.4, 'gh'))]);   // it fizzes in damp air
def('acetylene',    () => [C(20, 32, 6.4, 'ik'), C(40, 32, 6.4, 'ik'),
                           ...[[0, 0], [0, -4], [0, 4]].map(([dx, dy]) => S(`M20 ${32 + dy} L40 ${32 + dy}`, 'hi', 1.8)),
                           S('M13 32 L8 32', 'ik', 1.8), S('M47 32 L52 32', 'ik', 1.8)]);        // the triple bond
def('titanium_nitride', () => [...ingot('hi', 16, 9), ...granules('bs', 4, 51, [18, 28, 42, 40])]);
def('magnesium_nitride', () => [mound('lo', 46, 19, 17), ...granules('bs', 7, 67, [18, 32, 42, 46])]);

/* a research batch: alloys, salts and oxides ─────────────────────────────
 * Fifty-three land in `mineral` at once, so each earns the physical form
 * that makes it what it is — a fork, a wrench, a filmstrip, a pill — rather
 * than another faceted lump with a different granule seed. */

/* the lithium salts — five, and no two share a crystal habit */
def('lithium_graphite',  () => [                          // LiC6: ions parked between the sheets
  ...[16, 26, 36, 46].map(y => S(`M10 ${y} L50 ${y}`, 'ik', 2.4)),
  ...[[18, 21], [34, 21], [26, 31], [42, 31], [18, 41], [34, 41]].map(([x, y]) => C(x, y, 3, 'hi')),
]);
def('lithium_fluoride',  () => [                          // its crystal passes UV nothing else lets through
  P('M18 20 L36 14 L42 32 L24 40 Z', 'gh'), P('M18 20 L36 14 L36 30 L18 36 Z', 'hi'),
  S('M30 6 L32 46', 'bs', 2),                              // straight through, unfiltered
]);
def('lithium_chloride',  () => [                          // hungry for water, one damp crystal at a time
  facet('bs', .7),
  ...[[14, 18], [46, 22], [40, 46]].map(([x, y]) =>
    [E(x, y, 3, 4, 'hi'), S(`M${x} ${y + 4} L${x + (x < 30 ? 6 : -6)} ${y + 8}`, 'gh', 1)]).flat(),
]);
def('lithium_iodide',    () => [                          // chosen for how long it lasts, not how well it conducts
  P('M18 24 Q18 14 30 14 Q42 14 42 24 L42 40 Q42 50 30 50 Q18 50 18 40 Z', 'lo'),
  E(30, 24, 10, 4, 'bs'), S('M22 34 L38 34', 'hi', 1.2),
]);
def('lithium_nitride',   () => [                          // lithium takes nitrogen straight from the air; the others cannot
  P('M30 12 L46 46 L14 46 Z', 'bs'),
  ...[[8, 14], [52, 14]].map(([x, y]) => [
    C(x, y, 2.4, 'gh'), C(x + (x < 30 ? 4 : -4), y + 2, 2.4, 'gh'),
    S(`M${x + (x < 30 ? 2 : -2)} ${y + 3} L${x + (x < 30 ? 12 : -12)} ${y + 11}`, 'hi', 1.2),
  ]).flat(),
]);

/* five more single-halide and single-oxide salts */
def('sodium_bromide',    () => [                          // a sedative for eighty years, whatever salt carries it
  E(22, 30, 10, 9, 'bs'), E(38, 30, 10, 9, 'hi'), S('M30 21 L30 39', 'lo', 1.4),
]);
def('sodium_iodide',     () => [                          // doped with thallium, it lights up under radiation
  P('M24 12 L36 12 L36 48 L24 48 Z', 'gh'),
  ...[0, 60, 120, 180, 240, 300].map(a =>
    S(`M30 16 L${n(30 + 14 * Math.cos(a * Math.PI / 180))} ${n(16 + 14 * Math.sin(a * Math.PI / 180))}`, 'hi', 1.4)),
]);
def('potassium_fluoride',() => [                          // chemistry's main working source of a fluoride ion
  P('M30 10 L46 30 L30 50 L14 30 Z', 'bs'), C(30, 30, 4, 'hi'),
  ...[0, 120, 240].map(a =>
    S(`M30 30 L${n(30 + 18 * Math.cos(a * Math.PI / 180))} ${n(30 + 18 * Math.sin(a * Math.PI / 180))}`, 'gh', 1.2)),
]);
def('caesium_chloride',  () => [                          // the trick that first separated DNA by weight
  P('M22 10 L38 10 L38 44 Q30 52 22 44 Z', 'gh'),
  ...['lo', 'bs', 'hi'].map((r, i) => P(`M22 ${16 + i * 10} L38 ${16 + i * 10} L38 ${25 + i * 10} L22 ${25 + i * 10} Z`, r)),
]);
def('iron_chloride',     () => [                          // rust-red and thirsty for grime
  P('M30 12 Q42 30 42 40 A12 12 0 0 1 18 40 Q18 30 30 12 Z', 'bs'),
  ...granules('lo', 6, 71, [22, 30, 38, 44]),
]);
def('silver_chloride',   () => [                          // it darkens the instant light touches it
  P('M16 16 L44 16 L44 44 L16 44 Z', 'gh'), P('M16 16 L30 16 L30 44 L16 44 Z', 'ik'),
  S('M34 8 L34 16 M40 10 L36 18', 'hi', 1.6),
]);
def('silver_bromide',    () => [                          // the compound most black-and-white film was built from
  P('M8 16 L52 16 L52 44 L8 44 Z', 'ik'),
  ...[13, 47].flatMap(x => [12, 20, 28, 36, 44].map(y => C(x, y, 1.6, 'gh'))),
  ...[20, 30, 40].map((x, i) => P(`M${x - 4} 18 L${x + 4} 18 L${x + 4} 42 L${x - 4} 42 Z`, i % 2 ? 'hi' : 'lo')),
]);
def('strontium_chloride',() => [                          // it plugs the tubules a receding gum has exposed
  P('M22 12 L38 12 L34 44 Q30 52 26 44 Z', 'hi'),
  ...[[26, 22], [34, 22], [24, 32], [36, 32], [27, 40]].map(([x, y]) =>
    [S(`M${x} ${y} L${x} ${y - 3}`, 'gh', 1.2), C(x, y - 3, 1, 'bs')]).flat(),
]);

/* a second batch of halides — twelve chlorides, four fluorides, four
 * bromides and two iodides, none sharing a habit with the first round or
 * with each other: a strip that changes colour, a prism that splits light,
 * a dropper bottle, a lattice stretched or swapped for a wider grid. */
def('aluminum_chloride', () => [                           // foil burning in chlorine gas, exothermic at industrial scale
  P('M12 20 L38 16 L40 24 L14 28 Z', 'hi'),
  P('M14 28 L40 24 L42 32 L16 36 Z', 'bs'),
  P('M16 36 L42 32 L44 40 L18 44 Z', 'hi'),
  flame('bs', .35, -10),
]);
def('copper_chloride',   () => [                           // copper at red heat, straight into chlorine — a molten result
  P('M20 16 Q30 10 40 16 Q46 26 40 38 Q30 46 20 38 Q14 26 20 16 Z', 'bs'),
  S('M24 20 L20 14 M36 20 L40 14 M30 10 L30 6', 'lo', 1.4),
  C(26, 30, 2.4, 'hi'),
]);
def('magnesium_chloride',() => [                           // the plainest alkaline-earth-meets-halogen salt there is
  P('M30 14 L42 21 L42 39 L30 46 L18 39 L18 21 Z', 'bs'),
  S('M30 14 L30 46 M18 21 L42 39 M42 21 L18 39', 'gh', 1),
]);
def('calcium_chloride',  () => [                           // deliquescent — it pulls the water straight out of the air
  ...[[20, 34], [38, 30], [28, 44]].map(([x, y], i) =>
    P(`M${x - 7} ${y} L${x} ${y - 8} L${x + 7} ${y} L${x} ${y + 6} Z`, i % 2 ? 'hi' : 'bs')),
  ...[[16, 20], [44, 18]].map(([x, y]) => S(`M${x} ${y} L${x} ${y + 6}`, 'gh', 1.2)),
]);
def('tin_chloride',      () => [                           // chlorine gas over tin at 115°C, a clean route to a catalyst
  P('M24 12 L36 12 L38 26 L46 46 Q46 52 30 52 Q14 52 14 46 L22 26 Z', 'gh'),
  E(30, 44, 14, 6, 'bs'),
  S('M20 18 Q16 10 22 4 M40 18 Q44 10 38 4', 'hi', 1.6),
]);
def('lead_chloride',     () => [                           // chlorine gas, straight onto lead metal — nothing more
  ...[-80, -35, 10, 55].map(a =>
    S(`M30 48 L${n(30 + 24 * Math.cos(a * Math.PI / 180))} ${n(48 + 24 * Math.sin(a * Math.PI / 180))}`, 'lo', 2.2)),
  C(30, 48, 3, 'bs'),
]);
def('gold_chloride',     () => [                           // Robert Boyle, 1666 — metallic gold, straight into chlorine
  P('M18 24 L26 14 L36 16 L42 28 L34 40 L20 38 Z', 'bs'),
  C(24, 22, 2, 'hi'), C(34, 30, 1.6, 'hi'),
  S('M14 44 L20 38 M40 44 L34 40', 'gh', 1.2),
]);
def('titanium_chloride', () => [                           // cold titanium ignores chlorine; at 550°C it burns violently
  P('M22 14 L38 14 L38 24 L46 40 Q48 50 30 50 Q12 50 14 40 L22 24 Z', 'lo'),
  E(30, 42, 15, 6, 'bs'),
  S('M18 20 Q10 14 14 6 M42 20 Q50 14 46 6 M30 12 Q30 4 26 0', 'hi', 1.4),
]);
def('cobalt_chloride',   () => [                           // blue when dry, pink the moment it drinks in water
  P('M14 18 L30 18 L30 46 L14 46 Z', 'bs'),
  P('M30 18 L46 18 L46 46 L30 46 Z', 'hi'),
  S('M14 18 L46 18 M14 46 L46 46', 'ik', 1.4),
]);
def('chromium_chloride', () => [                           // chromium chlorinated directly — the same skin-growing metal
  P('M30 12 L44 24 L38 44 L22 44 L16 24 Z', 'bs'),
  S('M30 12 L44 24 L38 44 L22 44 L16 24 Z', 'gh', 1.2),
  C(30, 26, 2.2, 'hi'),
]);
def('rubidium_chloride', () => [                           // dissolves into cells readily enough to carry foreign DNA in
  ring('gh', 30, 32, 16, 2.2),
  S('M14 20 Q22 26 18 34 Q14 42 22 46', 'bs', 2.4),
  C(22, 46, 2.2, 'hi'),
]);
def('europium_chloride', () => [                           // the same europium-plus-halogen reaction, run on chlorine
  ...[[22, 26], [38, 22], [30, 40]].map(([x, y], i) =>
    P(`M${x - 6} ${y + 5} L${x} ${y - 6} L${x + 6} ${y + 5} Z`, i % 2 ? 'hi' : 'bs')),
]);
def('copper_fluoride',   () => [                           // copper and fluorine at 500°C — only half of it ever converts
  P('M14 22 L30 22 L30 42 L14 42 Z', 'lo'),
  P('M30 16 L46 24 L42 38 L30 42 Z', 'hi'),
  S('M30 22 L30 42', 'gh', 1.4),
]);
def('rubidium_fluoride', () => [                           // table salt's own lattice, one row down the periodic table
  P('M10 16 L50 16 L50 48 L10 48 Z', 'gh'),
  ...[22, 38].map(x => S(`M${x} 16 L${x} 48`, 'lo', 1.2)),
  ...[24, 32, 40].map(y => S(`M10 ${y} L50 ${y}`, 'lo', 1.2)),
]);
def('caesium_fluoride',  () => [                           // the most reactive metal meets the most reactive nonmetal
  P('M16 20 L44 20 L44 48 L16 48 Z', 'gh'),
  P('M16 20 L44 20 L44 26 L16 26 Z', 'bs'),
  C(30, 36, 6, 'hi'), S('M26 36 L34 36 M30 32 L30 40', 'ik', 1.4),
]);
def('europium_fluoride', () => [                           // europium reacts with every halogen — fluorine gives this one
  P('M30 8 L40 30 L30 52 L20 30 Z', 'hi'), C(30, 30, 2.4, 'gh'),
]);
def('lithium_bromide',   () => [                           // a strong solution of it dries the air inside a cooling system
  ...coilOf('bs', 3, 14, 22, 6),
  ...[[18, 40], [30, 44], [42, 40]].map(([x, y]) => C(x, y, 1.8, 'hi')),
]);
def('potassium_bromide', () => [                           // the first medicine that worked against epilepsy
  C(30, 30, 16, 'gh'), S('M16 30 L44 30', 'ik', 1.6),
]);
def('rubidium_bromide',  () => [                           // table salt's lattice, stretched to fit two heavier atoms
  P('M8 24 L52 24 L52 38 L8 38 Z', 'gh'),
  ...[20, 30, 40].map(x => S(`M${x} 24 L${x} 38`, 'lo', 1.2)),
]);
def('caesium_bromide',   () => [                           // grown into crystal optics that split light in a spectrophotometer
  P('M20 44 L30 12 L40 44 Z', 'gh'),
  S('M20 44 L10 50', 'lo', 1.6), S('M26 44 L20 54', 'bs', 1.6), S('M34 44 L40 54', 'hi', 1.6), S('M40 44 L50 50', 'gh', 1.6),
  S('M30 12 L30 4', 'ik', 1.6),
]);
def('rubidium_iodide',   () => [                           // bottled as eye drops, eight milligrams in every millilitre
  E(30, 14, 8, 6, 'gh'), P('M26 20 L34 20 L32 46 L28 46 Z', 'bs'), C(30, 48, 2.6, 'hi'),
]);
def('caesium_iodide',    () => [                           // the phosphor screen that turns radiation into a picture
  P('M10 18 L50 18 L50 42 L10 42 Z', 'ik'),
  ...[0, 45, 90, 135, 180, 225, 270, 315].map(a =>
    S(`M30 30 L${n(30 + 9 * Math.cos(a * Math.PI / 180))} ${n(30 + 9 * Math.sin(a * Math.PI / 180))}`, 'hi', 1.2)),
]);

/* the alkaline-earth halides — every one built on the same facet() crystal
   chunk the rest of the salt family already uses, scaled up metal by metal
   down the group (beryllium smallest, radium largest), with a mark specific
   to the halogen: fluoride is pierced by a straight line, chloride weeps
   little droplets, bromide beads dark, iodide sheds a wisp as it sublimes. */
def('beryllium_fluoride', () => [facet('bs', .48), facet('hi', .22), S('M20 18 L40 42', 'ik', 1.6)]);
def('beryllium_chloride', () => [
  facet('bs', .52),
  E(15, 17, 2.6, 3.4, 'hi'), S('M15 20 L18 25', 'gh', 1),
  E(45, 21, 2.6, 3.4, 'hi'), S('M45 24 L42 29', 'gh', 1),
]);
def('beryllium_bromide',  () => [facet('bs', .56), C(39, 41, 3, 'lo'), C(38, 40, 1, 'hi')]);
def('beryllium_iodide',   () => [facet('bs', .6), S('M22 15 Q27 9 23 4', 'gh', 1.4)]);

def('magnesium_fluoride', () => [facet('bs', .65), facet('hi', .3), S('M40 16 L20 44', 'ik', 1.6)]);
def('magnesium_bromide',  () => [
  facet('bs', .69),
  C(17, 27, 2.8, 'lo'), C(43, 33, 2.8, 'lo'), C(16, 26, 1, 'hi'), C(42, 32, 1, 'hi'),
]);
def('magnesium_iodide',   () => [
  facet('bs', .73),
  S('M18 16 Q23 10 19 5', 'gh', 1.4), S('M42 18 Q47 12 43 7', 'gh', 1.4),
]);

def('calcium_bromide', () => [
  facet('bs', .8),
  C(30, 12, 2.8, 'lo'), C(30, 48, 2.8, 'lo'), C(29, 11, 1, 'hi'), C(29, 47, 1, 'hi'),
]);
def('calcium_iodide',  () => [facet('bs', .84), S('M14 30 Q9 25 13 20', 'gh', 1.4), C(11, 22, 1.4, 'bs')]);

def('strontium_fluoride', () => [facet('bs', .95), facet('hi', .4), S('M30 8 L30 52', 'ik', 1.6)]);
def('strontium_bromide',  () => [
  facet('bs', .99), C(24, 14, 2.8, 'lo'), C(38, 16, 2.8, 'lo'), C(31, 47, 2.8, 'lo'),
]);
def('strontium_iodide',   () => [
  facet('bs', 1.03),
  S('M16 22 Q10 18 12 12', 'gh', 1.4), S('M44 24 Q50 20 48 14', 'gh', 1.4),
]);

def('barium_fluoride', () => [facet('bs', 1.1), facet('hi', .5), S('M14 14 L46 46', 'ik', 1.6)]);
def('barium_chloride', () => [
  facet('bs', 1.14),
  ...[[13, 20], [47, 22], [30, 52]].map(([x, y]) =>
    [E(x, y, 2.6, 3.2, 'hi'), S(`M${x} ${y + 3} L${x} ${y + 8}`, 'gh', 1)]).flat(),
]);
def('barium_bromide',  () => [
  facet('bs', 1.18), C(15, 15, 3, 'lo'), C(45, 45, 3, 'lo'), C(14, 14, 1, 'hi'), C(44, 44, 1, 'hi'),
]);
def('barium_iodide',   () => [
  facet('bs', 1.22), S('M12 34 Q6 30 8 24', 'gh', 1.4), C(9, 26, 1.4, 'bs'), C(48, 30, 1.4, 'bs'),
]);

def('radium_fluoride', () => [
  facet('bs', 1.25), facet('hi', .55), S('M18 10 L42 50', 'ik', 1.6), C(50, 12, 1.2, 'gh'),
]);
def('radium_chloride', () => [
  facet('bs', 1.29),
  E(12, 18, 2.8, 3.6, 'hi'), S('M12 21 L15 27', 'gh', 1),
  E(48, 22, 2.8, 3.6, 'hi'), S('M48 25 L45 31', 'gh', 1),
  C(30, 8, 1.2, 'gh'),
]);
def('radium_bromide',  () => [
  facet('bs', 1.33), C(30, 46, 3.4, 'lo'), C(29, 45, 1.2, 'hi'), C(8, 14, 1.2, 'gh'),
]);
def('radium_iodide',   () => [
  facet('bs', 1.37),
  S('M14 16 Q8 12 10 6', 'gh', 1.4), S('M46 18 Q52 14 50 8', 'gh', 1.4), C(30, 52, 1.2, 'gh'),
]);

/* the oxides, peroxides and one very stubborn noble gas */
def('xenon_tetrafluoride', () => ballStick('Xe', [['F', 0], ['F', 90], ['F', 180], ['F', 270]]));  // 1962: forced into a bond
def('carbon_tetrafluoride',  () => ballStick('C', [['F', 45], ['F', 135], ['F', 225], ['F', 315]]));   // tetrahedral — even graphite burns this way
def('nitrogen_trifluoride',  () => ballStick('N', [['F', 100], ['F', 220], ['F', 340]]));               // nitrogen barely reacts; a spark forces this
def('chlorine_trifluoride',  () => ballStick('Cl', [['F', 30], ['F', 210], ['F', 120]]));               // T-shaped, and it will set sand on fire
def('phosphorus_trichloride',() => ballStick('P', [['Cl', 140, .85], ['Cl', 260, .85], ['Cl', 20, .85]]));  // phosphorus burning in chlorine
def('sulfur_hexafluoride',   () => ballStick('S', [['F', 0], ['F', 60], ['F', 120], ['F', 180], ['F', 240], ['F', 300]]));  // octahedral, unchanged since 1901
def('phosphorus_pentafluoride', () => ballStick('P', [['F', 18], ['F', 90], ['F', 162], ['F', 234], ['F', 306]]));  // five-coordinate phosphorus
def('krypton_difluoride',    () => ballStick('Kr', [['F', 20, 1.3], ['F', 200, 1.3]]));                 // krypton bonds to nothing else, and only when forced
def('carbon_disulfide',      () => [                        // S=C=S, made by heating carbon and sulfur for a century
  ...double([12, 30], [48, 30], 'gh'),
  S('M12 30 L48 30', 'ik', 2.6),
  C(12, 30, 8.5, CPK.S), C(48, 30, 8.5, CPK.S), C(30, 30, 7, CPK.C),
]);
def('disulfur_dichloride',   () => [                        // chlorine into molten sulfur — golden liquid at room temperature
  S('M10 42 L23 27 L37 27 L50 12', 'ik', 2.4),
  C(10, 42, 6, CPK.Cl), C(23, 27, 7, CPK.S), C(37, 27, 7, CPK.S), C(50, 12, 6, CPK.Cl),
]);
def('lithium_oxide',    () => [                           // a flux that changes the colours around it
  round('gh', 40, 20, 9), ...granules('bs', 5, 19, [24, 34, 36, 42]),
  E(20, 30, 5, 3.4, 'hi'), E(40, 26, 5, 3.4, 'lo'),        // copper's blue, cobalt's pink
]);
def('sodium_peroxide',  () => [                            // it once breathed for submarines
  vessel('gh', 22, 48), wave('bs', 40, 3, 11),
  C(24, 30, 3, 'hi'), C(33, 22, 2.4, 'hi'), C(28, 14, 1.8, 'hi'), C(37, 9, 1.3, 'hi'),
]);
def('potassium_superoxide', () => [                        // a rebreather's whole trick in one rock
  P('M20 14 L40 14 L40 46 L20 46 Z', 'bs'),
  S('M6 24 L18 24', 'lo', 2.6), S('M14 20 L18 24 L14 28', 'lo', 2),
  S('M42 36 L54 36', 'hi', 2.6), S('M50 32 L54 36 L50 40', 'hi', 2),
]);
def('titanium_dioxide', () => [                            // the white in almost everything white
  P('M14 20 L46 20 L46 46 L14 46 Z', 'hi'),
  S('M10 14 Q20 10 30 16 Q40 22 50 16', 'gh', 3.4),
]);
def('chromium_oxide',   () => [                            // chrome green, and a film that heals itself
  mound('bs', 46, 18, 16), S('M14 30 Q30 24 46 30', 'hi', 1.6),
]);
def('nickel_oxide',     () => [                            // green as a crystal, black the instant it is not
  C(30, 30, 15, 'bs'), P('M24 18 L30 30 L22 34 L34 42 L26 30 L34 20 Z', 'ik'),
]);
def('manganese_dioxide',() => [                            // soaking up electrons inside an ordinary dry-cell battery
  P('M20 12 L40 12 L40 48 L20 48 Z', 'lo'), ...granules('ik', 14, 43, [22, 18, 38, 44]), S('M30 8 L30 12', 'hi', 2.4),
]);
def('tin_dioxide',      () => [                            // the opaque white of old tin-glazed pottery
  P('M20 16 L40 16 L44 30 L38 48 L22 48 L16 30 Z', 'hi'), E(30, 16, 10, 3, 'gh'), S('M20 30 Q30 34 40 30', 'lo', 1.4),
]);
def('germanium_dioxide',() => [                            // the core of a fiber-optic cable, seen end-on
  E(30, 30, 17, 13, 'gh'), C(30, 30, 6, 'bs'), S('M12 30 Q30 20 48 30', 'hi', 1.4),
]);
def('yag',               () => [                           // dope it with neodymium and it lases
  P('M24 10 L36 10 L38 50 L22 50 Z', 'gh'), S('M30 10 L30 4', 'hi', 3), C(30, 30, 3, 'bs'),
]);
def('luminous_paint',   () => [                            // painted onto a watch face, glowing since 1908
  ring('lo', 30, 30, 16, 3), C(30, 30, 12, 'gh'), S('M30 30 L30 20 M30 30 L38 32', 'bs', 2.2),
  ...[0, 90, 180, 270].map(a => ['g', a, 30, 30, [C(30, 14, 1.4, 'bs')]]),
]);
def('rubidium_superoxide', () => [                         // like potassium one row up, straight to superoxide
  P('M22 16 Q22 10 30 10 Q38 10 38 16 L38 48 Q38 52 30 52 Q22 52 22 48 Z', 'bs'),
  P('M26 8 L34 8 L34 12 L26 12 Z', 'lo'), S('M38 22 Q48 22 48 30 L48 34', 'hi', 3),
]);
def('red_phosphor',     () => [                            // europium is the only red they had
  P('M12 14 L48 14 L48 46 L12 46 Z', 'ik'),
  ...Array.from({ length: 9 }, (_, i) => C(18 + (i % 3) * 12, 20 + Math.floor(i / 3) * 10, 2.2, i % 3 === 0 ? 'bs' : 'gh')),
]);
def('signal_paint',     () => [                            // a gentler glow than radium's ever was
  P('M16 12 L44 12 L44 48 L16 48 Z', 'ik'), C(30, 20, 6, 'bs'), C(30, 34, 6, 'gh'), C(30, 48, 6, 'bs'),
  ...[[10, 20], [10, 34]].map(([x, y]) => S(`M${x} ${y} L${x + 8} ${y}`, 'lo', 1.2)),
]);

/* four lanthanide oxides — the tarnish IS the fact, so the amount of it is
 * what tells them apart: none, a corner, or the whole surface gone black. */
def('lanthanum_oxide',  () => [                            // it tarnishes almost as fast as you can watch, turning black
  C(30, 30, 16, 'ik'), cutFace('hi', 30, 16, 16),
]);
def('cerium_oxide',     () => [                            // Ce + O2 → CeO2 — then it scrubs an exhaust or polishes glass flat
  ...[[22, 22], [38, 22], [30, 34], [22, 46], [38, 46]].map(([x, y]) => hex('bs', x, y, 7, 1.6)),
]);
def('neodymium_oxide',  () => [                            // it flakes as it burns, always exposing fresh metal underneath
  E(30, 32, 18, 15, 'lo'),
  ...[[20, 24], [40, 30], [26, 42]].map(([x, y]) => E(x, y, 6, 3.4, 'ground')),
  C(34, 20, 2, 'bs'),
]);
def('gadolinium_oxide',  () => [                           // gadolinium shrugs off dry air — only damp air tarnishes it
  E(30, 30, 18, 14, 'hi'), E(40, 36, 6, 4, 'lo'),
]);

/* the alloys — each drawn as the object it actually becomes */
def('stainless_steel',  () => [                            // chromium grows its own invisible, self-healing skin
  ...[15, 21, 27, 33].map(x => P(`M${x} 8 L${x + 3} 8 L${x + 3} 22 L${x + 1.5} 27 L${x} 22 Z`, 'bs')),
  P('M15 22 L36 22 L28 30 L23 30 Z', 'bs'), P('M23 30 L28 30 L29 54 L22 54 Z', 'bs'),
  S('M17 11 L17 19', 'hi', 1.4),
]);
def('beryllium_copper',  () => [                           // safe to swing a wrench beside an open gas line
  S('M20 30 L42 30', 'bs', 7), ring('bs', 14, 30, 9, 5),
  P('M42 22 L52 14 L56 18 L48 26 Z', 'bs'), P('M42 38 L52 46 L56 42 L48 34 Z', 'bs'), C(14, 30, 3, 'hi'),
]);
def('niobium_titanium',  () => [                           // wound tight, then chilled near absolute zero
  ...coilOf('bs', 5, 12, 30, 4.4),
  ...[[8, 16], [54, 16], [8, 44], [54, 44]].map(([x, y]) =>
    S(`M${x} ${y} L${x + (x < 30 ? -4 : 4)} ${y + (y < 30 ? -4 : 4)}`, 'hi', 1.6)),
]);
def('rose_gold',         () => [                           // gold does not blush on its own
  ring('bs', 30, 34, 14, 6), ring('hi', 30, 34, 8, 1.6), E(24, 24, 4, 2.6, 'hi'),
]);
def('hard_lead',         () => [                           // antimony stiffens it, and stops the shrink as it cools
  hex('bs', 30, 20, 10, 2.6), P('M26 30 L34 30 L34 52 L26 52 Z', 'bs'),
  ...[36, 42, 48].map(y => S(`M26 ${y} L34 ${y}`, 'hi', 1.2)),
]);
def('titanium_alloy',    () => [                           // most of the titanium ever flown
  P('M8 34 L40 30 L54 24 L52 30 L38 36 L44 46 L36 44 L28 36 L8 40 Z', 'bs'), S('M20 35 L40 31', 'hi', 1.4),
]);
def('galvanized_iron',   () => [                           // zinc sacrifices itself to a scratch so iron does not have to
  P('M14 22 L46 22 L42 50 L18 50 Z', 'bs'), E(30, 22, 16, 4, 'hi'),
  S('M18 40 L18 46', 'lo', 2.4), S('M12 26 Q30 16 48 26', 'ik', 2),
]);
def('gold_amalgam',      () => [                           // mercury drinks up gold flour too fine to pan
  C(30, 34, 13, 'lo'), C(24, 29, 3.4, 'hi'),
  ...[[24, 38], [34, 30], [36, 40], [26, 28]].map(([x, y]) => C(x, y, 1.6, 'bs')),
]);
def('dental_amalgam',    () => [                           // packed soft, hard within minutes
  P('M18 14 Q30 8 42 14 Q46 26 40 32 L38 50 L33 34 L27 34 L22 50 L20 32 Q14 26 18 14 Z', 'hi'), E(28, 22, 7, 5, 'bs'),
]);
def('palladium_hydride', () => [                           // nine hundred times its own volume, packed into the lattice
  P('M16 20 L44 20 L44 44 L16 44 Z', 'bs'), ...granules('hi', 20, 61, [18, 22, 42, 42]),
]);
def('bismuth_telluride', () => [                           // one face chills while the other warms, no moving parts
  P('M14 16 L46 16 L46 30 L14 30 Z', 'hi'), P('M14 30 L46 30 L46 44 L14 44 Z', 'lo'),
  S('M20 20 L24 24 M40 20 L36 24', 'ik', 1.4),
  S('M20 38 Q24 34 20 40', 'ik', 1.2), S('M40 38 Q36 34 40 40', 'ik', 1.2),
]);
def('ferrovanadium',     () => [                           // a universal steel hardener, stirred in
  ring('bs', 20, 22, 7, 3.2), ring('bs', 32, 28, 7, 3.2), wave('lo', 46, 4, 20),
]);
def('nicad_battery',     () => [                           // rechargeable long before lithium was
  P('M22 10 L38 10 L38 16 L22 16 Z', 'hi'), P('M18 16 L42 16 L42 50 L18 50 Z', 'bs'),
  S('M18 30 L42 30', 'lo', 2), S('M22 34 L38 34 M22 40 L38 40', 'lo', 1.2),
]);
def('lithium_hydride', () => [                             // rock-salt lattice, the same cubic structure as table salt
  P('M18 22 L30 14 L42 22 L30 30 Z', 'hi'),
  P('M18 22 L30 30 L30 48 L18 40 Z', 'bs'),
  P('M42 22 L30 30 L30 48 L42 40 Z', 'gh'),
]);
// A flat prismatic pouch cell, not nicad_battery's cylindrical AA shape —
// "especially in handheld electronics" is the real distinguishing fact.
def('lithium_ion_battery', () => [
  P('M14 14 L46 14 Q50 14 50 18 L50 46 Q50 50 46 50 L14 50 Q10 50 10 46 L10 18 Q10 14 14 14 Z', 'bs'),
  P('M24 8 L36 8 L36 14 L24 14 Z', 'hi'),
  S('M22 32 L30 32 M26 28 L26 36', 'lo', 2.4),                // a plus terminal, etched
]);
def('platinum_rhodium_gauze', () => [                      // the screen ammonia burns across on its way to fertiliser
  ...[16, 24, 32, 40, 48].map(y => S(`M10 ${y} L50 ${y}`, 'bs', 1.6)),
  ...[16, 24, 32, 40, 48].map(x => S(`M${x} 12 L${x} 52`, 'hi', 1.6)),
]);
def('platinum_iridium',  () => [                           // this exact bar WAS the kilogram
  P('M20 18 L40 18 L40 44 L20 44 Z', 'bs'), E(30, 18, 10, 3, 'hi'), E(30, 44, 10, 3, 'lo'),
]);
def('hardened_platinum', () => [                           // a trace of ruthenium is what actually holds the stone
  ring('bs', 30, 40, 12, 5), ...[20, 40].map(x => S(`M${x} 30 L${x} 22`, 'bs', 2.4)),
  P('M24 16 L30 8 L36 16 L30 22 Z', 'hi'),
]);
def('tungsten_rhenium',  () => [                           // good past 2,200°C, hot enough almost nothing else measures it
  S('M12 46 Q20 30 28 22', 'bs', 2.4), S('M48 46 Q40 30 32 22', 'hi', 2.4), C(30, 20, 3.4, 'ik'),
  S('M30 12 L30 4', 'lo', 1.6), S('M26 6 L34 10', 'lo', 1.4),
]);
def('rocket_nozzle_alloy', () => [                         // this exact alloy steered the Apollo Lunar Module down
  P('M24 8 L36 8 L44 40 L34 52 L26 52 L16 40 Z', 'bs'), S('M24 8 L16 40 M36 8 L44 40', 'hi', 1.4),
]);
def('scandium_aluminum_alloy', () => [                     // enough to matter in a MiG or a bike frame
  S('M14 46 L34 18 L50 46', 'bs', 4), S('M34 18 L34 46', 'hi', 3),
  C(14, 46, 3, 'lo'), C(50, 46, 3, 'lo'), C(34, 18, 3, 'lo'),
]);
def('gadolinium_steel',  () => [                           // easier to work, far harder to oxidise hot
  P('M12 38 L48 38 L48 44 L34 44 L34 50 L26 50 L26 44 L12 44 Z', 'bs'), P('M18 30 L42 30 L38 38 L22 38 Z', 'hi'),
  S('M30 20 L30 30', 'ik', 2), S('M26 24 L34 24', 'ik', 1.4),
]);
def('neodymium_magnet',  () => [                           // the strongest permanent magnet you can buy
  P('M16 20 L44 20 L44 44 L16 44 Z', 'lo'), P('M16 20 L30 20 L30 44 L16 44 Z', 'bs'),
  S('M10 26 Q30 14 50 26', 'hi', 1.2), S('M10 34 Q30 22 50 34', 'hi', 1.2),
]);
def('samarium_cobalt_magnet', () => [                      // weaker than neodymium but happy past 300°C
  ring('bs', 30, 32, 15, 7), S('M20 16 Q24 10 20 4 M30 16 Q34 10 30 4 M40 16 Q44 10 40 4', 'hi', 1.6),
]);

/* four more alloys, drawn as what they become */
def('aluminum_copper_alloy', () => [                       // aluminium and a little copper — an aircraft frame's main alloy
  P('M10 26 L50 20 L50 38 L10 44 Z', 'bs'),
  ...[16, 26, 36, 46].map(x => C(x, n(23 - (x - 16) * 0.15), 2, 'hi')),
]);
def('magnalium',        () => [                            // light enough for an engine, or loaded up for a flare
  P('M20 24 L40 24 L40 44 L20 44 Z', 'bs'),
  ...[0, 60, 120, 180, 240, 300].map(a =>
    S(`M30 20 L${n(30 + 16 * Math.cos((a - 90) * Math.PI / 180))} ${n(20 + 16 * Math.sin((a - 90) * Math.PI / 180))}`, 'hi', 1.8)),
]);
def('nak_alloy',        () => [                            // stays liquid at room temperature — reactor coolant since the 1960s
  ...coilOf('hi', 4, 12, 34, 6),
  C(34, 30, 6, 'bs'), C(30, 27, 1.8, 'gh'),
]);
def('tin_silver_solder', () => [                           // tin and silver's eutectic — the real alloy behind lead-free solder
  P('M14 40 L46 40 L46 46 L14 46 Z', 'gh'),
  E(30, 36, 9, 7, 'bs'), S('M22 30 L22 40 M38 30 L38 40', 'ik', 1.6),
]);

/* the fire-lit and craft-adjacent three */
def('neon_light',        () => [                           // no filament at all — thousands of volts through the gas itself
  ['s', 'M14 44 L14 18 Q14 12 20 12 L34 12 Q40 12 40 18 L40 26 Q40 32 34 32 L24 32 Q18 32 18 38 L18 44', 'bs', 3.4],
  C(14, 44, 2.4, 'hi'), C(18, 44, 2.4, 'hi'),
]);
def('gas_mantle',        () => [                           // 99% thorium dioxide, turns an ordinary flame white-hot
  P('M18 40 Q18 18 30 16 Q42 18 42 40 Z', 'gh'), ...[22, 28, 34].map(x => S(`M${x} 40 L${x - 2} 18`, 'lo', 1)),
  flame('hi', .5, 18),
]);
def('ferrocerium',       () => [                           // this, not flint, is what lights a modern lighter
  P('M24 10 L32 10 L30 46 L26 46 Z', 'bs'), S('M18 44 L34 40', 'ik', 3),
  ...[[34, 38], [38, 32], [30, 30], [40, 42]].map(([x, y]) => S(`M${x} ${y} L${x + 4} ${y - 6}`, 'hi', 1.4)),
]);


/* the parts a nucleotide is made of, and where life might have started ──
   The five bases share one convention — purines are two fused rings, the
   pyrimidines one — because that IS the distinction, and it is what makes
   A pair with T rather than with G. */
// One ring or two: that is the pyrimidine/purine split, and it is the reason
// A pairs with T and not with G. Each card then shouts the ONE group that
// separates it from its neighbour, because that group is the whole fact.
const pyrimidine = (r) => [hex(r, 28, 33, 14, 2.4)];
const purine = (r) => [
  hex(r, 22, 34, 12, 2.4),
  P('M33 26 L45 29 L43 41 L32 42 Z', r),
  S('M33 26 L45 29 L43 41 L32 42 Z', 'ik', 2.2),
];
// Adenine: one amine, top left. Guanine: that amine moved down, plus a
// carbonyl top right — the extra oxygen is why it pairs three times, not two.
def('adenine',  () => [...purine('gh'), C(14, 22, 5.4, 'bs'), S('M17 26 L20 29', 'ik', 1.8)]);
def('guanine',  () => [...purine('gh'), C(15, 47, 5.4, 'bs'), S('M18 43 L21 41', 'ik', 1.8),
                       C(46, 18, 5.4, 'hi'), ...double([46, 18], [40, 27], 'ik')]);
// Cytosine carries an amine where uracil carries a second carbonyl, and
// thymine is uracil with a methyl stuck on the ring.
def('cytosine', () => [hex('gh', 26, 30, 13, 2.4), C(26, 11, 6, 'bs'), S('M26 16 L26 20', 'ik', 2),
                       C(42, 42, 4.4, 'hi')]);
def('uracil',   () => [hex('gh', 32, 36, 13, 2.4), C(16, 22, 5.4, 'hi'), ...double([16, 22], [24, 29], 'ik'),
                       C(48, 22, 5.4, 'hi'), ...double([48, 22], [40, 29], 'ik')]);
def('thymine',  () => [hex('gh', 30, 30, 13, 2.4), C(14, 44, 5.4, 'hi'), ...double([14, 44], [22, 38], 'ik'),
                       S('M43 42 L53 50', 'ik', 3.4), C(55, 52, 4, 'lo'),
                       C(30, 10, 4.4, 'hi')]);
// Ribose has an -OH at position 2. Deoxyribose is that oxygen taken away, and
// the gap is drawn as a gap.
def('ribose',      () => [P('M30 12 L48 25 L41 46 L19 46 L12 25 Z', 'hi'),
                          C(19, 46, 5.4, 'bs'), C(41, 46, 5.4, 'bs'), C(30, 12, 4.4, 'bs'),
                          S('M19 46 L10 54', 'ik', 1.8), S('M41 46 L50 54', 'ik', 1.8)]);
// Ribose drawn as a filled ring; deoxyribose as the same ring OPENED OUT into
// the straight-chain form it also takes, with a hollow ring marking the -OH
// that is missing at position 2. Two different pictures, because "the same
// shape in another colour" is not a difference anyone can see on a shelf.
def('deoxyribose', () => [
  S('M10 44 L20 30 L32 40 L44 26 L52 36', 'ik', 2.6),
  C(10, 44, 4.4, 'bs'), C(32, 40, 4, 'lo'), C(52, 36, 4.4, 'bs'),
  ring('ground', 20, 30, 5.4, 2.2),
  C(44, 20, 4, 'hi'),
]);
def('base_pair',() => [hex('gh', 17, 32, 11, 2.2), hex('gh', 43, 32, 11, 2.2),
                       ...[28, 34].map(y => S(`M27 ${y} L33 ${y}`, 'hi', 1.6))]);   // the hydrogen bonds
def('phosphate',   () => [C(30, 32, 8, 'bs'),
                          ...[[30, 13], [14, 42], [46, 42], [30, 50]].map(([x, y]) =>
                            [S(`M30 32 L${x} ${y}`, 'ik', 2), C(x, y, 4.4, 'hi')]).flat()]);
def('rna',         () => [S('M24 8 Q40 20 24 32 Q8 44 24 56', 'bs', 3.4),           // one strand, not two
                          ...[14, 26, 38, 50].map((y, i) => S(`M${i % 2 ? 26 : 22} ${y} L${i % 2 ? 42 : 38} ${y}`, 'hi', 2))]);
def('transfer_rna',   () => [P('M30 10 L30 30', 'ik') && S('M30 10 L30 30', 'bs', 3.4),
                             S('M30 30 L16 44', 'bs', 3.4), S('M30 30 L44 44', 'bs', 3.4),
                             ...[[16, 44], [44, 44]].map(([x, y]) => C(x, y, 5, 'hi')),
                             C(30, 8, 4.4, 'lo')]);                                  // the clover leaf
def('ribosomal_rna',  () => [E(30, 26, 19, 12, 'bs'), E(30, 42, 15, 9, 'lo'),
                             ...[[22, 24], [38, 28], [28, 42]].map(([x, y]) => C(x, y, 3, 'hi'))]);
def('ribozyme',       () => [S('M18 12 Q40 22 20 32 Q4 42 22 52', 'bs', 3.4),
                             C(38, 40, 7, 'hi'), ring('ik', 38, 40, 11, 1.4)]);      // RNA with an active site
def('phospholipid',   () => [C(30, 14, 7, 'bs'),
                             S('M27 20 Q23 34 26 50', 'ik', 2.6), S('M33 20 Q37 34 34 50', 'ik', 2.6)]);
def('cholesterol',    () => [hex('ik', 20, 36, 9, 2), hex('ik', 32, 30, 9, 2), hex('ik', 44, 34, 9, 2),
                             P('M48 26 L56 22', 'ik') && S('M48 28 L56 22', 'ik', 2)]);
def('vesicle',        () => [ring('bs', 30, 32, 20, 3), ring('bs', 30, 32, 14, 3),
                             E(30, 32, 11, 11, 'ground')]);                          // a bilayer, and nothing inside
def('primordial_soup',() => [wave('lo', 46, 6, 24), wave('bs', 38, 5, 22),
                             ...granules('hi', 9, 43, [14, 20, 46, 36]),
                             bolt('hi', 40, 8, .6)]);                                // and the spark above it
def('protocell',      () => [ring('bs', 30, 32, 19, 3),
                             S('M22 26 Q34 34 24 42', 'hi', 2.4),                    // something replicating inside
                             ...granules('lo', 4, 29, [22, 24, 40, 42])]);
def('cytoplasm',      () => [ring('lo', 30, 32, 20, 2.6), E(30, 32, 16, 16, 'gh'),
                             ...granules('bs', 8, 15, [18, 20, 42, 44])]);
def('virus',          () => [...Array.from({ length: 6 }, (_, i) =>
                               ['g', i * 60, 30, 28, [S('M30 44 L30 54', 'ik', 2.2), C(30, 55, 2.4, 'ik')]]),
                             P('M30 12 L45 21 L45 37 L30 46 L15 37 L15 21 Z', 'bs'),
                             S('M30 12 L45 21 L45 37 L30 46 L15 37 L15 21 Z', 'ik', 2)]);   // a capsid, and its legs
def('methane',        () => [C(30, 32, 8, 'ik'),
                             ...[[30, 12], [13, 42], [47, 42], [30, 52]].map(([x, y]) =>
                               [S(`M30 32 L${x} ${y}`, 'ik', 1.8), C(x, y, 4, 'hi')]).flat()]);
def('glycogen',       () => [C(30, 32, 6, 'bs'),
                             ...Array.from({ length: 6 }, (_, i) =>
                               ['g', i * 60, 30, 32, [S('M30 26 L30 16', 'hi', 2),
                                                      C(30, 13, 4, 'hi'),
                                                      S('M30 13 L24 6', 'hi', 1.4), S('M30 13 L36 6', 'hi', 1.4)]])]);
def('binary_fission', () => [E(18, 32, 12, 13, 'bs'), E(42, 32, 12, 13, 'bs'),
                             S('M30 18 L30 46', 'ground', 3)]);                      // one becoming two
def('budding',        () => [C(26, 36, 15, 'bs'), C(44, 20, 8, 'hi'),
                             S('M36 27 L38 25', 'lo', 2)]);
def('cutting',        () => [S('M30 52 L30 14', 'lo', 3.4),
                             leaf('hi', 20, 22, .7, -35), leaf('hi', 40, 26, .7, 35),
                             ...[[26, 50], [34, 50]].map(([x, y]) => S(`M${x} ${y} L${x < 30 ? 20 : 40} 56`, 'bs', 1.8))]);  // new roots
def('tuber',          () => [E(30, 38, 19, 13, 'lo'), ...granules('bs', 5, 57, [18, 32, 42, 44]),
                             S('M22 27 Q24 18 20 10', 'hi', 2.2), S('M38 27 Q36 18 40 10', 'hi', 2.2)]);
// A true elongated root, tapered top to tip — deliberately not the round
// tuber silhouette potato/tuber already use, since cassava is genuinely a
// root, not a modified stem the way those are.
def('cassava',         () => [E(30, 32, 8, 22, 'bs'), E(30, 50, 4, 8, 'lo'),
                             S('M24 16 Q22 10 18 8', 'hi', 2), S('M36 16 Q38 10 42 8', 'hi', 2),
                             ...[22, 27, 33, 38].map(y => S(`M23 ${y} L37 ${y}`, 'lo', 1.4))]);
def('tapioca',         () => [24, 34, 30, 20, 38].flatMap((x, i) =>
                             [E(x, 34 + (i % 2) * 10, 5, 5, i % 2 ? 'lo' : 'hi')]));
def('runner',         () => [S('M8 40 Q30 30 52 40', 'hi', 3),
                             ...[[8, 40], [52, 40]].map(([x, y]) =>
                               [leaf('hi', x, y - 12, .6, 0), S(`M${x} ${y} L${x} ${y + 8}`, 'lo', 2)]).flat()]);


/* plants: plumbing, not produce ─────────────────────────────────────────
   The tier is built on how a plant WORKS, so the drawings are anatomy —
   two pipes running opposite ways, a pore that opens at night, wood with
   vessels against wood without. */
def('xylem',   () => [...[20, 30, 40].map(x => [S(`M${x} 8 L${x} 54`, 'gh', 5), S(`M${x} 8 L${x} 54`, 'ground', 2)]).flat(),
                      ...[[20, 18], [30, 30], [40, 22]].map(([x, y]) => P(`M${x - 3} ${y} L${x + 3} ${y} L${x} ${y - 6} Z`, 'hi'))]);  // water going up
def('phloem',  () => [...[24, 36].map(x => S(`M${x} 8 L${x} 54`, 'bs', 6)),
                      ...[[24, 44], [36, 36]].map(([x, y]) => P(`M${x - 3} ${y} L${x + 3} ${y} L${x} ${y + 6} Z`, 'hi'))]);          // sugar coming down
def('sap',     () => [S('M14 10 L14 40', 'lo', 4),
                      P('M14 40 Q20 48 20 52 A6 6 0 0 1 8 52 Q8 48 14 40 Z', 'hi'),
                      C(38, 24, 3, 'hi'), C(44, 36, 2.4, 'hi')]);
def('bark',    () => [P('M14 8 L46 8 L46 54 L14 54 Z', 'lo'),
                      ...[20, 27, 34, 41].map((y, i) => S(`M${16 + (i % 2) * 3} ${y * 1.1} Q30 ${y * 1.1 - 4} ${44 - (i % 2) * 3} ${y * 1.1}`, 'ik', 2))]);
def('cork',    () => [P('M18 12 L42 12 L42 50 L18 50 Z', 'bs'),
                      ...granules('ground', 20, 61, [21, 15, 39, 47])]);          // dead air cells
def('lignin',  () => [hex('ik', 20, 24, 9, 2.2), hex('ik', 38, 32, 9, 2.2), hex('ik', 24, 44, 9, 2.2),
                      S('M27 27 L31 29', 'ik', 2), S('M33 39 L28 41', 'ik', 2)]);
def('stoma',   () => [E(30, 32, 20, 15, 'hi'),
                      P('M18 32 Q30 20 42 32 Q30 44 18 32 Z', 'ground'),
                      S('M18 32 Q30 20 42 32', 'lo', 2.6), S('M18 32 Q30 44 42 32', 'lo', 2.6)]);   // two guard cells and the gap
def('cactus',  () => [P('M24 54 L24 20 A6 6 0 0 1 36 20 L36 54 Z', 'bs'),
                      P('M12 40 L12 30 A5 5 0 0 1 22 30 L22 40 Z', 'bs'),
                      ...needles('hi', 5)]);
def('malic_acid', () => [(() => backbone('ik', 3, 30, 32).shape)(),
                         C(13, 28, 4.4, 'bs'), C(47, 28, 4.4, 'bs'), C(30, 46, 4, 'hi')]);
def('hardwood', () => [P('M12 12 L48 12 L48 50 L12 50 Z', 'lo'),
                       ...[[20, 22], [34, 20], [26, 34], [40, 38], [18, 42]].map(([x, y]) => C(x, y, 4, 'ground')),
                       ...[16, 30, 44].map(x => S(`M${x} 12 L${x} 50`, 'bs', 1.2))]);   // vessels: the pores you can see
def('softwood', () => [P('M12 12 L48 12 L48 50 L12 50 Z', 'hi'),
                       ...[17, 23, 29, 35, 41, 47].map(x => S(`M${x} 12 L${x} 50`, 'bs', 1.6))]);   // tracheids, and no pores
def('oak',     () => [S('M30 54 L30 34', 'ik', 5),
                      P('M10 30 Q10 12 30 10 Q50 12 50 30 Q42 40 30 38 Q18 40 10 30 Z', 'bs'),
                      E(24, 46, 4, 5, 'lo'), E(24, 41, 4, 2.4, 'ik')]);              // and an acorn
def('pine',    () => [S('M30 54 L30 44', 'ik', 4),
                      ...[0, 1, 2].map(i => P(`M30 ${8 + i * 12} L${44 - i * 2} ${26 + i * 12} L${16 + i * 2} ${26 + i * 12} Z`, 'bs')),
                      ...[[16, 44], [44, 44]].map(([x, y]) => E(x, y, 4, 6, 'lo'))]);
def('bamboo',  () => [...[22, 38].map(x => [P(`M${x - 6} 6 L${x + 6} 6 L${x + 6} 54 L${x - 6} 54 Z`, 'hi'),
                        ...[18, 32, 46].map(y => S(`M${x - 6} ${y} L${x + 6} ${y}`, 'ik', 2.4))]).flat()]);
def('coconut', () => [C(30, 34, 18, 'ik'), C(30, 34, 13, 'hi'),
                      ...[[24, 26], [36, 26], [30, 20]].map(([x, y]) => C(x, y, 3, 'lo'))]);   // the three pores
def('coconut_water', () => [C(30, 34, 18, 'ik'), P('M14 34 A18 18 0 0 0 46 34 Z', 'bs'),
                            E(30, 34, 16, 3, 'hi')]);
def('mangrove', () => [S('M30 8 L30 30', 'lo', 4),
                       ...[-16, -8, 8, 16].map(dx => S(`M30 26 Q${30 + dx} 38 ${30 + dx * 1.4} 52`, 'lo', 2.6)),
                       wave('bs', 46, 4, 26)]);                                        // stilt roots in water
def('bast_fibre', () => [...[16, 24, 32, 40, 46].map((x, i) =>
                           S(`M${x} 6 Q${x + (i % 2 ? 4 : -4)} 30 ${x} 54`, i % 2 ? 'hi' : 'bs', 3))]);
def('sugar_beet', () => [P('M20 18 Q20 44 30 54 Q40 44 40 18 Z', 'hi'),
                         ...[24, 30, 36].map(x => S(`M${x} 18 L${x} 6`, 'lo', 2.4)),
                         S('M25 28 Q30 32 35 28', 'lo', 1.4)]);
def('rubber_tree', () => [S('M30 54 L30 12', 'lo', 6),
                          ...[0, 1, 2].map(i => S(`M${22 - i * 2} ${20 + i * 8} L38 ${26 + i * 8}`, 'ik', 2)),
                          P('M38 42 Q43 50 43 54 A5 5 0 0 1 33 54 Q33 50 38 42 Z', 'hi')]);   // the tapping cuts
def('mulberry', () => [...[[22, 26], [38, 24], [30, 40]].map(([x, y]) =>
                         [C(x, y, 4, 'bs'), C(x - 4, y + 3, 3.4, 'bs'), C(x + 4, y + 3, 3.4, 'bs'),
                          C(x, y + 6, 3.4, 'bs')]).flat(),
                       leaf('hi', 46, 44, .7, 30)]);
def('willow',  () => [S('M30 54 L30 20', 'lo', 5),
                      ...[-14, -6, 6, 14].map(dx => S(`M${30 + dx * .4} 22 Q${30 + dx} 34 ${30 + dx * 1.2} 52`, 'hi', 2))]);
def('salicin', () => [hex('ik', 22, 30, 11, 2.2), P('M34 26 L46 22 L48 34 L36 38 Z', 'hi'),
                      C(14, 22, 4, 'bs')]);
def('winter_wheat', () => [stalk('lo', 30, 54, 20),
                           ...[[24, 20], [36, 20], [24, 28], [36, 28]].map(([x, y]) => grain('hi', x, y, .8, x < 30 ? -25 : 25)),
                           ...[[14, 44], [46, 44]].map(([x, y]) =>
                             [S(`M${x - 4} ${y} L${x + 4} ${y}`, 'gh', 1.8), S(`M${x} ${y - 4} L${x} ${y + 4}`, 'gh', 1.8)])
                             .flat()]);                                                 // it needs the cold first
def('semi_dwarf_wheat', () => [stalk('lo', 30, 54, 32),
                               ...[[25, 26], [35, 26], [25, 34], [35, 34]].map(([x, y]) => grain('hi', x, y, .9, x < 30 ? -25 : 25)),
                               S('M12 54 L48 54', 'ik', 2)]);                            // short straw, heavy head
def('gibberellin', () => [(() => backbone('ik', 4, 28, 28).shape)(),
                          hex('ik', 40, 40, 9, 2), C(14, 24, 4, 'bs')]);
def('phytochrome', () => [C(22, 32, 11, 'bs'), C(40, 32, 11, 'hi'),
                          S('M31 32 L31 32', 'ik', 2), S('M28 22 L34 42', 'ik', 2.4)]);  // two forms, switched by light
def('graft',   () => [S('M30 54 L30 32', 'lo', 6), S('M30 30 L30 8', 'bs', 5),
                      S('M20 31 L40 31', 'ik', 3),
                      leaf('hi', 40, 16, .6, 30)]);
def('foxglove',() => [S('M26 54 L26 10', 'lo', 3),
                      ...[16, 26, 36, 44].map((y, i) => ['g', 20, 34, y, [E(34, y, 8, 6, i % 2 ? 'bs' : 'hi')]])]);
def('digoxin', () => [...[[20, 34], [32, 30], [44, 34]].map(([x, y]) => hex('ik', x, y, 8, 2)),
                      P('M20 44 L28 48 L24 56 L16 52 Z', 'bs')]);
def('salicylic_acid', () => [hex('ik', 22, 32, 11, 2.2),
                      S('M31 25 L40 20', 'ik', 2), C(40, 20, 4, 'bs'),
                      ...double([40, 20], [48, 24], 'ik'), C(48, 24, 3.2, 'hi'),   // the -COOH, untouched
                      S('M31 39 L40 44', 'ik', 2), C(40, 44, 3.6, 'hi')]);         // the free -OH
def('aspirin', () => [hex('ik', 18, 30, 10, 2.2),
                      S('M26 24 L34 20', 'ik', 2), C(34, 20, 3.6, 'bs'),
                      ...double([34, 20], [42, 24], 'ik'), C(42, 24, 3, 'hi'),     // the -COOH, still there
                      S('M26 36 L34 42', 'ik', 2), C(34, 42, 3.2, 'hi'),           // the ester oxygen
                      S('M34 42 L42 46', 'ik', 1.8),
                      ...double([42, 46], [48, 42], 'ik'), C(48, 42, 3, 'bs'),     // the acetyl carbonyl
                      S('M42 46 L40 54', 'ik', 1.8), C(40, 54, 2.8, 'lo')]);       // the methyl cap
def('streptomyces', () => [S('M10 46 Q18 30 12 20 Q20 10 32 14 Q46 18 40 32 Q34 44 48 48', 'bs', 3),
                      ...[[12, 42], [14, 28], [20, 16], [32, 14], [42, 22], [38, 34], [46, 46]]
                        .map(([x, y]) => C(x, y, 2.6, 'hi'))]);                    // a spore chain, not a brush
def('streptomycin', () => [hex('ik', 16, 26, 8, 2), hex('ik', 32, 36, 8, 2), hex('ik', 46, 22, 8, 2),
                      S('M23 29 L26 32', 'ik', 1.8), S('M39 32 L40 27', 'ik', 1.8),
                      C(10, 20, 3, CPK.N), C(52, 15, 3, CPK.N)]);                  // the amino sugars, picked out
def('pancreas', () => [P('M9 30 Q9 22 19 22 L44 17 Q53 17 53 26 Q53 35 44 34 L19 39 Q9 39 9 30 Z', 'bs'),
                      S('M13 30 Q30 26 49 23', 'lo', 1.6),                        // the duct
                      ...[[20, 28], [30, 25], [40, 27]].map(([x, y]) => C(x, y, 2.2, 'hi'))]); // islets
def('insulin', () => [backbone('ik', 3, 20, 20).shape, backbone('ik', 4, 24, 42).shape,
                      S('M17 22 L17 39', 'hi', 2), S('M29 20 L31 40', 'hi', 2),   // two interchain bonds
                      S('M12 16 Q8 20 12 24', 'lo', 1.6)]);                       // and one closing the A chain
def('capsicum',() => [P('M22 16 Q10 26 14 40 Q18 52 30 52 Q42 52 46 40 Q50 26 38 16 Z', 'bs'),
                      S('M30 16 L30 6', 'lo', 3), E(30, 14, 8, 3, 'lo'),
                      S('M22 26 Q26 38 22 46', 'hi', 1.6)]);
def('paprika', () => [mound('bs', 46, 19, 17), ...granules('lo', 12, 73, [16, 32, 44, 46]),
                      E(30, 24, 5, 2.4, 'hi')]);
def('pectin',  () => [...[0, 1, 2].map(i => (() => backbone('ik', 3, 30, 18 + i * 14).shape)()),
                      ...[[18, 25], [42, 25], [18, 39], [42, 39]].map(([x, y]) => C(x, y, 3, 'hi'))]);   // chains, cross-linked

/* what an animal gives besides meat ─────────────────────────────────────*/
def('lanolin', () => [E(30, 38, 18, 11, 'hi'), E(24, 34, 6, 3, 'gh'),
                      ...[[20, 22], [32, 18], [42, 24]].map(([x, y]) => S(`M${x} ${y} Q${x + 3} ${y + 6} ${x} ${y + 11}`, 'lo', 2.4))]);
def('tallow',  () => [P('M16 46 L44 46 L44 26 Q30 18 16 26 Z', 'hi'), S('M16 26 Q30 18 44 26', 'gh', 2),
                      E(30, 46, 14, 3, 'lo')]);
def('horn',    () => [P('M14 52 Q16 24 40 10 Q34 30 30 52 Z', 'gh'),
                      ...[22, 32, 42].map(y => S(`M${16 + (52 - y) * .3} ${y} Q26 ${y - 3} ${32 - (52 - y) * .1} ${y}`, 'lo', 1.6))]);
def('antler',  () => [S('M28 54 L26 30', 'gh', 4.4),
                      ...[[26, 30, 12, 14], [26, 36, 44, 20], [26, 44, 46, 38]].map(([a, b, c2, d]) => S(`M${a} ${b} L${c2} ${d}`, 'gh', 3.4)),
                      S('M12 14 L8 6', 'gh', 2.4), S('M44 20 L50 10', 'gh', 2.4)]);
def('feather', () => [S('M42 8 L18 52', 'ik', 2.4),
                      ...Array.from({ length: 9 }, (_, i) =>
                        S(`M${40 - i * 2.6} ${12 + i * 4.6} L${52 - i * 2.6} ${16 + i * 4.6}`, 'hi', 2)),
                      ...Array.from({ length: 9 }, (_, i) =>
                        S(`M${40 - i * 2.6} ${12 + i * 4.6} L${30 - i * 2.6} ${6 + i * 4.6}`, 'hi', 2))]);
def('down',    () => [C(30, 34, 4, 'ik'),
                      ...Array.from({ length: 14 }, (_, i) =>
                        ['g', i * 26, 30, 34, [S('M30 30 Q28 18 30 6', 'hi', 1.4)]])]);       // no hooks, so it traps air
def('oyster',  () => [P('M10 34 Q14 16 30 14 Q48 16 50 34 Q40 46 30 46 Q18 46 10 34 Z', 'lo'),
                      ...[0, 1, 2, 3].map(i => S(`M${14 + i * 5} ${30 + i * 2} Q30 ${18 + i * 4} ${46 - i * 5} ${30 + i * 2}`, 'ground', 1.4))]);
def('nacre',   () => [...[0, 1, 2, 3, 4].map(i =>
                        P(`M${10 + i} ${18 + i * 7} L${50 - i} ${14 + i * 7} L${50 - i} ${20 + i * 7} L${10 + i} ${24 + i * 7} Z`,
                          i % 2 ? 'hi' : 'gh'))]);                                            // sheets, and the colour is the sheets
def('pearl',   () => [C(30, 32, 17, 'gh'), C(23, 25, 6, 'hi'), ring('lo', 30, 32, 12, 1)]);
def('lac_insect', () => [S('M8 44 Q30 40 52 44', 'lo', 5),
                         ...[[20, 36], [32, 34], [42, 37]].map(([x, y]) => [E(x, y, 6, 4.4, 'bs'), C(x + 5, y - 1, 1.6, 'ik')]).flat()]);
def('shellac', () => [...flakes('bs', 4), E(30, 46, 15, 4, 'lo')]);
def('cochineal', () => [E(30, 32, 13, 9, 'gh'),
                        ...[20, 27, 34, 40].map(x => S(`M${x} 24 L${x} 40`, 'lo', 1.4)),
                        ...[[16, 24], [44, 24], [16, 40], [44, 40]].map(([x, y]) => S(`M${x} ${y} L${x < 30 ? 8 : 52} ${y < 32 ? 18 : 46}`, 'ik', 1.4))]);
def('carmine', () => [mound('bs', 46, 18, 17), ...granules('lo', 8, 111, [18, 34, 42, 46]),
                      C(44, 20, 4, 'bs')]);
def('rennet',  () => [vessel('gh', 24, 48), P('M18 32 L42 32 L41 46 Q30 49 19 46 Z', 'hi'),
                      ...[[24, 38], [34, 40]].map(([x, y]) => C(x, y, 3, 'lo'))]);
def('whey',    () => [vessel('gh', 22, 48), P('M16 34 L44 34 L43 46 Q30 49 17 46 Z', 'hi'),
                      E(30, 34, 14, 3, 'ground'), C(24, 40, 2, 'lo')]);
def('ricotta', () => [mound('hi', 46, 20, 19), ...granules('gh', 10, 23, [16, 32, 44, 46])]);
def('swim_bladder', () => [E(30, 30, 13, 19, 'gh'), S('M30 12 L30 48', 'lo', 1.6),
                           C(30, 52, 3, 'lo')]);
def('isinglass', () => [...[0, 1, 2].map(i => P(`M${14 + i * 3} ${16 + i * 12} L${46 - i * 3} ${12 + i * 12} L${46 - i * 3} ${20 + i * 12} L${14 + i * 3} ${24 + i * 12} Z`, 'gh'))]);
def('roe',     () => [...[[22, 26], [34, 24], [28, 36], [40, 34], [20, 40], [42, 44], [31, 48]]
                        .map(([x, y]) => [C(x, y, 6, 'bs'), C(x - 2, y - 2, 2, 'hi')]).flat()]);
def('whale',   () => [P('M6 34 Q18 20 36 24 Q50 27 54 34 Q50 41 36 44 Q18 48 6 34 Z', 'lo'),
                      P('M36 24 L44 12 L46 26 Z', 'lo'), C(14, 31, 2, 'ground'),
                      S('M8 30 Q10 22 8 18', 'hi', 2)]);
def('baleen',  () => [S('M10 14 L50 14', 'ik', 3),
                      ...Array.from({ length: 11 }, (_, i) => S(`M${12 + i * 3.6} 14 L${12 + i * 3.6} ${44 - (i % 3) * 4}`, 'gh', 2))]);
def('ambergris', () => [lump('lo', 30, 34, 19, 15), ...granules('ik', 7, 87, [18, 24, 42, 44]),
                        S('M18 22 Q30 16 42 22', 'hi', 1.6)]);
def('ox',      () => [P('M14 44 Q14 28 30 28 Q46 28 46 44 Z', 'ik'),
                      ...[20, 40].map(x => S(`M${x} 44 L${x} 54`, 'ik', 3)),
                      S('M18 28 Q12 18 20 14', 'lo', 3), S('M42 28 Q48 18 40 14', 'lo', 3),
                      S('M20 22 L40 22', 'gh', 3.4)]);                                    // and the yoke
def('manure',  () => [mound('ik', 48, 20, 18), ...granules('lo', 8, 33, [16, 34, 44, 48]),
                      ...[24, 34].map(x => S(`M${x} 26 Q${x - 3} 18 ${x} 12`, 'gh', 1.8))]);
def('parchment', () => [P('M12 10 Q12 30 12 50 L48 50 Q48 30 48 10 Z', 'gh'),
                        S('M12 10 Q30 16 48 10', 'lo', 2),
                        ...[24, 32, 40].map(y => S(`M18 ${y} L42 ${y}`, 'lo', 1.2))]);
def('sinew',   () => [...[0, 1, 2].map(i => S(`M${16 + i * 6} 8 Q${22 + i * 6} 32 ${16 + i * 6} 56`, i === 1 ? 'hi' : 'gh', 4))]);
def('ivory',   () => [P('M12 50 Q14 22 40 8 Q34 28 30 52 Z', 'gh'),
                      ...[26, 36, 46].map(y => S(`M${14 + (52 - y) * .25} ${y} Q24 ${y - 4} ${30 - (52 - y) * .06} ${y}`, 'lo', 1.2))]);
def('royal_jelly', () => [P('M18 22 L42 22 L40 46 Q30 50 20 46 Z', 'gh'),
                          P('M20 30 L40 30 L39 45 Q30 48 21 45 Z', 'hi'),
                          C(30, 16, 4, 'lo')]);

/* the named cultures, and what they make ────────────────────────────────
   Cocci are round, bacilli are rods, bifidobacteria fork — the shapes are
   the taxonomy, and one of them is literally in the name. */
const cocci = (r, pts) => pts.map(([x, y]) => C(x, y, 6.4, r));
def('s_thermophilus', () => [...cocci('bs', [[16, 32], [28, 32], [40, 32], [50, 32]]),
                             ...[20, 42].map(y => S(`M10 ${y} L54 ${y}`, 'hi', 1.2))]);   // a chain of cocci, and it likes it hot
def('l_bulgaricus',   () => [rod3('hi', 22, 22, 13, 5), rod3('hi', 34, 38, 13, 5),
                             S('M10 50 L50 50', 'lo', 1.6)]);
def('l_acidophilus',  () => [rod3('lo', 30, 24, 15, 5), rod3('lo', 26, 40, 12, 5),
                             ...[[48, 46], [52, 38]].map(([x, y]) => C(x, y, 2.4, 'bs'))]);
def('bifidobacterium',() => [S('M20 52 L20 30', 'bs', 6), S('M20 32 L12 16', 'bs', 6), S('M20 32 L30 16', 'bs', 6),
                             S('M42 52 L42 34', 'bs', 6), S('M42 36 L34 24', 'bs', 6), S('M42 36 L50 24', 'bs', 6)]);  // bifid: it forks
def('l_paracasei',    () => [rod3('bs', 24, 30, 12, 4.4), rod3('bs', 38, 42, 10, 4),
                             C(44, 18, 3, 'hi')]);
def('l_plantarum',    () => [rod3('hi', 28, 34, 14, 5),
                             leaf('lo', 44, 18, .7, 30), leaf('lo', 16, 50, .6, -30)]);   // it comes off plants
def('leuconostoc',    () => [...cocci('lo', [[22, 26], [34, 26], [24, 40], [38, 40]]),
                             ...[[46, 18], [50, 30], [44, 48]].map(([x, y]) => C(x, y, 2.4, 'hi'))]);   // and the CO2 it gives off
def('lactococcus',    () => [...cocci('hi', [[24, 28], [36, 28]]), ...cocci('hi', [[24, 42], [36, 42]])]);
def('acetobacter',    () => [rod3('ik', 26, 28, 12, 4.4), rod3('ik', 34, 42, 12, 4.4),
                             ...[[14, 16], [46, 16]].map(([x, y]) => C(x, y, 3, 'bs'))]);   // it needs the air
def('penicillium',    () => [S('M30 54 L30 30', 'gh', 3),
                             ...[[18, 20], [30, 14], [42, 20]].map(([x, y]) =>
                               [S(`M30 30 L${x} ${y}`, 'gh', 2), C(x, y, 3.4, 'lo'),
                                C(x - 4, y - 5, 3, 'lo'), C(x + 4, y - 5, 3, 'lo')]).flat()]);   // the brush it is named for
def('koji',           () => [...granules('hi', 14, 41, [14, 30, 46, 50]),
                             ...[[22, 22], [38, 20]].map(([x, y]) =>
                               [S(`M${x} 34 L${x} ${y}`, 'gh', 2), C(x, y, 4, 'gh')]).flat()]);   // mould on steamed rice
def('kefir_grains',   () => [...[[22, 26], [38, 24], [28, 40], [42, 42]].map(([x, y]) =>
                               [E(x, y, 9, 7, 'gh'), C(x - 3, y - 2, 2.4, 'bs'), C(x + 3, y + 2, 2.4, 'hi')]).flat()]);  // bacteria AND yeast
def('yoghurt_culture',() => [...cocci('bs', [[18, 24], [30, 22]]), rod3('hi', 34, 40, 12, 4.4),
                             S('M24 30 Q30 34 34 36', 'ik', 1.6)]);                        // the two that need each other
def('starter_culture',() => [vessel('gh', 24, 48), P('M18 32 L42 32 L41 46 Q30 49 19 46 Z', 'hi'),
                             ...cocci('bs', [[24, 38], [34, 40]])]);
def('lactic_acid',    () => [(() => backbone('ik', 2, 28, 32).shape)(),
                             C(12, 28, 4.4, 'bs'), C(44, 36, 4.4, 'hi')]);
def('acetic_acid',    () => [C(22, 34, 6.4, 'ik'), C(38, 30, 6, 'bs'),
                             ...double([38, 30], [48, 22], 'ik'), C(48, 22, 4, 'hi'),
                             S('M22 34 L12 42', 'ik', 1.8)]);
def('pasteurised_milk', () => [vessel('gh', 22, 48), P('M16 30 L44 30 L43 46 Q30 49 17 46 Z', 'hi'),
                               E(30, 30, 14, 3, 'ground'),
                               ...[22, 32, 42].map(x => S(`M${x} 22 Q${x - 3} 16 ${x} 10`, 'lo', 1.8))]);   // it was heated
def('souring_kraut',  () => [vessel('lo', 22, 48), ...[34, 40].map(y => S(`M18 ${y} Q30 ${y - 3} 42 ${y}`, 'hi', 3)),
                             ...[[24, 26], [36, 24]].map(([x, y]) => C(x, y, 2.4, 'gh'))]);   // still bubbling
def('kefir',          () => [vessel('gh', 22, 48), P('M16 30 L44 30 L43 46 Q30 49 17 46 Z', 'hi'),
                             ...[[22, 36], [32, 40], [39, 34]].map(([x, y]) => C(x, y, 3, 'lo')),
                             ...[[26, 22], [36, 20]].map(([x, y]) => C(x, y, 2, 'gh'))]);
// Whey is the thin liquid drained OFF; buttermilk is what is left in the churn.
// Drawn as the two different vessels they actually come out of.
def('buttermilk',     () => [P('M20 12 L40 12 L44 44 Q44 52 30 52 Q16 52 16 44 Z', 'gh'),
                             P('M17 30 L43 30 L44 44 Q44 52 30 52 Q16 52 16 44 Z', 'hi'),
                             S('M20 12 L40 12', 'lo', 2.4),
                             ...[[25, 38], [35, 41]].map(([x, y]) => C(x, y, 2.6, 'lo'))]);
def('miso',           () => [P('M14 26 Q14 46 30 50 Q46 46 46 26 Z', 'ik'),
                             E(30, 26, 16, 5, 'lo'), ...granules('bs', 6, 19, [20, 30, 40, 44])]);
def('camembert',      () => [E(30, 36, 20, 12, 'gh'), E(30, 30, 20, 12, 'hi'),
                             ...granules('gh', 9, 55, [16, 24, 44, 36])]);                    // the bloomy rind


/* the named meats ───────────────────────────────────────────────────────
   Cuts, not animals — the animal already has a card. What separates them is
   the muscle: a worked one is dark and full of connective tissue, a lazy one
   is pale and tender, and that is the whole of butchery in one picture. */
const cut = (r, marb, seed) => [
  P('M12 20 Q12 12 22 12 L44 14 Q50 20 48 32 Q46 44 34 46 L20 46 Q12 42 12 32 Z', r),
  ...granules('hi', marb, seed, [18, 18, 44, 42]),
];
def('beef',    () => [...cut('bs', 9, 7), P('M40 14 Q50 20 48 32 L42 30 Q42 20 38 16 Z', 'hi')]);   // and its fat cap
def('pork',    () => [...cut('hi', 5, 21), S('M14 42 Q30 48 46 40', 'lo', 3)]);                     // paler, and the rind
def('mutton',  () => [...cut('lo', 4, 33), S('M20 20 Q30 30 24 44', 'ik', 2)]);                     // dark, and sinewy
def('lamb',    () => [...cut('bs', 6, 41), C(44, 40, 5, 'gh')]);                                    // smaller, with the bone
def('venison', () => [...cut('ik', 3, 55), S('M18 18 L26 12', 'gh', 2.4), S('M26 12 L22 6', 'gh', 2)]);  // leanest, and antlered
def('veal',    () => [...cut('gh', 3, 63), S('M16 40 Q30 44 44 38', 'hi', 2.4)]);
def('calf',    () => [E(30, 34, 15, 11, 'hi'), C(18, 26, 7, 'hi'),
                      ...[24, 36].map(x => S(`M${x} 44 L${x} 52`, 'lo', 3)),
                      C(14, 23, 1.6, 'ik'), S('M12 28 Q8 30 10 34', 'lo', 2)]);
def('poultry', () => [P('M18 44 Q14 28 26 22 Q40 16 44 28 Q46 42 34 46 Z', 'hi'),
                      S('M40 24 L50 14', 'gh', 4), C(50, 12, 3.4, 'gh')]);                          // a drumstick
def('game',    () => [...cut('ik', 3, 71), S('M40 16 L48 8', 'gh', 2.4), S('M44 12 L52 14', 'gh', 2),
                      ...granules('lo', 3, 13, [16, 34, 34, 44])]);
def('steak',   () => [E(30, 32, 20, 14, 'bs'), ...granules('hi', 11, 5, [14, 22, 46, 42]),
                      S('M12 32 Q30 26 48 32', 'lo', 1.4)]);
def('aged_beef', () => [E(30, 32, 19, 13, 'ik'), P('M11 32 A19 13 0 0 1 49 32 Z', 'lo'),
                        ...granules('bs', 7, 29, [16, 24, 44, 40])]);                               // the dark crust
def('ham',     () => [P('M16 40 Q12 22 26 16 Q42 10 46 26 Q50 42 34 48 Q22 50 16 40 Z', 'bs'),
                      S('M20 44 L14 52', 'gh', 4), ...granules('hi', 5, 47, [22, 22, 42, 40])]);
def('stew',    () => [P('M12 28 Q12 46 30 50 Q48 46 48 28 Z', 'lo'), E(30, 28, 18, 5, 'ik'),
                      ...[[24, 34], [36, 32], [30, 42]].map(([x, y]) => C(x, y, 4.4, 'bs')),
                      ...[24, 36].map(x => S(`M${x} 20 Q${x - 3} 14 ${x} 8`, 'hi', 1.8))]);

/* what a packet is actually full of ─────────────────────────────────────
   Gums are drawn as what they gel, colours as the colour they give, and the
   E-number preservatives as the crystal or powder they arrive as. */
def('carob',      () => [P('M14 12 Q22 32 18 50', 'lo') && S('M14 12 Q22 32 18 50', 'lo', 7),
                         ...[[18, 20], [19, 30], [18, 40]].map(([x, y]) => C(x, y, 3.4, 'ik')),
                         leaf('hi', 40, 24, .8, 30)]);
def('locust_bean_gum', () => [mound('hi', 46, 18, 16), ...granules('lo', 7, 3, [18, 34, 42, 46]),
                              C(44, 18, 4, 'ik')]);
def('guar_gum',   () => [mound('gh', 46, 18, 16), ...granules('hi', 9, 91, [18, 34, 42, 46]),
                         E(30, 22, 6, 3, 'lo')]);
def('xanthan_gum',() => [rod3('bs', 24, 20, 10, 4),                                    // the bacterium that makes it
                         P('M14 34 Q30 28 46 34 Q46 46 30 48 Q14 46 14 34 Z', 'hi')]);
def('red_alga',   () => [...[0, 1, 2].map(i => S(`M${20 + i * 10} 52 Q${14 + i * 10} 32 ${22 + i * 10} 10`, 'bs', 3.4)),
                         ...[[22, 26], [34, 20], [42, 32]].map(([x, y]) => E(x, y, 5, 3, 'lo'))]);
def('carrageenan',() => [E(30, 34, 19, 13, 'gh'), S('M14 30 Q30 24 46 30', 'hi', 2),
                         ...granules('bs', 4, 17, [20, 30, 40, 40])]);
def('agar',       () => [P('M10 26 L50 26 L50 44 L10 44 Z', 'gh'), E(30, 26, 20, 4, 'hi'),
                         ...[[22, 34], [38, 36]].map(([x, y]) => C(x, y, 3, 'lo'))]);   // a plate of it
def('alginate',   () => [...[[20, 26], [34, 22], [28, 38], [42, 40]].map(([x, y]) =>
                           [C(x, y, 7, 'gh'), C(x - 2, y - 2, 2.4, 'hi')]).flat()]);    // beads
def('gum_arabic', () => [P('M18 14 L38 12 L42 30 L34 30 Q34 44 26 44 Q18 44 18 30 Z', 'lo'),
                         C(26, 38, 5, 'hi')]);                                          // bark wound, one hardened tear
def('arrowroot', () => [mound('gh', 46, 20, 15), ...granules('hi', 8, 41, [16, 32, 44, 46]),
                        S('M30 16 Q22 24 26 34', 'lo', 2)]);                             // fine powder, one rhizome curl
def('gellan_gum', () => [rod3('bs', 24, 20, 10, 4), E(30, 42, 16, 7, 'hi'), S('M18 42 L42 42', 'ik', 1.4)]);
                                                                                          // the bacterium, and a stiff thin sheet
def('citric_acid',() => [(() => backbone('ik', 3, 28, 30).shape)(),
                         C(12, 26, 4.4, 'bs'), C(44, 26, 4.4, 'bs'), C(30, 46, 4.4, 'bs'),
                         ...granules('hi', 4, 61, [18, 40, 42, 50])]);
def('sodium_acetate', () => [...prisms('gh', 3), ...granules('hi', 4, 23, [18, 30, 42, 44])]);
def('msg',        () => [...[[20, 24], [32, 20], [26, 36], [40, 34], [30, 46]].map(([x, y]) =>
                           P(`M${x - 6} ${y} L${x} ${y - 5} L${x + 6} ${y} L${x} ${y + 5} Z`, 'gh'))]);  // the crystal
def('inosinate',  () => [...purine('gh'), C(46, 46, 5, 'bs'), S('M40 40 L44 44', 'ik', 2)]);
def('guanylate',  () => [...purine('hi'), C(14, 46, 5, 'bs'), S('M20 40 L16 44', 'ik', 2)]);
def('ribonucleotides', () => [...purine('gh'), ...pyrimidine('hi').map(function(){return null}).filter(Boolean),
                              hex('hi', 44, 44, 9, 2.2), C(12, 20, 4, 'bs')]);
def('maltodextrin', () => [(() => backbone('ik', 5, 30, 24).shape)(),
                           ...[[16, 40], [30, 44], [44, 40]].map(([x, y]) => C(x, y, 5, 'hi')),
                           ...granules('gh', 5, 77, [18, 46, 42, 54])]);
def('hydrolysed_vegetable_protein', () => [S('M8 20 L52 20', 'lo', 3.4),
                                           ...[16, 26, 36, 46].map(x => C(x, 34, 5.4, 'bs')),
                                           ...[21, 31, 41].map(x => S(`M${x} 30 L${x} 38`, 'ground', 2.4))]);  // a chain, cut
// Not another heap of powder: the anti-caking job IS the picture — grains kept
// apart so they flow, which is also what separates it from flour on a shelf.
def('silicon_dioxide', () => [
  ...[[18, 22], [34, 18], [26, 34], [42, 30], [20, 44], [38, 46]].map(([x, y]) =>
    [C(x, y, 6, 'gh'), C(x - 2, y - 2, 1.8, 'hi')]).flat(),
  ...granules('hi', 8, 9, [12, 14, 48, 50]),
]);
def('beta_carotene', () => [(() => backbone('bs', 8, 30, 32).shape)(),
                            ring('bs', 10, 30, 6, 2), ring('bs', 50, 34, 6, 2)]);        // the long conjugated chain
def('annatto',    () => [P('M18 18 Q10 32 18 46 Q30 52 42 46 Q50 32 42 18 Q30 12 18 18 Z', 'bs'),
                         ...granules('hi', 9, 41, [22, 22, 38, 42]),
                         ...needles('lo', 4)]);                                          // the spiny pod
def('turmeric',   () => [P('M12 34 Q18 22 30 26 Q42 30 48 22', 'hi') && S('M12 34 Q18 22 30 26 Q42 30 48 22', 'hi', 9),
                         ...[[20, 28], [36, 27]].map(([x, y]) => C(x, y, 3, 'lo'))]);     // the rhizome
def('curcumin',   () => [hex('ik', 16, 32, 9, 2), hex('ik', 44, 32, 9, 2),
                         (() => backbone('hi', 2, 30, 32).shape)(),
                         C(8, 24, 3.4, 'bs'), C(52, 24, 3.4, 'bs')]);
def('betanin',    () => [hex('bs', 22, 26, 9, 2.2), hex('bs', 38, 40, 9, 2.2),
                         S('M28 31 L32 35', 'ik', 2.2), C(14, 42, 4, 'lo'), C(46, 24, 4, 'lo')]);
def('caramel_colour', () => [vessel('ik', 24, 48), P('M18 30 L42 30 L41 46 Q30 49 19 46 Z', 'lo'),
                             E(30, 30, 12, 3, 'ground')]);
def('ponceau_4r', () => [...[[20, 24], [40, 24]].map(([x, y]) => hex('bs', x, y, 9, 2.2)),
                         S('M28 26 L32 26', 'ik', 2.4), ...double([28, 26], [32, 26], 'ik'),
                         C(30, 44, 5, 'bs'), C(14, 38, 3.4, 'lo')]);                     // the azo bond, twice ringed
// Four more synthetic dyes — colour is never the tell (geometry never names
// one), so each leans on real structure instead: a bigger and smaller ring
// for red_40's two differently-sized sulfonated rings, a five-sided
// pyrazolone for yellow_5 (the one ring here that genuinely isn't a hexagon),
// paired sodium markers for yellow_6's disodium salt, and three rings
// meeting at a point for blue_1 — a triarylmethane, structurally unrelated
// to the other three's shared azo-coupling shape.
def('red_40',    () => [hex('bs', 18, 26, 10, 2.2), hex('hi', 40, 24, 8, 2),
                        ...double([26, 26], [32, 25], 'ik'),
                        C(12, 32, 2.4, 'lo'), C(24, 18, 2.4, 'lo'), C(46, 18, 2.2, 'lo')]);
def('yellow_5',  () => [P('M20 16 L30 22 L26 34 L14 34 L10 22 Z', 'bs'), hex('hi', 42, 26, 8, 2),
                        ...double([26, 26], [34, 26], 'ik'), C(20, 12, 2.4, 'lo')]);
def('yellow_6',  () => [hex('bs', 22, 34, 9, 2.2), hex('hi', 22, 15, 9, 2.2),
                        ...double([22, 21], [22, 28], 'ik'),
                        ...[[44, 22], [50, 28]].map(([x, y]) => P(`M${x - 2.6} ${y} L${x} ${y - 2.6} L${x + 2.6} ${y} L${x} ${y + 2.6} Z`, 'lo'))]);
                                                                                  // stacked rings, salt shown as two diamonds together
def('blue_1',    () => [...[0, 120, 240].map(a => ['g', a, 30, 32, [hex('bs', 30, 16, 7, 1.8)]]),
                        C(30, 32, 4, 'ik')]);
def('sorbate',    () => [...needles('gh', 5), ...granules('hi', 4, 87, [20, 40, 40, 50])]);
def('benzoate',   () => [hex('gh', 26, 30, 11, 2.2), C(42, 22, 5, 'bs'), S('M35 26 L39 24', 'ik', 2),
                         ...granules('hi', 4, 31, [18, 42, 40, 50])]);
def('sulfite',    () => [C(30, 26, 7.4, 'hi'), C(16, 40, 5.4, 'bs'), C(44, 40, 5.4, 'bs'), C(30, 46, 5, 'bs'),
                         ...[[16, 40], [44, 40], [30, 46]].map(([x, y]) => S(`M30 26 L${x} ${y}`, 'ik', 2))]);
def('nitrite',    () => [C(30, 28, 7.4, 'lo'),
                         ...[[16, 42], [44, 42]].map(([x, y]) => [S(`M30 28 L${x} ${y}`, 'ik', 2.2), C(x, y, 5.4, 'bs')]).flat()]);
def('hydrogenated_oil', () => [(() => backbone('ik', 6, 30, 28).shape)(),
                               ...[16, 24, 32, 40, 48].map(x => C(x, 44, 3, 'hi'))]);     // saturated: no double bonds left
def('trans_fat',  () => [S('M8 40 L22 28', 'ik', 2.6), S('M22 28 L38 36', 'ik', 2.6), S('M38 36 L52 24', 'ik', 2.6),
                         ...double([22, 28], [38, 36], 'bs')]);                            // the straightened kink
def('monoglyceride', () => [S('M14 14 L14 46', 'ik', 2.6),
                            ...[[14, 20], [14, 32], [14, 44]].map(([x, y]) => C(x, y, 4, 'bs')),
                            (() => backbone('ik', 4, 36, 20).shape)()]);
def('lecithin',   () => [C(20, 18, 6.4, 'bs'), C(20, 32, 5, 'hi'),
                         S('M26 22 Q34 34 30 48', 'ik', 2.4), S('M32 20 Q42 32 40 48', 'ik', 2.4)]);
def('sorbitol',   () => [(() => backbone('ik', 5, 30, 28).shape)(),
                         ...[14, 22, 30, 38, 46].map(x => C(x, 42, 3.4, 'hi'))]);
def('xylitol',    () => [(() => backbone('ik', 4, 30, 28).shape)(),
                         ...[17, 26, 35, 44].map(x => C(x, 42, 3.4, 'gh')),
                         ...granules('hi', 4, 51, [20, 46, 42, 54])]);
def('aspartame',  () => [hex('ik', 42, 24, 8, 2), (() => backbone('ik', 3, 24, 32).shape)(),
                         C(10, 28, 4.4, 'bs'), C(30, 46, 4, 'hi')]);

/* the three the allergen layer could not name without ───────────────────*/
def('peanut',     () => [P('M14 34 Q10 22 20 20 Q30 20 30 30 Q30 40 20 42 Q12 42 14 34 Z', 'hi'),
                         P('M32 32 Q32 20 42 20 Q52 22 50 34 Q48 44 40 44 Q32 42 32 32 Z', 'hi'),
                         S('M30 30 Q31 34 32 32', 'lo', 3),
                         ...[[20, 30], [42, 32]].map(([x, y]) => C(x, y, 3.4, 'bs')),
                         S('M14 46 Q30 52 50 46', 'lo', 1.6)]);                            // it ripens underground
def('sesame',     () => [P('M18 10 Q14 30 20 46 Q26 50 30 44 Q34 50 40 46 Q46 30 42 10 Z', 'hi'),
                         ...[[24, 22], [34, 20], [28, 32], [36, 34], [26, 42]].map(([x, y]) => grain('bs', x, y, .7, 0)),
                         S('M18 10 L42 10', 'lo', 2.4)]);                                  // the capsule that springs open
def('almond',     () => [P('M30 8 Q46 22 42 38 Q36 50 30 50 Q24 50 18 38 Q14 22 30 8 Z', 'gh'),
                         P('M30 14 Q41 24 38 37 Q34 45 30 45 Q26 45 22 37 Q19 24 30 14 Z', 'hi'),
                         ...[24, 30, 36].map(x => S(`M${x} 20 Q${x - 2} 32 ${x} 42`, 'lo', 1.2))]);


/* the last of the packet ────────────────────────────────────────────────
   Aimed at twenty-eight ingredients that real labels used and the game could
   not name. Drawn as the part you would actually recognise: a rhizome is a
   knuckle, a drupe is a stone in flesh, a lentil is a lens. */
def('drupe',   () => [E(30, 32, 18, 19, 'bs'), E(30, 34, 9, 10, 'gh'),
                      S('M30 13 L30 6', 'lo', 2.4), leaf('lo', 40, 10, .5, 40)]);   // flesh, then a stone
def('mango',   () => [P('M18 18 Q8 32 16 46 Q28 54 40 46 Q50 34 42 20 Q30 12 18 18 Z', 'hi'),
                      P('M24 24 Q18 34 24 44 Q30 48 34 44', 'lo') && S('M24 24 Q18 34 24 44', 'lo', 2),
                      S('M34 14 L38 6', 'lo', 2.4)]);
def('urushiol',() => [hex('ik', 22, 26, 10, 2.2), (() => backbone('ik', 5, 38, 40).shape)(),
                      C(10, 20, 4, 'bs'), C(14, 34, 4, 'bs')]);                      // the catechol, and its tail
def('sumac',   () => [...[0, 1, 2, 3].map(i =>
                        P(`M${30 - (14 - i * 3)} ${46 - i * 9} L${30 + (14 - i * 3)} ${46 - i * 9} L30 ${36 - i * 9} Z`, 'bs')),
                      S('M30 54 L30 46', 'lo', 3),
                      ...granules('lo', 6, 19, [20, 20, 40, 44])]);                  // the upright cone of drupes
def('walnut',  () => [C(30, 32, 18, 'lo'),
                      S('M30 14 L30 50', 'ground', 2.4),
                      S('M22 20 Q28 30 22 42', 'ik', 1.8), S('M38 20 Q32 30 38 42', 'ik', 1.8),
                      S('M16 26 Q24 32 16 38', 'ik', 1.4), S('M44 26 Q36 32 44 38', 'ik', 1.4)]);
def('juglone', () => [hex('ik', 26, 30, 11, 2.2), C(40, 20, 4.4, 'bs'), C(40, 42, 4.4, 'bs'),
                      ...double([34, 24], [40, 20], 'ik')]);
def('black_pepper', () => [...[[20, 26], [34, 22], [26, 38], [40, 36], [30, 48]].map(([x, y]) =>
                            [C(x, y, 6, 'ik'), C(x - 2, y - 2, 1.8, 'lo')]).flat()]);
def('piperine',() => [hex('ik', 16, 28, 9, 2), (() => backbone('ik', 3, 34, 32).shape)(),
                      ring('ik', 50, 38, 6, 2), C(8, 20, 3.4, 'bs')]);
def('jalapeno',() => [P('M26 12 Q14 22 16 34 Q18 48 30 52 Q42 48 44 34 Q46 22 34 12 Z', 'avocado') && 0,
                      P('M26 12 Q16 24 18 36 Q22 50 30 52 Q40 48 42 34 Q44 22 34 12 Z', 'bs'),
                      S('M30 12 L30 4', 'lo', 3), E(30, 11, 7, 3, 'lo'),
                      S('M24 22 Q20 34 24 44', 'hi', 1.6)]);
def('chipotle',() => [P('M24 14 Q16 26 20 38 Q26 50 32 50 Q40 44 40 32 Q42 20 32 14 Z', 'ik'),
                      ...[22, 30, 38].map(y => S(`M${22 + (y - 22) * .2} ${y} Q30 ${y - 3} ${38 - (y - 22) * .2} ${y}`, 'lo', 1.4)),
                      ...[26, 34].map(x => S(`M${x} 10 Q${x - 3} 4 ${x} -2`, 'gh', 1.8))]);   // wrinkled, and smoked
def('cumin',   () => [...[[20, 24, -20], [32, 20, 10], [26, 36, -8], [38, 34, 18], [30, 46, 0]]
                        .map(([x, y, r]) => ['g', r, x, y, [
                          P(`M${x} ${y - 8} Q${x + 4} ${y} ${x} ${y + 8} Q${x - 4} ${y} ${x} ${y - 8} Z`, 'lo'),
                          S(`M${x} ${y - 7} L${x} ${y + 7}`, 'ik', 1)]])]);           // ridged crescent seeds
def('marjoram',() => [S('M30 54 L30 20', 'lo', 2.4),
                      ...[[22, 24], [38, 26], [24, 34], [36, 36], [28, 44]].map(([x, y]) =>
                        leaf('hi', x, y, .45, x < 30 ? -40 : 40)),
                      C(30, 16, 4, 'hi')]);
// Twelve herbs, twelve different silhouettes on purpose — a shelf of small
// green sprigs is exactly the case where "another oval leaf on a stick"
// stops being tellable apart, so each one leans on a different real trait:
// needles, not leaves, for rosemary; a single stiff blade for bay; a fan of
// thread for dill; grass tubes for chives. Same leaf()/stalk() kit as herb
// and marjoram above, just asked to do a wider range of actual botany.
def('rosemary',() => [stalk('lo', 30, 54, 10),
                      ...[16, 22, 28, 34, 40, 46].flatMap(y => [
                        S(`M30 ${y} L${n(30 - 9)} ${n(y - 3)}`, 'bs', 1.8),
                        S(`M30 ${y} L${n(30 + 9)} ${n(y - 3)}`, 'hi', 1.8)])]);  // bottlebrush needles
def('sage',    () => [stalk('lo', 30, 54, 34),
                      ['g', -20, 22, 30, [E(22, 30, 7, 15, 'bs'), S('M22 18 L22 42', 'ik', 1)]],
                      ['g', 20, 38, 26, [E(38, 26, 6, 13, 'hi'), S('M38 15 L38 37', 'ik', 1)]],
                      E(30, 16, 6, 12, 'hi'), S('M30 6 L30 26', 'ik', 1)]);      // soft elongated leaves
def('basil',   () => [stalk('lo', 30, 54, 30),
                      ['g', -30, 20, 28, [P('M20 40 Q6 30 20 16 Q34 30 20 40 Z', 'bs'), S('M20 18 L20 38', 'ik', 1.2)]],
                      ['g', 30, 40, 24, [P('M40 36 Q54 26 40 12 Q26 26 40 36 Z', 'hi'), S('M40 14 L40 34', 'ik', 1.2)]]]);
                                                                                  // two big glossy broad leaves
def('thyme',   () => [stalk('lo', 30, 54, 12),
                      ...[18, 24, 30, 36, 42, 48].flatMap(y => [
                        leaf('bs', n(30 - 5), y, .22, -70), leaf('hi', n(30 + 5), y, .22, 70)])]);
                                                                                  // many tiny leaves, dense and woody
def('parsley', () => [stalk('lo', 30, 54, 30),
                      ...[-50, -25, 0, 25, 50].map(rot => ['g', rot, 30, 28, [
                        P('M30 40 L27 30 L30 32 L32 22 L30 24 L34 16 L30 20 L28 10 Z', 'bs')]])]);
                                                                                  // flat, toothed, frilly fronds
def('mint',    () => [stalk('lo', 30, 54, 30),
                      ['g', -25, 21, 26, [P('M21 38 L17 34 L19 30 L15 28 L18 24 L14 22 L21 12 Q30 20 21 38 Z', 'bs'),
                        S('M21 16 L21 34', 'ik', 1), S('M21 22 L26 26 M21 28 L27 31', 'ik', .8)]],
                      ['g', 25, 39, 22, [P('M39 34 L43 30 L41 26 L45 24 L42 20 L46 18 L39 8 Q30 16 39 34 Z', 'hi'),
                        S('M39 12 L39 30', 'ik', 1), S('M39 18 L34 22 M39 24 L33 27', 'ik', .8)]]]);
                                                                                  // serrated edge, visible veins
def('tarragon',() => [stalk('lo', 30, 54, 10),
                      ...[[24, 18, -60], [36, 28, 60], [24, 38, -55], [36, 48, 55]].map(([x, y, rot]) =>
                        ['g', rot, x, y, [P(`M${x} ${n(y - 9)} Q${n(x + 2.5)} ${y} ${x} ${n(y + 9)} ` +
                          `Q${n(x - 2.5)} ${y} ${x} ${n(y - 9)} Z`, 'hi')]])]);   // sparse, narrow, single leaves
def('dill',    () => [stalk('lo', 30, 54, 14),
                      ...[16, 22, 28, 34, 40].flatMap(y => [
                        S(`M30 ${y} Q${n(30 - 14)} ${n(y - 6)} ${n(30 - 18)} ${n(y - 14)}`, 'hi', 1),
                        S(`M30 ${y} Q${n(30 + 14)} ${n(y - 6)} ${n(30 + 18)} ${n(y - 14)}`, 'hi', 1)])]);
                                                                                  // thread-fine feathery frond
def('coriander',() => [stalk('lo', 30, 54, 34),
                      P('M30 34 Q14 30 16 18 Q22 24 24 16 Q28 26 30 14 Q32 26 36 16 Q38 24 44 18 Q46 30 30 34 Z', 'bs'),
                      S('M30 34 L30 18', 'ik', 1)]);                             // one broad, lobed, flat leaf
def('chives',  () => [...[[20, 54, 20], [26, 54, 14], [30, 54, 10], [34, 54, 16], [40, 54, 22]].map(([x, base, top]) =>
                        S(`M${x} ${base} Q${n(x - 1)} ${n((base + top) / 2)} ${x} ${top}`, 'bs', 2.2)),
                      C(30, 10, 5, 'hi'), C(26, 8, 2, 'lo'), C(34, 8, 2, 'lo'), C(30, 6, 2, 'lo')]);
                                                                                  // hollow grass tubes, pom-pom flower
def('bay_leaf',() => [P('M30 8 Q46 20 40 38 Q34 54 30 54 Q26 54 20 38 Q14 20 30 8 Z', 'bs'),
                      S('M30 12 L30 50', 'ik', 1.4),
                      ...[18, 26, 34, 42].map(y => S(`M30 ${y} L24 ${n(y - 4)} M30 ${y} L36 ${n(y - 4)}`, 'hi', .8))]);
                                                                                  // one single stiff glossy leaf
def('oregano', () => [stalk('lo', 30, 54, 14),
                      ['g', -40, 21, 40, [leaf('bs', 21, 40, .5, 0)]], ['g', 40, 39, 40, [leaf('hi', 39, 40, .5, 0)]],
                      ['g', -35, 22, 28, [leaf('bs', 22, 28, .42, 0)]], ['g', 35, 38, 28, [leaf('hi', 38, 28, .42, 0)]],
                      ['g', -30, 24, 18, [leaf('bs', 24, 18, .32, 0)]], ['g', 30, 36, 18, [leaf('hi', 36, 18, .32, 0)]]]);
                                                                                  // round leaves, paired, no flower bud
def('lime',    () => [C(30, 32, 18, 'hi'), C(30, 32, 14, 'gh'),
                      ...Array.from({ length: 8 }, (_, i) =>
                        ['g', i * 45, 30, 32, [S('M30 20 L30 32', 'hi', 1.4)]]),
                      S('M30 14 L32 7', 'lo', 2.4)]);                                 // cut across
def('makrut_lime', () => [P('M30 8 Q42 14 40 26 Q38 34 30 32 Q22 34 20 26 Q18 14 30 8 Z', 'lo'),
                          P('M30 32 Q42 38 40 48 Q38 54 30 54 Q22 54 20 48 Q18 38 30 32 Z', 'lo'),
                          S('M30 8 L30 54', 'ik', 1.6)]);                             // the double leaf
def('rhizome', () => [P('M8 34 Q16 26 24 32 Q32 38 40 30 Q48 24 54 32', 'hi') && S('M8 34 Q16 26 24 32 Q32 38 40 30 Q48 24 54 32', 'hi', 10),
                      ...[[18, 26], [34, 26], [46, 24]].map(([x, y]) => S(`M${x} ${y} L${x + 2} ${y - 8}`, 'lo', 2.4))]);  // buds, not root hairs
def('ginger',  () => [P('M10 36 Q18 28 26 34 Q34 40 42 32 Q50 26 54 34', 'gh') && S('M10 36 Q18 28 26 34 Q34 40 42 32 Q50 26 54 34', 'gh', 11),
                      S('M26 34 L24 48', 'gh', 7),
                      ...[[18, 28], [40, 26]].map(([x, y]) => C(x, y, 2.6, 'lo'))]);
// Shogaol is gingerol with one water taken out, and the double bond is what is
// left where it went. Drawn so that difference is the loudest thing on each
// card: gingerol wears its hydroxyl as a big marked ball; shogaol wears the
// bond instead, on a chain that has straightened out because of it.
def('gingerol',() => [hex('ik', 18, 22, 9, 2),
                      S('M26 28 L34 38 L44 34 L52 44', 'ik', 2.4),
                      C(34, 38, 7, 'hi'), S('M34 38 L34 50', 'ik', 2), C(34, 52, 4.4, 'bs'),
                      C(9, 14, 3.4, 'bs')]);
def('shogaol', () => [hex('ik', 18, 40, 9, 2),
                      S('M26 34 L38 30 L50 26', 'ik', 2.4),
                      ...double([26, 34], [38, 30], 'bs'),
                      C(52, 22, 4.4, 'hi'), C(9, 48, 3.4, 'bs')]);
def('celery',  () => [...[20, 30, 40].map((x, i) =>
                        [S(`M${x} 52 Q${x - 2 + i} 34 ${x} 16`, 'hi', 5),
                         S(`M${x} 50 Q${x - 1 + i} 34 ${x} 20`, 'lo', 1.4)]).flat(),
                      ...[[18, 12], [30, 8], [42, 12]].map(([x, y]) => leaf('lo', x, y, .5, 0))]);
def('raisin',  () => [...[[22, 26], [36, 24], [28, 38], [40, 40], [20, 42]].map(([x, y]) =>
                        [E(x, y, 7, 5.4, 'ik'),
                         S(`M${x - 4} ${y - 1} Q${x} ${y + 2} ${x + 4} ${y - 1}`, 'lo', 1.2),
                         S(`M${x - 3} ${y + 2} Q${x} ${y - 1} ${x + 3} ${y + 2}`, 'lo', 1)]).flat()]);  // wrinkled
def('lentil',  () => [...[[20, 24], [34, 22], [26, 36], [40, 34], [30, 48]].map(([x, y]) =>
                        [E(x, y, 8, 5, 'hi'), S(`M${x - 8} ${y} L${x + 8} ${y}`, 'lo', 1.2)]).flat()]);  // a lens, edge on
def('split_pea', () => [...[[20, 26], [36, 24], [26, 38], [42, 38], [30, 50]].map(([x, y]) =>
                          [P(`M${x - 7} ${y} A7 7 0 0 1 ${x + 7} ${y} Z`, 'hi'),
                           S(`M${x - 7} ${y} L${x + 7} ${y}`, 'lo', 1.4)]).flat()]);   // halved, flat side down
def('farro',   () => [...[[22, 20], [34, 18], [26, 32], [38, 30], [22, 44], [36, 44]].map(([x, y], i) =>
                        grain('lo', x, y, .95, i % 2 ? 18 : -18)),
                      ...granules('hi', 4, 27, [16, 14, 44, 50])]);
def('sunflower', () => [C(30, 30, 11, 'ik'),
                        ...Array.from({ length: 12 }, (_, i) =>
                          ['g', i * 30, 30, 30, [E(30, 13, 4.4, 8, 'hi')]]),
                        ...granules('lo', 7, 33, [24, 24, 36, 36]),
                        S('M30 41 L30 56', 'lo', 3)]);
def('oil',     () => [P('M22 10 L38 10 L38 20 L44 30 L44 50 Q44 54 38 54 L22 54 Q16 54 16 50 L16 30 L22 20 Z', 'gh'),
                      P('M17 32 L43 32 L44 50 Q44 54 38 54 L22 54 Q16 54 16 50 Z', 'hi'),
                      E(30, 32, 13, 3, 'ground')]);
def('vitamin_a', () => [(() => backbone('bs', 6, 32, 32).shape)(),
                        ring('bs', 10, 30, 7, 2.2), C(54, 34, 4.4, 'hi')]);
def('vitamin_d', () => [hex('ik', 20, 40, 9, 2), hex('ik', 34, 34, 9, 2),
                        S('M40 28 L50 20', 'ik', 2.2), C(12, 50, 4, 'bs'),
                        ...[[44, 10], [50, 14]].map(([x, y]) => S(`M${x} ${y} L${x + 5} ${y - 5}`, 'hi', 2))]);  // sunlight makes it
// Six fortification vitamins, each leaning on a real structural trait so
// "another ring with a dot" doesn't happen twice: two separate rings on a
// bridge for thiamin, three FUSED rings in a row for riboflavin's flat
// isoalloxazine system, one ring for niacin (the simplest of the six, on
// purpose — it is the simplest structure), two rings with a long trailing
// tail for folate's PABA-glutamate chain, one ring with three spidery arms
// for pyridoxine's substituents, one ring with a long zig-zag lipid tail
// for tocopherol's phytyl chain.
def('thiamin',    () => [hex('ik', 18, 36, 8, 2), hex('ik', 38, 24, 8, 2),
                         S('M25 32 L31 28', 'ik', 2), C(12, 42, 3, 'bs'), C(44, 18, 2.4, 'hi')]);
def('riboflavin', () => [hex('ik', 14, 30, 7, 1.8), hex('ik', 30, 30, 7, 1.8), hex('ik', 46, 30, 7, 1.8),
                         S('M21 30 L23 30', 'ik', 1.6), S('M37 30 L39 30', 'ik', 1.6)]);
def('niacin',     () => [hex('ik', 26, 32, 12, 2.2),
                         S('M38 26 L48 20', 'ik', 2), C(50, 16, 3, 'bs'), S('M48 20 L54 24', 'ik', 1.6)]);
def('folate',     () => [hex('ik', 14, 22, 7, 1.8), S('M20 26 L28 34', 'ik', 2), hex('ik', 34, 40, 7, 1.8),
                         S('M40 44 L52 50', 'ik', 2), C(54, 52, 3, 'bs')]);
def('vitamin_b6', () => [hex('ik', 30, 34, 11, 2),
                         S('M20 26 L12 20', 'hi', 1.8), S('M40 26 L48 20', 'hi', 1.8), S('M30 45 L30 54', 'hi', 1.8),
                         ...[[12, 20], [48, 20], [30, 54]].map(([x, y]) => C(x, y, 2.4, 'bs'))]);
def('vitamin_e',  () => [hex('ik', 14, 32, 8, 2),
                         S('M22 32 L28 24 L34 32 L40 24 L46 32 L52 24', 'hi', 2.2)]);
def('soy_sauce', () => [vessel('ik', 22, 48), P('M16 28 L44 28 L43 46 Q30 49 17 46 Z', 'lo'),
                        E(30, 28, 14, 3, 'ground'),
                        ...granules('gh', 3, 61, [22, 34, 38, 42])]);
// A narrow bottle, not soy_sauce's wide-mouth pot — fish sauce is sealed
// and kept, not stirred, and the real container shape says that.
def('fish_sauce', () => [P('M26 8 L34 8 L34 20 Q42 26 42 34 L42 50 Q42 54 38 54 L22 54 Q18 54 18 50 L18 34 Q18 26 26 20 Z', 'lo'),
                        P('M18 36 L42 36 L42 50 Q42 54 38 54 L22 54 Q18 54 18 50 Z', 'ik'),
                        P('M24 40 L28 40 L28 50 L24 50 Z', 'hi')]);
def('candied_fruit', () => [...[[22, 24], [36, 22], [28, 38], [40, 38]].map(([x, y]) =>
                              [P(`M${x - 7} ${y} L${x} ${y - 7} L${x + 7} ${y} L${x} ${y + 7} Z`, 'bs'),
                               ...granules('gh', 3, x * 7, [x - 6, y - 6, x + 6, y + 6])]).flat()]);
// A shallow open bowl, not fish_sauce's sealed bottle or soy_sauce's tall
// pot — this is mixed fresh and poured out, not kept.
def('nuoc_cham', () => [E(30, 42, 22, 9, 'ik'), E(30, 39, 18, 6.5, 'lo'),
                        C(24, 38, 1.6, 'bs'), C(33, 40, 1.4, 'bs'), C(28, 42, 1.2, 'bs')]);
def('coconut_sugar', () => [mound('lo', 46, 19, 17), ...granules('ik', 9, 53, [18, 34, 42, 46]),
                            S('M22 22 Q30 14 38 22', 'hi', 2)]);                       // tapped from the blossom

/* 27 new elements, no hand art yet ─────────────────────────────────────────
 * Eight land in `living` (skeletal/structural, same molecular kit as the
 * vitamins), nine in `grain` (herbs, mushrooms, sweeteners — drawn
 * representationally), ten in `plant` (crop fruit/veg — simple silhouettes).
 */

/* living — skeletal chemistry, one genuinely different motif each ────────
 * creatine is NOT cyclic (a guanidino fork on a short chain, never the
 * shared aminoBackbone() the twenty use — arginine already owns the
 * three-nitrogen guanidinium fan, so creatine skips the backbone entirely
 * and reads as its own small branching molecule); citrulline IS an amino
 * acid, so it reuses aminoBackbone()/chain(), but ends in a ureido group
 * (one O, one N) where arginine's fan has none — the oxygen is the tell;
 * theanine is glutamine's exact backbone and amide with one extra N-ethyl
 * tail hanging off the far nitrogen — glutamine stops, theanine keeps going;
 * caffeine is a genuinely fused six/five ring pair (a purine) with three
 * methyl stubs and two carbonyl oxygens, distinct from the separately-bonded
 * ring pairs (thiamin, vitamin_d) and from tryptophan's plain fused rings;
 * alpha_gpc is a short glycerol backbone plus a marked phosphate and a
 * trimethylammonium starburst — no fatty tails, which is what tells it apart
 * from phospholipid and lecithin's twin-tail heads; synephrine is a bare
 * phenol ring with a branching amine tail and no amino-acid backbone at all
 * (tyrosine's icon is backbone-plus-ring; this is ring-plus-tail only);
 * biotin is two small FUSED rings (one carries the sulfur) with a long
 * zig-zag tail out to a carboxylic acid — folate's two rings are spaced
 * apart on a single bond, biotin's touch; hyaluronic acid alternates a
 * hexagon and a stroked circle along a chain to read as a repeating
 * disaccharide, unlike dna's double helix or polypeptide's single-shape
 * backbone dots.
 */
def('creatine', () => [
  S('M20 28 L32 28 L44 22 L54 28', 'ik', 2.2),
  ...double([20, 28], [10, 18], 'ik'),
  S('M20 28 L10 38', 'ik', 2),
  C(10, 18, 4.2, CPK.N), C(10, 38, 4.2, CPK.N), C(32, 28, 4.4, CPK.N),
  S('M32 28 L32 40', 'ik', 2), C(32, 40, 4, CPK.C),
  ...double([54, 28], [54, 16], 'ik'), C(54, 16, 4.2, CPK.O),
  S('M54 28 L48 38', 'ik', 2), C(48, 38, 4.2, CPK.O),
]);
def('citrulline', () => [
  ...aminoBackbone(), chain([[26, 39], [26, 46]]), C(26, 46, 4.4, CPK.N),
  S('M26 46 L26 54', 'ik', 2),
  ...double([26, 54], [36, 58], 'ik'), C(36, 58, 4.2, CPK.O),
  S('M26 54 L16 58', 'ik', 2), C(16, 58, 4.2, CPK.N),
]);
def('theanine', () => [
  ...aminoBackbone(), chain([[20, 38], [20, 47]]),
  ...double([20, 47], [9, 53], 'ik'), C(9, 53, 4, CPK.O),
  S('M20 47 L31 53', 'ik', 2), C(31, 53, 4.2, CPK.N),
  S('M31 53 L41 47', 'ik', 2), C(41, 47, 4, CPK.C),
  S('M41 47 L51 53', 'ik', 2), C(51, 53, 4, CPK.C),
]);
def('caffeine', () => [
  hex('ik', 20, 30, 10, 2),
  S('M28 23 L38 25 L41 35 L33 41 L26 36 Z', 'ik', 2),
  S('M13 22 L6 17', 'ik', 1.8), C(6, 17, 3.6, CPK.C),
  S('M13 39 L6 45', 'ik', 1.8), C(6, 45, 3.6, CPK.C),
  S('M41 35 L50 40', 'ik', 1.8), C(50, 40, 3.6, CPK.C),
  S('M20 20 L20 11', 'ik', 1.8), C(20, 11, 3.6, CPK.O),
  S('M28 23 L32 15', 'ik', 1.8), C(32, 15, 3.6, CPK.O),
]);
def('alpha_gpc', () => [
  (() => backbone('ik', 3, 22, 24).shape)(),
  S('M39 27 L46 36', 'ik', 2.2), C(46, 36, 5.4, CPK.P),
  S('M46 36 L46 46', 'ik', 2.2), C(46, 46, 4.6, CPK.N),
  S('M46 46 L38 52', 'ik', 1.6), C(38, 52, 3, CPK.C),
  S('M46 46 L54 52', 'ik', 1.6), C(54, 52, 3, CPK.C),
  S('M46 46 L46 56', 'ik', 1.6), C(46, 56, 3, CPK.C),
]);
def('synephrine', () => [
  hex('ik', 22, 24, 9, 2),
  S('M22 33 L22 40', 'ik', 1.8), C(22, 42, 4.2, CPK.O),
  S('M22 15 L32 10', 'ik', 2), C(32, 10, 4, CPK.C),
  S('M32 10 L40 4', 'ik', 1.6), C(40, 4, 3.8, CPK.O),
  S('M32 10 L42 14', 'ik', 2), C(42, 14, 4.4, CPK.N),
  S('M42 14 L50 10', 'ik', 1.8), C(50, 10, 3.6, CPK.C),
]);
def('biotin', () => [
  S('M10 22 L18 13 L27 18 L24 28 L13 29 Z', 'ik', 2),
  S('M24 28 L34 30 L37 20 L27 18', 'ik', 2),
  C(10, 22, 3.6, CPK.N), C(18, 13, 3.6, CPK.N), C(37, 20, 4.4, CPK.S),
  S('M34 30 L42 26 L48 34 L54 30', 'ik', 2.2),
  ...double([54, 30], [54, 20], 'ik'), C(54, 20, 4, CPK.O),
  S('M54 30 L48 40', 'ik', 2), C(48, 40, 4, CPK.O),
]);
def('hyaluronic_acid', () => {
  const cx = [7, 18, 29, 40, 51];
  return [
    ...cx.map((x, i) => i % 2 === 0 ? hex('ik', x, 30, 5.4, 1.6) : ring('ik', x, 30, 5, 1.6)),
    ...cx.slice(0, -1).map((x, i) => S(`M${x + 5.4} 30 L${cx[i + 1] - 5} 30`, 'ik', 1.6)),
  ];
});

/* living — evolutionary biology, gut anatomy, flight anatomy, wild species,
 * and cat-trait additions ───────────────────────────────────────────────
 * A wide batch, so the grouping below is by subject rather than by drawing
 * technique: abstract mechanisms (drift, flow, isolation…) get diagrams in
 * the same schematic language as gene/chromosome/nucleus above; the gut
 * segment gets one true distinguishing feature per organ the way
 * pancreas/kidney do; the bird-anatomy terms are isolated body-part
 * drawings like feather/beak-adjacent kit pieces; the named species follow
 * the lion/zebra/duck rule — body, head, and the one real trait the fact
 * line is about; the cat-trait items close out the batch.
 */

/* evolutionary biology — each mechanism gets a different diagram shape:
 * a two-level branching tree for the whole tree of life, a rectilinear
 * ladder for cladistics' shared-trait nesting, a bounded population for
 * drift, two populations with crossing carriers for flow, a solid wall
 * for isolation, a bare fork for the moment of speciation, a single-level
 * starburst for radiation, three shared skeletons under different outer
 * forms for homology, a body with a pale leftover nub for vestigial
 * structure, banded strata with a coiled fossil for the record, one
 * outline echoed twice for the fossil that never changed, a struck-out
 * fading form for extinction, an impact over a wiped horizon for the mass
 * version, and disruptive patches over a body for camouflage. */
def('tree_of_life', () => [
  S('M30 54 L30 38', 'ik', 3),
  S('M30 40 L16 26', 'lo', 2.4), S('M30 40 L44 26', 'lo', 2.4),
  S('M16 26 L8 14', 'bs', 2), S('M16 26 L22 12', 'bs', 2),
  S('M44 26 L38 12', 'bs', 2), S('M44 26 L52 14', 'bs', 2),
  ...[[8, 14], [22, 12], [38, 12], [52, 14]].map(([x, y]) => C(x, y, 3, 'hi')),
]);
def('cladistics', () => [
  S('M12 8 L12 52', 'ik', 2.2),
  ...[[14, 50], [24, 42], [34, 30], [50, 16]].map(([x, y]) => S(`M12 ${y} L${x} ${y}`, 'bs', 2.2)),
  ...[[14, 50], [24, 42], [34, 30], [50, 16]].map(([x, y]) => C(x, y, 2.8, 'hi')),
  S('M9 30 L15 30 M9 42 L15 42', 'ik', 2.4),           // tick marks: the shared derived traits
]);
def('genetic_drift', () => [
  ring('gh', 30, 32, 20, 1.6),                          // the population, small and bounded
  ...[[20, 24], [30, 20], [40, 26], [18, 36], [42, 34], [26, 42], [36, 40]]
    .map(([x, y], i) => C(x, y, 4, i < 5 ? 'bs' : 'gh')),  // one variant, drifted to near-fixation by chance
]);
def('gene_flow', () => [
  ring('gh', 16, 30, 10, 1.6), ring('gh', 44, 30, 10, 1.6),   // two populations
  ...[[12, 26], [20, 34], [14, 32]].map(([x, y]) => C(x, y, 3, 'lo')),
  ...[[40, 26], [48, 34], [46, 30]].map(([x, y]) => C(x, y, 3, 'hi')),
  S('M24 28 L36 24 M24 34 L36 38', 'bs', 2),            // individuals, crossing between them
]);
def('adaptation', () => [
  P('M6 46 L6 30 Q18 18 30 30 Q42 18 54 30 L54 46 Z', 'gh'),  // the environment, notched
  E(30, 34, 11, 8, 'bs'), C(30, 34, 4, 'hi'),                  // the organism, fitting it exactly
]);
def('sexual_selection', () => [
  ...Array.from({ length: 7 }, (_, i) => {
    const a = (-90 + i * 20) * Math.PI / 180;
    return S(`M22 34 L${n(22 + 20 * Math.cos(a))} ${n(34 + 20 * Math.sin(a))}`, 'hi', 2.2);
  }),                                                   // the display, fanned wide
  C(22, 34, 6, 'bs'), C(48, 40, 4, 'lo'),                // the displayer, and the one choosing
]);
def('artificial_selection', () => [
  ...[16, 28, 40].map(x => C(x, 40, 6, 'gh')),
  C(28, 40, 6, 'bs'),                                    // the one chosen
  S('M28 16 L28 30 M22 24 L28 30 L34 24', 'ik', 2.4),    // the hand, doing the choosing
]);
def('reproductive_isolation', () => [
  ...[[14, 24], [20, 34], [12, 40]].map(([x, y]) => C(x, y, 4, 'bs')),
  ...[[46, 24], [40, 34], [48, 40]].map(([x, y]) => C(x, y, 4, 'hi')),
  S('M30 10 L30 50', 'ik', 3),                           // the wall between them, unbroken
]);
def('speciation', () => [
  S('M30 52 L30 34', 'ik', 3),
  S('M30 34 L14 12', 'bs', 3), S('M30 34 L46 12', 'hi', 3),
  C(14, 10, 3.4, 'bs'), C(46, 10, 3.4, 'hi'),
]);
def('adaptive_radiation', () => [
  C(30, 32, 4, 'ik'),
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60) * Math.PI / 180;
    const x2 = n(30 + 20 * Math.cos(a)), y2 = n(32 + 20 * Math.sin(a));
    return [S(`M30 32 L${x2} ${y2}`, 'lo', 2), C(x2, y2, n(2.4 + (i % 3)), i % 2 ? 'bs' : 'hi')];
  }).flat(),
]);
def('homology', () => [
  P('M8 44 Q8 24 20 14 L24 16 Q14 26 14 44 Z', 'gh'),
  P('M26 44 Q26 26 32 18 L36 20 Q32 28 32 44 Z', 'gh'),
  P('M42 44 Q42 26 48 16 L52 18 Q48 26 48 44 Z', 'gh'),
  ...[10, 30, 46].map(x => S(`M${x} 20 L${x} 42`, 'bs', 3)),   // the same bone, run through all three
  ...[10, 30, 46].map(x => C(x, 20, 2.6, 'hi')),
]);
def('vestigial_structure', () => [
  E(26, 34, 16, 12, 'bs'),
  P('M40 32 Q46 30 46 34 Q46 38 40 36 Z', 'gh'),        // the leftover — small, pale, barely there
]);
def('fossil_record', () => [
  ...[44, 34, 24].map((y, i) => S(`M6 ${y} L54 ${y}`, i % 2 ? 'hi' : 'lo', 7)),  // strata, banded
  ring('ik', 30, 34, 6, 1.6), ring('ik', 30, 34, 3, 1.4),      // a fossil, coiled in the middle layer
]);
def('living_fossil', () => [
  P('M6 34 Q14 24 28 28 Q42 24 50 34 Q38 42 28 40 Q18 42 6 34 Z', 'gh'),   // the fossil imprint
  P('M9 30 Q17 20 31 24 Q45 20 53 30 Q41 38 31 36 Q21 38 9 30 Z', 'bs'),   // the living animal — same outline
  C(45, 27, 1.6, 'ik'),
]);
def('extinction', () => [
  E(28, 32, 14, 10, 'gh'),                               // the species, faded to barely-there
  S('M12 20 L44 44 M12 44 L44 20', 'ik', 2.2),           // struck out
  C(44, 20, 2, 'lo'),                                     // the last individual
]);
def('mass_extinction', () => [
  S('M8 48 L52 48', 'ik', 3),
  ...[[16, 42], [26, 44], [36, 42], [46, 44]].map(([x, y]) => C(x, y, 3.6, 'gh')),  // nearly everything, gone
  S('M46 8 L30 30', 'bs', 3.4),                          // the impactor, falling
  ...[0, 45, 90, 135, 180].map(a =>
    S(`M30 30 L${n(30 + 10 * Math.cos(a * Math.PI / 180))} ${n(30 + 10 * Math.sin(a * Math.PI / 180))}`, 'hi', 1.8)),
]);
def('camouflage', () => [
  E(30, 32, 20, 13, 'lo'),
  ...[[18, 26], [36, 24], [24, 38], [42, 34], [14, 36]].map(([x, y], i) =>
    P(`M${x - 5} ${y} L${x} ${y - 5} L${x + 5} ${y} L${x} ${y + 5} Z`, i % 2 ? 'bs' : 'hi')),  // disruptive patches
]);

/* named wild species — body, head, one real trait, per the lion/zebra rule */
def('peacock', () => [
  E(20, 38, 10, 7, 'bs'), C(28, 30, 5, 'bs'),
  ...Array.from({ length: 7 }, (_, i) => {
    const a = (110 + i * 20) * Math.PI / 180;
    const x2 = n(16 + 24 * Math.cos(a)), y2 = n(38 + 24 * Math.sin(a));
    return [S(`M16 38 L${x2} ${y2}`, 'hi', 2), C(x2, y2, 2.6, 'lo')];
  }).flat(),
  S('M22 26 L18 20', 'lo', 2),                           // the crest
]);
def('owl', () => [
  C(30, 34, 16, 'bs'),
  C(23, 27, 6, 'hi'), C(37, 27, 6, 'hi'),                 // the facial disc, in two big rounds
  C(23, 27, 2.6, 'ik'), C(37, 27, 2.6, 'ik'),             // eyes, huge and forward-facing
  P('M28 32 L32 32 L30 36 Z', 'lo'),
  S('M18 18 L16 10 M42 18 L44 10', 'lo', 2.4),
]);
def('cicada', () => [
  E(30, 36, 8, 14, 'lo'),
  P('M22 28 Q6 20 8 42 Q20 40 28 32 Z', 'gh'),           // one broad, translucent wing
  P('M38 28 Q54 20 52 42 Q40 40 32 32 Z', 'gh'),
  C(27, 22, 2.6, 'bs'), C(33, 22, 2.6, 'bs'),             // the bulging eyes
]);
def('rhinoceros', () => [
  E(26, 36, 20, 13, 'bs'),
  P('M44 30 L52 30 L45 22 Z', 'lo'),                     // the horn
  S('M14 30 Q22 26 30 30 M20 40 Q28 36 36 40', 'lo', 1.6),  // deep, plated skin folds
  ...[-10, 2, 12].map(dx => S(`M${26 + dx} 47 L${26 + dx} 54`, 'lo', 3.4)),
]);
def('hyena', () => [
  P('M12 40 Q12 24 30 26 Q46 22 48 34 L48 40 Q34 44 12 40 Z', 'bs'),  // the sloped back
  C(44, 26, 7, 'bs'),                                    // the heavy, bone-crushing head
  ...[[14, 30], [22, 26], [34, 32], [40, 24]].map(([x, y]) => C(x, y, 1.6, 'lo')),  // the spotted coat
  ...[-8, 6].map(dx => S(`M${20 + dx} 40 L${20 + dx} 50`, 'lo', 2.4)),
]);
def('sloth', () => [
  S('M6 14 L54 14', 'lo', 3),                            // the branch
  E(30, 34, 12, 15, 'bs'), C(30, 20, 7, 'bs'),
  S('M22 16 L18 14 M38 16 L42 14', 'lo', 2.4),           // arms, hooked over the branch
  S('M24 44 L20 52 M36 44 L40 52', 'hi', 2.4),           // long limbs, long claws
]);
def('armadillo', () => [
  C(30, 34, 15, 'bs'),                                    // rolled into a sealed ball
  ...[-8, 0, 8].map(dx => S(`M${n(30 + dx)} 20 A15 15 0 0 1 ${n(30 + dx)} 48`, 'lo', 1.6)),  // the bands
  ring('ik', 30, 34, 15, 1.4),
]);
def('hedgehog', () => [
  E(30, 38, 18, 12, 'bs'),
  ...Array.from({ length: 11 }, (_, i) => {
    const a = (200 + i * 14) * Math.PI / 180;
    return S(`M30 34 L${n(30 + 22 * Math.cos(a))} ${n(34 + 18 * Math.sin(a))}`, i % 2 ? 'hi' : 'lo', 1.6);
  }),                                                     // spines, radiating over the back
  E(14, 40, 5, 4, 'bs'), C(10, 39, 1.4, 'ik'),
]);
def('meerkat', () => [
  E(30, 48, 6, 8, 'bs'),
  S('M30 42 L30 22', 'bs', 9),                           // upright, standing tall as a sentry
  C(30, 16, 6, 'bs'),
  E(26, 15, 2.4, 3, 'ik'), E(34, 15, 2.4, 3, 'ik'),       // big dark eye patches
  S('M32 48 Q42 46 44 30', 'lo', 2.4),
]);

/* gut anatomy — one real distinguishing feature per organ, per the
 * pancreas/kidney convention: the whole arch with its cecum-and-appendix
 * start and tapered rectum end for the large intestine overall; just the
 * two bends and the organs that cause them for the colon specifically;
 * a scalloped wall for haustra's pouches; that same wall gone smooth for
 * the rectum's reservoir; a blind narrow tube off the cecum for the
 * appendix; a wide-narrow-wide travelling wave for peristalsis; mixed
 * cocci and rods inside a gut outline for the flora; a fused two-ring
 * quinone with a long isoprenoid tail for vitamin K. */
def('large_intestine', () => [
  S('M14 46 L14 24 Q14 14 26 14 L40 14 Q50 14 50 24 L50 40', 'bs', 7),  // the arch
  C(12, 48, 6, 'bs'),                                    // the cecum
  S('M8 50 L6 56', 'lo', 2),                             // the appendix, off it
  S('M50 40 L50 52', 'hi', 6),                           // narrowing into the rectum
]);
def('colon', () => [
  S('M10 46 L10 20', 'bs', 6), S('M10 20 L50 20', 'bs', 6), S('M50 20 L50 46', 'bs', 6),
  E(6, 16, 5, 4, 'lo'),                                  // the liver, at the first bend
  E(54, 16, 5, 4, 'hi'),                                 // the spleen, at the second
]);
def('haustra', () => [
  S('M6 24 L54 24', 'ik', 2),                            // the far wall, plain
  S('M6 30 Q12 40 18 30 Q24 40 30 30 Q36 40 42 30 Q48 40 54 30', 'bs', 6),  // the near wall, pouched
]);
def('rectum', () => [
  S('M18 12 L18 30', 'bs', 8),                           // the colon, narrowing in
  P('M10 30 Q10 50 30 50 Q50 50 50 30 Q50 22 40 22 L18 22 Z', 'hi'),   // one smooth chamber, no pouches
]);
def('appendix', () => [
  E(24, 20, 12, 8, 'gh'),                                // the cecum it hangs from
  S('M24 26 Q20 40 22 52', 'bs', 6), C(22, 53, 3.4, 'bs'),  // narrow, blind-ended
  ...[[20, 32], [24, 40], [21, 46]].map(([x, y]) => C(x, y, 1.4, 'hi')),  // immune tissue, in the wall
]);
def('peristalsis', () => [
  E(14, 30, 9, 7, 'hi'), E(30, 30, 5, 7, 'bs'), E(46, 30, 9, 7, 'hi'),   // relax, contract, relax — the wave
  S('M40 16 L48 16 L44 22', 'ik', 2),                    // the direction it travels
]);
def('gut_flora', () => [
  E(30, 32, 20, 14, 'gh'),
  ...[[18, 26], [26, 22], [36, 24]].map(([x, y]) => C(x, y, 3, 'bs')),
  rod3('hi', 24, 38, 7, 2.6), rod3('lo', 38, 34, 6, 2.4),
  C(44, 28, 2.6, 'ik'),
]);
def('vitamin_k', () => [
  hex('ik', 16, 30, 8, 2), hex('ik', 32, 30, 8, 2),      // the fused two-ring quinone
  S('M23 30 L25 30', 'ik', 1.8),
  S('M16 22 L16 14', 'ik', 1.8), C(16, 14, 3.4, CPK.O),
  S('M32 38 L32 46', 'ik', 1.8), C(32, 46, 3.4, CPK.O),
  S('M40 30 L46 24 L52 30 L58 24', 'hi', 1.8),           // the long isoprenoid tail
]);

/* bird-flight anatomy — isolated body-part drawings, one real trait each:
 * a wedge cut open to its bony core for the beak; four hooked strokes
 * radiating off a foot pad for the talon (three forward, one back); a
 * fixed lung amid ghost sacs on a one-way loop for the air sac; a hollow
 * shaft crossed by struts for the pneumatic bone; a blade dropping from
 * a flat sternum for the keel; a pulley joint with two unequal muscle
 * bundles for flight muscle; a shaft with two starkly unequal vanes for
 * the flight feather — asymmetric where the plain feather() is symmetric. */
def('beak', () => [
  P('M10 26 L44 30 L44 34 L10 38 Z', 'bs'),
  P('M10 28 L34 30 L34 34 L10 36 Z', 'lo'),              // the bony core, inside the sheath
  C(46, 32, 2, 'ik'),
]);
def('talon', () => [
  E(28, 44, 8, 5, 'bs'),
  S('M22 42 Q10 38 8 26', 'hi', 3), S('M28 40 Q22 26 18 14', 'hi', 3),
  S('M34 40 Q40 26 44 14', 'hi', 3), S('M38 46 Q48 46 52 38', 'hi', 3),  // three forward, one back
]);
def('air_sac', () => [
  E(30, 32, 8, 12, 'lo'),
  E(16, 18, 7, 9, 'gh'), E(44, 18, 7, 9, 'gh'), E(16, 48, 7, 9, 'gh'), E(44, 48, 7, 9, 'gh'),
  S('M22 22 Q26 26 26 30 M38 22 Q34 26 34 30 M22 42 Q26 38 26 34 M38 42 Q34 38 34 34', 'hi', 1.6),
]);
def('hollow_bone', () => [
  P('M14 24 Q10 14 20 12 L40 12 Q50 14 46 24 L46 40 Q50 48 40 50 L20 50 Q10 48 14 40 Z', 'bs'),
  P('M20 22 Q18 16 24 16 L36 16 Q42 16 40 22 L40 40 Q42 46 36 46 L24 46 Q18 46 20 40 Z', 'gh'),
  S('M22 22 L38 40 M38 22 L22 40', 'lo', 1.4),           // struts, crossing the hollow
]);
def('keel', () => [
  P('M8 18 L52 18 L52 24 L8 24 Z', 'lo'),                // the sternum
  P('M22 24 L30 46 L38 24 Z', 'bs'),                     // the keel, dropping from its midline
]);
def('flight_muscle', () => [
  C(38, 20, 4, 'lo'),                                    // the shoulder joint — the pulley
  P('M10 44 Q10 24 34 20 Q40 24 34 30 Q14 34 10 44 Z', 'bs'),   // pectoralis: the big downstroke
  P('M20 14 Q30 10 40 16 Q34 20 30 22 Q22 20 20 14 Z', 'hi'),   // supracoracoideus: the up, through the tendon
]);
def('flight_feather', () => [
  S('M40 8 L18 52', 'ik', 2.2),                          // shaft, off-centre in its own vane
  ...Array.from({ length: 7 }, (_, i) =>
    S(`M${38 - i * 3} ${12 + i * 5.6} L${48 - i * 3} ${15 + i * 5.6}`, 'hi', 2)),   // trailing vane, wide
  ...Array.from({ length: 7 }, (_, i) =>
    S(`M${38 - i * 3} ${12 + i * 5.6} L${32 - i * 3} ${9 + i * 5.6}`, 'bs', 1.2)),  // leading vane, narrow
]);

/* named birds — body, head, one real trait, per the duck/turkey rule */
def('hummingbird', () => [
  E(26, 34, 8, 6, 'bs'),
  S('M34 32 L54 28', 'lo', 1.8),                         // the long needle bill
  S('M22 30 Q10 20 20 10 M30 30 Q42 20 32 10', 'hi', 2),  // wings, blurred wide in a hover
  S('M18 40 Q10 46 14 54', 'lo', 1.6),
]);
def('penguin', () => [
  E(30, 34, 13, 18, 'lo'), E(30, 38, 9, 13, 'hi'),        // countershaded body
  S('M18 26 Q10 32 16 42', 'lo', 4), S('M42 26 Q50 32 44 42', 'lo', 4),  // flipper wings, short and stiff
  P('M28 18 L32 18 L30 24 Z', 'fire-bs'),
]);
def('flamingo', () => [
  S('M30 54 L30 32', 'bs', 3),                           // one leg, standing
  S('M30 32 Q22 20 28 10 Q32 6 26 4', 'bs', 3.4),        // the long, extended S-neck
  P('M20 2 L28 4 L18 8 Z', 'lo'),                        // bill, bent sharply down to filter
  C(30, 32, 3, 'ik'),
]);
def('albatross', () => [
  S('M2 30 L58 30', 'bs', 3.4),                          // wings, locked flat and enormous
  E(30, 30, 6, 9, 'hi'),
  P('M30 22 L36 18 L30 24 Z', 'lo'),
]);
def('ostrich', () => [
  E(26, 38, 10, 14, 'bs'),
  S('M28 26 L38 4', 'bs', 3), C(40, 3, 4, 'bs'),          // bare neck, small head
  S('M20 50 L18 58 M32 50 L34 58', 'lo', 2.4),
  S('M18 58 L14 58 L18 60 M34 58 L38 58 L34 60', 'ik', 1.6),  // two toes only
]);
def('kiwi_bird', () => [
  E(28, 34, 16, 14, 'bs'),
  S('M42 34 L58 36', 'lo', 2.4),                         // long thin bill
  C(58, 36, 1.4, 'ik'),                                   // the nostril, right at the tip
  S('M20 46 L18 54 M30 48 L30 55', 'hi', 1.8),
]);
def('toucan', () => [
  E(20, 38, 9, 11, 'bs'), C(28, 26, 6, 'bs'),
  P('M32 22 Q52 16 54 28 Q52 36 32 30 Z', 'hi'),         // the huge, hollow bill
  S('M32 22 Q52 16 54 28', 'lo', 1.2),
]);
def('woodpecker', () => [
  S('M46 4 L46 56', 'lo', 5),                            // the tree trunk
  E(30, 30, 11, 8, 'bs'),
  S('M40 28 L50 26', 'ik', 2.4),                         // chisel bill, striking
  S('M22 40 L18 54', 'hi', 2.4),                         // stiff tail, propped against the bark
]);
def('pelican', () => [
  E(24, 30, 11, 9, 'bs'), C(38, 26, 6, 'bs'),
  P('M42 28 L58 30 L54 40 Q44 42 40 34 Z', 'hi'),        // the great throat pouch
]);
def('heron', () => [
  E(26, 42, 9, 7, 'bs'),
  S('M30 38 Q20 30 26 20 Q32 14 24 10', 'bs', 3),        // neck, folded tight into an S
  P('M20 8 L30 6 L18 12 Z', 'lo'),                       // dagger bill
  S('M22 48 L20 58 M32 48 L34 58', 'hi', 1.8),           // two legs, standing still
]);
def('cormorant', () => [
  E(30, 40, 10, 12, 'ik'),
  S('M20 30 Q4 26 4 12 M40 30 Q56 26 56 12', 'lo', 3.4),  // both wings, spread wide to dry
  S('M30 26 L36 14', 'bs', 2.4), P('M35 12 L40 12 L36 16 Z', 'bs'),
]);
def('parrot', () => [
  E(28, 36, 11, 10, 'bs'), C(34, 22, 7, 'bs'),
  P('M38 20 Q50 22 46 32 Q40 32 36 24 Z', 'hi'),         // strongly hooked, hinged beak
  S('M38 20 L36 24', 'ik', 1.4),                         // the hinge, unfused from the skull
  S('M26 14 L22 6', 'lo', 2.4),
]);
def('swift', () => [
  E(30, 32, 7, 6, 'bs'),
  S('M23 30 Q4 22 2 8', 'lo', 2.6), S('M37 30 Q56 22 58 8', 'lo', 2.6),  // long scythe wings, swept back
  P('M27 38 L30 50 L24 46 Z', 'hi'), P('M33 38 L30 50 L36 46 Z', 'hi'),  // forked tail
]);

/* cat traits — the fact line is the drawing */
def('cartilage', () => [
  P('M6 18 L24 18 L24 32 L6 32 Z', 'lo'),
  P('M36 28 L54 28 L54 42 L36 42 Z', 'lo'),
  P('M20 22 Q34 22 34 34 Q34 38 30 38 L26 38 Q26 30 20 30 Z', 'hi'),  // the smooth cushion between them
]);
def('whisker', () => [
  E(14, 32, 9, 8, 'bs'),
  ...[24, 30, 36].map(y => S(`M20 ${y} L52 ${y - 8}`, 'hi', 1.2)),
  ...[24, 30, 36].map(y => C(20, y, 1.6, 'ik')),         // the root — where the nerve endings are
]);
def('floating_clavicle', () => [
  S('M14 6 L14 54 M46 6 L46 54', 'lo', 4),               // the narrow gap
  E(30, 30, 9, 20, 'bs'),                                // the body, squeezing through
  S('M24 20 L34 22', 'gh', 2.4),                         // the clavicle — unattached, just floating there
]);
def('retractable_claw', () => [
  P('M10 30 Q10 46 30 48 Q50 46 50 30 Q50 20 30 20 Q10 20 10 30 Z', 'bs'),
  ...[18, 30, 42].map(x => E(x, 42, 4, 3, 'hi')),        // toes, sheathed and rounded
  S('M42 44 L46 54', 'ik', 2),                           // one claw, extended and hooked
]);
def('tapetum_lucidum', () => [
  E(30, 30, 20, 13, 'gh'),
  C(30, 30, 10, 'ik'),                                    // the pupil, wide in the dark
  ring('hi', 30, 30, 7, 2),                               // the mirror behind it, catching light
  C(30, 30, 3, 'bs'),
]);
def('righting_reflex', () => [
  ['g', 180, 16, 14, [E(16, 14, 8, 5, 'gh')]],            // upside down, the fall begins
  ['g', 90, 30, 30, [E(30, 30, 8, 5, 'hi')]],             // twisting, mid-fall
  E(46, 48, 8, 5, 'bs'),                                  // upright, landed
  S('M16 20 Q24 26 30 26 M30 34 Q38 42 46 43', 'ik', 1.6),
]);


/* living — batch 06: nervous system, organelles, animal anatomy, species ──
 * Four sub-clusters, each built so neighbours read apart at shelf size:
 *   nervous system (meninges..neurogenesis) — the CNS/PNS/autonomic split is
 *     drawn as silhouette, not colour: central_nervous_system is just brain-
 *     plus-cord (two shapes), peripheral_nervous_system is the cord alone
 *     with branches and no brain, nervous_system is both together and denser
 *     than either. Sympathetic gets the bolt (alert), parasympathetic gets
 *     the wave (calm) — the one visual antonym pair in the batch.
 *   organelles (nuclear_envelope..flagella, plus diffusion..phagocytosis) —
 *     the three ER cards share nothing but a role: generic ER is a nucleus
 *     fragment plus one open tube, rough ER is flattened stacked sacs
 *     studded with ribosome dots, smooth ER is a closed round tube loop
 *     ending in a lipid droplet. Cilia is many short hairs off a bare arc;
 *     flagella is one long whip off a cell body — the count and length are
 *     the whole distinction, the way the fact lines describe it.
 *   animal anatomy (mane..knuckle) — each one is the single trait its fact
 *     line names: an ossicone's paired skin-covered knobs (not a horn's one
 *     curve, not an antler's branch), a hoof's solid keratin wall, a
 *     goblet cell's literal goblet silhouette.
 *   species (hippopotamus..fox, heart, taxonomy) — jackal, fox and the
 *     existing wolf/dingo are all canids, so each keeps a genuinely
 *     different silhouette: jackal is slim-bodied with oversized upright
 *     ears and a low tail, fox is built around one bushy tail.
 */

/* the nervous system, whole and in its parts ────────────────────────────── */
def('meninges', () => [
  C(30, 32, 9, 'gh'),                                      // the brain it wraps
  ring('hi', 30, 32, 13, 1.6),                              // pia — thin, hugs the surface
  ring('bs', 30, 32, 17, 2),                                // arachnoid
  S('M30 15 L30 21 M47 32 L41 32 M30 49 L30 43 M13 32 L19 32', 'gh', 1),  // its web, reaching out
  ring('lo', 30, 32, 21, 3.4),                              // dura — thick, outermost
]);
def('cerebrospinal_fluid', () => [
  C(30, 32, 20, 'gh'),                                      // the brain, floating in it
  ...[[30, 10], [10, 32], [50, 32], [30, 54]].map(([x, y]) => C(x, y, 2.4, 'hi')),  // cushioning it on every side
  E(30, 33, 8, 5, 'bs'), wave('hi', 33, 2, 6),               // the ventricle it's made in
]);
def('blood_brain_barrier', () => [
  P('M4 24 L56 24 L56 40 L4 40 Z', 'gh'),                   // the capillary, wide open
  S('M30 16 L30 48', 'ik', 3.4),                            // the tight junction wall
  ...granules('bs', 8, 71, [6, 20, 26, 44]),                // stopped, on the blood side
  C(46, 32, 2, 'hi'),                                       // the rare thing small enough to cross
]);
def('cranial_nerve', () => [
  C(30, 14, 7, 'bs'),                                       // the brain stem
  ...[100, 128, 156, 204, 232, 260].map(a => {
    const t = a * Math.PI / 180;
    return S(`M30 14 L${n(30 + 25 * Math.cos(t))} ${n(14 + 25 * Math.sin(t))}`, 'ik', 2);
  }),                                                        // plugged straight in, no cord between
]);
def('spinal_nerve', () => [
  ring('lo', 26, 30, 9, 3),                                 // one vertebra
  C(26, 30, 3.4, 'ik'),
  S('M35 28 Q47 20 54 12', 'hi', 2.4),                      // sensory branch, heading up
  S('M35 32 Q47 42 54 50', 'bs', 2.4),                      // motor branch, heading back out
]);
def('peripheral_nervous_system', () => [
  S('M30 4 L30 56', 'lo', 3.4),                             // the trunk it all branches from
  ...[12, 22, 32, 42, 52].map(y => [
    S(`M30 ${y} L8 ${y - 6}`, 'hi', 1.6), S(`M30 ${y} L52 ${y - 6}`, 'hi', 1.6),
  ]).flat(),                                                 // reaching the whole body, and no brain
]);
def('central_nervous_system', () => [
  E(30, 16, 14, 10, 'bs'),                                  // the brain
  S('M30 24 L30 54', 'bs', 5),                              // the cord — and that is the whole of it
]);
def('nervous_system', () => [
  E(30, 12, 12, 8, 'bs'),                                   // central...
  S('M30 18 L30 54', 'bs', 4),
  ...[26, 34, 42, 50].map(y => [
    S(`M30 ${y} L14 ${y - 4}`, 'hi', 1.6), S(`M30 ${y} L46 ${y - 4}`, 'hi', 1.6),
  ]).flat(),                                                 // ...plus peripheral, all of it at once
]);
def('autonomic_nervous_system', () => [
  C(30, 9, 5, 'lo'),                                        // the hypothalamus, running it
  S('M30 14 L30 26', 'ik', 2.4),
  S('M30 26 L15 37', 'ik', 1.8), S('M30 26 L30 41', 'ik', 1.8), S('M30 26 L45 37', 'ik', 1.8),
  C(15, 40, 4, 'bs'), C(30, 46, 4, 'hi'), C(45, 40, 4, 'gh'),  // heart, gut, lungs — none of it asked for
]);
def('sympathetic_nervous_system', () => [
  S('M30 8 L30 50', 'lo', 4),                               // the cord's chest-and-abdomen stretch
  ...[18, 28, 38].map(y => [
    S(`M30 ${y} L14 ${y - 6}`, 'hi', 1.8), S(`M30 ${y} L46 ${y - 6}`, 'hi', 1.8),
  ]).flat(),
  bolt('bs', 30, 4, .55),                                   // fight-or-flight
]);
def('parasympathetic_nervous_system', () => [
  C(30, 9, 6, 'lo'),                                        // it starts in the brain stem, not the cord
  S('M30 15 L30 46', 'bs', 3),
  wave('hi', 54, 4, 15),                                    // rest-and-digest — the opposite of the jolt
]);
def('short_term_memory', () => [
  E(30, 32, 18, 13, 'gh'),                                  // the cortex — this doesn't last
  C(22, 27, 4, 'bs'), C(30, 33, 2, 'hi'), C(36, 30, 1, 'gh'),  // one flicker of activity, already going
]);
def('long_term_memory', () => [
  E(30, 32, 20, 14, 'lo'),                                  // the cortex — this stays
  ...[[20, 26], [30, 24], [40, 28], [22, 38], [38, 38]].map(([x, y]) => C(x, y, 3.2, 'bs')),
  S('M20 26 L30 24 L40 28 L38 38 L22 38 Z M30 24 L38 38 M40 28 L22 38', 'ik', 1.2),  // wired in for good
]);
def('neuroplasticity', () => [
  S('M10 18 L10 42', 'bs', 2.2), C(10, 18, 4, 'lo'), C(10, 42, 4, 'lo'),
  ...[15, 19, 23].map(x => C(x, 30, 1.6, 'hi')),            // used often — thick, and gathering receptors
  S('M50 18 L50 42', 'gh', 1), C(50, 18, 3, 'gh'), C(50, 42, 3, 'gh'),  // unused — fading
]);
def('neurogenesis', () => [
  E(17, 32, 9, 10, 'bs'),                                   // the stem cell, dividing
  S('M27 32 L31 32', 'ground', 2.6),
  C(45, 32, 6.5, 'hi'),                                     // its daughter, now a neuron
  S('M45 26 L41 17 M45 26 L49 17 M51 28 L58 22 M51 36 L58 41', 'ik', 1.4),  // dendrites, just budding
]);

/* organelles the earlier cell batch left out ─────────────────────────────── */
def('nuclear_envelope', () => [
  ring('lo', 24, 32, 13, 2.2),                              // outer membrane, off-centre —
  ring('hi', 24, 32, 9, 1.6),                                // — because the other side keeps going
  ...[0, 90, 180, 270].map(a => C(n(24 + 11 * Math.cos(a * Math.PI / 180)), n(32 + 11 * Math.sin(a * Math.PI / 180)), 1.8, 'ground')),
  S('M37 30 Q48 22 55 26', 'bs', 3), S('M35 24 Q42 18 48 20', 'bs', 1.6),  // straight into the ER
]);
def('endoplasmic_reticulum', () => [
  C(10, 14, 5, 'lo'),                                       // the fragment of nucleus it's continuous with
  S('M15 16 Q26 8 34 18 Q42 28 30 32 Q18 36 26 46 Q34 54 46 48', 'bs', 3),
]);
def('rough_endoplasmic_reticulum', () => [
  ...[16, 24, 32, 40].map(y => S(`M8 ${y} Q30 ${y - 3} 52 ${y}`, 'bs', 2.6)),  // flattened, stacked sacs
  ...[[12, 13], [22, 13], [32, 13], [42, 13], [16, 21], [28, 21], [40, 21],
      [14, 29], [30, 29], [46, 29], [18, 37], [34, 37], [44, 37]]
    .map(([x, y]) => C(x, y, 1.3, 'ik')),                   // ribosomes, studding the outer face
]);
def('smooth_endoplasmic_reticulum', () => [
  S('M10 30 Q10 14 26 14 Q42 14 42 28 Q42 40 28 42 Q14 44 14 32', 'hi', 3.4),  // a closed loop, no dots
  C(46, 20, 5, 'gh'),                                       // the lipid it's built
]);
def('nucleolus', () => [
  ring('gh', 30, 32, 19, 1.6),                              // the nucleus it sits inside
  E(30, 32, 10, 8, 'bs'),                                   // solid — no membrane of its own
  ...granules('hi', 9, 53, [24, 26, 36, 38]),               // and dense — a ribosome factory
]);
def('golgi_apparatus', () => [
  ...disc('bs', 5),                                         // cis to trans, stacked
  C(48, 12, 3, 'hi'), C(53, 6, 2, 'gh'),                    // vesicles budding off the far side
]);
def('lysosome', () => [
  ring('bs', 30, 32, 15, 2.6),
  ...granules('hi', 7, 91, [22, 24, 38, 40]),               // sixty-odd digestive enzymes
  S('M30 17 L34 8', 'gh', 1.6),                             // the stub it budded off the Golgi from
]);
def('vacuole', () => [
  P('M4 6 L56 6 L56 54 L4 54 Z', 'gh'),                     // the cell wall, right at the edge
  ring('bs', 30, 30, 24, 2.4),                              // the vacuole — fused, and filling almost everything
  E(24, 24, 4, 3, 'hi'),
]);
def('cytoskeleton', () => [
  S('M8 12 L52 48 M8 48 L52 12 M30 6 L30 54 M6 30 L54 30', 'ik', 1.6),  // the scaffolding, crossing every way
  ...[10, 30, 50].map(x => C(x, 30, 1.6, 'hi')),
]);
def('centriole', () => [
  ...[16, 20, 24, 28].map(x => S(`M${x} 8 L${x} 28`, 'bs', 2.2)),      // one cylinder...
  ...[32, 36, 40, 44].map(y => S(`M32 ${y} L52 ${y}`, 'hi', 2.2)),     // ...and its partner, always at right angles
]);
def('cilia', () => [
  S('M6 46 Q30 54 54 46', 'lo', 2.4),                       // the cell surface they're rooted in
  ...Array.from({ length: 11 }, (_, i) => {
    const x = n(8 + i * 4.4);
    return S(`M${x} 44 Q${n(x + 3)} 30 ${n(x + 1)} 14`, 'ik', 1.6);
  }),                                                         // hundreds of short hairs, beating together
]);
def('flagella', () => [
  E(14, 46, 8, 6, 'bs'),                                    // the cell body
  S('M20 42 Q34 30 26 18 Q18 6 40 4', 'ik', 3),             // one long whip, far longer than any cilium
]);
def('plasmid', () => [
  rod3('gh', 26, 38, 14, 6),                                // the bacterium, barely there
  ring('bs', 40, 18, 8, 2.4),                                // its loop of DNA, kept separate from the rest
  C(40, 18, 2, 'hi'),
]);

/* the transport verbs — what a membrane does and does not let through ────── */
def('diffusion', () => [
  ...granules('bs', 13, 101, [6, 20, 26, 44]),              // crowded, to start
  ...granules('hi', 4, 103, [34, 24, 54, 40]),               // and thin, where they're headed
  S('M28 32 L44 32', 'gh', 1.4),                             // no pump, no membrane — just drifting apart
]);
def('osmosis', () => [
  S('M30 6 L30 54', 'ik', 3),                               // the selective membrane
  ...[14, 26, 38, 50].map(y => C(30, y, 1, 'gh')),          // its pores
  ...granules('bs', 8, 113, [34, 16, 54, 48]),               // solute, thick on the far side
  S('M14 32 L26 32', 'hi', 2.2),                             // water alone, heading toward it
]);
def('active_transport', () => [
  S('M8 32 L52 32', 'ik', 3),                               // the membrane
  C(16, 32, 3, 'gh'),                                        // where it started — the low side
  C(44, 32, 3, 'bs'), ...granules('bs', 4, 131, [38, 20, 52, 26]),  // pushed against its own gradient anyway
  bolt('hi', 30, 8, .4),                                     // and it cost an ATP to do it
]);
def('endocytosis', () => [
  S('M14 14 Q4 32 14 50 Q22 56 30 50', 'bs', 3),            // the membrane, folding around something outside
  C(20, 32, 4, 'hi'),
  S('M30 50 Q34 44 30 40', 'gh', 1.6),                       // and about to pinch shut
]);
def('exocytosis', () => [
  S('M14 30 L46 30', 'ik', 3),                              // the membrane
  ring('bs', 30, 18, 8, 2.2),                                // the vesicle, docking from inside
  ...[[20, 42], [30, 46], [40, 42]].map(([x, y]) => C(x, y, 2, 'hi')),  // its contents, already outside
]);
def('phagocytosis', () => [
  rod3('gh', 30, 30, 13, 5),                                // the whole bacterium, about to disappear
  S('M8 16 Q4 30 10 44 Q20 54 34 50 Q48 44 50 30 Q48 16 36 12 Q22 8 8 16 Z', 'bs', 2.6),  // swallowed entire
]);

/* the cells and fluid the loose organelles above build ──────────────────── */
def('muscle_cell', () => [
  P('M4 26 L56 26 L56 38 L4 38 Z', 'bs'),                   // a long, elongated cell
  ...[8, 14, 20, 26, 32, 38, 44, 50].map(x => S(`M${x} 26 L${x} 38`, 'ik', 1.2)),  // repeating sarcomeres — striated
]);
def('white_blood_cell', () => [
  P('M14 20 Q8 14 14 8 Q22 4 26 12 Q34 6 40 14 Q50 12 50 22 Q56 30 48 36 Q52 46 42 48 Q38 56 28 50 Q16 54 12 44 Q4 36 10 28 Q6 22 14 20 Z', 'hi'),  // pseudopods, not a clean outline
  ...granules('bs', 6, 151, [20, 20, 40, 40]),               // lysosomes, loaded and waiting
]);
def('goblet_cell', () => [
  P('M22 12 L38 12 L44 30 Q44 48 30 52 Q16 48 16 30 Z', 'bs'),  // a literal goblet
  ...granules('hi', 10, 161, [20, 16, 40, 40]),              // swollen with mucin
]);
def('mucus', () => [
  wave('lo', 44, 5, 24), wave('bs', 35, 4, 22), wave('hi', 26, 3, 19),
  ...[[20, 34], [34, 29], [26, 40]].map(([x, y]) => C(x, y, 1.6, 'gh')),  // whatever the air brought in, trapped
]);
def('ciliated_cell', () => [
  E(30, 44, 18, 10, 'bs'),                                  // the cell body
  ...Array.from({ length: 9 }, (_, i) => {
    const x = 14 + i * 4;
    return S(`M${x} 36 Q${x + 3} 24 ${x + 1} 12`, 'ik', 1.6);
  }),                                                         // its cilia, all sweeping one way
  wave('gh', 8, 2, 22),                                      // the mucus blanket they're moving
]);
def('blood', () => [
  wave('gh', 44, 4, 24),                                     // mostly plasma
  ...[[16, 28], [26, 34], [38, 30]].map(([x, y]) => E(x, y, 5, 3.4, 'bs')),  // red cells, suspended
  P('M42 16 Q36 12 40 8 Q46 6 48 12 Q54 14 50 20 Q52 26 44 24 Z', 'hi'),  // one white cell, doing something else entirely
]);
def('red_blood_cell', () => [
  E(30, 32, 19, 13, 'bs'),                                  // the biconcave disc
  E(30, 32, 10, 6, 'hi'), S('M24 32 L20 32 M40 32 L36 32', 'gh', 1),  // the dimple, both faces
]);

/* what a real animal's body is actually built from ───────────────────────── */
def('mane', () => [
  ...Array.from({ length: 12 }, (_, i) => {
    const a = i * 30 * Math.PI / 180;
    return S(`M${n(30 + 10 * Math.cos(a))} ${n(30 + 10 * Math.sin(a))} L${n(30 + 22 * Math.cos(a))} ${n(30 + 22 * Math.sin(a))}`, 'bs', 3);
  }),                                                         // hair, radiating — and only males grow it
  C(30, 30, 9, 'lo'),
]);
def('ossicone', () => [
  S('M22 30 L20 10', 'lo', 3), S('M38 30 L40 10', 'lo', 3),  // two bone stalks, always paired
  C(20, 8, 4, 'hi'), C(40, 8, 4, 'hi'),                     // skin-covered — not a bare horn tip
  E(30, 40, 14, 10, 'gh'),
]);
def('tooth', () => [
  P('M16 10 Q30 2 44 10 L42 24 Q30 30 18 24 Z', 'hi'),      // the crown — enamel
  P('M20 24 L18 50 Q22 54 24 48 L26 26 Z', 'lo'), P('M40 24 L42 50 Q38 54 36 48 L34 26 Z', 'lo'),  // the roots
  S('M18 24 Q30 30 42 24', 'ik', 1.4),                       // enamel's own boundary
]);
def('trunk', () => [
  P('M20 8 Q46 10 44 30 Q42 48 26 54 Q14 52 16 42 Q18 34 26 34 Q34 34 32 24 Q30 14 20 8 Z', 'bs'),
  ...[16, 24, 32, 40].map(y => S(`M20 ${y} Q28 ${y - 2} 36 ${y}`, 'hi', 1)),  // muscle rings — no bone at all
]);
def('shoulder_hump', () => [
  P('M6 50 Q6 30 20 22 Q28 10 38 20 Q34 30 44 34 Q52 38 50 50 Z', 'bs'),  // the raised profile
  ...[16, 22, 28].map(x => S(`M${x} 24 Q${x + 2} 18 ${x + 4} 14`, 'hi', 1.6)),  // pure muscle, not fat
]);
def('sagittal_crest', () => [
  P('M10 36 Q8 20 22 14 Q26 6 32 10 Q30 16 36 18 Q48 22 46 36 Q44 46 34 48 L14 48 Q10 44 10 36 Z', 'lo'),
  S('M22 14 Q28 8 34 12', 'ik', 3),                          // the ridge itself, grown to anchor the bite
  S('M24 20 L14 34 M30 16 L40 30', 'gh', 1.4),
]);
def('claw', () => [
  P('M20 50 Q16 36 20 22 Q24 10 34 8 Q30 18 26 28 Q30 34 24 42 Q28 46 24 52 Z', 'bs'),  // the keratin sheath, curved
  S('M22 44 L18 50', 'lo', 2),                               // the toe bone it sits over
]);
def('cecum', () => [
  S('M14 12 L14 30 Q14 40 24 40 Q34 40 34 30 Q34 22 44 22 Q52 22 52 32', 'lo', 5),  // the long coiled chamber
  S('M14 12 L14 4', 'bs', 5),                                // where it meets the rest of the gut
]);
def('pouch', () => [
  P('M10 24 Q10 46 30 50 Q50 46 50 24 Q40 34 30 34 Q20 34 10 24 Z', 'bs'),  // the fold of skin
  C(30, 20, 7, 'hi'), C(27, 18, 1.4, 'ik'),                  // barely past embryo, and already nursing
]);
def('hoof', () => [
  P('M14 48 Q12 30 20 22 Q30 14 40 22 Q48 30 46 48 Q30 56 14 48 Z', 'bs'),  // the hard keratin wall
  S('M18 44 Q30 50 42 44', 'hi', 2),                         // the sole
  C(30, 30, 4, 'gh'),                                        // the single toe bone it carries
]);
def('knuckle', () => [
  ...[16, 28, 40, 52].map(x => C(x, 26, 7, 'bs')),          // four joints, in a row
  S('M8 40 L54 40', 'lo', 2),                                // the ground it presses against
  ...[16, 28, 40, 52].map(x => S(`M${x} 33 L${x} 40`, 'ik', 1.4)),
]);

/* six real species and what they're each actually known for ──────────────── */
def('hippopotamus', () => [
  E(28, 36, 20, 14, 'bs'),                                  // the barrel body
  E(46, 28, 8, 7, 'bs'),
  C(42, 22, 1.6, 'ik'), C(50, 24, 1.6, 'ik'),               // eyes high on the head, for staying submerged
  wave('water-bs', 50, 4, 24),                              // the river it spends its day in
  E(24, 30, 5, 3, 'lo'),                                     // its own reddish sunscreen sheen
]);
def('jackal', () => [
  E(26, 38, 14, 7, 'bs'),                                   // slim-bodied, low to the ground
  C(40, 32, 6, 'bs'),
  P('M35 24 L33 14 L39 22 Z', 'bs'), P('M43 23 L47 13 L45 23 Z', 'bs'),  // oversized, upright ears
  P('M46 32 L54 33 L47 36 Z', 'lo'),
  S('M12 40 Q4 44 6 52', 'lo', 3),                           // tail carried low, not curled up
  ...[-8, -2, 5, 9].map(dx => S(`M${26 + dx} 44 L${26 + dx} 52`, 'lo', 2)),
]);
def('ibis', () => [
  E(26, 32, 13, 8, 'bs'),
  C(38, 26, 4, 'bs'),
  S('M36 28 Q48 26 52 34 Q54 40 48 42', 'lo', 3),           // the long down-curved bill — its signature
  S('M14 38 L10 50 M20 40 L18 52', 'lo', 2),                 // long wading legs
]);
def('egyptian_cobra', () => [
  S('M14 50 Q20 30 30 34 Q40 38 34 20', 'bs', 6),           // the body, rising
  P('M34 20 Q24 8 24 22 Q24 30 34 20 Q44 30 44 22 Q44 8 34 20 Z', 'bs'),  // the spread hood
  C(34, 20, 3, 'ik'),
]);
def('raven', () => [
  E(28, 32, 15, 10, 'ik'),                                  // solid black, unlike the water-bird family above
  C(42, 26, 6, 'ik'),
  P('M47 26 L56 28 L47 31 Z', 'lo'),                         // a heavy beak
  S('M38 32 Q34 38 38 42', 'gh', 2),                         // shaggy throat hackles
  P('M14 32 L6 38 L16 38 Z', 'ik'),                          // a wedge tail, not a fanned one
]);
def('fox', () => [
  E(27, 34, 15, 8, 'bs'),
  C(41, 28, 6.5, 'bs'),
  P('M37 22 L38 14 L42 21 Z', 'bs'), P('M44 21 L48 13 L49 21 Z', 'bs'),  // pointed ears
  P('M46 29 L55 30 L47 33 Z', 'lo'),
  P('M12 36 Q0 32 2 44 Q4 52 14 48 Q10 42 12 36 Z', 'hi'),   // the big bushy tail — the standout trait
]);
def('heart', () => [
  P('M30 50 Q10 34 10 20 Q10 8 20 8 Q28 8 30 18 Q32 8 40 8 Q50 8 50 20 Q50 34 30 50 Z', 'bs'),
  ...[[22, 20], [36, 22], [26, 32], [34, 34]].map(([x, y]) => E(x, y, 3.4, 2, 'hi')),  // packed with mitochondria
]);
def('taxonomy', () => [
  C(30, 8, 3, 'bs'),
  S('M30 11 L18 20 M30 11 L42 20', 'ik', 1.6), ...[18, 42].map(x => C(x, 22, 2.6, 'hi')),
  S('M18 24 L10 34 M18 24 L26 34 M42 24 L36 34 M42 24 L50 34', 'ik', 1.4),
  ...[10, 26, 36, 50].map(x => C(x, 36, 2.2, 'lo')),
  S('M10 38 L6 48 M10 38 L14 48 M50 38 L46 48 M50 38 L54 48', 'ik', 1.2),
  ...[6, 14, 46, 54].map(x => C(x, 50, 1.8, 'gh')),          // kingdom down to species, one place each
]);


/* living — poultry husbandry batch: life stages of cattle, sheep, goats,
 * pigs, horses, chickens, ducks/geese, turkeys, plus buffalo/donkey/rabbit,
 * six named sharks, and the poultry-pathology/immune-chemistry tier that
 * shares the tag. Each life stage keeps the parent species' silhouette
 * grammar but changes size, sex-markers (horns/tusks/comb/mane) and pose
 * for the one real trait that actually separates it — not a relabelled
 * copy of the adult. ─────────────────────────────────────────────────── */

/* cattle: bull carries the horns and the ring through the nose; heifer is
 * small, unmarked, no udder yet; steer is hornless and heavy-bodied, built
 * for beef rather than breeding or milk. */
def('bull',    () => [E(27, 35, 17, 11, 'bs'), C(44, 30, 7.5, 'bs'),
                      S('M40 24 Q36 15 39 9 M48 24 Q53 16 49 9', 'lo', 2.6),
                      C(50, 31, 1.8, 'ik'),
                      ...[-10, -3, 6, 13].map(dx => S(`M${27 + dx} 45 L${27 + dx} 54`, 'lo', 3))]);
def('heifer',  () => [E(27, 36, 13, 9, 'hi'), C(40, 32, 5.6, 'hi'),
                      E(23, 33, 4, 3, 'lo'),
                      ...[-7, -2, 4, 9].map(dx => S(`M${27 + dx} 44 L${27 + dx} 51`, 'lo', 2))]);
def('steer',   () => [E(31, 41, 13, 8, 'lo'), C(44, 36, 6, 'lo'),
                      S('M40 30 L48 26', 'ik', 2),
                      ...[-9, -3, 4, 10].map(dx => S(`M${31 + dx} 47 L${31 + dx} 55`, 'lo', 3))]);

/* chicken: chick is a downy ball with no comb at all; cockerel's comb is
 * just budding, tail just starting; pullet is a plump, comb-less hen-to-be
 * near the nest she isn't laying in yet; rooster carries the full comb,
 * wattle and sweeping tail plume; hen sits low over the egg she laid;
 * capon is fattened, round, and stunted in the comb the castration stopped. */
def('chick',    () => [C(29, 38, 11, 'bs'), C(39, 27, 6.4, 'bs'),
                       P('M44 26 L49 27 L44 29 Z', 'fire-bs'),
                       E(20, 40, 4, 3, 'hi'),
                       S('M25 48 L24 53 M33 48 L34 53', 'lo', 1.6)]);
def('cockerel', () => [E(25, 33, 11, 10, 'hi'), C(37, 22, 5.4, 'hi'),
                       C(40, 19, 1.4, 'fire-bs'),
                       S('M12 29 L6 23 M13 35 L6 36', 'lo', 1.8),
                       S('M22 41 L20 47 M28 41 L30 47', 'lo', 1.8)]);
def('pullet',   () => [mound('lo', 50, 18, 9),
                       E(28, 38, 14, 9, 'bs'), C(39, 29, 6, 'bs'),
                       S('M26 46 L25 50', 'lo', 2)]);
def('rooster',  () => [E(26, 38, 13, 11, 'bs'), C(40, 26, 7, 'bs'),
                       P('M40 18 L37 13 L40 20 L43 13 L44 19 Z', 'fire-bs'),
                       P('M44 30 Q48 34 44 38', 'fire-bs'),
                       S('M14 36 Q4 30 8 20 Q14 28 18 34', 'lo', 2.4)]);
def('hen',      () => [P('M12 44 Q10 30 26 26 Q42 22 46 34 Q48 42 40 46 Q26 50 12 44 Z', 'bs'),
                       C(40, 26, 5.6, 'bs'),
                       P('M40 22 L38 19 L42 19 Z', 'fire-bs'),
                       E(22, 46, 6, 4, 'hi')]);
def('capon',    () => [E(28, 36, 18, 14, 'hi'), C(43, 27, 6.4, 'hi'),
                       C(43, 21, 1.6, 'fire-bs'),
                       E(18, 34, 8, 6, 'lo')]);

/* sheep: ram has the curled horn, ewe has the udder and none, wether is
 * shorn — fewer fleece tufts and the clip line where the wool came off. */
def('ram',    () => [...[[19, 30], [27, 26], [35, 29], [23, 37], [32, 37]].map(([x, y]) => C(x, y, 7.5, 'hi')),
                     C(43, 33, 6, 'lo'),
                     S('M40 28 Q34 24 38 18 Q44 16 44 22 Q46 28 41 30', 'ik', 2),
                     ...[-6, 0, 6].map(dx => S(`M${27 + dx} 44 L${27 + dx} 51`, 'lo', 2.4))]);
def('ewe',    () => [...[[20, 33], [28, 29], [36, 32], [24, 39], [33, 39]].map(([x, y]) => C(x, y, 7.6, 'hi')),
                     C(43, 35, 5.6, 'lo'), E(30, 48, 5, 3, 'lo'),
                     ...[-6, 0, 6].map(dx => S(`M${28 + dx} 45 L${28 + dx} 52`, 'lo', 2.2))]);
def('wether', () => [...[[24, 32], [32, 30], [27, 40]].map(([x, y]) => C(x, y, 7, 'hi')),
                     C(42, 34, 6, 'lo'),
                     S('M14 34 Q30 40 46 34', 'gh', 1.6),
                     ...[-6, 0, 6].map(dx => S(`M${27 + dx} 45 L${27 + dx} 52`, 'lo', 2.2))]);

/* goat: kid is small and legs splayed, playful; buck carries both horns
 * swept back and the beard; doe has one small horn and the udder. */
def('kid',  () => [E(28, 38, 10, 7, 'bs'), C(38, 30, 4.6, 'bs'),
                   ...[-5, 0, 5].map(dx => S(`M${28 + dx} 44 Q${28 + dx} 48 ${30 + dx} 52`, 'lo', 2))]);
def('buck', () => [E(28, 35, 17, 11, 'bs'), C(45, 29, 6.6, 'bs'),
                   S('M44 22 Q44 13 50 11 M40 22 Q38 14 33 12', 'lo', 2.6),
                   P('M45 36 L43 42 L47 42 Z', 'lo'),
                   ...[-9, -2, 6, 12].map(dx => S(`M${28 + dx} 44 L${28 + dx} 53`, 'lo', 2.4))]);
def('doe',  () => [E(28, 36, 14, 9, 'hi'), C(41, 31, 5.4, 'hi'),
                   S('M40 26 Q40 20 44 19', 'lo', 2), E(30, 47, 4, 3, 'lo'),
                   ...[-7, -1, 5, 9].map(dx => S(`M${28 + dx} 44 L${28 + dx} 51`, 'lo', 2))]);

/* pig: piglet is a big-headed small round body; boar has small tusks and a
 * bristled ridge; gilt's tail hangs low, not yet curled; barrow is heavy
 * and hornless-plain; sow carries the row of teats from her litters. */
def('piglet', () => [E(28, 40, 10, 7, 'bs'), C(38, 33, 4.6, 'bs'),
                     E(42, 34, 2.2, 2.6, 'lo'),
                     ...[-5, 0, 5].map(dx => S(`M${28 + dx} 46 L${28 + dx} 51`, 'lo', 1.8))]);
def('boar',   () => [E(27, 36, 17, 12, 'lo'), C(44, 31, 7.6, 'lo'),
                     E(50, 32, 3.6, 4.2, 'ik'),
                     S('M47 36 Q44 40 46 43 M50 36 Q48 41 51 43', 'hi', 1.8),
                     S('M18 26 Q28 22 38 25', 'ik', 1.4),
                     ...[-9, -2, 6, 12].map(dx => S(`M${27 + dx} 46 L${27 + dx} 55`, 'lo', 2.8))]);
def('gilt',   () => [E(28, 36, 14, 9, 'hi'), C(41, 32, 6, 'hi'),
                     E(46, 33, 2.8, 3.2, 'lo'),
                     S('M13 35 L8 37', 'lo', 1.8),
                     ...[-7, -1, 5, 9].map(dx => S(`M${28 + dx} 44 L${28 + dx} 51`, 'lo', 2))]);
def('barrow', () => [E(26, 34, 20, 14, 'bs'), C(45, 29, 8.6, 'bs'),
                     E(51, 30, 4, 4.4, 'lo'),
                     ...[-13, -5, 4, 12].map(dx => S(`M${26 + dx} 50 L${26 + dx} 58`, 'lo', 3.8))]);
def('sow',    () => [E(27, 37, 19, 13, 'hi'), C(45, 32, 7.4, 'hi'),
                     E(51, 33, 3.4, 4, 'lo'),
                     ...[-11, -4, 3, 10].map(dx => C(27 + dx, 46, 1.8, 'lo')),
                     ...[-11, -3, 5, 12].map(dx => S(`M${27 + dx} 48 L${27 + dx} 55`, 'lo', 2.8))]);

/* horse: foal's legs are disproportionately long for its small body; colt
 * and filly are adolescents with a mane just starting; stallion carries a
 * heavy flowing mane and thick tail; mare stays close to the foal at her
 * side; gelding is plain, sturdy, and its mane is trimmed short. */
def('foal',     () => [E(27, 38, 10, 6, 'hi'),
                       P('M35 36 Q40 28 40 22 L45 22 Q45 32 39 40 Z', 'hi'),
                       ...[-6, -2, 2, 6].map(dx => S(`M${27 + dx} 42 L${27 + dx} 56`, 'lo', 1.8)),
                       S('M17 38 Q13 43 15 48', 'lo', 1.6)]);
def('colt',     () => [E(27, 36, 12, 7, 'bs'),
                       P('M36 34 Q42 25 42 18 L47 18 Q47 29 40 38 Z', 'bs'),
                       S('M36 28 Q39 22 44 19', 'lo', 2),
                       ...[-8, -3, 3, 8].map(dx => S(`M${27 + dx} 41 L${27 + dx} 53`, 'lo', 2))]);
def('filly',    () => [E(29, 38, 8, 6, 'hi'),
                       P('M34 35 Q39 28 38 20 L42 20 Q44 30 39 39 Z', 'hi'),
                       S('M14 37 Q7 42 11 50', 'lo', 2.2),
                       ...[-6, -1, 4, 8].map(dx => S(`M${29 + dx} 43 L${29 + dx} 54`, 'lo', 2.2))]);
def('stallion', () => [E(26, 34, 17, 10, 'bs'),
                       P('M40 31 Q47 21 47 12 L53 12 Q53 26 45 36 Z', 'bs'),
                       S('M39 27 Q45 15 53 10 M42 24 Q48 14 55 12', 'lo', 3),
                       S('M10 32 Q3 40 6 50', 'lo', 3.2),
                       ...[-11, -4, 4, 10].map(dx => S(`M${26 + dx} 42 L${26 + dx} 54`, 'lo', 2.6))]);
def('mare',     () => [E(24, 32, 10, 6, 'hi'),
                       P('M32 30 Q37 22 36 15 L40 15 Q42 25 36 33 Z', 'hi'),
                       S('M32 26 Q35 19 39 16', 'lo', 2),
                       C(15, 50, 4, 'gh'),
                       ...[-7, -2, 3, 7].map(dx => S(`M${24 + dx} 38 L${24 + dx} 47`, 'lo', 2))]);
def('gelding',  () => [E(30, 37, 12, 7, 'lo'),
                       P('M39 33 Q44 26 43 19 L48 19 Q49 29 43 37 Z', 'lo'),
                       S('M40 24 L46 21', 'hi', 3),
                       ...[-11, -5, 3, 9].map(dx => S(`M${30 + dx} 46 L${30 + dx} 57`, 'lo', 2.6))]);

/* buffalo, its meat, goat meat, donkey, rabbit — buffalo carries the wide
 * sweeping horns and the wallow it dug; carabeef and chevon reuse the
 * butcher's cut() silhouette (same grammar as beef/mutton/lamb) with the
 * horn that names which animal it came from; donkey's ears are the whole
 * story; rabbit's are long and upright over a round body. */
def('buffalo',  () => [E(26, 36, 18, 12, 'lo'), C(44, 30, 8, 'lo'),
                       S('M40 24 Q30 14 34 6 M48 25 Q54 16 48 8', 'ik', 3),
                       E(20, 46, 10, 4, 'water-bs'),
                       ...[-11, -3, 6, 13].map(dx => S(`M${26 + dx} 46 L${26 + dx} 55`, 'lo', 3))]);
def('carabeef', () => [...cut('lo', 4, 81), S('M40 14 Q30 8 34 2 M46 15 Q52 8 47 4', 'ik', 2)]);
def('chevon',   () => [...cut('hi', 3, 93), S('M40 14 Q40 8 46 6', 'lo', 2)]);
def('donkey',   () => [E(27, 36, 13, 8, 'bs'), C(41, 29, 6, 'bs'),
                       E(37, 20, 3, 7, 'lo'), E(44, 19, 3, 7, 'lo'),
                       S('M13 34 Q8 36 9 40', 'lo', 2),
                       ...[-8, -2, 4, 9].map(dx => S(`M${27 + dx} 43 L${27 + dx} 51`, 'lo', 2))]);
def('rabbit',   () => [E(30, 40, 13, 10, 'bs'),
                       E(24, 20, 4, 10, 'hi'), E(32, 19, 4, 11, 'hi'),
                       C(40, 34, 2, 'ik'), C(16, 44, 4, 'hi')]);

/* duck/goose: drake has the dark glossy head, white neck ring and the
 * curled tail feather that is the real textbook sex marker; duckling is a
 * small yellow ball on the water; goose stretches its neck up, standing on
 * land; gander raises both wings in a threat display; gosling is round,
 * downy and still short-necked. */
def('drake',    () => [E(27, 35, 15, 10, 'hi'), C(41, 26, 6.5, 'lo'),
                       S('M35 30 Q41 33 47 30', 'hi', 2),
                       P('M46 26 L54 27 L46 30 Z', 'fire-bs'),
                       S('M13 33 Q7 30 9 24 Q13 26 13 32', 'lo', 2)]);
def('duckling', () => [C(29, 38, 10, 'bs'), C(38, 29, 6, 'bs'),
                       P('M42 28 L47 29 L42 31 Z', 'fire-bs'),
                       wave('water-bs', 48, 3, 18)]);
def('goose',    () => [E(26, 40, 14, 9, 'hi'),
                       P('M32 36 Q28 22 34 12 L38 12 Q40 24 38 38 Z', 'hi'),
                       P('M35 10 L42 11 L35 14 Z', 'fire-bs'),
                       ...[-6, 0, 6].map(dx => S(`M${26 + dx} 47 L${26 + dx} 53`, 'lo', 2.2))]);
def('gander',   () => [E(26, 42, 15, 9, 'bs'),
                       P('M33 38 Q29 24 35 14 L39 14 Q41 26 39 40 Z', 'bs'),
                       P('M36 12 L43 13 L36 16 Z', 'fire-bs'),
                       S('M14 36 Q4 26 12 18 M14 40 Q6 44 4 36', 'lo', 2.4)]);
def('gosling',  () => [C(30, 40, 11, 'bs'),
                       P('M32 32 Q30 24 34 18 L37 18 Q38 26 36 33 Z', 'bs'),
                       C(20, 42, 2, 'hi'), C(40, 42, 2, 'hi')]);

/* turkey: poult is a small downy ball, no fan; tom carries the full fan,
 * the snood drooping over the beak and the beard hanging from the chest;
 * turkey_hen is smaller, plainer, and does not fan. */
def('poult',      () => [C(30, 40, 10, 'bs'), C(39, 31, 5, 'bs'),
                         P('M42 30 L46 31 L42 33 Z', 'fire-bs'),
                         S('M26 48 L25 52 M34 48 L35 52', 'lo', 1.6)]);
def('tom',        () => [...Array.from({ length: 9 }, (_, i) => {
                           const a = (-160 + i * 20) * Math.PI / 180;
                           return S(`M26 34 L${n(26 + 24 * Math.cos(a))} ${n(34 + 24 * Math.sin(a))}`, i % 2 ? 'hi' : 'lo', 3);
                         }),
                         E(30, 36, 11, 9, 'bs'), C(41, 26, 5, 'bs'),
                         S('M41 30 Q39 36 42 39', 'fire-bs', 2.2),
                         S('M30 44 Q28 52 30 58', 'ik', 2.4)]);
def('turkey_hen', () => [E(28, 38, 11, 9, 'hi'), C(38, 29, 5, 'hi'),
                         S('M38 33 Q37 37 39 39', 'fire-bs', 1.6),
                         ...[-6, 0, 6].map(dx => S(`M${28 + dx} 46 L${28 + dx} 52`, 'lo', 2))]);

/* six named sharks, each on the one trait its fact line is actually about:
 * basking is the huge mouth held open to filter-feed and the oversized
 * gills; megamouth is the blunt rounded snout and pale-lipped gape, drawn
 * ghostly for how rarely it is seen; sand_tiger's ragged teeth show even
 * with its mouth shut; great_white gets the sharp countershading line and
 * tall dorsal; mako is slender with a sharply pointed snout and lunate
 * tail built for speed; salmon_shark is stockier, with the caudal keel of
 * the warm-blooded Lamnidae and the salmon it hunts in cold water. */
def('basking_shark',    () => [E(26, 32, 20, 7, 'bs'),
                               P('M46 32 L57 26 L57 38 Z', 'lo'),
                               P('M20 26 L26 14 L30 27 Z', 'lo'),
                               E(9, 32, 5, 4, 'ik'),
                               S('M14 26 Q11 32 14 38', 'hi', 1.4)]);
def('megamouth_shark',   () => [E(28, 33, 17, 9, 'gh'), C(13, 33, 8, 'gh'),
                                S('M6 33 Q13 40 22 36', 'hi', 2.4),
                                P('M40 27 L45 20 L47 28 Z', 'lo')]);
def('sand_tiger_shark',  () => [E(27, 33, 17, 8, 'bs'),
                                P('M44 33 L54 27 L54 39 Z', 'lo'),
                                P('M20 30 L28 24 L32 33 Z', 'lo'),
                                zig('ik', 33, 3, 5)]);
def('great_white_shark', () => [P('M8 34 Q20 20 40 22 Q54 24 56 34 Q54 30 40 30 Q22 28 8 34 Z', 'lo'),
                                P('M8 34 Q20 44 40 42 Q54 40 56 34 Q54 38 40 38 Q22 40 8 34 Z', 'hi'),
                                P('M40 22 L48 10 L50 26 Z', 'lo'),
                                C(15, 33, 1.6, 'ik')]);
def('mako_shark',        () => [E(27, 33, 18, 6.5, 'bs'),
                                P('M45 33 L45 24 L57 33 L45 42 Z', 'hi'),
                                P('M9 33 L20 29 L20 37 Z', 'ik'),
                                P('M24 25 L30 17 L34 26 Z', 'lo')]);
def('salmon_shark',      () => [E(27, 33, 17, 10, 'lo'),
                                P('M44 33 L44 25 L55 33 L44 41 Z', 'bs'),
                                S('M40 41 L46 46', 'hi', 2.4),
                                E(12, 33, 5, 3, 'gh')]);

/* poultry pathology and immune/lipid chemistry that shares the `microbe`
 * tag: avibirnavirus is a bare icosahedral capsid with the two SEPARATE
 * genome segments a birnavirus actually carries (viroid's ring is one
 * loop; this is two, unconnected); infectious_bursal_disease is the bursa
 * itself, its lymphocytes fading and cut through — the organ Gumboro
 * disease actually destroys; gammacoronavirus is the radiating crown of
 * spikes a coronavirus is named for, distinct from virus's hexagonal
 * capsid on six legs; infectious_bronchitis is the ringed trachea it
 * fouls, virus particles inside it, not the virus alone; e_coli is a rod
 * ringed with flagella on every side (peritrichous, unlike salmonella's
 * few flagella to one side); colibacillosis is a compromised organ with
 * rods breaking out past the gut wall; ascaridia_galli is one thin
 * tapering coiled roundworm; ascaridiasis is a heavier tangle of them plus
 * the eggs left behind in soil; satellite is almost nothing at all, just a
 * bare dot borrowing a sketched-in helper virus's outline; cowpox is
 * poxvirus's real brick-shaped virion with its dumbbell-shaped core;
 * vaccine is the syringe and the weakened pathogen it carries, barely
 * there; immunity is one full antibody plus the fainter echoes of the
 * memory of it; histamine is a small imidazole ring on a short amine tail;
 * arachidonic_acid is a long unsaturated carbon chain, several double
 * bonds; prostaglandin is the signature five-membered ring with a chain
 * off each side, the shape the whole prostaglandin family is named for. */
def('avibirnavirus', () => [S('M30 10 L48 22 L41 44 L19 44 L12 22 Z', 'ik', 2.2),
                            S('M22 26 Q30 22 26 34', 'bs', 2),
                            S('M34 24 Q38 30 32 38', 'bs', 2)]);
def('infectious_bursal_disease', () => [
  P('M20 16 Q14 16 14 26 L14 40 Q14 50 30 52 Q46 50 46 40 L46 26 Q46 16 40 16 Z', 'lo'),
  ...[[24, 28], [34, 26], [26, 38], [38, 36]].map(([x, y]) => C(x, y, 3.2, 'gh')),
  S('M22 30 L28 36 M30 24 L36 30', 'ik', 1.4),
]);
def('gammacoronavirus', () => [
  C(30, 30, 11, 'bs'),
  ...Array.from({ length: 10 }, (_, i) => {
    const a = i * 36 * Math.PI / 180;
    return S(`M${n(30 + 11 * Math.cos(a))} ${n(30 + 11 * Math.sin(a))} L${n(30 + 18 * Math.cos(a))} ${n(30 + 18 * Math.sin(a))}`, 'ik', 1.8);
  }),
  ...Array.from({ length: 10 }, (_, i) => {
    const a = i * 36 * Math.PI / 180;
    return C(n(30 + 18 * Math.cos(a)), n(30 + 18 * Math.sin(a)), 2, 'hi');
  }),
]);
def('infectious_bronchitis', () => [
  S('M22 10 L22 50 M38 10 L38 50', 'lo', 2.4),
  ...[16, 24, 32, 40].map(y => S(`M20 ${y} L40 ${y}`, 'lo', 1.6)),
  ...[[26, 20], [34, 30], [27, 40]].map(([x, y]) => C(x, y, 2.6, 'bs')),
]);
def('e_coli', () => [
  rod3('bs', 30, 30, 14, 5),
  ...[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
    const rad = a * Math.PI / 180;
    return S(`M${n(30 + 15 * Math.cos(rad))} ${n(30 + 6 * Math.sin(rad))} L${n(30 + 22 * Math.cos(rad))} ${n(30 + 10 * Math.sin(rad))}`, 'ik', 1);
  }),
]);
def('colibacillosis', () => [
  E(30, 34, 18, 16, 'lo'),
  rod3('bs', 22, 28, 8, 3), rod3('bs', 36, 38, 8, 3),
  S('M18 20 L14 14 M42 20 L46 14', 'ik', 1.4),
]);
def('ascaridia_galli', () => [
  S('M14 44 Q10 24 26 14 Q42 6 46 20 Q48 30 34 28 Q22 26 24 38', 'bs', 3),
  C(14, 44, 1.6, 'ik'),
]);
def('ascaridiasis', () => [
  mound('lo', 50, 20, 10),
  ...[[16, 40], [26, 36], [36, 40]].map(([x, y], i) => S(`M${x - 6} ${y + 6} Q${x} ${y - 6} ${x + 6} ${y + 6}`, i % 2 ? 'hi' : 'bs', 2.2)),
  ...granules('gh', 8, 17, [12, 20, 48, 30]),
]);
def('satellite', () => [
  S('M20 20 L30 12 L40 20 L36 32 L24 32 Z', 'gh', 1.6),
  C(46, 42, 3.2, 'bs'),
  S('M44 38 Q40 30 34 26', 'ik', 1),
]);
def('cowpox', () => [
  P('M14 20 L46 20 L46 44 L14 44 Z', 'bs'),
  S('M20 32 L40 32', 'ik', 1.6),
  C(20, 32, 4, 'lo'), C(40, 32, 4, 'lo'),
]);
def('vaccine', () => [
  P('M14 40 L34 20 L40 26 L20 46 Z', 'hi'),
  S('M34 20 L44 10', 'ik', 2.2),
  C(22, 44, 4, 'gh'),
]);
def('immunity', () => [
  S('M30 44 L30 30 M30 30 L20 18 M30 30 L40 18', 'ik', 2.4),
  C(20, 18, 3, 'bs'), C(40, 18, 3, 'bs'),
  ...[10, -10].map(dx => S(`M${30 + dx} 44 L${30 + dx} 32 M${30 + dx} 32 L${22 + dx} 22 M${30 + dx} 32 L${38 + dx} 22`, 'gh', 1.2)),
]);
def('histamine', () => [
  S('M18 20 L28 14 L36 20 L33 30 L21 30 Z', 'ik', 2),
  C(28, 14, 3.6, CPK.N), C(21, 30, 3.6, CPK.N),
  S('M33 30 L42 34 L48 44', 'ik', 2), C(48, 44, 4, CPK.N),
]);
def('arachidonic_acid', () => {
  const b = backbone('ik', 4, 30, 34);
  return [
    b.shape,
    ...double(b.pts[0], b.pts[1], 'ik'),
    ...double(b.pts[2], b.pts[3], 'ik'),
    C(b.pts[0][0], b.pts[0][1], 4, CPK.C),
    C(b.pts[4][0], b.pts[4][1], 4.2, CPK.O),
  ];
});
def('prostaglandin', () => [
  S('M22 28 L26 20 L34 20 L38 28 L30 34 Z', 'ik', 2.2),
  S('M22 28 L12 24 L6 30', 'ik', 1.8), C(6, 30, 3.6, CPK.O),
  S('M38 28 L48 32 L54 26', 'ik', 1.8), C(54, 26, 3.6, CPK.O),
]);

/* grain — herbs/mushrooms/sweeteners, each on its own real trait ─────────
 * shiitake is one scalloped dome on a centred stem, flecked; maitake is a
 * CLUSTER of small overlapping fan-caps with no single dominant stem — the
 * rosette a hen-of-the-woods actually grows as; spirulina is a true
 * Archimedean spiral stroke, not the stacked-ring coil() used for wire
 * filaments elsewhere; dandelion is one jagged, deeply-toothed leaf, not a
 * fan of fronds like parsley or a single lobed leaf like coriander; ginseng
 * is a vertical taproot that forks into legs and throws off arms — a
 * humanoid silhouette, nothing like rhizome/ginger's horizontal knobby
 * strokes or carrot's tapered wedge; psyllium is grain()'s pointed seed
 * husk wrapped in a soft ghost halo for the mucilage gel, which rice/farro
 * don't have; fos is a short open backbone capped with a small ring at each
 * end (an oligomer of linked units), distinct from xylitol's backbone of
 * bare dots; sucralose is glucose's Haworth ring with three hydroxyls
 * swapped for explicit green chlorine atoms; stevia is small blunt oval
 * leaflets (not oregano's round leaf() pairs) with a centre vein, opposite
 * up the stem.
 */
def('shiitake', () => [
  P('M8 30 Q8 20 16 16 Q22 10 30 14 Q38 10 44 16 Q52 20 52 30 Z', 'bs'),
  P('M26 30 L34 30 L32 50 L28 50 Z', 'lo'),
  ...[14, 22, 30, 38, 46].map(x => S(`M${x} 29 L${x} 33`, 'ik', 1)),
  C(20, 20, 1.6, 'hi'), C(32, 16, 1.6, 'hi'), C(42, 22, 1.6, 'hi'),
]);
def('maitake', () => [
  ...[[16, 40, -20], [26, 34, -5], [36, 34, 10], [46, 40, 25], [30, 46, 0]].map(([x, y, rot]) =>
    ['g', rot, x, y, [P(`M${x - 9} ${y + 6} Q${x - 9} ${y - 6} ${x} ${y - 8} Q${x + 9} ${y - 6} ${x + 9} ${y + 6} Z`, 'bs')]]),
  S('M30 50 L30 56', 'lo', 2.4),
]);
def('spirulina', () => {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, ang = t * Math.PI * 5, rad = 2 + t * 20;
    pts.push([n(30 + rad * Math.cos(ang)), n(30 + rad * Math.sin(ang))]);
  }
  return [S('M' + pts.map(p => p.join(' ')).join(' L'), 'bs', 3)];
});
def('dandelion', () => [
  P('M30 54 L24 46 L28 44 L20 38 L26 36 L18 30 L25 28 L16 22 L24 20 L18 12 L26 12 ' +
    'Q30 6 34 12 Q30 20 30 28 Q30 36 30 44 Q30 50 30 54 Z', 'bs'),
]);
def('ginseng', () => [
  S('M30 10 L30 32', 'lo', 3),
  S('M30 32 L18 34 L14 50', 'lo', 2.6), S('M30 32 L42 34 L46 50', 'lo', 2.6),
  S('M30 20 L18 18 L12 24', 'lo', 1.8), S('M30 20 L42 18 L48 24', 'lo', 1.8),
  C(30, 8, 3, 'hi'),
]);
def('psyllium', () => [
  ...[[18, 24], [36, 20], [24, 38], [42, 36], [30, 48]].map(([x, y]) =>
    [E(x, y, 7, 10, 'gh'), grain('bs', x, y, .8, 0)]).flat(),
]);
def('fos', () => [
  (() => backbone('ik', 3, 30, 32).shape)(),
  hex('ik', 12, 28, 6, 1.6), hex('ik', 48, 36, 6, 1.6),
]);
def('sucralose', () => {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    p.push([n(30 + 14 * Math.cos(a)), n(30 + 13 * Math.sin(a))]);
  }
  return [
    S('M' + p.map(q => q.join(' ')).join(' L') + ' Z', 'ik', 2.2),
    C(p[1][0], p[1][1], 4, CPK.O),
    C(p[0][0], p[0][1], 4.2, CPK.Cl), C(p[3][0], p[3][1], 4.2, CPK.Cl),
    S(`M${p[5][0]} ${p[5][1]} L${p[5][0]} ${n(p[5][1] - 9)}`, 'ik', 2),
    C(p[5][0], n(p[5][1] - 9), 4.2, CPK.Cl),
  ];
});
def('stevia', () => [
  stalk('lo', 30, 54, 16),
  ...[[22, 40], [38, 40], [20, 28], [40, 28], [24, 18], [36, 18]].map(([x, y]) =>
    E(x, y, 5, 7, x < 30 ? 'bs' : 'hi')),
  ...[[22, 40], [38, 40], [20, 28], [40, 28], [24, 18], [36, 18]].map(([x, y]) =>
    S(`M${x} ${y - 5} L${x} ${y + 5}`, 'ik', .8)),
]);

/* plant — simple crop silhouettes, one recognisable trait each ───────────
 * horsetail is a thin CLUMP of jointed stems (a stand, the way it actually
 * grows), no thick filled block like sugarcane's single cane; aloe_vera is
 * a rosette of thick triangular spiked leaves, nothing like cactus's two
 * rounded columns; pineapple is the classic crown-on-a-crosshatched-oval;
 * spinach is rounded low oval leaves on short veins, not lettuce's pointed
 * leaf() cluster; acai is a small dark cluster UNDER a palm frond, unlike
 * grape's plain six-circle diamond; pomegranate is a round fruit with a
 * toothed crown calyx, unlike apple's single stem or tomato's star calyx;
 * goji is grain()'s pointed berry shape on a twig, distinct from acai's
 * plain circles; papaya is one big upright elongated oval, unlike
 * cucumber's rotated pointed one; broccoli is a stalk under a bumpy
 * granule-textured floret head, unlike cabbage's smooth concentric ball;
 * alfalfa is thin sprout stems each topped with a tiny three-leaflet
 * cluster, unlike legume's pod-of-peas.
 */
def('horsetail', () => [
  S('M20 54 L20 18', 'bs', 2.4), S('M30 54 L30 10', 'bs', 2.6), S('M40 54 L40 22', 'bs', 2.2),
  ...[20, 30, 40].flatMap(x => [24, 34, 44].map(y => S(`M${x - 3} ${y} L${x + 3} ${y}`, 'lo', 1.2))),
]);
def('aloe_vera', () => [
  ...[-45, -22, 0, 22, 45].map((rot, i) =>
    ['g', rot, 30, 52, [P('M30 52 L25 52 L29 20 L30 16 L31 20 L35 52 Z', i % 2 ? 'hi' : 'bs')]]),
]);
def('pineapple', () => [
  E(30, 38, 13, 17, 'bs'),
  ...[0, 1, 2, 3, 4].flatMap(row => [0, 1, 2].map(col => {
    const y = 26 + row * 6, x = 20 + col * 7 + (row % 2 ? 3 : 0);
    return [S(`M${x - 3} ${y - 3} L${x + 3} ${y + 3}`, 'lo', 1), S(`M${x + 3} ${y - 3} L${x - 3} ${y + 3}`, 'lo', 1)];
  }).flat()),
  ...[-20, -10, 0, 10, 20].map(rot => ['g', rot, 30, 18, [P('M30 18 L26 2 L30 10 L34 2 Z', 'hi')]]),
]);
def('spinach', () => [
  ...[[30, 40, 0, 'bs'], [18, 44, -25, 'hi'], [42, 44, 25, 'hi'], [22, 32, -40, 'bs'], [38, 32, 40, 'bs']]
    .map(([x, y, rot, role]) => ['g', rot, x, y, [E(x, y, 7, 10, role), S(`M${x} ${y - 8} L${x} ${y + 8}`, 'ik', 1)]]),
]);
def('acai', () => [
  S('M6 44 Q30 24 54 44', 'lo', 2.6),
  ...[[10, 42], [18, 36], [26, 34], [34, 34], [42, 36], [50, 42]].map(([x, y], i) =>
    leaf('hi', x, y, .3, i < 3 ? -60 : 60)),
  ...[[22, 48], [30, 44], [38, 48], [26, 54], [34, 54]].map(([x, y]) => C(x, y, 4, 'bs')),
]);
def('pomegranate', () => [
  E(30, 36, 17, 16, 'bs'),
  ...[-16, -6, 4, 14].map(x => P(`M${30 + x} 20 L${30 + x - 3} 12 L${30 + x + 3} 12 Z`, 'lo')),
  ...granules('hi', 8, 71, [18, 28, 42, 46]),
]);
def('goji', () => [
  S('M10 50 Q30 44 50 50', 'lo', 1.8),
  ...[[16, 42], [24, 36], [34, 34], [44, 40], [28, 46]].map(([x, y], i) => grain('bs', x, y, .9, i % 2 ? -20 : 20)),
]);
def('papaya', () => [
  E(30, 32, 12, 22, 'bs'), S('M30 10 L30 6', 'lo', 2), E(24, 24, 4, 6, 'hi'),
]);
def('broccoli', () => [
  P('M26 54 L34 54 L32 30 L28 30 Z', 'lo'),
  C(30, 26, 15, 'bs'),
  ...granules('hi', 10, 44, [17, 12, 43, 32]),
]);
def('alfalfa', () => [
  ...[[16, 54, 20], [30, 54, 10], [44, 54, 24]].map(([x, base, top]) =>
    [S(`M${x} ${base} L${x} ${top}`, 'lo', 1.4),
     ...[-1, 0, 1].map(i => leaf('bs', x + i * 4, top - 2, .28, i * 45))]).flat(),
]);

/* pathogens — closing the virus dead end, and the parasites/bacteria that
   never had a place before. A bacteriophage is drawn as `virus`'s own small
   capsid, landing on a bacterium instead of floating free; lysis is the same
   bacterium coming apart into fresh capsids; a prophage is that capsid's DNA
   folded into the host's own chromosome loop. */
def('bacteriophage', () => [rod3('hi', 30, 46, 13, 5),
                            P('M30 6 L38 10 L38 18 L30 22 L22 18 L22 10 Z', 'bs'),
                            S('M30 6 L38 10 L38 18 L30 22 L22 18 L22 10 Z', 'ik', 1.6),
                            S('M30 22 L30 33', 'ik', 2.4),
                            S('M30 32 Q22 36 17 42', 'ik', 1.4), S('M30 32 Q38 36 43 42', 'ik', 1.4)]);
def('prophage',     () => [ring('lo', 30, 32, 17, 3),
                           S('M15 24 A17 17 0 0 1 24 16', 'bs', 5), C(24, 16, 2.6, 'ik')]);
def('lysis',        () => [rod3('gh', 30, 32, 13, 5),
                           ...[[10, 10], [50, 10], [8, 32], [52, 32], [10, 54], [50, 54]].map(([x, y]) =>
                             P(`M${x} ${y - 4} L${x + 4} ${y - 2} L${x + 4} ${y + 2} L${x} ${y + 4} L${x - 4} ${y + 2} L${x - 4} ${y - 2} Z`, 'bs'))]);
def('protozoan',    () => [E(30, 32, 18, 13, 'bs'), C(34, 30, 5, 'hi'),
                           S('M46 32 Q54 28 52 20', 'lo', 2.2)]);
def('eimeria',       () => [E(30, 32, 16, 20, 'lo'),
                            ...[[24, 26], [36, 26], [24, 38], [36, 38]].map(([x, y]) => C(x, y, 4, 'hi'))]);
def('coccidiosis',  () => [S('M8 20 Q19 10 30 20 Q41 30 52 20', 'lo', 5),
                           S('M8 32 Q19 22 30 32 Q41 42 52 32', 'lo', 5),
                           S('M8 44 Q19 34 30 44 Q41 54 52 44', 'lo', 5),
                           ...[[18, 20], [34, 32], [22, 44]].map(([x, y]) => C(x, y, 3, 'bs'))]);
def('salmonella',   () => [rod3('bs', 30, 30, 14, 5),
                           ...[[10, 18], [8, 30], [10, 42]].map(([x, y]) => S(`M18 30 L${x} ${y}`, 'ik', 1.4))]);
def('viroid',       () => [ring('bs', 30, 32, 13, 3),
                           ...[0, 60, 120, 180, 240, 300].map(a => ['g', a, 30, 32, [S('M30 19 L30 15', 'ik', 1.4)]])]);

/* living — invertebrate/protist/vertebrate batch, real traits only ──────
 * a mix of marine invertebrates, single-celled protists, odd mammals and
 * birds, a couple of reptiles, and a handful of genuine outliers — two
 * physiology concepts (tickle, sneeze), two drug/history molecules
 * (mercaptopurine, chaulmoogra_ester), a slow bacterium (leprosy), and
 * two abstract-biology concepts (lamarckism, abo_blood_group, waggle_dance).
 * Each one is built around the ONE thing its fact line is actually about —
 * manatee's paddle tail versus dugong's forked fluke is the clearest case:
 * same silhouette, one tail shape swapped, because that is the entire
 * difference between the two animals.
 */
def('electric_eel', () => [
  S('M6 48 Q18 22 30 32 Q42 42 54 16', 'bs', 6),
  C(54, 14, 3, 'bs'),
  bolt('hi', 25, 12, .7),
  C(52, 13, 1, 'ik'),
]);
def('mantis_shrimp', () => [
  P('M10 40 Q12 22 30 20 Q44 20 44 30 Q44 36 36 36 Q40 42 32 46 Q18 48 10 40 Z', 'bs'),
  S('M36 26 L48 18', 'lo', 3),                                 // the cocked raptorial claw
  C(50, 16, 3, 'hi'),                                          // the flash-boiled bubble it strikes with
  ...[[-4, -4], [5, -2], [0, 5]].map(([dx, dy]) =>
    S(`M${50 + dx} ${16 + dy} L${53 + dx * 1.3} ${16 + dy * 1.3}`, 'ik', 1)),
]);
def('pistol_shrimp', () => [
  P('M8 40 Q10 24 26 22 Q38 22 38 30 Q38 36 30 36 Q34 42 28 46 Q16 48 8 40 Z', 'bs'),
  E(42, 24, 8, 6, 'hi'),                                       // the one oversized pistol claw
  S('M42 24 L34 28', 'lo', 2.2),
  S('M42 12 A12 12 0 0 1 42 36', 'gh', 1.6),                   // the shockwave it snaps out
  S('M42 6 A18 18 0 0 1 42 42', 'gh', 1.2),
]);
def('bombardier_beetle', () => [
  E(26, 32, 14, 9, 'bs'),
  E(13, 30, 6, 5, 'lo'),
  S('M20 24 L14 18 M32 24 L38 18', 'gh', 1.2),
  ...puff('gh', 46, 32, .7),                                   // the pulsed chemical spray, aimed backward
  C(52, 29, 1.4, 'ik'), C(54, 34, 1, 'ik'),
]);
def('tardigrade', () => [
  P('M18 18 Q30 10 42 18 Q50 30 42 44 Q30 52 18 44 Q10 30 18 18 Z', 'bs'),
  ...[18, 26, 34, 42].flatMap(y => [-1, 1].map(s =>
    S(`M${30 + s * 14} ${y} L${30 + s * 24} ${y}`, 'lo', 2.2))),  // four pairs of stubby legs
]);
def('coconut_crab', () => [
  E(28, 28, 13, 10, 'bs'),
  E(42, 26, 7, 6, 'hi'),                                       // the massive claw
  S('M35 24 L42 20 M35 30 L42 32', 'lo', 2),
  ...[-1, 1].flatMap(s => [36, 44, 52].map(y => S(`M${28 + s * 11} 30 L${28 + s * 18} ${y}`, 'lo', 1.8))),
  C(18, 48, 7, 'craft-lo'),                                    // the coconut, no borrowed shell in sight
]);
def('griffon_vulture', () => [
  P('M30 30 Q6 18 4 30 Q6 40 30 34 Q54 40 56 30 Q54 18 30 30 Z', 'bs'),  // broad soaring wings
  C(30, 20, 6, 'lo'),                                          // the bald head, shedding heat
  P('M30 24 L34 20 L30 18 Z', 'ik'),
  S('M18 30 L10 24 M42 30 L50 24', 'gh', 1.2),
]);
def('sponge', () => sponge('bs', 401));                        // a filter, pumping water through its own pores
def('comb_jelly', () => [
  E(30, 32, 14, 18, 'gh'),
  ...Array.from({ length: 8 }, (_, i) => S(`M${16 + i * 4} 18 L${16 + i * 4} 46`, i % 2 ? 'hi' : 'bs', 1.2)),
  C(30, 16, 2, 'ik'),
]);
def('hydra', () => [
  S('M30 50 L30 20', 'bs', 5),
  ...[-30, -10, 10, 30].map(a =>
    S(`M30 20 L${n(30 + 14 * Math.sin(a * Math.PI / 180))} ${n(6 - 4 * Math.cos(a * Math.PI / 180))}`, 'lo', 1.8)),
  S('M34 38 L46 34', 'bs', 3),                                 // the clone, budding off its own side
  ...[-20, 20].map(a =>
    S(`M46 34 L${n(46 + 8 * Math.sin(a * Math.PI / 180))} ${n(26 - 3 * Math.cos(a * Math.PI / 180))}`, 'lo', 1.2)),
]);
def('planarian', () => [
  P('M30 12 L20 20 Q10 30 16 44 Q22 52 30 52 Q38 52 44 44 Q50 30 40 20 Z', 'bs'),
  C(25, 22, 1.8, 'ik'), C(35, 22, 1.8, 'ik'),                  // cross-eyed eyespots
  S('M14 36 L46 36', 'gh', 1.2),                               // the cut, either side already regrowing
]);
def('leech', () => [
  P('M20 8 Q14 20 16 32 Q14 44 20 52 Q30 56 40 52 Q46 44 44 32 Q46 20 40 8 Q30 4 20 8 Z', 'bs'),
  E(30, 9, 6, 3, 'lo'), E(30, 51, 6, 3, 'lo'),                 // a sucker at both ends
  ...[16, 24, 32, 40, 48].map(y => S(`M20 ${y} L40 ${y}`, 'ik', .8)),
]);
def('ribbon_worm', () => [
  S('M8 10 Q26 24 12 36 Q30 44 22 54', 'bs', 3),
  S('M8 10 L2 2', 'lo', 2),                                    // the eversible proboscis, fired
  C(2, 2, 1.6, 'ik'),
]);
def('bryozoan', () => [
  S('M30 54 L30 10', 'lo', 2),
  ...Array.from({ length: 14 }, (_, i) => {
    const y = 12 + i * 3, side = i % 2 ? 1 : -1, len = 6 + (i % 3);
    return C(n(30 + side * len), y, 2, 'bs');                  // a colony of near-identical animals, one skeleton
  }),
]);
def('lampshell', () => [
  P('M14 26 Q30 14 46 26 Q46 32 30 34 Q14 32 14 26 Z', 'bs'),  // the valve on top
  P('M14 34 Q30 46 46 34 Q46 28 30 26 Q14 28 14 34 Z', 'hi'),  // the valve on the bottom, not the side
  S('M30 8 L30 20', 'lo', 1.6),                                // the pedicle, anchoring it
]);
def('velvet_worm', () => [
  E(24, 34, 18, 7, 'bs'),
  ...[8, 16, 24, 32, 40].map(x => S(`M${x} 40 L${x - 2} 46 M${x} 40 L${x + 2} 46`, 'lo', 1.4)),
  S('M42 30 L54 40', 'hi', 1.6), S('M42 38 L54 28', 'hi', 1.6), // two crossing jets of slime
]);
def('horseshoe_crab', () => [
  P('M10 30 Q10 12 30 12 Q50 12 50 30 Q50 38 30 38 Q10 38 10 30 Z', 'bs'),
  S('M30 38 L30 56', 'lo', 3),                                 // the long telson tail spike
  S('M18 30 L10 30 M42 30 L50 30', 'gh', 1),
]);
def('sea_spider', () => [
  C(30, 30, 4, 'bs'),                                          // a body reduced to almost nothing
  ...[[-24, -20], [-26, -6], [-26, 6], [-24, 20], [24, -20], [26, -6], [26, 6], [24, 20]].map(([dx, dy]) =>
    S(`M30 30 L${30 + dx} ${30 + dy}`, 'lo', 1.4)),
]);
def('tusk_shell', () => [
  P('M20 52 Q16 30 26 12 Q30 6 34 12 Q38 24 30 52 Z', 'bs'),   // tapering, open at both ends
  S('M30 52 L30 56', 'ik', 1.4),
  ...[-1, 0, 1].map(i => S(`M${30 + i * 2} 10 L${30 + i * 4} 2`, 'gh', 1)),  // thread-like tentacles
]);
def('sea_cucumber', () => [
  P('M10 30 Q10 20 30 20 Q50 20 50 30 Q50 40 30 40 Q10 40 10 30 Z', 'bs'),
  ...[16, 24, 32, 40, 46].map(x => C(x, x % 2 ? 24 : 36, 1.6, 'lo')),
  ...[[52, 26], [54, 30], [52, 34]].map(([x, y]) => S(`M50 30 L${x} ${y}`, 'gh', 1)),  // ejected sticky tubules
]);
def('feather_star', () => [
  C(30, 30, 4, 'bs'),
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60) * Math.PI / 180;
    return S(`M${n(30 + 4 * Math.cos(a))} ${n(30 + 4 * Math.sin(a))} L${n(30 + 20 * Math.cos(a))} ${n(30 + 20 * Math.sin(a))}`, 'lo', 2);
  }),
  ...[0, 2, 4].map(i => {
    const a = (i * 60) * Math.PI / 180, mx = n(30 + 12 * Math.cos(a)), my = n(30 + 12 * Math.sin(a));
    return S(`M${mx} ${my} L${n(mx + 5 * Math.sin(a))} ${n(my - 5 * Math.cos(a))}`, 'gh', 1);  // the feathery pinnae
  }),
]);
def('slug', () => [
  P('M10 38 Q10 26 24 24 Q44 22 50 30 Q52 40 40 44 Q22 48 10 38 Z', 'bs'),
  S('M14 24 Q10 14 6 12 M20 22 Q18 12 14 8', 'lo', 1.8),       // eye stalks, no shell anywhere
  C(6, 12, 1.4, 'ik'), C(14, 8, 1.4, 'ik'),
  S('M8 48 Q30 52 52 48', 'gh', 1),
]);
def('cuttlefish', () => [
  E(28, 26, 15, 12, 'bs'),
  ...Array.from({ length: 6 }, (_, i) => S(`M28 36 L${20 + i * 4} 52`, 'lo', 1.6)),
  C(36, 24, 4, 'hi'),
  S('M33 24 L35 26 L37 24 L39 26', 'ik', 1.2),                 // the W-shaped pupil, the real tell
]);
def('foraminifera', () => [
  ...Array.from({ length: 6 }, (_, i) => {
    const a = i * 55 * Math.PI / 180, rad = 4 + i * 3;
    return C(n(30 + rad * Math.cos(a)), n(30 + rad * Math.sin(a)), n(3 + i * .8), i % 2 ? 'hi' : 'bs');
  }),                                                            // one cell, coiling its own shell chamber by chamber
]);
def('radiolarian', () => [
  C(30, 30, 8, 'gh'),
  ring('ik', 30, 30, 8, 1.2),
  ...Array.from({ length: 12 }, (_, i) => {
    const a = i * 30 * Math.PI / 180;
    return S(`M${n(30 + 8 * Math.cos(a))} ${n(30 + 8 * Math.sin(a))} L${n(30 + 22 * Math.cos(a))} ${n(30 + 22 * Math.sin(a))}`, i % 3 ? 'bs' : 'hi', 1.4);
  }),                                                            // the intricate glassy skeleton, radiating
]);
def('dinoflagellate', () => [
  E(30, 30, 12, 10, 'bs'),
  ring('lo', 30, 30, 12, 1.4),                                 // the girdle flagellum, wrapped around
  S('M42 34 Q52 44 58 40', 'hi', 1.6),                         // the trailing flagellum
  C(20, 24, 1.6, 'gh'), C(36, 20, 1.2, 'gh'), C(14, 34, 1, 'gh'),  // the glow, when disturbed
]);
def('diatom_organism', () => [
  E(30, 26, 18, 10, 'hi'),                                     // the lid...
  E(30, 34, 18, 10, 'bs'),                                     // ...over the base, like a pillbox
  ...[-10, 0, 10].map(x => S(`M${30 + x} 26 L${30 + x} 42`, 'ik', 1)),
]);
def('euglena', () => [
  P('M30 12 Q42 22 40 36 Q38 50 30 52 Q22 50 20 36 Q18 22 30 12 Z', 'bs'),
  S('M30 12 Q26 4 18 2', 'hi', 1.6),                           // the whip, out front
  C(26, 26, 3, 'plant-bs'), C(34, 32, 2.4, 'plant-bs'),        // chloroplasts, borrowed like the plant does
  C(24, 20, 1.4, 'ik'),
]);
def('paramecium', () => [
  P('M14 24 Q10 12 26 10 Q46 8 48 24 Q50 38 40 46 Q28 52 18 42 Q10 34 14 24 Z', 'bs'),
  P('M22 30 Q30 26 36 32 Q32 38 24 36 Z', 'lo'),               // the oral groove
  ...Array.from({ length: 12 }, (_, i) => {
    const a = i * 30 * Math.PI / 180;
    return S(`M${n(30 + 22 * Math.cos(a))} ${n(30 + 22 * Math.sin(a))} L${n(30 + 26 * Math.cos(a))} ${n(30 + 26 * Math.sin(a))}`, 'gh', 1);
  }),                                                            // thousands of beating hairs, sampled
]);
def('manatee', () => [
  E(28, 32, 20, 12, 'bs'),
  P('M46 32 Q56 32 54 24 Q54 40 46 38 Z', 'lo'),               // a flat, rounded paddle tail
  E(12, 30, 5, 4, 'hi'),
  ...[8, 10, 12].map(x => S(`M${x} 32 L${x - 4} 34`, 'gh', .8)),
]);
def('dugong', () => [
  E(26, 32, 18, 10, 'bs'),
  P('M44 32 L56 22 L52 32 L56 42 Z', 'lo'),                    // the forked, dolphin-like fluke — not manatee's paddle
  E(10, 30, 4, 3.4, 'hi'),
]);
def('hyrax', () => [
  E(30, 34, 16, 12, 'bs'),
  C(44, 26, 6, 'bs'),
  C(41, 21, 2, 'lo'), C(47, 22, 2, 'lo'),                      // small rounded ears, no visible tail
  P('M10 46 L50 46 L46 52 L14 52 Z', 'ground'),                // the rock it dens in
]);
def('sengi', () => [
  E(26, 34, 13, 8, 'bs'),
  S('M38 32 Q48 32 50 38', 'lo', 2.4),                         // the long, flexible, elephant-kin snout
  ...[-6, -1, 5, 10].map(dx => S(`M${26 + dx} 41 L${26 + dx} 52`, 'lo', 1.6)),  // long legs, built to run
  S('M14 30 Q8 26 10 20', 'gh', 1.6),
]);
def('tenrec', () => [
  E(28, 34, 15, 10, 'bs'),
  ...Array.from({ length: 9 }, (_, i) => { const x = 16 + i * 4; return S(`M${x} 26 L${x - 1} 18`, 'lo', 1.6); }),
  E(42, 32, 4, 3, 'hi'),                                       // a shrew-long snout, under hedgehog spines
]);
def('golden_mole', () => [
  E(28, 34, 16, 9, 'bs'),
  E(14, 32, 5, 4, 'lo'),                                       // blind and earless, a smooth blunt head
  S('M8 40 Q20 44 32 40 Q44 44 54 40', 'gh', 1.4),             // the sand it swims through
  P('M18 40 L14 46 L22 44 Z', 'hi'),
]);
def('colugo', () => [
  P('M30 10 L10 30 L18 30 Q30 24 42 30 L50 30 Z', 'bs'),       // the gliding membrane, stretched kite-wide
  C(30, 14, 4, 'lo'),
  S('M18 30 L14 48 M42 30 L46 48', 'gh', 1.6),
]);
def('echidna', () => [
  P('M14 40 Q10 22 30 20 Q50 22 46 40 Q30 48 14 40 Z', 'bs'),
  ...Array.from({ length: 10 }, (_, i) => { const x = 14 + i * 3.6; return S(`M${x} 28 L${n(x - 1.5)} 18`, 'lo', 1.4); }),
  S('M12 34 Q4 34 4 40', 'hi', 2.4),                           // the long slender snout
  E(30, 46, 5, 3, 'gh'),                                       // the egg, in its own temporary pouch
]);
def('pangolin', () => [
  C(28, 32, 16, 'bs'),                                         // curled tight, the way it actually defends itself
  ...[4, 8, 12, 16].map(rad => S(`M${28 - rad} 32 A${rad} ${rad} 0 0 1 ${n(28 + rad * .3)} ${n(32 - rad * .95)}`, 'lo', 1.4)),
  P('M42 38 L52 46 L46 40 Z', 'hi'),                           // the scaled tail tip, peeking out
]);
def('tapir', () => [
  E(26, 34, 16, 11, 'bs'),
  P('M42 30 Q52 30 52 36 Q52 40 44 38 Z', 'lo'),               // the short flexible snout
  C(42, 28, 1.4, 'ik'),
  ...[-8, -2, 5, 10].map(dx => S(`M${26 + dx} 44 L${26 + dx} 52`, 'lo', 2)),
]);
def('giant_anteater', () => [
  E(24, 34, 12, 8, 'bs'),
  P('M34 32 Q52 30 56 34 Q52 38 34 36 Z', 'lo'),               // an even longer, tapering snout
  S('M56 34 L60 34', 'hi', 1.6),                               // the sticky tongue, flicked out the tip
  P('M10 24 Q0 10 10 4 Q20 10 16 26 Z', 'hi'),
]);
def('opossum', () => [
  E(28, 38, 15, 8, 'bs'),                                      // drawn on its side
  P('M40 36 L48 33 L48 39 Z', 'lo'),
  S('M14 40 Q4 44 4 52', 'gh', 1.6),                           // a naked, prehensile tail
  S('M32 34 L36 38 M36 34 L32 38', 'ik', 1.2),                 // playing dead
]);
def('wombat', () => [
  E(28, 36, 17, 11, 'bs'),
  C(44, 32, 6, 'bs'),
  E(10, 48, 8, 4, 'ground'),                                   // the burrow mouth
  ...[[20, 50], [26, 52], [32, 50]].map(([x, y]) => P(`M${x - 2} ${y - 2} L${x + 2} ${y - 2} L${x + 2} ${y + 2} L${x - 2} ${y + 2} Z`, 'lo')),  // cube droppings
]);
def('mesite', () => [
  E(28, 34, 13, 10, 'bs'),
  C(40, 27, 6, 'bs'),
  P('M20 32 L10 34 L20 38 Z', 'lo'),                           // a short, weak wing held low
  S('M26 44 L24 52 M32 44 L34 52', 'lo', 1.8),
  horizon('ground', 53),
]);
def('kagu', () => [
  E(28, 38, 11, 14, 'bs'),
  C(30, 20, 6, 'bs'),
  S('M27 14 Q22 4 16 6 M31 14 Q34 4 40 6', 'hi', 2),           // its loose head crest
  P('M36 20 L46 18 L46 22 Z', 'lo'),
  C(38, 19, 1, 'ik'),                                          // the nostril flap, found on no other bird
  S('M24 50 L22 58 M32 50 L34 58', 'lo', 1.8),
]);
def('sunbittern', () => [
  E(30, 40, 10, 12, 'bs'),
  P('M30 34 Q10 20 6 30 Q16 40 30 34 Z', 'lo'),                // a wing, fanned wide open
  P('M30 34 Q50 20 54 30 Q44 40 30 34 Z', 'lo'),
  C(14, 28, 4, 'hi'), C(46, 28, 4, 'hi'),                      // the huge fake eyespots
]);
def('turaco', () => [
  E(28, 34, 13, 10, 'bs'),
  C(40, 26, 7, 'bs'),
  S('M38 18 L34 10 M42 18 L46 10', 'hi', 2),                   // the crest
  P('M18 30 L8 32 L18 36 Z', 'lo'),                            // true pigment, not a trick of light
  P('M46 24 L52 26 L46 28 Z', 'ik'),
]);
def('hoatzin', () => [
  E(26, 36, 14, 10, 'bs'),
  C(40, 26, 6, 'bs'),
  S('M36 18 L33 10 M40 17 L40 8 M44 18 L47 10', 'hi', 1.8),    // a spiky crest
  E(30, 42, 6, 5, 'lo'),                                       // the oversized fermenting crop
  P('M16 32 L10 34 L13 37 Z', 'ik'),                           // a claw, on the wing
]);
def('seriema', () => [
  E(26, 32, 11, 9, 'bs'),
  C(36, 22, 6, 'bs'),
  S('M34 16 L32 8', 'hi', 2),
  S('M22 40 L18 54 M30 40 L28 54', 'lo', 2),
  S('M40 24 L48 34', 'ik', 1.6),                               // prey, gripped
  S('M48 34 Q40 44 30 46', 'gh', 1.2),                         // beaten against the ground
]);
def('cuckoo_roller', () => [
  E(28, 34, 12, 9, 'bs'),
  C(40, 26, 6, 'bs'),
  S('M16 36 Q4 38 4 50', 'lo', 4),                             // its own long tail, its own bird order
  ...[42, 46, 50].map(y => S(`M2 ${y} L10 ${y - 2}`, 'gh', 1.2)),
]);
def('tuatara', () => [
  E(26, 36, 15, 7, 'bs'),
  P('M40 34 L50 30 L50 38 Z', 'bs'),
  ...[16, 22, 28, 34].map(x => S(`M${x} 30 L${x} 24`, 'lo', 1.6)),  // the dorsal spine crest
  C(46, 32, 1, 'hi'),                                          // the light-sensing third eye
  S('M12 36 Q4 40 6 48', 'lo', 2.4),
]);
def('amphisbaenian', () => [
  S('M8 30 Q30 18 52 30', 'bs', 8),
  C(8, 30, 4, 'bs'), C(52, 30, 4, 'bs'),                       // both ends round alike — the "two-headed" illusion
  ...[16, 24, 32, 40].map(x => S(`M${x} ${n(26 - Math.abs(x - 30) * .2)} L${x} ${n(34 + Math.abs(x - 30) * .2)}`, 'ik', 1)),
]);
def('tickle', () => [
  S('M14 46 L14 20 Q14 14 20 14 L24 14 Q30 14 30 20', 'lo', 3),  // a hand, fingers up
  S('M40 30 Q48 26 40 20 Q48 16 40 10', 'bs', 2.6),            // a touch from outside, full signal
  S('M40 44 Q44 42 40 39 Q44 37 40 34', 'gh', 1.6),            // your own touch, predicted and dampened
]);
def('sneeze', () => [
  C(16, 32, 8, 'lo'),
  P('M24 30 L34 28 L34 34 Z', 'lo'),
  ...Array.from({ length: 7 }, (_, i) => {
    const a = (-20 + i * 10) * Math.PI / 180;
    return S(`M36 31 L${n(36 + 22 * Math.cos(a))} ${n(31 + 22 * Math.sin(a))}`, i % 2 ? 'hi' : 'bs', 1.4);
  }),                                                            // the plume, carrying for meters
]);
def('mercaptopurine', () => [
  ...purine('ik'),
  S('M22 46 L14 52', 'ik', 2), C(14, 52, 5, CPK.S),            // sulfur, where guanine carries oxygen
  C(28, 22, 3.4, CPK.N), C(38, 40, 3.4, CPK.N),
]);
def('chaulmoogra_ester', () => [
  backbone('ik', 6, 32, 34).shape,
  C(12, 30, 4.4, CPK.C), ...double([12, 30], [6, 24], 'ik'), C(6, 24, 4, CPK.O),  // the carbonyl
  S('M12 30 L12 40', 'ik', 2), C(12, 40, 4.4, CPK.O),          // the ester oxygen — finally soluble
  S('M12 40 L4 46', 'ik', 1.8), C(4, 46, 3.6, CPK.C),          // the ethyl tail Alice Ball added
]);
def('leprosy', () => [
  rod3('bs', 24, 30, 11, 5),
  rod3('gh', 40, 30, 9, 4),                                    // a second cell, only barely begun dividing
  S('M32 30 L34 30', 'ik', 1),
]);
def('lamarckism', () => [
  P('M14 52 L14 40 L20 14 L24 14 L20 40 L20 52 Z', 'lo'),      // the neck, at the start of a lifetime
  P('M40 52 L40 30 L44 6 L48 6 L46 30 L46 52 Z', 'bs'),        // already stretched, passed straight on
  S('M26 20 Q33 14 40 12', 'ik', 1.6),
  P('M40 12 L36 13 L39 16 Z', 'ik'),
]);
def('abo_blood_group', () => [
  P('M30 10 Q42 26 42 38 Q42 50 30 50 Q18 50 18 38 Q18 26 30 10 Z', 'gh'),
  C(24, 34, 3, 'bs'), C(30, 30, 3, 'bs'),                      // loose cells, still round
  C(38, 40, 3, 'lo'), C(43, 42, 3, 'lo'), C(40, 46, 3, 'lo'),  // clumped — the wrong mix
]);
def('waggle_dance', () => [
  S('M30 30 Q14 22 20 12 Q26 4 30 30 Q34 4 40 12 Q46 22 30 30', 'lo', 2.2),  // the figure-eight
  S('M22 40 L38 20', 'bs', 3),                                 // the waggle run, at its telling angle
  C(46, 8, 3, 'fire-bs'),                                      // the Sun, the angle's own reference
]);

/* food100 batch 1 — vegetables ─────────────────────────────────────────── */
def('sweet_potato', () => [                                // tapered, no eyes — unlike potato
  P('M14 34 Q14 19 30 17 Q46 19 46 34 Q46 49 30 51 Q14 49 14 34 Z', 'bs'),
  S('M19 26 Q30 22 41 26', 'lo', 1.4),
  S('M30 17 L28 10', 'plant-lo', 1.6),
]);
def('cauliflower', () => [                                 // curd wrapped in leaves, bumpier than broccoli
  leaf('lo', 13, 42, .6, -55), leaf('lo', 47, 42, .6, 55),
  C(30, 27, 16, 'bs'),
  ...granules('hi', 16, 61, [15, 13, 45, 34]),
]);
def('zucchini', () => [                                    // straight cylinder, blossom-end taper
  P('M18 14 Q16 14 16 19 L16 40 Q16 51 26 53 L34 53 Q44 51 44 40 L44 19 Q44 14 42 14 Z', 'bs'),
  S('M22 20 L23 47', 'hi', 1.6), S('M30 17 L30 51', 'hi', 1.2),
  S('M30 14 L30 7', 'plant-lo', 2),
]);
def('eggplant', () => [                                    // teardrop, green calyx cap
  P('M30 15 Q46 21 46 37 Q46 53 30 55 Q14 53 14 37 Q14 21 30 15 Z', 'bs'),
  ...[-1, 0, 1].map(i => leaf('plant-bs', 30 + i * 7, 13, .4, i * 40)),
  E(24, 27, 5, 7, 'hi'),
]);
def('asparagus', () => [                                   // a bundle of spears, scaled tips
  ...[18, 30, 42].map((x, i) => [
    P(`M${x - 3} 52 L${x - 2} 15 Q${x} 9 ${x + 2} 15 L${x + 3} 52 Z`, i % 2 ? 'bs' : 'hi'),
    ...[19, 25, 31].map(y => S(`M${x - 2} ${y} L${x + 2} ${y - 3}`, 'lo', 1)),
  ]).flat(),
]);
def('radish', () => [                                      // round, red-shouldered, taproot tail
  E(30, 34, 13, 13, 'bs'),
  S('M30 47 L30 54', 'lo', 2),
  ...[[24, 20], [30, 15], [36, 20]].map(([x, y]) => leaf('plant-bs', x, y, .5)),
  E(25, 29, 3, 3, 'hi'),
]);
def('turnip', () => [                                      // two-tone bulb: pale below, coloured shoulder
  P('M17 30 A13 13 0 0 0 43 30 L43 34 Q43 48 30 50 Q17 48 17 34 Z', 'hi'),
  P('M17 30 A13 13 0 0 1 43 30 Q30 22 17 30 Z', 'bs'),
  ...[[24, 16], [30, 11], [36, 16]].map(([x, y]) => leaf('plant-bs', x, y, .55)),
]);
def('leek', () => [                                        // pale shaft, fanning dark leaves, roots
  P('M24 54 L24 27 Q24 21 30 21 Q36 21 36 27 L36 54 Z', 'hi'),
  ...[-1, 1].map(i => P(`M30 25 L${30 + i * 3} 25 L${30 + i * 11} 6 L${30 + i * 2} 10 Z`, 'bs')),
  ...granules('lo', 5, 5, [26, 52, 34, 58]),
]);
def('brussels_sprout', () => [                             // small buds up a thick stalk, helical
  S('M30 8 L30 54', 'lo', 3),
  ...[[22, 16], [38, 22], [22, 28], [38, 34], [22, 40], [38, 46]].map(([x, y], i) =>
    C(x, y, 6.4, i % 2 ? 'hi' : 'bs')),
]);
def('kale', () => [                                        // ruffled fanning leaves, no head
  ...[[30, 16, 0], [16, 30, -55], [44, 30, 55], [22, 44, -25], [38, 44, 25]].map(([x, y, rot]) =>
    ['g', rot, x, y, [P(`M${x} ${y - 12} Q${x + 12} ${y - 4} ${x + 4} ${y + 6} Q${x} ${y + 2} ${x - 4} ${y + 6} Q${x - 12} ${y - 4} ${x} ${y - 12} Z`, 'bs')]]),
  S('M30 52 L30 40', 'lo', 2.4),
]);
def('artichoke', () => [                                   // layered bract-scales on a bud
  P('M30 12 Q44 18 44 34 Q44 50 30 54 Q16 50 16 34 Q16 18 30 12 Z', 'bs'),
  ...[[22, 24], [38, 24], [21, 37], [39, 37], [30, 45], [30, 20]].map(([x, y]) =>
    P(`M${x} ${y - 6} Q${x + 5} ${y} ${x} ${y + 6} Q${x - 5} ${y} ${x} ${y - 6} Z`, 'hi')),
]);
def('okra', () => [                                        // ridged, pointed pod
  P('M30 9 Q37 9 37 20 L34 51 Q34 55 30 55 Q26 55 26 51 L23 20 Q23 9 30 9 Z', 'bs'),
  ...[24, 30, 36].map(x => S(`M${x} 16 L${x} 50`, 'lo', 1)),
  leaf('plant-bs', 30, 7, .4),
]);
def('mushroom', () => [                                    // domed cap, thick stem — unlike shiitake/maitake
  P('M9 25 Q9 9 30 9 Q51 9 51 25 Z', 'bs'),
  P('M24 25 L36 25 L34 53 L26 53 Z', 'hi'),
  ...[15, 21, 27, 33, 39, 45].map(x => S(`M${x} 24 L${x} 19`, 'ik', 1)),
]);
def('avocado', () => [                                     // pear-shape, cut to show the pit
  P('M30 9 Q42 13 44 27 Q46 43 34 51 Q30 53 26 51 Q14 43 16 27 Q18 13 30 9 Z', 'lo'),
  P('M30 13 Q40 17 42 27 Q44 41 32 49 Q30 50 28 49 Q16 41 18 27 Q20 17 30 13 Z', 'bs'),
  C(30, 33, 9, 'hi'),
]);
def('arugula', () => [                                     // small jagged lobed leaves
  ...[[22, 40, -20], [38, 40, 20], [30, 46, 0], [24, 28, -30], [36, 28, 30]].map(([x, y, rot]) =>
    leaf('bs', x, y, .4, rot)),
  S('M30 50 L30 40', 'lo', 1.6),
]);
def('rhubarb', () => [                                     // prominent red stalks, one modest leaf
  ...[22, 30, 38].map(x => S(`M${x} 52 Q${x} 30 ${x} 13`, 'bs', 4)),
  leaf('plant-lo', 30, 9, .8),
]);
def('watercress', () => [                                  // round leaflets on a floating stem
  S('M16 44 Q24 38 32 44 Q40 38 30 24', 'lo', 1.4),
  ...[[16, 44], [24, 38], [32, 44], [40, 38], [24, 30], [36, 30], [30, 24]].map(([x, y]) =>
    C(x, y, 4, 'bs')),
]);

/* food100 batch 2 — fruits ─────────────────────────────────────────────── */
def('orange', () => [                                       // round citrus, one wedge cut to show segments
  C(30, 32, 16, 'bs'),
  P('M30 32 L30 17 A15 15 0 0 1 43 39 Z', 'hi'),
  S('M32 22 L38 33', 'lo', 1), S('M32 26 L40 34', 'lo', 1), S('M31 30 L41 36', 'lo', 1),
  S('M30 17 L28 11', 'plant-lo', 1.6),
]);
def('grapefruit', () => [                                   // bigger, thicker rind band than orange
  C(30, 32, 17, 'lo'),
  C(30, 32, 14, 'bs'),
  P('M30 32 L30 20 A12 12 0 0 1 41 39 Z', 'hi'),
]);
def('peach', () => [                                        // the cleft is the tell
  C(30, 32, 16, 'bs'),
  S('M30 17 Q27 32 30 47', 'lo', 1.6),
  leaf('plant-bs', 41, 17, .4, 30),
]);
def('plum', () => [                                         // small, dark, a bloom highlight
  E(30, 33, 13, 12, 'lo'),
  E(30, 33, 12, 11, 'bs'),
  E(24, 27, 4, 3, 'hi'),
  S('M30 21 L29 15', 'lo', 1.4),
]);
def('apricot', () => [                                      // fuzzed skin, a cleft, cut to the stone
  E(30, 32, 13, 12, 'bs'),
  S('M30 20 Q28 32 30 44', 'lo', 1.4),
  C(30, 32, 4, 'hi'),
  ...[[22, 24], [38, 24], [22, 40], [38, 40]].map(([x, y]) => S(`M${x} ${y} L${x < 30 ? x - 2 : x + 2} ${y}`, 'gh', 1)),
]);
def('nectarine', () => [                                    // same fruit as peach, no fuzz — a gloss instead
  C(30, 32, 15, 'bs'),
  E(23, 23, 6, 8, 'hi'),
  S('M30 18 L29 13', 'lo', 1.4),
]);
def('watermelon', () => [                                   // striped rind, cut to pink flesh and seeds
  E(30, 32, 18, 15, 'bs'),
  S('M20 19 Q17 32 20 45', 'lo', 1.6), S('M30 17 Q27 32 30 47', 'lo', 1.6), S('M40 19 Q43 32 40 45', 'lo', 1.6),
  P('M30 32 L30 17 A15 15 0 0 1 44 38 Z', 'hi'),
  ...[[34, 26], [38, 30], [36, 34]].map(([x, y]) => E(x, y, 1.4, 2, 'ik')),
]);
def('cantaloupe', () => [                                   // netted rind, cut to orange flesh
  C(30, 32, 16, 'bs'),
  ...granules('lo', 16, 27, [16, 18, 44, 46]),
  P('M30 32 L30 17 A15 15 0 0 1 44 39 Z', 'hi'),
]);
def('kiwi', () => [                                         // the iconic radiating cross-section
  C(30, 32, 15, 'lo'), C(30, 32, 12, 'hi'), C(30, 32, 4, 'bs'),
  ...Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return S(`M${n(30 + 4 * Math.cos(a))} ${n(32 + 4 * Math.sin(a))} L${n(30 + 11 * Math.cos(a))} ${n(32 + 11 * Math.sin(a))}`, 'ik', .8);
  }),
]);
def('raspberry', () => [                                    // drupelet dome, hollow core — comes off the plant
  ...[[24, 26], [36, 25], [30, 20], [22, 34], [38, 34], [30, 38], [26, 30], [34, 30]].map(([x, y]) => C(x, y, 4.2, 'bs')),
  C(30, 29, 2, 'gh'),
]);
def('blackberry', () => [                                   // drupelet cluster, solid core — stays on picking
  ...[[26, 22], [34, 22], [22, 30], [30, 28], [38, 30], [26, 38], [34, 38], [30, 44]].map(([x, y]) => C(x, y, 4, 'lo')),
  C(30, 30, 3, 'bs'),
]);
def('cranberry', () => [                                    // floating on the flooded bog water
  wave('lo', 44, 4, 22),
  ...[[20, 36], [30, 32], [40, 38], [26, 40], [34, 42]].map(([x, y]) => C(x, y, 5, 'bs')),
  ...[[20, 36], [30, 32], [40, 38]].map(([x, y]) => C(x - 1, y - 1, 1.4, 'hi')),
]);
def('blueberry', () => [                                    // the 5-point crown on each berry is the tell
  ...[[22, 30], [34, 26], [26, 40], [38, 38], [30, 32]].map(([x, y]) => [
    C(x, y, 6, 'bs'),
    ...Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2;
      return S(`M${x} ${y} L${n(x + 2 * Math.cos(a))} ${n(y + 2 * Math.sin(a))}`, 'ik', .8);
    }),
  ]).flat(),
]);
def('date', () => [                                         // a hanging bunch, oval and dark
  S('M14 16 Q30 10 46 16', 'lo', 2),
  ...[[20, 26], [30, 22], [40, 28], [24, 38], [36, 38]].map(([x, y]) => E(x, y, 5, 8, 'bs')),
]);
def('persimmon', () => [                                    // flat-round, a 4-lobed calyx cap
  E(30, 35, 16, 14, 'bs'),
  leaf('plant-lo', 24, 19, .45, -25), leaf('plant-lo', 36, 19, .45, 25),
  leaf('plant-lo', 28, 16, .45, -95), leaf('plant-lo', 32, 16, .45, 95),
]);
def('guava', () => [                                        // cut to show the pink flesh and seeds
  E(30, 32, 14, 15, 'lo'),
  P('M30 32 L30 18 A14 14 0 0 1 42 40 Z', 'hi'),
  ...granules('bs', 10, 33, [24, 26, 38, 38]),
]);

/* food100 batch 3 — grains, legumes, a bean family ─────────────────────── */
def('rye', () => [                                          // slender awned spike, single file
  stalk('lo', 30, 54, 12),
  ...Array.from({ length: 6 }, (_, i) => grain('bs', 30 + (i % 2 ? 3 : -3), 15 + i * 6, .8, i % 2 ? 20 : -20)),
  ...[15, 21, 27].map(y => S(`M28 ${y} L23 ${y - 6}`, 'gh', 1)),
]);
def('quinoa', () => [                                       // a bushy branched panicle, not a linear head
  stalk('lo', 30, 54, 20),
  ...[[22, 16], [30, 10], [38, 16], [26, 22], [34, 22], [30, 18]].map(([x, y]) => C(x, y, 2.6, 'bs')),
]);
def('buckwheat', () => [                                    // the three-cornered seed is the whole tell
  ...[[20, 24], [34, 20], [26, 36], [40, 34], [30, 46]].map(([x, y], i) =>
    P(`M${x} ${y - 5} L${x + 5} ${y + 4} L${x - 5} ${y + 4} Z`, i % 2 ? 'hi' : 'bs')),
]);
def('millet', () => [                                       // a dense bottlebrush spike
  S('M30 52 L30 10', 'lo', 2),
  ...Array.from({ length: 14 }, (_, i) => C(30 + (i % 2 ? 3 : -3), 13 + i * 2.6, 2, i % 2 ? 'hi' : 'bs')),
]);
def('sorghum', () => [                                      // a loose head, bigger seeds than millet
  stalk('lo', 30, 54, 24),
  ...[[24, 16], [36, 16], [20, 22], [30, 14], [40, 22], [26, 26], [34, 26]].map(([x, y]) => C(x, y, 3.4, 'bs')),
]);
def('chickpea', () => [                                     // round, with the point that gives it the name
  P('M12 30 Q30 16 48 30 Q30 42 12 30 Z', 'lo'),
  ...[20, 30, 40].map(x => [C(x, 30, 5, 'bs'), S(`M${x} 25 L${x} 23`, 'hi', 1.4)]).flat(),
]);
def('bean', () => [                                         // the plain kidney silhouette — the base cultivar
  P('M20 20 Q40 14 42 30 Q44 46 26 46 Q10 46 12 30 Q14 22 20 20 Z', 'bs'),
  E(24, 26, 4, 3, 'hi'),
]);
def('black_bean', () => [                                   // same silhouette, dark and shining
  P('M20 20 Q40 14 42 30 Q44 46 26 46 Q10 46 12 30 Q14 22 20 20 Z', 'lo'),
  E(22, 24, 3, 2, 'hi'),
]);
def('pinto_bean', () => [                                   // the silhouette, but mottled — "painted"
  P('M20 20 Q40 14 42 30 Q44 46 26 46 Q10 46 12 30 Q14 22 20 20 Z', 'hi'),
  ...granules('lo', 11, 71, [16, 22, 38, 42]),
]);
def('kidney_bean', () => [                                  // bigger, the notch emphasised
  P('M18 18 Q42 12 44 28 Q46 48 28 48 Q8 48 10 28 Q10 20 18 18 Z', 'bs'),
  P('M18 18 Q24 24 22 30 Q20 24 18 18 Z', 'lo'),
]);
def('semolina', () => [                                     // coarse pointed grains, not flour's fine dust
  mound('lo', 46, 20, 18),
  ...[[18, 38], [26, 42], [34, 40], [42, 38], [22, 46], [38, 46], [30, 36]].map(([x, y], i) =>
    grain('bs', x, y, 1.1, i % 2 ? -20 : 20)),
]);
def('couscous', () => [                                     // rolled into round pellets, then steamed
  round('lo', 40, 20, 9),
  ...granules('hi', 22, 88, [14, 30, 46, 48]),
]);

/* food100 batch 4 — spices ──────────────────────────────────────────────── */
def('cinnamon', () => [                                     // a bark stick, spiral-rolled end showing
  S('M16 44 L44 16', 'bs', 8),
  ['s', 'M40 12 A6 6 0 1 1 39.9 12', 'lo', 2],
  ['s', 'M40 12 A3 3 0 1 1 39.9 12', 'hi', 1.4],
]);
def('nutmeg', () => [                                       // an oval seed, grain lines lengthwise
  E(30, 32, 14, 17, 'bs'),
  S('M24 18 Q26 32 24 46', 'lo', 1.2), S('M30 16 Q32 32 30 48', 'lo', 1.2), S('M36 18 Q38 32 36 46', 'lo', 1.2),
]);
def('clove', () => [                                        // the nail shape it's named for
  C(30, 18, 7, 'bs'),
  P('M27 24 L33 24 L31 52 L29 52 Z', 'lo'),
  ...[0, 90, 180, 270].map(a => S(`M30 18 L${n(30 + 9 * Math.cos(a * Math.PI / 180))} ${n(18 + 9 * Math.sin(a * Math.PI / 180))}`, 'hi', 1.6)),
]);
def('cardamom', () => [                                     // triangular cross-section, spindle-shaped
  P('M30 10 L42 24 L36 50 L24 50 L18 24 Z', 'bs'),
  S('M30 10 L30 50', 'lo', 1), S('M30 10 L42 24', 'lo', 1), S('M30 10 L18 24', 'lo', 1),
]);
def('vanilla', () => [                                      // a long thin curved pod
  P('M14 50 Q10 30 22 12 Q26 10 28 14 Q18 30 22 48 Z', 'bs'),
  S('M18 44 Q16 30 24 16', 'hi', 1),
]);
def('saffron', () => [                                      // three thread-thin crimson stigmas
  ...[[20, 44, -15], [30, 42, 0], [40, 44, 15]].map(([x, y, rot]) =>
    ['g', rot, x, y, [S(`M${x} ${y} Q${x - 2} ${y - 14} ${x + 3} ${y - 26}`, 'bs', 2.4), C(x + 3, y - 26, 1.6, 'hi')]]),
]);
def('fennel', () => [                                       // a bulb, with frond wisps rising off it
  E(30, 42, 15, 11, 'bs'),
  ...[22, 30, 38].map(x => S(`M${x} 32 L${x} 12`, 'lo', 1.6)),
  ...[22, 30, 38].flatMap(x => [S(`M${x} 16 Q${x - 6} 10 ${x - 10} 6`, 'hi', 1), S(`M${x} 16 Q${x + 6} 10 ${x + 10} 6`, 'hi', 1)]),
]);
def('mustard_seed', () => [                                 // a thin pod, small round seeds inside
  P('M16 30 Q30 16 44 30 Q30 26 16 30 Z', 'lo'),
  ...[[22, 30], [27, 28], [32, 30], [37, 28]].map(([x, y]) => C(x, y, 3, 'bs')),
]);
def('allspice', () => [                                     // dried round, like a large rough peppercorn
  C(30, 32, 10, 'bs'),
  ...granules('lo', 6, 41, [22, 24, 38, 40]),
]);
def('star_anise', () => [                                   // the eight-point star, whole
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return P(`M30 30 L${n(30 + 16 * Math.cos(a - 0.2))} ${n(30 + 16 * Math.sin(a - 0.2))} L${n(30 + 16 * Math.cos(a + 0.2))} ${n(30 + 16 * Math.sin(a + 0.2))} Z`, 'bs');
  }),
  C(30, 30, 4, 'lo'),
]);
def('wasabi', () => [                                       // a knobbly rhizome, grated pile beside it
  P('M22 14 Q14 20 16 30 Q12 40 20 46 Q28 50 30 42 Q34 48 40 42 Q46 36 40 28 Q44 18 34 16 Q28 10 22 14 Z', 'bs'),
  ...granules('hi', 6, 29, [20, 36, 38, 46]),
]);

/* food100 batch 5 — nuts and named cheeses ──────────────────────────────── */
def('cashew', () => [                                        // the boxing-glove curve is the tell
  P('M20 20 Q10 24 12 36 Q14 48 26 48 Q40 48 40 34 Q40 22 28 18 Q22 16 20 20 Z', 'bs'),
  E(24, 26, 4, 3, 'hi'),
]);
def('pistachio', () => [                                     // the shell, split, green nut showing through
  P('M22 14 Q16 20 16 32 Q16 46 30 50 Q44 46 44 32 Q44 20 38 14 Z', 'lo'),
  S('M30 16 Q30 30 30 48', 'ik', 1.6),
  E(26, 30, 3, 8, 'bs'), E(34, 30, 3, 8, 'bs'),
]);
def('pecan', () => [                                          // two elongated wrinkled lobes, husk cracked open
  P('M22 14 Q14 22 16 32 Q14 44 24 50 Q28 44 26 32 Q28 20 22 14 Z', 'bs'),
  P('M38 14 Q46 22 44 32 Q46 44 36 50 Q32 44 34 32 Q32 20 38 14 Z', 'bs'),
  S('M20 20 Q18 32 22 44', 'lo', 1), S('M40 20 Q42 32 38 44', 'lo', 1),
]);
def('hazelnut', () => [                                       // round, with its own frilly husk collar
  C(30, 34, 13, 'bs'),
  P('M17 26 Q30 14 43 26 Q30 20 17 26 Z', 'lo'),
  C(30, 20, 2, 'lo'),
]);
def('macadamia', () => [                                      // just about a perfect sphere — the tell
  C(30, 32, 15, 'bs'),
  E(24, 26, 4, 3, 'hi'),
  S('M18 32 Q30 36 42 32', 'lo', 1),
]);
def('mozzarella', () => [                                     // a glossy ball sitting in its own liquid
  wave('gh', 46, 3, 18),
  C(30, 32, 14, 'hi'),
  E(24, 27, 4, 3, 'bs'),
]);
def('cheddar', () => [                                        // a wedge, not a block — cut, stacked, turned
  P('M14 44 L46 44 L30 14 Z', 'bs'),
  P('M14 44 L46 44 L44 40 L16 40 Z', 'lo'),
]);
def('parmesan', () => [                                       // a wedge, grainy with its own crystals
  P('M14 44 L46 44 L30 14 Z', 'lo'),
  ...granules('hi', 11, 59, [18, 24, 42, 42]),
]);
def('feta', () => [                                           // crumbly cubes, sitting in brine
  wave('gh', 46, 2, 20),
  ...[[20, 36], [30, 32], [40, 38], [26, 42]].map(([x, y]) =>
    P(`M${x - 5} ${y - 5} L${x + 5} ${y - 5} L${x + 5} ${y + 5} L${x - 5} ${y + 5} Z`, 'hi')),
]);
def('cottage_cheese', () => [                                 // a bowl of loose irregular curds
  round('lo', 40, 20, 9),
  ...[[20, 36], [26, 32], [32, 36], [38, 32], [24, 40], [34, 40]].map(([x, y]) => E(x, y, 3.4, 2.6, 'hi')),
]);
def('evaporated_milk', () => [                                // a plain can
  P('M18 14 L42 14 L42 50 L18 50 Z', 'hi'),
  E(30, 14, 12, 3, 'lo'), E(30, 50, 12, 3, 'lo'),
  S('M18 24 L42 24', 'ik', 1),
]);
def('condensed_milk', () => [                                 // a can, with the thick sweet drizzle it's known for
  P('M18 18 L42 18 L42 50 L18 50 Z', 'lo'),
  E(30, 18, 12, 3, 'hi'), E(30, 50, 12, 3, 'hi'),
  P('M30 50 Q26 56 30 60 Q34 56 30 50 Z', 'bs'),
]);
def('custard', () => [                                        // a smooth bowl, its own skin catching the light
  round('lo', 40, 20, 10),
  E(30, 33, 17, 7, 'hi'),
  S('M20 33 Q30 30 40 33', 'gh', 1),
]);

/* food100 batch 6 — pantry condiments and staples ───────────────────────── */
def('ketchup', () => [                                        // the classic squeeze-bottle neck
  P('M22 10 L38 10 L38 20 L34 24 L34 50 Q34 54 30 54 Q26 54 26 50 L26 24 L22 20 Z', 'bs'),
]);
def('maple_syrup', () => [                                    // a jug, with the handle
  P('M20 14 L40 14 L40 48 Q40 54 34 54 L26 54 Q20 54 20 48 Z', 'gh'),
  P('M22 30 L38 30 L38 48 Q38 52 34 52 L26 52 Q22 52 22 48 Z', 'bs'),
  P('M40 20 Q48 20 48 28 Q48 34 40 32', 'lo'),
]);
def('peanut_butter', () => [                                  // a straight-sided jar, a lid band
  P('M18 20 L42 20 L42 50 Q42 54 38 54 L22 54 Q18 54 18 50 Z', 'bs'),
  P('M16 16 L44 16 L44 22 L16 22 Z', 'lo'),
]);
def('jam', () => [                                            // the jar, with its cloth cap tied over
  P('M18 22 L42 22 L42 50 Q42 54 38 54 L22 54 Q18 54 18 50 Z', 'hi'),
  C(30, 16, 13, 'lo'),
  S('M18 16 Q30 24 42 16', 'ik', 1),
]);
def('cornstarch', () => [                                     // a tall box, a flap-top
  P('M16 14 L44 14 L44 54 L16 54 Z', 'hi'),
  P('M16 14 L44 14 L40 22 L20 22 Z', 'lo'),
]);
def('baking_soda', () => [                                    // a low wide box, banded label
  P('M14 24 L46 24 L46 52 L14 52 Z', 'bs'),
  P('M14 24 L46 24 L46 30 L14 30 Z', 'lo'),
]);
def('baking_powder', () => [                                  // a squat round tin
  P('M18 26 L42 26 L42 50 L18 50 Z', 'lo'),
  E(30, 26, 12, 3.4, 'hi'),
  S('M18 34 L42 34', 'ik', 1),
]);
def('worcestershire_sauce', () => [                            // a tall thin bottle, dark
  P('M26 8 L34 8 L34 18 L37 22 L37 50 Q37 54 33 54 L27 54 Q23 54 23 50 L23 22 L26 18 Z', 'lo'),
]);
def('hot_sauce', () => [                                       // a slim bottle, capped
  P('M24 12 L36 12 L36 20 L39 24 L39 50 Q39 54 35 54 L25 54 Q21 54 21 50 L21 24 L24 20 Z', 'bs'),
  C(30, 10, 3, 'lo'),
]);
def('tahini', () => [                                          // a shorter, wider paste jar
  P('M16 26 L44 26 L44 50 Q44 54 40 54 L20 54 Q16 54 16 50 Z', 'bs'),
  S('M20 32 Q30 28 40 32 Q30 36 20 32', 'hi', 1.4),
]);
def('vanilla_extract', () => [                                 // a small tincture bottle
  P('M27 8 L33 8 L33 16 L36 20 L36 50 Q36 54 32 54 L28 54 Q24 54 24 50 L24 20 L27 16 Z', 'lo'),
]);
def('mustard', () => [                                         // a rounder squeeze bottle than ketchup's
  P('M20 16 L40 16 L40 24 L36 28 L36 50 Q36 54 32 54 L28 54 Q24 54 24 50 L24 28 L20 24 Z', 'bs'),
]);

/* food100 batch 7 — seafood ─────────────────────────────────────────────── */
def('shrimp', () => [                                          // the classic C-curve, tail fan, walking legs
  P('M14 40 Q14 20 34 16 Q46 16 46 26 Q46 34 36 34 Q40 40 34 46 Q24 50 14 40 Z', 'bs'),
  ...[20, 26, 32].map(x => S(`M${x} 44 L${x - 2} 50`, 'lo', 1.2)),
  C(38, 20, 1.6, 'ik'),
]);
def('crab', () => [                                            // top-down: shell, claws, legs sideways
  E(30, 32, 16, 12, 'bs'),
  ...[-1, 1].map(s => P(`M${30 + s * 16} 26 Q${30 + s * 24} 20 ${30 + s * 28} 24 Q${30 + s * 24} 28 ${30 + s * 18} 30 Z`, 'lo')),
  ...[-1, 1].flatMap(s => [16, 24, 32].map(y => S(`M${30 + s * 14} ${y} L${30 + s * 22} ${y + 4}`, 'lo', 1.4))),
]);
def('lobster', () => [                                         // body, tail fan, the two big front claws
  E(28, 32, 14, 7, 'bs'),
  P('M42 32 L52 27 L52 37 Z', 'lo'),
  E(12, 22, 6, 4, 'hi'), E(12, 42, 6, 4, 'hi'),
  S('M18 22 L14 22', 'ik', 1.6), S('M18 42 L14 42', 'ik', 1.6),
]);
def('salmon', () => [                                          // the leap upstream, arced
  P('M10 44 Q20 14 40 14 Q54 16 50 26 Q40 22 30 30 Q34 40 24 46 Q16 50 10 44 Z', 'bs'),
  C(38, 18, 1.8, 'ik'),
  S('M26 30 Q28 36 24 42', 'hi', 1.4),
]);
def('tuna', () => [                                            // torpedo body, small dorsal, forked tail
  E(26, 32, 18, 9, 'bs'),
  P('M44 32 L56 24 L56 40 Z', 'lo'),
  S('M50 30 L54 32 L50 34', 'gh', 1),
  P('M28 22 L32 13 L34 22 Z', 'hi'),
  C(14, 30, 1.6, 'ik'),
]);

/* food100 batch 8 — prepared dishes ─────────────────────────────────────── */
def('guacamole', () => [                                       // the mound, and a chip stuck in
  round('lo', 40, 20, 9),
  P('M14 40 Q30 22 46 40 Z', 'bs'),
  P('M36 24 L46 14 L44 26 Z', 'grain-hi'),
]);
def('hummus', () => [                                          // swirled, an oil pool at the centre
  round('lo', 40, 20, 9),
  E(30, 36, 15, 6, 'hi'),
  C(30, 36, 3, 'bs'),
  ...[22, 38].map(x => C(x, 32, 2, 'grain-bs')),
]);
def('salsa', () => [                                           // chunky diced squares, not round grains
  round('lo', 40, 20, 9),
  ...[[18, 32], [26, 28], [34, 34], [40, 30], [22, 40], [36, 40], [30, 26]].map(([x, y], i) =>
    P(`M${x - 3} ${y - 3} L${x + 3} ${y - 3} L${x + 3} ${y + 3} L${x - 3} ${y + 3} Z`, i % 2 ? 'hi' : 'bs')),
]);
def('coleslaw', () => [                                        // thin shredded strands
  round('lo', 40, 20, 9),
  ...Array.from({ length: 8 }, (_, i) => S(`M${16 + i * 4} 44 Q${18 + i * 4} 34 ${16 + i * 4} 28`, 'bs', 1.6)),
]);
def('omelette', () => [                                        // folded in half, not a whole egg
  round('lo', 42, 21, 8),
  P('M16 34 Q30 20 44 34 Q44 42 30 42 Q16 42 16 34 Z', 'hi'),
]);
def('pancake', () => [                                         // a stack, with butter on top
  ...[40, 34, 28].map((y, i) => E(30, y, 16 - i, 4, i % 2 ? 'hi' : 'bs')),
  P('M30 24 Q26 20 30 16 Q34 20 30 24 Z', 'grain-lo'),
]);
def('waffle', () => [                                          // one disc, the grid pressed in
  round('lo', 38, 18, 8),
  E(30, 36, 16, 7, 'bs'),
  ...[-8, 0, 8].map(x => S(`M${30 + x} 30 L${30 + x} 42`, 'lo', 1.2)),
  ...[31, 36, 41].map(y => S(`M16 ${y} L44 ${y}`, 'lo', 1)),
]);
def('burger', () => [                                          // domed top bun, wavy lettuce edge, round base
  P('M14 22 Q30 8 46 22 L46 28 L14 28 Z', 'grain-hi'),
  E(30, 30, 16, 4, 'lo'),
  S('M14 34 Q22 30 30 34 Q38 38 46 34', 'plant-bs', 3),
  E(30, 42, 16, 6, 'grain-hi'),
]);
def('hot_dog', () => [                                         // the sausage, showing through the slit bun
  P('M10 34 Q10 24 20 24 L40 24 Q50 24 50 34 Q50 40 40 40 L20 40 Q10 40 10 34 Z', 'grain-hi'),
  E(30, 32, 17, 5, 'bs'),
]);
def('sandwich', () => [                                        // the diagonal cut, filling at the edge
  P('M12 44 L12 20 L48 44 Z', 'grain-hi'),
  P('M14 40 L14 26 L42 40 Z', 'bs'),
]);
def('fried_rice', () => [                                      // rice, with egg and scallion flecked through
  round('lo', 40, 20, 9),
  ...granules('hi', 14, 91, [16, 28, 44, 42]),
  ...[[22, 32], [34, 30]].map(([x, y]) => C(x, y, 2.4, 'grain-bs')),
  C(38, 36, 1.6, 'plant-bs'),
]);
def('taco', () => [                                            // the shell folded open, filling inside
  P('M10 40 Q10 20 30 20 Q50 20 50 40 Q30 34 10 40 Z', 'grain-hi'),
  ...granules('bs', 8, 55, [14, 30, 46, 40]),
]);

/* plant anatomy batch 1 — stem, external stem morphology, internal root-growth
   zones, monocot/dicot, and named specialized roots. `root` already draws a
   forking taproot and `rhizome` already draws a horizontal budded stem, so
   this set is built to stay clear of both: `stem` is a bare vertical axis cut
   open at the base, the stem-morphology items are all marks ON that axis, the
   root-zone items are a single vertical root tip broken into its four real
   bands, and the named roots each get the one silhouette that is actually
   theirs (a flare, an arch, a hooked grip, a hanging cord). */
def('stem', () => [                                            // the bare axis, cut open at the base
  S('M30 6 L30 46', 'bs', 5),
  E(30, 48, 9, 5, 'lo'),
  C(30, 48, 3.4, 'hi'), C(27, 46, 1.6, 'ground'), C(33, 50, 1.6, 'ground'),
  C(30, 6, 3, 'hi'),                                           // the growing tip
]);
def('node', () => [                                            // one ringed attachment point, one stub
  S('M30 6 L30 54', 'bs', 4),
  ring('lo', 30, 30, 5, 2.4),
  P('M35 30 L48 24 L48 30 L35 33 Z', 'hi'),                    // the leaf stub it carries
  C(41, 22, 2, 'gh'),                                          // the bud tucked in the angle
]);
def('internode', () => [                                       // the measured gap between two rings
  S('M30 6 L30 54', 'bs', 4),
  ring('lo', 30, 12, 4.5, 2), ring('lo', 30, 48, 4.5, 2),
  S('M30 16 L30 44', 'hi', 6),                                 // the segment that actually elongates
  S('M40 16 L40 44', 'gh', 1.2), S('M37 16 L43 16', 'gh', 1.2), S('M37 44 L43 44', 'gh', 1.2),
]);
def('terminal_bud', () => [                                    // the capped tip, past the last internode
  S('M30 54 L30 30', 'lo', 4),
  P('M30 30 Q20 26 20 14 Q20 4 30 4 Q40 4 40 14 Q40 26 30 30 Z', 'bs'),
  P('M30 30 Q23 26 23 16 Q23 8 30 8 Z', 'hi'),                 // an overlapping scale
]);
def('axillary_bud', () => [                                    // small, dormant, in the leaf's angle
  S('M30 54 L30 10', 'bs', 4),
  leaf('hi', 30, 16, .9, -35),
  E(24, 30, 4, 5.4, 'lo'),                                     // tucked right in the axil
]);
def('leaf_scar', () => [                                       // the stem alone — the leaf is already gone
  S('M30 54 L30 6', 'bs', 4),
  E(30, 28, 7, 5, 'lo'),
  ...[[27, 26], [30, 30], [33, 26]].map(([x, y]) => C(x, y, 1.3, 'gh')),  // the bundle scars inside it
]);
def('lenticel', () => [                                        // bark's own texture, with pale breathing pores
  P('M14 8 L46 8 L46 54 L14 54 Z', 'lo'),
  ...[20, 27, 34, 41].map((y, i) => S(`M${16 + (i % 2) * 3} ${y * 1.1} Q30 ${y * 1.1 - 4} ${44 - (i % 2) * 3} ${y * 1.1}`, 'ik', 2)),
  ...[[20, 18], [36, 26], [24, 38], [40, 46]].map(([x, y]) => E(x, y, 2.6, 1.4, 'hi')),
]);
def('root_cap', () => [                                        // the shielded tip, shedding cells as it goes
  S('M30 4 L30 30', 'bs', 5),
  P('M22 30 Q22 46 30 50 Q38 46 38 30 Z', 'hi'),
  ...granules('gh', 6, 19, [20, 46, 40, 54]),                  // the slick of shed cap cells
]);
def('root_meristem', () => [                                   // a knot of small cells, all dividing at once
  S('M30 4 L30 22', 'bs', 5),
  C(30, 34, 13, 'lo'),
  ...[[24, 28], [36, 28], [24, 40], [36, 40], [30, 34]].map(([x, y]) => C(x, y, 3.6, 'hi')),
]);
def('elongation_zone', () => [                                 // the same cells, now stretched not dividing
  S('M30 4 L30 16', 'bs', 5),
  ...[22, 30, 38].map(x => S(`M${x} 18 L${x} 50`, 'hi', 4)),
  ...[[22, 34], [30, 26], [38, 42]].map(([x, y]) => S(`M${x} ${y} L${x} ${y + 10}`, 'lo', 1.2)),
]);
def('root_hair', () => [                                       // a root segment, bristling with fine hairs
  S('M30 4 L30 54', 'bs', 5),
  ...[16, 24, 34, 42].map((y, i) => [
    S(`M30 ${y} L${18 - (i % 2) * 4} ${y - 4}`, 'gh', 1),
    S(`M30 ${y} L${42 + (i % 2) * 4} ${y - 4}`, 'gh', 1),
  ]).flat(),
]);
def('cotyledon', () => [                                       // the seed coat splitting, two seed-leaves up
  P('M20 54 Q20 46 30 46 Q40 46 40 54 Z', 'lo'),
  leaf('hi', 22, 34, .85, -25), leaf('hi', 38, 34, .85, 25),
  S('M30 46 L30 38', 'bs', 2),
]);
def('monocot', () => [                                         // one blade, parallel veins start to finish
  P('M30 54 Q22 36 30 6 Q38 36 30 54 Z', 'bs'),
  ...[14, 20, 26, 34, 40].map(dy => S(`M${28 - dy * .06} ${52 - dy} L${28 - dy * .06} ${18 - dy * .3 < 8 ? 8 : 18 - dy * .3}`, 'hi', 1)),
]);
def('dicot', () => [                                           // one broad leaf, a branching net of veins
  leaf('bs', 30, 30, 1.6),
  S('M30 44 L30 16', 'lo', 1.6),
  ...[[26, 30, -1], [34, 30, 1], [24, 22, -1], [36, 22, 1]].map(([x, y, s]) =>
    S(`M30 ${y} L${x} ${y - s * 4}`, 'lo', 1)),
  ...[[24, 44], [36, 44]].map(([x, y]) => leaf('hi', x, y, .5, x < 30 ? -40 : 40)),  // its two cotyledons, low down
]);
def('kapok', () => [                                            // a rainforest giant flared into plank roots
  S('M30 40 L30 8', 'ik', 5),
  E(28, 18, 15, 12, 'lo'), E(24, 14, 10, 8, 'bs'),
  ...[-14, -6, 6, 14].map(dx => P(`M30 40 L${30 + dx} 40 L${30 + dx * 1.7} 54 L${30 + dx * .3} 54 Z`, 'hi')),
]);
def('buttress_root', () => [                                    // the flare alone, no canopy — thin plank wings
  S('M30 14 L30 30', 'lo', 4),
  ...[-18, -9, 9, 18].map(dx => P(`M30 30 L${30 + dx * .3} 30 L${30 + dx} 54 L${30 + dx * .6} 54 Z`, 'bs')),
  ...[-18, 18].map(dx => S(`M30 30 L${30 + dx} 54`, 'ik', 1)),
]);
def('brace_root', () => [                                       // roots arching down FROM a node, well above soil
  S('M30 54 L30 10', 'bs', 4),
  ring('lo', 30, 26, 4.5, 2),
  ...[-1, 1].map(s => S(`M30 26 Q${30 + s * 16} 30 ${30 + s * 20} 48`, 'hi', 2.6)),
  horizon('ground', 50),
]);
def('ivy', () => [                                              // a vine spiralling up a straight support
  S('M42 54 L42 6', 'ik', 3),                                   // the trunk it climbs
  S('M14 54 Q14 40 26 38 Q38 36 26 26 Q14 18 26 8 Q34 2 42 10', 'bs', 2.6),
  ...[[24, 34], [22, 20]].map(([x, y]) => leaf('hi', x, y, .55, -30)),
  ...[[34, 30], [34, 14]].map(([x, y]) => C(x, y, 1.6, 'gh')),  // clinging roots touching the trunk
]);
def('clinging_root', () => [                                    // a shoot pressed flat, gripping a wall
  P('M40 8 L46 8 L46 54 L40 54 Z', 'lo'),                        // the surface
  S('M38 54 L38 8', 'bs', 3.4),
  ...[14, 24, 34, 44].map(y => S(`M38 ${y} L44 ${y}`, 'hi', 2)),
  ...[14, 24, 34, 44].map(y => C(44.5, y, 1.3, 'gh')),          // the adhesive pads at each grip
]);
def('aerial_root', () => [                                      // green, fleshy, dangling with nothing below
  E(30, 10, 12, 6, 'plant-bs'),
  ...[-10, -2, 6, 14].map((dx, i) => S(`M${30 + dx} 12 Q${34 + dx} 30 ${28 + dx * .6} ${48 - i}`, 'bs', 3.2)),
  ...[[20, 26], [30, 34], [38, 40]].map(([x, y]) => C(x, y, 1.4, 'hi')),  // velamen fleck
]);
def('pneumatophore', () => [                                    // snorkels standing up out of the mud
  wave('lo', 46, 4, 24),
  ...[-14, -5, 5, 14].map(dx => S(`M${30 + dx} 50 L${30 + dx * .7} 14`, 'bs', 3)),
  ...[-14, -5, 5, 14].map(dx => C(30 + dx * .7, 28, 1.4, 'gh')),  // the lenticels along each one
]);

/* craft — invention/machine batch + philosophy batch 2 additions ─────────
 * Fifty-four items land here from two very different rosters: a run of
 * named inventions/machines (heliography through veil) and eighteen named
 * philosophers (socrates through aquinas). The machines each get their own
 * working part, same as printing_press's screw or telegraph's coil. The
 * people share one small vocabulary — a robe/coat silhouette, a head, one
 * attribute that is actually theirs (Descartes' axes, Locke's blank slate,
 * Rawls's veil, Turing's rotor) — rather than one bust repeated eighteen
 * times with a different label. */

def('heliography', () => [
  P('M14 14 L46 14 L46 46 L14 46 Z', 'lo'),                  // the pewter plate
  P('M14 30 L46 30 L46 46 L14 46 Z', 'hi'),                  // where the light has hardened it into an image
  ...[10, 20, 30, 40, 50].map(x => S(`M${x} 4 L${x - 4} 14`, 'bs', 1.6)),  // the sun, doing the exposing
]);
def('antiseptic_dressing', () => [
  ring('hi', 30, 32, 15, 7),                                  // gauze, wound thick
  S('M18 24 A16 16 0 0 1 42 24', 'lo', 2),                    // one wrap showing the spiral
  ...[[20, 46], [30, 50], [40, 46]].map(([x, y]) => E(x, y, 2.2, 3, 'bs')),  // carbolic acid, soaking through
]);
def('blasting_cap', () => [
  P('M24 18 L36 18 L36 40 L24 40 Z', 'lo'),                   // the cap
  S('M24 20 L14 8 M36 20 L46 8', 'ik', 2),                    // lead wires, out the top
  C(30, 30, 3, 'hi'),                                          // the charge it carries
  bolt('bs', 30, 2, .5),                                       // what it sets off — a spark, not the blast itself
]);
def('automobile', () => [
  P('M14 34 L46 34 L44 42 L16 42 Z', 'lo'),                   // bench and frame
  C(18, 46, 7, 'bs'), C(42, 46, 7, 'bs'),                     // the two large driving wheels
  C(30, 44, 4, 'hi'),                                          // a single small wheel — three, not four
  S('M30 34 L34 20', 'ik', 2.4),                               // the tiller, not a wheel
]);
def('metal_detector', () => [
  ring('lo', 30, 46, 12, 3),                                  // the coil head
  S('M30 40 L30 14', 'ik', 3),                                // the shaft
  S('M30 14 L40 10', 'ik', 3),                                // the handle
  S('M18 46 Q30 52 42 46', 'gh', 1.4),                         // the ground it sweeps
]);
def('tesla_coil', () => [
  ...coil('bs', 4, 8),                                         // the secondary winding, stacked
  ring('hi', 30, 14, 10, 3),                                   // the toroid on top
  bolt('lo', 30, 2, .5),                                       // the spark it throws
]);
def('ac_induction_motor', () => [
  ring('lo', 30, 30, 18, 3),                                   // the stator
  C(30, 30, 9, 'bs'),                                          // the rotor, unpowered, just dragged along
  ...[0, 90, 180, 270].map(a => ['g', a, 30, 30, [S('M30 12 L30 18', 'ik', 2)]]),  // no brushes to wear — just slots
]);
def('autogyro', () => [
  P('M14 34 L46 34 L40 40 L20 40 Z', 'lo'),                    // the fuselage
  S('M10 26 L50 26', 'ik', 2.4),                                // the free rotor overhead, autorotating
  ring('bs', 30, 26, 3, 2),                                     // its hub
  S('M14 37 L6 37', 'ik', 2.6),                                 // the propeller, pulling it forward
]);
def('liquid_fuel_rocket', () => [
  P('M26 8 L34 8 L36 44 L24 44 Z', 'lo'),                       // the body
  P('M26 8 L30 2 L34 8 Z', 'bs'),                                // nose cone
  P('M22 38 L26 44 L26 50 L20 50 Z', 'hi'), P('M38 38 L34 44 L34 50 L40 50 Z', 'hi'),  // fins
  flame('bs', .5, 20),                                          // ethanol and liquid oxygen, burning
]);
def('enigma_machine', () => [
  P('M12 32 L48 32 L48 48 L12 48 Z', 'lo'),                     // the case
  ...[19, 30, 41].map(x => C(x, 20, 5, 'bs')),                  // three wired rotors
  S('M14 40 L46 40', 'hi', 2),                                  // the keyboard, one bank
]);
def('bombe', () => [
  P('M10 14 L50 14 L50 46 L10 46 Z', 'gh'),                     // the frame
  ...[0, 1, 2].flatMap(row => [0, 1, 2].map(col =>
    C(18 + col * 12, 22 + row * 11, 3.2, 'bs'))),               // dozens of drums, replicated — not three rotors, a rack of them
]);
def('hypertext', () => [
  P('M14 10 L46 10 L46 50 L14 50 Z', 'gh'),                     // the page
  S('M20 20 L34 20 M20 30 L40 30 M20 40 L30 40', 'ik', 2),      // straight lines of text
  S('M34 20 Q44 25 30 40', 'bs', 2),                            // a link, jumping off the line
  C(30, 40, 2, 'hi'),                                            // where it lands
]);
def('world_wide_web', () => [
  ring('lo', 30, 30, 18, 2),                                    // the globe
  E(30, 30, 18, 7, 'gh'),                                        // one line of longitude across it
  ...[[16, 20], [30, 14], [44, 20], [20, 42], [40, 42]].map(([x, y]) => C(x, y, 2.4, 'bs')),  // nodes
  S('M16 20 L30 14 L44 20 M20 42 L30 14 M40 42 L44 20', 'hi', 1.2),  // one naming scheme, wiring them together
]);
def('book_of_optics', () => [
  P('M10 16 L30 20 L30 46 L10 42 Z', 'hi'), P('M50 16 L30 20 L30 46 L50 42 Z', 'lo'),  // the open book
  S('M6 10 L30 22 M14 6 L30 20 M22 4 L30 18', 'ik', 1.4),        // light, entering the eye rather than leaving it
]);
def('event_horizon_telescope', () => [
  C(30, 30, 11, 'ik'),                                           // the event horizon, dark
  ring('bs', 30, 30, 15, 4),                                     // the photon ring around it
  ...[[10, 50], [30, 54], [50, 50]].map(([x, y]) => S(`M${x} ${y} L30 30`, 'gh', 1)),  // dishes worldwide, all aimed here
  ...[[10, 50], [30, 54], [50, 50]].map(([x, y]) => C(x, y, 2.2, 'hi')),  // linked into one Earth-sized dish
]);
def('control_rod', () => [
  ...[[18, 22], [42, 22], [18, 38], [42, 38]].map(([x, y]) => C(x, y, 2.6, 'gh')),  // the neighboring fuel
  P('M27 6 L33 6 L33 36 L27 36 Z', 'lo'),                        // the rod, sliding into the core
  E(30, 36, 4, 1.6, 'hi'),                                        // just entering the lattice plane
]);
def('nuclear_reactor', () => [
  hex('ik', 30, 30, 20, 2.4),                                    // one lattice cell of the core
  ...[[24, 24], [36, 24], [30, 30], [24, 36], [36, 36]].map(([x, y]) => S(`M${x} ${y - 8} L${x} ${y + 8}`, 'bs', 2)),  // fuel rods, held on the edge of runaway
  C(30, 30, 3, 'hi'),                                            // the glow at the centre
]);
def('nuclear_power_plant', () => [
  P('M16 50 Q10 30 20 12 Q30 6 40 12 Q50 30 44 50 Z', 'lo'),     // the cooling tower — the reactor never spins anything itself
  P('M20 12 L40 12 L38 8 L22 8 Z', 'hi'),                        // the vent at the top
  ...puff('gh', 30, 4, .6),                                       // steam, not smoke
]);
def('heat_shield_tile', () => [
  P('M16 16 L44 16 L44 44 L16 44 Z', 'lo'),                       // the tile — 90% empty space
  P('M16 16 L44 16 L44 26 L16 26 Z', 'bs'),                       // the face that took the heat
  ...[[10, 20], [50, 20], [10, 40], [50, 40]].map(([x, y]) => S(`M${x} ${y} L${x + (x < 30 ? -4 : 4)} ${y}`, 'hi', 1.4)),  // 1,260°C, shrugged off
]);
def('tunnel_boring_machine', () => [
  C(24, 30, 16, 'lo'),                                            // the rotating cutterhead
  ...[0, 60, 120, 180, 240, 300].map(a => ['g', a, 24, 30, [S('M24 16 L24 22', 'ik', 1.6)]]),  // teeth, chewing the face
  P('M24 16 L52 20 L52 40 L24 44 Z', 'bs'),                       // the shield, rammed forward behind it
]);
def('ct_scanner', () => [
  ring('lo', 30, 26, 18, 5),                                      // the gantry
  S('M10 42 L50 42', 'bs', 4),                                    // the table, sliding through
  C(30, 8, 2.4, 'hi'),                                             // the x-ray source, orbiting
]);
def('stand_mixer', () => [
  P('M16 10 Q16 8 20 8 L26 8 L26 26 Q26 30 20 30 L16 30 Z', 'lo'), // the head, arcing over the bowl
  round('bs', 46, 15, 9),                                          // the bowl
  S('M22 30 Q22 38 22 42', 'hi', 3),                               // the beater, orbiting inside it
]);
def('swashplate', () => [
  E(30, 38, 18, 6, 'lo'),                                          // the non-rotating disc, tilted
  E(30, 30, 16, 5, 'bs'),                                          // the rotating disc above it
  S('M16 32 L22 12 M30 30 L30 12 M44 32 L38 12', 'ik', 1.6),       // pitch links, each a different length through the turn
]);
def('electric_car', () => [
  P('M10 36 Q10 26 22 26 L38 26 Q50 26 50 36 L50 42 L10 42 Z', 'lo'),  // one smooth body, no engine to bulk out
  C(18, 44, 6, 'bs'), C(42, 44, 6, 'bs'),                          // wheels
  bolt('hi', 30, 28, .4),                                          // full torque from a dead stop
]);
def('icebreaker', () => [
  P('M10 30 L34 18 L54 30 L54 42 L10 42 Z', 'bs'),                 // the hull, bow sloped up to ride the ice
  ...[[14, 44], [22, 46], [30, 44], [38, 46]].map(([x, y]) => P(`M${x - 3} ${y} L${x} ${y - 4} L${x + 3} ${y} Z`, 'hi')),  // broken under the hull, not climbed
]);
def('snow_groomer', () => [
  P('M12 30 L44 30 L44 42 L12 42 Z', 'lo'),                        // cab and chassis
  E(28, 46, 20, 5, 'bs'),                                          // the track, wide and flat
  S('M44 24 L54 30 L44 36', 'hi', 1.6),                            // the tiller, combing the piste into corduroy
  S('M20 30 Q30 10 50 6', 'gh', 1.4),                              // the cable, winched up the steepest slopes
]);
def('turboprop', () => [
  P('M18 26 L46 26 L46 36 L18 36 Z', 'lo'),                        // the nacelle
  C(48, 31, 3, 'bs'),                                               // the gearbox, sending power aft to front
  ring('hi', 12, 31, 12, 2),                                        // the propeller, spun to a disc
  S('M18 20 L46 20', 'gh', 1.4),                                    // the wing it's mounted to
]);
def('abrams_tank', () => [
  P('M10 36 L50 36 L46 44 L14 44 Z', 'lo'),                         // hull, low and angled
  P('M20 26 L40 26 L38 36 L22 36 Z', 'bs'),                         // a sleek, sloped turret
  S('M40 30 L54 30', 'ik', 3),                                      // the long gun
  E(30, 46, 22, 4, 'hi'),                                            // tracks
]);
def('tiger_tank', () => [
  P('M12 24 L48 24 L48 40 L12 40 Z', 'lo'),                         // hull, flat vertical sides — no sloping
  P('M20 16 L40 16 L40 24 L20 24 Z', 'bs'),                         // the boxy turret
  S('M40 18 L54 18', 'ik', 3.4),                                    // the 88mm gun
  E(30, 44, 20, 4, 'hi'),                                            // tracks
]);
def('radar', () => [
  S('M30 50 L30 30', 'ik', 3),                                      // the mast
  P('M12 30 Q30 10 48 30 L44 34 Q30 18 16 34 Z', 'bs'),             // the dish, angled up
  S('M18 14 A18 18 0 0 1 42 14', 'hi', 1.6),                        // the echo, timed on its way back
  S('M22 4 A24 24 0 0 1 38 4', 'gh', 1.4),
]);
def('stealth_aircraft', () => [
  P('M30 14 L54 34 L38 34 L30 46 L22 34 L6 34 Z', 'lo'),            // a faceted flying wing — no round surface to bounce an echo back
  S('M30 14 L30 34', 'ik', 1.4),                                     // the ridge down the spine
]);
def('rivet', () => [
  P('M16 26 L44 26 L44 32 L16 32 Z', 'lo'), P('M16 34 L44 34 L44 40 L16 40 Z', 'lo'),  // two plates, clamped together
  C(30, 22, 5, 'hi'),                                                // the head, driven red-hot
  E(30, 44, 6, 2.6, 'bs'),                                           // hammered flat on the other side, once it's cooled
]);
def('ocean_liner', () => [
  P('M8 38 L52 38 L48 46 L12 46 Z', 'lo'),                          // the hull
  P('M14 38 L14 26 L46 26 L46 38 Z', 'bs'),                         // superstructure
  S('M22 26 L22 14 M38 26 L38 14', 'ik', 4),                        // twin funnels
  ...[18, 26, 34, 42].map(x => C(x, 42, 1.4, 'hi')),                // portholes — the bulkheads inside don't reach this high
]);
def('elliptical_wing', () => [
  E(30, 30, 24, 8, 'bs'),                                            // the planform itself — least induced drag of any shape
  S('M6 30 L54 30', 'ik', 1.4),                                      // the spar
]);
def('box', () => [
  P('M14 18 L46 18 L46 46 L14 46 Z', 'lo'),                          // flat panels, joined edge to edge
  S('M14 18 L46 18 M14 30 L46 30 M14 46 L46 46', 'hi', 1.4),         // the seams between them
  ...[16, 44].flatMap(x => [20, 44].map(y => C(x, y, 1.2, 'ik'))),   // nailed at the corners
]);
def('veil', () => [
  C(30, 20, 8, 'gh'),                                                 // the head, seen through it
  P('M18 16 Q30 10 42 16 L46 42 Q30 36 14 42 Z', 'hi'),               // fine, sheer cloth, draped and hanging
  S('M18 16 Q30 10 42 16', 'lo', 1.4),                                // the hem at the brow
]);

/* eighteen philosophers — one robe/coat-and-head vocabulary, never the same
 * silhouette twice, each carrying the one thing that is actually theirs. */
def('socrates', () => [
  P('M18 22 L36 18 L40 48 L16 48 Z', 'bs'),                          // himation, one shoulder bare
  C(26, 13, 6, 'bs'),                                                 // bald, by every account
  S('M20 20 L34 30', 'lo', 2),                                        // the sash across his chest
  S('M30 26 L42 16', 'ik', 3),                                        // the arm, raised to his mouth
  E(44, 14, 3.6, 2.2, 'hi'),                                           // the cup he was made to drink
]);
def('plato', () => [
  P('M20 18 L40 18 L44 48 L16 48 Z', 'bs'),                           // a fuller robe, both shoulders covered
  C(30, 12, 6, 'bs'),
  S('M27 17 Q30 22 33 17', 'lo', 1.6),                                 // beard
  S('M10 37 L22 37', 'hi', 3), C(9, 37, 2, 'gh'), C(23, 37, 2, 'gh'),  // a dialogue, written down
  P('M42 30 L48 30 L48 50 L42 50 Z', 'craft-lo'),                     // the Academy, standing beside him
]);
def('aristotle', () => [
  P('M20 18 L36 20 L40 48 L18 46 Z', 'bs'),                           // draped diagonally, one arm free to teach
  C(28, 12, 6, 'bs'),
  S('M34 24 L46 20', 'ik', 3),                                         // the arm, out, mid-lecture
  C(48, 20, 5, 'hi'), ring('lo', 48, 20, 5, 1.2),                      // the cosmos, catalogued
]);
def('descartes', () => [
  P('M22 20 L38 20 L42 48 L18 48 Z', 'bs'),                           // a tailored coat, not a robe — this one's modern
  E(30, 19, 7, 2.4, 'hi'),                                             // a wide lace collar
  C(30, 12, 6, 'bs'),
  S('M46 12 L46 30 M40 24 L52 24', 'ik', 2),                          // the axes he gave geometry
  C(49, 18, 1.6, 'hi'),                                                 // a point, plotted on them
]);
def('locke', () => [
  P('M22 20 L38 20 L41 48 L19 48 Z', 'bs'),
  C(30, 12, 5.6, 'bs'),
  P('M40 26 L52 26 L52 40 L40 40 Z', 'gh'),                            // the slate — blank, on purpose
  S('M40 26 L52 26 L52 40 L40 40 Z', 'ik', 1.6),                       // the frame is all there is to see
]);
def('kant', () => [
  P('M21 19 L39 19 L43 48 L17 48 Z', 'bs'),
  C(30, 11, 5.6, 'bs'),
  C(46, 30, 7, 'hi'),                                                   // the watch he set his life to
  S('M46 30 L46 25 M46 30 L50 32', 'ik', 1.6),                          // its hands, exact
]);
def('wittgenstein', () => [
  P('M23 20 L37 20 L40 48 L20 48 Z', 'bs'),                            // plain — he gave the fortune away
  C(30, 12, 5.4, 'bs'),
  S('M46 14 L46 48 M54 14 L54 48 M46 20 L54 20 M46 28 L54 28 M46 36 L54 36 M46 44 L54 44', 'ik', 1.6),  // the ladder, meant to be climbed and then kicked away
]);
def('beauvoir', () => [
  P('M23 19 L37 19 L41 50 L19 50 Z', 'bs'),                            // a fitted dress
  C(30, 12, 5.6, 'bs'),
  E(30, 9, 7, 3.4, 'lo'),                                               // the turban she wore for decades
  P('M40 34 L52 34 L52 42 L40 42 Z', 'hi'), S('M46 34 L46 42', 'ik', 1),  // the book that founded the argument
]);
def('confucius', () => [
  P('M20 20 L40 20 L46 48 L14 48 Z', 'bs'),                            // hanfu, wide through the body
  P('M14 30 L20 20 L22 32 L14 38 Z', 'lo'), P('M46 30 L40 20 L38 32 L46 38 Z', 'lo'),  // sleeves, flared
  C(30, 12, 5.6, 'bs'),
  P('M24 8 L36 8 L36 5 L24 5 Z', 'hi'),                                  // the scholar's board hat
  S('M27 17 L30 24 L33 17', 'lo', 1.8),                                   // the long beard
]);
def('gautama_buddha', () => [
  P('M14 46 L30 38 L46 46 L46 50 L14 50 Z', 'bs'),                      // legs, crossed — seated, not standing
  P('M20 44 Q20 24 30 22 Q40 24 40 44 Z', 'bs'),                         // robe over one shoulder
  C(30, 16, 6, 'bs'),
  C(30, 9, 2.6, 'hi'),                                                    // the ushnisha
  ring('gh', 30, 16, 10, 1.4),                                           // stillness, made visible
  E(30, 40, 5, 2.6, 'hi'),                                                // hands, resting in the lap
]);
def('avicenna', () => [
  P('M21 20 L39 20 L43 48 L17 48 Z', 'bs'),
  C(30, 12, 5.6, 'bs'),
  E(30, 8, 7.4, 4.6, 'hi'),                                              // the turban of a physician, not a philosopher's bare head
  P('M44 30 L48 30 L47 40 Q46 42 45 40 Z', 'lo'), C(46, 29, 1.6, 'ik'),  // a vial — the Canon was a medical text
]);
def('plutarch', () => [
  P('M22 19 L38 19 L41 48 L19 48 Z', 'bs'),
  C(30, 12, 5.6, 'bs'),
  S('M25 10 Q30 7 35 10', 'hi', 2),                                     // laurel — priest at Delphi
  S('M40 30 L52 30', 'lo', 3), S('M40 38 L52 38', 'hi', 3),             // Lives, always in pairs
]);
def('epicurus', () => [
  P('M20 18 L40 18 L43 48 L17 48 Z', 'bs'),
  C(30, 12, 5.6, 'bs'),
  leaf('plant-bs', 46, 34, .8, 20),                                     // The Garden, where he taught
  S('M46 44 L46 34', 'plant-bs', 2),
]);
def('searle', () => [
  P('M22 20 L38 20 L38 48 L22 48 Z', 'bs'),                             // a modern jacket — straight sides, no drape
  S('M28 20 L30 26 L32 20', 'ik', 1.6),                                  // a tie
  C(30, 12, 5.4, 'bs'),
  P('M40 28 L52 28 L52 40 L40 40 Z', 'lo'),                              // the room
  S('M40 34 L44 34', 'hi', 2),                                            // a symbol, passed through the slot, understood by no one inside
]);
def('turing', () => [
  P('M22 20 L38 20 L38 48 L22 48 Z', 'bs'),
  C(30, 12, 5.4, 'bs'),
  ring('lo', 46, 30, 7, 2.2),                                            // a rotor — the machine he broke, and the one he imagined
  C(46, 30, 2, 'hi'),
]);
def('foot', () => [
  P('M23 20 L37 20 L40 47 L20 47 Z', 'bs'),                              // a dress, gently flared
  C(30, 12, 5.4, 'bs'),
  S('M40 44 L52 44 M46 44 L52 38', 'ik', 1.8),                            // the track, branching
  P('M42 36 L50 36 L50 42 L42 42 Z', 'lo'),                              // the tram, bearing down on it
]);
def('rawls', () => [
  P('M22 20 L38 20 L40 48 L20 48 Z', 'bs'),
  C(30, 14, 5.4, 'bs'),
  P('M22 10 Q30 6 38 10 L40 24 Q30 20 20 24 Z', 'gh'),                    // the veil of ignorance, over his own head
]);
def('aquinas', () => [
  P('M20 18 L40 18 L44 50 L16 50 Z', 'bs'),                              // the Dominican habit
  P('M24 10 Q30 6 36 10 L34 20 Q30 17 26 20 Z', 'lo'),                    // the hood, up
  C(30, 15, 4.6, 'hi'),
  S('M46 20 L46 34 M41 25 L51 25', 'ik', 2.4),                            // motion, traced back to an unmoved first cause
]);


/* craft — musical instrument additions ────────────────────────────────────
   Idiophones, membranophones, chordophones, aerophones and electrophones,
   each drawn from the one part that actually separates it from its family:
   a struck bar, a skin head and its tuning spot, a resonating body and
   neck, a bore with tone holes, a coil or an antenna. */
def('mbira', () => [
  P('M14 30 L46 30 L44 50 L16 50 Z', 'lo'),                            // the hardwood board
  ...[[18, 20], [24, 15], [30, 12], [36, 16], [42, 21]].map(([x, h], i) =>
    S(`M${x} 30 L${x} ${30 - h}`, i % 2 ? 'hi' : 'bs', 3)),             // tines, graduated lengths
  C(30, 42, 3, 'ground'),                                              // the resonance hole
]);
def('gong', () => [
  E(30, 32, 20, 18, 'bs'),
  ring('lo', 30, 32, 20, 2.4),
  C(30, 30, 6, 'hi'),                                                  // the raised boss
  S('M30 14 L30 8', 'ik', 2), C(30, 6, 2, 'gh'),                       // the hanging cord
]);
def('cymbal', () => [
  P('M8 34 Q30 22 52 34 L52 39 Q30 28 8 39 Z', 'bs'),                  // a shallow dome, cross-section
  E(30, 24, 7, 5, 'hi'),                                               // the raised bell
  S('M14 33 Q30 25 46 33', 'lo', 1.4),                                 // a tone groove, lathed in
]);
def('bell', () => [
  P('M20 12 Q20 8 30 8 Q40 8 40 12 Q46 34 50 42 L10 42 Q14 34 20 12 Z', 'bs'),
  E(30, 42, 20, 4, 'lo'),                                              // the flared lip
  S('M30 42 L30 50', 'ik', 2), C(30, 52, 3, 'hi'),                     // the clapper
]);
def('xylophone', () => [
  S('M10 46 L50 46', 'lo', 2.4),                                       // the frame rail
  ...[[14, 18], [22, 10], [30, 6], [38, 10], [46, 18]].map(([x, top], i) =>
    P(`M${x - 3} 46 L${x - 3} ${top} L${x + 3} ${top} L${x + 3} 46 Z`, i % 2 ? 'hi' : 'bs')),
]);
def('angklung', () => [
  S('M10 10 L50 10 L50 50 L10 50 Z', 'gh', 1.6),                       // the rattan frame
  P('M20 16 L26 16 L25 44 L21 44 Z', 'bs'),                            // the longer tube
  P('M34 22 L40 22 L39 44 L35 44 Z', 'hi'),                            // the shorter tube
]);
def('maraca', () => [
  E(30, 26, 15, 17, 'bs'),                                             // the gourd
  P('M27 42 L33 42 L32 54 L28 54 Z', 'lo'),                            // the handle
  ...granules('hi', 6, 5, [20, 18, 40, 34]),                           // seeds inside, seen through
]);
def('djembe', () => [
  P('M16 18 Q16 10 30 10 Q44 10 44 18 Q44 28 34 32 Q38 44 36 54 L24 54 Q22 44 26 32 Q16 28 16 18 Z', 'lo'),
  E(30, 11, 14, 4.4, 'hi'),                                            // the goatskin head
  ...[0, 1, 2, 3].map(i => S(`M${18 + i * 5} 14 L${16 + i * 5} 22`, 'bs', 1.4)),  // the laced rim
]);
def('tabla', () => [
  P('M8 22 L26 22 L26 48 Q26 54 17 54 Q8 54 8 48 Z', 'lo'),            // dayan, the smaller drum
  E(17, 22, 9, 3.4, 'hi'), C(20, 21, 2.6, 'ik'),                       // its syahi, off-centre
  P('M30 16 Q30 10 42 10 Q54 10 54 20 Q54 40 44 50 Q38 54 32 50 Q28 44 30 34 Z', 'bs'), // bayan, the bass drum
  E(42, 12, 11, 3.6, 'hi'), C(46, 12, 3, 'ik'),                        // its own syahi
]);
def('timpani', () => [
  P('M12 22 Q12 44 30 50 Q48 44 48 22 Z', 'bs'),                       // the copper kettle
  E(30, 20, 18, 6, 'hi'),                                              // the skin head
  ...[14, 22, 38, 46].map(x => S(`M${x} 20 L${x} 26`, 'ik', 1.6)),     // tuning lugs around the rim
  S('M20 50 L18 56 M40 50 L42 56', 'lo', 2),                          // the stand's legs
]);
def('daf', () => [
  ring('bs', 30, 30, 20, 5),                                           // the wide wooden frame
  E(30, 30, 16, 16, 'hi'),                                             // the skin
  ...Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4;
    return C(n(30 + 18 * Math.cos(a)), n(30 + 18 * Math.sin(a)), 1.4, 'ik');
  }),                                                                  // the jingling rings set into it
]);
def('guitar', () => [
  E(30, 40, 15, 12, 'lo'), E(30, 26, 10, 9, 'lo'),                     // the figure-8 body
  C(30, 33, 4, 'ground'),                                              // the sound hole
  P('M27 4 L33 4 L32 18 L28 18 Z', 'bs'),                              // the neck
  P('M25 2 L35 2 L35 6 L25 6 Z', 'hi'),                                // the headstock
  S('M29 6 L29 40 M31 6 L31 40', 'ik', 1),                             // strings
]);
def('violin', () => [
  E(30, 40, 11, 10, 'bs'), E(30, 24, 8, 8, 'bs'),                      // the smaller waisted body
  S('M25 30 Q23 34 25 38', 'ik', 1.4), S('M35 30 Q37 34 35 38', 'ik', 1.4), // the f-holes
  P('M28 4 L32 4 L31 16 L29 16 Z', 'lo'),                              // the neck
  ring('hi', 30, 4, 3, 1.6),                                           // the carved scroll
]);
def('morin_khuur', () => [
  P('M20 26 L40 26 L38 50 L22 50 Z', 'bs'),                            // the trapezoid body
  P('M27 8 L33 8 L32 26 L28 26 Z', 'lo'),                              // the neck
  P('M24 2 L30 6 L36 2 L34 10 L26 10 Z', 'hi'),                        // the carved horse head
  S('M24 34 L36 34', 'ik', 1.4),                                       // the bridge
]);
def('sitar', () => [
  E(22, 50, 12, 7, 'bs'),                                              // the gourd resonator
  P('M18 6 L28 6 L24 50 L20 50 Z', 'lo'),                              // the long fretted neck
  ...[10, 16, 22, 28].map(y => C(14, y, 1.8, 'hi')),                   // tuning pegs down its side
  S('M23 8 L21 48', 'ik', 1),                                          // a sympathetic string
]);
def('kora', () => [
  C(24, 40, 16, 'bs'),                                                 // the calabash
  S('M24 8 L24 56', 'lo', 3),                                          // the spike running straight through it
  ...Array.from({ length: 5 }, (_, i) => S(`M${18 + i * 3} 24 L44 ${20 + i * 4}`, 'hi', 1)), // the fan of strings
]);
def('piano', () => [
  P('M10 14 Q50 8 50 30 Q50 46 30 46 L10 46 Z', 'lo'),                 // the wing, seen from above
  P('M10 38 L34 38 L34 46 L10 46 Z', 'bs'),                            // the keyboard
  ...[14, 18, 22, 26, 30].map(x => S(`M${x} 38 L${x} 46`, 'ik', 1)),   // key divisions
  P('M40 12 L48 16 L44 24 L38 20 Z', 'hi'),                            // the propped-open lid
]);
def('flute', () => [
  P('M8 28 L52 28 L52 34 L8 34 Z', 'bs'),
  C(14, 31, 1.8, 'ground'),                                            // the embouchure hole
  ...[24, 30, 36, 42, 48].map(x => C(x, 31, 1.4, 'ik')),               // finger holes
]);
def('pan_flute', () => [
  ...[[13, 10], [21, 16], [29, 22], [37, 28], [45, 34]].map(([x, h], i) =>
    P(`M${x - 3} 50 L${x - 3} ${50 - h} L${x + 3} ${50 - h} L${x + 3} 50 Z`, i % 2 ? 'hi' : 'bs')), // graduated tubes
  S('M9 26 L48 40', 'ik', 2),                                          // the binding across them
]);
def('trumpet', () => [
  S('M10 40 Q10 24 26 24 Q38 24 38 34 Q38 40 30 40 Q22 40 22 32', 'bs', 5), // the looped tubing
  P('M36 30 L54 22 L54 40 L38 38 Z', 'lo'),                            // the flared bell
  ...[24, 30, 36].map(x => P(`M${x - 2} 12 L${x + 2} 12 L${x + 2} 24 L${x - 2} 24 Z`, 'hi')), // three valves
]);
def('didgeridoo', () => [
  P('M8 26 L44 14 L54 24 L54 32 L44 38 L8 34 Z', 'lo'),                // the tube, narrow to wide
  E(10, 30, 3, 4.6, 'ground'),                                         // the hollowed mouthpiece end
  ...granules('hi', 6, 8, [18, 20, 44, 32]),                           // painted dots along its length
]);
def('bagpipes', () => [
  E(24, 32, 13, 16, 'bs'),                                             // the airtight bag
  P('M34 40 L48 52 L52 50 L38 36 Z', 'lo'),                            // the chanter, angled down
  S('M22 18 L14 4', 'hi', 4), S('M28 16 L34 2', 'hi', 4),              // two drones, angled up
  ...[[16, 10], [30, 7]].map(([x, y]) => ring('ik', x, y, 2.4, 1.2)),  // their tuning joints
]);
def('shofar', () => [
  P('M48 12 Q54 16 50 22 Q40 34 26 34 Q10 34 10 48 Q10 54 20 52 Q34 48 40 34 Q46 24 48 12 Z', 'lo'), // the curved horn
  E(49, 15, 3.4, 4.4, 'hi'),                                           // its narrow, heat-straightened tip
  S('M40 20 Q30 26 24 34', 'gh', 1.2),                                 // a ridge along the keratin
]);
def('theremin', () => [
  P('M14 38 L46 38 L46 52 L14 52 Z', 'lo'),                            // the cabinet
  S('M40 38 L40 8', 'bs', 2.4),                                        // the vertical pitch antenna
  S('M20 38 Q10 30 20 26 Q28 24 20 20', 'bs', 2.2),                    // the looped volume antenna
]);
def('electric_guitar', () => [
  P('M14 24 Q14 12 26 12 L40 12 Q46 12 46 20 Q46 30 40 34 Q46 38 44 46 Q40 54 30 50 Q16 46 16 34 Q12 30 14 24 Z', 'bs'), // a cutaway solid body
  P('M22 2 L28 2 L27 14 L23 14 Z', 'lo'),                              // the neck
  ...[[26, 28], [26, 36]].map(([x, y]) => P(`M${x - 6} ${y - 2} L${x + 10} ${y - 2} L${x + 10} ${y + 2} L${x - 6} ${y + 2} Z`, 'ik')), // pickups
]);
def('synthesizer', () => [
  P('M8 36 L52 36 L52 48 L8 48 Z', 'lo'),                              // the keyboard
  ...[16, 24, 32, 40, 48].map(x => S(`M${x} 36 L${x} 48`, 'ik', 1)),
  P('M8 12 L52 12 L52 32 L8 32 Z', 'bs'),                              // the control panel
  ...[16, 28, 40].map(x => C(x, 22, 3, 'hi')),                         // its knobs
]);
def('reed', () => [
  P('M22 8 Q18 30 24 52 L28 52 Q30 30 26 8 Z', 'gh'),                  // the shaved cane blade
  S('M22 18 L28 18', 'ik', 2.4),                                       // the ligature
]);
def('double_reed', () => [
  P('M26 6 L34 6 L34 24 L30 30 L26 24 Z', 'gh'),                       // two blades bound to a duckbill tip
  S('M26 14 L34 14', 'ik', 2),                                         // the thread binding
  P('M27 30 L33 30 L33 52 L27 52 Z', 'lo'),                            // the metal staple
]);
def('clarinet', () => [
  P('M24 6 Q20 8 22 14 L24 20 L36 20 L38 14 Q40 8 36 6 Z', 'hi'),      // the beaked mouthpiece
  P('M26 20 L34 20 L34 44 L26 44 Z', 'bs'),                            // the cylindrical bore
  P('M22 44 L38 44 L40 54 L20 54 Z', 'lo'),                            // the flared bell
  ...[26, 32, 38].map(y => C(30, y, 1.4, 'ik')),                       // tone holes
]);
def('saxophone', () => [
  P('M26 6 L32 6 L34 20 L30 24 L26 20 Z', 'hi'),                       // the crook
  P('M27 20 Q23 34 24 44 Q25 54 36 52 Q46 50 44 40 Q42 32 34 28 L28 24 Z', 'bs'), // the conical body, upturned
  C(40, 44, 3, 'lo'),                                                  // the bell opening
]);
def('oboe', () => [
  P('M27 6 L33 6 L33 10 L27 10 Z', 'gh'),                              // the double-reed tip
  P('M25 10 L35 10 L38 48 L22 48 Z', 'bs'),                            // the slender conical bore
  E(30, 50, 8, 3, 'lo'),                                               // its small bell flare
  ...[20, 28, 36].map(y => C(30, y, 1.2, 'ik')),                       // tone holes
]);
def('bassoon', () => [
  P('M20 8 L26 8 L26 46 L20 46 Z', 'bs'),                              // one bore
  P('M34 8 L40 8 L40 46 L34 46 Z', 'lo'),                              // the other, folded back
  P('M18 46 L42 46 L42 52 L18 52 Z', 'hi'),                            // the boot joining them
  S('M26 8 Q14 4 12 12', 'gh', 2.4), C(11, 12, 1.8, 'ik'),             // the bocal and its double reed
]);
def('free_reed', () => [
  P('M12 20 L48 20 L48 44 L12 44 Z', 'lo'),                            // the frame
  P('M18 24 L42 24 L42 40 L18 40 Z', 'ground'),                        // the slot cut through it
  P('M19 24 L41 26 L41 38 L19 40 Z', 'hi'),                            // the tongue, swinging free inside
]);
def('bellows', () => [
  P('M12 14 L48 10 L48 18 L12 22 Z', 'lo'),                            // the top board
  ...[24, 32, 40].map((y, i) => P(`M12 ${y - 4} L48 ${y - 8} L48 ${y} L12 ${y + 4} Z`, i % 2 ? 'hi' : 'bs')), // the pleats
  P('M12 46 L48 42 L48 50 L12 54 Z', 'lo'),                            // the bottom board
]);
def('harmonica', () => [
  P('M8 22 L52 22 L52 38 L8 38 Z', 'lo'),                              // the wood comb
  ...[13, 19, 25, 31, 37, 43, 49].map(x => P(`M${x - 1.6} 25 L${x + 1.6} 25 L${x + 1.6} 35 L${x - 1.6} 35 Z`, 'ground')), // reed slots
]);
def('accordion', () => [
  P('M8 14 L20 10 L20 50 L8 46 Z', 'bs'),                              // the left box, keys
  ...[24, 30, 36, 42].map((x, i) => P(`M${x - 2} 12 L${x + 2} 12 L${x + 2} 48 L${x - 2} 48 Z`, i % 2 ? 'hi' : 'lo')), // the pleated bellows
  P('M46 10 L52 14 L52 46 L46 50 Z', 'bs'),                            // the right box, buttons
  ...[16, 20, 24].map(y => C(14, y, 1.2, 'ik')),                       // piano keys
  ...[[49, 20], [49, 28], [49, 36]].map(([x, y]) => C(x, y, 1.4, 'ik')), // buttons
]);
def('reed_organ', () => [
  P('M8 8 L52 8 L52 30 L8 30 Z', 'lo'),                                // the case
  P('M12 32 L48 32 L48 42 L12 42 Z', 'bs'),                            // the keys
  ...[18, 24, 30, 36, 42].map(x => S(`M${x} 32 L${x} 42`, 'ik', 1)),
  E(20, 50, 7, 5, 'hi'), E(40, 50, 7, 5, 'hi'),                        // the foot-pumped pedals
]);
def('cullet', () => [
  ...[[18, 26, 9], [30, 20, 7], [42, 28, 8], [24, 40, 8], [38, 42, 9]].map(([x, y, s], i) =>
    P(`M${x - s} ${y} L${x} ${y - s} L${x + s} ${y} L${x} ${y + s} Z`, i % 2 ? 'hi' : 'bs')), // angular shards
  ...[[18, 26], [42, 28]].map(([x, y]) => S(`M${x - 4} ${y - 4} L${x + 4} ${y + 4}`, 'ik', 1)), // a glint off broken glass
]);

/* craft — Aztec & Maya mythology additions ────────────────────────────────
   Gods, places and texts, each drawn from an attribute the myths actually
   give them — goggle eyes, a smoking mirror, a serpent skirt, a long nose
   and lightning axe — rather than one generic robed figure repeated. */
def('quetzalcoatl', () => [
  S('M10 46 Q20 20 30 30 Q40 40 50 14', 'bs', 5),                      // the sinuous serpent body
  ...[[16, 36], [24, 26], [34, 30], [42, 22]].map(([x, y], i) => leaf('hi', x, y, .5, i % 2 ? -50 : 50)), // feathers along its back
  P('M48 10 L54 8 L52 16 Z', 'lo'),                                    // the open jaw
]);
def('tezcatlipoca', () => [
  C(28, 34, 14, 'ik'),                                                 // the obsidian mirror
  ring('hi', 28, 34, 14, 1.6),
  S('M42 22 Q46 12 42 4', 'gh', 2), S('M46 26 Q52 18 48 8', 'gh', 1.6), // smoke wisps rising from it
]);
def('huitzilopochtli', () => [
  C(38, 22, 10, 'bs'),
  ...Array.from({ length: 6 }, (_, i) => {
    const a = i * Math.PI / 3;
    return S(`M${n(38 + 10 * Math.cos(a))} ${n(22 + 10 * Math.sin(a))} L${n(38 + 15 * Math.cos(a))} ${n(22 + 15 * Math.sin(a))}`, 'hi', 1.8);
  }),                                                                  // the sun disc behind him
  P('M14 40 Q10 34 20 32 Q28 32 30 38 Q26 44 16 44 Z', 'lo'),          // the hummingbird body
  S('M10 34 L4 32', 'ik', 1.6),                                        // its long beak
  P('M22 34 L14 26 L20 36 Z', 'hi'),                                   // a wing
]);
def('tlaloc', () => [
  P('M16 14 L44 14 L44 40 Q30 48 16 40 Z', 'lo'),                      // the mask face
  ring('hi', 24, 24, 5, 2), C(24, 24, 2, 'ik'),                        // one goggle eye
  ring('hi', 36, 24, 5, 2), C(36, 24, 2, 'ik'),                        // the other
  P('M26 34 L26 42 L29 38 Z', 'ik'), P('M34 34 L34 42 L31 38 Z', 'ik'), // fangs
  ...[18, 30, 42].map(x => S(`M${x} 46 L${x} 54`, 'bs', 1.6)),         // rain, falling below
]);
def('coatlicue', () => [
  P('M16 22 L44 22 L52 54 L8 54 Z', 'lo'),                             // the flared serpent skirt
  ...[28, 36, 44].map(y => S(`M12 ${y} Q30 ${y - 5} 48 ${y} Q30 ${y + 5} 12 ${y}`, 'bs', 2)), // its woven snakes
  E(30, 16, 8, 6, 'hi'),                                               // the belt above it
]);
def('tonatiuh', () => [
  C(30, 28, 14, 'bs'),
  ...Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4;
    return S(`M${n(30 + 14 * Math.cos(a))} ${n(28 + 14 * Math.sin(a))} L${n(30 + 20 * Math.cos(a))} ${n(28 + 20 * Math.sin(a))}`, 'hi', 2.2);
  }),                                                                  // the sun's rays
  P('M26 36 L34 36 L30 50 Z', 'ik'),                                   // the protruding sacrificial tongue
  C(24, 26, 2, 'ground'), C(36, 26, 2, 'ground'),                      // eyes
]);
def('mictlantecuhtli', () => [
  P('M18 16 Q18 6 30 6 Q42 6 42 16 Q42 26 36 30 L36 36 L24 36 L24 30 Q18 26 18 16 Z', 'gh'), // the skull
  C(24, 18, 4, 'ground'), C(36, 18, 4, 'ground'),                      // hollow eye sockets
  C(30, 26, 2.2, 'ground'),                                            // the nasal cavity
  ...[24, 28, 32, 36].map(x => S(`M${x} 36 L${x} 42`, 'ik', 1.6)),     // bared teeth
]);
def('xiuhtecuhtli', () => [
  flame('bs', 1, 0),                                                   // fire, his own domain
  ...[[28, 18], [32, 18], [22, 28], [38, 28], [27, 36], [33, 36]].map(([x, y], i) => hex(i % 2 ? 'hi' : 'ik', x, y, 3, 1.2)), // turquoise mosaic tiles within it
]);
def('centeotl', () => [
  P('M24 10 L36 10 L34 50 L26 50 Z', 'hi'),                            // the cob
  ...[16, 22, 28, 34, 40, 46].map(y => [C(27, y, 1.6, 'bs'), C(33, y, 1.6, 'bs')]).flat(), // kernel rows
  leaf('lo', 20, 44, .9, -30), leaf('lo', 40, 44, .9, 30),             // husk leaves, peeled back
]);
def('xolotl', () => [
  P('M18 30 Q16 16 30 14 Q44 16 42 30 Q44 40 36 42 L34 50 L26 50 L24 42 Q16 40 18 30 Z', 'lo'), // the dog head
  P('M18 16 L22 6 L26 18 Z', 'bs'), P('M42 16 L38 6 L34 18 Z', 'bs'),  // pointed ears
  C(24, 28, 1.6, 'ground'), C(36, 28, 1.6, 'ground'),                  // eyes
]);
def('fifth_sun', () => [
  flame('lo', .8, 10),                                                 // the bonfire the gods leapt into
  C(30, 15, 10, 'bs'),                                                 // the new sun, risen above it
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI / 3) - Math.PI / 2;
    return S(`M${n(30 + 10 * Math.cos(a))} ${n(15 + 10 * Math.sin(a))} L${n(30 + 15 * Math.cos(a))} ${n(15 + 15 * Math.sin(a))}`, 'hi', 1.8);
  }),
]);
def('sun_stone', () => [
  C(30, 30, 22, 'lo'),                                                 // the 24-tonne basalt disc
  ring('bs', 30, 30, 22, 2.2), ring('hi', 30, 30, 15, 1.6), ring('bs', 30, 30, 8, 1.4), // its carved concentric bands
  ...Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4;
    return S(`M${n(30 + 8 * Math.cos(a))} ${n(30 + 8 * Math.sin(a))} L${n(30 + 22 * Math.cos(a))} ${n(30 + 22 * Math.sin(a))}`, 'ik', 1);
  }),                                                                  // the radial divisions
]);
def('mictlan', () => [
  ...[0, 1, 2, 3, 4].map(i =>
    P(`M${10 + i * 3} ${14 + i * 9} L${50 - i * 3} ${14 + i * 9} L${47 - i * 3} ${20 + i * 9} L${13 + i * 3} ${20 + i * 9} Z`, i % 2 ? 'hi' : 'lo')), // nine levels, narrowing as they descend
]);
def('kukulkan', () => [
  P('M8 50 L30 8 L52 50 Z', 'lo'),                                     // the stepped pyramid
  ...[[27, 33, 14], [23, 37, 20], [20, 40, 26], [16, 44, 32], [13, 47, 38], [10, 50, 44]].map(([x1, x2, y], i) =>
    S(`M${x1} ${y} L${x2} ${y}`, i % 2 ? 'hi' : 'bs', 1.6)),           // the terraced steps
  S('M40 12 Q46 22 42 34 Q38 44 44 48', 'bs', 3),                      // the serpent's shadow on the staircase
]);
def('itzamna', () => [
  S('M10 30 Q30 14 50 30', 'lo', 5),                                   // the sky serpent bar, arched
  P('M8 26 L16 30 L8 34 Z', 'bs'), P('M52 26 L44 30 L52 34 Z', 'bs'),  // a serpent head at each end
  C(30, 14, 3, 'hi'),                                                  // the celestial mark above
]);
def('ixchel', () => [
  P('M16 20 L44 20 L42 44 Q30 50 18 44 Z', 'lo'),                      // the jaguar face
  ...[[22, 26], [30, 24], [38, 26], [24, 34], [36, 34]].map(([x, y]) => C(x, y, 1.8, 'ik')), // its spots
  P('M42 10 A8 8 0 1 0 42 26 A6 6 0 1 1 42 10 Z', 'hi'),               // the crescent moon above
]);
def('chaac', () => [
  P('M14 18 Q14 10 26 10 L34 10 Q40 10 40 16 L48 24 L42 27 L34 18 L24 18 L20 30 L14 30 Z', 'lo'), // the long-nosed mask
  C(20, 16, 1.8, 'ground'),                                            // the eye
  S('M44 30 L50 40', 'ik', 3),                                         // the axe handle
  bolt('bs', 44, 28, .8),                                              // lightning struck from its head
]);
def('ek_chuah', () => [
  S('M20 6 L20 54', 'lo', 3),                                          // the traveller's staff
  P('M12 14 Q12 6 22 8 Q28 10 26 20 Q24 26 14 24 Q8 22 12 14 Z', 'bs'), // the merchant's pack, bundled
  E(38, 38, 6, 9, 'hi'), S('M38 30 L38 46', 'ik', 1.2),                // cacao carried on the trade route
]);
def('popol_vuh', () => [
  ...[0, 1, 2, 3].map(i => P(`M${12 + i * 10} 14 L${20 + i * 10} 10 L${20 + i * 10} 46 L${12 + i * 10} 50 Z`, i % 2 ? 'hi' : 'lo')), // the accordion-folded bark-paper book
  ...[16, 26, 36].map(x => S(`M${x} 22 L${x + 4} 22 M${x} 30 L${x + 4} 30`, 'ik', 1)), // glyphs on its pages
]);
def('hero_twins', () => [
  P('M10 50 Q10 20 30 20 Q50 20 50 50 Z', 'gh'),                       // the sloped ballcourt wall
  ring('bs', 44, 16, 7, 3),                                            // the stone ring
  C(30, 44, 6, 'hi'),                                                  // the rubber ball
  C(22, 40, 3, 'lo'), C(38, 48, 3, 'lo'),                               // the twins, playing as one
]);
def('xibalba', () => [
  P('M14 54 L14 24 Q14 8 30 8 Q46 8 46 24 L46 54 Z', 'lo'),            // the cave-mouth gate
  P('M20 54 L20 26 Q20 16 30 16 Q40 16 40 26 L40 54 Z', 'ground'),     // the darkness within
  C(30, 24, 1.8, 'gh'), C(24, 34, 1.4, 'gh'), C(36, 40, 1.4, 'gh'),    // faint bones in the dark
]);
def('cacao_of_the_gods', () => [
  P('M30 8 Q42 12 40 30 Q38 48 30 52 Q22 48 20 30 Q18 12 30 8 Z', 'lo'), // the ridged pod
  ...[16, 24, 32, 40, 48].map(y => S(`M22 ${y} Q30 ${y - 2} 38 ${y}`, 'hi', 1)), // its ridges
  ...granules('bs', 6, 3, [24, 20, 36, 40]),                           // beans spilling from a split
]);


/* living — book batch 08 additions: cat anatomy & breeds, tidepool
   invertebrates, amphibian biology, urban/wild species, and a handful of
   named mammals & birds. Each one draws the single fact its entry is
   actually about, the same discipline as the wolf/lion/zebra roster above. */

/* cat anatomy & breeds — one shared vocabulary (ellipse body, round head,
   triangular ears, curled tail), varied by the one trait each id is about */
def('purr',    () => [                                          // the sound, not the cat
  E(24, 40, 14, 10, 'bs'), C(38, 28, 7, 'bs'),
  P('M34 22 L33 15 L38 21 Z', 'bs'), P('M42 21 L45 14 L46 22 Z', 'bs'),
  S('M9 40 Q4 36 7 30', 'lo', 2.2),
  ...[0, 1, 2].map(i => S(`M${45 + i * 3} ${26 - i} Q${50 + i * 3} 30 ${45 + i * 3} ${34 + i}`, 'hi', 1.4)),
]);
def('barbed_tongue', () => [                                    // a built-in hairbrush
  P('M22 12 Q14 30 22 52 Q30 58 38 52 Q46 30 38 12 Q30 6 22 12 Z', 'bs'),
  ...[20, 28, 36, 44].map(y => S(`M20 ${y} L40 ${y - 5}`, 'hi', 1.6)),
]);
def('vomeronasal_organ', () => [                                // its own nerve, apart from ordinary smell
  C(28, 32, 16, 'bs'),
  P('M38 34 L54 30 L54 40 L38 38 Z', 'lo'),
  C(36, 30, 2.4, 'hi'),
  S('M36 30 Q28 18 22 10', 'ik', 1.6),
  S('M44 26 Q40 14 30 8', 'gh', 1.2),
]);
def('slit_pupil', () => [                                       // stays round in a tiger, snaps to a slit in a cat
  P('M6 30 Q30 12 54 30 Q30 48 6 30 Z', 'lo'),
  C(30, 30, 14, 'bs'),
  E(30, 30, 3, 13, 'ik'),
  C(24, 24, 2.2, 'gh'),
]);
def('manx',    () => [                                          // the short spine — no tail at all, so the drawing is the rump
  P('M14 50 Q10 30 30 26 Q50 30 46 50 Q38 56 30 56 Q22 56 14 50 Z', 'bs'),
  C(18, 20, 3, 'lo'), C(42, 20, 3, 'lo'),
  E(30, 52, 6, 2.4, 'hi'),
]);
def('siamese', () => [                                          // pale body, cool-skin "points" run dark — sitting, tail curled round the paws
  E(30, 40, 13, 14, 'hi'),
  C(30, 20, 8, 'lo'),
  P('M23 14 L21 6 L27 13 Z', 'lo'), P('M33 13 L39 6 L37 14 Z', 'lo'),
  S('M42 50 Q50 44 46 34 Q44 30 38 34', 'lo', 2.6),
  E(24, 52, 4, 3, 'lo'), E(36, 52, 4, 3, 'lo'),
]);
def('sphynx',  () => [                                          // no root for the hair to grow from
  E(28, 37, 15, 10, 'bs'), C(42, 27, 7, 'bs'),
  P('M36 20 L33 8 L43 19 Z', 'bs'), P('M46 19 L52 8 L49 21 Z', 'bs'),
  S('M20 32 Q24 35 20 39 M34 40 Q38 43 34 47', 'hi', 1.4),
  S('M13 41 Q7 37 10 30', 'lo', 2),
]);
def('devon_rex', () => [                                        // its own curl gene, big ears, an elfin face
  E(28, 37, 15, 10, 'bs'),
  ...[24, 30, 36].map(y => S(`M16 ${y} Q22 ${y - 3} 28 ${y} Q34 ${y + 3} 40 ${y}`, 'hi', 1.4)),
  C(43, 26, 6, 'bs'),
  P('M37 18 L33 6 L44 17 Z', 'bs'), P('M48 17 L55 6 L50 19 Z', 'bs'),
]);
def('scottish_fold', () => [                                    // folded forward, flat to the skull — a round-faced portrait, not a full body
  C(30, 32, 17, 'bs'),
  E(19, 26, 5, 3, 'lo'), E(41, 26, 5, 3, 'lo'),
  C(24, 30, 1.6, 'ik'), C(36, 30, 1.6, 'ik'),
  E(30, 48, 10, 6, 'hi'),
]);

/* tidepool invertebrates — a rock's worth of very different body plans;
   the wide 'living' fallback would draw every one of these identically */
def('barnacle', () => [                                         // cemented head-down, cirri kicking food in
  P('M16 50 L44 50 L36 20 L24 20 Z', 'bs'),
  ...[24, 30, 36].map(x => S(`M${x} 50 L${x} 20`, 'lo', 1.2)),
  ...[-1, 0, 1].map(i => S(`M${30 + i * 5} 20 Q${30 + i * 5} 10 ${28 + i * 5} 4`, 'hi', 1.6)),
]);
def('mussel',  () => [                                          // anchored by its own spun byssus threads
  P('M22 10 Q14 24 16 40 Q18 54 32 54 Q44 52 42 36 Q40 18 28 10 Z', 'lo'),
  S('M22 12 Q18 28 20 42', 'hi', 1.6),
  ...[[26, 50], [34, 50]].map(([x, y]) => S(`M${x} ${y} L${x - 2} ${y + 6}`, 'gh', 1.4)),
]);
def('periwinkle', () => [                                       // a tight coil, sealed flat to the rock
  S('M36 22 Q44 22 44 30 Q44 38 34 36 Q26 34 28 27 Q30 20 38 22', 'bs', 4),
  C(30, 30, 2, 'ik'),
  E(18, 42, 7, 3.4, 'gh'),
]);
def('limpet',  () => [                                          // one smooth dome, homed to its own worn scar
  P('M12 46 Q12 20 30 14 Q48 20 48 46 Z', 'bs'),
  S('M30 14 L30 22', 'hi', 1.6),
  S('M14 46 L46 46', 'ik', 2),
]);
def('chiton',  () => [                                          // eight overlapping plates, iron-capped teeth below
  E(30, 32, 22, 11, 'bs'),
  ...Array.from({ length: 8 }, (_, i) => S(`M${14 + i * 4.6} 24 L${14 + i * 4.6} 40`, 'lo', 1.6)),
]);
def('hermit_crab', () => [                                      // no shell of its own — a borrowed spiral
  C(26, 34, 13, 'lo'), C(31, 30, 8, 'bs'), C(34, 28, 4, 'hi'),
  P('M40 34 L52 30 L52 40 Z', 'bs'),
  S('M40 38 L48 44 M40 42 L46 48', 'lo', 2),
]);
def('sea_star', () => [                                         // hydraulic tube feet, hundreds of them
  ...Array.from({ length: 5 }, (_, i) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    return P(`M30 30 L${n(30 + 7 * Math.cos(a - .35))} ${n(30 + 7 * Math.sin(a - .35))} ` +
             `L${n(30 + 22 * Math.cos(a))} ${n(30 + 22 * Math.sin(a))} ` +
             `L${n(30 + 7 * Math.cos(a + .35))} ${n(30 + 7 * Math.sin(a + .35))} Z`, 'bs');
  }),
  C(30, 30, 5, 'hi'),
  ...Array.from({ length: 5 }, (_, i) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    return C(n(30 + 14 * Math.cos(a)), n(30 + 14 * Math.sin(a)), 1.4, 'lo');
  }),
]);
def('sand_dollar', () => [                                      // a flattened urchin, spines reduced to short ones
  C(30, 32, 20, 'bs'),
  ring('ik', 30, 32, 20, 1.4),
  ...Array.from({ length: 5 }, (_, i) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    return S(`M30 32 L${n(30 + 13 * Math.cos(a))} ${n(32 + 13 * Math.sin(a))}`, 'hi', 1.8);
  }),
]);
def('whelk',   () => [                                          // tall and pointed, a spine to pry a barnacle open
  E(28, 34, 10, 16, 'bs'),
  C(28, 22, 5, 'lo'), C(28, 15, 2.6, 'hi'),
  P('M36 38 L48 33 L44 42 Z', 'lo'),
]);
def('razor_clam', () => [                                       // straight and thin, dug down almost as fast as you can dig
  P('M18 10 L26 10 L24 50 L16 50 Z', 'bs'),
  P('M30 10 L38 10 L38 50 L32 50 Z', 'hi'),
  S('M27 50 Q27 56 27 58', 'lo', 2),
]);
def('brittle_star', () => [                                     // thin, snake-curved arms, unlike a sea star's fat ones
  C(30, 30, 6, 'bs'),
  ...Array.from({ length: 5 }, (_, i) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    const x1 = n(30 + 10 * Math.cos(a)), y1 = n(30 + 10 * Math.sin(a));
    const x2 = n(30 + 22 * Math.cos(a + .3)), y2 = n(30 + 22 * Math.sin(a + .3));
    return S(`M30 30 Q${x1} ${y1} ${x2} ${y2}`, 'lo', 2.4);
  }),
]);
def('porcelain_crab', () => [                                   // fine fringed legs, filtering — not a predator's claws
  E(30, 32, 14, 11, 'bs'),
  ...[[18, 26], [42, 26]].map(([x, y]) => S(`M${x} ${y} L${x < 30 ? x - 8 : x + 8} ${y - 6}`, 'lo', 2)),
  ...[0, 1, 2].map(i => S(`M${20 + i * 4} 42 L${18 + i * 4} 50`, 'hi', 1.2)),
  S('M14 50 Q14 40 20 40', 'ground', 2.4),
]);

/* amphibian biology — the life cycle and the anatomy it depends on */
def('frogspawn', () => [                                        // jelly only, no shell at all
  P('M10 32 Q10 16 30 16 Q50 16 50 32 Q50 46 30 46 Q10 46 10 32 Z', 'gh'),
  ...[[18, 24], [28, 20], [38, 24], [20, 34], [30, 32], [40, 36], [24, 42], [36, 42]]
    .map(([x, y]) => C(x, y, 3.4, 'bs')),
]);
def('tadpole', () => [                                          // fully aquatic, nothing like the frog it becomes
  C(22, 30, 10, 'bs'),
  P('M30 30 Q46 26 54 30 Q46 34 30 30 Z', 'bs'),
  ...[[15, 24], [15, 36]].map(([x, y]) => S(`M${x} ${y} Q${x - 6} ${y} ${x - 7} ${y < 30 ? y - 4 : y + 4}`, 'hi', 1.6)),
]);
def('gill',    () => [                                          // a blood-rich fringe, pulling oxygen from water
  S('M30 10 L30 50', 'lo', 3),
  ...Array.from({ length: 6 }, (_, i) => {
    const y = 14 + i * 6.5, s = i % 2 ? -1 : 1;
    return S(`M30 ${n(y)} Q${30 + s * 14} ${n(y + 2)} ${30 + s * 18} ${n(y + 6)}`, 'bs', 2.2);
  }),
]);
def('lung',    () => [                                          // only finished as the gills go
  S('M30 6 L30 20', 'lo', 3.4),
  P('M30 20 Q14 20 12 36 Q10 52 24 50 Q30 48 30 20 Z', 'bs'),
  P('M30 20 Q46 20 48 36 Q50 52 36 50 Q30 48 30 20 Z', 'bs'),
  ...[[18, 34], [24, 42], [38, 34], [34, 42]].map(([x, y]) => C(x, y, 2.2, 'hi')),
]);
def('metamorphosis', () => [                                    // a gilled swimmer remade into an air-breather
  C(22, 30, 9, 'bs'),
  P('M30 30 Q40 27 44 30 Q40 33 30 30 Z', 'gh'),
  S('M28 36 Q30 46 26 52 M32 36 Q36 44 40 48', 'lo', 2.4),
]);
def('amphibian_skin', () => [                                   // little keratin, no scales, must stay damp
  P('M10 14 L50 14 L50 50 L10 50 Z', 'lo'),
  ...[[20, 24], [38, 22], [16, 38], [32, 36], [44, 42]].map(([x, y]) => E(x, y, 2.2, 3, 'hi')),
]);
def('cutaneous_respiration', () => [                             // breathing through the skin, no lungs needed
  E(30, 32, 22, 9, 'bs'),
  ...[[16, 26], [24, 24], [32, 26], [40, 24], [46, 28]].map(([x, y]) => S(`M${x} ${y} L${x} ${y - 6}`, 'hi', 1.4)),
]);
def('indicator_species', () => [                                // permeable skin makes it an early warning
  wave('lo', 44, 4, 24),
  E(26, 36, 9, 6, 'bs'), C(34, 32, 4.4, 'bs'),
  ring('hi', 48, 18, 7, 1.8), S('M48 18 L52 13', 'ik', 1.6),
]);
def('lateral_line', () => [                                     // pressure sensors down the flank, for water not air
  P('M8 32 Q14 20 30 20 Q46 20 52 32 Q46 44 30 44 Q14 44 8 32 Z', 'bs'),
  ...Array.from({ length: 7 }, (_, i) => C(n(14 + i * 5.2), 32, 1.3, 'hi')),
]);

/* named amphibians */
def('caecilian', () => [                                        // limbless and burrowing, but a vertebrate
  S('M8 18 Q22 42 30 30 Q38 18 52 40', 'bs', 7),
  ...[[14, 24], [22, 36], [30, 30], [38, 22], [46, 32]].map(([x, y]) => S(`M${x - 2} ${y - 3} L${x + 2} ${y + 3}`, 'lo', 1.4)),
  C(9, 19, 1.6, 'ik'),
]);
def('japanese_giant_salamander', () => [                        // huge, flat, wrinkled skin exists purely to breathe
  P('M8 34 Q8 20 30 20 Q52 20 52 34 Q52 46 30 46 Q8 46 8 34 Z', 'lo'),
  ...[16, 24, 32, 40, 48].map(x => S(`M${x} 22 L${x} 44`, 'hi', 1.6)),
  ...[[14, 42], [46, 42]].map(([x, y]) => S(`M${x} ${y} L${x < 30 ? x - 6 : x + 6} ${y + 6}`, 'bs', 2.6)),
  C(18, 28, 1.6, 'ik'), C(42, 28, 1.6, 'ik'),
]);
def('surinam_toad', () => [                                     // eggs sealed into pockets in her own back skin
  P('M30 10 Q50 20 46 40 Q40 52 30 52 Q20 52 14 40 Q10 20 30 10 Z', 'bs'),
  ...[[22, 26], [30, 22], [38, 26], [24, 34], [36, 34], [30, 42]].map(([x, y]) => C(x, y, 2.2, 'lo')),
  C(20, 16, 1.4, 'ik'), C(40, 16, 1.4, 'ik'),
]);
def('batrachotoxin', () => [                                    // borrowed poison, worn as a warning
  E(30, 34, 16, 12, 'bs'),
  ...[[20, 26], [30, 22], [40, 26], [22, 38], [38, 38]].map(([x, y]) => C(x, y, 3, 'hi')),
  ...[-8, 8].map(dx => S(`M${30 + dx} 44 L${30 + dx} 52`, 'lo', 2.6)),
]);
def('olm',     () => [                                          // blind and pale, external gills kept for life
  S('M8 32 Q20 24 30 32 Q40 40 52 30', 'gh', 7),
  ...[[10, 28], [10, 36]].map(([x, y]) => S(`M${x} ${y} Q${x - 6} ${y - 2} ${x - 8} ${y < 32 ? y - 2 : y + 2}`, 'bs', 2)),
  ...[[18, 30], [42, 32]].map(([x, y]) => S(`M${x} ${y} L${x - 2} ${y + 6}`, 'hi', 1.8)),
]);
def('siren',   () => [                                          // lungs and external gills, side by side, for life
  S('M8 32 L52 32', 'bs', 8),
  ...[[10, 26], [10, 38]].map(([x, y]) => S(`M${x} ${y} Q${x - 7} ${y - 2} ${x - 9} ${y < 32 ? y - 3 : y + 3}`, 'hi', 2.2)),
  S('M18 36 L14 44 M24 37 L21 45', 'lo', 2),
  E(38, 32, 4, 6, 'gh'),
]);

/* urban & everyday wild species */
def('housefly', () => [                                         // one pair of wings, not two
  E(30, 34, 9, 12, 'bs'), C(30, 22, 6, 'bs'),
  C(26, 20, 2.2, 'ik'), C(34, 20, 2.2, 'ik'),
  E(18, 28, 10, 5, 'gh'), E(42, 28, 10, 5, 'gh'),
]);
def('rat',     () => [                                          // incisors that never stop growing, so it gnaws
  E(24, 34, 15, 9, 'bs'),
  P('M38 32 L50 29 L48 36 Z', 'bs'),
  S('M50 32 L46 26 M50 34 L54 38', 'lo', 1.2),
  P('M42 26 L44 20 L48 25 Z', 'lo'),
  S('M10 36 Q4 42 8 50 Q12 56 6 56', 'lo', 1.6),
]);
def('feral_pigeon', () => [                                     // still nests on a ledge like its cliff-born ancestors
  E(28, 34, 14, 12, 'bs'), C(40, 24, 7, 'bs'),
  C(38, 22, 2, 'hi'),
  P('M46 25 L54 26 L46 28 Z', 'lo'),
  S('M10 44 L50 44', 'ik', 3),
  S('M22 46 L20 52 M32 46 L34 52', 'lo', 2),
]);
def('garden_snail', () => [                                     // fires a calcite dart before mating
  C(34, 26, 11, 'bs'), C(38, 24, 6, 'hi'), C(40, 23, 2.6, 'lo'),
  P('M16 40 Q10 32 16 26 Q26 22 30 32 Q30 42 20 42 Z', 'bs'),
  S('M18 26 L14 16 M24 26 L22 16', 'lo', 1.6),
  S('M44 34 L50 28', 'gh', 1.6),
]);
def('common_toad', () => [                                      // walks on four legs, doesn't hop
  E(30, 34, 17, 13, 'bs'),
  C(20, 24, 4, 'bs'), C(40, 24, 4, 'bs'),
  ...[[20, 30], [30, 26], [40, 30], [24, 40], [36, 40]].map(([x, y]) => C(x, y, 1.6, 'lo')),
  ...[-10, -4, 4, 10].map(dx => S(`M${30 + dx} 44 L${30 + dx} 50`, 'lo', 2.4)),
]);
def('tortoiseshell', () => [                                    // keratin scutes, not the turtle itself
  P('M10 20 L50 20 L50 44 L10 44 Z', 'hi'),
  ...[[16, 26], [28, 24], [40, 28], [20, 36], [34, 38], [44, 34]].map(([x, y]) => C(x, y, 3.4, 'lo')),
  S('M10 44 L50 44', 'ik', 1.6),
]);

/* named mammals, birds, and one giant */
def('mammoth', () => [                                          // shaggy, and tusked far more than an elephant
  E(26, 38, 19, 13, 'bs'), C(44, 28, 9, 'bs'),
  S('M50 30 Q58 25 55 15', 'hi', 3),
  S('M48 33 Q40 44 46 52', 'hi', 3),
  ...[[18, 26], [26, 22], [34, 24], [42, 20]].map(([x, y]) => S(`M${x} ${y} L${x - 2} ${y - 6}`, 'lo', 1.8)),
]);
def('psilocybin_mushroom', () => [                               // bruises blue-green wherever it's cut
  mound('lo', 50, 20, 10),
  S('M30 50 L30 30', 'bs', 3.4),
  P('M18 30 Q18 16 30 16 Q42 16 42 30 Q30 34 18 30 Z', 'hi'),
  ...[[22, 26], [34, 24], [28, 20]].map(([x, y]) => C(x, y, 2, 'lo')),
]);
def('psilocybin', () => [                                       // a prodrug — the body converts it to what actually acts
  hex('gh', 18, 30, 9, 2),
  S('M29 30 L37 30 M34 27 L37 30 L34 33', 'ik', 2),
  hex('bs', 44, 30, 9, 2),
]);
def('als',     () => [                                          // the mind stays intact while motor neurons die
  C(20, 30, 7, 'bs'),
  S('M27 30 L34 30 L34 24 M34 30 L40 34 M34 30 L40 26', 'lo', 2),
  S('M27 32 L52 40', 'gh', 2),
  C(48, 41, 1.6, 'gh'),
]);
def('echolocation', () => [                                     // sound sent out, and read back off the world
  C(10, 32, 2.6, 'bs'),
  S('M10 22 A10 10 0 0 1 10 42', 'hi', 1.6),
  S('M10 16 A16 16 0 0 1 10 48', 'gh', 1.4),
  E(48, 32, 5, 8, 'lo'),
  S('M50 24 A10 10 0 0 0 50 40', 'gh', 1.4),
]);
def('frozen_zoo', () => [                                       // frozen cells from endangered species, ready to thaw
  facet('gh', .8),
  ...[[22, 26], [36, 24], [26, 38], [38, 36]].flatMap(([x, y]) => [C(x, y, 3, 'bs'), S(`M${x} ${y - 3} L${x} ${y + 3}`, 'hi', 1)]),
]);
def('aardvark', () => [                                         // a tubular snout, and 50,000 termites a night
  E(24, 36, 15, 10, 'bs'),
  P('M38 34 Q54 34 54 40 Q54 44 38 42 Z', 'bs'),
  P('M18 24 L14 8 L24 22 Z', 'hi'), P('M28 22 L26 6 L34 20 Z', 'hi'),
  S('M54 40 L58 43', 'lo', 1.4),
  S('M14 44 L10 50 M20 45 L17 51', 'lo', 2),
]);
def('beaver',  () => [                                          // a keystone engineer, flat paddle tail and all
  E(24, 34, 15, 11, 'bs'), C(38, 28, 7, 'bs'),
  P('M10 36 Q2 36 2 44 Q2 52 12 50 Q16 44 12 38 Z', 'lo'),
  ...[0, 1, 2].map(i => C(4 + i * 3, 44 + i, .8, 'gh')),
  P('M40 32 L38 38 L42 38 Z', 'hi'),
]);
def('naked_mole_rat', () => [                                   // hairless, wrinkled, and near-blind
  E(30, 34, 20, 9, 'hi'),
  ...[18, 26, 34, 42].map(x => S(`M${x} 27 Q${x + 2} 34 ${x} 41`, 'lo', 1.2)),
  P('M48 30 L54 32 L48 36 Z', 'lo'),
  C(46, 28, 1, 'ik'),
]);
def('pronghorn', () => [                                        // outrunning a cheetah that no longer exists
  E(26, 36, 15, 9, 'bs'), C(41, 28, 6, 'bs'),
  S('M40 22 Q40 14 44 10 M40 22 Q37 15 40 9 M44 10 L48 8 M40 9 L37 5', 'lo', 2),
  ...[-9, -3, 4, 10].map(dx => S(`M${26 + dx} 43 L${26 + dx} 52`, 'lo', 2.2)),
  S('M4 40 L14 40 M2 44 L12 44', 'gh', 1.4),
]);
def('fennec_fox', () => [                                       // the biggest ears of any canid, for its size
  E(28, 40, 12, 8, 'bs'), C(34, 30, 6, 'bs'),
  P('M28 26 L20 6 L34 24 Z', 'hi'), P('M38 24 L48 6 L40 26 Z', 'hi'),
  S('M18 44 Q10 42 12 36', 'lo', 2),
]);
def('vampire_bat', () => [                                      // reading a warm vein by heat, in total darkness
  C(30, 30, 6, 'bs'),
  P('M24 28 Q6 20 4 34 Q6 40 24 34 Z', 'bs'), P('M36 28 Q54 20 56 34 Q54 40 36 34 Z', 'bs'),
  P('M27 34 L26 40 L29 34 Z', 'hi'), P('M31 34 L34 40 L33 34 Z', 'hi'),
  C(30, 25, 1.6, 'lo'),
]);
def('aye_aye', () => [                                          // one impossibly long, thin finger for grubs
  E(28, 38, 13, 10, 'bs'), C(38, 26, 8, 'bs'),
  C(35, 24, 3, 'ik'), C(42, 25, 3, 'ik'),
  P('M28 20 L22 8 L32 18 Z', 'hi'), P('M44 20 L52 10 L46 22 Z', 'hi'),
  S('M46 34 Q56 34 56 24', 'lo', 1.6),
]);
def('star_nosed_mole', () => [                                  // a starburst of 25,000 touch sensors on its nose
  E(26, 32, 16, 11, 'bs'), C(42, 30, 5, 'bs'),
  ...Array.from({ length: 9 }, (_, i) => {
    const a = (i * 40) * Math.PI / 180;
    return S(`M${n(42 + 5 * Math.cos(a))} ${n(30 + 5 * Math.sin(a))} L${n(42 + 9 * Math.cos(a))} ${n(30 + 9 * Math.sin(a))}`, 'hi', 1.2);
  }),
  ...[-8, 0, 8].map(dx => S(`M${26 + dx} 41 L${26 + dx} 47`, 'lo', 2)),
]);
def('barn_owl', () => [                                         // a heart-shaped disc that funnels sound, not sight
  E(30, 36, 14, 14, 'bs'),
  P('M30 18 Q18 18 20 28 Q22 36 30 36 Q38 36 40 28 Q42 18 30 18 Z', 'hi'),
  C(25, 26, 2, 'ik'), C(35, 26, 2, 'ik'),
  P('M28 30 L30 34 L32 30 Z', 'lo'),
]);
def('satin_bowerbird', () => [                                  // a stick avenue, decorated almost entirely in blue
  ...[-10, -4, 4, 10].map(dx => S(`M${30 + dx} 50 L${30 + dx * .6} 18`, 'lo', 2)),
  ...[[20, 48], [30, 50], [40, 48], [25, 44], [35, 44]].map(([x, y]) => C(x, y, 2, 'water-bs')),
  C(46, 20, 6, 'bs'), P('M52 20 L58 18 L52 22 Z', 'lo'),
]);
def('leatherback_turtle', () => [                                // ridged and leathery, not hard scutes; flippers, not legs
  E(30, 32, 20, 15, 'lo'),
  ...[-14, -9, -4, 0, 4, 9, 14].map(dx => S(`M${30 + dx * .9} 18 Q${30 + dx} 32 ${30 + dx * .9} 46`, 'hi', 1.4)),
  P('M10 30 L2 22 L4 36 Z', 'bs'), P('M50 30 L58 22 L56 36 Z', 'bs'),
]);
def('archerfish', () => [                                        // a shaped jet of water, aimed past the surface's bend
  P('M10 40 Q22 30 40 40 Q22 48 10 40 Z', 'bs'),
  P('M40 40 L50 35 L50 45 Z', 'lo'),
  horizon('water-hi', 40),
  S('M22 38 Q20 24 18 12', 'hi', 1.8),
  C(17, 8, 2, 'lo'), leaf('plant-bs', 24, 8, .5, 20),
]);


/* living — genetics, neuroscience & three more animals (batch 05) ────────
 * A wide, mostly non-animal sweep of the `living` category: the DNA
 * replication/transcription machinery, drawn as the actual mechanism at
 * each step (a fork prying open, fragments with real gaps, a loop excised
 * and stitched shut) rather than a repeated helix; the neurotransmitters,
 * drawn to skeletal-chemistry convention like the amino acids they sit
 * beside; neuron/glia anatomy, one real structural trait each (a branching
 * receptor antenna for the dendrite, concentric wraps for myelin, a star
 * for the astrocyte); and the brain's own regions, each a shape with its
 * own real silhouette (a seahorse for the hippocampus, paired almonds for
 * the amygdala, a folded band for cortex) rather than one outline recoloured
 * nineteen times — swan, conch, mouse and monkey close it out on their one
 * true tell apiece: the swan's neck, the conch's spiral, the mouse's tail
 * and whiskers, the monkey's curling grip.
 */

/* genetics — the replication/transcription machinery, one mechanism each ─ */
def('parthenogenesis', () => [                                  // one egg becomes two, no second parent
  E(16, 24, 9, 12, 'bs'),
  S('M27 24 L37 24', 'ik', 2), P('M33 20 L39 24 L33 28 Z', 'ik'),
  E(48, 24, 7, 9, 'bs'),
]);
def('de_extinction', () => [                                     // a living relative's helix, one gene swapped in
  S('M14 8 Q28 18 14 28 Q28 38 14 48', 'ik', 3),
  S('M44 8 Q30 18 44 28 Q30 38 44 48', 'ik', 3),
  S('M16 16 L42 16', 'gh', 1.6), S('M16 40 L42 40', 'gh', 1.6),
  S('M16 26 L42 26', 'living-hi', 3.4),
  S('M48 44 Q54 38 52 28', 'lo', 2.4),
]);
def('dna_sequencing', () => [                                    // bases read off, one letter at a time
  ...[0, 1, 2, 3, 4, 5, 6].map(i => C(6 + i * 8, 40, 3, ['#FF0D0D', '#3050F8', '#FFD030', '#3DFF00'][i % 4])),
  S('M22 14 L22 36', 'ik', 2), P('M17 9 L27 9 L22 16 Z', 'ik'),
]);
def('mitochondrial_dna', () => [                                 // circular, unlike the nucleus's linear strands
  P('M10 30 Q10 12 30 12 Q50 12 50 30 Q50 48 30 48 Q10 48 10 30 Z', 'lo'),
  ...[18, 26, 34, 42].map(x => S(`M${x} 18 Q${x + 4} 30 ${x} 42`, 'gh', 1.6)),
  ring('bs', 30, 30, 8, 2.4),
]);
def('dna_profile', () => [                                       // a gel ladder — the unique pattern IS the picture
  ...[[10, [16, 28, 40]], [20, [12, 24, 44]], [30, [18, 30, 36]], [40, [14, 26, 48]], [50, [20, 32, 42]]]
    .flatMap(([x, ys]) => ys.map(y => P(`M${x - 3} ${y} L${x + 3} ${y} L${x + 3} ${y + 4} L${x - 3} ${y + 4} Z`, 'bs'))),
]);
def('dna_helicase', () => [                                      // the motor, prying the fork open
  S('M22 6 L22 24', 'ik', 3), S('M38 6 L38 24', 'ik', 3),
  P('M22 24 L38 24 L30 34 Z', 'bs'),
  S('M30 34 Q14 42 10 54', 'ik', 3), S('M30 34 Q46 42 50 54', 'ik', 3),
]);
def('primase', () => [                                           // a short RNA primer, laid on bare template
  S('M8 32 L52 32', 'ik', 3),
  S('M20 32 L32 32', 'bs', 5),
  C(26, 20, 6, 'hi'), S('M26 26 L26 20', 'gh', 1.6),
]);
def('dna_polymerase', () => [                                    // extending a primer's 3' end, one base at a time
  S('M6 34 L54 34', 'ik', 2.6),
  C(38, 26, 7, 'bs'),
  ...[10, 16, 22, 28].map(x => C(x, 40, 2.6, 'hi')),
]);
def('okazaki_fragment', () => [                                  // short, discontinuous — the gaps are the point
  ...[[6, 16], [20, 30], [34, 44], [48, 54]].map(([x1, x2]) => S(`M${x1} 30 L${x2} 30`, 'bs', 4)),
  S('M6 44 L54 44', 'gh', 1.4),
]);
def('dna_ligase', () => [                                        // sealing the nick between two fragment ends
  S('M8 30 L26 30', 'bs', 4), S('M34 30 L52 30', 'bs', 4),
  S('M26 30 L34 30', 'ik', 4),
  C(30, 20, 4, 'hi'), S('M30 24 L30 30', 'gh', 1.4),
]);
def('dna_replication', () => [                                   // semiconservative: one old strand, one new, twice
  S('M30 6 L30 20', 'ik', 3.4),
  S('M30 20 Q14 30 10 50', 'ik', 3), S('M30 20 Q10 30 6 50', 'hi', 3),
  S('M30 20 Q46 30 50 50', 'ik', 3), S('M30 20 Q50 30 54 50', 'hi', 3),
]);
def('rna_polymerase', () => [                                    // opening the helix, building RNA off the template
  S('M6 22 L54 22', 'ik', 2.4), S('M6 30 L54 30', 'gh', 2),
  C(30, 26, 7, 'bs'),
  S('M30 34 Q34 42 40 46', 'ik', 2.4), C(40, 46, 2.6, '#3050F8'),
]);
def('transcription', () => [                                     // DNA opens, RNA peels off in a different colour
  S('M6 40 L28 40', 'ik', 3), S('M6 46 L28 46', 'ik', 3),
  S('M28 40 Q38 34 28 46', 'gh', 2),
  S('M28 20 Q42 26 54 20', 'bs', 3),
  ...[36, 44, 52].map(x => C(x, n(20 - (x - 28) * 0.15), 2, 'hi')),
]);
def('codon', () => [                                             // three mRNA bases, read as one unit
  C(20, 30, 5, '#FF0D0D'), C(30, 30, 5, '#3050F8'), C(40, 30, 5, '#FFD030'),
  S('M14 20 L14 40', 'ik', 2), S('M46 20 L46 40', 'ik', 2),
]);
def('anticodon', () => [                                         // tRNA's own triplet, reaching down to pair
  S('M30 10 Q14 14 14 26 Q14 38 30 38 Q46 38 46 26 Q46 14 30 10 Z', 'gh', 2),
  C(24, 46, 4, '#3050F8'), C(30, 50, 4, '#FF0D0D'), C(36, 46, 4, '#FFD030'),
  S('M24 42 L24 46', 'ik', 1.6), S('M30 46 L30 50', 'ik', 1.6), S('M36 42 L36 46', 'ik', 1.6),
]);
def('translation', () => [                                       // the message read, a chain built as it goes
  S('M4 20 L56 20', 'ik', 2.4),
  ...[10, 20, 30, 40, 50].map((x, i) => C(x, 20, 2, ['#FF0D0D', '#3050F8', '#FFD030', '#3DFF00'][i % 4])),
  S('M20 26 L20 34 L28 38 L28 46 L36 42 L36 50', 'bs', 2.6),
  ...[[20, 34], [28, 46], [36, 50]].map(([x, y]) => C(x, y, 2.4, 'hi')),
]);
def('intron', () => [                                            // looped out of the transcript, marked for removal
  S('M6 32 L20 32', 'bs', 3), S('M40 32 L54 32', 'bs', 3),
  S('M20 32 Q30 12 40 32', 'gh', 3),
  S('M22 24 L38 24', 'ik', 1.4),
]);
def('exon', () => [                                              // what's left, stitched into one strand
  S('M6 32 L54 32', 'bs', 4),
  S('M20 32 L20 26', 'ik', 1.6), S('M40 32 L40 26', 'ik', 1.6),
  C(30, 32, 2, 'hi'),
]);
def('splicing', () => [                                          // the loop cut, the flanking ends about to join
  S('M6 30 L20 30', 'bs', 3), S('M40 30 L54 30', 'bs', 3),
  S('M20 30 Q30 14 40 30', 'gh', 3),
  S('M26 18 L22 22', 'ik', 1.8), S('M26 18 L30 22', 'ik', 1.8),
  S('M20 30 Q30 34 40 30', 'lo', 2),
]);
def('point_mutation', () => [                                    // one rung, swapped, the rest untouched
  S('M14 8 L14 52', 'ik', 3), S('M46 8 L46 52', 'ik', 3),
  ...[14, 34, 44].map(y => S(`M14 ${y} L46 ${y}`, 'gh', 2.4)),
  S('M14 24 L46 24', 'bs', 3.4),
]);
def('frameshift_mutation', () => [                                // one indel, and every triplet after reads wrong
  C(8, 26, 3, '#FF0D0D'), C(16, 26, 3, '#3050F8'), C(24, 26, 3, '#FFD030'),
  S('M6 20 L6 32', 'ik', 1.6), S('M26 20 L26 32', 'ik', 1.6),
  C(34, 34, 3, '#3DFF00'), C(41, 34, 3, '#FF0D0D'), C(48, 34, 3, '#3050F8'), C(55, 34, 3, '#FFD030'),
  S('M31 40 Q34 44 40 44 Q46 44 50 40', 'gh', 1.4),
]);

/* neuron & glia — cell types and the messengers between them ────────────── */
def('neuron', () => [                                            // soma, dendrites, one long axon out
  C(20, 30, 8, 'bs'),
  ...[[-6, -8], [2, -9], [8, -5], [-8, 2], [-3, 8]].map(([dx, dy]) => S(`M20 30 L${n(20 + dx * 1.8)} ${n(30 + dy * 1.8)}`, 'lo', 1.6)),
  S('M28 30 L52 30', 'ik', 2.4),
  S('M52 30 L58 24', 'ik', 1.6), S('M52 30 L58 30', 'ik', 1.6), S('M52 30 L58 36', 'ik', 1.6),
]);
def('axon', () => [                                               // the single output cable, insulated in segments
  S('M4 30 L56 30', 'bs', 4),
  ...[12, 24, 36, 48].map(x => S(`M${x - 4} 30 L${x + 4} 30`, 'hi', 7)),
]);
def('dendrite', () => [                                           // a branching antenna, receptors at every tip
  S('M30 54 L30 34', 'bs', 3),
  S('M30 34 L18 22', 'bs', 2.4), S('M30 34 L42 22', 'bs', 2.4),
  S('M18 22 L10 12', 'bs', 1.8), S('M18 22 L22 10', 'bs', 1.8),
  S('M42 22 L38 10', 'bs', 1.8), S('M42 22 L50 12', 'bs', 1.8),
  ...[[10, 12], [22, 10], [38, 10], [50, 12]].map(([x, y]) => C(x, y, 2, 'hi')),
]);
def('glia', () => [                                               // half the brain's cells, none of them firing
  ...[[16, 20, 'bs'], [30, 16, 'hi'], [42, 24, 'bs'], [20, 38, 'hi'], [36, 40, 'bs']].map(([x, y, r]) => C(x, y, 6, r)),
]);
def('astrocyte', () => [                                          // star-shaped, wrapped around a capillary
  C(30, 26, 7, 'bs'),
  ...Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2;
    return S(`M30 26 L${n(30 + 18 * Math.cos(a))} ${n(26 + 18 * Math.sin(a))}`, 'lo', 2);
  }),
  S('M8 46 Q30 52 52 46', 'water-bs', 3),
]);
def('oligodendrocyte', () => [                                    // one cell, myelinating several axons at once
  C(30, 14, 6, 'bs'),
  S('M25 18 Q14 24 14 32', 'lo', 2), S('M30 20 L30 32', 'lo', 2), S('M35 18 Q46 24 46 32', 'lo', 2),
  S('M4 32 L20 32', 'hi', 3), S('M22 38 L38 38', 'hi', 3), S('M40 32 L56 32', 'hi', 3),
]);
def('myelin_sheath', () => [                                      // concentric wraps, seen end on
  C(30, 30, 4, 'ik'),
  ring('bs', 30, 30, 9, 2.4), ring('hi', 30, 30, 14, 2), ring('bs', 30, 30, 19, 1.6),
]);
def('synapse', () => [                                            // the gap, and what crosses it
  S('M10 30 L26 30', 'bs', 4), S('M34 30 L50 30', 'hi', 4),
  C(28, 26, 1.6, 'gh'), C(29, 30, 1.6, 'gh'), C(28, 34, 1.6, 'gh'),
]);
def('neurotransmitter', () => [                                   // one vesicle, dumped into the cleft
  C(18, 22, 8, 'bs'),
  C(30, 28, 2.2, 'hi'), C(36, 24, 2.2, 'hi'), C(34, 34, 2.2, 'hi'), C(42, 30, 2.2, 'hi'),
]);

/* neurotransmitter chemistry — skeletal convention, same as the amino acids */
def('choline', () => [                                            // an ethanol head on a trimethylammonium tail
  S('M14 34 L14 44', 'ik', 2.2), C(14, 46, 4.2, CPK.O),
  S('M14 34 L26 28', 'ik', 2.2),
  S('M26 28 L38 34', 'ik', 2.2), C(38, 34, 4.6, CPK.N),
  S('M38 34 L48 26', 'ik', 1.8), S('M38 34 L50 36', 'ik', 1.8), S('M38 34 L44 46', 'ik', 1.8),
  C(48, 26, 3.6, CPK.C), C(50, 36, 3.6, CPK.C), C(44, 46, 3.6, CPK.C),
]);
def('acetylcholine', () => [                                      // choline's OH, capped with an acetyl ester
  C(8, 44, 4, CPK.C),
  S('M8 44 L16 38', 'ik', 2.2),
  ...double([16, 38], [10, 28], 'ik'), C(10, 28, 3.8, CPK.O),
  S('M16 38 L26 40', 'ik', 2.2), C(26, 40, 4, CPK.O),
  S('M26 40 L34 32', 'ik', 2.2), S('M34 32 L44 34', 'ik', 2.2),
  C(44, 34, 4.6, CPK.N),
  S('M44 34 L52 26', 'ik', 1.8), S('M44 34 L54 38', 'ik', 1.8), S('M44 34 L48 46', 'ik', 1.8),
  C(52, 26, 3.6, CPK.C), C(54, 38, 3.6, CPK.C), C(48, 46, 3.6, CPK.C),
]);
def('dopamine', () => [                                           // a catechol ring, plain ethylamine tail
  hex('ik', 18, 30, 9, 2),
  S('M12 22 L6 16', 'ik', 1.8), C(6, 16, 3.6, CPK.O),
  S('M21 22 L21 12', 'ik', 1.8), C(21, 12, 3.6, CPK.O),
  S('M27 32 L38 28', 'ik', 2), S('M38 28 L46 36', 'ik', 2),
  C(46, 36, 4.4, CPK.N),
]);
def('serotonin', () => [                                          // an indole — the fused rings tryptophan owns —
  hex('ik', 16, 40, 8, 2),                                        // ...with a ring OH and a short amine tail
  S('M23 35 L32 36 L32 44 L23 45', 'ik', 1.8), C(32, 36, 3.2, CPK.N),
  S('M10 32 L10 22', 'ik', 1.8), C(10, 22, 3.6, CPK.O),
  S('M32 44 L42 48', 'ik', 2), S('M42 48 L50 42', 'ik', 2),
  C(50, 42, 4.2, CPK.N),
]);
def('glutamate', () => [                                          // glutamic acid's backbone, mid-release
  ...aminoBackbone(), chain([[28, 39], [28, 49]]),
  ...double([28, 49], [18, 57], 'ik'), C(18, 57, 4, CPK.O),
  S('M28 49 L39 56', 'ik', 2), C(39, 56, 4, CPK.O),
  C(48, 8, 1.6, 'gh'), C(52, 14, 1.6, 'gh'), C(45, 4, 1.6, 'gh'),
]);
def('gaba', () => [                                                // not an amino acid — no alpha carbon, no ring
  S('M10 40 L20 30 L30 40 L40 30 L50 40', 'ik', 2.4),
  C(10, 40, 4.6, CPK.N),
  ...double([50, 40], [58, 34], 'ik'), C(58, 34, 4, CPK.O),
  S('M50 40 L58 46', 'ik', 2), C(58, 46, 4, CPK.O),
]);
def('noradrenaline', () => [                                      // dopamine plus one oxygen, on the tail carbon
  hex('ik', 24, 34, 9, 2),
  S('M17 28 L10 22', 'ik', 1.8), C(10, 22, 3.6, CPK.O),
  S('M27 27 L28 17', 'ik', 1.8), C(28, 17, 3.6, CPK.O),
  S('M33 37 L44 40', 'ik', 2), C(44, 40, 3.6, CPK.O),
  S('M44 40 L54 34', 'ik', 2), C(54, 34, 4.4, CPK.N),
]);

/* brain regions — each drawn on its own real silhouette, not one outline recoloured */
def('white_matter', () => [                                       // long-range fibre tracts, running the full length
  ...[14, 22, 30, 38, 46].map(x => S(`M${x} 6 L${x} 54`, 'bs', 3)),
]);
def('gray_matter', () => [                                        // densely packed cell bodies, not fibres
  ...Array.from({ length: 20 }, (_, i) => C(8 + (i % 5) * 11, 8 + Math.floor(i / 5) * 11, 2.2, i % 3 ? 'bs' : 'hi')),
]);
def('cerebral_cortex', () => [                                    // the folded sheet, six layers, in section
  S('M6 34 Q30 6 54 34', 'bs', 9),
  ...[16, 26, 36, 46].map(x => S(`M${x} 29 L${x} 39`, 'ik', 1)),
]);
def('spinal_cord', () => [                                        // a long cord, cut open at the top
  S('M30 8 L28 56', 'bs', 6),
  C(30, 8, 8, 'hi'),
  E(25, 6, 3, 2, 'lo'), E(35, 10, 3, 2, 'lo'),
]);
def('brainstem', () => [                                          // the stalk alone, midbrain/pons/medulla
  P('M22 8 L38 8 L34 52 L26 52 Z', 'bs'),
  S('M22 22 L38 22', 'ik', 1.6), S('M24 36 L36 36', 'ik', 1.6),
]);
def('thalamus', () => [                                           // paired relay nuclei, spoked out to the cortex
  E(24, 30, 8, 10, 'bs'), E(38, 30, 8, 10, 'bs'),
  ...[[10, 30], [52, 30], [31, 12], [31, 48]].map(([x, y]) => S(`M31 30 L${x} ${y}`, 'gh', 1.4)),
]);
def('hypothalamus', () => [                                       // a small cluster of nuclei, stalked to the gland below
  ...[[22, 26], [32, 22], [26, 34], [36, 30]].map(([x, y]) => C(x, y, 4.5, 'bs')),
  S('M30 36 L30 48', 'lo', 2.2), C(30, 52, 3.4, 'hi'),
]);
def('pituitary_gland', () => [                                    // pea-sized, two lobes, hanging on its own stalk
  S('M30 6 L30 24', 'ik', 2),
  E(25, 30, 6, 8, 'bs'), E(35, 30, 6, 8, 'hi'),
]);
def('hippocampus', () => [                                        // seahorse-shaped, curled — the whole point
  S('M42 12 Q48 12 48 20 Q48 28 40 28 Q32 28 32 36 Q32 44 40 44 Q46 44 46 38', 'bs', 6),
  C(44, 14, 2, 'ik'),
  S('M32 36 Q28 40 30 46', 'lo', 3),
]);
def('amygdala', () => [                                           // an almond, paired, one on each side
  ['g', -25, 24, 30, [E(24, 30, 10, 6, 'bs')]],
  ['g', 25, 40, 32, [E(40, 32, 8, 5, 'hi')]],
]);
def('corpus_callosum', () => [                                    // the band that joins the two hemispheres
  S('M12 26 Q30 8 48 26', 'bs', 6),
  E(12, 32, 8, 12, 'gh'), E(48, 32, 8, 12, 'gh'),
]);
def('cerebrum', () => [                                           // two hemispheres, seen from above, split down the middle
  E(19, 30, 14, 19, 'bs'), E(41, 30, 14, 19, 'bs'),
  S('M30 10 L30 50', 'ik', 2),
  S('M12 22 Q19 18 26 22', 'gh', 1.4), S('M34 22 Q41 18 48 22', 'gh', 1.4),
]);
def('cerebellum', () => [                                         // the "little brain" — tight, dense folding
  E(30, 32, 19, 13, 'bs'),
  ...[-13, -6.5, 0, 6.5, 13].map(dx => S(`M${30 + dx} 22 Q${30 + dx} 32 ${30 + dx} 42`, 'ik', 1.6)),
]);
def('hindbrain', () => [                                          // cerebellum plus brainstem, the oldest part
  E(36, 22, 13, 10, 'bs'),
  ...[-8, -2, 4, 10].map(dx => S(`M${36 + dx} 15 Q${36 + dx} 22 ${36 + dx} 29`, 'ik', 1.4)),
  P('M24 30 L34 30 L30 56 L26 56 Z', 'lo'),
]);
def('brain', () => [                                              // the whole organ, folded, in profile
  P('M10 30 Q8 14 26 8 Q42 3 50 16 Q56 26 48 34 Q52 42 40 42 Q38 50 30 50 Q26 50 24 44 Q14 44 10 36 Q6 34 10 30 Z', 'bs'),
  S('M16 20 Q22 16 28 20', 'ik', 1.6), S('M30 12 Q36 14 40 20', 'ik', 1.6),
  S('M18 32 Q26 30 32 34', 'ik', 1.6), S('M36 28 Q44 28 46 24', 'ik', 1.6),
]);
def('frontal_lobe', () => [                                       // the front quarter — the motor strip along its back edge
  P('M8 20 Q8 8 22 8 Q34 8 34 22 Q34 34 22 34 Q8 34 8 20 Z', 'bs'),
  S('M14 12 L14 30', 'ik', 1.6), S('M20 10 L20 32', 'ik', 1.6), S('M26 10 L26 32', 'ik', 1.6),
]);
def('parietal_lobe', () => [                                      // top and back — where senses converge
  P('M14 30 Q14 10 34 8 Q50 8 50 24 Q50 34 34 34 Q20 36 14 30 Z', 'bs'),
  S('M32 22 L24 16', 'gh', 1.4), S('M32 22 L36 14', 'gh', 1.4), S('M32 22 L42 24', 'gh', 1.4), S('M32 22 L30 30', 'gh', 1.4),
]);
def('temporal_lobe', () => [                                      // low on the side — sound in, the amygdala tucked at its edge
  E(28, 34, 20, 9, 'bs'),
  S('M14 34 Q10 30 12 26 Q16 24 18 28', 'ik', 1.6),
  C(44, 30, 3, 'lo'),
]);
def('occipital_lobe', () => [                                     // rearmost — the optic radiation fans into it
  P('M30 10 Q46 10 50 26 Q52 38 40 42 Q28 44 24 32 Q22 18 30 10 Z', 'bs'),
  ...[0, 1, 2, 3].map(i => S(`M50 ${16 + i * 7} L${34 + i * 2} ${20 + i * 6}`, 'gh', 1.4)),
]);

/* three more animals, each on its one real tell ─────────────────────────── */
def('swan', () => [                                                // the long S-curved neck, the heaviest flying bird
  E(24, 42, 15, 8, 'hi'),
  S('M30 38 Q40 20 34 8 Q30 4 26 8', 'hi', 4),
  P('M24 6 L16 6 L24 10 Z', 'fire-bs'),
  wave('water-bs', 50, 3, 22),
]);
def('conch', () => {                                              // a true logarithmic spiral, plus the flared lip
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, ang = t * Math.PI * 3.4, rad = 2 + t * 20;
    pts.push([n(26 + rad * Math.cos(ang)), n(30 + rad * Math.sin(ang))]);
  }
  return [
    S('M' + pts.map(p => p.join(' ')).join(' L'), 'bs', 3.4),
    P('M40 30 Q54 26 52 40 Q48 50 36 44 Z', 'hi'),
  ];
});
def('mouse', () => [                                               // small, round-eared, whiskered, long-tailed
  E(28, 34, 14, 10, 'bs'),
  C(16, 26, 2.6, 'lo'), C(22, 22, 2.6, 'lo'),
  E(13, 34, 3, 2.4, 'lo'),
  S('M40 36 Q52 40 56 32', 'lo', 1.6),
  S('M10 32 L4 30', 'gh', 1), S('M10 35 L3 35', 'gh', 1), S('M10 38 L4 40', 'gh', 1),
]);
def('monkey', () => [                                              // round ears close to the head, a curling grip-tail
  C(28, 26, 11, 'bs'),
  C(18, 20, 5, 'lo'), C(38, 20, 5, 'lo'),
  E(28, 30, 5, 4, 'hi'),
  S('M38 34 Q54 30 56 44 Q56 54 46 52', 'bs', 3.4),
]);


/* mythology & craft batch — Egyptian, Norse and Shinto pantheons, plus the
 * tools and instruments unlocked alongside them. `myth`-tagged deities land
 * in `craft` (see TAG_CATEGORY above), so the fallback here was the same grey
 * two-box tin for a jackal god as for a whetstone. Each one gets its actual
 * identifying attribute instead — a head, a weapon, an animal, an object —
 * the thing that would let you name it on a temple wall or a rune stone. ── */

/* Egyptian pantheon ──────────────────────────────────────────────────────── */
def('anubis', () => [                                           // jackal head: long snout, tall pricked ears
  P('M16 32 L44 32 L47 50 L13 50 Z', 'lo'),
  P('M21 32 Q19 16 30 15 Q37 16 38 24 L30 32 Z', 'bs'),
  P('M22 18 L17 6 L26 15 Z', 'hi'), P('M35 15 L39 5 L38 17 Z', 'hi'),
  C(33, 21, 1, 'ik'),
]);
def('thoth', () => [                                             // ibis head: long down-curved beak, a reed pen
  P('M17 32 L43 32 L46 50 L14 50 Z', 'lo'),
  C(29, 20, 8, 'bs'),
  S('M35 18 Q46 22 46 30 Q46 34 42 32', 'ik', 2.6),
  S('M14 44 L22 40', 'hi', 2),
]);
def('bastet', () => [                                             // cat head: triangular ears, fine whiskers
  P('M18 34 L42 34 L45 50 L15 50 Z', 'lo'),
  C(30, 20, 8, 'bs'),
  P('M23 15 L18 6 L27 14 Z', 'hi'), P('M37 15 L42 6 L33 14 Z', 'hi'),
  S('M20 22 L10 20 M20 25 L10 26', 'ik', 1), S('M40 22 L50 20 M40 25 L50 26', 'ik', 1),
]);
def('sobek', () => [                                              // crocodile head: elongated toothed snout
  P('M16 36 L44 36 L46 50 L14 50 Z', 'lo'),
  P('M14 26 L48 26 L46 34 L16 34 Z', 'bs'),
  zig('ik', 26, 2.4, 8),
  C(18, 22, 1.2, 'hi'), C(42, 22, 1.2, 'hi'),
]);
def('hathor', () => [                                             // cow head, horns cradling the sun disk
  P('M17 34 L43 34 L46 50 L14 50 Z', 'lo'),
  C(30, 21, 8, 'bs'),
  S('M22 16 Q16 8 20 2', 'hi', 2.4), S('M38 16 Q44 8 40 2', 'hi', 2.4),
  C(30, 6, 3.2, 'hi'),
]);
def('sekhmet', () => [                                            // lioness head, ruff of mane, fierce
  P('M16 34 L44 34 L47 50 L13 50 Z', 'lo'),
  C(30, 20, 10, 'bs'),
  ...[-1, -.6, -.2, .2, .6, 1].map(s => S(`M${n(30 + s * 11)} ${n(11 + Math.abs(s) * 3)} L${n(30 + s * 15)} ${n(4 + Math.abs(s) * 3)}`, 'lo', 1.6)),
  P('M24 14 L20 6 L28 12 Z', 'hi'), P('M36 14 L40 6 L32 12 Z', 'hi'),
]);
def('nephthys', () => [                                           // house-and-basket headdress, wings spread
  P('M18 34 L42 34 L45 50 L15 50 Z', 'lo'),
  C(30, 20, 7, 'bs'),
  P('M25 12 L35 12 L35 8 L28 8 L28 5 L32 5 L32 8 L37 8 L37 14 L23 14 Z', 'hi'),
  leaf('gh', 14, 32, .8, -70), leaf('gh', 46, 32, .8, 70),
]);
def('nut', () => [                                                // sky goddess, arched, stars along her body
  S('M8 46 Q30 4 52 46', 'bs', 3.4),
  ...[16, 24, 30, 36, 44].map((x, i) => C(x, n(46 - Math.sin((x - 8) / 44 * Math.PI) * 40), 1.3, 'hi')),
  C(8, 46, 1.8, 'lo'), C(52, 46, 1.8, 'lo'),
]);
def('geb', () => [                                                // earth god reclining, a goose on his brow
  E(30, 42, 22, 8, 'lo'),
  P('M20 34 Q16 26 22 22 Q28 20 27 28 Q30 32 24 34 Z', 'bs'),
  P('M20 24 L13 20 L20 20 Z', 'hi'),
  horizon('gh', 50),
]);
def('shu', () => [                                                // air god, arms raised to hold the sky apart
  P('M24 50 L36 50 L34 34 L26 34 Z', 'lo'),
  C(30, 26, 6, 'bs'),
  S('M25 30 Q14 26 10 16 M35 30 Q46 26 50 16', 'hi', 2.6),
  S('M8 16 L52 16', 'gh', 2),
]);
def('khnum', () => [                                              // ram head, horns curling out at the ears
  P('M18 34 L42 34 L45 50 L15 50 Z', 'lo'),
  C(30, 21, 7, 'bs'),
  ...coilOf('hi', 3, 6, 21, 3.4), ...coilOf('hi', 3, 44, 21, -3.4),
  E(30, 46, 8, 3, 'gh'),
]);
def('ptah', () => [                                               // mummiform, tight-wrapped, the was-sceptre
  P('M22 12 L38 12 L38 50 L22 50 Z', 'lo'),
  C(30, 16, 6, 'bs'),
  S('M46 10 L46 46', 'hi', 2.4), S('M42 10 L50 10', 'ik', 2), S('M42 46 L46 52 M50 46 L46 52', 'ik', 2),
]);
def('amun', () => [                                               // the tall double-plumed crown
  P('M18 34 L42 34 L45 50 L15 50 Z', 'lo'),
  C(30, 26, 7, 'bs'),
  P('M24 20 L22 2 L27 20 Z', 'hi'), P('M36 20 L38 2 L33 20 Z', 'hi'),
  S('M22 20 L38 20', 'ik', 2),
]);
def('maat', () => [                                               // the balance: a heart weighed against her feather
  P('M30 14 L20 40 L40 40 Z', 'lo'),
  S('M14 24 L46 24', 'ik', 1.8),
  E(14, 30, 6, 4, 'bs'), E(46, 30, 6, 4, 'hi'),
  P('M46 22 L48 16 L50 22 L47 30 Z', 'gh'),
]);
def('khonsu', () => [                                             // youth god, crescent cradling the full moon
  P('M20 34 L40 34 L43 50 L17 50 Z', 'lo'),
  C(30, 22, 7, 'bs'),
  P('M20 10 A10 10 0 1 0 40 10 A8 8 0 1 1 20 10 Z', 'hi'),
  C(30, 10, 3.4, 'gh'),
  S('M37 26 Q40 34 37 40', 'ik', 1.4),
]);
def('taweret', () => [                                            // hippo goddess, upright, heavy with belly
  E(30, 32, 15, 18, 'bs'),
  C(30, 14, 8, 'lo'),
  P('M24 8 L22 2 L27 8 Z', 'hi'), P('M36 8 L38 2 L33 8 Z', 'hi'),
  S('M40 20 Q46 30 40 46', 'gh', 2.4),
]);
def('serket', () => [                                             // the scorpion, tail arced to strike
  E(26, 36, 10, 6, 'bs'),
  S('M32 34 Q46 30 46 16 Q46 8 38 10', 'lo', 2.4),
  P('M38 10 L34 6 L34 13 Z', 'ik'),
  P('M18 32 L10 28 L14 34 Z', 'hi'), P('M18 40 L10 42 L14 36 Z', 'hi'),
]);
def('wadjet', () => [                                             // the uraeus: cobra reared and hooded
  S('M30 52 Q26 34 30 24', 'bs', 3.4),
  P('M18 24 Q30 8 42 24 Q34 20 30 20 Q26 20 18 24 Z', 'hi'),
  C(30, 21, 1.6, 'ik'),
]);
def('apep', () => [                                               // the world-encircler, coiled the width of the field
  zig('lo', 30, 9, 10),
  P('M4 30 L11 24 L11 36 Z', 'ik'),
  S('M4 30 L-2 26 M4 30 L-2 34', 'hi', 1.4),
]);

/* Norse pantheon and its tools ───────────────────────────────────────────── */
def('spear', () => [
  S('M18 50 L44 12', 'lo', 3.4),
  P('M40 8 L48 16 L42 24 L36 18 Z', 'hi'),
  S('M23 43 L29 39', 'ik', 2),
]);
def('hammer', () => [                                             // the oldest kind: a stone lashed to a haft
  S('M30 50 L30 20', 'lo', 4),
  E(30, 16, 10, 7, 'bs'),
  S('M22 20 L38 20', 'ik', 2),
]);
def('rune', () => [                                               // carved stave — no horizontals, or the grain splits
  P('M22 8 L38 8 L38 52 L22 52 Z', 'lo'),
  S('M27 14 L27 46 M27 20 L34 14 M27 30 L34 36', 'ik', 2.4),
]);
def('odin', () => [                                               // one eye, a wide hat, a raven at the shoulder
  P('M16 32 L44 32 L47 50 L13 50 Z', 'lo'),
  C(30, 19, 8, 'bs'),
  P('M19 15 Q30 4 41 15 L37 17 Q30 10 23 17 Z', 'hi'),
  C(27, 20, 1.6, 'ik'),
  P('M40 17 L49 12 L46 21 L40 21 Z', 'ik'),
]);
def('thor', () => [                                               // Mjolnir: short haft, blocky rune-marked head
  S('M30 46 L30 30', 'lo', 5),
  P('M18 14 L42 14 L42 30 L18 30 Z', 'bs'),
  S('M24 18 L24 26 M30 17 L30 27 M36 18 L36 26', 'ik', 1.6),
]);
def('loki', () => [                                               // shapeshifter: a coil, serpent thinning to flame
  S('M14 46 Q24 46 24 34 Q24 22 36 22 Q46 22 46 12', 'lo', 3.4),
  flame('bs', .55, -10),
  S('M40 14 Q43 15 45 13', 'ik', 1.6),
]);
def('freyja', () => [                                             // Brisingamen, the necklace
  ring('lo', 30, 26, 14, 3),
  ...[0, 51, 102, 153, 204, 255, 306].map(a => C(n(30 + 14 * Math.cos(a * Math.PI / 180)), n(26 + 14 * Math.sin(a * Math.PI / 180)), 2, 'hi')),
  C(30, 40, 3.2, 'bs'),
]);
def('frigg', () => [                                              // her distaff, and the three stars of her belt
  S('M30 52 L30 14', 'lo', 3),
  P('M22 10 Q30 4 38 10 L34 16 Q30 12 26 16 Z', 'bs'),
  S('M22 26 Q30 30 38 26 M22 34 Q30 38 38 34', 'hi', 1.6),
  ...[24, 30, 36].map(x => C(x, 50, 1.2, 'gh')),
]);
def('baldr', () => [                                              // radiant, and the mistletoe no one thought to ask
  C(30, 24, 8, 'bs'),
  ...[0, 45, 90, 135, 180, 225, 270, 315].map(a => S(`M${n(30 + 12 * Math.cos(a * Math.PI / 180))} ${n(24 + 12 * Math.sin(a * Math.PI / 180))} L${n(30 + 18 * Math.cos(a * Math.PI / 180))} ${n(24 + 18 * Math.sin(a * Math.PI / 180))}`, 'hi', 1.6)),
  leaf('lo', 24, 46, .5, -30), leaf('lo', 36, 46, .5, 30), C(30, 48, 1.6, 'gh'),
]);
def('heimdall', () => [                                           // Gjallarhorn, banded, ready to sound
  P('M16 44 Q16 20 42 14 Q40 20 34 24 Q22 30 20 44 Z', 'bs'),
  S('M18 44 L18 50', 'lo', 3),
  ring('hi', 28, 22, 6, 1.6),
]);
def('tyr', () => [                                                // the wrist, and the wolf's jaws closing on it
  S('M18 48 L18 22', 'lo', 4),
  P('M10 14 L26 14 L24 24 L20 30 L16 24 Z', 'hi'),
  S('M12 16 L15 20 M24 16 L21 20', 'ik', 1.4),
]);
def('njord', () => [                                              // a longship, mast up, riding the swell
  wave('lo', 40, 4, 22),
  P('M12 34 Q30 44 48 34 L44 30 Q30 36 16 30 Z', 'bs'),
  S('M30 30 L30 12 M30 16 L40 20', 'hi', 2),
]);
def('skadi', () => [                                              // two long skis, upturned, over the snow
  mound('gh', 48, 20, 10),
  P('M16 50 L16 16 Q16 10 22 12 L22 50 Z', 'bs'),
  P('M28 50 L28 16 Q28 10 34 12 L34 50 Z', 'bs'),
]);
def('sif', () => [                                                // her golden hair, cut and regrown, two long braids
  C(30, 20, 9, 'lo'),
  S('M22 16 Q14 24 20 34 Q14 42 22 50', 'bs', 3),
  S('M38 16 Q46 24 40 34 Q46 42 38 50', 'bs', 3),
  S('M22 16 Q14 24 20 34 Q14 42 22 50', 'hi', 1),
]);
def('bragi', () => [                                              // a bard's harp, fanned strings
  P('M16 50 Q14 20 30 10 L34 14 Q22 22 24 50 Z', 'lo'),
  ...[0, 1, 2, 3].map(i => S(`M${20 + i * 4.5} ${48 - i * 2} L${17 + i * 5} ${16 + i * 8}`, 'hi', 1)),
]);
def('idun', () => [                                               // a bowl of the apples that keep the gods young
  round('lo', 40, 20, 9),
  ...[[22, 32], [30, 28], [38, 32]].map(([x, y]) => C(x, y, 5, 'bs')),
  ...[[22, 28], [30, 24], [38, 28]].map(([x, y]) => S(`M${x} ${y} L${x} ${y - 4}`, 'hi', 1.4)),
]);
def('hel', () => [                                                // half flesh, half corpse — split down the seam
  P('M20 32 L40 32 L38 50 L22 50 Z', 'lo'),
  P('M30 12 A10 10 0 0 1 30 32 Z', 'bs'),
  P('M30 12 A10 10 0 0 0 30 32 Z', 'gh'),
  S('M30 12 L30 32', 'ik', 1.2),
  S('M24 18 L27 20 M25 26 L28 27', 'ik', 1),
]);
def('vidar', () => [                                              // the huge silent shoe, made to kill a wolf
  P('M18 50 L18 22 Q18 16 26 16 L34 16 L34 40 L44 40 L44 50 Z', 'bs'),
  S('M18 40 L34 40', 'hi', 1.6),
]);
def('freyr', () => [                                              // Gullinbursti, the golden-bristled boar
  E(28, 34, 18, 11, 'bs'),
  P('M44 30 L54 26 L50 36 Z', 'hi'),
  ...[16, 22, 28, 34].map(x => S(`M${x} 24 L${x - 2} 16`, 'lo', 1.6)),
  C(48, 30, 1.2, 'ik'),
]);

/* between the pantheons: a molecule and two instruments ─────────────────── */
def('nitrogen_gas', () => [                                       // N≡N, a triple bond almost nothing can break
  S('M22 27 L38 27 M22 30 L38 30 M22 33 L38 33', 'ik', 1.8),
  C(18, 30, 8, CPK.N), C(42, 30, 8, CPK.N),
]);
def('bow', () => [
  S('M20 10 Q34 30 20 50', 'lo', 3),
  S('M20 10 L20 50', 'hi', 1.4),
  S('M20 30 L46 30', 'ik', 1.8),
  P('M46 30 L40 27 L40 33 Z', 'ik'),
]);
def('taiko', () => [                                              // cowhide heads laced over a wooden shell
  E(30, 30, 15, 12, 'bs'),
  ring('hi', 30, 22, 14, 2), ring('hi', 30, 38, 14, 2),
  S('M18 12 L26 20 M42 12 L34 20', 'ik', 2),
]);

/* Shinto pantheon ────────────────────────────────────────────────────────── */
def('izanagi', () => [                                            // the jeweled spear, stirring the sea into islands
  S('M44 10 L20 44', 'lo', 3),
  C(46, 8, 3, 'hi'),
  S('M14 48 Q22 42 20 48 Q18 54 26 50', 'bs', 2.4),
  C(24, 52, 2, 'gh'),
]);
def('izanami', () => [                                            // the cracked rock sealing Yomi's passage
  P('M14 50 L14 16 Q30 6 46 16 L46 50 Z', 'lo'),
  S('M20 50 L24 20 M30 50 L28 14 M40 50 L38 22', 'ik', 1.2),
  P('M24 50 L36 50 L34 40 L26 40 Z', 'gh'),
]);
def('amaterasu', () => [                                          // the sacred mirror, radiant
  C(30, 26, 14, 'bs'), C(30, 26, 10, 'hi'),
  S('M30 40 L30 52', 'lo', 3),
  ...[0, 60, 120, 180, 240, 300].map(a => S(`M${n(30 + 15 * Math.cos(a * Math.PI / 180))} ${n(26 + 15 * Math.sin(a * Math.PI / 180))} L${n(30 + 21 * Math.cos(a * Math.PI / 180))} ${n(26 + 21 * Math.sin(a * Math.PI / 180))}`, 'gh', 1.4)),
]);
def('susanoo', () => [                                            // the sword, driven through the eight-headed serpent
  ...[0, 1, 2, 3].map(i => E(14 + i * 11, 30 + (i % 2 ? -4 : 4), 7, 5, 'lo')),
  S('M46 10 L14 44', 'bs', 3.4),
  P('M46 10 L50 6 L44 8 Z', 'hi'),
]);
def('tsukuyomi', () => [                                          // a cold, unadorned crescent, far stars
  P('M36 12 A18 18 0 1 0 36 48 A14 14 0 1 1 36 12 Z', 'bs'),
  C(16, 20, 1, 'gh'), C(20, 40, 1, 'gh'), C(12, 32, 1, 'gh'),
]);
def('kagutsuchi', () => [                                         // fire, and the blade that dismembered him
  flame('bs'),
  S('M46 10 L14 46', 'ik', 2.4),
  C(20, 20, 1.3, 'hi'), C(38, 16, 1.3, 'hi'), C(16, 38, 1.3, 'hi'),
]);
def('inari', () => [                                              // the fox messenger, and a sheaf of rice
  P('M18 40 Q16 24 30 20 Q44 24 42 40 Q36 48 30 44 Q24 48 18 40 Z', 'bs'),
  P('M20 22 L14 8 L24 20 Z', 'hi'), P('M40 22 L46 8 L36 20 Z', 'hi'),
  S('M30 44 L30 54 M26 50 L34 50', 'grain-bs', 2),
]);
def('ryujin', () => [                                             // the dragon king, coral branching below
  S('M12 40 Q20 24 34 28 Q44 30 48 18', 'bs', 4),
  P('M46 12 Q52 12 50 20 L44 20 Q42 14 46 12 Z', 'lo'),
  ...[[16, 48], [26, 50], [36, 48]].map(([x, y]) => S(`M${x} ${y} L${x} ${y - 8}`, 'hi', 2)),
]);
def('fujin', () => [                                              // the great bag of winds, carried on the shoulders
  E(28, 30, 16, 13, 'bs'),
  S('M14 24 L8 24 M14 30 L6 30 M14 36 L8 36', 'hi', 2),
  S('M44 26 Q50 30 44 34', 'lo', 2.4),
]);
def('raijin', () => [                                             // the ring of drums, and thunder at the centre
  ...[0, 60, 120, 180, 240, 300].map(a => C(n(30 + 16 * Math.cos(a * Math.PI / 180)), n(30 + 16 * Math.sin(a * Math.PI / 180)), 5, 'lo')),
  bolt('bs', 30, 20, .8),
]);
def('hachiman', () => [                                           // two arrows crossed, war and archery
  S('M14 14 L46 46', 'lo', 2.4), S('M46 14 L14 46', 'lo', 2.4),
  P('M46 46 L40 44 L44 40 Z', 'ik'), P('M14 46 L20 44 L16 40 Z', 'ik'),
  C(30, 30, 2, 'bs'),
]);
def('tenjin', () => [                                             // a plum blossom, and the scholar's brush
  ...[0, 72, 144, 216, 288].map(a => E(n(30 + 7 * Math.cos(a * Math.PI / 180)), n(22 + 7 * Math.sin(a * Math.PI / 180)), 5, 4, 'bs')),
  C(30, 22, 2.4, 'hi'),
  S('M18 46 L26 38', 'lo', 2.6), P('M26 38 L30 34 L28 40 Z', 'ik'),
]);
def('uke_mochi', () => [                                          // rice grown from her body, a cocoon at her brow
  mound('lo', 48, 20, 12),
  ...[22, 30, 38].map(x => S(`M${x} 48 Q${x - 2} 34 ${x} 22`, 'grain-bs', 2)),
  E(42, 40, 4, 6, 'hi'),
]);
def('mikaboshi', () => [                                          // the one star that refused to submit
  P('M30 8 L34 24 L48 24 L37 33 L41 48 L30 39 L19 48 L23 33 L12 24 L26 24 Z', 'lo'),
  S('M30 8 L34 24 L48 24 L37 33 L41 48 L30 39 L19 48 L23 33 L12 24 L26 24 Z', 'ik', 1),
  P('M30 8 L27 0 L33 5 Z', 'hi'),
]);
def('ame_no_iwato', () => [                                       // the rock cave, sealed, one sliver of light
  P('M10 50 L10 24 Q30 6 50 24 L50 50 Z', 'lo'),
  P('M22 50 L22 30 Q30 22 38 30 L38 50 Z', 'gh'),
  S('M24 30 L20 26', 'hi', 1.6),
]);
def('ame_no_uzume', () => [                                       // mid-dance, arms flung, a trailing ribbon
  C(30, 16, 6, 'lo'),
  S('M30 22 L30 38', 'bs', 3),
  S('M30 24 Q18 18 12 24 M30 24 Q42 18 46 22', 'hi', 2.4),
  S('M30 38 Q22 46 14 44 M30 38 Q40 44 44 52', 'hi', 2.4),
  S('M40 20 Q48 26 42 34 Q36 40 44 44', 'gh', 1.6),
]);
def('sarutahiko', () => [                                         // the seven-span nose, eyes like mirrors
  E(28, 26, 13, 15, 'bs'),
  P('M40 28 Q56 28 52 32 Q48 34 40 32 Z', 'hi'),
  C(23, 22, 2.2, 'ik'), C(33, 22, 2.2, 'ik'),
]);

/* two more crafted things ────────────────────────────────────────────────── */
def('helmet', () => [                                             // bronze dome and boar's-tusk plates
  P('M16 34 Q16 12 30 10 Q44 12 44 34 L40 34 Q40 18 30 16 Q20 18 20 34 Z', 'bs'),
  S('M30 6 L30 12', 'lo', 3),
  ...[[18, 30], [22, 26], [26, 23], [34, 23], [38, 26], [42, 30]].map(([x, y]) => C(x, y, 1, 'hi')),
]);
def('lyre', () => [                                                // tortoise-shell soundbox, two curving arms
  E(30, 44, 12, 8, 'lo'),
  S('M20 44 Q14 20 22 12 M40 44 Q46 20 38 12', 'bs', 3),
  S('M22 12 L38 12', 'hi', 2.4),
  ...[0, 1, 2, 3, 4].map(i => S(`M${20 + i * 5} 42 L${23 + i * 3.4} 13`, 'ik', 1)),
]);


/* living — parasites, protozoa, ecology terms, fungi and apex predators
   (batch 3) ───────────────────────────────────────────────────────────────
   A genuinely mixed set: ten fungi that each fruit differently (a cap
   with an annulus and volva, a phallic stalk, a nest of eggs, upright black
   clubs), nine parasitic worms distinguished by the one feature that is
   actually theirs (a hooked head, a tight muscle coil, a fine long thread,
   a segmented ribbon with or without hooks), six protozoa drawn at the
   scale a microscope would show them (a signet ring in a blood cell, a
   pear-shaped face with two nuclei, a shapeless pseudopod), the diseases
   they cause drawn as the damage rather than the organism again, four
   ectoparasites caught in the act of living where they live (a hair shaft,
   a fabric seam, a burrow, a mattress seam), and fourteen ecology terms —
   the hardest set here, because they are relationships and structures, not
   things. Each gets one honest, literal diagram: a keystone species is an
   actual architectural keystone holding an arch up; a food chain is linked
   rings; a food web is a tangled mesh of the same rings; commensalism is a
   small rider on an unaffected host; parasitism is something latched on and
   draining what it is attached to. */

/* fungi ──────────────────────────────────────────────────────────────── */
def('death_cap', () => [
  P('M10 24 Q10 8 30 8 Q50 8 50 24 Z', 'bs'),                    // pale, broad dome cap
  P('M25 24 L35 24 L34 52 L26 52 Z', 'hi'),                      // the stem
  E(30, 33, 6.5, 2, 'lo'),                                       // the ring (annulus) partway down it
  P('M22 48 Q20 56 30 56 Q40 56 38 48 L34 48 L26 48 Z', 'lo'),   // the volva — a cup at the base, the giveaway
]);
def('bioluminescent_fungus', () => [
  P('M12 32 Q12 20 24 18 Q30 26 26 36 Q18 38 12 32 Z', 'bs'),    // a small shelf cap
  P('M28 26 Q28 14 42 15 Q48 23 44 32 Q34 34 28 26 Z', 'hi'),    // a second, brighter cap
  ...[16, 20, 24].map(x => S(`M${x} 34 L${x} 38`, 'gh', 1)),     // its glowing gill edges
  C(38, 22, 1.6, 'gh'), C(42, 26, 1.2, 'gh'),                    // light drifting off it in the dark
]);
def('stinkhorn', () => [
  P('M25 54 L25 22 L35 22 L35 54 Z', 'hi'),                      // the tall hollow stalk
  P('M22 22 Q30 6 38 22 Q34 28 30 28 Q26 28 22 22 Z', 'lo'),     // the slimy cap, reeking of carrion
  ...[[16, 15], [45, 13], [40, 26]].map(([x, y]) => C(x, y, 1.6, 'bs')), // flies, drawn to it
]);
def('turkey_tail', () => [
  S('M6 50 L54 50', 'lo', 4),                                    // the dead log
  ...[22, 15, 8].map((rad, i) => P(`M${30 - rad} 50 A${rad} ${rad} 0 0 1 ${30 + rad} 50 Z`, i % 2 ? 'hi' : 'bs')), // banded fan, ring inside ring
]);
def('slime_mold', () => [
  S('M10 40 L20 22 L30 36 L40 18 L50 32', 'bs', 3),              // its branching search, mapping the shortest path
  S('M20 22 L25 46 M40 18 L35 48', 'hi', 1.6),
  ...[[20, 22], [30, 36], [40, 18]].map(([x, y]) => C(x, y, 2, 'lo')), // nodes it has already found
]);
def('birds_nest_fungus', () => [
  P('M14 40 Q14 24 30 24 Q46 24 46 40 Q46 48 30 48 Q14 48 14 40 Z', 'lo'), // the cup
  ...[[22, 37], [30, 33], [38, 38]].map(([x, y]) => C(x, y, 5, 'bs')),     // egg-like spore packets inside it
  S('M6 12 Q14 20 20 28', 'hi', 1.6),                            // a raindrop, about to fling one clear
]);
def('zombie_ant_fungus', () => [
  S('M8 44 L52 44', 'hi', 1.6),                                  // the leaf vein it's been driven to clamp onto
  E(20, 44, 5, 3, 'ik'), E(28, 42, 6, 4, 'ik'), E(37, 40, 5, 3.2, 'ik'),   // the ant's three body segments
  ...[[16, 44], [24, 47], [34, 44], [41, 41]].map(([x, y]) => S(`M${x} ${y} L${x - 2} ${y + 6}`, 'ik', 1.2)),
  S('M28 42 L28 18', 'bs', 3),                                   // the stalk erupting from its skull
  C(28, 14, 4, 'bs'),                                            // the fruiting body
]);
def('humongous_fungus', () => [
  horizon('lo', 50),                                             // the ground — this thing is mostly underground
  ...dendrite('gh', 4),                                          // one vast, unseen network, spanning acres
  P('M22 14 Q22 6 30 6 Q38 6 38 14 Z', 'bs'),                    // one small cap: all anyone actually sees of it
]);
def('dead_mans_fingers', () => [
  horizon('lo', 50),
  ...[[16, 8], [25, 2], [34, 6], [43, 12]].map(([x, top]) =>
    P(`M${x - 3} 50 L${x - 3} ${top + 8} Q${x} ${top} ${x + 3} ${top + 8} L${x + 3} 50 Z`, 'ik')), // black upright clubs, pushing through
]);
def('witchs_butter', () => [
  S('M8 48 L52 48', 'lo', 4),                                    // the dead wood it grows on
  P('M16 44 Q9 33 19 27 Q17 17 29 20 Q39 12 42 24 Q52 30 44 40 Q46 48 34 46 Q22 51 16 44 Z', 'bs'), // gelatinous, lobed
  E(24, 30, 5, 4, 'hi'), E(35, 26, 4, 3, 'hi'),                  // its wet sheen
]);

/* parasitic worms ────────────────────────────────────────────────────── */
def('ascaris_lumbricoides', () => [
  S('M10 20 Q20 40 30 22 Q40 4 50 40', 'bs', 5),                 // one long, smooth, tapering roundworm
  C(10, 20, 1.6, 'ik'), C(50, 40, 1.6, 'ik'),                    // pointed at both ends
]);
def('hookworm', () => [
  S('M14 46 Q12 30 24 27 Q33 25 29 17 Q26 11 19 14', 'bs', 5),   // the body, curling into
  C(19, 14, 2.2, 'ik'),                                          // its hooked head, gripping the gut wall
]);
def('enterobius_vermicularis', () => [
  S('M12 30 Q28 16 28 30 Q28 44 44 30', 'bs', 3),                // a small, thin body
  S('M44 30 L54 23', 'ik', 1.6),                                 // its long pointed tail — the whole point of the name
]);
def('trichinella_spiralis', () => [
  E(30, 32, 17, 14, 'gh'),                                       // the muscle cyst walled around it
  S('M30 32 Q40 32 40 24 Q40 16 30 16 Q22 16 22 24 Q22 30 28 30 Q33 30 33 27', 'bs', 2.2), // coiled tight inside
]);
def('wuchereria_bancrofti', () => [
  S('M6 16 Q17 28 10 40 Q3 50 16 55', 'bs', 1.6),
  S('M16 55 Q31 44 24 30 Q17 15 32 7 Q47 0 44 13 Q41 26 55 33', 'bs', 1.6), // one continuous fine thread, very long
]);
def('taenia_solium', () => [
  C(12, 30, 4, 'bs'),                                            // the scolex, small
  S('M9 26 L7 22 M15 26 L17 22', 'ik', 1.2),                     // its ring of hooks — the pork tapeworm's tell
  ...[0, 1, 2, 3, 4].map(i => P(`M${16 + i * 7} 26 L${22 + i * 7} 26 L${22 + i * 7} 34 L${16 + i * 7} 34 Z`, i % 2 ? 'hi' : 'lo')), // segmented ribbon
]);
def('taenia_saginata', () => [
  C(9, 30, 3.6, 'bs'),
  ...[[7, 28], [11, 28]].map(([x, y]) => C(x, y, 1, 'ik')),      // suckers only — no hooks, unlike the pork tapeworm
  ...[0, 1, 2, 3, 4, 5, 6].map(i => P(`M${13 + i * 6.5} 27 L${18.5 + i * 6.5} 27 L${18.5 + i * 6.5} 33 L${13 + i * 6.5} 33 Z`, i % 2 ? 'hi' : 'lo')), // a longer ribbon
]);
def('schistosoma', () => [
  P('M14 18 Q9 32 14 48 Q23 52 27 48 Q23 32 27 18 Q23 14 14 18 Z', 'bs'), // the male's grooved body
  S('M18 21 Q21 32 18 45', 'hi', 2.2),                           // the thinner female, carried inside the groove
]);
def('clonorchis_sinensis', () => [
  P('M30 9 Q46 15 44 31 Q42 47 30 52 Q18 47 16 31 Q14 15 30 9 Z', 'bs'), // flat, leaf-shaped liver fluke
  C(30, 19, 3.4, 'hi'),                                          // oral sucker
  C(30, 33, 2.6, 'lo'),                                          // ventral sucker
]);

/* ectoparasites ──────────────────────────────────────────────────────── */
def('head_louse', () => [
  S('M30 4 L30 56', 'hi', 1.4),                                  // the hair shaft it clings to
  E(30, 30, 8, 12, 'bs'),                                        // its oval body
  ...[22, 30, 38].map(y => [S(`M22 ${y} L14 ${y - 4}`, 'ik', 1.2), S(`M38 ${y} L46 ${y - 4}`, 'ik', 1.2)]).flat(), // six clawed legs, gripping
]);
def('body_louse', () => [
  ...[0, 1, 2, 3].map(i => S(`M${12 + i * 10} 8 L${12 + i * 10} 52`, 'gh', 1)), // the fabric weave —
  ...[0, 1, 2].map(i => S(`M8 ${18 + i * 12} L52 ${18 + i * 12}`, 'gh', 1)),    // where it lives, not on skin
  E(30, 30, 8, 11, 'bs'),                                        // the louse, in the seam
]);
def('scabies_mite', () => [
  S('M8 44 Q20 40 26 32 Q32 24 28 16', 'hi', 2),                 // its burrow, just under the skin
  C(28, 16, 5, 'bs'),                                            // the mite, at the tunnel's end
  ...[[24, 13], [32, 13], [26, 20], [31, 20]].map(([x, y]) => S(`M28 16 L${x} ${y}`, 'ik', 1)), // stubby legs
]);
def('bed_bug', () => [
  P('M16 20 Q30 12 44 20 Q48 32 44 44 Q30 52 16 44 Q12 32 16 20 Z', 'bs'), // flat, wide, oval body
  S('M22 18 L18 10 M38 18 L42 10', 'ik', 1.4),                   // short antennae
  ...[24, 30, 36].map(y => S(`M16 ${y} L8 ${y - 4}`, 'lo', 1.4)), // legs along one flank
]);

/* protozoa ───────────────────────────────────────────────────────────── */
def('plasmodium', () => [
  C(30, 32, 17, 'lo'),                                           // the red blood cell it replicates inside
  ring('bs', 24, 30, 6, 2.2),                                    // its signet-ring form
  C(20, 26, 2, 'ik'),                                             // the chromatin dot
]);
def('toxoplasma_gondii', () => [
  P('M14 40 Q10 24 26 14 Q40 10 44 22 Q30 20 22 30 Q16 38 24 46 Q18 46 14 40 Z', 'bs'), // the crescent-shaped body
  C(22, 20, 2, 'ik'),                                            // its nucleus, near the pointed end
]);
def('giardia', () => [
  P('M30 12 Q44 16 42 32 Q40 48 30 50 Q20 48 18 32 Q16 16 30 12 Z', 'bs'), // pear-shaped body
  C(24, 26, 2.4, 'ik'), C(36, 26, 2.4, 'ik'),                    // two nuclei — its little "face"
  S('M16 42 L6 50 M44 42 L54 50', 'hi', 1.4),                    // trailing flagella
]);
def('entamoeba_histolytica', () => [
  P('M18 40 Q10 32 16 22 Q22 14 32 18 Q40 12 44 22 Q50 30 42 36 Q46 44 36 42 Q30 50 18 40 Z', 'bs'), // shapeless, extending a pseudopod
  C(24, 26, 2, 'lo'),                                            // nucleus
  ...granules('gh', 3, 55, [32, 32, 42, 40]),                    // an engulfed red cell
]);
def('trichomonas_vaginalis', () => [
  E(28, 34, 12, 15, 'bs'),                                       // pear-shaped body
  S('M20 22 Q28 30 20 44', 'hi', 1.6),                           // the undulating membrane down one side
  ...[[24, 18], [28, 16], [32, 18]].map(([x, y]) => S(`M28 20 L${x} ${y}`, 'ik', 1)), // flagella tuft at the front
]);
def('cryptosporidium', () => [
  ring('gh', 30, 32, 15, 3),                                     // the tough oocyst wall — shrugs off chlorine
  C(25, 27, 3, 'bs'), C(35, 25, 2.4, 'bs'), C(31, 37, 3.4, 'bs'), C(21, 36, 2, 'bs'), // sporozoites, packed unevenly inside
]);

/* the diseases they cause — drawn as the damage, not the organism again ── */
def('malaria', () => [
  C(30, 32, 12, 'lo'),                                           // a red blood cell, about to burst
  ...Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45) * Math.PI / 180;
    return S(`M${n(30 + 12 * Math.cos(a))} ${n(32 + 12 * Math.sin(a))} L${n(30 + 20 * Math.cos(a))} ${n(32 + 20 * Math.sin(a))}`, 'bs', 2);
  }),                                                             // bursting — timing the next wave of fever
]);
def('toxoplasmosis', () => [
  E(30, 40, 16, 8, 'lo'),                                        // muscle tissue
  ...[[22, 38], [30, 42], [38, 38]].map(([x, y]) => C(x, y, 4, 'bs')), // cysts embedded in it
  P('M18 14 L24 6 L26 16 Z', 'hi'), P('M34 16 L36 6 L42 14 Z', 'hi'), // a cat's ears — its only sexual host
]);
def('giardiasis', () => [
  S('M10 16 Q10 30 30 30 Q50 30 50 44', 'lo', 6),                // the gut, cramping
  ...[[18, 16], [30, 30], [42, 44]].map(([x, y]) => C(x, y, 3, 'bs')), // cysts moving through it
]);
def('amoebiasis', () => [
  P('M10 20 Q10 8 24 8 Q38 8 38 20 Q38 30 26 30 Q38 30 38 42 Q38 54 24 54 Q10 54 10 42 Z', 'gh'), // the gut wall, in outline
  P('M20 24 Q14 20 18 14 Q24 10 28 16 Q32 12 34 20 Q30 26 24 24 Z', 'bs'), // the amoeba, invading it
]);
def('trichinosis', () => [
  ...[16, 30, 44].map(x => S(`M${x} 8 L${x} 52`, 'lo', 5)),      // striated muscle fibers
  S('M30 26 Q38 26 38 20 Q38 14 30 14 Q24 14 24 20 Q24 25 28 25', 'bs', 2), // one larva, coiled inside
]);
def('lymphatic_filariasis', () => [
  P('M22 6 L38 6 L40 30 Q48 40 44 52 Q38 56 30 52 Q26 48 28 40 Q20 30 22 6 Z', 'bs'), // the leg, grossly swollen below the knee
  S('M24 30 Q30 34 36 30', 'lo', 1.6),                           // the knee, still normal above it
]);
def('schistosomiasis', () => [
  P('M12 24 Q10 12 24 10 Q40 8 46 20 Q50 32 40 40 Q44 48 32 48 Q16 50 12 38 Q8 30 12 24 Z', 'lo'), // the liver, where the damage settles
  S('M26 26 Q30 32 26 40', 'bs', 3), S('M32 24 Q34 32 32 42', 'hi', 1.6), // paired flukes, lodged inside
]);

/* ecology terms — each one drawn as one literal, honest diagram ────────── */
def('primary_consumer', () => [
  leaf('bs', 30, 30, 1.3),
  P('M38 20 Q44 26 38 34 Q32 30 34 24 Q36 20 38 20 Z', 'gh'),    // the bite already taken out of it
  ...[36, 40, 44].map(x => S(`M${x} 22 L${x + 2} 18`, 'ik', 1)), // small teeth marks
]);
def('secondary_consumer', () => [
  E(24, 34, 8, 5, 'gh'),                                         // the smaller animal, caught
  P('M14 20 Q30 12 46 20 Q46 30 30 34 Q14 30 14 20 Z', 'bs'),    // the jaw, closing over it
  ...[20, 26, 32, 38].map(x => P(`M${x - 1.5} 20 L${x + 1.5} 20 L${x} 26 Z`, 'ik')), // fangs along the bite line
]);
def('decomposer', () => [
  leaf('gh', 22, 40, .9, -20),                                   // the fallen leaf, already fading
  P('M30 34 Q30 24 40 22 Q50 24 48 34 Z', 'bs'),                 // the fungus doing the breaking-down
  ...granules('lo', 6, 61, [16, 44, 44, 52]),                    // and what's left: soil
]);
def('trophic_level', () => [
  P('M8 50 L52 50 L52 40 L8 40 Z', 'lo'),                        // base tier — producers, most of them
  P('M14 40 L46 40 L46 28 L14 28 Z', 'bs'),                      // one rung up
  P('M20 28 L40 28 L40 16 L20 16 Z', 'hi'),                      // the top tier — fewest, at the peak
]);
def('food_chain', () => [
  ...[[9, 32, 7], [23, 32, 6], [37, 32, 5], [50, 32, 4]].map(([x, y, rad], i) => ring(i % 2 ? 'bs' : 'lo', x, y, rad, 2.4)), // one straight line of links, shrinking
]);
def('food_web', () => [
  ...[[14, 16], [46, 16], [10, 42], [30, 48], [50, 42]].map(([x, y]) => C(x, y, 3, 'bs')),
  C(30, 28, 3, 'hi'),
  ...[[14, 16, 30, 28], [46, 16, 30, 28], [10, 42, 30, 28], [50, 42, 30, 28], [30, 48, 30, 28], [14, 16, 10, 42], [46, 16, 50, 42]]
    .map(([x1, y1, x2, y2]) => S(`M${x1} ${y1} L${x2} ${y2}`, 'gh', 1.2)), // every chain, tangled into one real network
]);
def('apex_predator', () => [
  P('M8 50 Q30 20 52 50 Z', 'lo'),                               // the peak — everything else, below it
  C(30, 22, 8, 'bs'),                                            // its head, alone at the top
  P('M24 18 L22 10 L28 17 Z', 'ik'), P('M32 17 L38 10 L36 18 Z', 'ik'), // ears, alert — nothing hunts it back
]);
def('trophic_cascade', () => [
  S('M14 6 L14 18', 'ik', 2.4), P('M10 16 L14 24 L18 16 Z', 'ik'), // the effect starting at the top
  S('M30 22 L30 34', 'lo', 2.4), P('M26 32 L30 40 L34 32 Z', 'lo'), // rippling down a level
  S('M46 38 L46 50', 'hi', 2.4), P('M42 48 L46 56 L50 48 Z', 'hi'), // and reaching all the way to the bottom
]);
def('sea_urchin', () => [
  C(30, 32, 9, 'bs'),                                            // the test
  ...Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30) * Math.PI / 180;
    return S(`M${n(30 + 9 * Math.cos(a))} ${n(32 + 9 * Math.sin(a))} L${n(30 + 22 * Math.cos(a))} ${n(32 + 22 * Math.sin(a))}`, i % 2 ? 'hi' : 'lo', 1.6);
  }),                                                             // spines, radiating in every direction
]);
def('sea_otter', () => [
  wave('water-bs', 48, 4, 24),                                   // floating on the surface
  E(26, 34, 16, 9, 'bs'),                                        // its body, on its back
  C(44, 30, 7, 'bs'),                                            // head, tipped up
  C(30, 32, 4, 'lo'),                                            // the urchin, held on its chest as an anvil
  S('M12 36 Q4 34 6 28', 'hi', 2.2),                             // a trailing hind paw
]);
def('keystone_species', () => [
  S('M10 50 Q10 16 30 16 Q50 16 50 50', 'lo', 6),                // an arch
  P('M24 18 L36 18 L34 28 L26 28 Z', 'bs'),                      // the keystone, actually holding it up
]);
def('mutualism', () => [
  ring('bs', 22, 30, 13, 2.6),
  ring('hi', 38, 30, 13, 2.6),                                   // two equal circles, evenly overlapping — both better off
]);
def('commensalism', () => [
  E(28, 38, 20, 10, 'gh'),                                       // the larger host, unaffected either way
  C(38, 26, 6, 'bs'),                                            // the small rider, along for the trip
]);
def('parasitism', () => [
  S('M14 12 Q9 30 20 50', 'gh', 6),                              // the host, drooping under the drain
  C(16, 18, 5, 'bs'),                                            // the parasite, latched near the top
  S('M16 18 L13 11 M16 18 L9 16', 'ik', 1.4),                    // its mouthparts, feeding in
]);
def('whale_barnacle', () => [
  E(30, 40, 24, 12, 'lo'),                                       // the patch of whale skin it's embedded in
  P('M20 40 Q20 26 30 20 Q40 26 40 40 Z', 'bs'),                 // its conical shell
  ...[24, 30, 36].map(x => S(`M${x} 40 L${x} 30`, 'hi', 1)),     // shell plates
  S('M24 22 Q30 16 36 22', 'gh', 1.4),                           // feathery cirri, filtering plankton at no cost to the whale
]);
def('pioneer_species', () => [
  facet('gh', .9),                                               // bare rock — nothing here yet
  ...[[20, 30], [32, 26], [26, 38]].map(([x, y]) => C(x, y, 4, 'bs')), // the first lichen patches to colonise it
]);
def('carrying_capacity', () => [
  vessel('gh', 20, 48),                                          // the container — what the environment can hold
  S('M14 26 L46 26', 'lo', 1.6),                                 // the line marking its limit
  ...granules('bs', 14, 71, [16, 14, 44, 46]),                   // population, filled right up to it
]);

/* animals — an insect, a housecat, a gastropod, and four apex hunters ──── */
def('mosquito', () => [
  E(24, 30, 13, 3.2, 'ik'),                                      // the segmented body
  S('M36 30 L50 35', 'ik', 1.6),                                 // its long piercing proboscis
  E(20, 22, 10, 4, 'hi'), E(24, 20, 8, 3.4, 'gh'),               // wings
  ...[[16, 33], [22, 34], [28, 34]].map(([x, y]) => S(`M${x} ${y} L${x - 3} ${y + 10}`, 'ik', 1)), // thin legs
]);
def('cat', () => [
  E(28, 38, 13, 12, 'bs'),                                       // a rounded, sitting body
  C(28, 20, 9, 'bs'),                                            // round head
  P('M20 14 L23 6 L26 15 Z', 'bs'), P('M30 15 L33 6 L36 14 Z', 'bs'), // pointed ears
  S('M14 22 L4 20 M14 24 L4 25 M42 22 L52 20 M42 24 L52 25', 'ik', 1), // whiskers
  S('M40 44 Q52 40 48 26', 'lo', 3),                             // tail, curled round
]);
def('snail', () => [
  C(38, 26, 13, 'bs'),                                           // the coiled shell
  S('M38 26 Q46 26 46 18 Q46 12 38 13 Q31 14 32 20 Q33 25 38 24', 'ik', 1.6), // the spiral line on it
  P('M8 48 Q8 38 20 38 Q32 38 32 48 Q32 52 20 52 Q8 52 8 48 Z', 'hi'), // the foot, gliding
  S('M12 38 L8 28 M18 38 L16 26', 'ik', 1.4),                    // two eye-stalks
]);
def('eagle', () => [
  P('M6 30 Q30 12 30 30 Q30 12 54 30 Q42 36 30 32 Q18 36 6 30 Z', 'bs'), // wings, spread wide, diving
  C(30, 21, 6, 'lo'),                                            // head
  P('M35 20 L45 21 L35 24 Z', 'hi'),                             // hooked beak
  ...[[24, 46], [30, 48], [36, 46]].map(([x, y]) => P(`M${x - 2} ${y} L${x + 2} ${y} L${x} ${y + 6} Z`, 'ik')), // talons, out
]);
def('jaguar', () => [
  E(28, 36, 17, 11, 'bs'),                                       // a stocky, powerful body
  C(46, 30, 7, 'bs'),                                            // broad head, strong jaw
  ...[[18, 30], [26, 40], [36, 32], [20, 42]].map(([x, y]) => [ring('lo', x, y, 3.2, 1.2), C(x, y, 1, 'lo')]).flat(), // rosettes, each with a spot at its center
  S('M12 40 Q4 44 6 52', 'lo', 3),                                // short, thick tail
]);
def('leopard', () => [
  E(26, 38, 18, 8, 'bs'),                                        // sleek, low, stretched-out body
  C(46, 33, 6.5, 'bs'),
  ...[[16, 34], [24, 40], [32, 36], [38, 42], [20, 44]].map(([x, y]) => C(x, y, 2.2, 'lo')), // solid spots — no dot in the center
  S('M10 36 Q2 30 6 20', 'lo', 2.6),                             // tail, held high
]);
def('snow_leopard', () => [
  C(28, 34, 13, 'hi'),                                           // pale, round-bodied
  C(26, 22, 3, 'ik'), C(34, 22, 3, 'ik'),                        // small ears, cold-adapted
  S('M40 34 Q54 30 52 14 Q50 4 34 10 Q26 14 30 24', 'bs', 9),    // the huge tail, wrapped forward over the face
  ...[[20, 32], [30, 36], [24, 26]].map(([x, y]) => C(x, y, 2, 'lo')), // faint rosettes
]);

/* plant — wild-plant, carnivorous, toxic-plant & ecology-term batch ────────
   Fifty-nine ids that were falling through to the generic leaf/stem. Each is
   drawn on its one real distinguishing trait: the trap, the pod, the pattern
   the fact line actually describes — not another stalk with two leaves. */
def('hay', () => [
  ...[-14, -7, 0, 7, 14].map(dx => S(`M${30 + dx} 52 Q${n(30 + dx * .4)} 30 ${n(30 + dx * 1.3)} 10`, 'bs', 2)),
  S('M12 34 L48 34', 'lo', 4),                                    // the twine binding the sheaf
]);
def('venus_flytrap', () => [
  S('M30 54 L30 34', 'lo', 3),
  P('M30 34 Q8 22 16 6 Q26 12 30 22 Z', 'bs'),
  P('M30 34 Q52 22 44 6 Q34 12 30 22 Z', 'hi'),
  ...[10, 18, 26, 34, 42, 50].map(x => P(`M${x} 8 L${x + 3} 2 L${x + 6} 8 Z`, 'ik')), // the trigger-hair teeth
]);
def('nepenthes', () => [
  S('M30 6 Q34 14 30 20', 'lo', 2),                                // the tendril it hangs from
  P('M20 20 Q16 34 20 46 Q24 54 30 54 Q36 54 40 46 Q44 34 40 20 Q30 14 20 20 Z', 'bs'),
  E(30, 20, 10, 3, 'hi'),                                          // the wax-slicked peristome rim
  P('M22 16 Q30 8 38 16 Q34 10 30 8 Q26 10 22 16 Z', 'lo'),        // the hinged lid
]);
def('sundew', () => [
  ...[-60, -20, 20, 60].map(rot => ['g', rot, 30, 34, [S('M30 34 L30 14', 'bs', 1.6)]]),
  ...[-60, -20, 20, 60].map(rot => ['g', rot, 30, 34, [C(30, 12, 2.4, 'hi')]]),  // the sticky mucilage droplet
  C(30, 40, 6, 'lo'),
]);
def('mistletoe', () => [
  S('M8 30 L52 30', 'lo', 3),                                      // the host branch, tapped
  ...[[20, 22], [20, 38], [40, 22], [40, 38]].map(([x, y]) => leaf('bs', x, y, .55, x < 30 ? -30 : 30)),
  ...[[30, 20], [36, 30], [30, 40]].map(([x, y]) => C(x, y, 3, 'hi')), // the pale berries
]);
def('rafflesia', () => [
  ...[0, 72, 144, 216, 288].map(a => ['g', a, 30, 32, [E(30, 18, 11, 15, 'bs')]]), // five mottled lobes, no stem
  C(30, 32, 9, 'lo'),
  ...granules('hi', 10, 13, [16, 18, 44, 46]),
]);
def('welwitschia', () => [
  E(30, 50, 10, 6, 'lo'),                                          // the woody crown, half-buried
  S('M22 48 Q6 40 10 16 Q14 30 20 46', 'bs', 5),                   // exactly two leaves —
  S('M38 48 Q54 40 50 16 Q46 30 40 46', 'bs', 5),                  // never shed, never replaced
]);
def('water_lily', () => [
  wave('lo', 46, 3, 26),
  P('M30 30 A16 16 0 1 1 29.6 30 Z', 'bs'),                        // the pad, with its slit to the centre
  ...[0, 55, 110].map(a => ['g', a, 46, 18, [leaf('hi', 46, 10, .5)]]),
]);
def('duckweed', () => [
  ...[[18, 28], [30, 24], [42, 30], [24, 36], [36, 38]].map(([x, y]) => E(x, y, 5, 3.4, 'bs')),
  ...[[18, 28], [30, 24], [42, 30]].map(([x, y]) => S(`M${x} ${y + 3} L${x} ${y + 9}`, 'lo', 1)),
  wave('gh', 46, 2, 26),
]);
def('orchid', () => [
  S('M30 54 L30 30', 'lo', 2),
  ...[-50, 50, 180].map(a => ['g', a, 30, 20, [leaf('hi', 30, 12, .5)]]),
  P('M22 26 Q30 42 38 26 Q30 34 22 26 Z', 'bs'),                   // the labellum — bigger, and different
]);
def('giant_sequoia', () => [
  P('M18 54 Q14 30 22 8 L38 8 Q46 30 42 54 Z', 'lo'),              // trunk, massive by volume
  ...[22, 28, 34, 40].map(x => S(`M${x} 50 L${x - 1} 14`, 'ik', 1)), // the metre-thick fire-scarred bark
  E(30, 8, 16, 6, 'bs'),                                           // a crown small next to that trunk
]);
def('coast_redwood', () => [
  P('M26 54 L24 6 L36 6 L34 54 Z', 'lo'),                          // straight up past the top of the field
  E(30, 6, 10, 4, 'bs'),
  wave('gh', 20, 3, 22),                                            // fog, pulled in through the needles
]);
def('moss', () => [
  ...[[18, 46], [30, 48], [42, 46], [24, 42], [36, 42]].map(([x, y]) => C(x, y, 7, 'bs')),
  ...[[20, 40], [40, 40]].map(([x, y]) => S(`M${x} ${y} L${x} ${y - 14}`, 'lo', 1.2)),
  ...[[20, 26], [40, 26]].map(([x, y]) => C(x, y, 2, 'hi')),         // the spore capsules, up on their stalks
]);
def('liverwort', () => [
  P('M10 44 Q20 30 30 44 Q40 30 50 44 Q30 52 10 44 Z', 'bs'),       // a flat, forked thallus
  S('M20 40 Q20 34 24 30 M40 40 Q40 34 36 30', 'lo', 1.6),
  ...[[16, 42], [30, 44], [44, 42]].map(([x, y]) => C(x, y, 1.6, 'hi')), // the spore-flinging gemmae
]);
def('bracken_fern', () => [
  S('M30 54 L30 10', 'lo', 2),
  ...[14, 22, 30, 38, 46].map((y, i) => {
    const w = 18 - i * 3;
    return [S(`M30 ${y} L${30 - w} ${y - 6}`, 'bs', 1.6), S(`M30 ${y} L${30 + w} ${y - 6}`, 'bs', 1.6)];
  }).flat(),
]);
def('edelweiss', () => [
  ...[0, 51, 102, 153, 204, 255, 306].map(a => ['g', a, 30, 30, [leaf('hi', 30, 18, .55)]]), // woolly star bracts
  ...[[26, 28], [34, 28], [30, 32]].map(([x, y]) => C(x, y, 2.6, 'bs')),
]);
def('saguaro', () => [
  P('M24 54 L24 10 A6 6 0 0 1 36 10 L36 54 Z', 'bs'),
  P('M24 30 Q10 30 10 18 A5 5 0 0 1 20 18 L20 30 Z', 'bs'),         // one arm, after 75 years
  P('M36 24 Q50 24 50 14 A5 5 0 0 1 40 14 L40 24 Z', 'bs'),
  ...[26, 30, 34].map(x => S(`M${x} 50 L${x} 12`, 'ik', 1)),        // the accordion pleats
]);
def('gourd', () => [
  P('M30 12 Q20 12 20 22 Q14 26 16 36 Q16 50 30 52 Q44 50 44 36 Q46 26 40 22 Q40 12 30 12 Z', 'bs'),
  S('M30 12 Q28 6 32 2', 'lo', 2),                                  // the dried, curling stem
  S('M20 30 Q30 34 40 30', 'hi', 1.4),                              // the waist between the two lobes
]);
def('cane', () => [
  ...[16, 24, 32, 40].map((x, i) => S(`M${x} 54 L${x - (i % 2 ? 2 : -2)} 12`, 'bs', 2.6)), // dense standing culms
  ...[16, 24, 32, 40].map(x => P(`M${x} 12 Q${x - 6} 4 ${x - 2} 2 Q${x + 2} 4 ${x} 12 Z`, 'hi')),
]);
def('producer', () => [
  C(46, 14, 7, 'hi'),                                               // sunlight —
  ...[[38, 18], [40, 10]].map(([x, y]) => S(`M${x} ${y} L${x - 14} ${y + 16}`, 'gh', 1.4)),
  leaf('bs', 24, 40, 1.4),                                          // — turned into food, at the base of everything
]);
def('succession', () => [
  S('M4 52 L56 52', 'lo', 1.6),
  C(12, 48, 2.4, 'bs'),                                             // bare ground, first colonised
  leaf('bs', 24, 42, .5),
  leaf('bs', 38, 34, .9),
  leaf('hi', 52, 22, 1.3),                                          // each wave replacing the last
]);
def('climax_community', () => [
  ring('gh', 30, 30, 22, 2),                                        // the stable state — nothing replacing it now
  S('M30 52 L30 34', 'lo', 4),
  C(30, 22, 14, 'bs'), C(30, 22, 8, 'hi'),
]);
def('taiga', () => [
  S('M4 52 L56 52', 'lo', 2),
  ...[14, 30, 46].map((x, i) => P(`M${x} ${52 - (i % 2 ? 16 : 20)} L${x - 8} 52 L${x + 8} 52 Z`, i % 2 ? 'hi' : 'bs')), // the belt of conifers
]);
def('rainforest', () => [
  ...[[14, 16], [30, 10], [46, 16]].map(([x, y]) => C(x, y, 10, 'bs')), // the closed upper canopy
  ...[[20, 30], [40, 30]].map(([x, y]) => C(x, y, 8, 'hi')),         // a mid layer, still shading the floor
  S('M8 52 L52 52', 'gh', 1.4),                                     // 2% of the light gets this far
]);
def('limiting_factor', () => [
  P('M16 20 L16 48 Q30 54 44 48 L44 20', 'lo'),                     // Liebig's barrel
  ...[20, 26, 32, 38, 44].map((x, i) => S(`M${x} ${20 + [0, 10, 4, 14, 6][i]} L${x} 48`, 'bs', 2.4)), // uneven staves
  wave('hi', 22, 2, 8),                                             // it only holds as high as the shortest one
]);
def('indigo', () => [
  S('M30 54 L30 30', 'lo', 2.4),
  ...[[18, 24], [30, 18], [42, 24]].map(([x, y]) => leaf('bs', x, y, .8)),
  C(30, 44, 4, 'hi'),                                                // the blue dye, locked inside
]);
def('leuco_indigo', () => [
  vessel('lo'),
  wave('hi', 34, 4, 12), wave('gh', 30, 3, 11),                     // pale yellow, not blue — not yet
]);
def('madder', () => [
  S('M28 6 L28 52 Q28 56 32 52', 'lo', 3),                          // a root, grown over a metre long on purpose
  leaf('bs', 26, 8, .6, -20), leaf('bs', 34, 8, .6, 20),
  S('M18 20 L54 20', 'gh', 1),                                      // the soil line
]);
def('alizarin', () => [
  hex('ik', 16, 30, 9, 2), hex('ik', 30, 30, 9, 2), hex('ik', 44, 30, 9, 2), // the three fused rings
  C(30, 18, 3.4, CPK.O), C(30, 42, 3.4, CPK.O),                     // the anthraquinone's two ketone oxygens
]);
def('rose_madder', () => [
  P('M14 20 L46 20 L46 48 L14 48 Z', 'bs'),                         // the pigment cake
  facet('hi', .3),                                                  // the alum it's bonded to, so it survives the wash
  S('M14 34 L46 34', 'gh', 1),
]);
def('lotus', () => [
  ...[-40, 0, 40].map(a => ['g', a, 30, 24, [leaf('hi', 30, 12, .8)]]),
  E(30, 40, 10, 8, 'bs'),                                           // the flat-topped seed pod
  ...[[26, 37], [30, 36], [34, 37], [28, 42], [32, 42]].map(([x, y]) => C(x, y, 1.6, 'lo')), // its holes
]);
def('cell_wall', () => [
  P('M8 12 L28 12 L28 48 L8 48 Z', 'gh'), P('M32 12 L52 12 L52 48 L32 48 Z', 'gh'),
  S('M28 10 L28 50 M32 10 L32 50', 'ik', 3.4),                      // the rigid wall, laid down thick
  S('M26 10 L26 50 M34 10 L34 50', 'lo', 1),                        // the membrane, just inside it
]);
def('guard_cell', () => [
  P('M12 30 Q20 16 30 30 Q20 44 12 30 Z', 'bs'), P('M48 30 Q40 16 30 30 Q40 44 48 30 Z', 'bs'),
  C(18, 24, 2.4, 'hi'), C(42, 36, 2.4, 'hi'),                       // the chloroplasts it kept
  E(30, 30, 4, 8, 'ground'),                                        // the pore, between them
]);
def('palisade_cell', () => [
  S('M6 10 L54 10', 'ik', 2),                                       // the leaf's upper skin
  ...[10, 18, 26, 34, 42, 50].map(x => P(`M${x - 3} 14 L${x + 3} 14 L${x + 3} 46 L${x - 3} 46 Z`, 'bs')), // packed columns
  ...[10, 18, 26, 34, 42, 50].flatMap(x => [C(x, 24, 1.6, 'hi'), C(x, 36, 1.6, 'hi')]),
]);
def('poppy', () => [
  ...[0, 90, 180, 270].map(a => ['g', a, 30, 26, [E(30, 16, 9, 12, 'bs')]]),
  C(30, 26, 4, 'ik'),
  S('M22 26 L38 26 M30 18 L30 34', 'lo', 1),                        // the cross-shaped stigma
  E(46, 46, 5, 7, 'hi'),                                            // a seed pod, close by
]);
def('deadly_nightshade', () => [
  S('M30 54 L30 20', 'lo', 2),
  leaf('bs', 18, 30, .7, -30), leaf('bs', 42, 30, .7, 30),
  P('M26 14 Q30 6 34 14 Q34 20 30 22 Q26 20 26 14 Z', 'hi'),         // the bell flower — bella donna
  C(24, 40, 4.4, 'ik'), C(36, 44, 4.4, 'ik'),                        // black, glossy berries
]);
def('atropine', () => [
  hex('ik', 20, 26, 9, 2),                                          // the tropane ring
  S('M20 17 L20 35', 'ik', 2), C(20, 17, 3.6, CPK.N),                // the bridging nitrogen
  S('M29 26 L40 26', 'ik', 2), C(40, 26, 3.6, CPK.O),
  S('M40 26 L48 34', 'ik', 2), C(48, 34, 3.6, CPK.O),                // the ester tail
]);
def('poison_hemlock', () => [
  S('M30 54 L30 16', 'lo', 3),
  C(24, 32, 1.8, 'ik'), C(35, 42, 1.8, 'ik'),                        // the purple blotches, along a hollow stem
  ...[[8, 16], [19, 10], [30, 8], [41, 10], [52, 16]].map(([x, y]) => S(`M30 16 L${x} ${y}`, 'bs', 1.2)),
  ...[[8, 16], [19, 10], [30, 8], [41, 10], [52, 16]].map(([x, y]) => C(x, y, 2, 'hi')), // the umbel
]);
def('water_hemlock', () => [
  S('M30 26 L30 6', 'lo', 3),
  E(30, 40, 14, 14, 'bs'),                                          // the tuberous root
  S('M30 28 L30 52 M18 40 L42 40', 'ik', 1.4),                      // chambered, cross-sectioned
  C(30, 34, 2, 'gh'), C(24, 46, 2, 'gh'), C(36, 46, 2, 'gh'),
]);
def('castor_bean', () => [
  C(30, 26, 12, 'bs'),
  ...Array.from({ length: 10 }, (_, i) => {
    const a = i * 36 * Math.PI / 180;
    return S(`M${n(30 + 12 * Math.cos(a))} ${n(26 + 12 * Math.sin(a))} L${n(30 + 17 * Math.cos(a))} ${n(26 + 17 * Math.sin(a))}`, 'lo', 1.4);
  }),                                                                // the spiny pod
  E(30, 46, 6, 9, 'hi'),
  ...[[27, 42], [30, 46], [33, 50]].map(([x, y]) => C(x, y, 1, 'ik')), // the mottled seed
]);
def('ricin', () => [
  S('M10 44 Q10 20 24 20 Q38 20 38 34 Q38 48 24 48 Q14 48 14 40', 'ik', 3), // the folded protein backbone
  C(24, 20, 3, 'hi'), C(38, 34, 3, 'hi'), C(14, 40, 3, 'hi'),        // the active-site residues
]);
def('oleander', () => [
  ...[0, 120, 240].map(a => ['g', a, 30, 40, [leaf('bs', 30, 26, 1)]]), // leaves whorled in threes
  ...[0, 72, 144, 216, 288].map(a => ['g', a, 30, 14, [E(30, 8, 3, 7, 'hi')]]),
]);
def('aconite', () => [
  S('M30 54 L30 24', 'lo', 2.4),
  P('M18 24 Q18 8 30 6 Q42 8 42 24 Q36 30 30 24 Q24 30 18 24 Z', 'bs'), // the hood, concealing everything
  E(30, 14, 5, 7, 'hi'),
]);
def('autumn_crocus', () => [
  S('M12 54 L48 54', 'gh', 1.4),                                     // bare ground — leafless in fall
  ...[-14, 0, 14].map(dx => S(`M${30 + dx} 54 L${30 + dx * .4} 22`, 'lo', 1.6)),
  ...[0, 60, 120, 180, 240, 300].map(a => ['g', a, 30, 22, [E(30, 12, 5, 10, 'bs')]]),
]);
def('mayapple', () => [
  S('M30 54 L30 20', 'lo', 2.6),
  P('M30 20 Q8 16 6 30 Q18 24 30 26 Q42 24 54 30 Q52 16 30 20 Z', 'bs'), // one umbrella-shaped leaf
  S('M14 26 L30 22 M46 26 L30 22', 'ik', 1),
  C(30, 44, 4, 'hi'),                                                // the fruit, sheltered underneath
]);
def('yew', () => [
  ...needles('lo', 6),
  E(40, 40, 6, 6, 'hi'),                                             // the fleshy aril, cup-shaped
  C(40, 36, 3, 'ik'),                                                // the seed, poking out its open top
]);
def('pokeweed', () => [
  S('M30 54 L26 10', 'bs', 3),                                       // the magenta stem
  ...[[22, 16], [20, 24], [18, 32], [16, 40]].map(([x, y]) => C(x, y, 3.4, 'ik')), // berries birds strip unharmed
]);
def('larkspur', () => [
  S('M30 54 L30 10', 'lo', 2.2),
  ...[14, 22, 30, 38, 46].flatMap(y => [E(30, y, 6, 4, 'bs'), S(`M36 ${y} L42 ${y - 2}`, 'hi', 1.6)]), // the dolphin spur
]);
def('lily_of_the_valley', () => [
  S('M10 40 Q30 20 50 44', 'lo', 2),                                 // the arching stem
  ...[[18, 32], [26, 26], [34, 30], [42, 38]].map(([x, y]) => P(`M${x - 3} ${y} Q${x} ${y + 7} ${x + 3} ${y} Q${x} ${y + 4} ${x - 3} ${y} Z`, 'hi')), // hanging bells
  leaf('bs', 14, 50, 1.1, -20), leaf('bs', 46, 50, 1.1, 20),
]);
def('giant_hogweed', () => [
  S('M30 54 L30 22', 'lo', 4),
  C(22, 34, 1.6, 'ik'), C(34, 44, 1.6, 'ik'),                        // the purple-blotched stem
  ...Array.from({ length: 9 }, (_, i) => S(`M30 22 L${10 + i * 5} 10`, 'bs', 1)), // a flat-topped umbel, a metre across
  ...Array.from({ length: 9 }, (_, i) => C(10 + i * 5, 10, 1.6, 'hi')),
]);
def('strychnine_tree', () => [
  cutFace('bs', 32, 16, 14),
  E(30, 34, 16, 12, 'hi'),
  ...[[22, 30], [30, 26], [38, 30], [26, 38], [34, 38]].map(([x, y]) => C(x, y, 2.6, 'ik')), // seeds, bitter with strychnine
]);
def('rhododendron', () => [
  leaf('lo', 16, 44, 1, -30), leaf('lo', 44, 44, 1, 30),
  ...[[22, 18], [30, 12], [38, 18], [26, 26], [34, 26]].map(([x, y]) => E(x, y, 7, 8, 'bs')), // the grayanotoxin-laced cluster
]);
def('horse_chestnut', () => [
  P('M14 20 Q10 34 20 44 Q30 50 40 44 Q50 34 46 20 Q30 12 14 20 Z', 'lo'),
  ...Array.from({ length: 14 }, (_, i) => {
    const a = i * (360 / 14) * Math.PI / 180;
    return S(`M${n(30 + 18 * Math.cos(a))} ${n(32 + 18 * Math.sin(a))} L${n(30 + 24 * Math.cos(a))} ${n(32 + 24 * Math.sin(a))}`, 'lo', 1.2);
  }),                                                                // the spiky husk
  C(30, 32, 11, 'bs'), E(26, 28, 3, 4, 'hi'),                        // the glossy conker inside
]);
def('datura', () => [
  S('M30 54 L30 34', 'lo', 2.4),
  P('M16 34 Q16 12 30 8 Q44 12 44 34 Q37 26 30 34 Q23 26 16 34 Z', 'bs'), // trumpet, pointing up
  C(44, 46, 6, 'hi'),
  ...Array.from({ length: 8 }, (_, i) => {
    const a = i * 45 * Math.PI / 180;
    return S(`M${n(44 + 6 * Math.cos(a))} ${n(46 + 6 * Math.sin(a))} L${n(44 + 9 * Math.cos(a))} ${n(46 + 9 * Math.sin(a))}`, 'lo', 1);
  }),                                                                // the spiny seed pod
]);
def('angels_trumpet', () => [
  S('M30 6 L30 22', 'lo', 2.4),
  P('M16 22 Q16 44 30 50 Q44 44 44 22 Q37 30 30 22 Q23 30 16 22 Z', 'hi'), // the mirror image — hanging down
]);
def('cannabis', () => [
  ...[-60, -36, -12, 12, 36, 60].map(a => ['g', a, 30, 34, [P('M30 34 Q26 20 30 6 Q34 20 30 34 Z', 'bs')]]), // the palmate leaf
]);
def('thc', () => [
  P('M20 54 L24 34 L36 34 L40 54 Z', 'lo'),                          // the leaflet it sits on
  S('M30 34 L30 20', 'ik', 1.4),
  C(30, 15, 6, 'hi'),                                                // the resin gland — where it's actually made
]);
def('coca', () => [
  S('M30 54 L30 14', 'lo', 2.4),
  ...[[20, 22], [40, 22], [20, 34], [40, 34], [20, 46], [40, 46]].map(([x, y]) => E(x, y, 7, 4, 'bs')), // opposite oval leaves
  C(30, 10, 3, 'hi'),
]);
def('cocaine', () => [
  mound('hi', 46, 18, 14),                                           // isolated, concentrated — a white powder heap
  ...granules('lo', 10, 29, [16, 32, 44, 48]),
  S('M22 34 L26 38 M34 30 L38 34', 'ik', 1),                         // crystalline glints
]);

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
ship.ui_undo = { c: 'craft', s: [
  S('M40 18 A15 15 0 1 1 18 30', 'ik', 5),
  S('M18 30 L25 23', 'ik', 5), S('M18 30 L26 35', 'ik', 5),
] };
ship.ui_nudge = { c: 'craft', s: [
  S('M18 40 L42 20', 'ik', 4), S('M33.8 34.6 L26.2 25.4', 'ik', 4),
  C(18, 40, 8, 'ik'), C(42, 20, 8, 'ik'), C(18, 40, 3, 'ground'), C(42, 20, 3, 'ground'),
] };
ship.ui_scan = { c: 'craft', s: [
  S('M10 22 Q10 18 14 18 L21 18 L24 14 L36 14 L39 18 L46 18 Q50 18 50 22 L50 42 Q50 46 46 46 L14 46 Q10 46 10 42 Z', 'ik', 3.5),
  C(30, 32, 8, 'ik'), C(30, 32, 4, 'ground'),
] };
ship.ui_amino = { c: 'craft', s: [
  S('M12 40 L22 26 L34 34 L48 20', 'ik', 3.4),
  C(12, 40, 4, 'bs'), C(48, 20, 4, 'hi'),
] };
ship.ui_ladder = { c: 'craft', s: [
  S('M18 8 L18 52', 'ik', 3), S('M42 8 L42 52', 'ik', 3),
  ...[14, 26, 38, 50].map(y => S(`M18 ${y} L42 ${y}`, 'ik', 3)),
] };
ship.ui_eye = { c: 'craft', s: [
  S('M8 30 Q30 12 52 30 Q30 48 8 30 Z', 'ik', 3), C(30, 30, 7, 'ik'), C(30, 30, 3, 'ground'),
] };
// The aside pane's own tabs, converted from text to icons ("could the side
// panel 'shelf' and 'elements' turn to just icons?" — asked more than once).
// Three items sitting on a line, for a shelf holding what you've found.
ship.ui_shelf = { c: 'craft', s: [
  S('M10 44 L50 44', 'ik', 3.5), C(20, 34, 4, 'bs'), C(32, 30, 4, 'hi'), C(44, 36, 4, 'bs'),
] };
// A plain list — bullet and rule, three times — distinct from ui_table's
// grid, since this tab is the flat catalogue, not the periodic chart.
ship.ui_elements = { c: 'craft', s: [
  C(9, 17, 2.4, 'ik'), S('M17 17 L48 17', 'ik', 3.2),
  C(9, 30, 2.4, 'ik'), S('M17 30 L48 30', 'ik', 3.2),
  C(9, 43, 2.4, 'ik'), S('M17 43 L48 43', 'ik', 3.2),
] };
// A paw: one pad, three toes — geometric circles only, matching ui_eye's
// restraint rather than a literal illustrated paw print.
ship.ui_animals = { c: 'craft', s: [
  C(30, 38, 9, 'bs'), C(17, 22, 5, 'hi'), C(30, 15, 5, 'hi'), C(43, 22, 5, 'hi'),
] };
ship.ui_shutter = { c: 'craft', s: [
  // A single still capture, not the live scan — a shutter ring, not a
  // camera body, so it doesn't just repeat ui_scan's silhouette.
  ['s', 'M30 8 A22 22 0 1 1 29.9 8', 'ik', 4],
  C(30, 30, 9, 'ik'),
] };
ship.ui_gallery = { c: 'craft', s: [
  // Two overlapping photo frames — picking from what already exists,
  // rather than pointing a lens at something new.
  S('M12 14 L40 14 L40 42 L12 42 Z', 'ik', 3),
  S('M20 22 L48 22 L48 50 L20 50 Z', 'ik', 3),
  C(28, 32, 3, 'ik'),
] };
ship.ui_digits = { c: 'craft', s: [
  // A barcode's own bars, varying width — typing the number under it is
  // the one path here that needs no camera at all.
  ...[[10, 5], [16, 3], [21, 6], [28, 3], [33, 5], [38, 3], [43, 6], [48, 4]].map(([x, w]) =>
    P(`M${x} 12 L${x + w} 12 L${x + w} 40 L${x} 40 Z`, 'ik')),
] };
ship.ui_table = { c: 'craft', s: [
  // A grid of element tiles, not a gear — the periodic-table toggle used to
  // share a literal gear glyph with the Settings button, which is exactly
  // the "these two buttons look the same" report this replaces.
  ...[12, 24, 36].flatMap(x => [12, 24, 36].map(y =>
    P(`M${x} ${y} L${x + 9} ${y} L${x + 9} ${y + 9} L${x} ${y + 9} Z`, 'ik'))),
] };
ship.ui_motes = { c: 'craft', s: [
  // A line with three dots travelling along it, shrinking as they go —
  // the same thing drawLinksNow() actually draws on the bench, in
  // miniature, so the toolbar icon reads as a preview of the toggle
  // rather than an arbitrary symbol standing in for it.
  S('M8 46 Q22 46 30 30 Q38 14 52 14', 'ik', 3),
  C(14, 44, 4.2, 'ik'), C(30, 30, 3.4, 'ik'), C(46, 16, 2.6, 'ik'),
] };
ship.ui_consolidate = { c: 'craft', s: [
  // Two duplicate outlines folding into one solid card — the toolbar
  // preview of what the "one card per thing" toggle actually does to
  // the bench, the same way ui_motes previews the dots it turns on.
  S('M8 12 L22 12 L22 26 L8 26 Z', 'ik', 2.4),
  S('M14 18 L28 18 L28 32 L14 32 Z', 'ik', 2.4),
  S('M30 22 L40 22', 'ik', 3.2),
  P('M42 12 L56 12 L56 26 L42 26 Z', 'ik'),
] };
ship.ui_circle = { c: 'craft', s: [
  C(30, 30, 4, 'ik'),
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    const x = n(30 + 16 * Math.cos(a)), y = n(30 + 16 * Math.sin(a));
    return [S(`M30 30 L${x} ${y}`, 'gh', 1.6), C(x, y, 3, 'ik')];
  }).flat(),
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
