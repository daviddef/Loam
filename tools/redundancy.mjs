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

/* How much would actually be LOST if this element could not be made?
 *
 * `downstream` counts everything reachable through an element, and in a graph
 * this dense almost anything early reaches almost everything — so the top ten
 * blockers all read 7,569, the size of the whole corpus, and the metric could
 * not rank. A number that is the same for every entry is not a measurement.
 *
 * The real question is articulation: take the element away, walk the graph
 * from the four starters again, and count what can no longer be reached. An
 * element with one route whose removal strands nothing is not a chokepoint at
 * all, however much sits downstream of it. */
const outOf = new Map();
for (const r of recipes) {
  if (!outOf.has(r.out)) outOf.set(r.out, []);
  outOf.get(r.out).push(r.in);
}
const startIds = starters.map((e) => e.id);
function reachableWithout(blocked) {
  const have = new Set(startIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [out, ways] of outOf) {
      if (have.has(out) || out === blocked) continue;
      for (const ins of ways) {
        if (ins.every((i) => have.has(i))) { have.add(out); grew = true; break; }
      }
    }
  }
  return have;
}
const reachableAll = reachableWithout(null).size;
const stranded = (id) => reachableAll - reachableWithout(id).size;

const ratio = recipes.length / elements.length;
console.log(`\nrecipes/element  ${ratio.toFixed(2)}   (target ≥2.00 · Little Alchemy 2 ≈ 4.7)`);
console.log(`single-route     ${single.length} of ${made.length} made elements`);
console.log(`recipes needed for 2.00: ${Math.max(0, Math.ceil(elements.length * 2 - recipes.length))}\n`);

if (process.argv[2] === 'list') {
  const rows = single.map((e) => ({ e, n: stranded(e.id) }))
    .filter((x) => x.n > 1)
    .sort((a, b) => b.n - a.n);
  console.log(`single-route elements whose loss would strand something, worst first:\n`);
  for (const { e, n } of rows) {
    const r = recipes.find((x) => x.out === e.id);
    const via = r ? (r.verb ? `${r.in[0]} ⟶ ${r.verb}` : r.in.join(' + ')) : '—';
    console.log(`  gates ${String(n).padStart(3)}  ${e.name.padEnd(22)} ${via}`);
  }
} else {
  const rows = single.map((e) => stranded(e.id)).sort((a, b) => b - a);
  const real = rows.filter((n) => n > 1);
  console.log(`${real.length} single-route element(s) would strand something if lost`);
  console.log(`worst strands ${rows[0]} others; top 10: ${rows.slice(0, 10).join(', ')}`);
  console.log(`\n  node tools/redundancy.mjs list   for the full list\n`);
}
