#!/usr/bin/env node
/**
 * palette.mjs — derive Loam's palette from the Munsell renotation data.
 *
 * Loam's claim is that every recipe is a real, sourced, checkable fact. The
 * palette is held to the same standard: every colour in the game is a Munsell
 * notation from the soil colour book, converted to sRGB by a documented
 * pipeline, not picked by eye.
 *
 *   Munsell notation -> CIE xyY (Illuminant C, 2 deg)   [renotation data]
 *                    -> CIE XYZ
 *                    -> Bradford chromatic adaptation C -> D65
 *                    -> linear sRGB -> gamma-encoded sRGB
 *
 * Source data: Munsell Color Science Laboratory, Rochester Institute of
 * Technology. https://www.rit-mcsl.org/MunsellRenotation/real.dat
 *
 * NOTE: the renotation dataset samples even chromas only (2, 4, 6, ...). The
 * physical soil colour book does include chroma-1 chips, but their coordinates
 * are interpolated rather than measured, so we do not use them — every colour
 * here maps to a measured row. Where we want "chroma 1, barely any colour" we
 * take chroma 2 at the appropriate value instead, and say so.
 *
 * Usage:
 *   node tools/palette.mjs            write data/palette.json
 *   node tools/palette.mjs check      report, write nothing
 *   node tools/palette.mjs 10YR 3 2   look one notation up
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── the renotation table ─────────────────────────────────────────────── */

function loadRenotation() {
  const txt = readFileSync(join(root, 'data/vendor/munsell-real.dat'), 'utf8');
  const rows = new Map();
  for (const line of txt.split('\n').slice(1)) {
    const p = line.trim().split(/\s+/);
    if (p.length < 6) continue;
    const [h, V, C, x, y, Y] = p;
    rows.set(`${h} ${+V}/${+C}`, { x: +x, y: +y, Y: +Y });
  }
  return rows;
}

/* ── colour maths ─────────────────────────────────────────────────────── */

// CIE 1931 2-degree white points.
const WHITE_C   = [0.98074, 1.00000, 1.18232];  // Illuminant C (renotation)
const WHITE_D65 = [0.95047, 1.00000, 1.08883];  // sRGB

const BRADFORD = [
  [ 0.8951,  0.2664, -0.1614],
  [-0.7502,  1.7135,  0.0367],
  [ 0.0389, -0.0685,  1.0296],
];
const BRADFORD_INV = [
  [ 0.9869929, -0.1470543,  0.1599627],
  [ 0.4323053,  0.5183603,  0.0492912],
  [-0.0085287,  0.0400428,  0.9684867],
];
// XYZ (D65) -> linear sRGB
const XYZ_TO_RGB = [
  [ 3.2404542, -1.5371385, -0.4985314],
  [-0.9692660,  1.8760108,  0.0415560],
  [ 0.0556434, -0.2040259,  1.0572252],
];

const mul = (m, v) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

/** Bradford adaptation from one white point to another. */
function adapt(xyz, from, to) {
  const s = mul(BRADFORD, from), d = mul(BRADFORD, to);
  const c = mul(BRADFORD, xyz);
  return mul(BRADFORD_INV, [c[0] * d[0] / s[0], c[1] * d[1] / s[1], c[2] * d[2] / s[2]]);
}

const encode = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const hex2   = n => Math.round(Math.min(255, Math.max(0, n * 255))).toString(16).padStart(2, '0');

/**
 * Convert a Munsell notation to sRGB.
 * Returns { hex, rgb, xyY, clipped } — `clipped` is true when the colour falls
 * outside the sRGB gamut and had to be clamped, which we always report.
 */
function munsellToSrgb(entry) {
  const { x, y, Y } = entry;
  const Yn = Y / 100;
  const xyz = [x * Yn / y, Yn, (1 - x - y) * Yn / y];
  const lin = mul(XYZ_TO_RGB, adapt(xyz, WHITE_C, WHITE_D65));
  const clipped = lin.some(c => c < -0.0005 || c > 1.0005);
  const rgb = lin.map(c => Math.round(Math.min(1, Math.max(0, encode(c))) * 255));
  return { hex: '#' + lin.map(c => hex2(Math.min(1, Math.max(0, encode(c))))).join('').toUpperCase(),
           rgb, xyY: { x, y, Y }, clipped };
}

/* ── the palette we actually want ─────────────────────────────────────── */

/**
 * Nine item categories, each pinned to a Munsell notation.
 *
 * Hue families follow field practice: soil sits almost entirely in 10YR and
 * 7.5YR, with 2.5Y/5Y for the yellower and more olive material. Water and fire
 * cannot come from soil pages, so they are taken from the adjacent hue pages
 * of the same book rather than invented.
 */
const CATEGORIES = {
  mineral: { notation: '10YR 4/2',  note: 'dark greyish brown — the workhorse soil chip', tags: ['earth', 'build'] },
  craft:   { notation: '10YR 6/2',  note: 'light brownish grey — worked material, tools', tags: ['tool', 'myth'] },
  grain:   { notation: '2.5Y 7/4',  note: 'pale straw',                                   tags: ['food', 'sweet'] },
  dish:    { notation: '5YR 5/4',   note: 'browned, cooked',                              tags: ['dish', 'drink'] },
  ferment: { notation: '5Y 6/4',    note: 'olive — the colour of a ferment',              tags: ['ferment', 'preserve', 'dairy'] },
  plant:   { notation: '7.5GY 5/4', note: 'living leaf, muted',                           tags: ['plant', 'crop'] },
  living:  { notation: '5P 5/4',    note: 'microbial and animal tissue',                  tags: ['microbe', 'animal'] },
  water:   { notation: '2.5PB 5/6', note: 'not a soil hue — adjacent hue page',           tags: ['water'] },
  fire:    { notation: '7.5R 5/8',  note: 'not a soil hue — adjacent hue page',           tags: ['fire'] },
  molecule:{ notation: '10B 5/6',   note: 'cool and technical — past the material world', tags: [] },
};

/**
 * Surfaces. Chroma 1-2 only, so the chrome recedes and never competes with an
 * item. The ground is a very dark, slightly warm neutral rather than black.
 */
const SURFACES = {
  ground:   { notation: '10YR 1/2', note: 'canvas — dark, warm, never #000' },
  panel:    { notation: '10YR 2/2', note: 'raised surface' },
  rule:     { notation: '10YR 3/2', note: 'hairlines and dividers' },
  ink:      { notation: '10YR 8/2', note: 'primary text on the dark ground' },
  inkQuiet: { notation: '10YR 6/2', note: 'secondary text' },
  paper:    { notation: '10YR 9/2', note: 'the light theme ground' },
  paperInk: { notation: '10YR 2/2', note: 'ink on paper — the light theme text' },
  // The interface accent: hover, focus, selection, the current thing. Warm, but
  // several steps down in chroma from `discovery`, so the two never compete.
  accent:   { notation: '5YR 6/6',  note: 'interface accent — hover, focus, selection' },
  // The only high-chroma colour in the game. Reserved for the instant a new
  // thing exists and nothing else, so that it always means the same thing.
  discovery:{ notation: '5YR 6/12', note: 'discovery only — never used as decoration' },
};

/* ── build ────────────────────────────────────────────────────────────── */

function build() {
  const table = loadRenotation();
  const warnings = [];

  const resolve = (key, spec) => {
    const entry = table.get(spec.notation);
    if (!entry) { warnings.push(`${key}: notation "${spec.notation}" is not in the renotation table`); return null; }
    const c = munsellToSrgb(entry);
    if (c.clipped) warnings.push(`${key}: ${spec.notation} is outside the sRGB gamut and was clamped`);
    return { ...spec, ...c };
  };

  /**
   * A lighter and a darker tint for each category, taken from the *same hue
   * page* of the book rather than by lightening the hex. Value moves by 2,
   * chroma stays put where the book has that chip and steps down where it does
   * not — which is exactly what you do with the physical book in your hand.
   */
  // forbid is a LIST, not one colour. Forbidding only the card was half the
  // job: mineral's lo was moved off the card colour and landed on `rule`
  // instead, and `rule` is `gh` — a role drawings paint with. 160 mineral
  // drawings then had a shape buried in another of its own colour, which the
  // art check caught. A tint may not equal ANY surface a drawing can be
  // painted with or against.
  const tint = (key, notation, dV, forbid) => {
    const [hue, vc] = notation.split(' ');
    const [V, C] = vc.split('/').map(Number);
    let collided = null;
    // The ladder only ever stepped chroma DOWN, which is right when the book
    // has no chip at the wanted purity. It is not enough here: mineral sits at
    // chroma 2, so with 2/2 and 3/2 both ruled out there was nowhere left to
    // go and it came back with no `lo` at all — worse than the collision it
    // was avoiding, since every drawing using that role would lose its colour.
    // Adding more chroma at the same value is the other honest move with the
    // book in your hand, and it is tried only after the neutral chips fail.
    for (const [v, c] of [[V + dV, C], [V + dV, C - 2], [V + dV, C - 4],
                          [V + Math.sign(dV), C], [V + Math.sign(dV), C - 2],
                          // one-step first among these: the value that collided is
                          // the one being avoided, so moving further from it is worth
                          // more than holding the nominal two-step distance
                          [V + Math.sign(dV), C + 2], [V + dV, C + 2],
                          [V + Math.sign(dV), C + 4], [V + dV, C + 4]]) {
      if (v < 1 || v > 9 || c < 2) continue;
      const n = `${hue} ${v}/${c}`;
      const e = table.get(n);
      if (!e) continue;
      const col = munsellToSrgb(e);
      if (col.clipped) continue;
      // A chip that comes out the same colour as the card is not a dark tint,
      // it is a hole. mineral sits at 10YR 4/2 and the card is 10YR 2/2, so
      // the ordinary two-step drop landed exactly on the background: 735
      // drawings had at least one shape painted in it and could not be seen,
      // and hadron lost 24 of its 27. Take the next chip on the ladder and
      // record which one, rather than shipping an invisible role.
      if (forbid.includes(col.hex.toUpperCase())) { collided = n; continue; }
      return collided
        ? { notation: n, hex: col.hex, steppedFrom: collided, why: 'the usual chip is a surface colour' }
        : { notation: n, hex: col.hex };
    }
    warnings.push(`${key}: no ${dV > 0 ? 'lighter' : 'darker'} chip available on the ${hue} page`);
    return null;
  };

  const out = {
    source: {
      dataset: 'Munsell renotation data (real)',
      publisher: 'Munsell Color Science Laboratory, Rochester Institute of Technology',
      url: 'https://www.rit-mcsl.org/MunsellRenotation/real.dat',
      retrieved: '2026-08-25',
      pipeline: 'Munsell -> CIE xyY (Illuminant C, 2 deg) -> XYZ -> Bradford C->D65 -> sRGB',
    },
    categories: {},
    surfaces: {},
  };

  // Surfaces first, because a category tint that lands on the card colour is
  // invisible on every card that carries it, and tint() cannot avoid the card
  // without knowing what it is.
  for (const [k, v] of Object.entries(SURFACES))   { const r = resolve(k, v); if (r) out.surfaces[k]   = r; }
  const forbidden = ['panel', 'rule', 'ink', 'ground']
    .map(k => out.surfaces[k]?.hex.toUpperCase()).filter(Boolean);

  for (const [k, v] of Object.entries(CATEGORIES)) {
    const r = resolve(k, v);
    if (!r) continue;
    r.hi = tint(k, v.notation, +2, forbidden);
    r.lo = tint(k, v.notation, -2, forbidden);
    if (r.lo?.steppedFrom) warnings.push(`${k}: lo moved off ${r.lo.steppedFrom} to ${r.lo.notation} — ${r.lo.why}`);
    if (r.hi?.steppedFrom) warnings.push(`${k}: hi moved off ${r.hi.steppedFrom} to ${r.hi.notation} — ${r.hi.why}`);
    out.categories[k] = r;
  }

  return { out, warnings };
}

/* ── cli ──────────────────────────────────────────────────────────────── */

const [, , cmd, ...rest] = process.argv;

if (cmd && /^\d?\d?\.?\d*(R|YR|Y|GY|G|BG|B|PB|P|RP)$/.test(cmd)) {
  const table = loadRenotation();
  const key = `${cmd} ${+rest[0]}/${+rest[1]}`;
  const e = table.get(key);
  if (!e) { console.error(`no such notation: ${key}`); process.exit(1); }
  const c = munsellToSrgb(e);
  console.log(`${key}  ->  ${c.hex}  rgb(${c.rgb.join(', ')})${c.clipped ? '  [CLAMPED — outside sRGB]' : ''}`);
  console.log(`   xyY  x=${e.x} y=${e.y} Y=${e.Y}`);
  process.exit(0);
}

const { out, warnings } = build();

for (const w of warnings) console.error(`  warn  ${w}`);

const rows = [...Object.entries(out.categories), ...Object.entries(out.surfaces)];
for (const [k, v] of rows) {
  const t = v.hi || v.lo ? `  hi ${(v.hi?.hex) || '  —    '} ${(v.hi?.notation || '').padEnd(10)} lo ${(v.lo?.hex) || '  —    '} ${(v.lo?.notation || '').padEnd(10)}` : '';
  console.log(`  ${k.padEnd(9)} ${v.notation.padEnd(10)} ${v.hex}${t}  ${v.clipped ? 'CLAMPED ' : ''}${v.note}`);
}

if (cmd === 'check') {
  console.log(`\n  ${rows.length} colours, ${warnings.length} warning(s)`);
  process.exit(warnings.some(w => w.includes('not in the renotation')) ? 1 : 0);
}

writeFileSync(join(root, 'data/palette.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\n  wrote data/palette.json — ${rows.length} colours derived, ${warnings.length} warning(s)`);
