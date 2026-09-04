/*
 * verbs.mjs — what each of the eight verbs does to each thing, and where the
 * corpus has never said.
 *
 * The other mechanisms ask what is MISSING from the corpus. This one asks what
 * is missing from what the corpus already holds: 7,421 elements and eight
 * verbs is 59,368 questions of the form "what happens if I do this to that",
 * and 918 of them have an answer. 1.5%.
 *
 * The matrix is not the target and never could be. Most cells are empty
 * because the question is empty — you cannot ferment granite, and crushing a
 * photon does not mean anything. A mechanism that demanded completeness would
 * generate nonsense and call it coverage, which is the exact failure this
 * project exists to avoid.
 *
 * So the question is narrower and answerable: for each element, which verbs
 * OUGHT to do something, given what kind of thing it is — and of those, which
 * have never been written down? The expectation table below is the whole
 * claim, and it is deliberately conservative. Every rule in it is a physical
 * fact about a class of matter, not a guess about what would be fun.
 *
 * The second half is quantity, which is where `heat` hides its lies. Heat is
 * not one operation. Wood at 200 degrees is charcoal and at 1000 degrees is
 * ash; limestone at 900 is quicklime and at 25 is a rock. The recipe format
 * already carries `at` for exactly this, and the gesture-collision rule
 * already exempts recipes that have one — so one element can heat to several
 * different things, honestly, at stated temperatures. 45 recipes out of 9,276
 * use it. `--bands` is the report of where that silence is doing damage.
 *
 * Modes:
 *   node tools/verbs.mjs            coverage, by verb and by kind
 *   node tools/verbs.mjs --gaps     what to author next, most-wanted first
 *   node tools/verbs.mjs --bands    heat with no temperature, where one is due
 *   node tools/verbs.mjs <id>       one element's row across all eight
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
const elements = J('elements.json');
const recipes = J('recipes.json');
/* Where a verb genuinely does nothing, recorded as a fact rather than left
 * looking like unwritten work. See data/inert.json — the expectation table
 * below is broad on purpose, and a broad rule bills for cutting hay. */
const INERT = J('inert.json').inert;
const byId = Object.fromEntries(elements.map(e => [e.id, e]));
const VERBS = ['wait', 'crush', 'chill', 'heat', 'cut', 'ferment', 'blow', 'smother'];

/* ── what ought to have an answer ──────────────────────────────────────────
 * Read this as: "a thing of this kind, put through this verb, does something
 * worth recording." Each line is a fact about matter, and each is narrow on
 * purpose — the cost of a rule that is too broad is a gap list full of
 * questions with no real answer, which would waste more time than it saved.
 */
const EXPECT = [
  { when: e => tag(e, 'crop', 'plant', 'seed'),
    verbs: ['cut', 'crush', 'wait', 'ferment'],
    why: 'a plant can be cut, pressed, left to rot, or fermented' },
  { when: e => tag(e, 'metal'),
    verbs: ['heat', 'crush'],
    why: 'a metal melts, and it deforms rather than shattering' },
  { when: e => tag(e, 'mineral', 'stone') && !tag(e, 'metal'),
    verbs: ['crush', 'heat'],
    why: 'rock breaks, and heating drives off what is volatile in it' },
  { when: e => tag(e, 'kitchen', 'food', 'dish'),
    verbs: ['heat', 'cut', 'chill'],
    why: 'food is cooked, portioned and kept cold' },
  { when: e => tag(e, 'ferment'),
    verbs: ['ferment', 'wait', 'chill'],
    why: 'a ferment is defined by what time and temperature do to it' },
  { when: e => tag(e, 'microbe'),
    verbs: ['heat', 'chill'],
    why: 'heat kills it and cold stops it, which is the whole of food safety' },
  { when: e => tag(e, 'water', 'liquid'),
    verbs: ['chill', 'heat'],
    why: 'a liquid has a freezing point and a boiling point' },
  { when: e => tag(e, 'animal') && !tag(e, 'microbe'),
    verbs: ['wait', 'cut'],
    why: 'it decays, and it is butchered' },
  /* blow and smother had no rule at all, so two of the eight verbs were
   * unmeasured — 44 recipes existed and nothing was asking for any of them.
   * The rule that is actually true of both is about air: a fire wants it and
   * dies without it, and that is the same fact stated twice. Deliberately
   * narrow. Inventing a broad rule to make the bill look thorough would be the
   * opposite of what this table is for. */
  { when: e => tag(e, 'fire'),
    verbs: ['blow', 'smother'],
    why: 'combustion is a supply of air — more of it burns hotter, none of it goes out' },
  { when: e => tag(e, 'cloth', 'craft') && !tag(e, 'ideas'),
    verbs: ['cut'],
    why: 'worked material is cut to size' },
];
function tag(e, ...t) { const s = e.tags ?? []; return t.some(x => s.includes(x)); }

const done = new Set();          // "verb\0id" that already has a recipe
const bandsBy = new Map();       // id -> count of heat recipes carrying `at`
const heatNoBand = new Map();
for (const r of recipes) {
  if (!r.verb) continue;
  done.add(`${r.verb}\0${r.in[0]}`);
  if (r.verb === 'heat') {
    if (r.at != null) bandsBy.set(r.in[0], (bandsBy.get(r.in[0]) ?? 0) + 1);
    else heatNoBand.set(r.in[0], (heatNoBand.get(r.in[0]) ?? 0) + 1);
  }
}

const wanted = [];               // {id, verb, why}
const inert = [];                // established as doing nothing, with a reason

/* An entry in inert.json for a gesture that also has a recipe is a flat
 * contradiction: something either changes or it does not. Fail on it rather
 * than silently preferring one. */
const contradictions = Object.keys(INERT).filter(k => {
  const [v, id] = k.split('|');
  return done.has(`${v}\0${id}`);
});
const unknownInert = Object.keys(INERT).filter(k => !byId[k.split('|')[1]]);
/* An inert fact for a gesture the table never bills for is true but idle: it
 * shrinks nothing and still has to be maintained. Worth knowing about, not
 * worth failing over — the table may widen later and pick it up. */
let unusedInert = [];
for (const e of elements) {
  if (e.starter) continue;
  const want = new Set();
  for (const rule of EXPECT) if (rule.when(e)) for (const v of rule.verbs) want.add(`${v}\0${rule.why}`);
  for (const w of want) {
    const [v, why] = w.split('\0');
    const key = `${v}|${e.id}`;
    if (INERT[key]) { inert.push({ id: e.id, verb: v, reason: INERT[key] }); continue; }
    if (!done.has(`${v}\0${e.id}`)) wanted.push({ id: e.id, verb: v, why });
  }
}

unusedInert = Object.keys(INERT).filter(k => {
  const [v, id] = k.split('|');
  return byId[id] && !done.has(`${v}\0${id}`) && !inert.some(x => x.verb === v && x.id === id);
});

const arg = process.argv[2];
const bar = (n, of, w = 20) => '#'.repeat(Math.round(w * n / (of || 1))).padEnd(w, '·');
const nameOf = id => byId[id]?.name ?? id;

if (arg && !arg.startsWith('--')) {
  const e = byId[arg];
  if (!e) { console.error(`  ${arg} is not an element`); process.exit(1); }
  console.log(`\n${nameOf(arg)}\n`);
  for (const v of VERBS) {
    const rs = recipes.filter(r => r.verb === v && r.in[0] === arg);
    if (rs.length) {
      for (const r of rs)
        console.log(`  ${v.padEnd(9)} -> ${nameOf(r.out)}${r.at != null ? `   at ${r.at}°C` : ''}`);
    } else {
      const due = wanted.find(w => w.id === arg && w.verb === v);
      console.log(`  ${v.padEnd(9)}    ${due ? 'DUE — ' + due.why : '—'}`);
    }
  }
  console.log();
  process.exit(0);
}

if (arg === '--bands') {
  /* One `element|heat` gesture with no temperature is a claim that heating
   * that thing has exactly one outcome. For most things that is true. For
   * anything that chars, calcines, melts or decomposes it is false, and the
   * single recipe is standing in the way of the others being written. */
  const rows = [...heatNoBand.keys()]
    .filter(id => !bandsBy.has(id))
    .filter(id => { const e = byId[id]; return e && tag(e, 'mineral', 'metal', 'crop', 'plant', 'kitchen', 'stone'); })
    .sort();
  console.log(`\nHEAT WITH NO TEMPERATURE, WHERE THE THING HAS MORE THAN ONE ANSWER\n`);
  console.log(`  ${bandsBy.size} elements heat to something at a stated temperature.`);
  console.log(`  ${heatNoBand.size} heat to something with no temperature at all.\n`);
  for (const id of rows.slice(0, 40)) {
    const outs = recipes.filter(r => r.verb === 'heat' && r.in[0] === id).map(r => nameOf(r.out));
    console.log(`  ${nameOf(id).padEnd(28)} -> ${outs.join(', ')}`);
  }
  if (rows.length > 40) console.log(`  ... and ${rows.length - 40} more`);
  console.log(`\n  A recipe carrying \`at\` is exempt from the gesture rule, so the same`);
  console.log(`  thing can heat to several different products at stated temperatures.\n`);
  process.exit(0);
}

if (arg === '--gaps') {
  const byVerb = new Map();
  for (const w of wanted) (byVerb.get(w.verb) ?? byVerb.set(w.verb, []).get(w.verb)).push(w);
  console.log(`\nVERB OUTCOMES THAT OUGHT TO EXIST AND DO NOT — ${wanted.length}\n`);
  for (const v of VERBS) {
    const list = byVerb.get(v) ?? [];
    if (!list.length) continue;
    console.log(`  ${v.toUpperCase()} — ${list.length}   (${list[0].why})`);
    console.log('    ' + list.slice(0, 8).map(w => nameOf(w.id)).join(', ') +
                (list.length > 8 ? `, and ${list.length - 8} more` : ''));
  }
  console.log();
  process.exit(0);
}

console.log('\nWHAT THE EIGHT VERBS DO, AND WHERE NOBODY HAS SAID\n');
const expectedBy = new Map();
for (const w of wanted) expectedBy.set(w.verb, (expectedBy.get(w.verb) ?? 0) + 1);
for (const v of VERBS) {
  const have = [...done].filter(k => k.startsWith(v + '\0')).length;
  const due = expectedBy.get(v) ?? 0;
  // A verb no rule ever asks for would otherwise print a full bar and read as
  // finished. blow and smother did exactly that at 31/31 and 13/13 — not
  // complete, unexamined. Say which it is.
  if (!due && !EXPECT.some(r => r.verbs.includes(v))) {
    console.log(`  ${'·'.repeat(20)}  ${String(have).padStart(4)}       ${v}   (no rule asks for this yet)`);
  } else {
    console.log(`  ${bar(have, have + due)}  ${String(have).padStart(4)}/${String(have + due).padEnd(5)} ${v}`);
  }
}
const haveAny = new Set([...done].map(k => k.split('\0')[1]));
console.log(`\n  ${done.size} verb outcomes written, over ${elements.length} elements`);
console.log(`  ${haveAny.size} elements have at least one; ${elements.length - haveAny.size} have none`);
console.log(`  ${wanted.length} outcomes are DUE by the expectation table above`);
console.log(`  ${inert.length} established as inert — the verb does nothing, and data/inert.json says why`);
if (unusedInert.length)
  console.log(`  ${unusedInert.length} inert fact(s) nothing was asking for — the expectation table never billed them`);
if (contradictions.length) {
  console.log(`\n  \u2717 ${contradictions.length} gesture(s) recorded as inert that also have a recipe:`);
  for (const k of contradictions.slice(0, 8)) console.log(`      ${k}`);
}
if (unknownInert.length) {
  console.log(`\n  \u2717 ${unknownInert.length} inert fact(s) naming an element that does not exist:`);
  for (const k of unknownInert.slice(0, 8)) console.log(`      ${k}`);
}
console.log(`  ${bandsBy.size} elements heat to something at a stated temperature; ${heatNoBand.size} without one`);
console.log(`\n  node tools/verbs.mjs --gaps    what to author next`);
console.log(`  node tools/verbs.mjs --bands   where heat is pretending to have one answer\n`);
