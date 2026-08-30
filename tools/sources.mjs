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
const taxonomy = JSON.parse(readFileSync(u('taxonomy.json'), 'utf8'));
const srcFile  = JSON.parse(readFileSync(u('sources.json'), 'utf8'));
const srcMap   = srcFile.map;
const srcUrls  = srcFile.urls ?? {};
const srcGest  = srcFile.gestures ?? {};
// A temperature-banded recipe is its own gesture: heating tempered clay to
// 600°C and to 1,300°C are different acts with different outcomes, so they
// cite different articles. Keyed without the band, the second one would keep
// trying to overwrite the first's source.
const gestureOf = (r) => {
  const base = r.verb ? `${r.in[0]}|${r.verb}` : [...r.in].sort().join('+');
  return r.at !== undefined ? `${base}@${r.at}` : base;
};
const shelf = Object.fromEntries(elements.map((e) => [e.id, e.shelf]));

const API = 'https://en.wikipedia.org/w/api.php';
const UA  = 'WordMatcher-SourceCheck/0.1 (game content verification)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Fetch JSON, retrying on rate limits and transient server errors. */
async function getJSON(url, tries = 6) {
  let wait = 1200;
  for (let n = 1; ; n++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.json();
    const retryable = r.status === 429 || r.status >= 500;
    if (!retryable || n >= tries) throw new Error(`wikipedia api ${r.status}`);
    const after = Number(r.headers.get('retry-after'));
    const pause = Number.isFinite(after) && after > 0 ? after * 1000 : wait;
    console.log(`  ${r.status} from wikipedia — waiting ${Math.round(pause / 1000)}s (try ${n}/${tries})`);
    await sleep(pause);
    wait = Math.min(wait * 2, 30000);
  }
}

async function resolve(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    if (i) await sleep(250);            // pace the batches rather than sprint
    const batch = titles.slice(i, i + 50);
    const url = `${API}?action=query&format=json&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`;
    // The corpus outgrew a naive loop: 500-odd distinct titles fired back to
    // back gets the whole run refused with a 429, and dying on the first one
    // means a content batch cannot be verified at all. Back off and retry —
    // and honour Retry-After when the server bothers to send it.
    const j = await getJSON(url);
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
  ...bedrockNodes.map((n) => n.srcTitle), ...taxonomy.groups.map((g) => g.srcTitle)])];
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

  for (const g of taxonomy.groups) g.src = titleUrl(res.get(g.srcTitle).final);
  writeFileSync(u('taxonomy.json'), JSON.stringify(taxonomy, null, 2) + '\n');
  console.log(`wrote src onto ${taxonomy.groups.length} taxonomy groups`);

  // A `verified` recipe has been read against one specific article. Moving its
  // source silently would leave the audit mark attached to a source nobody
  // checked it against — which is worse than having no mark at all. So apply
  // refuses, and says which entry in sources.json to fix.
  const wouldMove = [];
  for (const r of recipes) {
    const g = srcGest[gestureOf(r)];
    const next = g ? titleUrl(res.get(g).final)
               : srcUrls[r.out] ? srcUrls[r.out]
               : srcMap[r.out] ? titleUrl(res.get(srcMap[r.out]).final) : null;
    if (!next) continue;
    if (r.verified && r.src && r.src !== next) {
      wouldMove.push({ g: gestureOf(r), from: r.src, to: next });
    }
  }
  if (wouldMove.length) {
    console.error(`\nrefusing to apply: ${wouldMove.length} verified recipe(s) would change source.`);
    console.error('An audit mark belongs to the source it was checked against. Add a');
    console.error('`gestures` entry in data/sources.json for each, or clear the verified flag.\n');
    for (const w of wouldMove) console.error(`  ${w.g}\n     has:   ${w.from}\n     would: ${w.to}`);
    process.exit(1);
  }

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
