#!/usr/bin/env node
/**
 * scale.mjs — the characteristic size of every item, to the nearest power of ten.
 *
 * This is a factual claim, so it lives with the other factual claims rather
 * than being buried in a stylesheet. The rule for assigning one:
 *
 *   the size of the thing AS DRAWN AND AS USED, not of its smallest part.
 *
 * Water is 10^-1 m because the item is a body of water you pour, and that is
 * what the drawing shows. The H2O molecule is 10^-10 m, but that is a
 * different item (Hydrogen, Oxygen and the bedrock layer own that end).
 * Getting this backwards was the first bug this file was written to fix.
 *
 * Order of magnitude only. "Is a loaf nearer 0.1 m or 1 m" is a question with
 * a defensible answer; "is a loaf 0.28 m" is not.
 *
 * Usage:  node tools/scale.mjs         write data/scale.json
 *         node tools/scale.mjs check   report coverage, write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const elements = JSON.parse(readFileSync(join(root, 'data/elements.json'), 'utf8'));

/** exponent -> [ids]. Everything is metres. */
const SCALE = {
  '-10': ['hydrogen', 'oxygen', 'nitrogen', 'carbon', 'sulfur', 'phosphorus',
          'carbon_dioxide', 'disulfide', 'hydrogen_gas', 'oxygen_gas',
          'iron', 'copper', 'gold', 'silver', 'tin', 'lead', 'zinc', 'mercury',
          'aluminum', 'nickel', 'chromium', 'titanium', 'platinum', 'uranium', 'enriched_uranium',
          'helium', 'neon',
          'magnesium', 'calcium', 'sodium', 'potassium'],
  '-9':  ['glycine', 'alanine', 'serine', 'proline', 'tyrosine', 'aspartic_acid', 'glutamic_acid', 'glutamine', 'asparagine', 'arginine', 'valine', 'leucine', 'isoleucine', 'threonine', 'methionine', 'lysine', 'histidine', 'phenylalanine', 'tryptophan', 'glucose', 'amino_acid', 'cysteine', 'dipeptide', 'nucleotide', 'atp',
          'penicillin', 'dna', 'alpha_helix', 'beta_sheet'],
  '-8':  ['chromatin', 'gene', 'microtubule', 'polypeptide', 'protein', 'enzyme', 'collagen', 'keratin', 'membrane',
          'denatured_protein', 'starch', 'gelatin', 'ribosome', 'messenger_rna'],
  '-6':  ['yeast', 'mould', 'resistance', 'chromosome', 'nucleus'],
  '-5':  ['cell', 'mitosis', 'meiosis', 'sperm', 'polar_body', 'stem_cell'],
  '-4':  ['ovum', 'zygote', 'morula', 'blastocyst', 'gastrula', 'flour', 'sugar', 'salt', 'cement', 'cement_meal', 'breadcrumb', 'sand',
          'clay', 'malt', 'rubbed_flour', 'ash', 'charcoal', 'mince', 'cured_mince'],
  '-3':  ['seed', 'grain', 'rice', 'cooked_rice', 'sushi_rice', 'pilaf', 'legume',
          'nectar', 'spark', 'beeswax', 'straw', 'bee', 'olive', 'grape', 'honey',
          'cane_juice', 'manna', 'granary', 'rutile'],
  '-2':  ['lard', 'wool', 'embryo', 'cotton', 'popcorn', 'soybean', 'tofu', 'pea', 'lemon', 'strawberry', 'pear', 'cherry', 'fig', 'coffee', 'cocoa_bean', 'chocolate', 'stone', 'flint', 'limestone', 'ice', 'brick', 'adobe', 'mortar', 'candle',
          'ore', 'cinnabar', 'yellowcake', 'oak_gall', 'thread', 'fibre', 'ink', 'mirror',
          'soap', 'lye', 'butter', 'ghee', 'curd', 'cheese', 'aged_cheese',
          'blue_cheese', 'egg', 'boiled_egg', 'golden_egg', 'apple', 'tomato',
          'onion', 'garlic', 'bulb', 'potato', 'chilli', 'meatball', 'sausage',
          'bacon', 'chips', 'leaf', 'flower', 'root', 'herb', 'sprout', 'seedling',
          'corn_dolly', 'gingerbread_man', 'philosopher_stone', 'sugarcane',
          'cucumber', 'wheat', 'grass', 'salt_fish', 'cured_meat', 'meat', 'bone',
          'tissue', 'muscle', 'wood', 'glass', 'pickle', 'sauerkraut', 'kimchi',
          'salted_cabbage', 'cabbage', 'fruit', 'noodle', 'pasta_dough', 'pastry',
          'dough', 'salted_dough', 'risen_dough', 'flatbread', 'garlic_bread',
          'cheese_toastie', 'wrap', 'egg_sandwich', 'baked_potato', 'sundae',
          'ice_cream', 'caramel', 'malt_vinegar', 'vinegar', 'olive_oil',
          'herb_oil', 'garlic_butter', 'creamed_butter'],
  '-1':  ['book', 'fetus', 'maize', 'barley', 'oat', 'carrot', 'lettuce', 'pumpkin', 'beet', 'banana', 'brewed_coffee', 'cocoa', 'duck', 'turkey', 'koala', 'platypus', 'cloth', 'clothing', 'paper', 'pulp', 'flax', 'water', 'mud', 'soil', 'tempered_clay', 'concrete', 'fire', 'steam',
          'brine', 'wort', 'sourdough_starter', 'mead_must', 'milk', 'cream',
          'sweet_cream', 'yoghurt', 'garlic_yoghurt', 'mayonnaise', 'egg_mayo',
          'broth', 'soup', 'passata', 'caramel_sauce', 'batter', 'cake_batter',
          'cake_mix', 'meatball_mix', 'meatball_sauce', 'kimchi_paste', 'tea',
          'brewed_tea', 'grape_juice', 'apple_juice', 'beer', 'cider', 'wine',
          'mead', 'aged_wine', 'bread', 'sourdough', 'cake', 'apple_pie', 'pizza',
          'pizza_base', 'pasta', 'spaghetti_meatballs', 'roast', 'aspic', 'salad',
          'greek_salad', 'potato_salad', 'olive_salad', 'tzatziki', 'fish',
          'grilled_fish', 'smoked_fish', 'battered_fish', 'fried_fish',
          'fish_and_chips', 'chicken', 'dinner', 'breakfast', 'choucroute',
          'cheeseboard', 'stone_soup', 'ambrosia', 'cornucopia', 'clean_hands',
          'pot', 'stoneware', 'sickle', 'barrel', 'plant', 'vine', 'feast'],
  '0':   ['warhead', 'pig', 'sheep', 'horse', 'wolf', 'deer', 'bear', 'kangaroo', 'dingo', 'zebra', 'lion', 'camel', 'cow', 'goat', 'aurochs', 'tree', 'scarecrow', 'greenhouse'],
  '1':   ['elephant', 'giraffe'],
  '2':   ['field', 'meadow', 'pasture', 'harvest', 'early_crop'],
  '3':   ['river'],
  '6':   ['sea'],
  '9':   ['sun'],
};

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const format = e => '10' + String(e).split('').map(c => SUP[c]).join('') + ' m';

const byId = {};
const dupes = [];
for (const [exp, ids] of Object.entries(SCALE)) {
  for (const id of ids) {
    if (byId[id] !== undefined) dupes.push(id);
    byId[id] = Number(exp);
  }
}

const known = new Set(elements.map(e => e.id));
const unknown = Object.keys(byId).filter(id => !known.has(id));
const missing = elements.filter(e => byId[e.id] === undefined).map(e => e.id);

if (dupes.length) console.error(`  listed twice: ${[...new Set(dupes)].join(', ')}`);
if (unknown.length) console.error(`  not an element: ${unknown.join(', ')}`);

const span = Object.keys(SCALE).map(Number).sort((a, b) => a - b);
console.log(`  ${elements.length - missing.length}/${elements.length} items sized`);
console.log(`  span: ${format(span[0])} to ${format(span[span.length - 1])} — ` +
            `${span[span.length - 1] - span[0]} orders of magnitude`);

if (missing.length) console.log(`\n  unsized (${missing.length}):\n    ${missing.join('\n    ')}`);

if (process.argv[2] === 'check') process.exit(missing.length || dupes.length || unknown.length ? 1 : 0);
if (dupes.length || unknown.length) process.exit(1);

const out = {};
for (const e of elements) if (byId[e.id] !== undefined) out[e.id] = { e: byId[e.id], t: format(byId[e.id]) };
writeFileSync(join(root, 'data/scale.json'), JSON.stringify(out) + '\n');
console.log(`\n  wrote data/scale.json`);
