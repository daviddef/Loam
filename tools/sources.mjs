#!/usr/bin/env node
// Source management. The whole proposition rests on the claims being right, so
// no URL is ever hand-written: titles are resolved against the live Wikipedia
// API and only then turned into links.
//
//   check  — verify every mapped title exists; report missing and redirects
//   apply  — write resolved src URLs into recipes.json
//   report — coverage: which workshop recipes still lack a source
import { readFileSync, writeFileSync } from 'node:fs';

const u = (f) => new URL(`../data/${f}`, import.meta.url);
const recipes  = JSON.parse(readFileSync(u('recipes.json'), 'utf8'));
const elements = JSON.parse(readFileSync(u('elements.json'), 'utf8'));
const bedrock  = JSON.parse(readFileSync(u('bedrock.json'), 'utf8'));
const srcFile  = JSON.parse(readFileSync(u('sources.json'), 'utf8'));
const srcMap   = srcFile.map;
const srcUrls  = srcFile.urls ?? {};
const srcGest  = srcFile.gestures ?? {};
const gestureOf = (r) => r.verb ? `${r.in[0]}|${r.verb}` : [...r.in].sort().join('+');
const shelf = Object.fromEntries(elements.map((e) => [e.id, e.shelf]));

const API = 'https://en.wikipedia.org/w/api.php';
const UA  = 'WordMatcher-SourceCheck/0.1 (game content verification)';

async function resolve(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url = `${API}?action=query&format=json&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`wikipedia api ${r.status}`);
    const j = await r.json();
    const q = j.query ?? {};
    const step = new Map();                       // requested -> current title
    for (const t of batch) step.set(t, t);
    for (const n of q.normalized ?? []) for (const [k, v] of step) if (v === n.from) step.set(k, n.to);
    for (const rd of q.redirects ?? [])  for (const [k, v] of step) if (v === rd.from) step.set(k, rd.to);
    const pages = Object.values(q.pages ?? {});
    for (const [req, final] of step) {
      const page = pages.find((p) => p.title === final);
      out.set(req, {
        exists: !!page && !('missing' in page),
        final: page?.title ?? final,
        redirected: final !== req,
      });
    }
  }
  return out;
}

const titleUrl = (t) => `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;
const cmd = process.argv[2] ?? 'check';

if (cmd === 'report') {
  const work = recipes.filter((r) => shelf[r.out] === 'workshop');
  const missing = work.filter((r) => !r.src);
  console.log(`workshop recipes ${work.length}   with src ${work.length - missing.length}   without ${missing.length}`);
  const verified = recipes.filter((r) => r.verified).length;
  console.log(`claims independently spot-checked: ${verified}`);
  if (missing.length) { console.log('\nmissing a source:'); for (const r of missing) console.log(`  · ${r.out}`); }
  process.exit(missing.length ? 1 : 0);
}

const bedrockNodes = [...bedrock.atoms, ...bedrock.compounds,
  ...(bedrock.aminos ?? []), ...(bedrock.linkages ?? [])];
const titles = [...new Set([...Object.values(srcMap), ...Object.values(srcGest),
  ...bedrockNodes.map((n) => n.srcTitle)])];
console.log(`resolving ${titles.length} distinct titles against en.wikipedia.org …\n`);
const res = await resolve(titles);

const bad = [], moved = [];
for (const t of titles) {
  const r = res.get(t);
  if (!r || !r.exists) bad.push(t);
  else if (r.redirected) moved.push([t, r.final]);
}

if (moved.length) {
  console.log(`${moved.length} title(s) redirect — using the target:`);
  for (const [from, to] of moved) console.log(`  → ${from}  ⇒  ${to}`);
  console.log();
}
if (bad.length) {
  console.log(`${bad.length} TITLE(S) DO NOT EXIST — fix data/sources.json:`);
  for (const t of bad) console.log(`  ✗ ${t}`);
  process.exit(1);
}
console.log(`✓ all ${titles.length} titles resolve to real articles`);

// Primary-source overrides are literal URLs, so check them by request.
const urlEntries = Object.entries(srcUrls);
if (urlEntries.length) {
  console.log(`\nchecking ${urlEntries.length} primary source URL(s) …`);
  const dead = [];
  for (const [id, link] of urlEntries) {
    try {
      const r = await fetch(link, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      console.log(`  ${r.ok ? '✓' : '✗'} ${r.status}  ${id}  ${link}`);
      if (!r.ok) dead.push(id);
    } catch (e) { console.log(`  ✗ ERR  ${id}  ${e.message}`); dead.push(id); }
  }
  if (dead.length) { console.log(`\n${dead.length} unreachable primary source(s)`); process.exit(1); }
}

if (cmd === 'apply') {
  let n = 0;
  for (const node of bedrockNodes) node.src = titleUrl(res.get(node.srcTitle).final);
  writeFileSync(u('bedrock.json'), JSON.stringify(bedrock, null, 2) + '\n');
  console.log(`\nwrote src onto ${bedrockNodes.length} bedrock nodes`);
  for (const r of recipes) {
    const g = srcGest[gestureOf(r)];
    if (g) { r.src = titleUrl(res.get(g).final); n++; continue; }
    if (srcUrls[r.out]) { r.src = srcUrls[r.out]; n++; continue; }
    const t = srcMap[r.out];
    if (!t) continue;
    r.src = titleUrl(res.get(t).final);
    n++;
  }
  writeFileSync(u('recipes.json'), JSON.stringify(recipes, null, 2) + '\n');
  console.log(`\nwrote src onto ${n} workshop recipes`);
}
