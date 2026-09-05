#!/usr/bin/env node
/**
 * places.mjs — go deep, and go global.
 *
 * A landmark is the one kind of element where being generically true is a
 * failure. "A castle in Croatia" is a category with a proper noun stuck on it,
 * and it passes every other check in this repository: the sentence is true, the
 * source resolves, the drawing is distinct, the scale is right. Nothing else
 * here can tell it apart from a real entry, because nothing else here asks
 * whether a fact is SPECIFIC.
 *
 * So this asks two questions the others cannot.
 *
 *   DEEP    does each place carry the four facts that make it that place —
 *           when, who, what of, and why there? Nehaj was finished in 1558 by
 *           Ivan Lenkovic out of the stone of the churches and monasteries
 *           demolished outside Senj's walls, on a bare hill in cannon range of
 *           the harbour. That one sentence carries its date, its material, its
 *           silhouette and its politics. A place without any of it is a name.
 *
 *   GLOBAL  measured against a world list, not against itself. Coverage against
 *           what we happen to have is not coverage, it is a total, and it will
 *           report a corpus of European castles as complete. The denominator is
 *           the UN M49 subregions and an authored checklist of 200-odd sites,
 *           so a hole in Melanesia is a number rather than a feeling.
 *
 * It also checks DERIVATION, because landmarks fail the same way verbs did: the
 * Colosseum came from stone + lion, which is association. A place derives from
 * a maker and a material or a site — khufu + desert, chares + bronze,
 * inca_empire + mountain. Those are causes. A lion is a thing that was in it.
 *
 *   node tools/places.mjs             coverage by region and by kind
 *   node tools/places.mjs --deep      every place, and which of the four it lacks
 *   node tools/places.mjs --missing   the checklist entries with no element yet
 *   node tools/places.mjs --region <id>
 *   node tools/places.mjs <id>        one place in full
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const arr = (d) => Array.isArray(d) ? d : (d.elements || d.recipes || []);

const elements = arr(read('data/elements.json'));
const recipes = arr(read('data/recipes.json'));
const P = read('data/places.json');

const byId = new Map(elements.map(e => [e.id, e]));
const REGION = new Map(P.regions.map(r => [r.id, r]));
const KIND = new Map(P.kinds.map(k => [k.id, k]));
const madeBy = new Map();
for (const r of recipes) { if (!madeBy.has(r.out)) madeBy.set(r.out, []); madeBy.get(r.out).push(r); }

/** The four facts that separate a place from a category.
 *  who is not owed by a natural wonder — a mountain has no builder, and
 *  demanding one would push the file toward inventing agency. Where a natural
 *  wonder DOES have a maker it is the most interesting thing about it: the
 *  Plitvice barriers are built by moss and algae, which is why that landscape
 *  is a different claim from a canyon. So it is optional there, not absent. */
const DEPTH = [
  ['when', 'no date — it could be any century'],
  ['who',  'nobody built it — it simply is there'],
  ['of',   'made of nothing — it joins no material in the corpus'],
  ['site', 'no reason to be where it is'],
];
const OPTIONAL = { natural: ['who'] };

const n = (x) => x.toLocaleString('en-GB');
const bar = (a, b) => { const w = 18, k = b ? Math.round(a / b * w) : 0; return '#'.repeat(k) + '·'.repeat(w - k); };
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ------------------------------------------------------------------ joining

const entries = Object.entries(P.places);
const ghosts = entries.filter(([id]) => !byId.has(id));           // entry, no element
const wanted = Object.entries(P.wanted).flatMap(([reg, list]) =>
  list.map(line => {
    const [name, kind] = line.split(/\s+—\s+/);
    return { region: reg, name: name.trim(), kind: (kind || '').trim(), slug: norm(name) };
  }));

/* A checklist line counts as present when an element exists whose id or
 * display name matches it, OR when a places entry claims it by name. Matching
 * on the display name as well as the id is what stops a rename from silently
 * re-opening a gap that was closed months ago. */
const norm2 = norm;   // used by the claim map above, kept for clarity
const nameIndex = new Map();
for (const e of elements) {
  nameIndex.set(e.id, e);
  const k = norm(e.name);
  if (!nameIndex.has(k)) nameIndex.set(k, e);
}
/* A place entry may name the checklist line it satisfies. Kuk Swamp and "Kuk
 * Early Agricultural Site" are the same place under two names, and no amount
 * of fuzzy matching should be trusted to know that — a matcher loose enough to
 * pair them would also pair things that are not the same place, and a coverage
 * number is only worth having if it never counts something twice or wrongly.
 * So the claim is explicit, and it must name a line that actually exists. */
const claims = new Map();
for (const [id, e] of entries) if (e.checklist) claims.set(norm(e.checklist), id);
const unclaimedClaims = [];

for (const w of wanted) {
  const claimed = claims.get(w.slug);
  if (claimed) { w.el = byId.get(claimed) || null; w.entry = P.places[claimed]; continue; }
  w.el = nameIndex.get(w.slug) || null;
  if (!w.el) {
    // "Great Mosque of Djenne" also answers to "djenne_mosque" and the like:
    // fall back to the last two significant words before giving up.
    const words = w.slug.split('_').filter(x => !['the','of','de','a'].includes(x));
    for (const alt of [words.join('_'), words.slice(-2).join('_'), words.slice(0, 2).join('_')]) {
      if (nameIndex.has(alt)) { w.el = nameIndex.get(alt); break; }
    }
  }
  w.entry = w.el ? P.places[w.el.id] : null;
}

/* A checklist with the same place on it twice inflates the numerator and the
 * denominator together, so the percentage barely moves and nothing looks
 * wrong. "Dubrovnik walls" and "Walls of Dubrovnik" sat side by side in
 * Southern Europe for exactly one run. A coverage number is only worth having
 * if its denominator is checked as carefully as its numerator. */
const seen = new Map();
const dupes = [];
for (const w of wanted) {
  const key = `${w.region}/${w.slug}`;
  const alt = `${w.region}/${w.slug.split('_').filter(x => !['the', 'of', 'de', 'a'].includes(x)).sort().join('_')}`;
  if (seen.has(key) || seen.has(alt)) dupes.push(w.name);
  seen.set(key, 1); seen.set(alt, 1);
}

/* The string check above only catches lines that LOOK alike. It missed three
 * pairs that did not: "Aksum stelae" and "Obelisk of Axum" were one element
 * counted twice, "Rapa Nui moai" was on two regions' lists at once, and
 * "Benin Walls" and "Benin Moat" were two elements written for one monument
 * six months apart. The reliable test is not what the lines say but what
 * satisfies them: one element must not close two lines. That is a fact about
 * the corpus rather than about spelling, and it is the check that holds. */
const bySatisfier = new Map();
const doubleCounted = [];
for (const w of wanted) {
  if (!w.el) continue;
  if (bySatisfier.has(w.el.id)) {
    doubleCounted.push({ id: w.el.id, a: bySatisfier.get(w.el.id), b: w });
  } else bySatisfier.set(w.el.id, w);
}

// ---------------------------------------------------------------- depth

const depthOf = (entry) => DEPTH.filter(([f]) => {
  if ((OPTIONAL[entry.kind] || []).includes(f)) return false;
  const v = entry[f];
  // An em dash is how a hand-authored entry says "not applicable". It is not a
  // fact, so it does not count as one.
  return v == null || (Array.isArray(v) ? !v.length : !String(v).trim() || String(v).trim() === '\u2014');
});

// ----------------------------------------------------------- derivation

/* WHAT A NOUN IS TO A MAKING
 *
 * The first version of this check read tags. Tags say what an element belongs
 * to, never what part it plays when something is made from it. Marble and
 * Mausolus are both inputs to the Mausoleum; one is the stuff and one is the
 * man it was built for, and no tag tells them apart. That is why the tag rule
 * flagged 65 places at 334 and, read through by hand on 5 Sep, found no fault
 * in any of them: it was measuring tag vocabulary, not derivation.
 *
 * data/roles.json writes the missing fact down — one curated role per element,
 * for every input a place recipe uses. Five roles contribute to a making
 * (material, technique, process, tool, maker) and five do not (site, form,
 * occupant, subject, evidence). The check is now a lookup, not a guess.
 *
 *   built things   need a contributing input that a person could supply:
 *                  material, technique, tool or maker. A technique implies a
 *                  maker without naming one, so a Roman aqueduct from
 *                  arch + concrete passes and no founder is invented for it.
 *   natural things need material or process, and nothing else. A maker for a
 *                  landform is a finding, not a pass.
 *   settlements    need only ground. A harbour at the end of a pass is exactly
 *                  why a town is where it is.
 *
 * An input with no role recorded cannot be judged. It is reported as unroled
 * and never counted as a fault — a partial file is honest as long as the tool
 * reading it only asks about ids it covers. */
const ROLES = JSON.parse(readFileSync(new URL('../data/roles.json', import.meta.url), 'utf8'));
const CONTRIBUTES = new Set(ROLES.$contributes);
const BUILDABLE = new Set(['material', 'technique', 'tool', 'maker']);
const NATURAL = new Set(['material', 'process']);
const roleOf = (id) => ROLES.roles[id] || null;

const BUILT = new Set(['fortification', 'worship', 'tomb', 'palace', 'monument', 'engineering', 'industry']);
const unroled = new Set();
function derivation(id, kind) {
  const rs = madeBy.get(id) || [];
  if (!rs.length) return { ok: false, why: 'nothing makes it' };
  const want = BUILT.has(kind) ? BUILDABLE : (kind === 'settlement' ? null : NATURAL);
  for (const r of rs) {
    if (r.verb) continue;
    const [a, b] = r.in;
    if (!b) continue;
    const roles = r.in.map(roleOf);
    for (let i = 0; i < r.in.length; i++) if (!roles[i]) unroled.add(r.in[i]);
    if (roles.some(x => !x)) continue;          // cannot judge; not a fault
    const ok = want === null
      ? roles.some(x => CONTRIBUTES.has(x) || x === 'site')
      : roles.some(x => want.has(x));
    if (ok) return { ok: true, via: `${a} + ${b}` };
  }
  const need = BUILT.has(kind)
    ? 'nothing among them is a material, technique, tool or maker'
    : kind === 'settlement' ? 'nothing among them is ground or a contribution'
    : 'nothing among them is a material or a process';
  const shown = rs.map(r => r.in.map(x => `${x}(${roleOf(x) || '?'})`).join(' + ')).join(' | ');
  return { ok: false, why: shown + ' — ' + need };
}

/* `of` is supposed to name elements this corpus already has, so a landmark
 * joins the graph rather than hanging off it as a string. Nothing enforced
 * that, so "turf" and "chryselephantine" could sit in the field looking like
 * links while pointing at nothing. A material that names no element is a
 * material the player cannot get to. */
const danglingOf = [];
for (const [id, e] of entries) {
  for (const m of (e.of || [])) if (!byId.has(m)) danglingOf.push({ id, m });
}

// ------------------------------------------------------------------ modes

const mode = process.argv[2];

if (mode === '--missing') {
  const gaps = wanted.filter(w => !w.el);
  console.log(`\n${n(gaps.length)} OF ${n(wanted.length)} CHECKLIST PLACES HAVE NO ELEMENT YET\n`);
  for (const r of P.regions) {
    const mine = gaps.filter(g => g.region === r.id);
    if (!mine.length) continue;
    console.log(`  ${r.name}  (${mine.length})`);
    for (const g of mine) console.log(`     ${g.name}${g.kind ? '  · ' + g.kind : ''}`);
    console.log();
  }
  process.exit(0);
}

if (mode === '--deep') {
  console.log(`\nWHAT EACH PLACE IS MISSING\n`);
  const rows = entries.filter(([id]) => byId.has(id));
  const shallow = rows.filter(([, e]) => depthOf(e).length);
  for (const [id, e] of rows) {
    const gaps = depthOf(e);
    const d = derivation(id, e.kind);
    const flag = gaps.length ? gaps.map(g => g[0]).join(' ') : 'complete';
    console.log(`  ${id.padEnd(26)} ${String(4 - gaps.length)}/4  ${flag}${d.ok ? '' : '   ✗ ' + d.why}`);
  }
  console.log(`\n  ${rows.length - shallow.length} of ${rows.length} carry all four facts`);
  process.exit(0);
}

if (mode === '--region') {
  const id = process.argv[3];
  const r = REGION.get(id);
  if (!r) { console.error(`no region "${id}". Try: ${P.regions.map(x => x.id).join(' ')}`); process.exit(1); }
  const mine = wanted.filter(w => w.region === id);
  console.log(`\n${r.name}\n`);
  for (const w of mine) console.log(`  ${w.el ? '✓' : '·'} ${w.name.padEnd(38)} ${w.kind}`);
  console.log(`\n  ${mine.filter(w => w.el).length} of ${mine.length}\n`);
  process.exit(0);
}

if (mode && !mode.startsWith('--')) {
  const e = P.places[mode];
  if (!e) { console.error(`no place "${mode}"`); process.exit(1); }
  const el = byId.get(mode);
  console.log(`\n${el ? el.name : mode}${el ? '' : '   (NO SUCH ELEMENT)'}`);
  console.log(`  ${REGION.get(e.region)?.name || e.region} · ${KIND.get(e.kind)?.name || e.kind}` +
    `${e.country ? ' · ' + e.country : ''}\n`);
  for (const [f, missing] of DEPTH) {
    const v = e[f];
    console.log(`  ${f.padEnd(6)} ${v ? (Array.isArray(v) ? v.join(', ') : v) : '— ' + missing}`);
  }
  const d = derivation(mode, e.kind);
  console.log(`\n  made by  ${d.ok ? d.via : '✗ ' + d.why}`);
  if (e.srcTitle) console.log(`  source   ${e.srcTitle}`);
  console.log();
  process.exit(0);
}

// -------------------------------------------------------------- the summary

console.log('\nGO DEEP, AND GO GLOBAL\n');
console.log('  BY REGION — against a world checklist, not against ourselves\n');
let have = 0;
for (const r of P.regions) {
  const mine = wanted.filter(w => w.region === r.id);
  const got = mine.filter(w => w.el).length;
  have += got;
  console.log(`  ${bar(got, mine.length)}  ${String(got).padStart(3)}/${String(mine.length).padEnd(3)} ${r.name}`);
}
/* Publish the number rather than let another tool re-derive it. coverage.mjs
 * reimplemented this matcher and got 437 where this gets 442, which is the
 * third time today two tools have answered one question two ways. */
writeFileSync(join(ROOT, 'data', 'places-coverage.json'), JSON.stringify({
  $comment: 'Written by tools/places.mjs so that tools/coverage.mjs reports the same figure this tool prints, instead of matching names a second way and disagreeing.',
  satisfied: have, wanted: wanted.length,
}, null, 2) + '\n');

console.log(`\n  ${n(have)} of ${n(wanted.length)} checklist places exist as elements ` +
  `(${Math.round(have / wanted.length * 100)}%)`);

console.log('\n  BY KIND\n');
for (const k of P.kinds) {
  const mine = wanted.filter(w => w.kind === k.id);
  const got = mine.filter(w => w.el).length;
  console.log(`  ${bar(got, mine.length)}  ${String(got).padStart(3)}/${String(mine.length).padEnd(3)} ${k.name}`);
}

const joined = entries.filter(([id]) => byId.has(id));
const full = joined.filter(([, e]) => !depthOf(e).length);
const shallowest = joined.filter(([, e]) => depthOf(e).length >= 3);
console.log(`\n  DEPTH\n`);
console.log(`  ${bar(full.length, joined.length)}  ${full.length}/${joined.length}   places carrying all four of when, who, of, site`);
const fieldMiss = DEPTH.map(([f]) => [f, joined.filter(([, e]) => depthOf(e).some(g => g[0] === f)).length]);
for (const [f, c] of fieldMiss) if (c) console.log(`     ${String(c).padStart(3)} missing ${f}`);

const bad = joined.filter(([id, e]) => !derivation(id, e.kind).ok);
let fatal = 0;
if (doubleCounted.length) {
  fatal += doubleCounted.length;
  console.log(`\n  \u2717 ${doubleCounted.length} element(s) closing two checklist lines at once:`);
  for (const d of doubleCounted) {
    console.log(`      ${d.id} satisfies "${d.a.name}" (${d.a.region}) and "${d.b.name}" (${d.b.region})`);
  }
  console.log(`      One monument, one line. A double count inflates numerator and`);
  console.log(`      denominator together, so the percentage never shows it.`);
}

if (dupes.length) {
  fatal += dupes.length;
  console.log(`\n  \u2717 ${dupes.length} checklist place(s) listed twice in the same region:`);
  for (const d of dupes) console.log(`      ${d}`);
}
{
  const lines = new Set(wanted.map(w => w.slug));
  for (const [id, e] of entries) if (e.checklist && !lines.has(norm(e.checklist))) unclaimedClaims.push({ id, c: e.checklist });
}
if (unclaimedClaims.length) {
  fatal += unclaimedClaims.length;
  console.log(`\n  \u2717 ${unclaimedClaims.length} place(s) claim a checklist line that is not on the list:`);
  for (const u of unclaimedClaims) console.log(`      ${u.id.padEnd(24)} claims "${u.c}"`);
}
if (ghosts.length) {
  fatal += ghosts.length;
  console.log(`\n  ✗ ${ghosts.length} place entr(y/ies) name an element that does not exist:`);
  for (const [id] of ghosts.slice(0, 8)) console.log(`      ${id}`);
}
if (bad.length) {
  console.log(`\n  ${bad.length} place(s) whose recipe says something true but not how it was made.`);
  console.log(`      Each input is shown with its role from data/roles.json. A recipe built`);
  console.log(`      only from site, form, occupant, subject or evidence is an association:`);
  console.log(`      it names the thing and where it stands without saying how it came to be.`);
  console.log(`      These are faults to fix, not a queue to read past.`);
  for (const [id, e] of bad) console.log(`      ${id.padEnd(24)} ${derivation(id, e.kind).why}`);
}
if (unroled.size) {
  console.log(`\n  ${unroled.size} input(s) to a place recipe have no role in data/roles.json, so the`);
  console.log(`      derivation check could not judge the recipes they appear in. This is not a`);
  console.log(`      fault in the recipe — it is a fact nobody has written down yet.`);
  console.log(`      ${[...unroled].sort().join(' ')}`);
}
if (danglingOf.length) {
  console.log(`\n  ${danglingOf.length} material(s) named in an "of" that no element answers to:`);
  for (const d of danglingOf.slice(0, 10)) console.log(`      ${d.id.padEnd(24)} of: ${d.m}`);
}
if (shallowest.length) {
  console.log(`\n  ${shallowest.length} place(s) are little more than a name — node tools/places.mjs --deep`);
}
console.log(`\n  node tools/places.mjs --missing   the ${n(wanted.length - have)} checklist places nobody has written yet\n`);
process.exit(fatal || bad.length ? 1 : 0);
