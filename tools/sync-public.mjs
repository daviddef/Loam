#!/usr/bin/env node
/**
 * sync-public.mjs — copy the public half of the project into the public clone.
 *
 * The split is by allow-list, never by deny-list. A deny-list fails silently
 * the first time a new private file appears; an allow-list fails loudly, which
 * is the only acceptable failure mode when the consequence is publishing a
 * document that was meant to stay private.
 *
 * Usage:  node tools/sync-public.mjs <path-to-public-clone> [--check]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = [
  'LICENSE',
  'README.md',
  'guide.html',
  'index.html',
  '.gitignore',
  'brand/README.md',
  'brand/icon.svg',
  'brand/icon-variants.html',
  'brand/directions.html',
  'brand/contact-sheet.html',
  'data/elements.json',
  'data/recipes.json',
  'data/verbs.json',
  'data/families.json',
  'data/places.json',
  'data/inert.json',
  'data/bedrock.json',
  'data/taxonomy.json',
  'data/needs.json',
  'data/pathogens.json',
  'data/conditions.json',
  'data/sources.json',
  'data/art.json',
  'data/palette.json',
  'data/scale.json',
  'data/cautions.json',
  'data/labels.json',
  'data/allergens.json',
  'data/reactions.json',
  'data/vendor/README.md',
  'data/vendor/munsell-real.dat',
  'prototype/template.html',
  'prototype/art-render.js',
  'prototype/index.html',
  // The payload split: index.html carries the graph, these two arrive after.
  'prototype/prose.json',
  'prototype/art.json',
  'prototype/manifest.json',
  'prototype/icon-180.png',
  'prototype/icon-192.png',
  'prototype/icon-512.png',
  'prototype/vendor/README.md',
  'prototype/vendor/zxing-reader.iife.js',
  'prototype/vendor/zxing_reader.wasm',
  'prototype/vendor/tess/tesseract.min.js',
  'prototype/vendor/tess/worker.min.js',
  'prototype/vendor/tess/tesseract-core-simd-lstm.wasm.js',
  'prototype/vendor/tess/eng.traineddata.gz',
  'tools/build-prototype.mjs',
  'tools/validate.mjs',
  'tools/refresh-docs.mjs',
  'tools/sources.mjs',
  'tools/discover.mjs',
  'tools/graph.mjs',
  'tools/provenance.mjs',
  'tools/redundancy.mjs',
  'tools/palette.mjs',
  'tools/art.mjs',
  'tools/scale.mjs',
  'tools/reactions.mjs',
  'tools/strip.mjs',
  'tools/safety.mjs',
  'tools/derivation.mjs',
  'tools/backbone.mjs',
  'tools/universe.mjs',
  'tools/categories.mjs',
  'tools/places.mjs',
  'tools/guide.mjs',
  'tools/needs.mjs',
  'tools/verbs.mjs',
  'tools/pathogens.mjs',
  'tools/conditions.mjs',
  'tools/audit.mjs',
  'tools/contact-sheet.mjs',
  'tools/sync-public.mjs',
];

/** Anything matching these must never reach the public repo. */
const NEVER = [/^RESEARCH.*\.md$/, /^research\//, /^LEADS.*\.md$/, /^ROADMAP\.md$/, /^BACKLOG.*\.md$/, /^DESIGN.*\.md$/, /^SOURCES\.md$/,
               /^roadmap\.page\.html$/, /^icons\.html$/, /notes/i, /private/i,
               // QUEUE.md is the outstanding-work list: it names unopened
               // sources, unfixed faults and commercial roadmap items.
               /^QUEUE\.md$/,
               // Everything under docs/ and archive/ is private by definition
               // -- design notes, research, and superseded one-offs. These two
               // rules exist because the patterns above are anchored to the
               // repository root (^DESIGN, ^RESEARCH, ^roadmap.page.html), so
               // moving those files into folders on 3 Sep silently took them
               // out of scope. The sync refused rather than publishing them,
               // which is exactly what it is for; anchoring the folders too is
               // what makes a future move safe.
               /^docs\//, /^archive\//,
               /^strip\.html$/, /^chain-preview\.html$/, /^build-notes\.html$/,
               /^tools\/session-report\.mjs$/,
               // Merges RESEARCH-*.md batches, which are private by definition.
               // The tool leaks nothing by itself, but it is machinery for a
               // workflow the public repo does not have the inputs for.
               /^tools\/integrate-research\.mjs$/,
               // Raw third-party bulk datasets dropped into the working tree
               // for research (FoodDB, Open Food Facts) — many gigabytes,
               // under their own licences, and never meant to ship. Already
               // gitignored; listed here too so sync-public refuses loudly
               // rather than silently skipping them if that ever changes.
               /^foodb_.*\//, /^openfoodfacts\//,
               // A local cache of Wikipedia title resolutions, rebuilt on
               // demand and expiring after thirty days. Derived, churns on
               // every run, and stale the moment it is committed.
               /^data\/sources-cache\.json$/,
               // The user's own kitchen photos, used to hand-verify the
               // barcode scanner against real products — personal, not code.
               /^test barcode images\//];

const dest = process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!dest) { console.error('usage: node tools/sync-public.mjs <path-to-public-clone> [--check]'); process.exit(1); }

const root = fileURLToPath(new URL('..', import.meta.url));

/* Guard one: nothing on the list may match the never-publish patterns. */
for (const f of PUBLIC) {
  if (NEVER.some(re => re.test(f))) { console.error(`refusing: "${f}" is on the never-publish list`); process.exit(1); }
}

/* Guard two: every listed file must exist, so a rename cannot silently drop
 * a file from the published build. */
const absent = PUBLIC.filter(f => !existsSync(join(root, f)));
if (absent.length) { console.error(`missing locally: ${absent.join(', ')}`); process.exit(1); }

/* Guard three: report anything in the working tree that is on neither list,
 * so new files are a decision rather than an oversight. */
function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(join(root, dir || '.'))) {
    // Build output and caches are not files anyone decided about. .claude is
    // Claude Code's own working directory — session state, and (via `git
    // worktree`) full ephemeral checkouts of this very repo used for
    // isolating parallel background research batches. Neither is project
    // content; walking into a live worktree here just re-discovers every
    // file in the repo a second time, unclassified, and refuses to sync.
    if (['.git', '.claude', 'node_modules', '.DS_Store', '.cache', 'words.csv'].includes(name)) continue;
    const rel = base ? `${base}/${name}` : name;
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel, rel));
    else out.push(rel);
  }
  return out;
}
const all = walk('');
const unclassified = all.filter(f => !PUBLIC.includes(f) && !NEVER.some(re => re.test(f)));
// An unclassified file is a decision that has not been made yet, so it stops
// the sync rather than printing a warning nobody reads. Warning-and-continuing
// is how a private file eventually ships.
if (unclassified.length) {
  console.error(`  ${unclassified.length} file(s) on neither list — add each to PUBLIC or NEVER:`);
  unclassified.forEach(f => console.error(`    ${f}`));
  process.exit(1);
}

if (checkOnly) { console.log(`  ${PUBLIC.length} files would be published`); process.exit(0); }

let copied = 0;
for (const f of PUBLIC) {
  const src = readFileSync(join(root, f));
  const dst = join(dest, f);
  mkdirSync(dirname(dst), { recursive: true });
  if (!existsSync(dst) || !readFileSync(dst).equals(src)) { writeFileSync(dst, src); copied++; }
}
console.log(`  synced ${copied} changed file(s) of ${PUBLIC.length} into ${dest}`);
