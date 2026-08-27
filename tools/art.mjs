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
