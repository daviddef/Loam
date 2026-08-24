#!/usr/bin/env node
// Integrity + playability checks on the recipe graph.
// Exits non-zero on any error. Warnings are informational.
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const elements = load('elements.json');
const recipes  = load('recipes.json');
const { verbs } = load('verbs.json');
const bedrock  = load('bedrock.json');

const errors = [];
const warns  = [];
const err  = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// ---- elements -------------------------------------------------------------
const byId = new Map();
for (const e of elements) {
  if (byId.has(e.id)) err(`duplicate element id: ${e.id}`);
  byId.set(e.id, e);
  if (!e.name)  err(`${e.id}: missing name`);
  if (!e.emoji) err(`${e.id}: missing emoji`);
  if (!e.fact)  err(`${e.id}: missing fact`);
  if (!['workshop', 'folklore'].includes(e.shelf)) err(`${e.id}: bad shelf "${e.shelf}"`);
  if (e.fact && e.fact.length > 110) warn(`${e.id}: fact is ${e.fact.length} chars (aim <110 for one card line)`);
}

const starters = elements.filter((e) => e.starter).map((e) => e.id);
if (starters.length !== 4) err(`expected 4 starters, found ${starters.length}: ${starters}`);

// ---- verbs ----------------------------------------------------------------
const verbIds = new Set(verbs.map((v) => v.id));
for (const v of verbs) {
  if (v.unlockedBy && !byId.has(v.unlockedBy)) err(`verb ${v.id}: unlockedBy "${v.unlockedBy}" is not an element`);
}

// ---- recipes --------------------------------------------------------------
// Signature rules: exactly 2 inputs and no verb (a merge), OR 1 input + a verb (a process).
const sigs = new Map();
for (const [i, r] of recipes.entries()) {
  const at = `recipe #${i} (-> ${r.out})`;
  if (!r.why) err(`${at}: missing why`);
  // The proposition is that the claims are checkable. No source, no ship.
  if (!r.src) err(`${at}: missing src — every claim must be checkable`);
  else if (!/^https:\/\//.test(r.src)) err(`${at}: src must be an https URL`);
  if (r.why && r.why.length > 260) warn(`${at}: why is ${r.why.length} chars (aim <260 to fit a card)`);
  if (!byId.has(r.out)) err(`${at}: output "${r.out}" has no element entry`);
  for (const i2 of r.in) if (!byId.has(i2)) err(`${at}: input "${i2}" has no element entry`);

  if (r.verb) {
    if (!verbIds.has(r.verb)) err(`${at}: unknown verb "${r.verb}"`);
    if (r.in.length !== 1) err(`${at}: verb recipes take exactly 1 input, got ${r.in.length}`);
  } else if (r.in.length !== 2) {
    err(`${at}: merge recipes take exactly 2 inputs, got ${r.in.length}`);
  }

  // Shelf on a recipe declares the output's shelf; it must agree with the element.
  if (r.shelf && byId.get(r.out) && byId.get(r.out).shelf !== r.shelf) {
    err(`${at}: recipe shelf "${r.shelf}" disagrees with element shelf "${byId.get(r.out).shelf}"`);
  }

  // Ambiguity: the same gesture must never have two different results.
  const sig = r.verb ? `${r.in[0]}|${r.verb}` : [...r.in].sort().join('+');
  if (sigs.has(sig) && sigs.get(sig) !== r.out) {
    err(`ambiguous gesture "${sig}" produces both "${sigs.get(sig)}" and "${r.out}"`);
  }
  sigs.set(sig, r.out);
}

// ---- bedrock --------------------------------------------------------------
// The substrate is composition, not crafting: it must never be reachable as a
// game element, must always terminate in atoms, and must not contain cycles.
const atomIds  = new Set(bedrock.atoms.map((a) => a.id));
const compIds  = new Set(bedrock.compounds.map((c) => c.id));
const aminoIds = new Set((bedrock.aminos ?? []).map((a) => a.id));
const tierIds  = new Set((bedrock.tiers ?? []).map((t) => t.id));
const linkIds  = new Set((bedrock.linkages ?? []).map((l) => l.id));
const bedIds   = new Set([...atomIds, ...compIds, ...aminoIds]);

for (const l of bedrock.linkages ?? []) {
  if (!l.fact) err(`linkage ${l.id}: missing fact`);
  if (!l.src)  err(`linkage ${l.id}: missing src`);
}
for (const a of bedrock.aminos ?? []) {
  if (!a.formula || !a.residue) err(`amino ${a.id}: missing formula`);
  if (!a.code3 || !a.code1) err(`amino ${a.id}: missing codes`);
  if (!a.src) err(`amino ${a.id}: missing src`);
  for (const x of a.of) if (!atomIds.has(x)) err(`amino ${a.id}: unknown element "${x}"`);
}
// Every node sits on a known rung, and every linkage named on an edge exists.
for (const c of bedrock.compounds) {
  if (!tierIds.has(c.tier)) err(`compound ${c.id}: unknown tier "${c.tier}"`);
  if (c.via && !linkIds.has(c.via)) err(`compound ${c.id}: unknown linkage "${c.via}"`);
  for (const v of c.variants ?? []) if (!aminoIds.has(v)) err(`compound ${c.id}: unknown variant "${v}"`);
}

for (const id of bedIds) if (byId.has(id)) err(`bedrock id "${id}" collides with a game element`);
for (const a of bedrock.atoms) {
  if (!a.symbol || !a.number || !a.name) err(`atom ${a.id}: incomplete`);
  if (a.inPlay && !a.fact) err(`atom ${a.id}: marked inPlay but has no fact`);
  if (!a.src) err(`atom ${a.id}: missing src`);
}
const compById = new Map(bedrock.compounds.map((c) => [c.id, c]));
for (const c of bedrock.compounds) {
  if (!c.fact) err(`compound ${c.id}: missing fact`);
  if (!c.src) err(`compound ${c.id}: missing src`);
  for (const x of c.of) if (!bedIds.has(x)) err(`compound ${c.id}: unknown component "${x}"`);
}
// Every compound must bottom out in atoms, with no cycle. A node reached twice
// by different paths is a diamond, not a cycle — so track the current path,
// not everything visited, and memoise nodes already proved sound.
const proven = new Set(atomIds);
const aminoById = new Map((bedrock.aminos ?? []).map((a) => [a.id, a]));
function descend(id, path) {
  if (proven.has(id)) return true;
  if (path.has(id)) { err(`bedrock cycle through "${id}"`); return false; }
  const node = compById.get(id) ?? aminoById.get(id);
  if (!node) { err(`bedrock references unknown node "${id}"`); return false; }
  if (!node.of.length && id !== 'bed_photon') { err(`compound ${id}: dead end, made of nothing`); return false; }
  path.add(id);
  for (const x of node.of) if (!descend(x, path)) return false;
  path.delete(id);
  proven.add(id);
  return true;
}
for (const c of bedrock.compounds) if (!descend(c.id, new Set())) break;
for (const [gameId, parts] of Object.entries(bedrock.composition)) {
  if (!byId.has(gameId)) err(`composition references unknown element "${gameId}"`);
  for (const p of parts) if (!bedIds.has(p)) err(`composition of ${gameId}: unknown "${p}"`);
}

// ---- reachability (unlock-aware BFS from the starters) --------------------
const known = new Set(starters);
const unlocked = new Set(verbs.filter((v) => !v.unlockedBy).map((v) => v.id));
const depth = new Map(starters.map((s) => [s, 0]));
const firstMadeBy = new Map();
let wave = 0;

for (;;) {
  wave++;
  let grew = false;
  for (const v of verbs) {
    if (!unlocked.has(v.id) && known.has(v.unlockedBy)) { unlocked.add(v.id); grew = true; }
  }
  for (const r of recipes) {
    if (known.has(r.out)) continue;
    if (r.verb && !unlocked.has(r.verb)) continue;
    if (!r.in.every((i) => known.has(i))) continue;
    known.add(r.out);
    depth.set(r.out, Math.max(...r.in.map((i) => depth.get(i))) + 1);
    firstMadeBy.set(r.out, r);
    grew = true;
  }
  if (!grew) break;
  if (wave > 500) { err('reachability did not converge'); break; }
}

for (const e of elements) {
  if (!known.has(e.id)) err(`UNREACHABLE from the four starters: ${e.id} (${e.name})`);
}
for (const v of verbs) {
  if (!unlocked.has(v.id)) err(`verb "${v.id}" can never unlock — "${v.unlockedBy}" is unreachable`);
}

// ---- orphans & dead ends (informational) ---------------------------------
const produced = new Set(recipes.map((r) => r.out));
const consumed = new Set(recipes.flatMap((r) => r.in));
// Redundancy: multiple true routes are what make the graph forgiving. A new
// element shipping with one way in silently creates a hard block downstream.
const routeCount = new Map();
for (const r of recipes) routeCount.set(r.out, (routeCount.get(r.out) ?? 0) + 1);
for (const e of elements) {
  if (!e.starter && (routeCount.get(e.id) ?? 0) < 2 && !e.soleRoute)
    warn(`${e.id}: only one route in — add a second true mechanism, or mark soleRoute:true if it genuinely has one`);
}

for (const e of elements) {
  if (!produced.has(e.id) && !e.starter) warn(`${e.id}: never produced by any recipe`);
  if (!consumed.has(e.id) && !e.terminal) warn(`${e.id}: accidental dead end — used in nothing and not marked terminal`);
  if (consumed.has(e.id) && e.terminal) warn(`${e.id}: marked terminal but something consumes it`);
}

// ---- report ---------------------------------------------------------------
const pct = (n) => `${Math.round((n / elements.length) * 100)}%`;
console.log(`elements  ${elements.length}   recipes ${recipes.length}   verbs ${verbs.length}`);
console.log(`reachable ${known.size}/${elements.length} (${pct(known.size)})   max depth ${Math.max(...depth.values())}`);
console.log(`shelves   workshop ${elements.filter((e) => e.shelf === 'workshop').length}  folklore ${elements.filter((e) => e.shelf === 'folklore').length}`);
console.log(`endpoints ${elements.filter((e) => e.terminal).length} terminal goals`);
console.log(`bedrock   ${bedrock.atoms.length} atoms (${bedrock.atoms.filter((a) => a.inPlay).length} in play)  ${bedrock.compounds.length} compounds  ${(bedrock.aminos ?? []).length} amino acids  ${(bedrock.linkages ?? []).length} linkages  ${(bedrock.tiers ?? []).length} tiers`);
console.log(`sources   ${recipes.filter((r) => r.src).length}/${recipes.length} sourced   ${recipes.filter((r) => r.verified).length} audited   ${recipes.filter((r) => r.supported).length} article-supported`);
console.log(`routes    ${(recipes.length / elements.length).toFixed(2)} per element   ${[...routeCount.values()].filter((n) => n < 2).length} single-route`);
console.log(`gestures  ${sigs.size} distinct   merges ${recipes.filter((r) => !r.verb).length}  processes ${recipes.filter((r) => r.verb).length}`);

if (warns.length) {
  console.log(`\n${warns.length} warning(s):`);
  for (const w of warns) console.log(`  · ${w}`);
}
if (errors.length) {
  console.log(`\n${errors.length} ERROR(S):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\n✓ graph is valid and fully playable from stone, water, sun, seed');
