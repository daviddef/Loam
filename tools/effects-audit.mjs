#!/usr/bin/env node
/* DOES THE SOURCE ACTUALLY SAY THIS?
 *
 * tools/effects.mjs checks that every effect row has a source. It has never
 * checked that the source SUPPORTS the row, and a URL returning 200 proves
 * only that the page exists. That gap is the exact fault this project keeps
 * finding in itself: a sentence can be true, and sourced, and still not be
 * what the source says — which is how a confident paragraph ends up citing an
 * article that never mentions the thing it claims.
 *
 *   "im not confident you have the facts. i suspect we need a repeatable
 *    mechanism for this as well so it works for all future elements"
 *
 * Right on both counts. This is that mechanism, and it is the same one
 * tools/audit.mjs already applies to the numbers in recipe prose: pull the
 * cited article and ask whether what we assert is in it.
 *
 * WHAT IT PROVES AND WHAT IT DOES NOT. A term appearing in the article is weak
 * evidence — it might be there about something else entirely. A term NOT
 * appearing is the useful signal, because the row is then asserting something
 * its own source does not say. That is where the errors are, and this tool is
 * built around the absence rather than the presence.
 *
 * Four checks per row:
 *   outcome     the outcome element's name is somewhere in the article
 *   route       the route, or an ordinary synonym of it, is in the article
 *   figures     numbers in the mechanism appear in the article
 *   iarc        carcinogen: true is backed by a Group 1 statement
 * and for a dose ladder, every rung's value must appear in the staging source.
 *
 *   node tools/effects-audit.mjs           audit every row
 *   node tools/effects-audit.mjs --strict  exit 1 on any unsupported row
 *   node tools/effects-audit.mjs <id>      just this element, verb or hazard
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { articleText, articleWikitext, titleOf, stats } from './lib/wiki.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = p => JSON.parse(readFileSync(join(ROOT, 'data', p), 'utf8'));
const n = x => x.toLocaleString('en-US');

const E = D('effects.json');
const elements = D('elements.json');
const byId = new Map(elements.map(e => [e.id, e]));

/* Ordinary words for each route. An article about mesothelioma says "inhaled"
 * or "breathing in"; it does not say "route of exposure: inhaled". The list is
 * generous on purpose — a route check that fires on correct rows is one that
 * gets ignored, and the outcome check is the one carrying the weight. */
const ROUTE_WORDS = {
  inhaled:    ['inhal', 'breath', 'airborne', 'respirat', 'lung', 'dust', 'fume', 'vapour', 'vapor', 'aerosol', 'gas'],
  ingested:   ['ingest', 'swallow', 'eat', 'ate', 'diet', 'oral', 'drink', 'gut', 'intestin', 'stomach', 'food'],
  contact:    ['contact', 'skin', 'dermal', 'dermatitis', 'topical', 'eye', 'mucous', 'sting', 'cut', 'wound'],
  absorbed:   ['absorb', 'through the skin', 'transdermal', 'percutaneous', 'penetrat'],
  injected:   ['inject', 'bite', 'bitten', 'sting', 'bloodstream', 'intravenous', 'needle', 'vector', 'transmit'],
  radiation:  ['radiat', 'ultraviolet', 'uv', 'gamma', 'x-ray', 'isotope', 'radioactiv', 'dose'],
  mechanical: ['injur', 'trauma', 'impact', 'crush', 'fractur', 'laceration', 'force', 'collision', 'fall'],
  thermal:    ['heat', 'burn', 'temperature', 'cold', 'thermal', 'scald', 'freez', 'hypotherm'],
};

/* Loam's own outcome vocabulary. These are categories rather than diagnoses —
 * an article about mercury poisoning describes neurotoxicity for pages without
 * ever writing "neurotoxin" — so they are checked against the words the
 * subject is actually written in. This is not a loosening: a source that
 * mentions none of these is still saying nothing about the claim. */
const CATEGORY = {
  irritant:     ['irritat', 'inflamm', 'burning', 'stinging', 'redness', 'rash'],
  poisoning:    ['poison', 'toxic', 'intoxicat', 'overdose'],
  neurotoxin:   ['neurotox', 'nervous system', 'neurolog', 'brain', 'nerve'],
  sensitiser:   ['sensitis', 'sensitiz', 'allerg', 'hypersensitiv', 'dermatitis'],
  hepatotoxin:  ['liver', 'hepat'],
  nephrotoxin:  ['kidney', 'renal', 'nephro'],
  corrosive:    ['corrosive', 'caustic', 'burn', 'destroys tissue'],
  carcinogen:   ['carcinogen', 'cancer', 'tumour', 'tumor'],
  mutagen:      ['mutagen', 'mutation', 'dna damage'],
  teratogen:    ['teratogen', 'birth defect', 'congenital'],
  infection:    ['infect', 'pathogen', 'bacteri', 'virus', 'parasit'],
  blunt_trauma: ['injur', 'trauma', 'impact', 'struck', 'crush', 'fatal', 'killed'],
  laceration:   ['cut', 'lacerat', 'wound', 'sharp', 'bleed'],
  thermal_burn: ['burn', 'scald', 'heat'],
  electrocution:['electric', 'current', 'shock', 'cardiac arrest'],
  drowning:     ['drown', 'swept', 'water'],
  asphyxia:     ['asphyx', 'suffocat', 'oxygen', 'breath'],
  allergic_reaction: ['allerg', 'hypersensitiv', 'anaphyla'],
};

/** Distinctive words of an element's name, minus the ones that carry no weight. */
const STOP = new Set(['the', 'of', 'a', 'and', 'in', 'disease', 'syndrome', 'reaction', 'injury']);
function nameTerms(id) {
  const e = byId.get(id);
  const words = (e ? e.name : id.replace(/_/g, ' ')).toLowerCase().split(/[^a-z0-9]+/);
  const kept = words.filter(w => w.length > 3 && !STOP.has(w));
  return kept.length ? kept : words.filter(Boolean);
}

/* Numbers worth checking, borrowed wholesale from tools/audit.mjs's reasoning:
 * bare small integers are structural rather than factual and flagging them
 * buries the ones that matter. */
function figuresIn(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g)) {
    const raw = m[0].replace(/,/g, '');
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    if (v < 10 && Number.isInteger(v)) continue;      // "two", "the four routes"
    out.add(raw);
  }
  return [...out];
}
const hasFigure = (text, raw) => {
  const v = Number(raw);
  const loose = new RegExp(`\\b${raw.replace('.', '\\.')}\\b`);
  if (loose.test(text)) return true;
  // 20,000 in our prose and 20000 in theirs, or the other way about
  const grouped = v.toLocaleString('en-US');
  if (text.includes(grouped)) return true;
  return false;
};

/** Every row in the file, flattened, with somewhere to point when it fails. */
function allRows() {
  const rows = [];
  for (const [block, obj] of [['effects', E.effects], ['hazards', E.hazards], ['verbs', E.verbs]])
    for (const [id, list] of Object.entries(obj || {}))
      (Array.isArray(list) ? list : [list]).forEach((f, i) => rows.push({ where: `${block}.${id}[${i}]`, id, block, f }));
  return rows;
}

const only = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
const strict = process.argv.includes('--strict');
let rows = allRows();
if (only) rows = rows.filter(r => r.id === only);

console.log(`\nDOES THE SOURCE ACTUALLY SAY THIS?\n`);
console.log(`  ${n(rows.length)} row(s) to check. A term missing from the cited article is the`);
console.log(`  signal; a term present is only weak evidence that the row is right.\n`);

const problems = [], unreached = [];
let checked = 0, unfetchable = 0;

for (const { where, id, f } of rows) {
  const title = titleOf(f.src);
  if (!title) { unfetchable++; unreached.push([where, 'src is not a Wikipedia article — cannot be checked by this tool']); continue; }
  let text = await articleText(title);
  if (!text) { unfetchable++; unreached.push([where, `could not fetch "${title}"`]); continue; }
  let lower = text.toLowerCase();
  checked++;

  const misses = [];

  // 1. the outcome. The single most useful check: a row whose source never
  //    mentions its own outcome is either mis-sourced or wrong.
  if (f.outcome) {
    const terms = CATEGORY[f.outcome] || nameTerms(f.outcome);
    if (!terms.some(t => lower.includes(t))) misses.push(`outcome "${f.outcome}" is not mentioned`);
  }
  // 2. the route
  if (f.route) {
    const words = ROUTE_WORDS[f.route] || [f.route];
    if (!words.some(w => lower.includes(w))) misses.push(`route "${f.route}" has no support`);
  }
  // 3. figures in our own sentence
  const figs = figuresIn(f.mechanism || '');
  const missingFigs = figs.filter(x => !hasFigure(text, x));
  // 4. an IARC Group 1 claim is a specific, checkable assertion
  if (f.carcinogen) {
    let iarcText = text;
    if (f.srcIarc) {
      const t2 = titleOf(f.srcIarc);
      iarcText = (t2 && await articleText(t2)) || '';
    }
    if (!/group 1|carcinogenic to humans/i.test(iarcText))
      misses.push(f.srcIarc ? 'carcinogen: true and srcIarc does not say Group 1 either'
                            : 'carcinogen: true but the article says nothing about Group 1 — add srcIarc');
  }

  // A second chance for figures and outcomes: the rendered page, where
  // infoboxes and tables live. Only pulled when the prose alone fell short,
  // because it triples the time of a full run.
  if (missingFigs.length || misses.length) {
    const wide = (await articleWikitext(title)).toLowerCase();
    if (wide) {
      for (let i = misses.length - 1; i >= 0; i--) {
        const m = misses[i];
        if (m.startsWith('outcome') && nameTerms(f.outcome).some(t => wide.includes(t))) misses.splice(i, 1);
        else if (m.startsWith('route') && (ROUTE_WORDS[f.route] || []).some(w => wide.includes(w))) misses.splice(i, 1);
        else if (m.startsWith('carcinogen') && /group 1|carcinogenic to humans/.test(wide)) misses.splice(i, 1);
      }
      for (const x of [...missingFigs]) if (hasFigure(wide, x)) missingFigs.splice(missingFigs.indexOf(x), 1);
    }
  }
  for (const x of missingFigs) misses.push(`the figure ${x} is not in the article`);

  // 5. a dose ladder's rungs, against the staging's own source
  if (f.stages && f.dial?.src) {
    const dTitle = titleOf(f.dial.src);
    const dText = dTitle ? (await articleText(dTitle)) || '' : '';
    for (const g of f.stages) {
      if (Math.abs(g.at) < 10 && Number.isInteger(g.at)) continue;
      if (!hasFigure(dText, String(g.at))) misses.push(`rung ${g.at}${f.dial.suffix || ''} is not in the staging source`);
    }
  }

  if (misses.length) problems.push([where, misses.join('; ')]);
}

console.log(`  checked      ${String(checked).padStart(4)}   article fetched and read`);
console.log(`  flagged      ${String(problems.length).padStart(4)}   the article does not carry something the row asserts`);
console.log(`  NOT CHECKED  ${String(unfetchable).padStart(4)}   no article, or the fetch failed — this is not a pass`);
if (unfetchable > checked / 4)
  console.log(`\n  ⚠ more than a quarter of the rows were never reached. Wikipedia throttles\n    this address; run again and the disk cache will carry the ones already got.`);
console.log(`  fetched ${stats.fetched} article(s) this run, ${stats.fromCache} from cache, ${stats.failures} failure(s).`);

if (problems.length) {
  console.log(`\nFLAGGED\n`);
  for (const [where, why] of problems) console.log(`  ${where.padEnd(42)} ${why}`);
  console.log(`\n  A flag is not a verdict. Read the article and either fix the row or`);
  console.log(`  point it at the source that actually says this.\n`);
}

// A machine-readable record, so the number can be tracked the way coverage is.
writeFileSync(join(ROOT, 'data/effects-audit.json'), JSON.stringify({
  $comment: 'Written by tools/effects-audit.mjs. Which effect rows are carried by the article they cite. A flag means the article does not mention something the row asserts; it is a place to look, not a verdict.',
  checked, unfetchable, flagged: problems.length,
  unreached: unreached.map(([where, why]) => ({ where, why })),
  when: new Date().toISOString().slice(0, 10),
  problems: problems.map(([where, why]) => ({ where, why })),
}, null, 2) + '\n');

if (strict && problems.length) process.exit(1);
