#!/usr/bin/env node
/* PROPOSES A SOURCE. DOES NOT APPLY ONE.
 *
 * 276 hazard notes cite nothing, and finding a candidate article for each by
 * hand costs three or four steps before any reading begins. This does the
 * mechanical part: derive likely Wikipedia titles from the hazard's own
 * element ids, fetch them, and report which ones carry every figure and every
 * standards body the note asserts.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: write the source into data/cautions.json.
 *
 * That restraint is the whole design. This session has now watched a checker
 * pass a tornado's "300" that was miles rather than kilometres, a belladonna
 * seed dose that was really an FDA date, a toxic-shock year belonging to a
 * different disease in the same paragraph, and an effects row describing
 * leopards and cougars while citing an article about tigers. Every one of
 * those passed a vocabulary check. **A tool can verify that the words are
 * present. It cannot verify that the article is about the right thing.**
 *
 * So a ✓ here means "worth reading", never "correct". The reading is still the
 * job, and the note still has to be rewritten to what the article says.
 *
 *   node tools/cautions-suggest.mjs            propose for every unsourced entry
 *   node tools/cautions-suggest.mjs --limit 40 the first 40, risk-sorted
 *   node tools/cautions-suggest.mjs <id> […]   just these hazards
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = p => JSON.parse(readFileSync(join(ROOT, 'data', p), 'utf8'));
const C = D('cautions.json');
const elements = D('elements.json');
const byId = new Map(elements.map(e => [e.id, e]));

const argv = process.argv.slice(2);
const LIMIT = (() => { const i = argv.indexOf('--limit'); return i < 0 ? 0 : Number(argv[i + 1]) || 0; })();
const ONLY = argv.filter(a => !a.startsWith('--') && !/^\d+$/.test(a));

/* The same figure and authority tests tools/cautions-audit.mjs applies, so a
 * candidate that passes here passes there. Kept in step by hand; if they ever
 * drift, the audit is the one that counts. */
const figuresIn = t => [...new Set([...String(t).matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g)]
  .map(m => m[0].replace(/,/g, ''))
  .filter(r => { const v = Number(r); return Number.isFinite(v) && !(v < 10 && Number.isInteger(v)); }))];
const ungroup = t => t.replace(/(\d{1,3})(?:[,    ](\d{3}))+/g,
  m => m.replace(/[,    ]/g, ''));
const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const word = v => !Number.isInteger(v) || v < 0 ? null
  : v < 20 ? ONES[v] : v < 100 ? TENS[Math.floor(v / 10)] + (v % 10 ? `[ -]${ONES[v % 10]}` : '')
  : v < 1000 && v % 100 === 0 ? `${ONES[v / 100]} hundred` : null;
const has = (t, raw) => {
  const v = Number(raw);
  if (new RegExp(`\\b${raw.replace('.', '\\.')}\\b`).test(t)) return true;
  if (t.includes(v.toLocaleString('en-US'))) return true;
  if (new RegExp(`\\b${raw.replace('.', '\\.')}\\b`).test(ungroup(t))) return true;
  const w = word(v);
  return !!(w && new RegExp(`\\b${w}\\b`, 'i').test(t));
};
const BODIES = { IARC: 'International Agency for Research on Cancer', NIOSH: 'National Institute for Occupational Safety and Health',
  OSHA: 'Occupational Safety and Health Administration', WHO: 'World Health Organi[sz]ation', EPA: 'Environmental Protection Agency',
  FDA: 'Food and Drug Administration', EFSA: 'European Food Safety Authority', CDC: 'Centers for Disease Control',
  ATSDR: 'Agency for Toxic Substances and Disease Registry', NTP: 'National Toxicology Program',
  USDA: 'Department of Agriculture', FAO: 'Food and Agriculture Organization', ECHA: 'European Chemicals Agency' };

/** Likely article titles for a hazard, best guess first. */
function candidates(h) {
  const out = [];
  const push = t => { if (t && !out.includes(t)) out.push(t); };
  // The elements it attaches to are the strongest signal: a caution about
  // `bartonella_henselae` is nearly always documented under that name.
  for (const id of h.ids || []) {
    const e = byId.get(id);
    if (e && e.name) push(e.name.replace(/\s+/g, '_'));
    push(id.split('_').map((w, i) => i === 0 ? w[0].toUpperCase() + w.slice(1) : w).join('_'));
  }
  // Then any capitalised multi-word phrase in the note — binomials, named
  // diseases, named agencies' own subjects.
  for (const m of (h.note || '').matchAll(/\b([A-Z][a-z]+(?:\s+[a-z]+){0,2})\b/g)) {
    const t = m[1].trim();
    if (t.split(/\s+/).length >= 2 && !/^The |^A |^An |^In |^It /.test(t)) push(t.replace(/\s+/g, '_'));
  }
  return out.slice(0, 4);
}

/* WHEN THE IDS ARE NOT ENOUGH, ASK WIKIPEDIA.
 *
 * The id heuristic is a good first guess and no more. `benzoate_ascorbate_benzene`
 * was sent to Sodium benzoate, where its dates were absent and its 10 matched
 * "benzoic acid (E210)" — while every one of its figures sits in its own
 * sentence of **Benzene in soft drinks**, a title no element id could produce.
 * Polar bear attacks live in **Bear attack**; the Caruaru dialysis outbreak
 * lives in **Microcystin-LR**.
 *
 * So when no id-derived candidate carries everything, search for the note's
 * own distinctive words and try what comes back. Still a proposal; still read
 * before it is used. */
async function searched(h) {
  // The note's own rare words make a better query than its element ids: proper
  // nouns and technical terms, minus the ordinary vocabulary of a warning.
  const STOP = /^(the|and|that|with|from|this|which|where|when|what|their|there|about|into|over|under|after|before|between|through|people|person|cases|risk|than|most|more|some|also|only|other|every|each|been|were|have|has|its|it|is|are|was|not|but|for|per|can|may|does|do|a|an|of|in|on|to|by|as|at|or|if|so)$/i;
  const words = [...new Set((h.note || '').split(/[^\p{L}\p{N}-]+/u)
    .filter(w => w.length > 4 && !STOP.test(w)))].slice(0, 6);
  if (!words.length) return [];
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(words.join(' '))}&srlimit=3&format=json&formatversion=2`,
      { headers: { 'User-Agent': 'Loam/1.0 (hazard source audit; contact via repo)' } });
    const j = await r.json();
    return (j.query?.search || []).map(x => x.title.replace(/\s+/g, '_'));
  } catch { return []; }
}

const CACHE = join(ROOT, 'data', 'cautions-sources.json.gz');
let cache = {};
if (existsSync(CACHE)) { try { cache = JSON.parse(gunzipSync(readFileSync(CACHE)).toString('utf8')); } catch { } }
let dirty = false;

async function article(title) {
  const url = `https://en.wikipedia.org/wiki/${title}`;
  if (cache[url]) return cache[url];
  for (let a = 0; a < 2; a++) {
    if (a) await new Promise(r => setTimeout(r, 2500));
    try {
      const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`,
        { headers: { 'User-Agent': 'Loam/1.0 (hazard source audit; contact via repo)' } });
      const b = await r.text();
      if (!b.trimStart().startsWith('{')) continue;
      const pg = JSON.parse(b).query.pages[0];
      const text = pg.missing ? '' : (pg.extract || '');
      if (text && text.length >= 1200) { cache[url] = text; dirty = true; return text; }
      return null;
    } catch { }
  }
  return null;
}

const risk = h => figuresIn(h.note || '').length;
let rows = Object.entries(C.hazards).filter(([, h]) => !h.src);
if (ONLY.length) rows = rows.filter(([id]) => ONLY.includes(id));
rows.sort((a, b) => (risk(b[1]) - risk(a[1])) || ((b[1].ids || []).length - (a[1].ids || []).length));
if (LIMIT) rows = rows.slice(0, LIMIT);

console.log(`\nPROPOSING SOURCES FOR ${rows.length} UNSOURCED HAZARD(S)`);
console.log(`A tick means the article carries every figure and body the note asserts.`);
console.log(`It does NOT mean the article is about the right subject — read it.\n`);

let hits = 0;
for (const [id, h] of rows) {
  const figs = figuresIn(h.note || '');
  const auths = Object.keys(BODIES).filter(a => new RegExp(`\\b${a}\\b`).test(h.note || ''));
  const found = [];
  let titles = candidates(h);
  for (const t of titles) {
    const text = await article(t);
    await new Promise(r => setTimeout(r, 350));
    if (!text) continue;
    const missF = figs.filter(f => !has(text, f));
    const missA = auths.filter(a => !(new RegExp(`\\b${a}\\b`, 'i').test(text) || new RegExp(BODIES[a], 'i').test(text)));
    found.push({ t, missF, missA, ok: !missF.length && !missA.length });
  }
  // Nothing from the ids carried everything — ask search before giving up.
  if (!found.some(f => f.ok)) {
    for (const t of await searched(h)) {
      if (titles.includes(t)) continue;
      const text = await article(t);
      await new Promise(r => setTimeout(r, 350));
      if (!text) continue;
      const missF = figs.filter(f => !has(text, f));
      const missA = auths.filter(a => !(new RegExp(`\\b${a}\\b`, 'i').test(text) || new RegExp(BODIES[a], 'i').test(text)));
      found.push({ t, missF, missA, ok: !missF.length && !missA.length, via: 'search' });
      if (!missF.length && !missA.length) break;
    }
  }
  /* Show the closest candidate, not the first one tried — otherwise a search
   * result that missed one figure is hidden behind an id guess that missed
   * five, and the report sends you back to the worse article. */
  const miss = f => (f.missF?.length || 0) + (f.missA?.length || 0);
  const best = found.find(f => f.ok)
    || found.slice().sort((a, b) => miss(a) - miss(b))[0];
  if (best?.ok) hits++;
  const mark = best?.ok ? '✓' : best ? '·' : '✗';
  console.log(`${mark} ${id}  [${figs.length} figure(s)${auths.length ? ', ' + auths.join('/') : ''}]`);
  if (!best) { console.log(`     no candidate article readable — needs a hand search`); continue; }
  console.log(`     ${best.t}${best.via ? ' (via search)' : ''}${best.ok ? '  — carries everything asserted' : ''}`);
  if (best.missF?.length) console.log(`     missing figures: ${best.missF.join(', ')}`);
  if (best.missA?.length) console.log(`     missing bodies: ${best.missA.join(', ')}`);
}
if (dirty) writeFileSync(CACHE, gzipSync(JSON.stringify(cache)));
console.log(`\n  ${hits} of ${rows.length} have a candidate carrying every assertion.`);
console.log(`  That is where to start reading, not where to stop.\n`);
