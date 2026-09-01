#!/usr/bin/env node
/**
 * safety.mjs — find the places where "true in general" and "safe as done by a
 * child in a kitchen" come apart.
 *
 * Three separate exposures, and they are not the same problem:
 *
 *  1. INSTRUCTIONAL VOICE. A recipe's `why` explains a mechanism. The moment it
 *     reads as a procedure — "leave it somewhere warm for three days" — it stops
 *     being an explanation of the world and becomes a thing the reader might do.
 *     Winter v. Putnam protects publishers of information partly *because* they
 *     are not holding themselves out as guarantors. Explanations are safer than
 *     instructions for a reason that is about substance, not wording.
 *
 *  2. HAZARD CHAINS. Anaerobic fermentation, home preservation, lye, and fire.
 *     Botulism is the sharp case: the chemistry we describe is correct and the
 *     practice it implies can kill someone.
 *
 *  3. APP STORE 1.4.3. Apple treats alcohol as a restricted topic. We reach
 *     beer, wine, cider, mead and aged wine. This lists them so the rating and
 *     the copy can be decided deliberately rather than discovered at review.
 *
 * Usage:  node tools/safety.mjs          report
 *         node tools/safety.mjs --strict exit non-zero if anything is unhandled
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = f => JSON.parse(readFileSync(join(root, f), 'utf8'));
const elements = R('data/elements.json');
const recipes = R('data/recipes.json');
const byId = Object.fromEntries(elements.map(e => [e.id, e]));

/* ── 1. instructional voice ────────────────────────────────────────────── */

// What actually makes a sentence a procedure rather than an explanation is not
// the imperative mood — English uses "boil the water off and sucrose
// crystallises" as pure explanation, and our prose is full of it. What makes it
// a procedure is a step the reader could follow: an instruction aimed at them,
// or an imperative carrying a quantity, a temperature or a duration.
//
// The first version of this check flagged 37 recipes, of which almost all were
// sentences beginning with the noun "Salt". A check that cries wolf gets turned
// off, so it now looks only for the two patterns that mean something.
const DIRECTED_AT_READER = /\b(?:you|your)\s+(?:can|should|must|need to|want to|have to|will want)\b/i;

const PROCEDURE_VERB = '(?:Add|Boil|Leave|Heat|Mix|Pour|Store|Keep|Seal|Ferment|Soak|Bury|Cure|Salt|Smoke|Dry|Cook|Bake|Simmer|Stir|Cool|Chill|Crush|Grind|Press|Strain|Skim|Feed|Cover|Wrap|Pack|Submerge)';
const MEASURE = '(?:for\\s+\\w+\\s+(?:second|minute|hour|day|week|month|year)s?|at\\s+\\d+\\s*(?:°|deg|C\\b|F\\b)|until\\s+(?:it|they|the))';
// An imperative and a measurement in the same sentence is a step you could follow.
const FOLLOWABLE_STEP = new RegExp(
  `(?:^|[.!?]\\s+)${PROCEDURE_VERB}\\b[^.!?]{0,80}${MEASURE}`, 'i');

// Reviewed and cleared. Each of these matched the reader-directed pattern and
// each turned out to be about something other than the reader — a tree holding
// its leaves up, a human's eleven amino acids, a line from the folk tale. Kept
// as an explicit list with a reason so the check stays useful for new prose
// instead of being switched off.
const CLEARED = {
  tree: 'the tree holds its leaves up, not the reader',
  sugarcane: 'generic — anyone can taste sugarcane; not a procedure',
  gingerbread_man: 'a quotation from the folk tale',
  stoneware: 'generic — what tempering makes possible, not a step',
  amino_acid: 'about human biochemistry: we can build eleven of the twenty',
  james: 'a direct quotation from William James himself, not the reader',
};

const instructional = [];
for (const r of recipes) {
  const hits = [];
  let m = r.why.match(DIRECTED_AT_READER);
  if (m) hits.push(`addresses the reader: "${m[0]}"`);
  m = r.why.match(FOLLOWABLE_STEP);
  if (m) hits.push(`a step you could follow: "${m[0].trim().slice(0, 60)}"`);
  if (hits.length && !CLEARED[r.out]) instructional.push({ gesture: gestureOf(r), out: r.out, hits });
}

/* ── 2. hazard chains ──────────────────────────────────────────────────── */

// The hazards themselves live in data/cautions.json, next to the other things
// this project asserts about the world, rather than in a tool nobody reads.
const CAUTIONS = R('data/cautions.json').hazards;

/* ── report ────────────────────────────────────────────────────────────── */

function gestureOf(r) {
  return r.verb ? `${r.in[0]} |${r.verb}` : r.in.join(' + ');
}

console.log(`  ${recipes.length} recipes, ${elements.length} elements\n`);

console.log(`  INSTRUCTIONAL VOICE — ${instructional.length} unreviewed, ` +
            `${Object.keys(CLEARED).length} reviewed and cleared`);
for (const i of instructional) {
  console.log(`    ${(i.gesture + ' → ' + i.out).padEnd(44)} ${i.hits.join('; ')}`);
}

console.log(`\n  HAZARD CHAINS`);
let unhandled = 0, ghosts = 0;
for (const [kind, h] of Object.entries(CAUTIONS)) {
  const present = h.ids.filter(id => byId[id]);
  const missing = h.ids.filter(id => !byId[id]);
  ghosts += missing.length;
  unhandled += present.length ? 0 : 0;
  console.log(`    ${kind.padEnd(10)} ${String(present.length).padStart(2)} item(s)   ${h.label}`);
  if (missing.length) console.log(`               NOT IN THE GRAPH: ${missing.join(', ')}`);
}

// Every element on a hazard chain must be reachable from a caution, and every
// id a caution names must exist — a caution pointing at a deleted element is a
// warning that silently stopped being shown.
const covered = new Set(Object.values(CAUTIONS).flatMap(h => h.ids));
console.log(`\n  ${covered.size} element(s) covered by a caution, ${ghosts} id(s) named that no longer exist`);

if (process.argv.includes('--strict')) process.exit(instructional.length || ghosts ? 1 : 0);
