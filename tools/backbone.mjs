#!/usr/bin/env node
/**
 * backbone.mjs — find gaps in the taxonomy tree itself.
 *
 * derivation.mjs asks whether a recipe descends from an ancestor. It can only
 * be as right as the tree it reads. Four times in one session it passed a
 * recipe for the wrong reason, or failed a correct one, because the tree was
 * flat where it should have branched:
 *
 *   Mammalia, Reptilia, Aves and Amphibia all hung straight off Vertebrata.
 *   Amniota, Synapsida, Sauropsida and Tetrapoda were in the file, correctly
 *   nested, with nothing attached to them. So `mammal <- synapsid + hair` --
 *   which is exactly right -- counted as descent only because a mammal and a
 *   synapsid share the subphylum Vertebrata, the same evidence that would
 *   pass `mammal <- trout + hair`.
 *
 *   Chilopoda and Diplopoda hung off Arthropoda with no Myriapoda between,
 *   so `millipede <- centipede + speciation` looked like a sibling problem
 *   rather than what it was: a missing parent.
 *
 *   The shark orders hung off Chondrichthyes with no Elasmobranchii,
 *   Selachii or Batoidea, so a manta and a mako were class-level relatives.
 *
 * Every one of those was found by chasing a flagged recipe. None was found by
 * looking. This looks.
 *
 * Three signals, none of which is proof — each is a place to go and check:
 *
 *   FLAT FAN     a group with many direct children, where an intermediate
 *                clade probably belongs. Vertebrata had eight.
 *   RANK INVERSION  a child ranked broader than its parent (a phylum under a
 *                class). Either the parent link or one of the ranks is wrong.
 *   DEAD GROUP   a group with no children and nothing tagged to it. Either
 *                something should be tagged to it, or it should go.
 *
 * Usage:  node tools/backbone.mjs
 *         node tools/backbone.mjs --fan 5     lower the flat-fan threshold
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
const groups = read('taxonomy.json').groups;
const elements = read('elements.json');

const FAN = Number(process.argv.find(a => a.startsWith('--fan'))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--fan') + 1]) || 6;

const by = Object.fromEntries(groups.map(g => [g.id, g]));
const kids = {};
for (const g of groups) if (g.parent) (kids[g.parent] ??= []).push(g);
const tagged = {};
for (const e of elements) if (e.taxon) (tagged[e.taxon] ??= []).push(e.id);

// Only ranks that nest strictly. `clade` is deliberately unranked and never
// takes part in an inversion, which is the whole point of the word.
const ORDER = ['domain', 'superkingdom', 'kingdom', 'phylum', 'subphylum',
  'superclass', 'class', 'subclass', 'superorder', 'order', 'suborder',
  'infraorder', 'superfamily', 'family', 'subfamily', 'genus', 'species'];
const depth = r => ORDER.indexOf(r);

const name = id => `${by[id]?.name ?? id} (${by[id]?.rank ?? '?'})`;
let found = 0;

// A wide fan is not itself a fault: Mammalia really does have that many
// orders. What marks a missing intermediate is children at DIFFERENT ranks
// under one parent -- Coelurosauria holding a class, an infraorder and a
// family at once -- so those sort first and the merely wide ones follow.
const fans = Object.entries(kids)
  .map(([id, cs]) => [id, cs, new Set(cs.map(c => c.rank))])
  .filter(([, cs, rs]) => cs.length >= FAN || rs.size > 1)
  .sort((a, b) => (b[2].size - a[2].size) || (b[1].length - a[1].length));
const mixed = fans.filter(([, , rs]) => rs.size > 1).length;
console.log(`\nFLAT FAN — ${fans.length} group(s): ${mixed} holding children at mixed ranks, the rest merely wide\n`);
for (const [id, cs, rs] of fans) {
  found += 1;
  const flag = rs.size > 1 ? 'MIXED ' : '      ';
  console.log(`  ${flag}${name(id).padEnd(34)} ${String(cs.length).padStart(3)} children  [${[...rs].join(', ')}]`);
  console.log(`         ${cs.slice(0, 8).map(c => c.name).join(', ')}${cs.length > 8 ? ', …' : ''}`);
}

const inverted = groups.filter(g => {
  if (!g.parent || !by[g.parent]) return false;
  const c = depth(g.rank), p = depth(by[g.parent].rank);
  return c >= 0 && p >= 0 && c <= p;
});
console.log(`\nRANK INVERSION — ${inverted.length} child ranked at or above its parent\n`);
for (const g of inverted) {
  found += 1;
  console.log(`  ${name(g.id).padEnd(34)} under ${name(g.parent)}`);
}

const dead = groups.filter(g => !kids[g.id] && !tagged[g.id]);
console.log(`\nDEAD GROUP — ${dead.length} with no children and nothing tagged to them\n`);
for (const g of dead) {
  found += 1;
  console.log(`  ${name(g.id).padEnd(34)} under ${g.parent ? name(g.parent) : '(root)'}`);
}

console.log(`\n${groups.length} groups, ${Object.keys(tagged).length} of them used by ${elements.filter(e => e.taxon).length} elements`);
console.log(`${found} place(s) to look. None of these is a bug on its own.\n`);
