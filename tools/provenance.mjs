#!/usr/bin/env node
// Provenance: the full ancestry of a thing, expanded back to the four starters.
//
// Two numbers, and the difference between them is the whole point:
//   distinct — how many different things go into this (the DAG, sharing work)
//   expanded — how many steps if you never reused anything (the tree)
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const elements = load('elements.json');
const recipes  = load('recipes.json');
const { verbs } = load('verbs.json');
const bedrock  = load('bedrock.json');
const atomById = new Map(bedrock.atoms.map((a) => [a.id, a]));
const compById = new Map(bedrock.compounds.map((c) => [c.id, c]));
const bedName  = (id) => atomById.get(id)?.name ?? compById.get(id)?.name ?? id;

// Which chemical elements does a thing ultimately reduce to?
function atomsUnder(id, seen = new Set(), out = new Set()) {
  if (atomById.has(id)) { out.add(id); return out; }
  if (seen.has(id)) return out;
  seen.add(id);
  for (const x of compById.get(id)?.of ?? []) atomsUnder(x, seen, out);
  return out;
}
function bedrockTree(id, depth, out = []) {
  const a = atomById.get(id);
  const pad = '   '.repeat(depth);
  if (a) { out.push(`${pad}· ${a.symbol.padEnd(2)} ${a.name}`); return out; }
  const c = compById.get(id);
  if (!c) return out;
  out.push(`${pad}· ${c.name}`);
  for (const x of c.of) bedrockTree(x, depth + 1, out);
  return out;
}
function elementAtoms(gameId) {
  const parts = bedrock.composition[gameId];
  if (!parts) return null;
  const set = new Set();
  for (const p of parts) for (const a of atomsUnder(p)) set.add(a);
  return set;
}

const byId = new Map(elements.map((e) => [e.id, e]));
const verbById = new Map(verbs.map((v) => [v.id, v]));
const starters = new Set(elements.filter((e) => e.starter).map((e) => e.id));
const label = (id) => `${byId.get(id).emoji} ${byId.get(id).name}`;

// Cheapest recipe for each element, by number of distinct crafts required.
const cost = new Map([...starters].map((s) => [s, new Set()]));
const best = new Map();
for (let pass = 0; pass < 60; pass++) {
  let changed = false;
  for (const [i, r] of recipes.entries()) {
    const parts = [...r.in];
    if (r.verb && verbById.get(r.verb).unlockedBy) parts.push(verbById.get(r.verb).unlockedBy);
    if (!parts.every((p) => cost.has(p))) continue;
    const set = new Set([i]);
    for (const p of parts) for (const c of cost.get(p)) set.add(c);
    const cur = cost.get(r.out);
    if (!cur || set.size < cur.size) { cost.set(r.out, set); best.set(r.out, r); changed = true; }
  }
  if (!changed) break;
}

const distinctOf = (id) => {
  const seen = new Set(), stack = [id];
  while (stack.length) {
    const x = stack.pop();
    if (seen.has(x)) continue;
    seen.add(x);
    const r = best.get(x);
    if (r) stack.push(...r.in);
  }
  return seen;
};

// Expanded tree size, with memoised counts so it stays fast on deep items.
const memo = new Map();
function expanded(id) {
  if (starters.has(id)) return { steps: 0, leaves: 1 };
  if (memo.has(id)) return memo.get(id);
  memo.set(id, { steps: 0, leaves: 1 });          // cycle guard
  const r = best.get(id);
  if (!r) return { steps: 0, leaves: 1 };
  let steps = 1, leaves = 0;
  for (const i of r.in) { const s = expanded(i); steps += s.steps; leaves += s.leaves; }
  const out = { steps, leaves };
  memo.set(id, out);
  return out;
}

function leafTally(id) {
  const tally = new Map();
  (function walk(x) {
    if (starters.has(x)) { tally.set(x, (tally.get(x) ?? 0) + 1); return; }
    const r = best.get(x);
    if (!r) return;
    for (const i of r.in) walk(i);
  })(id);
  return tally;
}

function tree(id, prefix = '', last = true, depth = 0, out = []) {
  const r = best.get(id);
  const gesture = !r ? '' : r.verb ? `  ⟵ ${verbById.get(r.verb).emoji} ${verbById.get(r.verb).name}` : '';
  out.push(`${prefix}${depth ? (last ? '└─ ' : '├─ ') : ''}${label(id)}${gesture}`);
  if (!r) return out;
  const kids = r.in;
  kids.forEach((k, i) => tree(k, prefix + (depth ? (last ? '   ' : '│  ') : ''), i === kids.length - 1, depth + 1, out));
  return out;
}

const target = process.argv[2];
if (!target || !byId.has(target)) {
  // Leaderboard: which things have the deepest ancestry?
  const rows = elements.filter((e) => !e.starter).map((e) => ({
    e, d: distinctOf(e.id).size, x: expanded(e.id) }))
    .sort((a, b) => b.x.leaves - a.x.leaves).slice(0, 14);
  console.log('\nThe most expensive things in the game, fully expanded:\n');
  console.log('  raw inputs   distinct   crafts   thing');
  for (const r of rows)
    console.log(`  ${String(r.x.leaves).padStart(10)}   ${String(r.d).padStart(8)}   ${String(r.x.steps).padStart(6)}   ${r.e.emoji} ${r.e.name}`);
  console.log('\n  raw inputs = how many times you touch stone, water, sun or seed');
  console.log('               if nothing is ever reused.\n');
  console.log('  node tools/provenance.mjs <id>   for one thing\n');
} else {
  const d = distinctOf(target), x = expanded(target), tally = leafTally(target);
  console.log(`\n${label(target)}\n`);
  console.log(`  ${x.leaves} raw inputs · ${d.size} distinct ingredients · ${x.steps} crafts fully expanded\n`);
  console.log('  Bottoms out in: ' + [...tally].sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${byId.get(k).emoji} ${byId.get(k).name} ×${n}`).join('   ') + '\n');
  console.log(tree(target).join('\n'));

  // Continue past the starters into what they are actually made of.
  const atoms = new Set();
  for (const leaf of tally.keys()) for (const a of elementAtoms(leaf) ?? []) atoms.add(a);
  if (atoms.size) {
    console.log('\n  ── and below that ──\n');
    for (const leaf of tally.keys()) {
      console.log(`  ${label(leaf)} is made of`);
      for (const p of bedrock.composition[leaf] ?? []) bedrockTree(p, 1).forEach((l) => console.log('  ' + l));
      console.log();
    }
    const syms = [...atoms].map((a) => atomById.get(a).symbol);
    const light = syms.includes('He');
    console.log(`  ${label(target)} is ${atoms.size} chemical elements${light ? ' and starlight' : ''}: ${syms.join(' · ')}\n`);
  }
}
