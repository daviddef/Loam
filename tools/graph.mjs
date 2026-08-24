#!/usr/bin/env node
// Design tool. Answers the questions you actually need while authoring content:
//   stats            — is the difficulty curve shaped right?
//   path <id>        — what is the minimum craft chain to this thing?
//   challenges [n]   — which elements make good daily challenges, and what is par?
//   longest          — the deepest chains in the game
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const elements = load('elements.json');
const recipes  = load('recipes.json');
const { verbs } = load('verbs.json');

const byId    = new Map(elements.map((e) => [e.id, e]));
const verbById = new Map(verbs.map((v) => [v.id, v]));
const starters = new Set(elements.filter((e) => e.starter).map((e) => e.id));

// Minimum set of crafts needed to hold each element, accounting for shared
// sub-chains (crafting flour once serves both bread and pasta) and for verb
// unlocks (using Heat means you must already have made fire).
const cost = new Map([...starters].map((s) => [s, new Set()]));
const via  = new Map();
for (let pass = 0; pass < 60; pass++) {
  let changed = false;
  for (const [i, r] of recipes.entries()) {
    const parts = [...r.in];
    if (r.verb && verbById.get(r.verb).unlockedBy) parts.push(verbById.get(r.verb).unlockedBy);
    if (!parts.every((p) => cost.has(p))) continue;
    const set = new Set([i]);
    for (const p of parts) for (const c of cost.get(p)) set.add(c);
    const cur = cost.get(r.out);
    if (!cur || set.size < cur.size) { cost.set(r.out, set); via.set(r.out, i); changed = true; }
  }
  if (!changed) break;
}

const par = (id) => (cost.has(id) ? cost.get(id).size : Infinity);
const label = (id) => `${byId.get(id).emoji} ${byId.get(id).name}`;

function steps(id) {
  // Order the required crafts so every recipe's inputs already exist.
  const need = [...(cost.get(id) ?? [])].map((i) => recipes[i]);
  const have = new Set(starters);
  const out  = [];
  while (need.length) {
    const k = need.findIndex((r) => r.in.every((x) => have.has(x)) &&
      (!r.verb || !verbById.get(r.verb).unlockedBy || have.has(verbById.get(r.verb).unlockedBy)));
    if (k === -1) break;
    const [r] = need.splice(k, 1);
    have.add(r.out);
    out.push(r);
  }
  return out;
}

const gesture = (r) => r.verb
  ? `${label(r.in[0])}  ${verbById.get(r.verb).emoji} ${verbById.get(r.verb).name}`
  : `${label(r.in[0])}  +  ${label(r.in[1])}`;

const [cmd = 'stats', arg] = process.argv.slice(2);

if (cmd === 'path') {
  if (!byId.has(arg)) { console.error(`no such element: ${arg}`); process.exit(1); }
  const s = steps(arg);
  console.log(`\n${label(arg)} — par ${s.length} crafts\n`);
  s.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)}.  ${gesture(r)}  →  ${label(r.out)}`);
    console.log(`     ${r.why}\n`);
  });
} else if (cmd === 'challenges') {
  const n = Number(arg) || 12;
  const picks = elements
    .filter((e) => e.terminal && par(e.id) >= 6 && par(e.id) <= 24)
    .sort((a, b) => par(a.id) - par(b.id));
  console.log(`\n${picks.length} elements make viable daily challenges (par 6–24). Sample:\n`);
  for (const e of picks.slice(0, n)) {
    console.log(`  par ${String(par(e.id)).padStart(2)}   ${e.emoji} ${e.name.padEnd(22)} ${e.shelf}`);
  }
  const buckets = { easy: 0, medium: 0, hard: 0 };
  for (const e of picks) buckets[par(e.id) <= 10 ? 'easy' : par(e.id) <= 16 ? 'medium' : 'hard']++;
  console.log(`\n  easy (≤10) ${buckets.easy}   medium (11–16) ${buckets.medium}   hard (17–24) ${buckets.hard}`);
  console.log(`  → ${picks.length} days of daily challenges before a single repeat.\n`);
} else if (cmd === 'longest') {
  const sorted = elements.filter((e) => !e.starter).sort((a, b) => par(b.id) - par(a.id));
  console.log('\nDeepest chains in the game:\n');
  for (const e of sorted.slice(0, 15)) console.log(`  par ${String(par(e.id)).padStart(2)}   ${e.emoji} ${e.name}`);
  console.log();
} else {
  const hist = new Map();
  for (const e of elements) { const p = par(e.id); hist.set(p, (hist.get(p) ?? 0) + 1); }
  console.log('\nDifficulty curve — elements by par (minimum crafts to reach):\n');
  for (const p of [...hist.keys()].sort((a, b) => a - b)) {
    console.log(`  par ${String(p).padStart(2)}  ${'█'.repeat(hist.get(p))} ${hist.get(p)}`);
  }
  const merges = recipes.filter((r) => !r.verb).length;
  const reach = elements.filter((e) => par(e.id) < Infinity).length;
  console.log(`\n  ${elements.length} elements, ${recipes.length} recipes, ${reach} reachable`);
  console.log(`  ${merges} merges / ${recipes.length - merges} verb processes`);
  console.log(`  possible merge gestures: ${(elements.length * (elements.length - 1)) / 2} pairs`);
  console.log(`  of which are real recipes: ${merges}  (${((merges / ((elements.length * (elements.length - 1)) / 2)) * 100).toFixed(1)}% hit rate)\n`);
}
