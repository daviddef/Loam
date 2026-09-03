#!/usr/bin/env node
/**
 * needs.mjs — what would you actually need to build this?
 *
 * Every gap this project has found was found by someone noticing a specific
 * missing word: paracetamol, spanner, whisky, emu, ship, currency. That works,
 * and it does not scale, because it depends on a person happening to think of
 * the word.
 *
 * This is the mechanism that does scale. For an assembly — a house, a bicycle,
 * a loaf — you can write down what it is made of without knowing anything
 * about the corpus: a builder's list, a parts list, a recipe. Check that list
 * against the corpus and the missing pieces fall out mechanically. Author
 * them, and each new piece is itself an assembly with its own list. The corpus
 * tells you what it is missing instead of waiting to be asked.
 *
 * The unit is `data/needs.json`:
 *
 *     "house": {
 *       "src": "https://en.wikipedia.org/wiki/...",
 *       "needs": ["foundation", "brick", "mortar", "joist", ...]
 *     }
 *
 * A `needs` list is NOT a recipe. Recipes are the game's two-input grammar and
 * say how a thing is derived; a needs list is the honest, unbounded answer to
 * "what goes into one", and exists to drive authoring. Some of its entries
 * will become recipe inputs; most will just become elements that ought to
 * exist.
 *
 * Usage:  node tools/needs.mjs                 coverage for every list
 *         node tools/needs.mjs house           one list in detail
 *         node tools/needs.mjs --missing       every missing component, ranked
 *         node tools/needs.mjs --next          assemblies that have no list yet
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = f => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
const elements = R('elements.json');
const recipes = R('recipes.json');
const NEEDS = existsSync(join(root, 'data/needs.json')) ? R('needs.json').needs : {};

const ids = new Set(elements.map(e => e.id));
const names = new Set(elements.map(e => e.name.toLowerCase()));
const has = t => ids.has(t) || names.has(t.replace(/_/g, ' '));
// Same alternation rule the universe checklist uses, for the same reason:
// spanner and wrench share no letters, and every missing-list this project
// produced without it was wrong.
const covered = c => c.split('|').some(has);

const args = process.argv.slice(2);
const one = args.find(a => !a.startsWith('--'));

/* --next: which elements look like assemblies and have no list yet?
 * An assembly is a thing other things are made OF. The signal used here is
 * that the corpus already treats it as a material or component — it appears
 * as a recipe INPUT often — while having no needs list of its own. */
if (args.includes('--next')) {
  const asInput = new Map();
  for (const r of recipes) for (const i of r.in) asInput.set(i, (asInput.get(i) ?? 0) + 1);
  const rows = [...asInput]
    .filter(([id]) => !NEEDS[id] && ids.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);
  console.log(`\nUSED AS AN INPUT OFTEN, AND HAS NO NEEDS LIST — top ${rows.length}\n`);
  for (const [id, n] of rows) console.log(`  ${id.padEnd(24)} used by ${n} recipes`);
  console.log(`\n  ${Object.keys(NEEDS).length} lists written so far.\n`);
  process.exit(0);
}

const report = (id, list) => {
  const miss = list.needs.filter(c => !covered(c));
  const pct = Math.round(100 * (list.needs.length - miss.length) / list.needs.length);
  return { id, total: list.needs.length, miss, pct };
};

if (one) {
  const list = NEEDS[one];
  if (!list) { console.error(`no needs list for "${one}"`); process.exit(1); }
  const { total, miss, pct } = report(one, list);
  console.log(`\n${one} — ${total - miss.length} of ${total} components present (${pct}%)\n`);
  for (const c of list.needs) console.log(`  ${covered(c) ? '  ' : '->'} ${c.split('|')[0]}`);
  if (miss.length) console.log(`\n  ${miss.length} to author: ${miss.map(m => m.split('|')[0]).join(', ')}`);
  console.log();
  process.exit(0);
}

const rows = Object.entries(NEEDS).map(([id, l]) => report(id, l)).sort((a, b) => a.pct - b.pct);
if (args.includes('--missing')) {
  const count = new Map();
  for (const r of rows) for (const m of r.miss) count.set(m, (count.get(m) ?? 0) + 1);
  const ranked = [...count].sort((a, b) => b[1] - a[1]);
  console.log(`\nEVERY MISSING COMPONENT — ${ranked.length}, most-wanted first\n`);
  for (const [c, n] of ranked) console.log(`  ${c.split('|')[0].padEnd(26)} wanted by ${n} list(s)`);
  console.log();
  process.exit(0);
}

const bar = p => '#'.repeat(Math.round(p / 5)).padEnd(20, '·');
console.log('\nWHAT WOULD YOU NEED TO BUILD THIS\n');
let tot = 0, hit = 0;
for (const r of rows) {
  tot += r.total; hit += r.total - r.miss.length;
  console.log(`  ${bar(r.pct)} ${String(r.pct).padStart(3)}%  ${String(r.total - r.miss.length).padStart(3)}/${String(r.total).padEnd(3)}  ${r.id}`);
}
console.log(`\n  ${hit} of ${tot} components present across ${rows.length} lists`);
console.log(`  node tools/needs.mjs --missing   to see what to author next\n`);
