#!/usr/bin/env node
/* WHAT AN ELEMENT DOES TO A PERSON
 *
 * The Ragdoll canvas asks one question — drop this on a human body, what
 * happens — and the corpus could not answer it. Tags do not say. Cautions say
 * only that there is a hazard. The recipe says nothing at all. So this is the
 * fifth curated field, and the reason is the same as for roles, homonyms,
 * inert and needs: it is a fact nobody had written down.
 *
 * THE DESIGN DECISION THAT MAKES IT CHECKABLE is that an outcome must be an
 * element this corpus already has. asbestos + human -> mesothelioma is not new
 * content; it is a new view of content that has already passed validate,
 * sources, roles and the numeric audit. The whole gate suite protects the
 * Ragdoll layer for free, and where an outcome does not exist, authoring it is
 * ordinary corpus work that gets the ordinary checks.
 *
 * THE SAFETY RULE IS A GATE, NOT A HABIT. This file is one careless sentence
 * away from being a how-to. The mechanism prose says what happens in the body;
 * it never says how to bring it about, never gives a quantity that would cause
 * harm, and never describes obtaining or concentrating anything. That is
 * checked here and it FAILS rather than warns, because a check that only warns
 * about this is worse than none.
 *
 *   node tools/effects.mjs             check, and report reach
 *   node tools/effects.mjs --missing   elements with a caution and no effect
 *   node tools/effects.mjs <route>     everything that gets in that way
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => JSON.parse(readFileSync(join(ROOT, 'data', p), 'utf8'));
const n = (x) => x.toLocaleString('en-US');

const E = D('effects.json');
const elements = D('elements.json');
const cautions = D('cautions.json').hazards;
const byId = new Map(elements.map(e => [e.id, e]));
const ROUTES = Object.keys(E.$routes);
const TIERS = ['acute', 'contact', 'conditional', 'cumulative'];
const errors = [];

/* METHOD-SHAPED PROSE. Each pattern describes a sentence that has stopped
 * explaining and started instructing. They are deliberately narrow: a check
 * that fires on correct writing is one that gets switched off, and this is the
 * one check that must never be switched off. */
const METHOD = [
  [/\b(?:how to|in order to)\s+(?:make|produce|obtain|extract|concentrate|synthesi[sz]e|prepare)\b/i,
   'tells the reader how to make or obtain something'],
  [/\b(?:lethal dose|LD ?50|median lethal|fatal dose|minimum lethal)\b/i,
   'gives a dose-to-harm figure'],
  [/\b\d[\d.,]*\s*(?:mg|g|ml|µg|ug)\s*(?:\/|per )\s*kg\b/i,
   'gives a dose per body weight'],
  [/\benough to (?:kill|be fatal|cause death)\b/i,
   'quantifies an amount that would kill'],
  [/\byou (?:can|could|should|must)\s+(?:make|produce|obtain|extract|concentrate|combine|mix)\b/i,
   'addresses the reader with a procedure'],
  [/\b(?:mix|combine|add|heat|distil|distill|concentrate)\s+\w+\s+(?:with|and|to)\s+\w+\s+to\s+(?:make|produce|form|obtain)\b/i,
   'reads as a preparation'],
];

for (const [id, f] of Object.entries(E.effects)) {
  const where = `effects.${id}`;
  if (!byId.has(id)) errors.push(`${where}: no element has this id`);
  if (!ROUTES.includes(f.route)) errors.push(`${where}: route "${f.route}" is not one of ${ROUTES.join(', ')}`);
  if (!TIERS.includes(f.onset)) errors.push(`${where}: onset "${f.onset}" is not one of ${TIERS.join(', ')}`);
  if (!f.outcome) errors.push(`${where}: no outcome`);
  else if (!byId.has(f.outcome)) errors.push(`${where}: outcome "${f.outcome}" is not an element — author it first, so the Ragdoll card is an ordinary card`);
  if (!f.src || !String(f.src).startsWith('http')) errors.push(`${where}: no source`);
  if (!f.mechanism || f.mechanism.length < 40) errors.push(`${where}: mechanism is missing or too short to be an explanation`);
  for (const [re, why] of METHOD) {
    if (re.test(f.mechanism || '')) errors.push(`${where}: MECHANISM ${why} — describe what happens in the body, never how to bring it about`);
  }
  if (f.carcinogen && f.iarc !== 1) errors.push(`${where}: carcinogen is for IARC Group 1 only; set iarc: 1 or drop the flag`);
}

const cautioned = new Set(Object.values(cautions).flatMap(h => h.ids || []));
const owed = [...cautioned].filter(id => !E.effects[id]).sort();

const mode = process.argv[2];
if (mode === '--missing') {
  console.log(`\n${n(owed.length)} ELEMENT(S) CARRY A CAUTION AND HAVE NO EFFECT YET\n`);
  for (let i = 0; i < owed.length; i += 4) console.log('  ' + owed.slice(i, i + 4).map(x => x.padEnd(26)).join('').trimEnd());
  console.log(`\n  These are the population with the fact half-written already: the caution\n  note usually names the route. Read it rather than starting again.\n`);
  process.exit(0);
}
if (mode && ROUTES.includes(mode)) {
  const mine = Object.entries(E.effects).filter(([, f]) => f.route === mode);
  console.log(`\n${n(mine.length)} VIA "${mode}" — ${E.$routes[mode]}\n`);
  for (const [id, f] of mine) console.log(`  ${id.padEnd(24)} ${f.onset.padEnd(12)} -> ${f.outcome}`);
  console.log();
  process.exit(0);
}

console.log(`\nWHAT AN ELEMENT DOES TO A PERSON\n`);
const byRoute = {}, byTier = {};
for (const f of Object.values(E.effects)) {
  byRoute[f.route] = (byRoute[f.route] || 0) + 1;
  byTier[f.onset] = (byTier[f.onset] || 0) + 1;
}
for (const r of ROUTES) console.log(`  ${r.padEnd(12)} ${String(byRoute[r] || 0).padStart(4)}   ${E.$routes[r]}`);
console.log();
for (const t of TIERS) console.log(`  ${t.padEnd(12)} ${String(byTier[t] || 0).padStart(4)}`);
console.log(`\n  ${n(Object.keys(E.effects).length)} effect(s) written, of ${n(cautioned.size)} elements that carry a caution.`);
console.log(`  node tools/effects.mjs --missing   the rest`);

if (errors.length) {
  console.log(`\n${n(errors.length)} PROBLEM(S)\n`);
  for (const e of errors) console.log(`  ${e}`);
  console.log();
  process.exit(1);
}
console.log(`\n✓ every effect names a real outcome, a real route, and a source —\n  and none of them reads as a method\n`);
