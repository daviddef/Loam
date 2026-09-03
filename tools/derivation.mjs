#!/usr/bin/env node
/**
 * derivation.mjs — find recipes that associate rather than derive.
 *
 * validate.mjs checks that the graph is playable. safety.mjs checks that the
 * prose is not a procedure. Neither asks the question a reader asks first:
 * does this step make sense?
 *
 * The fault this finds was shipped for months behind `verified: true`, because
 * that flag means "this sentence is true and has a source", not "this
 * transformation is real". `plant + shell -> ankylosaurus` cited Wikipedia for
 * a true fact about the animal's armour. It passed every check the project had.
 *
 * The shape of the fault: the inputs are properties, neighbours, or contents of
 * the output rather than things it actually comes from.
 *
 *     plant + shell     -> ankylosaurus     a herbivore, with armour
 *     acacia            -> giraffe          what it eats
 *     archipelago+serbia-> croatia          has islands, borders Serbia
 *     meadow            -> bee              where you find it
 *
 * The test used here is descent, and it is deliberately narrow: for every
 * element carrying a `taxon`, at least one input must be a taxonomic ancestor
 * BELOW kingdom rank. Sharing only a kingdom is what any two animals have in
 * common and is not evidence of anything.
 * That is checkable rather than a matter of taste, and it is why this tool
 * reports only organisms — the same fault in geography and artefacts is real
 * and needs a different test, so it is not guessed at here.
 *
 * Usage:  node tools/derivation.mjs           report
 *         node tools/derivation.mjs --list    every flagged recipe
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = f => JSON.parse(readFileSync(join(root, f), 'utf8'));
const elements = R('data/elements.json');
const recipes = R('data/recipes.json');
const groups = Object.fromEntries(R('data/taxonomy.json').groups.map(g => [g.id, g]));
const byId = Object.fromEntries(elements.map(e => [e.id, e]));

/** Every taxon above this element, up to the kingdom. */
function lineage(id) {
  const out = new Set();
  let t = byId[id]?.taxon;
  while (t && groups[t]) { out.add(t); t = groups[t].parent; }
  return out;
}
const organisms = elements.filter(e => e.taxon).map(e => e.id);
const isOrganism = new Set(organisms);

// "Shares an ancestor" is only evidence of descent if the shared ancestor is
// specific. Every animal shares Animalia with every other animal, so a test
// that accepted any shared node accepted `bee + giraffe -> giraffe` — the two
// share exactly one thing, the kingdom, which says nothing at all. Verified
// against the live data: bee and giraffe share only tx_animalia; cat and dog
// share Carnivora, which is a real relationship and still passes.
//
// So the shared node has to be below the top. A kingdom in common is what
// every organism has; anything narrower was inherited from somewhere.
const TOP_RANKS = new Set(['kingdom', 'domain', 'superkingdom']);
const tooBroad = t => TOP_RANKS.has(groups[t]?.rank);

const derived = [], associated = [];
for (const r of recipes) {
  if (!isOrganism.has(r.out)) continue;
  const own = lineage(r.out);
  const hasAncestor = r.in.some(i => {
    if (!isOrganism.has(i)) return false;
    for (const t of lineage(i)) if (own.has(t) && !tooBroad(t)) return true;
    return false;
  });
  (hasAncestor ? derived : associated).push(r);
}

const gesture = r => r.verb ? `${r.in[0]} |${r.verb}` : r.in.join(' + ');

console.log(`\n  ${organisms.length} elements carry a taxon and can be tested`);
console.log(`  ${derived.length + associated.length} recipes make one`);
console.log(`    ${String(derived.length).padStart(4)} descend from an ancestor`);
console.log(`    ${String(associated.length).padStart(4)} do not — habitat, food, or a part of the animal\n`);

const show = process.argv.includes('--list') ? associated : associated.slice(0, 25);
for (const r of show) {
  console.log(`    ${(gesture(r) + ' → ' + r.out).padEnd(48)} ${r.why.slice(0, 44)}`);
}
if (!process.argv.includes('--list') && associated.length > show.length) {
  console.log(`    ... and ${associated.length - show.length} more — pass --list`);
}
console.log(`\n  Untested: everything without a taxon, and every non-organism.`);
console.log(`  A clean run here does not mean the corpus derives; it means the`);
console.log(`  part of it that can be checked mechanically does.\n`);
