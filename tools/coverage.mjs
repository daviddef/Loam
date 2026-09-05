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
import { readFileSync, existsSync } from 'node:fs';
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
const CRAFTY = new Set(['tool', 'build', 'craft', 'trade', 'civic', 'transport',
                        'home', 'media', 'writing', 'instrument', 'medicine', 'tech']);
const artefacts = elements.filter(e => assembled(e.id) && (e.tags || []).some(t => CRAFTY.has(t)));

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
add('scale', elements.length, elements.length, 'every element, every run');
add('art check', elements.length, elements.length, 'every drawing, every run');
add('graph', elements.length, elements.length, 'reachability from the four starters');
add('verbs', recipes.length, recipes.length, 'every recipe, every run');
add('redundancy', recipes.length, recipes.length, 'every gesture, every run');

if (has('needs.json')) {
  const needs = read('needs.json').needs || {};
  add('needs', Object.keys(needs).length, artefacts.length,
      'artefacts that could carry a parts list');
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
      'covers every place-recipe input; the rest is unwritten');
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
  add('places checklist', Object.keys(P.places).length, wanted,
      'the checklist is AUTHORED — a closed one measures nothing', true);
}
if (has('cautions.json')) {
  const c = read('cautions.json').hazards || {};
  const covered = new Set(Object.values(c).flatMap(x => x.ids || []));
  /* Not a shortfall: most elements are not hazardous and must never carry a
   * caution. This line is here so the number is visible, not so it grows. */
  add('hazard cautions', covered.size, elements.length,
      'elements carrying a caution — NOT a target, most should have none', true);
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
  console.log(`  ${bar} ${pct.toFixed(0).padStart(3)}%  ${r.name.padEnd(wide)} ${n(r.seen).padStart(6)}/${n(r.total).padEnd(6)}  ${r.note}`);
}
console.log(`\n  ${partial} mechanism(s) have seen less than the whole of what they are for.`);
console.log(`  A green run from any of those is a green run on a sample. The number`);
console.log(`  beside it is how big the sample was.\n`);
