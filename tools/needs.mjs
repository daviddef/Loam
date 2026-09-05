#!/usr/bin/env node
/**
 * needs.mjs — what would you actually need to build this?
 *
 * Every gap this project has found was found by someone noticing a specific
 * missing word: paracetamol, spanner, whisky, emu, ship, currency. That works,
 * and it does not scale, because it depends on a person happening to think of
 * the word.
 *
 * This is the mechanism that does scale. For an assembly — a house, a bicycle,
 * a loaf — you can write down what it is made of without knowing anything
 * about the corpus: a builder's list, a parts list, a recipe. Check that list
 * against the corpus and the missing pieces fall out mechanically. Author
 * them, and each new piece is itself an assembly with its own list. The corpus
 * tells you what it is missing instead of waiting to be asked.
 *
 * The unit is `data/needs.json`:
 *
 *     "house": {
 *       "src": "https://en.wikipedia.org/wiki/...",
 *       "needs": ["foundation", "brick", "mortar", "joist", ...]
 *     }
 *
 * A `needs` list is NOT a recipe. Recipes are the game's two-input grammar and
 * say how a thing is derived; a needs list is the honest, unbounded answer to
 * "what goes into one", and exists to drive authoring. Some of its entries
 * will become recipe inputs; most will just become elements that ought to
 * exist.
 *
 * Usage:  node tools/needs.mjs                 coverage for every list
 *         node tools/needs.mjs house           one list in detail
 *         node tools/needs.mjs --missing       every missing component, ranked
 *         node tools/needs.mjs --next          assemblies that have no list yet
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = f => JSON.parse(readFileSync(join(root, 'data', f), 'utf8'));
const elements = R('elements.json');
const recipes = R('recipes.json');
const NEEDS = existsSync(join(root, 'data/needs.json')) ? R('needs.json').needs : {};
/* Some made things have no bill of materials — a bevel is an angle, a weld is a
 * joint, a voussoir is one stone cut once. Counting them as owing a list
 * inflates the backlog until the sweep looks endless, and the first version of
 * this denominator did exactly that by reading tags. The exclusions are curated
 * in data/needs.json under $not_assemblies, with the rule beside them. */
const NOT_ASSEMBLY = new Set(existsSync(join(root, 'data/needs.json')) ? (R('needs.json').$not_assemblies || []) : []);

const ids = new Set(elements.map(e => e.id));
const names = new Set(elements.map(e => e.name.toLowerCase()));
const has = t => ids.has(t) || names.has(t.replace(/_/g, ' '));
// Same alternation rule the universe checklist uses, for the same reason:
// spanner and wrench share no letters, and every missing-list this project
// produced without it was wrong.
const covered = c => c.split('|').some(has);

const args = process.argv.slice(2);
const one = args.find(a => !a.startsWith('--'));

/* --next: which elements are ASSEMBLIES and have no list yet?
 *
 * The first version ranked by how often an element is used as a recipe input,
 * and returned water, sun and stone — the primitives, which are exactly the
 * things that have no bill of materials. Frequency measures how fundamental
 * something is, which is the opposite of what is wanted.
 *
 * An assembly is something MADE: it has a maker's tag, it is deep in the
 * graph rather than near the starters, and other things are built from it.
 * Ranked by depth first, because depth is the honest measure of "how much had
 * to happen before this existed".
 */
/* --narrow: WHERE ONE ROUTE IS READING AS A DEFINITION
 *
 * A player looking at `necklace` saw bead + cord and asked why it was not
 * diamonds and gold. The answer was that bead + cord was the only recipe, so it
 * was not describing one necklace among many — it was standing in as what a
 * necklace IS. A single route on a general noun is a definition whether it was
 * meant as one or not.
 *
 * That is checkable without guessing, because a needs list already says, in
 * curated form, that a thing can be made more than one way: every `a|b|c` in
 * one is a statement that any of those will do. So if a thing's parts list
 * offers alternatives and its recipes only ever reach for one branch, the
 * corpus is narrower than its own written fact.
 *
 * It reports, it does not fail. Plenty of things genuinely have one route, and
 * an alternation nobody has built the other half of yet is a gap in authoring
 * rather than an error in what is there.
 */
if (args.includes('--narrow')) {
  const madeBy = new Map();
  for (const r of recipes) {
    if (!madeBy.has(r.out)) madeBy.set(r.out, []);
    madeBy.get(r.out).push(r);
  }
  const rows = [];
  for (const [id, entry] of Object.entries(NEEDS)) {
    const rs = madeBy.get(id) || [];
    if (!rs.length) continue;
    const used = new Set(rs.flatMap(r => r.in));
    const unreached = [];
    for (const need of entry.needs) {
      if (!need.includes('|')) continue;
      const branches = need.split('|');
      const hit = branches.filter(b => used.has(b));
      /* Only count a branch the corpus could actually have reached. An
       * alternative that is not an element yet is a hole in the parts list,
       * which --missing already reports; mixing the two would make this read
       * as noise and it is the kind of list that only gets used if it does
       * not. */
      const cold = branches.filter(b => !used.has(b) && ids.has(b));
      if (hit.length && cold.length) {
        unreached.push(`${hit.join('/')} but never ${cold.join(', ')}`);
      }
    }
    if (unreached.length) rows.push({ id, n: rs.length, unreached });
  }
  rows.sort((a, b) => a.n - b.n || b.unreached.length - a.unreached.length);
  console.log(`\n${rows.length} THING(S) WHOSE RECIPES ARE NARROWER THAN THEIR OWN PARTS LIST\n`);
  for (const r of rows) {
    console.log(`  ${r.id}  (${r.n} recipe${r.n === 1 ? '' : 's'})`);
    for (const u of r.unreached) console.log(`     ${u}`);
  }
  console.log(`\n  KNOWN NOISE: some alternations are near-synonyms rather than real choices —`);
  console.log(`  hide|skin and electromagnet|coil are one thing written twice, and a recipe`);
  console.log(`  cannot use both. Those are the parts list needing tightening, not the recipes.`);
  console.log(`\n  A single route on a general noun reads as a definition. Where the parts list`);
  console.log(`  says a thing can be made more than one way and the recipes only go one way,`);
  console.log(`  the gesture is claiming more than the corpus knows.\n`);
  process.exit(0);
}

if (args.includes('--next')) {
  const MADE = new Set(['tool', 'build', 'dish', 'trade', 'instrument', 'medicine', 'transport', 'machine']);
  const byId = new Map(elements.map(e => [e.id, e]));
  const best = new Map();
  for (const r of recipes) if (!best.has(r.out)) best.set(r.out, r);
  const depthCache = new Map();
  const depthOf = (id, seen = new Set()) => {
    if (depthCache.has(id)) return depthCache.get(id);
    if (seen.has(id)) return 0;
    const r = best.get(id);
    if (!r) return 0;
    const d = 1 + Math.max(...r.in.map(i => depthOf(i, new Set([...seen, id]))));
    depthCache.set(id, d);
    return d;
  };
  const asInput = new Map();
  for (const r of recipes) for (const i of r.in) asInput.set(i, (asInput.get(i) ?? 0) + 1);
  const rows = elements
    .filter(e => !NEEDS[e.id] && !NOT_ASSEMBLY.has(e.id) && (e.tags || []).some(t => MADE.has(t)))
    .map(e => ({ id: e.id, d: depthOf(e.id), used: asInput.get(e.id) ?? 0 }))
    .sort((a, b) => (b.d - a.d) || (b.used - a.used))
    .slice(0, 40);
  console.log(`\nMADE THINGS WITH NO NEEDS LIST — deepest first, top ${rows.length}\n`);
  for (const r of rows) console.log(`  ${r.id.padEnd(26)} depth ${String(r.d).padStart(2)}   used by ${r.used} recipes`);
  // The top 40 without the total reads as a short queue, and it is not one.
  // Asked directly whether the mechanism had been run across the corpus, this
  // was the number that answered it and the tool did not print it.
  /* ONE definition of the denominator, and this is it. tools/coverage.mjs reads
   * the same three conditions, because two tools disagreeing about what counts
   * is how a coverage figure stops meaning anything — they reported 107 of
   * 2,087 and 137 of 1,978 for the same question on the same corpus.
   *   assembled   made from two or more inputs; a primitive has no parts
   *   maker's tag it is a made thing, not a rock or an animal
   *   not excluded see $not_assemblies: a bevel is an angle, a weld is a joint */
  const assembled = new Set(recipes.filter(r => r.in.length >= 2).map(r => r.out));
  /* A place already carries `of`, which names what it is built of; a dish's
   * recipe IS its parts list; a drug or a disease is not assembled at all.
   * Counting those put the denominator at 2,084 when 741 of them could never
   * have had a list. See $scope_rule in data/needs.json. */
  const SKIP = new Set(R('needs.json').$scope_exclude_tags || []);
  const PLACES = existsSync(join(root, 'data/places.json'))
    ? new Set(Object.keys(R('places.json').places)) : new Set();
  const allMade = elements.filter(e => assembled.has(e.id) && !NOT_ASSEMBLY.has(e.id)
                                    && !PLACES.has(e.id)
                                    && !(e.tags ?? []).some(t => SKIP.has(t))
                                    && (e.tags ?? []).some(t => MADE.has(t)));
  const done = allMade.filter(e => NEEDS[e.id]).length;
  console.log(`\n  ${done} of ${allMade.length} things with a maker's tag have a list — ` +
              `${allMade.length - done} do not.`);
  console.log(`  ${Object.keys(NEEDS).length} lists written in all.\n`);
  console.log('  Not every made thing wants one: a hammer is a head and a handle and its');
  console.log('  recipe already says so. A list earns its place on an ASSEMBLY — something');
  console.log('  with parts a builder would have to source separately — which is what the');
  console.log('  depth and used-by ranking above is for.\n');
  process.exit(0);
}

const report = (id, list) => {
  const miss = list.needs.filter(c => !covered(c));
  const pct = Math.round(100 * (list.needs.length - miss.length) / list.needs.length);
  return { id, total: list.needs.length, miss, pct };
};

if (one) {
  const list = NEEDS[one];
  if (!list) { console.error(`no needs list for "${one}"`); process.exit(1); }
  const { total, miss, pct } = report(one, list);
  console.log(`\n${one} — ${total - miss.length} of ${total} components present (${pct}%)\n`);
  for (const c of list.needs) console.log(`  ${covered(c) ? '  ' : '->'} ${c.split('|')[0]}`);
  if (miss.length) console.log(`\n  ${miss.length} to author: ${miss.map(m => m.split('|')[0]).join(', ')}`);
  console.log();
  process.exit(0);
}

const rows = Object.entries(NEEDS).map(([id, l]) => report(id, l)).sort((a, b) => a.pct - b.pct);
if (args.includes('--missing')) {
  const count = new Map();
  for (const r of rows) for (const m of r.miss) count.set(m, (count.get(m) ?? 0) + 1);
  const ranked = [...count].sort((a, b) => b[1] - a[1]);
  console.log(`\nEVERY MISSING COMPONENT — ${ranked.length}, most-wanted first\n`);
  for (const [c, n] of ranked) console.log(`  ${c.split('|')[0].padEnd(26)} wanted by ${n} list(s)`);
  console.log();
  process.exit(0);
}

const bar = p => '#'.repeat(Math.round(p / 5)).padEnd(20, '·');
console.log('\nWHAT WOULD YOU NEED TO BUILD THIS\n');
let tot = 0, hit = 0;
for (const r of rows) {
  tot += r.total; hit += r.total - r.miss.length;
  console.log(`  ${bar(r.pct)} ${String(r.pct).padStart(3)}%  ${String(r.total - r.miss.length).padStart(3)}/${String(r.total).padEnd(3)}  ${r.id}`);
}
console.log(`\n  ${hit} of ${tot} components present across ${rows.length} lists`);
console.log(`  node tools/needs.mjs --missing   to see what to author next\n`);
