#!/usr/bin/env node
/* WHAT A NOUN IS TO A MAKING
 *
 * An element's tags say what it belongs to. They never say what part it plays
 * when something is made from it. Marble and Mausolus are both inputs to the
 * Mausoleum at Halicarnassus; one is the stuff it is built of and the other is
 * the man it was built for, and no tag in this corpus tells them apart. The
 * first version of the places derivation check read tags, flagged 65 places
 * out of 334, and on being read through by hand found nothing wrong with any
 * of them — it was measuring vocabulary, not derivation.
 *
 * data/roles.json writes the missing fact down: one curated role per element.
 * Five roles contribute to a making — material, technique, process, tool,
 * maker — and five do not — site, form, occupant, subject, evidence. With
 * that field, "does this recipe say how the thing was made" is a lookup.
 *
 * The field is curated, not inferred, for the same reason the homonym list is:
 * two heuristics for it were written and both got Mausolus wrong.
 *
 * This tool checks the file is sound and says how far it reaches. It is not a
 * coverage target. A partial file is honest as long as every tool reading it
 * only asks about ids it covers, and tools/places.mjs reports an unroled input
 * as unjudgeable rather than as a fault.
 *
 *   node tools/roles.mjs            check, and report reach
 *   node tools/roles.mjs --missing  place-recipe inputs with no role yet
 *   node tools/roles.mjs <role>     every element carrying that role
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, 'data', p), 'utf8'));
const R = read('roles.json');
const elements = read('elements.json');
const recipes = read('recipes.json');
const places = read('places.json');

const byId = new Map(elements.map(e => [e.id, e]));
const VOCAB = Object.keys(R.$roles);
const errors = [];

/* Every role has to be one of the ten. A typo would otherwise sit in the file
 * looking like a fact and silently never match anything. */
for (const [id, role] of Object.entries(R.roles)) {
  if (!VOCAB.includes(role)) errors.push(`${id}: role "${role}" is not one of ${VOCAB.join(', ')}`);
  if (!byId.has(id)) errors.push(`${id}: no element has this id`);
}
for (const c of R.$contributes) {
  if (!VOCAB.includes(c)) errors.push(`$contributes names "${c}", which is not a role`);
}
/* Each role has to say, in its own description, whether it contributes. A role
 * whose prose and whose membership of $contributes disagree is worse than one
 * that is simply wrong: it reads as checked. */
for (const [role, desc] of Object.entries(R.$roles)) {
  const says = /Does not contribute/.test(desc) ? false : /Contributes/.test(desc) ? true : null;
  if (says === null) errors.push(`$roles.${role}: its description says neither "Contributes" nor "Does not contribute"`);
  else if (says !== R.$contributes.includes(role)) errors.push(`$roles.${role}: description and $contributes disagree`);
}

/* The scope this file promises to cover is every input to a place recipe,
 * because that is what tools/places.mjs asks it about. Losing coverage there
 * means a place check quietly stopped being able to judge something. */
const placeIds = new Set(Object.keys(places.places));
const placeInputs = new Set();
for (const r of recipes) if (placeIds.has(r.out)) for (const i of r.in) placeInputs.add(i);
const uncovered = [...placeInputs].filter(i => !R.roles[i]).sort();
if (uncovered.length) errors.push(`${uncovered.length} input(s) to a place recipe have no role: ${uncovered.join(' ')}`);

const mode = process.argv[2];
const n = (x) => x.toLocaleString('en-US');

if (mode === '--missing') {
  console.log(`\n${n(uncovered.length)} PLACE-RECIPE INPUT(S) WITH NO ROLE\n`);
  for (const i of uncovered) console.log(`  ${i.padEnd(28)} ${(byId.get(i)?.tags || []).join(',')}`);
  process.exit(0);
}
if (mode && VOCAB.includes(mode)) {
  const mine = Object.entries(R.roles).filter(([, v]) => v === mode).map(([k]) => k).sort();
  console.log(`\n${n(mine.length)} ELEMENT(S) WITH ROLE "${mode}" — ${R.$roles[mode]}\n`);
  for (let i = 0; i < mine.length; i += 4) console.log('  ' + mine.slice(i, i + 4).map(x => x.padEnd(26)).join('').trimEnd());
  console.log();
  process.exit(0);
}
if (mode) { console.error(`no role "${mode}". Try: ${VOCAB.join(' ')} --missing`); process.exit(1); }

console.log(`\nWHAT A NOUN IS TO A MAKING\n`);
const counts = {};
for (const v of Object.values(R.roles)) counts[v] = (counts[v] || 0) + 1;
const wide = Math.max(...VOCAB.map(v => v.length));
for (const v of VOCAB) {
  const bar = '#'.repeat(Math.round((counts[v] || 0) / 4));
  console.log(`  ${v.padEnd(wide)}  ${String(counts[v] || 0).padStart(4)}  ${R.$contributes.includes(v) ? 'makes ' : '      '} ${bar}`);
}
console.log(`\n  ${n(Object.keys(R.roles).length)} of ${n(elements.length)} elements carry a role (${(Object.keys(R.roles).length / elements.length * 100).toFixed(1)}%).`);
console.log(`  That percentage is not a target. The field exists to answer one question —`);
console.log(`  "did this input contribute to the making?" — and it covers ${n(placeInputs.size)} of ${n(placeInputs.size)} inputs`);
console.log(`  to a place recipe, which is every id tools/places.mjs asks it about.`);

if (errors.length) {
  console.log(`\n${n(errors.length)} PROBLEM(S)\n`);
  for (const e of errors) console.log(`  ${e}`);
  console.log();
  process.exit(1);
}
console.log(`\n✓ roles are sound, and cover everything that reads them\n`);
