#!/usr/bin/env node
// Discoverability harness.
//
// Blind pair-guessing has a 0.8% hit rate on this graph, so "drag things
// together and see" collapses into brute force. This simulates play under
// different assist policies and reports what each one actually costs the
// player, so the mechanic gets chosen on evidence rather than taste.
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const elements = load('elements.json');
const recipes  = load('recipes.json');
const { verbs } = load('verbs.json');

const byId = new Map(elements.map((e) => [e.id, e]));
const STARTERS = elements.filter((e) => e.starter).map((e) => e.id);
const CAP = 3_000_000;      // attempt ceiling per trial
const TRIALS = Number(process.argv[3]) || 12;

const merges = new Map(), procs = new Map();
for (const r of recipes) {
  if (r.verb) procs.set(`${r.in[0]}|${r.verb}`, r.out);
  else merges.set([...r.in].sort().join('+'), r.out);
}
const shareTag = (a, b) => byId.get(a).tags.some((t) => byId.get(b).tags.includes(t));

// How many undiscovered recipes does this element still take part in?
function secretsFor(id, found, unlocked) {
  let n = 0;
  for (const r of recipes) {
    if (found.has(r.out)) continue;
    if (r.verb && !unlocked.has(r.verb)) continue;
    if (!r.in.includes(id)) continue;
    if (!r.in.every((i) => found.has(i))) continue;
    n++;
  }
  return n;
}

function trial(policy) {
  const found = new Set(STARTERS);
  const unlocked = new Set(verbs.filter((v) => !v.unlockedBy).map((v) => v.id));
  const tried = new Set();
  let attempts = 0, stall = 0;

  // State only changes on a discovery, so the live set is recomputed then,
  // not on every attempt.
  let pool = [...found], live = pool, dirty = true;
  const refresh = () => {
    pool = [...found];
    live = pool;
    if (policy !== 'blind') {
      const counts = new Map(pool.map((id) => [id, secretsFor(id, found, unlocked)]));
      live = pool.filter((id) => counts.get(id) > 0);
      if (policy === 'counts' && live.length) {      // prefer the richest veins
        live.sort((a, b) => counts.get(b) - counts.get(a));
        live = live.slice(0, Math.max(4, Math.ceil(live.length / 3)));
      }
    }
    dirty = false;
  };

  while (found.size < elements.length && attempts < CAP) {
    if (dirty) refresh();
    if (!live.length) break;                         // genuinely stuck

    // Pick one gesture.
    let sig, resolve;
    const useVerb = Math.random() < unlocked.size / (unlocked.size + live.length);
    if (useVerb) {
      const a = live[(Math.random() * live.length) | 0];
      const v = [...unlocked][(Math.random() * unlocked.size) | 0];
      sig = `${a}|${v}`; resolve = () => procs.get(sig);
    } else {
      const a = live[(Math.random() * live.length) | 0];
      let b = pool[(Math.random() * pool.length) | 0];
      if (policy === 'tags') {                        // only try plausible pairs
        const mates = pool.filter((x) => shareTag(a, x));
        if (!mates.length) { attempts++; continue; }
        b = mates[(Math.random() * mates.length) | 0];
      }
      sig = [a, b].sort().join('+'); resolve = () => merges.get(sig);
    }

    // Players remember failures. If a policy keeps proposing gestures it has
    // already tried, its reachable space is exhausted — stop rather than spin.
    if (tried.has(sig)) { if (++stall > 50_000) break; continue; }
    stall = 0;
    tried.add(sig);
    attempts++;
    const out = resolve();
    if (out && !found.has(out)) {
      found.add(out);
      for (const v of verbs) if (v.unlockedBy === out) unlocked.add(v.id);
      dirty = true;
    }
  }
  return { attempts, found: found.size };
}

const POLICIES = {
  blind:  'Baseline — any two things you own',
  tags:   'Only pairs that share a tag',
  live:   'Only elements that still have something to give',
  counts: 'Live, and weighted to the richest',
};

const which = process.argv[2];
const run = which && POLICIES[which] ? [which] : Object.keys(POLICIES);

console.log(`\n${TRIALS} trials per policy, ${elements.length} elements to find\n`);
console.log('policy    found   attempts   per find   ' + 'description');
console.log('─'.repeat(78));
const results = {};
for (const p of run) {
  const rs = Array.from({ length: TRIALS }, () => trial(p));
  const found = rs.reduce((s, r) => s + r.found, 0) / TRIALS;
  const att   = rs.reduce((s, r) => s + r.attempts, 0) / TRIALS;
  results[p] = { found, att, per: att / (found - STARTERS.length) };
  console.log(
    `${p.padEnd(9)} ${found.toFixed(0).padStart(4)}   ${Math.round(att).toLocaleString().padStart(8)}   ` +
    `${results[p].per.toFixed(1).padStart(7)}   ${POLICIES[p]}`);
}
if (results.blind && results.counts) {
  console.log(`\n  counts is ${(results.blind.per / results.counts.per).toFixed(1)}× cheaper per discovery than blind guessing.`);
}

// Does the "secrets remaining" number give the game away?
const found = new Set(STARTERS), unlocked = new Set(['wait', 'crush', 'chill']);
for (const r of recipes.slice(0, 60)) if (r.in.every((i) => found.has(i))) found.add(r.out);
const dist = [...found].map((id) => secretsFor(id, found, unlocked)).sort((a, b) => b - a);
console.log(`\nSecrets-remaining spread at a mid-game state (${found.size} elements held):`);
console.log(`  live elements ${dist.filter((n) => n > 0).length}/${dist.length}   max ${dist[0]}   median ${dist[dist.length >> 1]}`);
console.log(`  → the number narrows the field without naming a partner.\n`);
