#!/usr/bin/env node
/**
 * refresh-docs.mjs — put the live corpus figures back into the prose.
 *
 * These numbers went stale three times in one day: the README's status table
 * had stood at 410 elements since August, and ROADMAP and SOURCES drifted
 * again within hours of being corrected by hand, because a content wave moves
 * them and nobody remembers the prose. Counting is not a thing to remember.
 *
 * It rewrites only lines that state a CURRENT figure. Dated historical
 * measurements are left exactly as they are -- a measurement with a date on it
 * is a record, not a stale claim, and overwriting those would destroy the one
 * thing the roadmap is for.
 *
 * Usage:  node tools/refresh-docs.mjs          rewrite
 *         node tools/refresh-docs.mjs --check  report drift, write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = f => JSON.parse(readFileSync(join(root, f), 'utf8'));
const els = R('data/elements.json'), rec = R('data/recipes.json');
const art = R('data/art.json'), cau = R('data/cautions.json');

const n = x => x.toLocaleString('en-US');
const shelf = c => els.filter(e => e.shelf === c).length;
const merges = rec.filter(r => !r.verb).length;
const outs = new Set(rec.map(r => r.out));
const single = [...outs].filter(o => rec.filter(r => r.out === o).length === 1).length;
const sole = els.filter(e => e.soleRoute).length;
const hazIds = new Set(Object.values(cau.hazards).flatMap(h => h.ids || []));

const F = {
  elements: n(els.length), recipes: n(rec.length),
  workshop: n(shelf('workshop')), folklore: n(shelf('folklore')),
  merges: n(merges), verbs: n(rec.length - merges),
  drawings: n(Object.keys(art).length),
  hazards: n(Object.keys(cau.hazards).length), hazEls: n(hazIds.size),
  ratio: (rec.length / outs.size).toFixed(2),
  single: n(single), sole: n(sole),
};

const EDITS = [
  ['README.md', [
    [/\| Elements \| \*\*[\d,]+\*\* \([\d,]+ workshop · [\d,]+ folklore\) \|/,
     `| Elements | **${F.elements}** (${F.workshop} workshop · ${F.folklore} folklore) |`],
    [/\| Recipes \| \*\*[\d,]+\*\* \([\d,]+ merges · [\d,]+ verb processes\) \|/,
     `| Recipes | **${F.recipes}** (${F.merges} merges · ${F.verbs} verb processes) |`],
    [/\| Reachable \| \*\*[\d,]+ \/ [\d,]+\*\* from the four starters \|/,
     `| Reachable | **${F.elements} / ${F.elements}** from the four starters |`],
    [/\| Sourced \| \*\*[\d,]+ \/ [\d,]+\*\* recipes, every URL machine-verified \|/,
     `| Sourced | **${F.recipes} / ${F.recipes}** recipes, every URL machine-verified |`],
    [/\| Routes per element \| \*\*[\d.]+\*\* · [\d,]+ still needing a second route · [\d,]+ sole-route by design \|/,
     `| Routes per element | **${F.ratio}** · ${F.single} still needing a second route · ${F.sole} sole-route by design |`],
    [/\| Hazards \| \*\*[\d,]+\*\*, covering [\d,]+ elements \|/,
     `| Hazards | **${F.hazards}**, covering ${F.hazEls} elements |`],
    [/\| Drawings \| \*\*[\d,]+\*\*, none of them emoji \|/,
     `| Drawings | **${F.elements}**, none of them emoji |`],
  ]],
  ['SOURCES.md', [
    [/The corpus stands at \*\*[\d,]+ elements \/ [\d,]+ recipes\*\*/,
     `The corpus stands at **${F.elements} elements / ${F.recipes} recipes**`],
  ]],
  ['ROADMAP.md', [
    [/current state is [\d,]+ elements \/ [\d,]+ recipes/,
     `current state is ${F.elements} elements / ${F.recipes} recipes`],
  ]],
];

let drift = 0;
for (const [file, subs] of EDITS) {
  const p = join(root, file);
  let text = readFileSync(p, 'utf8');
  const before = text;
  for (const [re, to] of subs) {
    if (!re.test(text)) { console.error(`  ✗ ${file}: pattern not found — ${re}`); process.exitCode = 1; continue; }
    text = text.replace(re, to);
  }
  if (text !== before) {
    drift++;
    if (!process.argv.includes('--check')) writeFileSync(p, text);
    console.log(`  ${process.argv.includes('--check') ? 'stale' : 'updated'}  ${file}`);
  } else console.log(`  current ${file}`);
}
console.log(`\n  ${F.elements} elements · ${F.recipes} recipes · ${F.drawings} drawings · ${F.hazards} hazards`);
if (process.argv.includes('--check') && drift) {
  console.error(`\n  ${drift} file(s) state a figure the data does not — run without --check`);
  process.exitCode = 1;
}
