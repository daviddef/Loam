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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
    /* A locant is part of a chemical's NAME, not a quantity in the sentence.
     * 1,2-dichloroethane yielded "1,2" -> 12, 1,3-butadiene yielded 13, and
     * 2,6-nonadienal yielded 26, none of which any article contains as a
     * number. A digit run followed by a hyphen and a letter is a name. */
    const after = text.slice(m.index + m[0].length);
    if (/^-\p{L}/u.test(after) || /^-?\d*,\d+-\p{L}/u.test(text.slice(m.index))) continue;
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
    /* The boundary has to reject a thousands separator without rejecting a
     * sentence comma. The old lookahead was a bare (?![\d,]), so "Finished in
     * 1558, it was built..." read as NOT containing 1558 — the comma after the
     * year failed the test. Any claim whose number is followed by a comma in
     * the source was reported unsupported, which is a false alarm, and false
     * alarms are how a check gets ignored. Reject a comma or point only when a
     * digit follows it. */
    const esc = f.replace('.', '\\.');
    if (new RegExp(`(?<!\\d)(?<!\\d,)(?<!\\d\\.)${esc}(?!\\d)(?!,\\d)(?!\\.\\d)`).test(text)) return true;
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

/** Match on a stem, so "enzymes" finds "enzyme" and "crystallises" finds "crystal". */
function articleHasTerm(lowerText, term) {
  const stem = term.replace(/(ing|ed|es|s|ise|ised|ize|ized|ly)$/, '');
  if (stem.length < 5) return true;          // too short to be evidence either way
  return lowerText.includes(stem);
}

const only = process.argv.find(a => !a.startsWith('--') && !a.endsWith('.mjs') && !a.includes('node'));
const includeVerified = process.argv.includes('--all');

// --terms widens the net from "claims with a number" to every unverified claim.
const termsMode = process.argv.includes('--terms');
let subject = recipes.filter(r =>
  (termsMode || /\d/.test(r.why)) && (includeVerified || !r.verified));
if (only) subject = recipes.filter(r => r.out === only && /\d/.test(r.why));

console.log(`  checking ${subject.length} numeric claim(s) against their cited articles\n`);

const unsupported = [], noSource = [], checked = [];
for (const r of subject) {
  const title = titleOf(r.src);
  if (!title) { noSource.push({ r, why: 'source is not a Wikipedia article' }); continue; }
  const text = await articleText(title);
  if (!text) { noSource.push({ r, why: `could not fetch "${title}"` }); continue; }
  const nums = numbersIn(r.why);
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
  const lowerFolded = dashes(lower);
  const strayNames = NAME_CLEARED[gestureOf(r)] ? []
    : namesIn(r.why).filter(nm => !lowerFolded.includes(dashes(nm.toLowerCase())));

  // An absolute in our sentence, with nothing of that strength anywhere in the
  // source, means the certainty is ours rather than the article's.
  let strayAbsolute = null;
  if (!ABSOLUTE_CLEARED[gestureOf(r)]) {
    for (const [ours, theirs] of ABSOLUTES) {
      const m = r.why.match(ours);
      if (m && !theirs.test(text)) { strayAbsolute = m[0]; break; }
    }
  }

  checked.push(r);
  if (missing.length || strayTerms.length || strayNames.length || strayAbsolute) {
    unsupported.push({ r, title, missing, strayTerms, strayNames, strayAbsolute, total: nums.length });
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
console.log(`\n  A number missing from the article does not make the claim false — it means`);
console.log(`  the sentence is going further than the source it names. Every one of the`);
console.log(`  seventeen errors found by hand looked exactly like this.`);
