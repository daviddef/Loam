#!/usr/bin/env node
/**
 * categories.mjs — is every element filed somewhere a person would look for it?
 *
 * The other mechanisms ask whether a fact is true. This one asks whether it is
 * FINDABLE, which is a different failure and a quieter one: a correct, sourced,
 * beautifully drawn element that lands in a drawer called Other is, from the
 * player's side, missing.
 *
 * It exists because the family table used to live inside the renderer, where no
 * tool could reach it. One element in seven fell through it and nothing counted
 * them. The table now lives in data/families.json and both the game and this
 * checker read it, so the two cannot disagree about what a category is.
 *
 * What it checks
 *   1. VOCABULARY   every tag on every element is in families.json
 *   2. ORPHANS      how many elements reach the catch-all, and via which tags
 *   3. AMBIGUITY    elements matching two families — a question not yet answered
 *   4. DEPRECATED   near-twin tags still in use, counted down
 *   5. THIN         families so small they are not worth a drawer
 *   6. EVIDENCE     a tag contradicted by the element's own taxon or scale
 *
 * Check 6 is the one that finds real mistakes rather than tidiness. Scale and
 * taxonomy are authored independently of tags, so when they disagree with a tag
 * one of the three is wrong and it is worth knowing which.
 *
 *   node tools/categories.mjs             the summary
 *   node tools/categories.mjs --orphans   every element in Other, by tag
 *   node tools/categories.mjs --evidence  every tag its own data contradicts
 *   node tools/categories.mjs --family <id>   what is in one drawer
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const arr = (d) => Array.isArray(d) ? d : (d.elements || []);

const elements = arr(read('data/elements.json'));
const FAM = read('data/families.json');
const scale = read('data/scale.json');
const taxonomy = read('data/taxonomy.json');

const FAMILIES = FAM.families;
const OTHER = FAMILIES[FAMILIES.length - 1];
const vocab = new Map();
for (const f of FAMILIES) for (const t of f.tags) {
  if (vocab.has(t)) console.error(`  !! tag "${t}" is claimed by both ${vocab.get(t).id} and ${f.id}`);
  vocab.set(t, f);
}

const mode = process.argv[2];
const bar = (a, b) => { const w = 20, k = b ? Math.round(a / b * w) : 0; return '#'.repeat(k) + '·'.repeat(w - k); };
const n = (x) => x.toLocaleString('en-GB');

/** First match wins, folklore always myth — the same rule the game applies. */
function familyOf(e) {
  if (e.shelf === 'folklore') return FAMILIES[0];
  return FAMILIES.find(f => f.tags.length && e.tags.some(t => f.tags.includes(t))) || OTHER;
}
/** Every family an element could have gone to, not just the one it did. */
function allFamilies(e) {
  if (e.shelf === 'folklore') return [FAMILIES[0]];
  return FAMILIES.filter(f => f.tags.length && e.tags.some(t => f.tags.includes(t)));
}

// ------------------------------------------------------------- 1 vocabulary
const unknown = new Map();
for (const e of elements) for (const t of (e.tags || [])) {
  if (!vocab.has(t)) { if (!unknown.has(t)) unknown.set(t, []); unknown.get(t).push(e.id); }
}

// ---------------------------------------------------------------- 2 orphans
const counts = new Map(FAMILIES.map(f => [f.id, 0]));
const orphans = [];
for (const e of elements) {
  const f = familyOf(e);
  counts.set(f.id, counts.get(f.id) + 1);
  if (f.id === 'other') orphans.push(e);
}

// -------------------------------------------------------------- 3 ambiguity
const ambiguous = elements.filter(e => allFamilies(e).length > 1);

// ------------------------------------------------------------- 4 deprecated
const deprecatedUse = new Map();
for (const e of elements) for (const t of (e.tags || [])) {
  if (FAM.deprecated[t]) {
    if (!deprecatedUse.has(t)) deprecatedUse.set(t, []);
    deprecatedUse.get(t).push(e.id);
  }
}

// --------------------------------------------------------------- 6 evidence
/* A tag is contradicted when the element's own independently-authored scale or
 * taxon says something incompatible. These are stated as physical facts, not
 * preferences: an animal is not 10⁻⁹ m across, and a plant is not in Animalia.
 * Anything this reports is a genuine three-way disagreement between tag, scale
 * and taxonomy, and exactly one of the three is wrong. */
const KINGDOM_OF = (() => {
  /* taxonomy.groups is an ARRAY of objects carrying their own id, not a map
   * keyed by it. Reading it with Object.entries yields array indices, which
   * match no element's taxon, which made every taxon rule below silently pass
   * on every element. It is the exact shape of fault this file exists to catch,
   * and it went unnoticed for one run because a check that never fires and a
   * check that finds nothing print the same thing. */
  const g = new Map(taxonomy.groups.map(x => [x.id, x]));
  return (t) => {
    let c = g.get(t), hop = 0;
    while (c && c.rank !== 'kingdom' && hop++ < 20) c = g.get(c.parent);
    return c ? c.name : null;
  };
})();

const EVIDENCE = [
  { tag: 'animal', test: (e, s) => s != null && s <= -7,
    why: 'tagged animal but sized below 10⁻⁷ m — that is a molecule, not a creature' },
  { tag: 'plant', test: (e, s, k) => k === 'Animalia',
    why: 'tagged plant but its taxon sits in Animalia' },
  { tag: 'animal', test: (e, s, k) => k === 'Plantae',
    why: 'tagged animal but its taxon sits in Plantae' },
  { tag: 'microbe', test: (e, s, k) => s != null && s >= 0 && k !== 'Fungi',
    why: 'tagged microbe but sized at a metre or more — not an organism you need a lens for' },
  { tag: 'microbe', test: (e, s) => s != null && s <= -8,
    why: 'tagged microbe but sized below 10\u207B\u2078 m — that is a molecule, not an organism' },
  { tag: 'plant', test: (e, s) => s != null && s <= -7,
    why: 'tagged plant but sized below 10\u207B\u2077 m — that is a molecule' },
  { tag: 'tool', test: (e, s) => s != null && s <= -8,
    why: 'tagged tool but sized below 10\u207B\u2078 m — nothing that small is held' },
  { tag: 'metal', test: (e, s, k) => !!k,
    why: 'tagged metal but carries a biological taxon' },
  { tag: 'wild', test: (e) => e.tags.includes('crop'),
    why: 'tagged both wild and crop — a plant is one or the other in this corpus' },
];
const danglingTaxon = elements.filter(e => e.taxon && !taxonomy.groups.some(g => g.id === e.taxon));
const contradicted = [];
for (const e of elements) {
  const s = scale[e.id]?.e;
  const k = e.taxon ? KINGDOM_OF(e.taxon) : null;
  for (const rule of EVIDENCE) {
    if (e.tags.includes(rule.tag) && rule.test(e, s, k)) contradicted.push({ id: e.id, why: rule.why });
  }
}

// ------------------------------------------------------------------- output

if (mode === '--orphans') {
  const byTag = new Map();
  for (const e of orphans) for (const t of e.tags) {
    if (!byTag.has(t)) byTag.set(t, []); byTag.get(t).push(e.id);
  }
  console.log(`\n${n(orphans.length)} ELEMENT(S) IN "OTHER", BY THE TAG THAT PUT THEM THERE\n`);
  for (const [t, ids] of [...byTag].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${t}  (${ids.length})`);
    for (let i = 0; i < ids.length; i += 8) console.log('    ' + ids.slice(i, i + 8).join(' '));
  }
  process.exit(0);
}
if (mode === '--evidence') {
  console.log(`\n${n(contradicted.length)} TAG(S) CONTRADICTED BY THE ELEMENT'S OWN SCALE OR TAXON\n`);
  for (const c of contradicted) console.log(`  ${c.id.padEnd(30)} ${c.why}`);
  process.exit(0);
}
if (mode === '--family') {
  const want = process.argv[3];
  const f = FAMILIES.find(x => x.id === want);
  if (!f) { console.error(`no family "${want}". Try: ${FAMILIES.map(x => x.id).join(' ')}`); process.exit(1); }
  const inIt = elements.filter(e => familyOf(e).id === want);
  console.log(`\n${f.name} — ${n(inIt.length)} element(s)\n  ${f.note}\n`);
  for (let i = 0; i < inIt.length; i += 6) console.log('  ' + inIt.slice(i, i + 6).map(e => e.id).join(' '));
  process.exit(0);
}

console.log('\nEVERY ELEMENT IN A DRAWER SOMEBODY WOULD OPEN\n');
const widest = Math.max(...FAMILIES.map(f => f.name.length));
for (const f of FAMILIES) {
  const c = counts.get(f.id);
  const flag = f.id === 'other' ? (c ? '  <- nobody looks here' : '') : (c < 10 && c > 0 ? '  <- thin' : c === 0 ? '  <- empty' : '');
  console.log(`  ${bar(c, elements.length)}  ${String(n(c)).padStart(5)}   ${f.name.padEnd(widest)}${flag}`);
}
console.log(`\n  ${n(elements.length - counts.get('other'))} of ${n(elements.length)} elements filed ` +
  `(${Math.round((elements.length - counts.get('other')) / elements.length * 100)}%), across ${FAMILIES.length - 1} drawers`);

let fatal = 0;
if (unknown.size) {
  fatal += unknown.size;
  console.log(`\nTAG(S) IN NO FAMILY — these are errors, not new categories:`);
  for (const [t, ids] of [...unknown].sort((a, b) => b[1].length - a[1].length))
    console.log(`  ✗ ${t.padEnd(16)} ${ids.length} element(s): ${ids.slice(0, 6).join(' ')}${ids.length > 6 ? ' …' : ''}`);
}
if (counts.get('other')) {
  console.log(`\n  ${n(counts.get('other'))} element(s) reach the catch-all — node tools/categories.mjs --orphans`);
}
if (deprecatedUse.size) {
  console.log(`\nNEAR-TWIN TAGS STILL AUTHORED — same drawer, two words:`);
  for (const [t, ids] of [...deprecatedUse].sort((a, b) => b[1].length - a[1].length))
    console.log(`  · ${t} → ${FAM.deprecated[t]}   ${ids.length} element(s)`);
}
if (ambiguous.length) {
  console.log(`\n  ${n(ambiguous.length)} element(s) match more than one drawer and were filed by order.`);
  console.log(`  Not a bug — a tagging question nobody has answered. First five:`);
  for (const e of ambiguous.slice(0, 5))
    console.log(`    ${e.id.padEnd(24)} ${allFamilies(e).map(f => f.id).join(' | ')}`);
}
if (danglingTaxon.length) {
  fatal += danglingTaxon.length;
  console.log(`\n  ✗ ${n(danglingTaxon.length)} element(s) point at a taxonomic group that does not exist:`);
  for (const e of danglingTaxon.slice(0, 8)) console.log(`      ${e.id} → ${e.taxon}`);
}
if (contradicted.length) {
  console.log(`\n  ${n(contradicted.length)} tag(s) contradicted by the element's own scale or taxon.`);
  console.log(`  node tools/categories.mjs --evidence`);
}
console.log();
process.exit(fatal ? 1 : 0);
