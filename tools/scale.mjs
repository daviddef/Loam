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
  // Atoms and small molecules — the things the game genuinely treats as single
  // particles. The metals are NOT here: a metal card is a lump you hold, and
  // every recipe uses it that way (gold is panned from river sand, silver is
  // deposited on glass, iron is worked). Filing them at 10^-10 m while drawing
  // them as nuggets was a mislabel, not a drawing mistake.
  '-10': ['methane', 'phosphate', 'up_quark', 'down_quark', 'proton', 'neutron', 'electron', 'atomic_nucleus', 'photon', 'gamma_ray', 'deuterium', 'tritium', 'fission_product', 'carbon_monoxide', 'sulfur_dioxide', 'hydrogen_sulfide', 'nitric_oxide', 'nitrogen_dioxide', 'nitrate', 'hydrogen_chloride', 'hydrogen_fluoride', 'ammonia', 'acetylene', 'hydrogen', 'oxygen', 'nitrogen', 'carbon', 'sulfur', 'phosphorus',
          'carbon_dioxide', 'disulfide', 'hydrogen_gas', 'oxygen_gas',
          'helium', 'neon',
          'carbon_tetrafluoride', 'nitrogen_trifluoride', 'chlorine_trifluoride', 'sulfur_hexafluoride', 'phosphorus_pentafluoride',
          'bromine_trifluoride', 'iodine_pentafluoride', 'bromine_monochloride', 'iodine_monochloride', 'iodine_monobromide', 'hydrogen_bromide', 'hydrogen_iodide'],
  '-9':  ['urushiol', 'juglone', 'piperine', 'gingerol', 'shogaol', 'vitamin_a', 'vitamin_d', 'thiamin', 'riboflavin', 'niacin', 'folate', 'vitamin_b6', 'vitamin_e', 'citric_acid', 'sodium_acetate', 'msg', 'inosinate', 'guanylate', 'ribonucleotides', 'beta_carotene', 'curcumin', 'betanin', 'ponceau_4r', 'red_40', 'yellow_5', 'yellow_6', 'blue_1', 'sorbate', 'benzoate', 'sulfite', 'nitrite', 'trans_fat', 'monoglyceride', 'lecithin', 'sorbitol', 'xylitol', 'aspartame', 'malic_acid', 'salicin', 'gibberellin', 'digoxin', 'lactic_acid', 'acetic_acid', 'lanolin', 'ribose', 'deoxyribose', 'adenine', 'guanine', 'cytosine', 'thymine', 'uracil', 'base_pair', 'phospholipid', 'cholesterol', 'thyroxine', 'ascorbate', 'hydroxyproline', 'porphyrin', 'heme', 'chlorophyll', 'cobalamin', 'retinal', 'selenocysteine', 'fatty_acid', 'iron_sulfur_cluster', 'methanol', 'formaldehyde', 'ethylene', 'phenol', 'tannin', 'glycine', 'alanine', 'serine', 'proline', 'tyrosine', 'aspartic_acid', 'glutamic_acid', 'glutamine', 'asparagine', 'arginine', 'valine', 'leucine', 'isoleucine', 'threonine', 'methionine', 'lysine', 'histidine', 'phenylalanine', 'tryptophan', 'glucose', 'amino_acid', 'cysteine', 'dipeptide', 'nucleotide', 'atp',
          'penicillin', 'dna', 'alpha_helix', 'beta_sheet',
          'creatine', 'citrulline', 'theanine', 'caffeine', 'alpha_gpc', 'synephrine', 'biotin', 'sucralose', 'fos',
          'salicylic_acid', 'aspirin', 'streptomycin', 'insulin',
          'nitrophenol', 'aminophenol', 'paracetamol', 'histamine', 'arachidonic_acid', 'prostaglandin'],
  '-8':  ['maltodextrin', 'hydrolysed_vegetable_protein', 'carrageenan', 'alginate', 'xanthan_gum', 'gum_arabic', 'gellan_gum', 'arrowroot', 'lignin', 'pectin', 'phytochrome', 'isinglass', 'rna', 'transfer_rna', 'ribosomal_rna', 'ribozyme', 'viroid', 'glycogen', 'triple_helix', 'hemoglobin', 'myoglobin', 'photosystem_ii', 'cytochrome_c_oxidase', 'ferritin', 'zinc_finger', 'carbonic_anhydrase', 'glutathione_peroxidase', 'sulfite_oxidase', 'superoxide_dismutase', 'sodium_potassium_pump', 'rhodopsin', 'cellulose', 'chromatin', 'gene', 'microtubule', 'polypeptide', 'protein', 'enzyme', 'collagen', 'keratin', 'membrane',
          'denatured_protein', 'starch', 'gelatin', 'ribosome', 'messenger_rna',
          'hyaluronic_acid', 'satellite'],
  '-6':  ['s_thermophilus', 'l_bulgaricus', 'l_acidophilus', 'bifidobacterium', 'l_paracasei', 'l_plantarum', 'leuconostoc', 'lactococcus', 'acetobacter', 'penicillium', 'stoma', 'virus', 'vesicle', 'protocell', 'binary_fission', 'budding', 'bacteria', 'archaea', 'cyanobacteria', 'rhizobium', 'zooxanthellae', 'mitochondrion', 'chloroplast', 'spore', 'pollen', 'action_potential', 'yeast', 'mould', 'resistance', 'chromosome', 'nucleus',
          'bacteriophage', 'prophage', 'lysis', 'salmonella', 'streptomyces',
          'avibirnavirus', 'gammacoronavirus', 'e_coli',
          'cowpox', 'vaccine', 'immunity'],
  '-5':  ['yoghurt_culture', 'cytoplasm', 'alga', 'cell', 'mitosis', 'meiosis', 'sperm', 'polar_body', 'stem_cell', 'protozoan', 'eimeria'],
  '-4':  ['coconut_sugar', 'guar_gum', 'locust_bean_gum', 'silicon_dioxide', 'annatto', 'caramel_colour', 'agar', 'paprika', 'carmine', 'shellac', 'roe', 'hydroxyapatite', 'fluorapatite', 'magnesium_oxide', 'zinc_oxide', 'copper_oxide', 'litharge', 'mercuric_oxide', 'alumina', 'potassium_chloride', 'potassium_iodide', 'sodium_fluoride', 'magnesium_nitride',
          'beryllium_fluoride', 'beryllium_chloride', 'beryllium_bromide', 'beryllium_iodide', 'magnesium_fluoride', 'magnesium_bromide', 'magnesium_iodide', 'calcium_bromide', 'calcium_iodide', 'strontium_fluoride', 'strontium_bromide', 'strontium_iodide', 'barium_fluoride', 'barium_chloride', 'barium_bromide', 'barium_iodide', 'radium_fluoride', 'radium_chloride', 'radium_bromide', 'radium_iodide',
          'lithium_fluoride', 'lithium_chloride', 'lithium_iodide', 'lithium_nitride', 'lithium_hydride', 'sodium_bromide', 'sodium_iodide', 'potassium_fluoride', 'caesium_chloride', 'iron_chloride', 'silver_chloride', 'xenon_tetrafluoride', 'lithium_oxide', 'sodium_peroxide', 'potassium_superoxide', 'titanium_dioxide', 'chromium_oxide', 'nickel_oxide', 'manganese_dioxide', 'tin_dioxide', 'silver_bromide', 'germanium_dioxide', 'rubidium_superoxide', 'strontium_chloride', 'luminous_paint', 'red_phosphor', 'signal_paint',
          'beryllium_oxide', 'strontium_oxide', 'barium_oxide', 'caesium_superoxide', 'calcium_hydride', 'magnesium_hydride', 'strontium_hydride', 'barium_hydride', 'sodium_hydride', 'potassium_hydride', 'rubidium_hydride', 'caesium_hydride', 'beryllium_nitride', 'calcium_nitride', 'strontium_nitride', 'barium_nitride', 'radium_nitride',
          'phosphorus_sesquisulfide', 'aluminum_chloride', 'aluminum_sulfide', 'copper_chloride', 'magnesium_chloride', 'magnesium_sulfide', 'calcium_chloride', 'sodium_sulfide', 'potassium_sulfide', 'tin_chloride', 'lead_chloride', 'gold_chloride', 'copper_fluoride', 'lithium_bromide', 'potassium_bromide', 'rubidium_fluoride', 'rubidium_chloride', 'rubidium_bromide', 'rubidium_iodide', 'caesium_fluoride', 'caesium_bromide', 'caesium_iodide', 'krypton_difluoride', 'cobalt_chloride', 'chromium_chloride', 'lanthanum_oxide', 'cerium_oxide', 'neodymium_oxide', 'europium_fluoride', 'europium_chloride', 'gadolinium_oxide', 'cosmic_dust', 'dust', 'ovum', 'zygote', 'morula', 'blastocyst', 'gastrula', 'flour', 'sugar', 'salt', 'tapioca', 'cement', 'cement_meal', 'breadcrumb', 'sand',
          'clay', 'malt', 'rubbed_flour', 'ash', 'charcoal', 'mince', 'cured_mince'],
  '-3':  ['cumin', 'black_pepper', 'lentil', 'split_pea', 'farro', 'raisin', 'sesame', 'peanut', 'almond', 'lac_insect', 'cochineal', 'pearl', 'kefir_grains', 'koji', 'dew', 'frost', 'hail', 'seed', 'grain', 'rice', 'cooked_rice', 'sushi_rice', 'pilaf', 'legume',
          'rye', 'quinoa', 'buckwheat', 'millet', 'sorghum', 'semolina', 'couscous',
          'nutmeg', 'clove', 'cardamom', 'saffron', 'mustard_seed', 'allspice', 'star_anise',
          'nectar', 'spark', 'beeswax', 'straw', 'bee', 'olive', 'grape', 'honey',
          'cane_juice', 'manna', 'granary', 'rutile'],
  '-2':  ['drupe', 'walnut', 'sumac', 'lime', 'makrut_lime', 'jalapeno', 'chipotle', 'candied_fruit', 'steak',
          'kiwi', 'raspberry', 'blackberry', 'cranberry', 'blueberry', 'date', 'shrimp',
          'chickpea', 'bean', 'black_bean', 'pinto_bean', 'kidney_bean',
          'cashew', 'pistachio', 'pecan', 'hazelnut', 'macadamia', 'veal', 'lamb', 'nacre', 'sinew', 'bast_fibre', 'capsicum', 'quartz', 'feldspar', 'mica', 'corundum', 'diamond', 'ruby', 'sapphire', 'emerald', 'opal', 'copper_sulfide', 'zinc_sulfide', 'lead_sulfide', 'tarnish', 'rust', 'tungsten_carbide', 'calcium_carbide', 'titanium_nitride', 'p_type', 'n_type', 'diode', 'led', 'transistor', 'lodestone', 'filament', 'nichrome', 'coin', 'nail', 'needle', 'solder', 'galalith', 'manganese', 'cobalt', 'tungsten', 'molybdenum', 'vanadium', 'cadmium', 'palladium', 'rhodium', 'iridium', 'osmium', 'ruthenium', 'rhenium', 'hafnium', 'zirconium', 'tantalum', 'niobium', 'scandium', 'yttrium', 'lithium', 'caesium', 'rubidium', 'beryllium', 'strontium', 'barium', 'radium', 'thorium', 'plutonium', 'polonium', 'bismuth', 'cerium', 'lanthanum', 'neodymium', 'samarium', 'europium', 'gadolinium', 'promethium', 'silicon', 'boron', 'arsenic', 'selenium', 'antimony', 'germanium', 'tellurium', 'iodine', 'fluorite', 'borax', 'pyrolusite', 'molybdenite', 'osmiridium', 'pollucite', 'monazite', 'rare_earth', 'baryte', 'palladium_hydride', 'bismuth_telluride', 'yag', 'ferrocerium',
          'iron', 'copper', 'gold', 'silver', 'tin', 'lead', 'zinc', 'mercury', 'aluminum', 'nickel', 'chromium', 'titanium', 'platinum', 'uranium', 'magnesium', 'calcium', 'sodium', 'potassium', 'enriched_uranium',
          'neptunium', 'americium', 'curium', 'berkelium', 'californium', 'protactinium', 'actinium', 'technetium', 'astatine', 'rutherfordium', 'dubnium', 'seaborgium', 'bohrium', 'hassium', 'meitnerium', 'darmstadtium', 'roentgenium', 'copernicium',
          'lard', 'wool', 'embryo', 'cotton', 'popcorn', 'soybean', 'tofu', 'pea', 'lemon', 'strawberry', 'pear', 'cherry', 'fig', 'coffee', 'cocoa_bean', 'chocolate', 'stone', 'flint', 'limestone', 'ice', 'brick', 'adobe', 'mortar', 'candle', 'coccidiosis',
          'infectious_bursal_disease', 'infectious_bronchitis', 'colibacillosis', 'ascaridiasis',
          'ore', 'cinnabar', 'yellowcake', 'quicklime', 'oak_gall', 'thread', 'fibre', 'ink', 'mirror',
          'soap', 'lye', 'butter', 'ghee', 'curd', 'cheese', 'aged_cheese',
          'mozzarella', 'cheddar', 'parmesan', 'feta', 'cottage_cheese', 'custard',
          'blue_cheese', 'egg', 'boiled_egg', 'golden_egg', 'apple', 'tomato',
          'onion', 'garlic', 'bulb', 'potato', 'cassava', 'chilli', 'meatball', 'sausage',
          'bacon', 'chips', 'leaf', 'flower', 'root', 'herb', 'sprout', 'seedling',
          'corn_dolly', 'gingerbread_man', 'philosopher_stone', 'sugarcane',
          'cucumber', 'wheat', 'grass', 'salt_fish', 'cured_meat', 'meat', 'bone', 'shell',
          'tissue', 'muscle', 'wood', 'glass', 'pickle', 'sauerkraut', 'kimchi',
          'salted_cabbage', 'cabbage', 'fruit', 'noodle', 'pasta_dough', 'pastry',
          'dough', 'salted_dough', 'risen_dough', 'flatbread', 'garlic_bread',
          'cheese_toastie', 'wrap', 'egg_sandwich', 'baked_potato', 'sundae',
          'ice_cream', 'caramel', 'malt_vinegar', 'vinegar', 'olive_oil',
          'herb_oil', 'garlic_butter', 'creamed_butter'],
  '-1':  ['rooster', 'hen', 'chick', 'cockerel', 'pullet', 'capon', 'drake', 'duckling', 'gander', 'goose', 'gosling', 'tom', 'turkey_hen', 'poult', 'rabbit', 'kid', 'foal', 'piglet', 'carabeef', 'chevon',
          'mango', 'ginger', 'rhizome', 'celery', 'marjoram', 'parsley', 'sage', 'rosemary', 'basil', 'thyme', 'mint', 'tarragon', 'dill', 'coriander', 'chives', 'bay_leaf', 'oregano', 'sunflower', 'oil', 'soy_sauce', 'fish_sauce', 'nuoc_cham', 'lithium_graphite', 'stainless_steel', 'beryllium_copper', 'niobium_titanium', 'rose_gold', 'hard_lead', 'titanium_alloy', 'galvanized_iron', 'gold_amalgam', 'dental_amalgam', 'neon_light', 'ferrovanadium', 'nicad_battery', 'lithium_ion_battery', 'platinum_rhodium_gauze', 'platinum_iridium', 'hardened_platinum', 'tungsten_rhenium', 'rocket_nozzle_alloy', 'scandium_aluminum_alloy', 'gas_mantle', 'neodymium_magnet', 'samarium_cobalt_magnet', 'gadolinium_steel',
          'carbon_disulfide', 'disulfur_dichloride', 'phosphorus_trichloride', 'titanium_chloride', 'aluminum_copper_alloy', 'magnalium', 'nak_alloy', 'tin_silver_solder', 'beef', 'pork', 'mutton', 'venison', 'poultry', 'game', 'aged_beef', 'ham', 'stew', 'turmeric', 'carob', 'red_alga', 'hydrogenated_oil', 'sap', 'bark', 'cork', 'xylem', 'phloem', 'coconut', 'coconut_water', 'sugar_beet', 'mulberry', 'graft', 'hardwood', 'softwood', 'tallow', 'horn', 'antler', 'feather', 'down', 'oyster', 'swim_bladder', 'ambergris', 'baleen', 'manure', 'parchment', 'ivory', 'royal_jelly', 'rennet', 'whey', 'ricotta', 'starter_culture', 'pasteurised_milk', 'souring_kraut', 'kefir', 'buttermilk', 'miso', 'camembert', 'tuber', 'cutting', 'runner', 'obsidian', 'pumice', 'lignite', 'anthracite', 'marble', 'slate', 'magnet', 'copper_wire', 'voltaic_pile', 'electromagnet', 'heating_element', 'light_bulb', 'sulfuric_acid', 'lead_acid_cell', 'electrolysis', 'electroplating', 'solar_cell', 'fungus', 'lichen', 'mycelium', 'mycorrhiza', 'root_nodule', 'polyp', 'coral', 'bleached_coral', 'earthworm', 'ascaridia_galli', 'detritus', 'humus', 'compost', 'rumen', 'pancreas', 'current', 'magnetic_field', 'steel', 'bronze', 'brass', 'hide', 'leather', 'latex', 'rubber', 'vulcanised_rubber', 'canvas', 'silk', 'silkworm', 'cocoon', 'knife', 'rope', 'wheel', 'lamp', 'shoe', 'pipe', 'coal', 'coal_tar', 'wood_tar', 'ethanol', 'bakelite', 'polyethylene', 'snow', 'smoke', 'ozone', 'air', 'loess', 'fulgurite', 'bone_char', 'bottle', 'blackware', 'stockfish', 'chlorine', 'fluorine', 'bromine', 'argon', 'krypton', 'xenon', 'noble_mix', 'kelp', 'book', 'fetus', 'maize', 'barley', 'oat', 'carrot', 'lettuce', 'pumpkin', 'beet', 'banana', 'brewed_coffee', 'cocoa', 'duck', 'turkey', 'koala', 'platypus', 'lizard', 'turtle', 'cloth', 'clothing', 'paper', 'pulp', 'flax', 'water', 'mud', 'soil', 'tempered_clay', 'concrete', 'fire', 'steam',
          'shiitake', 'maitake', 'spirulina', 'horsetail', 'dandelion', 'aloe_vera', 'ginseng', 'psyllium',
          'pineapple', 'spinach', 'acai', 'pomegranate', 'goji', 'papaya', 'broccoli', 'alfalfa', 'stevia',
          'sweet_potato', 'cauliflower', 'zucchini', 'eggplant', 'asparagus', 'radish', 'turnip', 'leek',
          'brussels_sprout', 'kale', 'artichoke', 'okra', 'mushroom', 'avocado', 'arugula', 'rhubarb', 'watercress',
          'cinnamon', 'vanilla', 'fennel', 'wasabi', 'evaporated_milk', 'condensed_milk',
          'ketchup', 'maple_syrup', 'peanut_butter', 'jam', 'cornstarch', 'baking_soda',
          'baking_powder', 'worcestershire_sauce', 'hot_sauce', 'tahini', 'vanilla_extract', 'mustard',
          'crab', 'lobster', 'salmon', 'tuna',
          'guacamole', 'hummus', 'salsa', 'coleslaw', 'omelette', 'pancake', 'waffle',
          'burger', 'hot_dog', 'sandwich', 'fried_rice', 'taco',
          'orange', 'grapefruit', 'peach', 'plum', 'apricot', 'nectarine', 'watermelon', 'cantaloupe', 'persimmon', 'guava',
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
          'pot', 'stoneware', 'sickle', 'barrel', 'plant', 'vine', 'feast',
          'catshark', 'nautilus',
          'octopus', 'blue_ringed_octopus', 'vampire_squid', 'box_jellyfish', 'sea_anemone', 'crown_of_thorns', 'man_o_war'],
  '0':   ['bull', 'heifer', 'steer', 'buffalo', 'donkey', 'boar', 'sow', 'gilt', 'barrow', 'ram', 'ewe', 'wether', 'buck', 'doe', 'stallion', 'mare', 'colt', 'filly', 'gelding',
          'calf', 'cactus', 'foxglove', 'winter_wheat', 'semi_dwarf_wheat', 'willow', 'bamboo', 'ox', 'whale', 'granite', 'basalt', 'sandstone', 'mudstone', 'shale', 'conglomerate', 'phyllite', 'schist', 'gneiss', 'quartzite', 'generator', 'electric_motor', 'transformer', 'refrigerator', 'plough', 'peat', 'forge', 'warhead', 'pig', 'sheep', 'horse', 'wolf', 'deer', 'bear', 'kangaroo', 'dingo', 'zebra', 'lion', 'camel', 'cow', 'goat', 'aurochs', 'tree', 'acacia', 'scarecrow', 'greenhouse', 'human', 'snake', 'rattlesnake',
          'sand_tiger_shark', 'mako_shark', 'salmon_shark', 'eagle_ray', 'tope_shark', 'leopard_shark',
          'lemon_shark', 'bull_shark', 'blacktip_shark', 'oceanic_whitetip_shark', 'silky_shark',
          'blacktip_reef_shark', 'grey_reef_shark', 'whitetip_reef_shark', 'scalloped_hammerhead',
          'giant_pacific_octopus'],
  '1':   ['oak', 'pine', 'rubber_tree', 'elephant', 'giraffe',
          'basking_shark', 'megamouth_shark', 'great_white_shark', 'thresher_shark', 'goblin_shark',
          'manta_ray', 'tiger_shark', 'orca', 'great_hammerhead', 'giant_squid', 'lions_mane_jellyfish'],
  '2':   ['mangrove', 'magma', 'lava', 'reef', 'dune', 'mist', 'fog', 'rain', 'wind', 'field', 'meadow', 'pasture', 'harvest', 'early_crop'],
  '3':   ['atoll', 'cloud', 'lightning', 'thunder', 'flood', 'rainbow', 'river'],
  '6':   ['primordial_soup', 'planetesimal', 'moon', 'comet', 'asteroid', 'storm', 'hurricane', 'blizzard', 'sky', 'sea'],
  '9':   ['star', 'red_giant', 'white_dwarf', 'neutron_star', 'black_hole', 'supernova', 'nebula', 'planet', 'gas_giant', 'ice_giant', 'plasma', 'sun'],
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
