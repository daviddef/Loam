#!/usr/bin/env node
/**
 * universe.mjs — does the corpus cover the world, or only the parts we happened
 * to have a source for?
 *
 * Every wave so far has been driven by a SOURCE: a chemistry book, a
 * microbiology text, dinosaurs, mythology, food additives. That is why the
 * corpus held 798 microbes and no oven, and why street furniture sat at 2 of 12
 * while the periodic table was complete. A source-driven corpus is shaped like
 * its bookshelf.
 *
 * This asks the opposite question, top down: if you set out to classify the
 * universe and then checked what we have, where are the holes? The checklist
 * below is that classification — the domains a general encyclopaedia divides
 * the world into, and within each, the concepts that a reasonable person would
 * say the domain is INCOMPLETE without. It is deliberately not a wish list of
 * everything; it is the spine.
 *
 * Matching: a concept may name alternatives with `|`. `spanner|wrench` counts
 * as covered if EITHER exists. That is not a convenience — it is the single
 * most expensive lesson of 3 Sep. `spanner` and `wrench` share no letters, so
 * a name search says the corpus is missing spanners while `iron + screw` has
 * been making a wrench for months. Nine such pairs were found in one day
 * (car/automobile, fridge/refrigerator, zip/zipper, can/tin_can, rug/carpet…).
 * Every "missing" list this project has produced without synonyms was wrong.
 *
 * A second scan, --umbrellas, finds the same fault from the inside instead of
 * from the checklist. It reads the corpus's own compound ids and asks which
 * head nouns are never elements themselves: the corpus holds short_term_memory,
 * long_term_memory, working_memory, sensory_memory and flash_memory and has no
 * `memory`; theory_of_mind and unconscious_mind and no `mind`; prime_number and
 * no `number`; bronze_age_collapse and no `bronze_age`. This is the most
 * repeatable defect the project has: the specialised term arrives with its
 * source, the general one belongs to no source and so is never authored.
 *
 * Usage:  node tools/universe.mjs              coverage by domain
 *         node tools/universe.mjs --missing    list every gap
 *         node tools/universe.mjs --domain X   one domain in detail
 *         node tools/universe.mjs --umbrellas  head nouns with no element
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const elements = JSON.parse(readFileSync(join(root, 'data/elements.json'), 'utf8'));

const byId = new Set(elements.map(e => e.id));
const byName = new Set(elements.map(e => e.name.toLowerCase()));
const has = term => {
  const t = term.trim();
  return byId.has(t) || byName.has(t.replace(/_/g, ' ')) || byName.has(t);
};
const covered = concept => concept.split('|').some(has);

/* ── the classification ───────────────────────────────────────────────────
 * Domains follow the order the universe assembles itself in: physics before
 * chemistry, chemistry before geology, geology before life, life before mind,
 * mind before everything people build with it.
 */
const UNIVERSE = {
'physics — spacetime and forces': `
space time spacetime gravity electromagnetism strong_force weak_force
energy momentum mass force acceleration velocity friction pressure
entropy thermodynamics heat temperature work power field wave
relativity quantum_mechanics uncertainty_principle vacuum`,

'physics — the very small': `
atom electron proton neutron quark lepton boson fermion photon gluon
neutrino muon tau higgs_boson antimatter positron nucleus isotope
radioactivity half_life fission fusion plasma superconductivity`,

'cosmos': `
universe big_bang galaxy star planet moon sun solar_system
black_hole neutron_star supernova nebula comet asteroid meteorite
dark_matter dark_energy cosmic_microwave_background light_year
orbit eclipse constellation exoplanet pulsar quasar red_giant white_dwarf`,

'chemistry': `
element compound molecule ion bond covalent_bond ionic_bond
acid base salt ph oxidation reduction catalyst solution solvent
crystal polymer isomer organic_chemistry periodic_table valence
solid liquid gas melting boiling evaporation condensation sublimation`,

'earth — materials and structure': `
rock mineral igneous_rock sedimentary_rock metamorphic_rock magma lava
soil sand clay silt gravel ore crust mantle core plate_tectonics
earthquake volcano fossil erosion weathering sediment glacier`,

'earth — water and air': `
water ocean sea river lake groundwater aquifer ice snow rain
atmosphere air oxygen nitrogen carbon_dioxide ozone cloud wind
weather climate season hurricane monsoon drought flood tide
water_cycle greenhouse_effect`,

'earth — landforms and biomes': `
mountain valley plain plateau desert forest rainforest grassland
savanna tundra wetland swamp island peninsula coast cliff cave
canyon delta dune reef prairie taiga`,

'life — the tree': `
life cell bacteria archaea virus fungus plant animal protist
eukaryote prokaryote vertebrate invertebrate mammal bird reptile
amphibian fish insect arachnid crustacean mollusk worm
algae moss fern conifer flower grass tree`,

'life — how it works': `
dna rna gene chromosome protein enzyme amino_acid mutation evolution
natural_selection species genetics heredity photosynthesis respiration
metabolism reproduction mitosis meiosis embryo ecosystem food_chain
predation symbiosis parasitism decomposition nitrogen_cycle extinction`,

'the human body': `
skeleton bone muscle skin blood heart lung brain nerve stomach
liver kidney intestine eye ear nose tongue tooth hair
immune_system hormone digestion circulation breathing sleep pain
birth death ageing`,

'health and medicine': `
disease infection bacteria_infection|infection virus_infection|virus cancer
diabetes fever inflammation wound antibiotic vaccine surgery
anaesthetic medicine drug diagnosis epidemic pandemic hygiene
nutrition vitamin malnutrition allergy mental_illness`,

'materials and making': `
wood stone metal iron steel copper bronze glass ceramic
plastic rubber paper cloth leather concrete brick cement
alloy smelting casting forging welding weaving dyeing tanning
kiln forge loom lathe|wheel mould`,

'tools and machines': `
tool knife axe hammer saw drill screw nail lever pulley
wheel gear spring engine motor|electric_motor pump valve
steam_engine internal_combustion_engine turbine battery generator
robot machine mechanism`,

'energy and industry': `
fire fuel coal petroleum natural_gas electricity nuclear_power
solar_power wind_power hydroelectricity mining refinery factory
assembly_line mass_production supply_chain waste recycling pollution`,

'building and settlement': `
house building wall roof window door floor stairs bridge road
tunnel dam aqueduct sewer city town village farm field fence
temple church castle tower skyscraper harbour railway`,

'transport': `
foot|walking horse cart wheel boat ship sail canoe raft
automobile bus truck train tram bicycle motorcycle airplane
helicopter rocket submarine navigation map compass engine|motor`,

'food and farming': `
food agriculture crop wheat rice maize potato vegetable fruit
meat fish_food|fish milk cheese bread beer wine sugar salt spice
cooking baking roasting boiling fermentation preservation
irrigation plough harvest livestock fertiliser|fertilizer famine`,

'information and computing': `
number counting writing alphabet book printing_press library
computer algorithm program bit byte binary_code logic_gate transistor
internet network database encryption artificial_intelligence
telephone radio television photograph film`,

'mathematics and logic': `
number zero infinity fraction geometry algebra calculus
proof theorem axiom set function equation probability statistics
symmetry topology prime_number pi logic paradox`,

'mind and thought': `
mind consciousness memory perception attention emotion fear
love anger happiness grief dream language thought reason
learning intelligence belief knowledge philosophy ethics logic_thought|logic`,

'society and economy': `
family tribe society law justice government democracy monarchy
money trade market currency debt tax property contract
work labour slavery class revolution war peace treaty
nation empire colonialism migration`,

'culture and expression': `
art music dance poetry story myth religion ritual festival
painting sculpture theatre song instrument rhythm colour
architecture fashion game sport play humour tradition`,

'time and history': `
day year calendar clock season era prehistory bronze_age iron_age
antiquity middle_ages renaissance industrial_revolution
agriculture_revolution|agriculture writing_invention|writing
printing|printing_press modernity future history archaeology`,
};

/* ── report ───────────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const wantMissing = args.includes('--missing');

if (args.includes('--umbrellas')) {
  // Chemistry's anion names (chloride, sulfate, hydroxide…) are real umbrella
  // gaps too, but they arrive in bulk from one source and would swamp the
  // list, so they are reported separately at the end rather than mixed in.
  const ANION = /(ide|ate|ite)$/;
  const heads = new Map();
  for (const e of elements) {
    const parts = e.id.split('_');
    if (parts.length < 2) continue;
    for (const n of [1, 2]) {
      if (parts.length <= n) continue;
      const head = parts.slice(-n).join('_');
      if (!heads.has(head)) heads.set(head, []);
      heads.get(head).push(e.id);
    }
  }
  const gaps = [...heads]
    .filter(([h, kids]) => !has(h) && kids.length >= 3 && h.length > 2)
    .sort((a, b) => b[1].length - a[1].length);
  const chem = gaps.filter(([h]) => ANION.test(h));
  const rest = gaps.filter(([h]) => !ANION.test(h));
  console.log(`\nHEAD NOUNS USED BY 3+ ELEMENTS THAT ARE NOT ELEMENTS — ${rest.length}\n`);
  for (const [h, kids] of rest.slice(0, 45))
    console.log(`  ${h.padEnd(22)} ${String(kids.length).padStart(3)}  e.g. ${kids.slice(0, 3).join(', ')}`);
  console.log(`\n  and ${chem.length} chemical anion names (${chem.slice(0, 6).map(c => c[0]).join(', ')}…),`);
  console.log(`  which are a single source's worth and want one pass of their own.\n`);
  process.exit(0);
}
const only = args.includes('--domain') ? args[args.indexOf('--domain') + 1] : null;

let totAll = 0, hitAll = 0;
const rows = [];
for (const [domain, blob] of Object.entries(UNIVERSE)) {
  if (only && !domain.includes(only)) continue;
  const concepts = blob.trim().split(/\s+/);
  const missing = concepts.filter(c => !covered(c));
  totAll += concepts.length; hitAll += concepts.length - missing.length;
  rows.push({ domain, total: concepts.length, missing });
}
rows.sort((a, b) => (b.missing.length / b.total) - (a.missing.length / a.total));

const bar = pct => '#'.repeat(Math.round(pct / 5)).padEnd(20, '·');
console.log('\nCOVERAGE AGAINST A CLASSIFICATION OF THE UNIVERSE\n');
for (const r of rows) {
  const hit = r.total - r.missing.length;
  const pct = 100 * hit / r.total;
  console.log(`  ${bar(pct)} ${String(Math.round(pct)).padStart(3)}%  ${String(hit).padStart(3)}/${String(r.total).padEnd(3)}  ${r.domain}`);
  if ((wantMissing || only) && r.missing.length)
    console.log(`      missing: ${r.missing.map(m => m.split('|')[0]).join(', ')}\n`);
}
console.log(`\n  ${hitAll} of ${totAll} concepts present (${Math.round(100 * hitAll / totAll)}%), across ${rows.length} domains`);
console.log(`  ${elements.length} elements in the corpus\n`);
