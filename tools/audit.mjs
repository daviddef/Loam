#!/usr/bin/env node
/**
 * audit.mjs — check the numbers in our own prose against the article we cited.
 *
 * This project's central claim is that confident, fluent prose is wrong far
 * more often than it feels: auditing 70 claims by hand found 17 of them wrong,
 * a 36% first-pass error rate. That argument applies to everything written
 * here, so the numbers get checked mechanically rather than re-read.
 *
 * What it does: pulls the plain text of each cited article and asks whether the
 * numbers in our sentence actually appear in it. What it does NOT do: decide
 * whether a claim is true. A number appearing in the article is weak evidence —
 * it might be about something else entirely. A number NOT appearing is the
 * useful signal, because it means the sentence is asserting something its own
 * source does not say, and that is where every one of the seventeen errors was.
 *
 * Usage:  node tools/audit.mjs            check every unverified numeric claim
 *         node tools/audit.mjs --all      include the ones already verified
 *         node tools/audit.mjs <id>       just this output
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recipes = JSON.parse(readFileSync(join(root, 'data/recipes.json'), 'utf8'));

const API = 'https://en.wikipedia.org/w/api.php';
const cache = new Map();

/** Plain text of an article, by title, cached for the run. */
// One request at a time with a short gap. Hammering the API gets you throttled,
// and a throttled run reports every claim as "could not be checked" — which
// looks exactly like a clean result if you are not paying attention. That is a
// worse failure than an error.
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;

async function articleText(title) {
  if (cache.has(title)) return cache.get(title);
  const url = `${API}?action=query&prop=extracts&explaintext=1&redirects=1&format=json` +
              `&titles=${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(2500 * attempt);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Loam/1.0 (source audit; contact via repo)' } });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) break;
      const j = await res.json();
      const page = Object.values(j?.query?.pages || {})[0];
      const text = page && page.extract ? page.extract : null;
      cache.set(title, text);
      await sleep(700);
      return text;
    } catch { /* retry */ }
  }
  failures++;
  cache.set(title, null);
  return null;
}

const titleOf = src => {
  const m = /en\.wikipedia\.org\/wiki\/([^#?]+)/.exec(src || '');
  return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
};

/**
 * The numbers worth checking. Bare small integers are skipped — "two",
 * "the four starters", "3 bonds" are structural, not factual claims, and
 * flagging them buries the ones that matter.
 */
function numbersIn(text) {
  const out = [];
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(%|°\s*C|°\s*F|degrees|million|billion|thousand|times|years?|000)?/gi;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[1].replace(/,/g, '');
    const n = parseFloat(raw);
    if (!isFinite(n)) continue;
    if (n < 10 && !m[2]) continue;                 // bare small integers: skip
    out.push({ n, unit: (m[2] || '').replace(/\s+/g, ''), shown: m[0].trim() });
  }
  return out;
}

/** Does this number appear in the article, in any of its usual spellings? */
function articleHas(text, num) {
  const n = num.n;
  const forms = new Set();
  const plain = n % 1 === 0 ? String(n) : String(n);
  forms.add(plain);
  if (n >= 1000 && n % 1 === 0) {                  // 1700 and 1,700
    forms.add(plain.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  }
  if (n >= 1e6 && n % 1e6 === 0) forms.add(`${n / 1e6} million`);
  if (n >= 1e9 && n % 1e9 === 0) forms.add(`${n / 1e9} billion`);
  for (const f of forms) {
    // Word-boundary match so 50 does not match inside 1950.
    if (new RegExp(`(?<![\\d,.])${f.replace('.', '\\.')}(?![\\d,])`).test(text)) return true;
  }
  return false;
}

const only = process.argv.find(a => !a.startsWith('--') && !a.endsWith('.mjs') && !a.includes('node'));
const includeVerified = process.argv.includes('--all');

let subject = recipes.filter(r => /\d/.test(r.why) && (includeVerified || !r.verified));
if (only) subject = recipes.filter(r => r.out === only && /\d/.test(r.why));

console.log(`  checking ${subject.length} numeric claim(s) against their cited articles\n`);

const unsupported = [], noSource = [], checked = [];
for (const r of subject) {
  const title = titleOf(r.src);
  if (!title) { noSource.push({ r, why: 'source is not a Wikipedia article' }); continue; }
  const text = await articleText(title);
  if (!text) { noSource.push({ r, why: `could not fetch "${title}"` }); continue; }
  const nums = numbersIn(r.why);
  if (!nums.length) continue;
  const missing = nums.filter(x => !articleHas(text, x));
  checked.push(r);
  if (missing.length) {
    unsupported.push({ r, title, missing, total: nums.length });
  }
}

for (const u of unsupported) {
  const gesture = u.r.verb ? `${u.r.in[0]} |${u.r.verb}` : u.r.in.join(' + ');
  console.log(`  ${gesture} → ${u.r.out}`);
  console.log(`    cited: ${u.title}`);
  console.log(`    not in that article: ${u.missing.map(m => m.shown).join(', ')}`);
  console.log(`    "${u.r.why}"\n`);
}

console.log(`  ${checked.length} claim(s) checked`);
console.log(`  ${unsupported.length} assert a number their own source does not contain`);
if (noSource.length) {
  console.log(`  ${noSource.length} could not be checked:`);
  for (const n of noSource) console.log(`      ${n.r.out.padEnd(22)} ${n.why}`);
}
if (failures) {
  console.error(`\n  ${failures} article fetch(es) failed after retries — this run is INCOMPLETE.`);
  process.exitCode = 1;
}
console.log(`\n  A number missing from the article does not make the claim false — it means`);
console.log(`  the sentence is going further than the source it names. Every one of the`);
console.log(`  seventeen errors found by hand looked exactly like this.`);
