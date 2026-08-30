#!/usr/bin/env node
/**
 * reactions.mjs — derive each recipe's real physical-reaction category from
 * its own sourced `why` text, and write the result to data/reactions.json.
 *
 * This is presentation-layer scope only: no new gameplay verb, no change to
 * how a merge resolves, no hand-tagging. 1857+ recipes is too many to
 * hand-tag reliably, and a hand-tagged flag is exactly the kind of thing
 * that goes stale the way `terminal`/`soleRoute` already have this session —
 * so this reads the category straight off the prose that's already there,
 * the same "generated, so it can never drift" discipline palette.mjs uses
 * for colour. Change a recipe's why text, rerun this, the category updates
 * itself.
 *
 * Categories are grounded in what the corpus actually says (see BACKLOG.md,
 * "'Sandboxes' — finalized design"), not invented: eight real physical-
 * process keywords, counted across every recipe's own sourced prose.
 * `violent` is carried over unchanged from the recipe's own existing
 * `r.violent` flag (already disciplined — only ever set from a source that
 * says "violent"/"explosive" outright) rather than re-derived, since it's a
 * severity axis, not a physical-process one.
 *
 * Usage:
 *   node tools/reactions.mjs            write data/reactions.json
 *   node tools/reactions.mjs check      report counts, write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const load = (f) => JSON.parse(readFileSync(new URL(`data/${f}`, root), 'utf8'));
const recipes = load('recipes.json');

// Order matters: first match wins, checked most-specific-feeling first so a
// recipe mentioning both "melt" and "boil" (a real possibility in a longer
// why-text describing a multi-stage process) lands on whichever the prose
// leads with rather than an arbitrary later one.
const CATEGORIES = [
  ['freeze',      /\bfreez|\bfrost|\bfrozen\b/i],
  ['crystallize', /\bcrystalli/i],
  ['melt',        /\bmelt|\bmolten\b/i],
  ['boil',        /\bboil|\bevaporat/i],
  ['dissolve',    /\bdissolv/i],
  ['ferment',     /\bferment/i],
  ['corrode',     /\bcorrod|\brust|\boxidi/i],
  ['burn',        /\bburn|\bcombust|\bignit/i],
];

// The same gesture-signature convention validate.mjs's own ambiguity check
// uses (merge: sorted inputs; process: input|verb), extended with the `at`
// temperature band when present — the only way two recipes can otherwise
// share one base signature and still be distinct gestures.
const sigOf = (r) => {
  const base = r.verb ? `${r.in[0]}|${r.verb}` : [...r.in].sort().join('+');
  return r.at !== undefined ? `${base}@${r.at}` : base;
};

const out = {};
const counts = Object.fromEntries(CATEGORIES.map(([c]) => [c, 0]));
counts.violent = 0;
for (const r of recipes) {
  let cat = null;
  if (r.violent) cat = 'violent';
  else {
    for (const [name, re] of CATEGORIES) {
      if (re.test(r.why ?? '')) { cat = name; break; }
    }
  }
  if (!cat) continue;
  out[sigOf(r)] = cat;
  counts[cat]++;
}

const mode = process.argv[2];
if (mode === 'check') {
  console.log(`${recipes.length} recipes, ${Object.keys(out).length} categorised`);
  for (const [cat, n] of Object.entries(counts)) console.log(`  ${cat.padEnd(11)} ${n}`);
  process.exit(0);
}

writeFileSync(new URL('data/reactions.json', root), JSON.stringify(out, null, 2) + '\n');
console.log(`wrote data/reactions.json — ${Object.keys(out).length}/${recipes.length} recipes categorised`);
