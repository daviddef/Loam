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
 *         node tools/audit.mjs --terms    every claim, not just numeric ones
 *         node tools/audit.mjs <id>       just this output
 *         node tools/audit.mjs --backlog  write data/audit-backlog.json and the
 *                                         article bundle FROM THIS RUN; needs
 *                                         --terms --all and a complete sweep
 *         node tools/audit.mjs --rescued  list the numbers found only off the
 *                                         prose path — in an infobox or a table.
 *                                         Not faults. The weakest clearances
 *                                         there are, and worth reading.
 *         node tools/audit.mjs --selftest pin the number check against
 *                                         negatives; no network, must exit 0
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { titleOf as wikiTitleOf } from './lib/wiki.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recipes = JSON.parse(readFileSync(join(root, 'data/recipes.json'), 'utf8'));

const API = 'https://en.wikipedia.org/w/api.php';
const cache = new Map();

// Articles are cached on disk. Wikipedia throttles this address after a few
// dozen requests, and without a cache the tool can only ever check a fraction
// of the claims per run — which makes it something you run once rather than
// something that runs on every change.
const CACHE_DIR = join(root, '.cache/articles');
mkdirSync(CACHE_DIR, { recursive: true });
const cachePath = t => join(CACHE_DIR, createHash('sha1').update(t).digest('hex').slice(0, 16) + '.txt');
const readDisk = t => { const f = cachePath(t); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
const writeDisk = (t, text) => { try { writeFileSync(cachePath(t), text); } catch {} };

/** Plain text of an article, by title, cached for the run. */
// One request at a time with a short gap. Hammering the API gets you throttled,
// and a throttled run reports every claim as "could not be checked" — which
// looks exactly like a clean result if you are not paying attention. That is a
// worse failure than an error.
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;

async function articleText(title) {
  if (cache.has(title)) return cache.get(title);
  const disk = readDisk(title);
  if (disk) { cache.set(title, disk); return disk; }
  /* extracts with explaintext drops the infobox, and the infobox is where a
   * great many of the facts we cite actually live: melting points, dimensions,
   * dates of construction, populations. Gold's melting point is not in the
   * prose of the Gold article at all, so a correct claim was reported as
   * unsupported. Pulling the wikitext alongside the prose puts the infobox
   * back in scope. It is noisier, and that only ever costs the check a catch —
   * never a false alarm, which is the direction that matters. */
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
      if (text) writeDisk(title, text);
      await sleep(700);
      return text;
    } catch { /* retry */ }
  }
  failures++;
  cache.set(title, null);
  return null;
}

/* The infobox lives in the wikitext, not in the plain-text extract, and a great
 * many cited facts live there: melting points, dimensions, dates, populations.
 * Fetching wikitext for every article made a full run three times slower for a
 * payload almost none of it needed, so it is a SECOND CHANCE — pulled only when
 * the prose alone does not support a claim. */

/* The rendered page, tags stripped — the only way to see a transcluded infobox.
 *
 * Returns null when it could not be READ, and '' only when it was read and was
 * empty. The difference is the whole point. This function used to `catch {
 * return ''; }`, and when Wikipedia throttles it answers **HTTP 200 with the
 * plain text "You are making too many requests to the API."** — so res.ok is
 * true, res.json() throws, the catch swallows it, and the caller is handed an
 * empty infobox that looks identical to an article with no infobox. Every
 * melting point, boiling point and density then reports as a number the article
 * does not contain, and the harder the tool is run the more false faults it
 * manufactures. That is the same shape as the getJSON bug recorded below, in
 * the function immediately after this one. A catch that hides a failure is
 * worse than no catch, because the stage looks like it ran. */
async function renderedText(title) {
  const url = `${API}?action=parse&prop=text&formatversion=2&format=json&page=${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Loam/1.0 (source audit; contact via repo)' } });
    if (!res.ok) return null;
    const body = await res.text();
    if (!body.trimStart().startsWith('{')) return null;   // the throttle notice, served as 200
    const j = JSON.parse(body);
    const html = j?.parse?.text ?? null;
    if (html === null) return null;
    /* Drop the reference apparatus before flattening. A citation is not the
     * article asserting anything: the Flatbread row's "14,400 years" was
     * cleared by the TITLE of the paper in its reference list, and the Wine
     * row's "13%" by an archive-date of 13 November. See stripApparatus. */
    return html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
               .replace(/<sup\b[^>]*class="[^"]*reference[^"]*"[\s\S]*?<\/sup>/gi, ' ')
               .replace(/<ol\b[^>]*class="[^"]*references[^"]*"[\s\S]*?<\/ol>/gi, ' ')
               .replace(/<cite\b[\s\S]*?<\/cite>/gi, ' ')
               .replace(/<[^>]+>/g, ' ')
               .replace(/&[a-z]+;|&#\d+;/gi, ' ')
               .replace(/\s+/g, ' ');
  } catch { return null; }
}

/* THE SECOND CHANCE WAS CLEARING CLAIMS AGAINST FOOTNOTES.
 *
 * Anything missing from an article's prose gets re-checked against its raw
 * page, because the plain-text extract drops infoboxes and tables and those
 * hold real figures — gold's melting point lives in a transcluded template and
 * nowhere else. That breadth is right. What it also swept in was the reference
 * apparatus, which asserts nothing at all:
 *
 *   soil       45% mineral, 5% once-living   cleared by |volume=45 |issue=5
 *                                            and an author called |last5=
 *   flatbread  charred 14,400 years ago      cleared by the TITLE of the paper
 *                                            in the reference list
 *   wine       24% sugar, 13% alcohol        cleared by |archive-date=24
 *                                            February and |date=13 November
 *
 * A journal volume number is not evidence for a percentage. Removing the
 * apparatus can only make the check STRICTER — it never lets a number pass
 * that would otherwise fail — so the backlog grows, which is the honest
 * direction. Infoboxes, tables and body prose are all untouched.
 */
function stripApparatus(wikitext) {
  let s = wikitext
    .replace(/<ref\b[^>]*\/>/gi, ' ')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, ' ')
    /* LAYOUT AND NAVIGATION FURNITURE ASSERTS NOTHING EITHER.
     * Reading the rescued list turned up the same shape as the footnotes:
     *   zodiac  "around 400 BCE"        cleared by  [[File:...|thumb|400px|...]]
     *   altair  "only 17 light-years"   cleared by  {{Sky|19|50|46.9990|+|08|52|05.959|17}}
     *   aztec   "by the 15th century"   cleared by  [[Category:15th-century establishments...]]
     * An image's display width in pixels and a sky-coordinate parameter are not
     * claims about anything. Note what is NOT stripped: the image CAPTION, which
     * is the article's own text and carries real facts — Vaishnavism's Heliodorus
     * pillar "in 110 BCE" and Darwin's notebook page "c. July 1837" are both
     * captions, and both are the article genuinely saying so. Only the furniture
     * around the caption goes. `px` is never a unit in prose about a subject. */
    .replace(/\b\d+\s*px\b/gi, ' ')
    .replace(/\b(?:upright|image_size|imagesize)\s*=\s*"?[\d.]+"?/gi, ' ')
    .replace(/\{\{\s*(?:sky|coord|coords)\b[^{}]*\}\}/gi, ' ')
    .replace(/\[\[\s*Category\s*:[^\]]*\]\]/gi, ' ');
  /* Citation templates, brace-matched: a {{cite}} can contain {{nested}} ones,
   * and a non-greedy /\{\{cite[\s\S]*?\}\}/ stops at the inner closer and
   * leaves the tail of the citation behind — which is where the dates are. */
  let out = '', i = 0;
  while (i < s.length) {
    if (s[i] === '{' && s[i + 1] === '{' &&
        /^\s*(cite|citation|sfn|harv|refn|rp\b|r\b)/i.test(s.slice(i + 2, i + 22))) {
      let depth = 0, j = i;
      while (j < s.length) {
        if (s[j] === '{' && s[j + 1] === '{') { depth++; j += 2; }
        else if (s[j] === '}' && s[j + 1] === '}') { depth--; j += 2; if (!depth) break; }
        else j++;
      }
      out += ' '; i = j; continue;
    }
    out += s[i++];
  }
  /* NO back-matter cut. Cutting from "== References ==" to the end looked
   * obviously right and removed 46% of Gold, 55% of Butane and 56% of Snow
   * line — because the cached entry was then the wikitext with the RENDERED
   * page glued after it, and the rendered page is where a transcluded infobox
   * lives (the two are fetched separately now, but the trap is the same). The
   * cut amputated exactly the thing this stage was built to read, and it
   * inflated the fault count by doing so. The refs and citation templates
   * above are what actually carried the apparatus; a References heading with
   * {{reflist}} under it carries nothing. */
  return out;
}

/* THE SOURCE AND THE RENDERED PAGE ARE FETCHED SEPARATELY, AND THE SECOND ONE
 * ONLY WHEN IT IS NEEDED.
 *
 * These used to be one call that always pulled both and cached them glued
 * together. That cost two requests for every article the second-chance stage
 * looked at, whether or not the first one already settled the question — and
 * under Wikipedia's rate limit a full sweep was running at five articles a
 * minute. It also meant the two halves could never be re-stripped
 * independently: change what the rendered side drops and every cached entry
 * keeps the old text.
 *
 * Most infobox figures are written inline in the wikitext and need no rendered
 * page at all. The ones that do not — Gold says {{Infobox gold}} and the
 * melting point lives inside that template — still get it, second.
 */
const srcCache = new Map(), rendCache = new Map();

/** Raw wikitext. null means COULD NOT READ, never "the article has none". */
async function articleSource(title) {
  if (srcCache.has(title)) return srcCache.get(title);
  const disk = readDisk('src:' + title);
  if (disk) { srcCache.set(title, disk); return disk; }
  const url = `${API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
              `&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  /* This block used to call getJSON(), which does not exist anywhere in this
   * file. The bare catch below swallowed the ReferenceError and returned '',
   * so the infobox stage reported "no infobox" on every article it was ever
   * asked about — silently, for as long as it had been here. A catch that
   * hides a missing function is worse than no catch: the stage looked like it
   * ran. */
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(2500 * attempt);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Loam/1.0 (source audit; contact via repo)' } });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) break;
      const j = await res.json();
      const page = (j?.query?.pages || [])[0];
      const wiki = page?.revisions?.[0]?.slots?.main?.content || '';
      srcCache.set(title, wiki);
      if (wiki) writeDisk('src:' + title, wiki);
      await sleep(400);
      return wiki;
    } catch { /* retry */ }
  }
  srcCache.set(title, null);
  return null;
}

/** The rendered page, flattened, apparatus already dropped. null = unreadable. */
async function articleRendered(title) {
  if (rendCache.has(title)) return rendCache.get(title);
  const disk = readDisk('rend:' + title);
  if (disk) { rendCache.set(title, disk); return disk; }
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(2500 * attempt);
    const r = await renderedText(title);
    if (r === null) continue;
    rendCache.set(title, r);
    if (r) writeDisk('rend:' + title, r);
    await sleep(400);
    return r;
  }
  rendCache.set(title, null);
  return null;
}

/* Imported, not redefined. This file carried its own copy of titleOf with the
 * older `en.wikipedia.org`-only pattern, so the hostname parsing added to
 * tools/lib/wiki.mjs did not reach the recipe audit at all — two definitions of
 * the same question, free to drift, and one of them already had. A tool with two
 * answers for "is this a Wikipedia URL" has none. */
const titleOf = wikiTitleOf;

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
    /* A locant is part of a chemical's NAME, not a quantity in the sentence.
     * 1,2-dichloroethane yielded "1,2" -> 12, 1,3-butadiene yielded 13, and
     * 2,6-nonadienal yielded 26, none of which any article contains as a
     * number. A digit run followed by a hyphen and a letter is a name. */
    const after = text.slice(m.index + m[0].length);
    if (/^-\p{L}/u.test(after) || /^-?\d*,\d+-\p{L}/u.test(text.slice(m.index))) continue;
    /* Shorthand halves of a span are not numbers the source has to contain.
     * "1915-16" means 1915 to 1916 and yields a bare 16; "the 1960s-70s" means
     * the 1960s and 1970s and yields a bare 70. Neither 16 nor 70 appears in
     * any article, because neither was ever asserted. */
    const before = text.slice(Math.max(0, m.index - 7), m.index);
    if (m[1].length <= 2 && /\d{4}s?[-\u2013\u2014]$/.test(before)) continue;
    const raw = m[1].replace(/,/g, '');
    const n = parseFloat(raw);
    if (!isFinite(n)) continue;
    if (n < 10 && !m[2]) continue;                 // bare small integers: skip
    out.push({ n, raw, unit: (m[2] || '').replace(/\s+/g, ''), shown: m[0].trim() });
  }
  return out;
}


/* TEMPERATURES ARE NOT ALWAYS WRITTEN IN THE UNIT WE USED
 *
 * Butane's infobox does not say 0 °C anywhere. It says `BoilingPtK = 272 to
 * 274`, which is −1 to +1 °C, and no amount of string matching on "0" will
 * ever find it. The same is true of propane (231 K), octane (399 K) and gold
 * (1337 K): every one of those claims is supported by the article and every
 * one was being reported unsupported, because the article states the number in
 * kelvin and we state it in Celsius.
 *
 * That is the same class of fault as the comma after a year — a true sentence
 * reported as unsourced because of how the source happened to write it. Half
 * the numeric flags in the 5 Sep run were this. A check that is more than half
 * noise is a check nobody finishes, so the fix belongs here and not in the
 * corpus.
 *
 * Collect every temperature the article states, in K, °C or °F, convert them
 * all to °C, and let a °C claim match any of them within a degree and a half —
 * enough to absorb rounding and the 273.15 offset, not enough to let a wrong
 * figure through. Ranges count: an article saying 272 to 274 K supports a
 * claim anywhere inside it. */
function celsiusFigures(text) {
  const out = [];
  const add = (v) => { if (isFinite(v)) out.push(v); };
  const spans = (re, conv) => {
    let m;
    while ((m = re.exec(text))) {
      const lo = parseFloat(m[1].replace(/,/g, ''));
      const hi = m[2] == null ? lo : parseFloat(m[2].replace(/,/g, ''));
      add(conv(lo)); add(conv(hi));
      if (hi !== lo) { const a = conv(lo), b = conv(hi); out.push({ lo: Math.min(a, b), hi: Math.max(a, b) }); }
    }
  };
  const R = '(-?\\d[\\d,]*(?:\\.\\d+)?)';
  const SEP = '(?:\\s*(?:to|-|\u2013|\u2212)\\s*' + R + ')?';
  spans(new RegExp(`(?:Boiling|Melting|Sublimation|Flash)Pt[K]\\s*=\\s*${R}${SEP}`, 'gi'), k => k - 273.15);
  spans(new RegExp(`(?:Boiling|Melting|Sublimation|Flash)Pt[C]?\\s*=\\s*${R}${SEP}`, 'gi'), c => c);
  spans(new RegExp(`(?:Boiling|Melting|Sublimation|Flash)Pt[F]\\s*=\\s*${R}${SEP}`, 'gi'), f => (f - 32) * 5 / 9);
  spans(new RegExp(`${R}${SEP}\\s*K\\b`, 'g'), k => k - 273.15);
  spans(new RegExp(`${R}${SEP}\\s*\u00b0\\s*C\\b`, 'g'), c => c);
  spans(new RegExp(`${R}${SEP}\\s*\u00b0\\s*F\\b`, 'g'), f => (f - 32) * 5 / 9);
  return out;
}

/** Does the article state this temperature, in any unit it might have used? */
function articleHasTemperature(text, n) {
  const TOL = 1.5;
  for (const f of celsiusFigures(text)) {
    if (typeof f === 'number') { if (Math.abs(f - n) <= TOL) return true; }
    else if (n >= f.lo - TOL && n <= f.hi + TOL) return true;
  }
  return false;
}

/** Does this number appear in the article, in any of its usual spellings? */
function articleHas(text, num) {
  const n = num.n;
  const forms = new Set();
  const plain = n % 1 === 0 ? String(n) : String(n);
  forms.add(plain);
  /* A TRAILING ZERO IS LOST BY parseFloat AND THE LOOKAHEAD THEN REJECTS THE
   * SOURCE'S OWN SPELLING. We wrote Kilimanjaro's ice as 11.40 km2 and the
   * article says "from 11.40 km2 (4.40 mi2)" — the same six characters. But
   * parseFloat("11.40") is 11.4, so the check searched for "11.4" and the
   * (?!\d) that stops 11.4 matching 11.45 also stopped it matching 11.40.
   * A claim written with a trailing zero could never pass, whatever the source
   * said. Search for the digits as we actually wrote them too. This only ever
   * lets a number through that is in the article CHARACTER FOR CHARACTER, so it
   * cannot admit one that is absent. */
  if (num.raw && num.raw !== plain) {
    forms.add(num.raw);
    if (n >= 1000) forms.add(num.raw.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  }
  if (n >= 1000 && n % 1 === 0) {                  // 1700 and 1,700
    forms.add(plain.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  }
  if (n >= 1e6 && n % 1e6 === 0) forms.add(`${n / 1e6} million`);
  if (n >= 1e9 && n % 1e9 === 0) forms.add(`${n / 1e9} billion`);
  /* A FRACTION OF A MILLION IS STILL THAT NUMBER. We wrote the oldest well-dated
   * aurochs as "roughly 780,000 years old"; the article says "about 0.78 million
   * years ago" — the same quantity, and the check only knew how to build
   * "X million" for whole millions. Palaeontology and geology write it this way
   * constantly. The form is generated FROM OUR NUMBER, so it matches only an
   * exact restatement: 780,000 produces "0.78 million" and nothing else, and an
   * article saying 0.79 million still fails. */
  if (n >= 1000) {
    const inM = Number((n / 1e6).toFixed(6));
    if (inM > 0) forms.add(`${inM} million`);
    const inB = Number((n / 1e9).toFixed(9));
    if (n >= 1e6 && inB > 0) forms.add(`${inB} billion`);
  }
  for (const f of forms) {
    /* The boundary has to reject a thousands separator without rejecting a
     * sentence comma. The old lookahead was a bare (?![\d,]), so "Finished in
     * 1558, it was built..." read as NOT containing 1558 — the comma after the
     * year failed the test. Any claim whose number is followed by a comma in
     * the source was reported unsupported, which is a false alarm, and false
     * alarms are how a check gets ignored. Reject a comma or point only when a
     * digit follows it. */
    const esc = f.replace('.', '\\.');
    /* An INTEGER claim is supported by a more precise source figure. Gold melts
     * at 1064.18 C and the article says so; our sentence says 1064, which is
     * claiming LESS than the source, not more. The check exists to catch
     * sentences going beyond their source, so rounding down is not what it is
     * looking for. The reverse still flags: 1064.18 where the source says 1064
     * is precision we invented. */
    const ahead = n % 1 === 0 ? `(?!\\d)(?!,\\d)` : `(?!\\d)(?!,\\d)(?!\\.\\d)`;
    if (new RegExp(`(?<!\\d)(?<!\\d,)(?<!\\d\\.)${esc}${ahead}`).test(text)) return true;
  }
  return false;
}

/**
 * The distinctive words in a claim.
 *
 * Numbers are only a fraction of what a sentence asserts. If we write that the
 * white crystals in an old cheese are tyrosine, the word "tyrosine" ought to be
 * in the article we cited. A technical term that is nowhere in our own source
 * is the same signal as a number that is nowhere in it: the sentence has gone
 * somewhere the source did not.
 *
 * Only unusual words count. Every article contains "water"; almost none
 * contain "thermophilic" by accident.
 */
const COMMON = new Set(('the a an and or but of to in on at by for with from as is are was were be been ' +
  'it its this that these those they them their there here what which who whom how why when where ' +
  'not no nor so if then than too very can could will would should may might must do does did done ' +
  'have has had having one two three four five six seven eight nine ten first second third ' +
  'more most less least much many few some any all both each every other another same different ' +
  'you your we our i me my he she his her him hers ' +
  'into out up down over under about after before between through during without within against ' +
  'because while until since although though whether either neither ' +
  'make makes made making take takes took taken get gets got give gives given ' +
  'go goes going went come comes coming keep keeps kept leave leaves left ' +
  'put puts turn turns turned use uses used using work works worked ' +
  'water food thing things way ways time times year years day days part parts kind sort ' +
  'good bad big small large long short high low hot cold new old ' +
  'like just only also even still yet ever never always often sometimes ' +
  'thats its whats dont doesnt cant wont isnt arent wasnt werent'
).split(/\s+/));

// The system word list, if this machine has one. Ordinary English is exactly
// what we do NOT want to flag: a claim is not drifting from its source because
// the source never used the word "curiosity".
let DICT = null;
for (const path of ['/usr/share/dict/words', '/usr/dict/words']) {
  try { DICT = new Set(readFileSync(path, 'utf8').toLowerCase().split('\n')); break; } catch {}
}

/**
 * Names: capitalised words that are not sentence-initial.
 *
 * These are the highest-value check in the file. A claim that says "Anfinsen
 * showed the fold is decided by the sequence" is making an attribution, and an
 * attribution the cited article never mentions is a claim we cannot back. The
 * seventeen errors found by hand were disproportionately of this kind — a
 * confident name, a confident date, and no source for either.
 */
function namesIn(text) {
  const out = new Set();
  // Skip the first word of each sentence: capitalisation there means nothing.
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const words = sentence.split(/\s+/).slice(1);
    for (const w of words) {
      /* Keep letters with diacritics. Stripping to [A-Za-z] turned Köhler into
       * "Khler" and then reported it as a name the article never mentions —
       * while the article says Köhler throughout. The corpus is full of names
       * that carry marks (Lenković, Hōryū-ji, Utzon, Sacsayhuamán) and every
       * one of them was generating a false alarm. \p{L} keeps the letter and
       * drops the punctuation, which is what was wanted all along. */
      /* A chemical formula is not a name. Stripping digits out of Na2CrO4 and
       * Ca2(Mg,Fe)5Si8O22(OH)2 left "NaCrO" and "CaMgFeSiOOH", which were then
       * reported as people the article never mentions. Anything that arrived
       * with a digit in it is formula or model number, not somebody's surname. */
      if (/\d/.test(w)) continue;
      /* A capital inside the word is a formula or an acronym, never a surname.
       * NaOH, HCl and KOH carry no digit, so the filter above let them through
       * and they were then reported as people the article never mentions. */
      if (/^\p{L}.*\p{Lu}/u.test(w.replace(/[^\p{L}]/gu, ''))) continue;
      let clean = w.replace(/[^\p{L}'\u2019-]/gu, '');
      /* And the possessive belongs to the sentence, not to the name. Searching
       * an article for "Macintosh's" fails on an article that says Macintosh,
       * which is how Salk's, Kolbe's, Garfield's, Kocher's, Tyndall's and
       * Yellowstone's all came to be reported as unsupported attributions. */
      clean = clean.replace(/['\u2019]s$/u, '');
      /* And trim any apostrophe left at either end. Quoted text leaves marks
       * attached to the word — Peru\u2019, Lord', God' — which then fail to match
       * an article containing Peru, Lord and God. */
      clean = clean.replace(/^['\u2019-]+|['\u2019-]+$/gu, '');
      if (clean.length < 3) continue;
      if (!/^\p{Lu}\p{Ll}/u.test(clean)) continue;
      out.add(clean);
    }
  }
  return [...out];
}

/**
 * Is this ordinary English?
 *
 * The word list on a Mac is American and does not inflect, so without help it
 * calls "neighbours", "oxidises" and "crystallises" unusual — which they are
 * not, and which drowns the words that matter. Try the obvious variants before
 * deciding a word is technical.
 */
function ordinary(w) {
  if (!DICT) return false;
  const candidates = new Set([w]);
  // Superlatives and comparatives: the list has "strong", not "strongest".
  const bases = [w, w.replace(/(ing|ed|es|s|ly)$/, ''), w.replace(/ies$/, 'y'),
                 w.replace(/(est|er)$/, ''), w.replace(/(est|er)$/, 'e'),
                 w.replace(/i(est|er)$/, 'y'), w.replace(/(.)\1(est|er)$/, '$1')];
  for (const base of bases) {
    if (!base) continue;
    candidates.add(base);
    candidates.add(base.replace(/is(e|ed|es|ing|ation)?$/, 'ize'));   // oxidises -> oxidize
    candidates.add(base.replace(/isation$/, 'ization'));        // gelatinisation
    candidates.add(base.replace(/isation$/, 'ize'));
    candidates.add(base.replace(/is(e|ed|es|ing)?$/, 'iz'));
    candidates.add(base.replace(/our/g, 'or'));                 // flavours -> flavors
    candidates.add(base.replace(/re$/, 'er'));                  // centre -> center
    candidates.add(base + 'e');                                 // crystallis -> ...
  }
  for (const c of candidates) if (c.length > 2 && DICT.has(c)) return true;
  return false;
}

/**
 * Absolutes: the oldest, the only, the first, never, always.
 *
 * This is where overclaiming lives. A mechanism written carefully still tends
 * to acquire a superlative on the way to the page, because superlatives are
 * what make a sentence feel finished — and they are exactly the part nobody
 * checks. "The oldest recorded scarecrows stood in Egyptian wheat fields" was
 * this shape, and it was not in the source.
 *
 * The test is not whether the word appears in the article. It is whether the
 * article makes a claim of that STRENGTH at all: if we say "the only" and the
 * source never says only, first, unique or exclusively about anything nearby,
 * the strength is ours.
 */
// Each absolute we might write, and the words in the source that would justify
// it. The first version tested for ANY hedge word anywhere in the article,
// which every article contains — so the check always passed, which is the worst
// possible behaviour for a check: it reads as a clean result.
// Reviewed: rhetoric rather than a factual claim. "The only remaining
// ingredient is time" is a way of ending a sentence, not an assertion about
// cheese. Listed with a reason each so the check keeps working on new prose
// instead of being turned down until it says nothing.
const gestureOf = r => r.verb ? `${r.in[0]}|${r.verb}` : [...r.in].sort().join('+');

// Reviewed: a geographic adjective is not an attribution. "Mediterranean herbs"
// and "after the Americas" are ordinary background, not claims the source has to
// carry. Names that ARE attributions — a person, a date, an institution — stay
// flagged.
const NAME_CLEARED = {
  'flatbread+passata': 'the Columbian exchange as background, not a claim about pizza',
  'leaf+sun': 'a geographic adjective, not an attribution',
  'ore+spark': 'accent-stripping turns "Héroult" into "Hroult" before the match — the name is genuinely in the cited article (it is literally in the title, "Hall–Héroult process")',
};

/* Keys are gestureOf(): `a|verb` for a verb recipe, otherwise the inputs
 * SORTED and joined with '+'. Five entries added here silently did nothing
 * because they were written in the recipe's own input order. */
const ABSOLUTE_CLEARED = {
  'curd+salt': 'a figure of speech about time, not a claim about ingredients',
  'fire+stone': 'folklore, and true by definition — nobody found it',
  'grain+water': 'rhetorical: what a seed was going to do anyway',
  'cake_batter+fire': 'a figure of speech about even heat',
  'harvest+pot': 'mythology — the horn not emptying is the myth',
  'protein|heat': 'rhetorical emphasis on a mechanism stated just before',
  'penicillin|wait': 'definitional: survivors are what an antibiotic did not kill',
  /* Reviewed 9 Sep. Every one of these matched the string and none of them is a
   * claim about the world: an ordinal inside a sequence, a comparison the
   * sentence itself scopes, or "the first" used as a pro-form for something
   * named a clause earlier. Nine tenths of a sampled batch were this shape, and
   * a check that is mostly noise is a check nobody finishes. */
  'channel+dam': 'temporal: the first time it overtops, not a claim of primacy',
  'erosion+rain': 'the comparison is among the channels the sentence just listed',
  'molecule+water': 'physics stated in the same breath — the surface contracts to its own minimum',
  'air+hypoxia': 'ordinal within the scene: the casualty who went in first',
  'allergic_reaction+skin': 'sequence: the early exposures, not a claim of primacy',
  'butterfly+pupa': '"the first" is a pro-form for the cocoon named one clause earlier',
  'mesosoma+metasoma': 'idiom: the question a key asks first, not a claim about keys',
  'cell+cerebral_cortex': 'idiom: the first thing a reader notices',
  'bacteria+glass': 'definitional: fomite ferries between people who never touched directly',
  'drug+nerve': 'idiom: not sensitised in the first place',
  'light+sun': 'ordinal within journey: the first half-million kilometres of the crossing',
  'leaf|heat': 'comparing variants the sentence itself names (green, oolong, black)',
  'sand|crush': 'idiom: how silt gets made in the first place',
  'conveyor_belt+port_stockpile': 'idiom: lays ore in the first place',
};

const ABSOLUTES = [
  [/\bthe oldest\b/i,    /\b(oldest|earliest|first known|most ancient)\b/i],
  [/\bthe earliest\b/i,  /\b(earliest|oldest|first known|first recorded)\b/i],
  [/\bthe first\b/i,     /\b(the first|first known|first recorded|earliest)\b/i],
  [/\bthe only\b/i,      /\b(the only|sole|solely|uniquely|no other)\b/i],
  [/\bthe largest\b/i,   /\b(largest|biggest|greatest)\b/i],
  [/\bthe smallest\b/i,  /\b(smallest|tiniest)\b/i],
  [/\bthe most \w+\b/i,  /\b(most|greatest|highest|largest)\b/i],
  [/\bnever\b/i,         /\b(never|does not|do not|cannot|no \w+ ever)\b/i],
  [/\balways\b/i,        /\b(always|invariably|in every case|all \w+ are)\b/i],
  [/\bunique\b/i,        /\b(unique|only|unlike any)\b/i],
  [/\bexclusively\b/i,   /\b(exclusively|only|solely)\b/i],
  [/\bnothing else\b/i,  /\b(only|nothing else|no other)\b/i],
];

function termsIn(text) {
  // Split hyphenated compounds: "shade-grown" is two ordinary words, and no
  // article is obliged to contain the pair.
  const words = text.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/);
  const out = new Set();
  for (const w of words) {
    if (w.length < 7) continue;              // short words are rarely distinctive
    if (COMMON.has(w)) continue;
    if (ordinary(w)) continue;
    out.add(w);
  }
  return [...out];
}

/* This corpus writes British English and Wikipedia frequently does not. A claim
 * saying "millimetres" against an article that says "millimeters" is a
 * difference in spelling, not a source failing to carry the claim, and flagging
 * it buries the signals that matter under noise nobody can act on. The same
 * already applies in tools/effects-audit.mjs, for the same reason and with the
 * same rule: a variant may only ever let a term PASS. Nothing here can make an
 * absent term look present — it can only stop a present one being called absent. */
function usVariants(w) {
  const out = new Set();
  const add = x => { if (x !== w) out.add(x); };
  add(w.replace(/re\b/g, 'er').replace(/res\b/g, 'ers'));  // metre, fibre, centre
  add(w.replace(/oe/g, 'e').replace(/ae/g, 'e'));            // oesophagus, haemoglobin
  add(w.replace(/ise/g, 'ize').replace(/isa/g, 'iza'));      // organise, organisation
  add(w.replace(/our/g, 'or'));                              // colour, behaviour
  add(w.replace(/([lpt])\1(ed|ing|er|ers|s)/g, '$1$2'));      // worshipped, worshippers, travelled
  return [...out];
}

/** Match on a stem, so "enzymes" finds "enzyme" and "crystallises" finds "crystal". */
function articleHasTerm(lowerText, term) {
  const stemOf = w => w.replace(/(ing|ed|es|s|ise|ised|ize|ized|ly)$/, '');
  const stem = stemOf(term);
  if (stem.length < 5) return true;          // too short to be evidence either way
  /* Fold diacritics here too. The NAME check already does, and the two paths
   * disagreeing meant `ragnarok` and `jormungandr` passed as names and then
   * failed again as words, against the same article, for the same reason —
   * Ragnarök and Jörmungandr. One normalisation, both paths. */
  lowerText = lowerText + '\u0000' + lowerText.normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC');
  /* Hyphenation is typesetting, not content: an article writing "by-product"
   * carries the claim a sentence writing "byproduct" makes. Fold both sides. */
  const flat = lowerText.replace(/-/g, '');
  /* Spell the variants from the WHOLE word, then stem each one. Stemming first
   * destroys the very ending the rules key on — "millimetres" loses its "es"
   * and becomes "millimetr", which no longer ends in "re" for the rule to see.
   * That ordering mistake made the whole normalisation a no-op. */
  for (const cand of [term, ...usVariants(term)]) {
    const st = stemOf(cand).replace(/-/g, '');
    if (st.length < 5) continue;
    if (lowerText.includes(st) || flat.includes(st)) return true;
  }
  return false;
}

/* --selftest: the number check, proved against negatives, with no network.
 *
 * A checker that reports a present number as ABSENT is the same fault this
 * tool exists to catch, pointed the other way, and it is worse: nobody
 * re-reads a green row, but a false red gets "fixed" by weakening true prose.
 * The trailing-zero bug below survived because both its victims looked like
 * ordinary misses. So the fold is pinned here, negatives first: every case
 * that must NOT match is a case where the article holds a DIFFERENT number.
 */
if (process.argv.includes('--selftest')) {
  const CASES = [
    ['ice went from 11.40 km2 to under 1', 'decreasing from 11.40 km2 (4.40 mi2) to <1', true,  'exact trailing zero — the bug'],
    ['ice went from 11.40 km2 to under 1', 'decreasing from 11.4 km2 to <1',             true,  '11.40 and 11.4 are one value'],
    ['ice went from 11.40 km2 to under 1', 'decreasing from 11.45 km2 to <1',            false, 'must not match a longer number'],
    ['ice went from 11.40 km2 to under 1', 'decreasing from 11.401 km2 to <1',           false, 'must not match a longer number'],
    ['ice went from 11.40 km2 to under 1', 'decreasing from 111.40 km2 to <1',           false, 'must not match inside a longer one'],
    ['ice went from 11.40 km2 to under 1', 'the glacier is gone',                        false, 'absent stays absent'],
    ['a 11.10 metre rise',                 'a rise of 11.101 metres',                    false, 'a trailing zero must not swallow digits'],
    ['a 11.10 metre rise',                 'a rise of 11.10 metres',                     true,  'exact'],
    ['a 11.10 metre rise',                 'a rise of 11.1 metres',                      true,  'same value'],
    ['over 5,600 mills',                   'Domesday lists 5,624 mills',                 false, '5,600 is not 5,624'],
    ['over 5,600 mills',                   'Domesday lists 5,600 mills',                 true,  'integer with a thousands comma'],
    ['over 5,600 mills',                   'Domesday lists 5600 mills',                  true,  'comma-free spelling of the same'],
    ['walls 21 m high',                    'walls 21 m (69 ft) high',                    true,  'plain integer'],
    ['finished in 1558, it stood',         'completed in 1558, and stood for',           true,  'a sentence comma is not a separator'],
    ['3.70 million years',                 'diverged 3.70 million years ago',            true,  'the second row the bug hit'],
    ['3.70 million years',                 'diverged 3.7 million years ago',             true,  'same value'],
    ['3.70 million years',                 'diverged 3.72 million years ago',            false, 'must not match'],
    ['roughly 780,000 years old',          'strata dating about 0.78 million years ago', true,  '780,000 is 0.78 million'],
    ['roughly 780,000 years old',          'strata dating about 0.79 million years ago', false, 'but not 0.79 million'],
    ['roughly 780,000 years old',          'strata dating about 780,000 years ago',      true,  'the plain form still works'],
    ['about 1,500,000 years',              'some 1.5 million years ago',                 true,  'a whole-and-a-half million'],
  ];
  let bad = 0;
  for (const [prose, article, want, why] of CASES) {
    const nums = numbersIn(prose);
    if (!nums.length) { console.log(`  FAIL  numbersIn saw no number in "${prose}"`); bad++; continue; }
    const got = nums.every(n => articleHas(article, n));
    if (got !== want) bad++;
    console.log(`  ${got === want ? 'ok  ' : 'FAIL'} expect ${String(want).padEnd(5)} got ${String(got).padEnd(5)} ${why}`);
  }
  /* stripApparatus: a citation must not clear a claim, and an infobox must. */
  const APP = [
    ['<ref>{{cite journal |volume=45 |issue=5}}</ref> soil is mineral', '45', false, 'a journal volume is not a percentage'],
    ['<ref name=a>Origins of Bread 14,400 Years Ago</ref> bread', '14,400', false, "a paper's title is not the article"],
    ['{{cite web |archive-date=24 February 2017}} grapes', '24', false, 'an archive date is not a sugar level'],
    ['{{cite book |last13=Mariani}} wine', '13', false, 'an author index is not an alcohol level'],
    ['{{Chembox |BoilingPtC = 24 }} butane', '24', true,  'an INFOBOX must still clear it'],
    ['| melting point || 1,713 °C |', '1,713', true,  'a TABLE cell must still clear it'],
    ['The snow line sits at 4,500 m.', '4,500', true,  'plain body prose is untouched'],
    ['text\n== References ==\n{{reflist}}\n{{cite journal |volume=99}}', '99', false, 'a reflist carries nothing; the cite is stripped'],
    ['{{cite news |date=13 November 2017}} and the body says 13% alcohol', '13', true, 'a real body mention still clears'],
    ['{{rp|abs|quote=at least 46% was fishing nets}} the patch', '46', false, 'an rp page-quote is still a citation'],
    ['[[File:Coin.jpg|thumb|400px|Roman Egyptian coin]] the zodiac', '400', false, 'an image width is not a date'],
    ['{{Sky|19|50|46.9990|+|08|52|05.959|17}} Altair', '17', false, 'a sky coordinate is not a distance'],
    ['[[Category:15th-century establishments]] the Aztec empire', '15', false, 'a category tag is navigation'],
    ['[[File:Pillar.jpg|thumb|The Heliodorus pillar, made in 110 BCE]]', '110', true,  'but the CAPTION is the article speaking'],
    ['{{Automatic taxobox | fossil_range = {{Fossil range|168|34}} }}', '34', true,  'a data template still clears'],
    ['<gallery heights="250px">File:X.png|Darwin, July 1837</gallery>', '1837', true, 'gallery captions survive the px strip'],
  ];
  for (const [wikitext, needle, want, why] of APP) {
    const stripped = stripApparatus(wikitext);
    const got = articleHas(stripped, numbersIn(needle + ' %')[0] ?? { n: parseFloat(needle.replace(/,/g, '')), raw: needle });
    if (got !== want) bad++;
    console.log(`  ${got === want ? 'ok  ' : 'FAIL'} expect ${String(want).padEnd(5)} got ${String(got).padEnd(5)} ${why}`);
  }
  console.log(bad ? `\n  ${bad} FAILURE(S)` : `\n  ${CASES.length + APP.length} case(s) pass — the check admits only a literal the article really asserts`);
  process.exit(bad ? 1 : 0);
}

const only = process.argv.find(a => !a.startsWith('--') && !a.endsWith('.mjs') && !a.includes('node'));
const includeVerified = process.argv.includes('--all');

// --terms widens the net from "claims with a number" to every unverified claim.
const termsMode = process.argv.includes('--terms');
let subject = recipes.filter(r =>
  (termsMode || /\d/.test(r.why) || r.at != null) && (includeVerified || !r.verified));
/* --terms checks WORDS and ABSOLUTES, which do not need a digit. Requiring one
 * here meant `audit.mjs <id> --terms` silently examined nothing for any row
 * whose prose had no numeral, and reported "0 claim(s) checked, 0 faults" —
 * which reads exactly like a pass. Six rows were verified that way today and
 * none of them had been looked at. An empty subject is not a clean subject. */
if (only) subject = recipes.filter(r => r.out === only && (termsMode || /\d/.test(r.why) || r.at != null));
if (only && !subject.length) { console.log(`  no recipe with out="${only}" is in scope for this mode`); process.exit(2); }

/* PREFETCH THE WIKITEXT IN BATCHES.
 *
 * The API returns full page content for many titles at once — ten articles in
 * one 2.3-second request, half a megabyte, no warnings — while asking for them
 * one at a time under the rate limit ran at five a minute. A full sweep was
 * hours of waiting for the same bytes. Batches of twenty turn that into a few
 * dozen requests.
 *
 * A batch answers with the titles it RESOLVED to, not the ones asked for, so
 * redirects and normalisations are followed back to the requested title before
 * anything is cached. Cache it under the wrong key and the row that asked for
 * it fetches again anyway, which would quietly undo the whole saving. */
async function prefetchSources(titles) {
  const want = [...new Set(titles)].filter(t => !srcCache.has(t) && !readDisk('src:' + t));
  if (!want.length) return;
  console.log(`  prefetching wikitext for ${want.length} article(s) in batches of 20`);
  let done = 0, failed = 0;
  for (let i = 0; i < want.length; i += 20) {
    const batch = want.slice(i, i + 20);
    const url = `${API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
                `&redirects=1&format=json&formatversion=2&titles=${batch.map(encodeURIComponent).join('%7C')}`;
    let j = null;
    for (let attempt = 0; attempt < 3 && !j; attempt++) {
      if (attempt) await sleep(4000 * attempt);
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Loam/1.0 (source audit; contact via repo)' } });
        if (!res.ok) continue;
        const body = await res.text();
        if (!body.trimStart().startsWith('{')) continue;   // the throttle notice, served as 200
        j = JSON.parse(body);
      } catch { /* retry */ }
    }
    if (!j) { failed += batch.length; continue; }           // leave them for the per-row path
    const hop = new Map();
    for (const n of j.query?.normalized || []) hop.set(n.from, n.to);
    for (const rd of j.query?.redirects || []) hop.set(rd.from, rd.to);
    const resolve = t => { let cur = t; for (let k = 0; k < 5 && hop.has(cur); k++) cur = hop.get(cur); return cur; };
    const byTitle = new Map((j.query?.pages || []).map(pg => [pg.title, pg]));
    for (const t of batch) {
      const content = byTitle.get(resolve(t))?.revisions?.[0]?.slots?.main?.content;
      if (content) { srcCache.set(t, content); writeDisk('src:' + t, content); done++; }
    }
    await sleep(900);
  }
  console.log(`  prefetched ${done}${failed ? `, ${failed} left for the per-row path` : ''}`);
}
await prefetchSources(subject.map(r => titleOf(r.src)).filter(Boolean));

console.log(`  checking ${subject.length} numeric claim(s) against their cited articles\n`);

const unsupported = [], noSource = [], checked = [], articles = {}, rescued = [];
for (const r of subject) {
  const title = titleOf(r.src);
  if (!title) { noSource.push({ r, why: 'source is not a Wikipedia article' }); continue; }
  const text = await articleText(title);
  if (!text) { noSource.push({ r, why: `could not fetch "${title}"` }); continue; }
  articles[title] = text;
  /* A banded recipe states its temperature in `at`, and that number was never
   * checked — only the prose was. A band is more load-bearing than a sentence:
   * a wrong one makes the recipe wrong rather than merely unsupported, because
   * the gesture signature and the card both depend on it. */
  const nums = numbersIn(r.why);
  if (r.at != null) nums.push({ n: Number(r.at), unit: '\u00b0C', shown: `${r.at} \u00b0C (the band)` });
  if (!nums.length && !termsMode) continue;
  const missing = nums.filter(x => !articleHas(text, x));
  const lower = text.toLowerCase();
  const strayTerms = termsIn(r.why).filter(t => !articleHasTerm(lower, t));
  /* Fold every dash to a plain hyphen on both sides before comparing. The RNA
   * vaccine article writes Pfizer\u2013BioNTech with an en dash and our sentence
   * used a hyphen, so the tool reported the manufacturer as a name the source
   * never mentions. Typographic dashes are a difference in typesetting, not in
   * who did the thing. */
  const dashes = (x) => x.replace(/[\u2010-\u2015\u2212]/g, '-');
  /* And fold diacritics on BOTH sides. The article comment above explains why
   * marks are KEPT when our sentence carries them — Köhler must not become
   * Khler. The opposite case is just as common and was never handled: this
   * corpus writes Mjolnir, Ragnarok, Jormungandr, Candomble, Tawhirimatea and
   * Ryujin plainly, while Wikipedia writes Mjölnir, Ragnarök, Jörmungandr,
   * Candomblé, Tāwhirimātea and Ryūjin. Reporting those as attributions the
   * source never makes is a claim about typography, not about who did what.
   * Comparing both sides mark-free can only let a present name pass; it cannot
   * make an absent one look present, because two different names stay
   * different once their accents are gone. */
  const bare = (x) => x.normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC');
  /* A hyphen in our sentence against a space in the article is typesetting
   * again: "Lewis-acid", "Ame-no-Iwato", "Tang-dynasty" and "Hardy-Weinberg"
   * are all written with spaces or different joins by their own articles.
   * Strip the joins from both sides and compare the letters. Two different
   * names remain different with their punctuation gone. */
  const joins = (x) => x.replace(/[-'\u2019\s]+/g, '');
  const lowerFolded = dashes(lower);
  const lowerBare = bare(lowerFolded);
  const lowerJoined = joins(lowerBare);
  /* A hyphenated name is usually two names. "Mongolia-China" is a border
   * between two countries the article names separately, and "Maya-Aztec"
   * spans two cultures; tools/audit.mjs already splits hyphenated compounds
   * in termsIn for exactly this reason. Accept the whole only if every part
   * of it is present, which is stricter than accepting either one. */
  const present = (n) => lowerFolded.includes(n) || lowerBare.includes(bare(n))
                      || lowerJoined.includes(joins(bare(n)));
  /* The article's own title counts as present. `Ta'aroa` was reported as a name
   * the source never mentions — against the article *called* Ta'aroa, whose body
   * uses the wider Polynesian name Tangaroa throughout. An article titled for a
   * name is the strongest evidence there is that it is about that name, and the
   * fetched text does not always repeat it. */
  const titleWords = bare(dashes(String(title).toLowerCase()));
  const strayNames = NAME_CLEARED[gestureOf(r)] ? []
    : namesIn(r.why).filter(nm => {
        const t = bare(dashes(nm.toLowerCase()));
        if (titleWords.includes(t) || joins(titleWords).includes(joins(t))) return false;
        const n = dashes(nm.toLowerCase());
        if (present(n)) return false;
        const parts = n.split('-').filter(p => p.length > 2);
        return !(parts.length > 1 && parts.every(present));
      });

  // An absolute in our sentence, with nothing of that strength anywhere in the
  // source, means the certainty is ours rather than the article's.
  let strayAbsolute = null;
  if (!ABSOLUTE_CLEARED[gestureOf(r)]) {
    for (const [ours, theirs] of ABSOLUTES) {
      const m = r.why.match(ours);
      /* A HEDGE IS NOT AN ABSOLUTE. `\balways\b` fires inside "almost always"
       * and "nearly always", which are the opposite of the claim being looked
       * for — the sentence is explicitly declining to say always. Same for
       * "almost the only" and "nearly the oldest". This is a fact about the
       * grammar of the sentence, not about whether the source agrees with it. */
      if (m && /\b(?:almost|nearly|not)\s+$/i.test(r.why.slice(0, m.index))) continue;
      if (m && !theirs.test(text)) { strayAbsolute = m[0]; break; }
    }
  }

  /* Anything still unsupported gets one more look, in the infobox. */
  let missing2 = missing, strayNames2 = strayNames;
  if (missing.length || strayNames.length) {
    const wiki = await articleSource(title).then(w => w === null ? null : stripApparatus(w));
    /* Could not read the infobox — so this row has NOT been checked, and saying
     * "the article does not contain 1085" would be a claim about an article
     * this run never finished reading. Throttling must produce unchecked rows,
     * never faults. */
    if (wiki === null) { noSource.push({ r, why: `wikitext unreadable for "${title}" — throttled` }); continue; }
    const wl = dashes(wiki.toLowerCase());
    missing2 = missing.filter(x => !articleHas(wiki, x)
      && !(x.unit === '\u00b0C' && (articleHasTemperature(wiki, x.n) || articleHasTemperature(text, x.n))));
    strayNames2 = strayNames.filter(nm => !wl.includes(dashes(nm.toLowerCase())));
    /* Only now, and only if something is still unaccounted for, is the rendered
     * page worth a second request. */
    if (missing2.length || strayNames2.length) {
      const rend = await articleRendered(title);
      if (rend === null) { noSource.push({ r, why: `rendered page unreadable for "${title}" — throttled` }); continue; }
      const rl = dashes(rend.toLowerCase());
      missing2 = missing2.filter(x => !articleHas(rend, x)
        && !(x.unit === '\u00b0C' && articleHasTemperature(rend, x.n)));
      strayNames2 = strayNames2.filter(nm => !rl.includes(dashes(nm.toLowerCase())));
    }
  }

  /* A number the PROSE did not have and the RAW PAGE did is a weaker clearance
   * than a prose match, and it is not always a clearance at all. The snow line
   * row claimed 4,500 m as "near 5,000 metres at the equator"; the extract says
   * 4,500, and the only 5,000 on the page is an image caption reading
   * "Cotopaxi (5,897 m), Andes: 5,000 m" — a different mountain range. The row
   * passed on a coincidence, exactly the way Ajinateppa's "12 kilometres east
   * of Bokhtar" would have passed for a 12-metre Buddha.
   *
   * The breadth is still right: the plain-text extract drops tables and
   * infoboxes, and those hold real figures. So this stays a clearance and
   * becomes a LIST instead — the rows where the only evidence is off the prose
   * path. Not faults. Somewhere to read. `--rescued` prints them. */
  const saved = missing.filter(x => !missing2.includes(x));
  if (saved.length) rescued.push({ r, title, saved });
  checked.push(r);
  if (missing2.length || strayTerms.length || strayNames2.length || strayAbsolute) {
    unsupported.push({ r, title, missing: missing2, strayTerms, strayNames: strayNames2, strayAbsolute, total: nums.length });
  }
}

// Names first: an unsupported attribution is worth more attention than an
// unsupported adjective.
const weight = u => u.strayNames.length * 10 + (u.strayAbsolute ? 8 : 0) +
                    u.missing.length * 5 + u.strayTerms.length;
const ranked = [...unsupported].sort((a, b) => weight(b) - weight(a));

const onlyNames = process.argv.includes('--names');
for (const u of (onlyNames ? ranked.filter(x => x.strayNames.length) : ranked)) {
  const gesture = u.r.verb ? `${u.r.in[0]} |${u.r.verb}` : u.r.in.join(' + ');
  console.log(`  ${gesture} → ${u.r.out}`);
  console.log(`    cited: ${u.title}`);
  if (u.strayNames.length) console.log(`    NAMES not in that article: ${u.strayNames.join(', ')}`);
  if (u.strayAbsolute) console.log(`    ABSOLUTE ours, not the source's: "${u.strayAbsolute}"`);
  if (u.missing.length) console.log(`    numbers not in that article: ${u.missing.map(m => m.shown).join(', ')}`);
  if (u.strayTerms.length) console.log(`    words not in that article: ${u.strayTerms.join(', ')}`);
  console.log(`    "${u.r.why}"\n`);
}

const nNum = unsupported.filter(u => u.missing.length).length;
const nName = unsupported.filter(u => u.strayNames.length).length;
const nAbs = unsupported.filter(u => u.strayAbsolute).length;
const nWord = unsupported.filter(u => u.strayTerms.length && !u.missing.length && !u.strayNames.length && !u.strayAbsolute).length;
console.log(`  ${checked.length} claim(s) checked`);
console.log(`  ${nName} name(s) the cited article never mentions   <- attributions, the sharp signal`);
console.log(`  ${nAbs} absolute(s) stronger than anything in the source`);
console.log(`  ${nNum} number(s) the cited article does not contain`);
console.log(`  ${nWord} flagged on an unusual word alone           <- weak; read before acting`);
console.log(`  ${rescued.length} number(s) found ONLY off the prose path       <- --rescued to read them`);
if (process.argv.includes('--rescued')) {
  console.log('');
  for (const x of rescued) {
    const g = x.r.verb ? `${x.r.in[0]} |${x.r.verb}` : x.r.in.join(' + ');
    console.log(`  ${g} → ${x.r.out}\n    cited: ${x.title}\n    only in the raw page: ${x.saved.map(m => m.shown).join(', ')}\n    "${x.r.why}"\n`);
  }
}
if (noSource.length) {
  console.log(`  ${noSource.length} could not be checked:`);
  for (const n of noSource) console.log(`      ${n.r.out.padEnd(22)} ${n.why}`);
}
if (failures) {
  console.error(`\n  ${failures} article fetch(es) failed after retries — this run is INCOMPLETE.`);
  process.exitCode = 1;
}
/* --backlog: write the worklist the cloud routine reads, FROM THIS RUN.
 *
 * The first backlog was built by a separate ad-hoc script after eleven of its
 * rows had already been fixed, so the routine's first run redid work that was
 * already done. A snapshot produced anywhere other than inside the run it
 * describes can drift from it; produced here it cannot. It is written only on
 * a complete sweep, because a partial one would silently drop every row the
 * sweep never reached — which is the same stale-snapshot fault wearing a
 * different hat. */
/** Names the article carries in another shape — see name_maybe_adjectival.
 *
 * First version stripped a suffix off OUR word and looked for that stem, which
 * caught Gondwanan/Gondwana but missed most of them: Greeks/Greek (no suffix in
 * the list), Andes/Andean and Britain/British (the derivation runs the other
 * way), Harpagos/Harpagus (a transliteration, not a suffix at all). It found 20
 * of 221 where a hand pass found eight in twenty.
 *
 * So: share a prefix of four or more characters with some word in the article,
 * with neither word more than five characters past the shared part. That is
 * loose enough to catch a transliteration and tight enough that the reader can
 * dismiss a bad one instantly — which is all a hint has to be. It clears
 * nothing; the row still counts as flagged.
 */
function adjectivalHint(names, article) {
  if (!article || !names.length) return null;
  const bare = x => x.normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC').toLowerCase();
  const low = bare(article);
  const out = [];
  for (const nm of names) {
    const n = bare(nm);
    if (n.length < 4) continue;
    if (low.includes(n)) continue;                    // present outright: not this case
    for (let k = Math.min(n.length, 12); k >= 4; k--) {
      const pfx = n.slice(0, k);
      const m = new RegExp(`\\b${pfx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z]*`).exec(low);
      if (!m) continue;
      if (n.length - k > 5 || m[0].length - k > 5) continue;
      out.push(`${nm}~${m[0]}`);
      break;
    }
  }
  return out.length ? out.join(', ') : null;
}

if (process.argv.includes('--backlog')) {
  if (only || !termsMode || !includeVerified) {
    console.error('\n  --backlog needs the full sweep: node tools/audit.mjs --terms --all --backlog');
    process.exit(2);
  }
  if (failures) {
    console.error('\n  NOT writing a backlog: this run had fetch failures, so it is incomplete.');
    process.exit(1);
  }
  /* AN UNCHECKED ROW IS NOT A PASSING ROW, AND A BACKLOG BUILT OVER ONE IS A LIE.
   * The `failures` counter above only counts prose fetches. A row whose SECOND
   * CHANCE was throttled never reaches the fault list either — it lands in
   * noSource — and the first run after the apparatus fix left 89 rows there and
   * wrote the file anyway. Names read 209 instead of 224 and it looked like
   * progress. Only "source is not a Wikipedia article" is a settled reason to
   * skip a row; everything else means run it again. */
  const unresolved = noSource.filter(n => n.why !== 'source is not a Wikipedia article');
  if (unresolved.length) {
    console.error(`\n  NOT writing a backlog: ${unresolved.length} row(s) could not be checked for a reason that is not deliberate —`);
    for (const n of unresolved.slice(0, 5)) console.error(`      ${n.r.out.padEnd(22)} ${n.why}`);
    console.error('  Re-run; the cache keeps what already succeeded, so each pass is shorter.');
    process.exit(1);
  }
  /* Word-only rows stay OUT. A stray unusual word is the weak signal — the tool
   * says so in its own summary — and 693 of them would bury the 620 rows that
   * carry a missing number, a missing attribution or an absolute the source
   * never makes. A worklist nobody can finish is a worklist nobody starts. */
  const rows = ranked.filter(u => u.missing.length || u.strayNames.length || u.strayAbsolute).map(u => ({
    gesture: u.r.verb ? `${u.r.in[0]} |${u.r.verb} → ${u.r.out}` : `${u.r.in.join(' + ')} → ${u.r.out}`,
    out: u.r.out, in: u.r.in, verb: u.r.verb ?? null, src: u.r.src, cited: u.title,
    missing_numbers: u.missing.length ? u.missing.map(m => m.shown).join(', ') : null,
    missing_names: u.strayNames.length ? u.strayNames.join(', ') : null,
    /* A CAUTION, NOT A CLEARANCE. About one name flag in twelve is an adjectival
     * form of a proper noun the article does carry in another shape — we write
     * "Gondwanan", "Himalayan", "Leibnizian", "Transylvanian" and the article
     * says Gondwana, the Himalayas, Leibniz, Transylvania. Those are the same
     * referent and the prose is not wrong, so REWRITING IT WOULD BE WEAKENING A
     * TRUE SENTENCE to satisfy a false red.
     *
     * It is not folded into the check itself because no rule separates the good
     * cases from the bad ones: "Arabian" and "Arabic" share five letters and are
     * a peninsula and a language, "Indian" and "Indiana" share six. So the row
     * still counts as flagged and this field just says where to look first. */
    name_maybe_adjectival: adjectivalHint(u.strayNames, articles[u.title]) || null,
    our_absolute: u.strayAbsolute || null,
    verified: !!u.r.verified,
  }));
  const cited = new Set(rows.map(r => r.cited));
  const bundle = {};
  for (const t of cited) if (articles[t]) bundle[t] = articles[t];
  const orphans = [...cited].filter(t => !bundle[t]);
  if (orphans.length) {
    console.error(`\n  NOT writing a backlog: ${orphans.length} flagged row(s) have no article text: ${orphans.slice(0,5).join(', ')}`);
    process.exit(1);
  }
  const out = {
    $comment: `Converged output of \`node tools/audit.mjs --terms --all --backlog\`, written by that run itself. ` +
      `${checked.length} of ${recipes.length} claims checked; the ${noSource.length} unchecked all cite sources this tool cannot read. A SNAPSHOT: regenerate by re-running.`,
    $how_to_fix: 'Two fixes, in order of preference. (1) RE-POINT: the claim is usually TRUE and the citation wrong — a specific fact filed under the article for its category rather than for itself (Kadesh not Chariot, Wilkinson not Bore, the Great Stink not Sewerage). NEEDS NETWORK. (2) PULL BACK: rewrite the prose to say only what the CITED article says. Always available offline — data/audit-articles.json.gz carries that article. Never widen a checker to make prose pass, and never invent a replacement figure.',
    generated: new Date().toISOString().slice(0, 10),
    rows: rows.length,
    verified_rows: rows.filter(r => r.verified).length,
    flags: { numbers: nNum, names: nName, absolutes: nAbs },
    articles: Object.keys(bundle).length,
    /* Every claim this sweep could NOT check, with the reason. A row here is not
     * a passing row: the previous file said nothing about them and 23 dead
     * Wikipedia links sat inside that silence for a day. "Source is not a
     * Wikipedia article" is deliberate; anything else wants a human. */
    unchecked: noSource.map(n => ({ out: n.r.out, why: n.why })),
    backlog: rows,
  };
  writeFileSync(join(root, 'data/audit-backlog.json'), JSON.stringify(out, null, 1) + '\n');
  writeFileSync(join(root, 'data/audit-articles.json.gz'), gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8')));
  console.log(`\n  wrote data/audit-backlog.json (${rows.length} rows, ${rows.filter(r => r.verified).length} verified)`);
  console.log(`  wrote data/audit-articles.json.gz (${Object.keys(bundle).length} articles, every flagged row covered)`);
}

console.log(`\n  A number missing from the article does not make the claim false — it means`);
console.log(`  the sentence is going further than the source it names. Every one of the`);
console.log(`  seventeen errors found by hand looked exactly like this.`);
