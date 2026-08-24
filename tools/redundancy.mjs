#!/usr/bin/env node
// Redundancy report. Multiple true routes into an element are what make the
// genre forgiving: miss one, find another. At ~1.0 recipes/element almost
// everything is single-route, so one un-guessed recipe blocks a whole subtree.
import { readFileSync } from 'node:fs';
const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const elements = load('elements.json'), recipes = load('recipes.json');

const byId = new Map(elements.map((e) => [e.id, e]));
const routes = new Map();
for (const r of recipes) routes.set(r.out, (routes.get(r.out) ?? 0) + 1);

const starters = elements.filter((e) => e.starter);
const made = elements.filter((e) => !e.starter);
const single = made.filter((e) => (routes.get(e.id) ?? 0) <= 1);

// How much of the graph does each single-route element gate?
const kids = new Map();
for (const r of recipes) for (const i of r.in) {
  if (!kids.has(i)) kids.set(i, new Set());
  kids.get(i).add(r.out);
}
function downstream(id, seen = new Set()) {
  for (const k of kids.get(id) ?? []) if (!seen.has(k)) { seen.add(k); downstream(k, seen); }
  return seen;
}

const ratio = recipes.length / elements.length;
console.log(`\nrecipes/element  ${ratio.toFixed(2)}   (target ≥2.00 · Little Alchemy 2 ≈ 4.7)`);
console.log(`single-route     ${single.length} of ${made.length} made elements`);
console.log(`recipes needed for 2.00: ${Math.max(0, Math.ceil(elements.length * 2 - recipes.length))}\n`);

if (process.argv[2] === 'list') {
  const rows = single.map((e) => ({ e, n: downstream(e.id).size }))
    .sort((a, b) => b.n - a.n);
  console.log('single-route elements, worst blockers first:\n');
  for (const { e, n } of rows) {
    const r = recipes.find((x) => x.out === e.id);
    const via = r ? (r.verb ? `${r.in[0]} ⟶ ${r.verb}` : r.in.join(' + ')) : '—';
    console.log(`  gates ${String(n).padStart(3)}  ${e.name.padEnd(22)} ${via}`);
  }
} else {
  const rows = single.map((e) => downstream(e.id).size).sort((a, b) => b - a);
  console.log(`worst single-route blocker gates ${rows[0]} elements`);
  console.log(`top 10 gate: ${rows.slice(0, 10).join(', ')}`);
  console.log(`\n  node tools/redundancy.mjs list   for the full list\n`);
}
