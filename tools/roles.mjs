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

/* --derives: THE ASSOCIATION CHECK, OUTSIDE PLACES
 *
 * tools/places.mjs uses this field to ask whether a place's recipe says how the
 * thing was made. Nothing asked it anywhere else, and the fault is not confined
 * to places. Found on 5 Sep by ranking elements that many recipes consume and
 * exactly one produces:
 *
 *   stone    used by 138 recipes, and its only route was troll + sun
 *   desert   cactus + sand — the cactus lives there, it does not make it
 *   lion     mammal + tanzania — where the fossils were found
 *   dinosaur argentina + reptile — same shape
 *   insect   arthropod + compound_eye — a feature, not an ingredient
 *
 * Every one is prose that is true beside a gesture that is not a making. So the
 * same lookup runs over every recipe whose inputs are all roled: if not one of
 * them contributes — material, technique, process, tool or maker — then the
 * recipe names the thing and something near it, and never says how.
 *
 * COVERAGE IS THE LIMIT AND IT IS PRINTED. A recipe with any unroled input is
 * not judged and never counted as a fault, exactly as in places.mjs. The way to
 * make this see the whole corpus is to write more roles, not to guess at them —
 * two heuristics for this have already been built and thrown away, one that
 * returned 684 candidates of which about two were real, and one on 5 Sep that
 * returned 1,392 by reading the prose for material names it could not find in
 * the inputs, of which almost none were real.
 */
if (mode === '--derives') {
  /* TWO CONVENTIONS THIS MUST NOT FIGHT.
   *
   * An ORGANISM is routinely derived from where it lives, what it eats or what
   * it is part of — tools/derivation.mjs counts 590 of them and says so
   * outright. rainforest + river -> tapir is not a fault; it is how this corpus
   * has always written species, and a check that flagged every one of them
   * would be reporting a house style as a defect.
   *
   * A MYTH is not made of anything. snake + seed -> ares is a story, and asking
   * it to name a material is a category error.
   *
   * Both are excluded by the output's own tags, not by guesswork about the
   * recipe. What is left is the class that actually goes wrong: made things and
   * landforms whose gesture names the thing and something standing near it. */
  const byIdEl = new Map(elements.map(e => [e.id, e]));
  const NOT_DERIVABLE = new Set(R.$not_derivable || []);
  const CONVENTION = new Set(['animal', 'plant', 'microbe', 'wild', 'extinct', 'crop',
                              'myth', 'belief', 'person', 'history', 'idea', 'society']);
  const judged = [], bad = [], skipped = [];
  for (const r of recipes) {
    if (r.verb || r.in.length < 2) continue;
    const rs = r.in.map(i => R.roles[i]);
    if (rs.some(x => !x)) continue;
    const tags = byIdEl.get(r.out)?.tags || [];
    if (tags.some(t => CONVENTION.has(t)) || NOT_DERIVABLE.has(r.out)) { skipped.push(r); continue; }
    judged.push(r);
    if (!rs.some(x => R.$contributes.includes(x))) bad.push({ r, rs });
  }
  console.log(`\n${n(bad.length)} RECIPE(S) THAT NAME A THING AND NEVER SAY HOW IT IS MADE\n`);
  for (const { r, rs } of bad) {
    console.log(`  ${r.in.map((x, i) => `${x}(${rs[i]})`).join(' + ')}  ->  ${r.out}`);
  }
  const total = recipes.filter(r => !r.verb && r.in.length >= 2).length;
  console.log(`  ${n(skipped.length)} recipe(s) skipped: an organism, a myth or a person, where`);
  console.log(`  derivation from habitat or from a story is this corpus's own convention.`);
  console.log(`\n  ${n(judged.length)} of ${n(total)} two-input recipes could be judged ` +
              `(${(judged.length / total * 100).toFixed(1)}%). The rest have an input with no`);
  console.log(`  role yet, and are not counted either way. That percentage is the whole`);
  console.log(`  story of this check: it is exact on what it can see, and it cannot see much.`);
  console.log(`\n  A LIMIT WORTH KNOWING: a role is recorded per ELEMENT, and the part a thing`);
  console.log(`  plays is per RECIPE. Marble is a material in every recipe it appears in. A`);
  console.log(`  river is a site in one and an eroding process in the next, and this field can`);
  console.log(`  only hold one answer. Where that bites — mountain + river -> valley — the fix`);
  console.log(`  is in the recipe, which should name erosion, and not in the role.\n`);
  process.exit(0);
}


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
