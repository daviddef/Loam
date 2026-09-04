/*
 * conditions.mjs — what goes wrong that nothing caught, and what answers it.
 *
 * The pathogen catalogue joined quinine to malaria and left thirty things
 * tagged `medicine` joined to nothing at all: thyroxine, digoxin, insulin,
 * aspirin, morphine, oxytocin, vitamin C. None of them answers an organism.
 * They answer a gland that has stopped, a pump that cannot keep up, a diet
 * missing one molecule, a nerve doing what it is supposed to do too well.
 *
 * That is a different catalogue with the same shape, and keeping it separate
 * is the point rather than an accident of filing: a pathogen has a genome, a
 * reservoir and a route of transmission, and a condition has none of those.
 * Forcing both into one schema would mean half the fields were empty in every
 * row and the empty half would stop meaning anything.
 *
 * The two rules carry over unchanged, and are enforced here the same way:
 *
 *   Seriousness is a SOURCED NUMBER, never an adjective, and states its basis.
 *   Untreated type 1 diabetes and treated type 1 diabetes are the same disease
 *   and different numbers, and which one is meant has to be on the page.
 *
 *   Nothing here is a method. This says what goes wrong and what is known to
 *   help; it is not a dose, a protocol, or advice, and no field invites one.
 *
 * Modes:
 *   node tools/conditions.mjs            coverage by kind
 *   node tools/conditions.mjs --gaps     what to author next
 *   node tools/conditions.mjs --orphans  therapies still joined to nothing
 *   node tools/conditions.mjs --rank     by sourced seriousness
 *   node tools/conditions.mjs <id>       one entry in full
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
const elements = J('elements.json');
const byId = Object.fromEntries(elements.map(e => [e.id, e]));
const cat = J('conditions.json');
const C = cat.conditions;
const pathogens = J('pathogens.json').pathogens;

const KINDS = ['deficiency', 'genetic', 'metabolic', 'degenerative', 'inflammatory',
               'circulatory', 'toxic', 'environmental', 'neoplastic', 'physiological'];

const errs = [];
const idsIn = (v, where, id) => (v ?? []).forEach(x => {
  if (!byId[x]) errs.push(`${id}: ${where} names ${x}, which is not an element`);
});
for (const [id, c] of Object.entries(C)) {
  if (!byId[id]) errs.push(`${id}: not an element`);
  if (!KINDS.includes(c.kind)) errs.push(`${id}: kind "${c.kind}" is not one of ${KINDS.join('/')}`);
  if (pathogens[id]) errs.push(`${id}: is in the pathogen catalogue too — one thing, one catalogue`);
  idsIn(c.treated_by, 'treated_by', id);
  idsIn(c.prevented_by, 'prevented_by', id);
  idsIn(c.affects, 'affects', id);
  const s = c.seriousness;
  if (!s) errs.push(`${id}: no seriousness`);
  else {
    if (typeof s.value !== 'number') errs.push(`${id}: seriousness.value is not a number — an adjective will not rank`);
    if (!s.measure) errs.push(`${id}: seriousness has no stated basis`);
    if (!/^https:\/\//.test(s.src ?? '')) errs.push(`${id}: seriousness has no source URL`);
  }
  if (!c.mechanism) errs.push(`${id}: no mechanism — a name and a symptom list is a label, not an entry`);
  if (!/^https:\/\//.test(c.src ?? '')) errs.push(`${id}: no source URL`);
}
if (errs.length) {
  console.error(`\n  ${errs.length} error(s) in data/conditions.json:\n`);
  errs.slice(0, 40).forEach(e => console.error('    x ' + e));
  process.exit(1);
}

const arg = process.argv[2];
const nameOf = id => byId[id]?.name ?? id;
const bar = (n, of, w = 20) => '#'.repeat(Math.round(w * n / (of || 1))).padEnd(w, '·');

if (arg && !arg.startsWith('--')) {
  const c = C[arg];
  if (!c) { console.error(`  ${arg} is not in the catalogue`); process.exit(1); }
  const line = (k, v) => v && console.log(`  ${k.padEnd(14)} ${v}`);
  console.log(`\n${nameOf(arg)} — ${c.kind}\n`);
  line('affects', (c.affects ?? []).map(nameOf).join(', '));
  line('mechanism', c.mechanism);
  line('symptoms', (c.symptoms ?? []).join(', '));
  line('seriousness', `${c.seriousness.value} — ${c.seriousness.measure}`);
  line('treated by', (c.treated_by ?? []).map(nameOf).join(', ') || 'nothing in the corpus');
  line('prevented by', (c.prevented_by ?? []).map(nameOf).join(', ') || '—');
  console.log(`\n  ${c.src}\n  ${c.seriousness.src}\n`);
  process.exit(0);
}

if (arg === '--rank') {
  const rows = Object.entries(C).sort((a, b) => b[1].seriousness.value - a[1].seriousness.value);
  console.log('\nRANKED BY SOURCED SERIOUSNESS — the basis differs, and is stated\n');
  for (const [id, c] of rows) {
    const t = (c.treated_by ?? []).length ? '' : '   (nothing treats it)';
    console.log(`  ${String(c.seriousness.value).padStart(6)}  ${nameOf(id).padEnd(28)} ${c.seriousness.measure}${t}`);
  }
  console.log(`\n  ${rows.length} in the catalogue\n`);
  process.exit(0);
}

/* ── the whole reason this file exists ─────────────────────────────────────
 * Both catalogues answer the same question — what is this thing FOR — so the
 * orphan check has to read both. Counting only one is how the pathogen tool
 * came to report that quinine answered nothing when it plainly did.
 *
 * And a therapy is not the same as the building it happens in. `medicine` is
 * the medical DOMAIN tag: it holds hospital, ward, nurse, syringe, bandage
 * and diagnosis alongside insulin and morphine. Listing a ward as a treatment
 * joined to nothing is true and useless, so care and cure are counted apart.
 */
if (arg === '--orphans') {
  const answered = new Set([
    ...Object.values(C).flatMap(c => [...(c.treated_by ?? []), ...(c.prevented_by ?? [])]),
    ...Object.values(pathogens).flatMap(p => [...(p.treated_by ?? []), ...(p.prevented_by ?? [])]),
  ]);
  // Anything the catalogues already account for is not an unjoined therapy:
  // the conditions and organisms themselves, the diseases they cause, and the
  // organs they act on. The thyroid is a gland, and listing it as a treatment
  // that answers nothing is true in the letter and nonsense in the substance.
  const named = new Set([
    ...Object.keys(C), ...Object.keys(pathogens),
    ...Object.values(pathogens).flatMap(p => p.causes ?? []),
    ...Object.values(C).flatMap(c => c.affects ?? []),
  ]);
  const CARE = new Set(cat.care ?? []);
  const med = elements.filter(e => (e.tags ?? []).includes('medicine')).map(e => e.id);
  const rest = med.filter(m => !answered.has(m) && !named.has(m));
  const care = rest.filter(m => CARE.has(m));
  const cure = rest.filter(m => !CARE.has(m));
  console.log(`\n${cure.length} THERAPIES JOINED TO NOTHING\n`);
  cure.forEach(m => console.log(`  ${nameOf(m)}`));
  console.log(`\n${care.length} declared care rather than cure, and correctly joined to nothing\n`);
  console.log('  ' + care.map(nameOf).join(', '));
  console.log();
  process.exit(0);
}

if (arg === '--gaps') {
  const rows = (cat.wanted ?? []).filter(w => !C[w]);
  console.log(`\nTO AUTHOR — ${rows.length}\n`);
  rows.forEach(id => console.log(`  ${id.padEnd(30)} ${byId[id] ? 'element exists, not catalogued' : 'no element yet'}`));
  console.log();
  process.exit(0);
}

console.log('\nWHAT GOES WRONG THAT NOTHING CAUGHT\n');
const n = Object.keys(C).length;
const owed = (cat.wanted ?? []).filter(w => !C[w]).length;
console.log(`  ${bar(n, n + owed)}  ${n}/${n + owed}  catalogued\n`);
for (const k of KINDS) {
  const c = Object.values(C).filter(x => x.kind === k).length;
  if (c) console.log(`  ${String(c).padStart(3)}  ${k}`);
}
const withT = Object.values(C).filter(c => (c.treated_by ?? []).length).length;
console.log(`\n  ${withT} have something that treats them, ${n - withT} have nothing`);
console.log(`\n  node tools/conditions.mjs --orphans   for therapies still joined to nothing\n`);
