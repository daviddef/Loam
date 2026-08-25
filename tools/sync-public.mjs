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
  'data/bedrock.json',
  'data/sources.json',
  'data/art.json',
  'data/palette.json',
  'data/scale.json',
  'data/cautions.json',
  'data/vendor/README.md',
  'data/vendor/munsell-real.dat',
  'prototype/template.html',
  'prototype/art-render.js',
  'prototype/index.html',
  'tools/build-prototype.mjs',
  'tools/validate.mjs',
  'tools/sources.mjs',
  'tools/discover.mjs',
  'tools/graph.mjs',
  'tools/provenance.mjs',
  'tools/redundancy.mjs',
  'tools/palette.mjs',
  'tools/art.mjs',
  'tools/scale.mjs',
  'tools/strip.mjs',
  'tools/safety.mjs',
  'tools/contact-sheet.mjs',
  'tools/sync-public.mjs',
];

/** Anything matching these must never reach the public repo. */
const NEVER = [/^RESEARCH\.md$/, /^ROADMAP\.md$/, /^BACKLOG\.md$/, /^DESIGN\.md$/,
               /^roadmap\.page\.html$/, /^icons\.html$/, /notes/i, /private/i,
               /^strip\.html$/, /^chain-preview\.html$/];

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
    if (name === '.git' || name === 'node_modules' || name === '.DS_Store') continue;
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
