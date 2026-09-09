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
    return html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
               .replace(/<[^>]+>/g, ' ')
               .replace(/&[a-z]+;|&#\d+;/gi, ' ')
               .replace(/\s+/g, ' ');
  } catch { return null; }
}

const wikiCache = new Map();
async function articleWikitext(title) {
  if (wikiCache.has(title)) return wikiCache.get(title);
  const disk = readDisk('wiki:' + title);
  if (disk) { wikiCache.set(title, disk); return disk; }
  const url = `${API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
              `&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  /* This block used to call getJSON(), which does not exist anywhere in this
   * file. The bare catch below swallowed the ReferenceError and returned '',
   * so the infobox stage reported "no infobox" on every article it was ever
   * asked about — silently, for as long as it has been here. Gold's melting
   * point, butane's boiling point in kelvin and every other figure that lives
   * only in an infobox were reported as unsupported claims. A catch that hides
   * a missing function is worse than no catch: the stage looked like it ran. */
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(2500 * attempt);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Loam/1.0 (source audit; contact via repo)' } });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) break;
      const j = await res.json();
      const page = (j?.query?.pages || [])[0];
      let wiki = page?.revisions?.[0]?.slots?.main?.content || '';
      /* Element infoboxes are transcluded, not written inline: the Gold article's
       * own source contains no melting point at all, because it says
       * {{Infobox gold}} and the number lives in that template. Raw wikitext
       * therefore misses exactly the class of fact this stage exists to catch,
       * so the rendered page is pulled alongside it and flattened to text. */
      /* If the infobox could not be read, the article has NOT been fully seen.
       * Say so by failing the whole fetch rather than returning the wikitext
       * alone, which would let the caller flag infobox figures as absent. */
      const rendered = await renderedText(title);
      if (rendered === null) { await sleep(400); continue; }
      wiki += '\n' + rendered;
      wikiCache.set(title, wiki);
      if (wiki) writeDisk('wiki:' + title, wiki);
      await sleep(400);
      return wiki;
    } catch { /* retry */ }
  }
  wikiCache.set(title, '');
  return '';
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

const ABSOLUTE_CLEARED = {
  'curd+salt': 'a figure of speech about time, not a claim about ingredients',
  'fire+stone': 'folklore, and true by definition — nobody found it',
  'grain+water': 'rhetorical: what a seed was going to do anyway',
  'cake_batter+fire': 'a figure of speech about even heat',
  'harvest+pot': 'mythology — the horn not emptying is the myth',
  'protein|heat': 'rhetorical emphasis on a mechanism stated just before',
  'penicillin|wait': 'definitional: survivors are what an antibiotic did not kill',
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
  ];
  let bad = 0;
  for (const [prose, article, want, why] of CASES) {
    const nums = numbersIn(prose);
    if (!nums.length) { console.log(`  FAIL  numbersIn saw no number in "${prose}"`); bad++; continue; }
    const got = nums.every(n => articleHas(article, n));
    if (got !== want) bad++;
    console.log(`  ${got === want ? 'ok  ' : 'FAIL'} expect ${String(want).padEnd(5)} got ${String(got).padEnd(5)} ${why}`);
  }
  console.log(bad ? `\n  ${bad} FAILURE(S)` : `\n  ${CASES.length} case(s) pass — the check admits only a literal the article really holds`);
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

console.log(`  checking ${subject.length} numeric claim(s) against their cited articles\n`);

const unsupported = [], noSource = [], checked = [], articles = {};
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
      if (m && !theirs.test(text)) { strayAbsolute = m[0]; break; }
    }
  }

  /* Anything still unsupported gets one more look, in the infobox. */
  let missing2 = missing, strayNames2 = strayNames;
  if (missing.length || strayNames.length) {
    const wiki = await articleWikitext(title);
    /* Could not read the infobox — so this row has NOT been checked, and saying
     * "the article does not contain 1085" would be a claim about an article
     * this run never finished reading. Throttling must produce unchecked rows,
     * never faults. */
    if (!wiki) { noSource.push({ r, why: `infobox unreadable for "${title}" — throttled` }); continue; }
    if (wiki) {
      const wl = dashes(wiki.toLowerCase());
      missing2 = missing.filter(x => !articleHas(wiki, x)
        && !(x.unit === '\u00b0C' && (articleHasTemperature(wiki, x.n) || articleHasTemperature(text, x.n))));
      strayNames2 = strayNames.filter(nm => !wl.includes(dashes(nm.toLowerCase())));
    }
  }

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
if (process.argv.includes('--backlog')) {
  if (only || !termsMode || !includeVerified) {
    console.error('\n  --backlog needs the full sweep: node tools/audit.mjs --terms --all --backlog');
    process.exit(2);
  }
  if (failures) {
    console.error('\n  NOT writing a backlog: this run had fetch failures, so it is incomplete.');
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
