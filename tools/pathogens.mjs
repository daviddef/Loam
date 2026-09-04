/*
 * pathogens.mjs — the catalogue of things that cause disease, and what answers
 * them.
 *
 * The corpus had quinine and it had malaria, and nothing in it knew the two
 * were related. It had forty-five named pathogens with proper binomial taxa and
 * forty-three things tagged `medicine`, sitting in the same data file, joined by
 * nothing. This file is the join — and, because a join is only worth what its
 * facts are worth, it is also where the claims about each organism live.
 *
 * A pathogen entry is NOT a recipe. Recipes are the game's two-input grammar and
 * say how a thing is derived. This says what an organism is, what it does, how
 * bad it is, and what answers it — the unbounded honest answer, the way
 * needs.json is the unbounded honest answer to "what goes into one".
 *
 * Two rules the file exists to enforce:
 *
 *   Seriousness is a SOURCED NUMBER, never an adjective. "Serious" is an
 *   opinion and would rank the catalogue by how frightening a thing sounded
 *   when it was written up. A case fatality rate with a stated basis is a fact
 *   somebody can check and, where the basis differs — untreated vs treated,
 *   bubonic vs pneumonic — the basis is stated, because the same organism has
 *   several true numbers and they differ by an order of magnitude.
 *
 *   Nothing here is a method. The game explains how these things work; it does
 *   not explain how to obtain, culture, or spread them, and no field in this
 *   schema invites it. This is the same line cautions.json draws.
 *
 * Modes:
 *   node tools/pathogens.mjs              coverage across kingdoms and kinds
 *   node tools/pathogens.mjs --gaps       what to author next, most-wanted first
 *   node tools/pathogens.mjs --orphans    treatments joined to nothing, and
 *                                         diseases with no organism behind them
 *   node tools/pathogens.mjs --rank       the catalogue by sourced seriousness
 *   node tools/pathogens.mjs <id>         one entry in full
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
const elements = J('elements.json');
const byId = Object.fromEntries(elements.map(e => [e.id, e]));
const cat = J('pathogens.json');
const P = cat.pathogens;

const KINDS = ['virus', 'bacterium', 'fungus', 'oomycete', 'protozoan', 'helminth', 'prion'];
const HOSTS = ['human', 'animal', 'plant'];

/* ── the checks, which run in every mode ──────────────────────────────────
 * A catalogue that points at ids the corpus does not have is worse than no
 * catalogue: it reads as coverage and is not. So this is fatal, not a warning.
 */
const errs = [];
const idsIn = (v, where, id) => (v ?? []).forEach(x => {
  if (!byId[x]) errs.push(`${id}: ${where} names ${x}, which is not an element`);
});
for (const [id, p] of Object.entries(P)) {
  if (!byId[id]) errs.push(`${id}: not an element`);
  if (!KINDS.includes(p.kind)) errs.push(`${id}: kind "${p.kind}" is not one of ${KINDS.join('/')}`);
  for (const h of p.hosts ?? []) if (!HOSTS.includes(h)) errs.push(`${id}: host "${h}" is not one of ${HOSTS.join('/')}`);
  if (!p.hosts?.length) errs.push(`${id}: no host kingdom`);
  idsIn(p.causes, 'causes', id);
  idsIn(p.treated_by, 'treated_by', id);
  idsIn(p.prevented_by, 'prevented_by', id);
  const s = p.seriousness;
  if (!s) errs.push(`${id}: no seriousness`);
  else {
    if (typeof s.value !== 'number') errs.push(`${id}: seriousness.value is not a number — an adjective will not rank`);
    if (!s.measure) errs.push(`${id}: seriousness has no stated basis`);
    if (!/^https:\/\//.test(s.src ?? '')) errs.push(`${id}: seriousness has no source URL`);
  }
  if (!/^https:\/\//.test(p.src ?? '')) errs.push(`${id}: no source URL`);
}
if (errs.length) {
  console.error(`\n  ${errs.length} error(s) in data/pathogens.json:\n`);
  errs.slice(0, 40).forEach(e => console.error('    x ' + e));
  if (errs.length > 40) console.error(`    ... and ${errs.length - 40} more`);
  process.exit(1);
}

const arg = process.argv[2];
const bar = (n, of, w = 20) => '#'.repeat(Math.round(w * n / (of || 1))).padEnd(w, '·');
const nameOf = id => byId[id]?.name ?? id;

/* ── one entry ─────────────────────────────────────────────────────────── */
if (arg && !arg.startsWith('--')) {
  const p = P[arg];
  if (!p) { console.error(`  ${arg} is not in the catalogue`); process.exit(1); }
  const line = (k, v) => v && console.log(`  ${k.padEnd(14)} ${v}`);
  console.log(`\n${nameOf(arg)} — ${p.kind}\n`);
  line('taxon', byId[arg]?.taxon ?? '');
  line('hosts', p.hosts.join(', '));
  line('causes', (p.causes ?? []).map(nameOf).join(', '));
  line('transmission', p.transmission);
  line('reservoir', p.reservoir);
  line('makeup', p.makeup);
  line('durability', p.durability);
  line('symptoms', (p.symptoms ?? []).join(', '));
  line('seriousness', `${p.seriousness.value} — ${p.seriousness.measure}`);
  line('treated by', (p.treated_by ?? []).map(nameOf).join(', ') || 'nothing in the corpus');
  line('prevented by', (p.prevented_by ?? []).map(nameOf).join(', ') || '—');
  console.log(`\n  ${p.src}\n  ${p.seriousness.src}\n`);
  process.exit(0);
}

/* ── the catalogue ranked by a number somebody can check ───────────────── */
if (arg === '--rank') {
  const rows = Object.entries(P).sort((a, b) => b[1].seriousness.value - a[1].seriousness.value);
  console.log('\nRANKED BY SOURCED SERIOUSNESS — the basis differs, and is stated\n');
  for (const [id, p] of rows) {
    const t = (p.treated_by ?? []).length ? '' : '   (nothing treats it)';
    console.log(`  ${String(p.seriousness.value).padStart(6)}  ${nameOf(id).padEnd(30)} ${p.seriousness.measure}${t}`);
  }
  console.log(`\n  ${rows.length} in the catalogue\n`);
  process.exit(0);
}

/* ── what is joined to nothing ─────────────────────────────────────────── */
if (arg === '--orphans') {
  // This counted only THIS catalogue's treatments and took the whole `medicine`
  // tag as therapies, so it reported wards as unjoined treatments and Ebola as
  // a treatment. conditions.mjs owns the question now, because answering it
  // needs both catalogues; running half of it was worse than not running it.
  console.log('\n  Both catalogues answer this, so it lives in one place:\n');
  console.log('    node tools/conditions.mjs --orphans\n');
  process.exit(0);
}
if (arg === '--orphans-old') {
  const treats = new Set(Object.values(P).flatMap(p => [...(p.treated_by ?? []), ...(p.prevented_by ?? [])]));
  const meds = elements.filter(e => (e.tags ?? []).includes('medicine')).map(e => e.id);
  const unusedMeds = meds.filter(m => !treats.has(m));
  const caused = new Set(Object.values(P).flatMap(p => p.causes ?? []));
  const diseaseish = elements.filter(e =>
    /(itis|osis|iasis|emia|aemia|pox|fever|disease|syndrome|plague|blight|wilt|mildew|smut|canker|rot)$/.test(e.id)
    && !caused.has(e.id)
    && !/(mitosis|meiosis|osmosis|apoptosis|symbiosis|endosymbiosis|endocytosis|exocytosis|phagocytosis|pinocytosis|metamorphosis|diagnosis|carrot|parrot)$/.test(e.id));
  console.log(`\n${unusedMeds.length} TREATMENTS JOINED TO NOTHING\n`);
  unusedMeds.forEach(m => console.log(`  ${nameOf(m)}`));
  console.log(`\n${diseaseish.length} DISEASES WITH NO ORGANISM BEHIND THEM\n`);
  diseaseish.slice(0, 60).forEach(d => console.log(`  ${nameOf(d.id)}`));
  if (diseaseish.length > 60) console.log(`  ... and ${diseaseish.length - 60} more`);
  console.log();
  process.exit(0);
}

/* ── what to author next ───────────────────────────────────────────────── */
if (arg === '--gaps') {
  const want = cat.wanted ?? {};
  const rows = [];
  for (const [host, list] of Object.entries(want)) {
    for (const w of list) {
      const id = typeof w === 'string' ? w : w.id;
      if (!P[id]) rows.push([host, id, byId[id] ? 'element exists, not catalogued' : 'no element yet']);
    }
  }
  console.log(`\nTO AUTHOR — ${rows.length}, by kingdom\n`);
  let last = null;
  for (const [host, id, state] of rows.sort()) {
    if (host !== last) { console.log(`  ${host.toUpperCase()}`); last = host; }
    console.log(`    ${id.padEnd(32)} ${state}`);
  }
  console.log();
  process.exit(0);
}

/* ── coverage ──────────────────────────────────────────────────────────── */
console.log('\nWHAT CAUSES DISEASE, AND WHAT ANSWERS IT\n');
const n = Object.keys(P).length;
for (const h of HOSTS) {
  const have = Object.values(P).filter(p => p.hosts.includes(h)).length;
  // `wanted` is a to-author list, so the ambition is what is held plus what is
  // still owed — not the size of the backlog, which would show 100% when the
  // backlog emptied and nothing had been written.
  const owed = (cat.wanted?.[h] ?? []).filter(w => !P[typeof w === 'string' ? w : w.id]).length;
  const of = have + owed;
  console.log(`  ${bar(have, of)}  ${String(have).padStart(3)}/${String(of).padEnd(3)}  ${h}`);
}
console.log();
for (const k of KINDS) {
  const c = Object.values(P).filter(p => p.kind === k).length;
  if (c) console.log(`  ${String(c).padStart(3)}  ${k}`);
}
const withT = Object.values(P).filter(p => (p.treated_by ?? []).length).length;
const withV = Object.values(P).filter(p => (p.prevented_by ?? []).length).length;
console.log(`\n  ${n} catalogued`);
console.log(`  ${withT} have something that treats them, ${n - withT} have nothing`);
console.log(`  ${withV} have something that prevents them`);
console.log(`\n  node tools/pathogens.mjs --gaps   to see what to author next\n`);
