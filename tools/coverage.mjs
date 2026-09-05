#!/usr/bin/env node
/* HOW MUCH OF THE CORPUS HAS EACH MECHANISM ACTUALLY SEEN?
 *
 * Every other tool here answers "is what I looked at sound?". None of them
 * answers "how much did I look at?", and the difference between those two
 * questions is how a run of nineteen green checks can sit on top of a corpus
 * where one mechanism has covered four per cent of what it was built for.
 *
 * That is not hypothetical. On 5 Sep every gate reported clean while:
 *   - needs.mjs, whose own brief was "apply that mechanism to each item in our
 *     corpus and keep iterating", had 76 lists against roughly 1,900 artefacts;
 *   - the source audit had never examined 5,974 recipes, because it only looks
 *     at recipes whose prose contains a digit;
 *   - the homonym review had read 298 of 1,676 eligible names.
 *
 * A green check on a sample is not a green check on a corpus. This file exists
 * so nobody has to ask which kind they are looking at.
 *
 * DENOMINATORS ARE THE WHOLE POINT. Each one below is the population the
 * mechanism is *supposed* to cover, not the population it happens to have
 * touched, and where the denominator is itself authored — the places checklist
 * — this says so, because a hand-written list that has been fully answered has
 * stopped measuring anything at all.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, 'data', p), 'utf8'));
const has = (p) => existsSync(join(ROOT, 'data', p));

const elements = read('elements.json');
const recipes = read('recipes.json');
const byId = new Map(elements.map(e => [e.id, e]));

const madeBy = new Map();
const uses = new Map();
for (const r of recipes) {
  if (!madeBy.has(r.out)) madeBy.set(r.out, []);
  madeBy.get(r.out).push(r);
  for (const i of r.in) uses.set(i, (uses.get(i) || 0) + 1);
}
const assembled = (id) => (madeBy.get(id) || []).some(r => r.in.length >= 2);

/* An artefact is a made thing somebody could write a parts list for. A rock is
 * not one; a wheel is. The tag set is the corpus's own. */
/* Use needs.mjs's OWN definition of an assembly, not a second broader one.
 * This row previously read a wider tag set and counted every bevel, weld and
 * voussoir as owing a parts list, which put the backlog at 1,927 and made the
 * sweep look endless. Two tools disagreeing about a denominator is how a
 * coverage number stops meaning anything. */
const MADE = new Set(['tool', 'build', 'dish', 'trade', 'instrument', 'medicine', 'transport', 'machine']);
const NOT_ASSEMBLY = new Set(has('needs.json') ? (read('needs.json').$not_assemblies || []) : []);
const NEEDS_SKIP = new Set(has('needs.json') ? (read('needs.json').$scope_exclude_tags || []) : []);
const PLACE_IDS = has('places.json') ? new Set(Object.keys(read('places.json').places)) : new Set();
const artefacts = elements.filter(e => assembled(e.id) && !NOT_ASSEMBLY.has(e.id)
                                    && !PLACE_IDS.has(e.id)
                                    && !(e.tags || []).some(t => NEEDS_SKIP.has(t))
                                    && (e.tags || []).some(t => MADE.has(t)));

const rows = [];
const add = (name, seen, total, note, authored = false) =>
  rows.push({ name, seen, total, note, authored });

/* Art is the one row that is a BACKLOG rather than a gap: every element always
 * renders, because an element with no def() of its own is drawn from its
 * family. That is why artwork must never gate a batch of research — and why it
 * needs counting here, since a family fallback looks like a finished drawing
 * and will otherwise sit unnoticed forever. */
if (has('art-pending.json')) {
  const ap = read('art-pending.json');
  add('art hand-drawn', ap.hand_drawn, elements.length,
      'the rest render from their family — a backlog, not a blocker');
}

add('validate', elements.length, elements.length, 'every element, every run');
add('categories', elements.length, elements.length, 'every element, every run');
/* Counted, not assumed. This row said 100% while 94 newly authored elements had
 * no scale entry at all, because it was reporting elements.length over itself —
 * a hardcoded pass inside the one tool whose entire job is to refuse those. */
{
  const scale = has('scale.json') ? read('scale.json') : {};
  const sized = elements.filter(e => scale[e.id] !== undefined).length;
  add('scale', sized, elements.length, 'every element needs a size; the build refuses without one');
}
add('art check', elements.length, elements.length, 'every drawing, every run');
add('graph', elements.length, elements.length, 'reachability from the four starters');
add('verbs', recipes.length, recipes.length, 'every recipe, every run');
add('redundancy', recipes.length, recipes.length, 'every gesture, every run');

if (has('needs.json')) {
  const needs = read('needs.json').needs || {};
  /* The numerator has to be a SUBSET of the denominator or the ratio is a
   * fiction. 33 lists sit on things outside it — house, bicycle, cheese — which
   * are worth having and are not what this row measures. */
  const onScope = artefacts.filter(e => needs[e.id]).length;
  const off = Object.keys(needs).length - onScope;
  add('needs', onScope, artefacts.length,
      `assemblies with a parts list (+${off} lists on things outside this scope)`);
}
if (has('homonyms.json')) {
  const h = read('homonyms.json');
  const seen = new Set([...h.watch.map(w => w.id), ...h.cleared]);
  const eligible = elements.filter(e => /^[A-Za-z]+$/.test(e.id) && (uses.get(e.id) || 0) >= 2);
  add('homonyms', eligible.filter(e => seen.has(e.id)).length, eligible.length,
      'single-word names used by two or more recipes');
}
if (has('roles.json')) {
  const roles = read('roles.json').roles || {};
  add('roles', Object.keys(roles).length, elements.length,
      'what each noun is to a making — drives places.mjs and roles.mjs --derives');
}
/* The audit only ever looks at a recipe whose prose carries a number, because a
 * number is the part of a sentence a source can be checked against mechanically.
 * That is a defensible design and it is also a coverage ceiling, and the ceiling
 * has never been stated anywhere the reader could see it. */
const numeric = recipes.filter(r => /\d/.test(r.why || '') || r.at != null);
add('source audit', numeric.length, recipes.length,
    'only recipes whose prose contains a number');
add('  verified flag', recipes.filter(r => r.verified).length, recipes.length,
    'recipes a person has marked checked');

if (has('places.json')) {
  const P = read('places.json');
  const wanted = Object.values(P.wanted).flat().length;
  /* This row read 334/334 for weeks and was worth nothing, because the list it
   * measured against was written by the same hand that answered it. 111 lines
   * now come from the Chronicarum catalogue instead — externally owned, like
   * the UN M49 regions above them — so the denominator can disagree with us. */
  /* Read the number tools/places.mjs published rather than matching names a
   * second way. Reimplementing it here got 437 where places.mjs gets 442. */
  const pc = has('places-coverage.json') ? read('places-coverage.json') : null;
  add('places checklist', pc ? pc.satisfied : 0, pc ? pc.wanted : wanted,
      'part authored, part external (Chronicarum) — a denominator that can disagree');
}
if (has('cautions.json')) {
  const c = read('cautions.json').hazards || {};
  const covered = new Set(Object.values(c).flatMap(x => x.ids || []));
  /* Not a shortfall: most elements are not hazardous and must never carry a
   * caution. This line is here so the number is visible, not so it grows. */
  add('hazard cautions', covered.size, elements.length,
      'elements carrying a caution — NOT a target, most should have none', true);
}

/* IS THE SWEEP CONVERGING, OR IS IT A TREADMILL?
 *
 * Authoring closes gaps and opens them. The 94 components authored on 5 Sep
 * closed 94 holes in other things' parts lists and were themselves 94 new
 * elements needing art, sense checks and — for some of them — parts lists of
 * their own. A single percentage cannot tell you whether that is progress.
 *
 * So each run appends a snapshot, and the next run prints the movement. A row
 * whose numerator climbs faster than its denominator is converging. A row where
 * both climb together is a treadmill, and the honest response to a treadmill is
 * to fix the denominator — which is exactly what $not_assemblies did when this
 * row read 1,927 and counted every bevel and weld as owing a bill of materials.
 *
 * The log is data, not a gate. Nothing fails because a number moved. */
const LOG = join(ROOT, 'data', 'coverage-log.json');
let log = [];
try { log = JSON.parse(readFileSync(LOG, 'utf8')); } catch {}
const prev = log.length ? log[log.length - 1] : null;
const stamp = new Date().toISOString().slice(0, 10);

/* --history: the whole log, one line per snapshot per partial row. A single
 * delta answers "did that batch help?"; the history answers the harder
 * question, which is whether the sweep converges at all. */
if (process.argv[2] === '--history') {
  const names = [...new Set(log.flatMap(s => Object.keys(s.rows)))]
    .filter(nm => log.some(s => s.rows[nm] && s.rows[nm].seen < s.rows[nm].total));
  console.log(`\nCOVERAGE OVER TIME — ${log.length} snapshot(s)\n`);
  for (const nm of names) {
    console.log(`  ${nm}`);
    let last = null;
    for (const s of log) {
      const r = s.rows[nm];
      if (!r) continue;
      const d = last ? `  ${r.seen - last.seen >= 0 ? '+' : ''}${r.seen - last.seen} done / ${r.total - last.total >= 0 ? '+' : ''}${r.total - last.total} owed` : '';
      console.log(`     ${s.at}  ${String(r.seen).padStart(6)}/${String(r.total).padEnd(6)} ${(r.seen / r.total * 100).toFixed(1).padStart(5)}%${d}`);
      last = r;
    }
  }
  console.log(`\n  A row where "owed" grows as fast as "done" is a treadmill, and the fix for a\n  treadmill is usually the denominator, not more work.\n`);
  process.exit(0);
}

const only = process.argv[2];
const n = (x) => x.toLocaleString('en-US');
const wide = Math.max(...rows.map(r => r.name.length));

console.log(`\nWHAT EACH MECHANISM HAS ACTUALLY SEEN\n`);
console.log(`  ${n(elements.length)} elements, ${n(recipes.length)} recipes\n`);
let partial = 0;
for (const r of rows) {
  if (only && !r.name.includes(only)) continue;
  const pct = r.total ? r.seen / r.total * 100 : 0;
  const bar = '#'.repeat(Math.round(pct / 5)).padEnd(20, '.');
  const full = pct >= 99.5;
  if (!full && !r.authored) partial++;
  const was = prev && prev.rows[r.name];
  let move = '';
  if (was && (was.seen !== r.seen || was.total !== r.total)) {
    const ds = r.seen - was.seen, dt = r.total - was.total;
    const sign = (x) => (x > 0 ? '+' : '') + n(x);
    move = `   [${sign(ds)} done, ${sign(dt)} owed${ds > dt ? ' — gaining' : ds < dt ? ' — falling behind' : ''}]`;
  }
  console.log(`  ${bar} ${pct.toFixed(0).padStart(3)}%  ${r.name.padEnd(wide)} ${n(r.seen).padStart(6)}/${n(r.total).padEnd(6)}  ${r.note}${move}`);
}
if (!only) {
  const snap = { at: stamp, rows: Object.fromEntries(rows.map(r => [r.name, { seen: r.seen, total: r.total }])) };
  if (!prev || JSON.stringify(prev.rows) !== JSON.stringify(snap.rows)) log.push(snap);
  if (log.length > 400) log = log.slice(-400);
  writeFileSync(LOG, JSON.stringify(log, null, 1) + '\n');
  if (prev) console.log(`\n  Movement shown against the previous run (${prev.at}). ${log.length} snapshot(s) kept.`);
}

console.log(`\n  ${partial} mechanism(s) have seen less than the whole of what they are for.`);
console.log(`  A green run from any of those is a green run on a sample. The number`);
console.log(`  beside it is how big the sample was.\n`);
