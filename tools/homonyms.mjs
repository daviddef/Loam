#!/usr/bin/env node
/**
 * homonyms.mjs — one word, two things.
 *
 * An element id carries no sense. `scale` in this corpus is the weighing
 * balance: pivoted beam, a pan at each end, Egyptian weighing stones from
 * about 2600 BCE. Three recipes used it anyway to make a moth's wing, a
 * reptile's back and a shark's hide, and one more used it to mean the
 * graduations on a ruler. Every `why` was about the right thing. Only the
 * gesture underneath was about a set of kitchen scales.
 *
 * That is this project's own fault class — association wearing derivation's
 * clothes — and no other check in the repository could see it. validate.mjs
 * saw a well-formed recipe. sources.mjs saw a resolving URL. audit.mjs saw
 * numbers that matched. The drawing was distinct and the scale was right. The
 * only thing wrong was that the word meant something else.
 *
 * So the check is precise rather than clever. A heuristic was tried first —
 * flag inputs whose outputs scatter across families — and it returned 684
 * candidates of which about two were real. Curation beats inference here: the
 * file names each ambiguous word, the sense this corpus uses, and the words
 * that betray a different one. If a recipe's why contains one of those, the
 * prose and the gesture are talking about different things.
 *
 *   node tools/homonyms.mjs            the bill
 *   node tools/homonyms.mjs --review   single-word names not yet reviewed
 *   node tools/homonyms.mjs <word>     every recipe touching one word
 */
import fs from 'fs';

const R = p => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const elements = R('data/elements.json');
const recipes  = R('data/recipes.json');
const H        = R('data/homonyms.json');

const byId = new Map(elements.map(e => [e.id, e]));
const n = x => x.toLocaleString('en-US');
const errs = [];
const warns = [];

/* ── the bill ─────────────────────────────────────────────────────────────*/

const uses = new Map();
for (const r of recipes) for (const i of r.in) {
  if (!uses.has(i)) uses.set(i, []);
  uses.get(i).push(r);
}

let checked = 0, flagged = 0, allowed = 0;

for (const w of H.watch) {
  const el = byId.get(w.id);
  if (!el) { errs.push(`${w.id}: watched, but no such element`); continue; }
  if (!w.sense) errs.push(`${w.id}: no declared sense`);
  if (!Array.isArray(w.not) || !w.not.length) errs.push(`${w.id}: no markers for the other sense — the entry cannot catch anything`);
  for (const a of w.also || []) if (!byId.get(a)) errs.push(`${w.id}: also names "${a}", which does not exist — a sense was split out and then lost`);

  const allow = new Map((w.allow || []).map(a => [a.out, a.why]));
  for (const a of w.allow || []) if (!a.why) errs.push(`${w.id}: allows ${a.out} with no reason given`);

  for (const r of [...(uses.get(w.id) || []), ...recipes.filter(x => x.out === w.id)]) {
    checked++;
    const text = (r.why || '').toLowerCase();
    const hit = (w.not || []).filter(m => text.includes(m.toLowerCase()));
    if (!hit.length) continue;
    if (allow.has(r.out)) { allowed++; continue; }
    flagged++;
    errs.push(`${w.id} means "${w.sense}", but ${r.in.join(' + ')} → ${r.out} says: "${hit.join('", "')}"`);
  }
}

/* ── coverage ─────────────────────────────────────────────────────────────*/

const single = elements.filter(e =>
  /^[A-Za-z]+$/.test(e.name) && (uses.get(e.id) || []).length >= 2);
const reviewed = new Set([...H.watch.map(w => w.id), ...H.cleared]);
const unreviewed = single.filter(e => !reviewed.has(e.id));
const stale = [...reviewed].filter(id => !byId.get(id));

for (const id of stale) warns.push(`"${id}" is reviewed but is no longer an element`);
for (const id of H.cleared) if (H.watch.some(w => w.id === id)) errs.push(`"${id}" is both watched and cleared`);

/* ── one word ─────────────────────────────────────────────────────────────*/

const arg = process.argv[2];
if (arg && !arg.startsWith('--')) {
  const el = byId.get(arg);
  if (!el) { console.log(`no element "${arg}"`); process.exit(1); }
  const w = H.watch.find(x => x.id === arg);
  console.log(`\n  ${el.name.toUpperCase()}  [${el.shelf}]`);
  console.log(`  ${el.fact}`);
  if (w) {
    console.log(`\n  declared sense: ${w.sense}`);
    console.log(`  other senses betrayed by: ${w.not.join(', ')}`);
    if (w.also?.length) console.log(`  the other senses live at: ${w.also.join(', ')}`);
  } else {
    console.log(`\n  not on the watchlist${H.cleared.includes(arg) ? ' — reviewed and cleared' : ' — not yet reviewed'}`);
  }
  console.log('');
  for (const r of recipes.filter(x => x.out === arg)) console.log(`  ← ${r.in.join(' + ')}${r.verb ? ' ⟶ ' + r.verb : ''}`);
  for (const r of uses.get(arg) || []) console.log(`  → ${r.out.padEnd(28)} ${r.why.slice(0, 90)}`);
  console.log('');
  process.exit(0);
}

if (process.argv.includes('--review')) {
  console.log(`\n${n(unreviewed.length)} SINGLE-WORD NAMES NOT YET REVIEWED FOR SENSE\n`);
  const byUse = unreviewed
    .map(e => ({ e, u: (uses.get(e.id) || []).length }))
    .sort((a, b) => b.u - a.u);
  for (const { e, u } of byUse.slice(0, 120)) console.log(`  ${String(u).padStart(3)}  ${e.id}`);
  if (byUse.length > 120) console.log(`\n  ... and ${n(byUse.length - 120)} more`);
  console.log(`\n  Most are unambiguous. The work is looking, not fixing —`);
  console.log(`  node tools/homonyms.mjs <word>   to see every recipe one word touches\n`);
  process.exit(0);
}

/* ── report ───────────────────────────────────────────────────────────────*/

console.log('\n  HOMONYMS — one word, two things\n');
console.log(`  ${n(H.watch.length)} words watched, ${n(checked)} recipes read against their declared sense`);
if (allowed) console.log(`  ${n(allowed)} deliberate crossing(s), each with a reason on file`);
console.log(`  ${n(reviewed.size - stale.length)} of ${n(single.length)} single-word names reviewed ` +
  `(${Math.round((reviewed.size - stale.length) / single.length * 100)}%)`);

const fixed = H.watch.filter(w => w.found && !w.found.startsWith("nothing"));
console.log(`\n  what the watchlist was built from — ${n(fixed.length)} words that were actually wrong:\n`);
for (const w of fixed) console.log(`    ${w.id.padEnd(8)} ${w.found}`);

if (warns.length) {
  console.log(`\n  ${n(warns.length)} warning(s):`);
  for (const w of warns) console.log(`    · ${w}`);
}

if (errs.length) {
  console.log(`\n  ${n(errs.length)} ERROR(S):`);
  for (const e of errs) console.log(`    ✗ ${e}`);
  console.log('');
  process.exit(1);
}

console.log(`\n  ✓ every watched word is used in the sense this corpus declares for it`);
console.log(`\n  node tools/homonyms.mjs --review   the ${n(unreviewed.length)} single-word names nobody has looked at\n`);
