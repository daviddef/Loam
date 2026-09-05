#!/usr/bin/env node
/* WHAT AN ELEMENT DOES TO A PERSON
 *
 * The Ragdoll canvas asks one question — drop this on a human body, what
 * happens — and the corpus could not answer it. Tags do not say. Cautions say
 * only that there is a hazard. The recipe says nothing at all. So this is the
 * fifth curated field, and the reason is the same as for roles, homonyms,
 * inert and needs: it is a fact nobody had written down.
 *
 * THE DESIGN DECISION THAT MAKES IT CHECKABLE is that an outcome must be an
 * element this corpus already has. asbestos + human -> mesothelioma is not new
 * content; it is a new view of content that has already passed validate,
 * sources, roles and the numeric audit. The whole gate suite protects the
 * Ragdoll layer for free, and where an outcome does not exist, authoring it is
 * ordinary corpus work that gets the ordinary checks.
 *
 * THE SAFETY RULE IS A GATE, NOT A HABIT. This file is one careless sentence
 * away from being a how-to. The mechanism prose says what happens in the body;
 * it never says how to bring it about, never gives a quantity that would cause
 * harm, and never describes obtaining or concentrating anything. That is
 * checked here and it FAILS rather than warns, because a check that only warns
 * about this is worse than none.
 *
 *   node tools/effects.mjs             check, and report reach
 *   node tools/effects.mjs --missing   elements with a caution and no effect
 *   node tools/effects.mjs <route>     everything that gets in that way
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => JSON.parse(readFileSync(join(ROOT, 'data', p), 'utf8'));
const n = (x) => x.toLocaleString('en-US');

const E = D('effects.json');
const elements = D('elements.json');
const cautions = D('cautions.json').hazards;
const byId = new Map(elements.map(e => [e.id, e]));
const ROUTES = Object.keys(E.$routes);
const TIERS = ['acute', 'contact', 'conditional', 'cumulative'];
const VALENCE = Object.keys(E.$valence);
const errors = [];

/* METHOD-SHAPED PROSE. Each pattern describes a sentence that has stopped
 * explaining and started instructing. They are deliberately narrow: a check
 * that fires on correct writing is one that gets switched off, and this is the
 * one check that must never be switched off. */
const METHOD = [
  [/\b(?:how to|in order to)\s+(?:make|produce|obtain|extract|concentrate|synthesi[sz]e|prepare)\b/i,
   'tells the reader how to make or obtain something'],
  [/\b(?:lethal dose|LD ?50|median lethal|fatal dose|minimum lethal)\b/i,
   'gives a dose-to-harm figure'],
  [/\b\d[\d.,]*\s*(?:mg|g|ml|µg|ug)\s*(?:\/|per )\s*kg\b/i,
   'gives a dose per body weight'],
  [/\benough to (?:kill|be fatal|cause death)\b/i,
   'quantifies an amount that would kill'],
  [/\byou (?:can|could|should|must)\s+(?:make|produce|obtain|extract|concentrate|combine|mix)\b/i,
   'addresses the reader with a procedure'],
  [/\b(?:mix|combine|add|heat|distil|distill|concentrate)\s+\w+\s+(?:with|and|to)\s+\w+\s+to\s+(?:make|produce|form|obtain)\b/i,
   'reads as a preparation'],
];

/* One row is one row whether the thing that acts is a substance or a verb.
 * The only difference is what the key has to be, so that is the only thing
 * passed in — everything after it is the same field-for-field check, because
 * a verb effect that skipped the safety pattern would be the obvious hole. */
function checkRow(id, f, where) {
  if (!VALENCE.includes(f.valence)) errors.push(`${where}: valence "${f.valence}" is not one of ${VALENCE.join(', ')}`);
  if (f.valence === 'benefit' && (f.carcinogen || f.iarc)) errors.push(`${where}: a benefit cannot be a carcinogen`);
  if (!ROUTES.includes(f.route)) errors.push(`${where}: route "${f.route}" is not one of ${ROUTES.join(', ')}`);
  if (!TIERS.includes(f.onset)) errors.push(`${where}: onset "${f.onset}" is not one of ${TIERS.join(', ')}`);
  if (f.prevents && !byId.has(f.prevents)) errors.push(`${where}: prevents "${f.prevents}" is not an element`);
  if (f.prevents && f.valence !== 'benefit') errors.push(`${where}: prevents only makes sense on a benefit`);
  // An inert row has no outcome because there is no outcome. That is the point
  // of it: "nothing happens, and here is why" is a fact, where "nothing is on
  // record" is an admission.
  if (!f.outcome && f.valence !== 'inert') errors.push(`${where}: no outcome`);
  if (f.outcome && f.valence === 'inert') errors.push(`${where}: an inert row names no outcome — nothing came of it`);
  else if (f.outcome && !byId.has(f.outcome)) errors.push(`${where}: outcome "${f.outcome}" is not an element — author it first, so the Ragdoll card is an ordinary card`);
  if (!f.src || !String(f.src).startsWith('http')) errors.push(`${where}: no source`);
  if (!f.mechanism || f.mechanism.length < 40) errors.push(`${where}: mechanism is missing or too short to be an explanation`);
  for (const [re, why] of METHOD) {
    if (re.test(f.mechanism || '')) errors.push(`${where}: MECHANISM ${why} — describe what happens in the body, never how to bring it about`);
  }
  /* A DIAL AND ITS LADDER. The scale must be the one the medicine actually
   * uses — core temperature, carboxyhaemoglobin per cent, burn degree — and
   * never an invented nought-to-a-hundred, because the whole value of a stage
   * is that a reader can go and check it. Stages walk from `from` towards
   * `to` and must stay inside that range and in order. */
  if (f.dial || f.stages) {
    const D = f.dial;
    if (!D) errors.push(`${where}: has stages and no dial to measure them on`);
    else {
      if (!D.unit || !D.src) errors.push(`${where}: a dial needs a unit and a source`);
      if (typeof D.from !== 'number' || typeof D.to !== 'number') errors.push(`${where}: a dial needs numeric from and to`);
    }
    const st = f.stages || [];
    if (st.length < 2) errors.push(`${where}: a ladder with fewer than two rungs is not a ladder`);
    const up = D && D.to > D.from;
    let last = null;
    st.forEach((g, i) => {
      const at = `${where}.stages[${i}]`;
      if (typeof g.at !== 'number') errors.push(`${at}: no value on the dial`);
      else if (D) {
        const lo = Math.min(D.from, D.to), hi = Math.max(D.from, D.to);
        if (g.at < lo || g.at > hi) errors.push(`${at}: ${g.at} is off the dial (${lo}..${hi})`);
        if (last !== null && (up ? g.at <= last : g.at >= last))
          errors.push(`${at}: ${g.at} does not follow ${last} towards ${D.to}`);
        last = g.at;
      }
      if (!g.label) errors.push(`${at}: no label`);
      if (!g.what || g.what.length < 30) errors.push(`${at}: too short to say what happens`);
      if (g.outcome && !byId.has(g.outcome)) errors.push(`${at}: outcome "${g.outcome}" is not an element`);
      if (g.valence && !VALENCE.includes(g.valence)) errors.push(`${at}: valence "${g.valence}" is not one of ${VALENCE.join(', ')}`);
      for (const [re, why] of METHOD)
        if (re.test(g.what || '')) errors.push(`${at}: STAGE ${why}`);
    });
    if (D && st.length && st[0].at !== D.from) errors.push(`${where}: the first rung must start at the dial's own from (${D.from})`);
  }
  if (f.carcinogen && f.iarc !== 1) errors.push(`${where}: carcinogen is for IARC Group 1 only; set iarc: 1 or drop the flag`);
}

/* Every entry is a LIST. The same thing is routinely both — sun makes vitamin
 * D and melanoma in the same skin, by the same route, from the same photons —
 * and a field that could hold only the harm was a hazard list in disguise. */
const rows = (v) => Array.isArray(v) ? v : [v];
for (const [id, list] of Object.entries(E.effects)) {
  if (!byId.has(id)) errors.push(`effects.${id}: no element has this id`);
  if (!Array.isArray(list)) errors.push(`effects.${id}: must be a list, even when there is one entry`);
  rows(list).forEach((f, i) => checkRow(id, f, `effects.${id}[${i}]`));
  const seen = new Set();
  for (const f of rows(list)) {
    const key = `${f.valence}|${f.route}|${f.outcome}`;
    if (seen.has(key)) errors.push(`effects.${id}: two entries say the same thing (${key})`);
    seen.add(key);
  }
}
/* The hazard block. cautions.json attaches its wording to the hazard rather
 * than to the item, and so does this: what beryllium dust does to a lung is
 * one fact, not twelve. Every id on that hazard's list answers with it, and an
 * element's own row in `effects` overrides it. */
const HAZ = E.hazards || {};
for (const [id, list] of Object.entries(HAZ)) {
  if (!cautions[id]) errors.push(`hazards.${id}: no hazard in data/cautions.json has this id`);
  if (!Array.isArray(list)) errors.push(`hazards.${id}: must be a list`);
  rows(list).forEach((f, i) => checkRow(id, f, `hazards.${id}[${i}]`));
  // Two curated files, one fact. cautions.json already decided how loudly to
  // say this; the effect must not quietly say it differently.
  const sev = cautions[id]?.severity;
  for (const f of rows(list))
    if (sev && f.onset !== sev)
      errors.push(`hazards.${id}: onset "${f.onset}" disagrees with the caution's severity "${sev}"`);
}
// The verbs block. "'smother' a human, e.g. still shows the verb impact on the
// human" was in the brief in those words, and a verb is not an element — so it
// gets its own block, keyed on data/verbs.json, and the same gate.
const verbIds = new Set(D('verbs.json').verbs.map(v => v.id));
for (const [id, list] of Object.entries(E.verbs || {})) {
  if (!verbIds.has(id)) errors.push(`verbs.${id}: no verb has this id — keys here come from data/verbs.json`);
  rows(list).forEach((f, i) => checkRow(id, f, `verbs.${id}[${i}]`));
}

/* THE BENEFIT SIDE'S DENOMINATOR. The harm side has had one since the start —
 * 621 elements carry a caution — and the benefit side had none, which meant it
 * could sit at thirty rows for a year and nothing would show that it had. This
 * one is not ours: it is the standard list of nutrients a human body cannot
 * make. A nutrient is covered when some element carries a benefit row whose
 * outcome IS that nutrient. */
const NUTRIENTS = E.$nutrients || {};
const supplies = new Map();               // nutrient id -> [element ids]
for (const [id, list] of Object.entries(E.effects))
  for (const f of (Array.isArray(list) ? list : [list]))
    if (f.valence === 'benefit' && NUTRIENTS[f.outcome])
      supplies.set(f.outcome, [...(supplies.get(f.outcome) || []), id]);
for (const [id, nut] of Object.entries(NUTRIENTS)) {
  if (!nut.group || !nut.why || !nut.src) errors.push(`$nutrients.${id}: needs a group, a why and a src`);
  if (nut.deficiency && !byId.has(nut.deficiency)) errors.push(`$nutrients.${id}: deficiency "${nut.deficiency}" is not an element`);
}
const noElement = Object.keys(NUTRIENTS).filter(id => !byId.has(id));
const covered = Object.keys(NUTRIENTS).filter(id => supplies.has(id));

const cautioned = new Set(Object.values(cautions).flatMap(h => h.ids || []));
// Answered = has its own row, or belongs to a hazard that has one.
const viaHazard = new Set(Object.keys(HAZ).flatMap(k => cautions[k]?.ids || []));
const answered = new Set([...cautioned].filter(id => E.effects[id] || viaHazard.has(id)));
const owed = [...cautioned].filter(id => !answered.has(id)).sort();

const mode = process.argv[2];
if (mode === '--nutrients') {
  console.log(`\n${n(covered.length)} OF ${n(Object.keys(NUTRIENTS).length)} ESSENTIAL NUTRIENTS ARE SUPPLIED BY SOMETHING IN THIS CORPUS\n`);
  let group = null;
  for (const [id, nut] of Object.entries(NUTRIENTS)) {
    if (nut.group !== group) { console.log(`  -- ${nut.group} --`); group = nut.group; }
    const from = supplies.get(id);
    const mark = from ? '✓' : byId.has(id) ? ' ' : '·';
    console.log(`  ${mark} ${id.padEnd(24)}${from ? from.join(', ') : byId.has(id) ? '' : 'no element for it yet'}`);
  }
  console.log(`\n  ✓ supplied   (blank) the element exists and nothing supplies it   · no element yet\n`);
  process.exit(0);
}
if (mode === '--benefits') {
  const mine = Object.entries(E.effects).flatMap(([id, l]) => l.filter(f => f.valence === 'benefit').map(f => [id, f]));
  console.log(`\n${n(mine.length)} THING(S) THE BODY IS BETTER OFF FOR\n`);
  for (const [id, f] of mine) console.log(`  ${id.padEnd(24)} ${f.route.padEnd(11)} ${f.onset.padEnd(12)} -> ${f.outcome}`);
  console.log(`\n  An element with only a harm row is not necessarily only harmful —\n  it may just be half-written. ${n(Object.entries(E.effects).filter(([, l]) => l.every(f => f.valence === 'harm')).length)} are harm-only today.\n`);
  process.exit(0);
}
if (mode === '--missing') {
  console.log(`\n${n(owed.length)} ELEMENT(S) CARRY A CAUTION AND HAVE NO EFFECT YET\n`);
  for (let i = 0; i < owed.length; i += 4) console.log('  ' + owed.slice(i, i + 4).map(x => x.padEnd(26)).join('').trimEnd());
  console.log(`\n  These are the population with the fact half-written already: the caution\n  note usually names the route. Read it rather than starting again.\n`);
  process.exit(0);
}
if (mode && ROUTES.includes(mode)) {
  const mine = Object.entries(E.effects).flatMap(([id, l]) => l.filter(f => f.route === mode).map(f => [id, f]));
  console.log(`\n${n(mine.length)} VIA "${mode}" — ${E.$routes[mode]}\n`);
  for (const [id, f] of mine) console.log(`  ${id.padEnd(24)} ${f.valence.padEnd(8)} ${f.onset.padEnd(12)} -> ${f.outcome}`);
  console.log();
  process.exit(0);
}

console.log(`\nWHAT AN ELEMENT DOES TO A PERSON\n`);
const all = Object.values(E.effects).flat();
const byRoute = {}, byTier = {}, byVal = {};
for (const f of all) {
  byRoute[f.route] = (byRoute[f.route] || 0) + 1;
  byTier[f.onset] = (byTier[f.onset] || 0) + 1;
  byVal[f.valence] = (byVal[f.valence] || 0) + 1;
}
for (const r of ROUTES) console.log(`  ${r.padEnd(12)} ${String(byRoute[r] || 0).padStart(4)}   ${E.$routes[r]}`);
console.log();
for (const t of TIERS) console.log(`  ${t.padEnd(12)} ${String(byTier[t] || 0).padStart(4)}`);
console.log();
for (const v of VALENCE) console.log(`  ${v.padEnd(12)} ${String(byVal[v] || 0).padStart(4)}   ${E.$valence[v]}`);
const both = Object.entries(E.effects).filter(([, l]) => new Set(l.map(f => f.valence)).size > 1);
console.log(`\n  ${n(all.length)} effect(s) across ${n(Object.keys(E.effects).length)} element(s); ${n(both.length)} carry both sides.`);
console.log(`  harm:    ${n(answered.size)} of ${n(cautioned.size)} elements that carry a caution — ${n(Object.keys(HAZ).length)} of ${n(Object.keys(cautions).length)} hazard classes answered.`);
console.log(`  benefit: ${n(covered.length)} of ${n(Object.keys(NUTRIENTS).length)} essential nutrients supplied${noElement.length ? ` (${n(noElement.length)} have no element yet)` : ''}.`);
console.log(`  ${n(Object.keys(E.verbs || {}).length)} of ${n(verbIds.size)} verb(s) do something to a body.`);
const laddered = [...Object.values(E.effects).flat(), ...Object.values(E.verbs).flat(),
                  ...Object.values(E.hazards).flat()].filter(f => f.stages).length;
console.log(`  ${n(laddered)} of them are staged — hold it on the body and the dial climbs.`);
console.log(`  node tools/effects.mjs --benefits   the other side`);
console.log(`  node tools/effects.mjs --nutrients  what a body cannot make, and what supplies it`);
console.log(`  node tools/effects-audit.mjs        does the cited article actually say it`);
console.log(`  node tools/effects.mjs --missing   the rest`);

if (errors.length) {
  console.log(`\n${n(errors.length)} PROBLEM(S)\n`);
  for (const e of errors) console.log(`  ${e}`);
  console.log();
  process.exit(1);
}
console.log(`\n✓ every effect names a real outcome, a real route, and a source —\n  and none of them reads as a method\n`);
