#!/usr/bin/env node
/* DOES THE HAZARD NOTE'S SOURCE ACTUALLY SAY THIS?
 *
 * Every recipe in this corpus carries a source, and tools/audit.mjs checks the
 * cited article supports it. Every effect row carries a source, and
 * tools/effects-audit.mjs checks the same. The hazard layer carried neither.
 *
 * Of 343 entries in data/cautions.json, 25 cited anything at all, and 220 of
 * the notes assert a number that nothing had ever checked. One of them says
 * "IARC places it in Group 2B, possibly carcinogenic to humans" — true, as it
 * happens, and no part of this repo knew it. Nothing would have caught it had
 * it been false.
 *
 * This is the safety layer. It is the worst possible place for the project's
 * central claim to go unenforced, and it is the layer a reader is most
 * entitled to check.
 *
 * WHAT IT PROVES AND WHAT IT DOES NOT. Same asymmetry the other two audits are
 * built on: a figure appearing in the source is weak evidence, because it may
 * be there about something else entirely. A figure NOT appearing is the useful
 * signal, because the note is then asserting something its own source does not
 * say. This tool is built around the absence.
 *
 * Three checks per entry:
 *   sourced       the entry cites something at all
 *   figures       numbers in the note appear in the cited source
 *   authorities   a standards body the note names is named by the source too
 *
 * The authorities check is the one the other audits cannot do. tools/audit.mjs
 * deliberately skips any word with a capital inside it, because NaOH and HCl
 * were being reported as people — which means IARC, NIOSH, OSHA and WHO are
 * invisible to it. In recipe prose that is the right call. In a safety note,
 * "NIOSH states" IS the claim, and a note attributing a limit to a body its own
 * source never mentions is the exact fault this repo keeps finding in itself.
 *
 * WHY IT READS MORE THAN WIKIPEDIA. The right source for a hazard is usually
 * not an encyclopedia: it is CDC/NIOSH, a PMC paper, a poisons centre, a
 * veterinary reference. So this reads any URL, not just Wikipedia titles. Some
 * hosts answer 200 with a 165-character consent gate instead of the paper —
 * treated as NOT CHECKED, never as a page that failed to contain anything,
 * because flagging every figure in a note whose source we could not read would
 * bury the real faults under noise.
 *
 *   node tools/cautions-audit.mjs              audit every sourced entry
 *   node tools/cautions-audit.mjs <id> […]     just these hazards
 *   node tools/cautions-audit.mjs --unsourced  the worklist: entries citing nothing
 *   node tools/cautions-audit.mjs --strict     exit 1 on any unsupported entry
 *   node tools/cautions-audit.mjs --offline    read only what is already cached
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { articleText, titleOf, stats } from './lib/wiki.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = p => JSON.parse(readFileSync(join(ROOT, 'data', p), 'utf8'));
const n = x => x.toLocaleString('en-US');

const C = D('cautions.json');
const HAZ = C.hazards || {};

const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const OFFLINE = argv.includes('--offline');
const LIST_UNSOURCED = argv.includes('--unsourced');
const ONLY = argv.filter(a => !a.startsWith('--'));

/* A page we have already read. Re-reading 343 sources on every run would be
 * slow and rude, and an audit nobody runs twice is an audit that rots. */
const CACHE = join(ROOT, 'data', 'cautions-sources.json.gz');
let cache = {};
if (existsSync(CACHE)) {
  try { cache = JSON.parse(gunzipSync(readFileSync(CACHE)).toString('utf8')); }
  catch { cache = {}; }
}
let cacheDirty = false;

/* Below this, a 200 is not an article. PMC and NCBI Books answer some requests
 * with a 165-character gate; a journal paywall answers with an abstract stub.
 * Either way we have not read the source, and saying so is the only honest
 * result — a short page would otherwise report every figure as missing. */
const TOO_SHORT = 1200;

const UA = 'Loam/1.0 (hazard source audit; contact via repo)';

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The text of whatever a note cites, or null if we could not read it.
 *
 * NEVER CACHE A FAILURE. The first version wrote `null` into the cache when a
 * fetch was gated, and the next run read that null back as a settled answer —
 * so pages that had read perfectly well minutes earlier (72,000 characters of
 * nematocyst paper, 579,000 of the EFSA opinion) became permanently NOT
 * CHECKED. A transient gate had been promoted to a fact about the source.
 *
 * That is the same shape as every other fault this repo keeps finding: a gap
 * recorded as a result. Only successes are cached, so a NOT CHECKED is always
 * re-attempted and the number can only improve. */
async function sourceText(url) {
  if (cache[url]) return cache[url];
  if (OFFLINE) return null;
  const title = titleOf(url);
  if (title) {
    // A Wikipedia citation goes through the shared library, which already
    // handles redirects, the API's shapes and its own cache.
    let text = null;
    try { text = await articleText(title); } catch { text = null; }
    if (text && text.length >= TOO_SHORT) { cache[url] = text; cacheDirty = true; return text; }
    return null;
  }
  /* NCBI and PMC gate a fast reader rather than refusing it outright: the
   * answer is 200 with a 165-character interstitial. Backing off and asking
   * again gets the paper, so a single attempt under-reports the library this
   * layer leans on hardest. Three tries, widening. */
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 2500 * attempt));
    let text = null;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (r.ok) text = strip(await r.text());
      else { stats.failures++; return null; }   // a 404 will not improve
    } catch { stats.failures++; continue; }
    await new Promise(r => setTimeout(r, 1200));
    if (text && text.length >= TOO_SHORT) { cache[url] = text; cacheDirty = true; return text; }
  }
  return null;
}

/* Numbers worth checking. Same reasoning tools/audit.mjs and
 * tools/effects-audit.mjs use: a bare small integer is structural rather than
 * factual ("the two chambers", "a third of"), and flagging those buries the
 * figures that carry a claim. */
function figuresIn(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g)) {
    const raw = m[0].replace(/,/g, '');
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    if (v < 10 && Number.isInteger(v)) continue;
    out.add(raw);
  }
  return [...out];
}
/* Thousands are not always grouped with a comma, and the first run of this
 * tool proved it the expensive way. The WHO snakebite fact sheet writes
 * "81 410" and "137 880" with a space, so a note quoting WHO's own figures
 * character for character was reported as asserting something its source does
 * not say. That is a FALSE RED, and a false red is worse than the fault it
 * was meant to catch: nobody re-reads a green row, but a red one gets "fixed"
 * by weakening a true sentence. Collapse every grouping style — comma, plain
 * space, non-breaking, narrow no-break, thin — before looking. */
const ungroup = text => text.replace(
  /(\d{1,3})(?:[,\u0020\u00a0\u202f\u2009](\d{3}))+/g,
  m => m.replace(/[,\u0020\u00a0\u202f\u2009]/g, ''));

const hasFigure = (text, raw) => {
  const v = Number(raw);
  if (new RegExp(`\\b${raw.replace('.', '\\.')}\\b`).test(text)) return true;
  if (text.includes(v.toLocaleString('en-US'))) return true;   // 20,000 vs 20000
  if (new RegExp(`\\b${raw.replace('.', '\\.')}\\b`).test(ungroup(text))) return true;
  /* A percentage written 0.5% in our note and 0.5 per cent in theirs, and the
   * decimal that lost its trailing zero: 11.40 parsed to 11.4 could never
   * match an article saying 11.40, which produced false reds in the recipe
   * audit until it was fixed there. Same fix here, rather than the same bug. */
  if (raw.includes('.') && text.includes(raw.replace(/0+$/, ''))) return true;
  /* And a source may spell the number out. CDC's flour alert says "Seventeen
   * ill people have been reported from eight states"; the note says 17, which
   * is the same fact typed differently. Reporting that as a figure the source
   * does not carry is the second false red this tool produced, and public
   * health prose spells out small numbers as a matter of house style — so the
   * word forms have to be part of the check, not a thing a reader is expected
   * to notice. */
  const word = numberWord(v);
  if (word && new RegExp(`\\b${word}\\b`, 'i').test(text)) return true;
  return false;
};

/* English for a whole number, where prose would plausibly spell it out. Beyond
 * a few hundred, writing stops spelling and starts using digits, so this stops
 * too rather than generating strings nobody writes. */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
  'seventy', 'eighty', 'ninety'];
function numberWord(v) {
  if (!Number.isInteger(v) || v < 0) return null;
  if (v < 20) return ONES[v];
  if (v < 100) return TENS[Math.floor(v / 10)] + (v % 10 ? `[ -]${ONES[v % 10]}` : '');
  if (v < 1000 && v % 100 === 0) return `${ONES[v / 100]} hundred`;
  return null;
}

/* The bodies whose name IS the claim. A note saying "NIOSH sets the limit at
 * 20 ppm" is making two assertions, and the attribution is the one a reader
 * cannot check for themselves without being told where to look. Deliberately
 * short: these are the organisations this corpus actually cites, and a longer
 * list would start matching ordinary words. */
const AUTHORITIES = [
  'IARC', 'NIOSH', 'OSHA', 'WHO', 'EPA', 'FDA', 'EFSA', 'CDC', 'ATSDR',
  'ACGIH', 'HSE', 'ECHA', 'NTP', 'USDA', 'FAO', 'NFPA', 'IUPAC', 'UNICEF',
];
const authoritiesIn = text =>
  AUTHORITIES.filter(a => new RegExp(`\\b${a}\\b`).test(text));

const rows = Object.entries(HAZ)
  .filter(([id]) => !ONLY.length || ONLY.includes(id));

if (LIST_UNSOURCED) {
  const owed = rows.filter(([, h]) => !h.src);
  console.log(`\n${n(owed.length)} HAZARD(S) CITING NOTHING AT ALL\n`);
  // Worst first: an entry on many elements is read by more players, and one
  // asserting a figure is making a checkable claim nobody has checked.
  owed.sort((a, b) => ((b[1].ids || []).length - (a[1].ids || []).length)
    || (figuresIn(b[1].note || '').length - figuresIn(a[1].note || '').length));
  for (const [id, h] of owed) {
    const figs = figuresIn(h.note || '');
    console.log(`  ${id}`);
    console.log(`     ${(h.ids || []).length} element(s), ${h.severity}` +
      (figs.length ? `, asserts ${figs.join(', ')}` : ', no figures'));
    console.log(`     ${(h.note || '').slice(0, 150)}`);
  }
  console.log(`\n  A note with no source is the one thing this corpus does not`);
  console.log(`  otherwise allow. Work from the top: most elements first.\n`);
  process.exit(0);
}

const flagged = [];
let checked = 0, unsourced = 0, notChecked = 0;

for (const [id, h] of rows) {
  if (!h.src) { unsourced++; continue; }
  const text = await sourceText(h.src);
  if (!text) { notChecked++; continue; }
  checked++;
  const lower = text.toLowerCase();
  const misses = [];

  for (const f of figuresIn(h.note || ''))
    if (!hasFigure(text, f)) misses.push(`figure ${f}`);

  for (const a of authoritiesIn(h.note || ''))
    if (!new RegExp(`\\b${a}\\b`, 'i').test(lower)) misses.push(`attributes to ${a}`);

  if (misses.length) flagged.push({ id, src: h.src, misses });
}

if (cacheDirty) writeFileSync(CACHE, gzipSync(JSON.stringify(cache)));

console.log('\nDOES THE HAZARD NOTE\'S SOURCE SAY THIS?\n');
console.log(`  entries        ${String(n(rows.length)).padStart(5)}`);
console.log(`  checked        ${String(n(checked)).padStart(5)}   source fetched and read`);
console.log(`  flagged        ${String(n(flagged.length)).padStart(5)}   the source does not carry something the note asserts`);
console.log(`  NOT CHECKED    ${String(n(notChecked)).padStart(5)}   a source we could not read — this is not a pass`);
console.log(`  UNSOURCED      ${String(n(unsourced)).padStart(5)}   cites nothing at all — see --unsourced`);
console.log(`\n  fetched ${n(stats.fetched)} this run, ${n(stats.fromCache)} from cache, ${n(stats.failures)} failure(s).`);

if (flagged.length) {
  console.log('\nFLAGGED\n');
  for (const f of flagged) {
    console.log(`  ${f.id}`);
    console.log(`     ${f.misses.join('; ')}`);
    console.log(`     ${f.src}`);
  }
  console.log('\n  A flag is not a verdict. Read the source and either fix the');
  console.log('  note or point it at the one that actually says this.\n');
} else if (checked) {
  console.log('\n✓ every source read carries the figures and attributions its note asserts\n');
}

/* --strict is for the gate this will become once the layer is sourced. Until
 * then the honest state is a loud report and exit 0, because failing the build
 * on 318 entries nobody has got to yet would only teach everyone to skip it. */
process.exit(STRICT && (flagged.length || notChecked) ? 1 : 0);
