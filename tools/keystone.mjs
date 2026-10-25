#!/usr/bin/env node
/* WHAT HOLDS THIS UP?
 *
 * Take one element out of the world and recompute what can still be reached
 * from the four starters. The number left behind is how much of Loam that one
 * thing was carrying.
 *
 * This was computable from day one and nobody had run it, which is why the
 * ROADMAP's list of critical elements was wrong. Measured, `flint` carries
 * 50.7% of the corpus and `pottery` carries nothing at all — while the
 * roadmap ranked flint second-tier and pottery alongside it. Theory of
 * constraints says an hour spent anywhere but the constraint buys nothing;
 * you cannot spend it correctly without this number.
 *
 * THE VERB UNLOCK IS THE WHOLE TRICK. A first pass that ignored it reported
 * fire at 17.5% and flint at 2.2%, which is the graph's answer and not the
 * game's. Removing fire does not just remove fire — it removes Heat and
 * Smother from the world, and every recipe that needs them. With unlocking
 * modelled the same two elements read 39.4% and 50.7%. Any version of this
 * check that drops the verb model is measuring a game nobody plays.
 *
 * WHAT IT IS NOT. A cascade is a property of THIS GRAPH, not a claim about
 * the world: `sprout` reads as load-bearing partly because the corpus is
 * biology-heavy. And the score must never become an authoring target — a
 * corpus shaped by its own metric has stopped being shaped by reality. It is
 * a lens for deciding where resilience work goes, and nothing else.
 *
 *   node tools/keystone.mjs          recompute and write data/keystone.json
 *   node tools/keystone.mjs check    read-only; fails if the file is stale
 *   node tools/keystone.mjs fragile  load-bearing AND few ways to reach it
 *   node tools/keystone.mjs <id>     just this element, with its figure
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = p => JSON.parse(readFileSync(join(ROOT, 'data', p), 'utf8'));
const n = x => x.toLocaleString('en-US');

const recipes = D('recipes.json');
const elements = D('elements.json');
const verbs = D('verbs.json').verbs;
const UNLOCK = Object.fromEntries(verbs.map(v => [v.id, v.unlockedBy]));
const STARTERS = elements.filter(e => e.starter).map(e => e.id);

/** Everything reachable from the starters, optionally with one element gone. */
function reachable(banned) {
  const have = new Set(STARTERS.filter(s => s !== banned));
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of recipes) {
      if (r.out === banned || have.has(r.out)) continue;
      const v = r.verb;
      if (v && UNLOCK[v] && !have.has(UNLOCK[v])) continue;   // verb not unlocked yet
      const ins = r.in || [];
      if (ins.some(i => i === banned)) continue;
      if (ins.every(i => have.has(i))) { have.add(r.out); grew = true; }
    }
  }
  return have;
}

const base = reachable(null);

/* Only something that is used — as an input, or to unlock a verb — can take
 * anything with it. The other 5,000 take themselves and nothing else, and
 * skipping them turns an eight-thousand-pass computation into a short one. */
const load = new Set(Object.values(UNLOCK).filter(Boolean));
for (const r of recipes) for (const i of r.in || []) load.add(i);

const arg = process.argv[2];

/* FRAGILITY IS TWO NUMBERS, AND IT STAYS TWO NUMBERS.
 *
 * How much an element holds up is one axis. How many ways there are to reach
 * it is the other, and neither alone says where the risk is. `fire` holds up
 * 39% of the world and has five routes — losing one of them costs nothing.
 * `spark` holds up 76% and has two.
 *
 * Both the ROADMAP's A8 list and the October external review picked targets by
 * intuition and landed on elements that are already well served. Keystone
 * weight alone would have done the same: it ranks fire and flint at the top,
 * and both have routes to spare.
 *
 * Deliberately NOT collapsed into one score. A composite would be a league
 * table, and a league table becomes an authoring target — which is the one
 * thing this measurement must never be. Two axes, reported together, and the
 * judgement left where it belongs. */
if (arg === 'fragile') {
  const routes = {};
  for (const r of recipes) routes[r.out] = (routes[r.out] || 0) + 1;
  const starter = new Set(STARTERS);
  const rows = [];
  for (const e of elements) {
    if (!base.has(e.id) || !load.has(e.id) || starter.has(e.id)) continue;
    const n = routes[e.id] || 0;
    if (n > 2) continue;                       // three ways in is not fragile
    const lost = base.size - reachable(e.id).size;
    if (lost >= 200) rows.push({ id: e.id, n, lost });
  }
  rows.sort((a, b) => b.lost - a.lost);
  console.log('\nLOAD-BEARING, AND FEW WAYS TO REACH IT\n');
  console.log('  routes   holds up            element');
  for (const r of rows.slice(0, 20))
    console.log(`  ${String(r.n).padStart(4)}    ${n(r.lost).padStart(6)}  (${(r.lost / base.size * 100).toFixed(1).padStart(4)}%)   ${r.id}`);
  const sole = rows.filter(r => r.n === 1);
  console.log(`\n  ${n(rows.length)} element(s) have two routes or fewer and hold up 200 or more things.`);
  console.log(`  ${n(sole.length)} of those have exactly ONE route — a single missed combination`);
  console.log(`  blocks everything beneath them.\n`);
  process.exit(0);
}

const ONE = arg && arg !== 'check' ? arg : null;

if (ONE) {
  if (!elements.some(e => e.id === ONE)) { console.error(`no such element: ${ONE}`); process.exit(2); }
  const lost = base.size - reachable(ONE).size;
  console.log(`\n  ${ONE} — removing it costs ${n(lost)} of ${n(base.size)} (${(lost / base.size * 100).toFixed(1)}%)\n`);
  process.exit(0);
}

const score = {};
for (const e of elements) {
  if (!base.has(e.id) || !load.has(e.id)) continue;
  const lost = base.size - reachable(e.id).size;
  if (lost > 0) score[e.id] = lost;
}

const out = {
  $comment: 'How much of the world stops existing without this element — reachability from the four starters, recomputed with it removed, verb unlocks modelled. Written by tools/keystone.mjs; never hand-edited, and never an authoring target. A property of this graph, not a claim about the world.',
  $reachable: base.size,
  $computed: new Date().toISOString().slice(0, 10),
  score,
};

if (arg === 'check') {
  let old = null;
  try { old = D('keystone.json'); } catch { }
  const same = old && old.$reachable === out.$reachable
    && JSON.stringify(old.score) === JSON.stringify(out.score);
  if (!same) {
    console.error('\n  data/keystone.json is stale — run `node tools/keystone.mjs`\n');
    process.exit(1);
  }
  console.log(`\n  ✓ keystone scores current — ${n(Object.keys(score).length)} element(s) carry more than themselves\n`);
  process.exit(0);
}

writeFileSync(join(ROOT, 'data', 'keystone.json'), JSON.stringify(out, null, 1) + '\n');

const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
console.log(`\nWHAT HOLDS THIS WORLD UP\n`);
console.log(`  ${n(base.size)} element(s) reachable from ${STARTERS.join(', ')}\n`);
for (const [id, lost] of ranked.slice(0, 15))
  console.log(`  ${n(lost).padStart(6)}  ${(lost / base.size * 100).toFixed(1).padStart(5)}%   ${id}`);
console.log(`\n  ${n(ranked.length)} element(s) take more than themselves with them.`);
console.log(`  ${n(base.size - ranked.length)} take only themselves.`);
console.log(`\n  wrote data/keystone.json\n`);
