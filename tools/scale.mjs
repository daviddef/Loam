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
  '-5':  ['photosite',
          'yoghurt_culture', 'cytoplasm', 'alga', 'cell', 'mitosis', 'meiosis', 'sperm', 'polar_body', 'stem_cell', 'protozoan', 'eimeria',
          'plasmodium', 'toxoplasma_gondii', 'giardia', 'entamoeba_histolytica', 'trichomonas_vaginalis', 'cryptosporidium'],
  '-4':  ['coconut_sugar', 'guar_gum', 'locust_bean_gum', 'silicon_dioxide', 'annatto', 'caramel_colour', 'agar', 'paprika', 'carmine', 'shellac', 'roe', 'hydroxyapatite', 'fluorapatite', 'magnesium_oxide', 'zinc_oxide', 'copper_oxide', 'litharge', 'mercuric_oxide', 'alumina', 'potassium_chloride', 'potassium_iodide', 'sodium_fluoride', 'magnesium_nitride',
          'beryllium_fluoride', 'beryllium_chloride', 'beryllium_bromide', 'beryllium_iodide', 'magnesium_fluoride', 'magnesium_bromide', 'magnesium_iodide', 'calcium_bromide', 'calcium_iodide', 'strontium_fluoride', 'strontium_bromide', 'strontium_iodide', 'barium_fluoride', 'barium_chloride', 'barium_bromide', 'barium_iodide', 'radium_fluoride', 'radium_chloride', 'radium_bromide', 'radium_iodide',
          'lithium_fluoride', 'lithium_chloride', 'lithium_iodide', 'lithium_nitride', 'lithium_hydride', 'sodium_bromide', 'sodium_iodide', 'potassium_fluoride', 'caesium_chloride', 'iron_chloride', 'silver_chloride', 'xenon_tetrafluoride', 'lithium_oxide', 'sodium_peroxide', 'potassium_superoxide', 'titanium_dioxide', 'chromium_oxide', 'nickel_oxide', 'manganese_dioxide', 'tin_dioxide', 'silver_bromide', 'germanium_dioxide', 'rubidium_superoxide', 'strontium_chloride', 'luminous_paint', 'red_phosphor', 'signal_paint',
          'beryllium_oxide', 'strontium_oxide', 'barium_oxide', 'caesium_superoxide', 'calcium_hydride', 'magnesium_hydride', 'strontium_hydride', 'barium_hydride', 'sodium_hydride', 'potassium_hydride', 'rubidium_hydride', 'caesium_hydride', 'beryllium_nitride', 'calcium_nitride', 'strontium_nitride', 'barium_nitride', 'radium_nitride',
          'phosphorus_sesquisulfide', 'aluminum_chloride', 'aluminum_sulfide', 'copper_chloride', 'magnesium_chloride', 'magnesium_sulfide', 'calcium_chloride', 'sodium_sulfide', 'potassium_sulfide', 'tin_chloride', 'lead_chloride', 'gold_chloride', 'copper_fluoride', 'lithium_bromide', 'potassium_bromide', 'rubidium_fluoride', 'rubidium_chloride', 'rubidium_bromide', 'rubidium_iodide', 'caesium_fluoride', 'caesium_bromide', 'caesium_iodide', 'krypton_difluoride', 'cobalt_chloride', 'chromium_chloride', 'lanthanum_oxide', 'cerium_oxide', 'neodymium_oxide', 'europium_fluoride', 'europium_chloride', 'gadolinium_oxide', 'cosmic_dust', 'dust', 'ovum', 'zygote', 'morula', 'blastocyst', 'gastrula', 'flour', 'sugar', 'salt', 'tapioca', 'cement', 'cement_meal', 'breadcrumb', 'sand',
          'clay', 'malt', 'rubbed_flour', 'ash', 'charcoal', 'mince', 'cured_mince', 'scabies_mite',
          'lenticel', 'root_hair'],
  '-3':  ['cumin', 'black_pepper', 'lentil', 'split_pea', 'farro', 'raisin', 'sesame', 'peanut', 'almond', 'lac_insect', 'cochineal', 'pearl', 'kefir_grains', 'koji', 'dew', 'frost', 'hail', 'seed', 'grain', 'rice', 'cooked_rice', 'sushi_rice', 'pilaf', 'legume',
          'rye', 'quinoa', 'buckwheat', 'millet', 'sorghum', 'semolina', 'couscous',
          'nutmeg', 'clove', 'cardamom', 'saffron', 'mustard_seed', 'allspice', 'star_anise',
          'nectar', 'spark', 'beeswax', 'straw', 'bee', 'olive', 'grape', 'honey',
          'cane_juice', 'manna', 'granary', 'rutile',
          'ant', 'ladybird', 'termite', 'flea', 'tick',
          'duckweed', 'birds_nest_fungus', 'zombie_ant_fungus',
          'mosquito', 'trichinella_spiralis', 'head_louse', 'body_louse', 'bed_bug',
          'parasitism',
          'root_cap', 'root_meristem', 'elongation_zone'],
  '-2':  ['sundew', 'edelweiss', 'moss', 'liverwort',
          'seahorse',
          'drupe', 'walnut', 'sumac', 'lime', 'makrut_lime', 'jalapeno', 'chipotle', 'candied_fruit', 'steak',
          'kiwi', 'raspberry', 'blackberry', 'cranberry', 'blueberry', 'date', 'shrimp',
          'chickpea', 'bean', 'black_bean', 'pinto_bean', 'kidney_bean',
          'cashew', 'pistachio', 'pecan', 'hazelnut', 'macadamia', 'veal', 'lamb', 'nacre', 'sinew', 'bast_fibre', 'capsicum', 'quartz', 'feldspar', 'mica', 'corundum', 'diamond', 'ruby', 'sapphire', 'emerald', 'opal', 'copper_sulfide', 'zinc_sulfide', 'lead_sulfide', 'tarnish', 'rust', 'tungsten_carbide', 'calcium_carbide', 'titanium_nitride', 'p_type', 'n_type', 'diode', 'led', 'transistor', 'capacitor', 'accelerometer', 'photodiode', 'click_wheel', 'flash_memory', 'thin_film_transistor', 'liquid_crystal_cell', 'liquid_crystal', 'laser_diode', 'ccd_sensor', 'fingerprint_scanner', 'lodestone', 'filament', 'nichrome', 'coin', 'nail', 'needle', 'solder', 'galalith', 'manganese', 'cobalt', 'tungsten', 'molybdenum', 'vanadium', 'cadmium', 'palladium', 'rhodium', 'iridium', 'osmium', 'ruthenium', 'rhenium', 'hafnium', 'zirconium', 'tantalum', 'niobium', 'scandium', 'yttrium', 'lithium', 'caesium', 'rubidium', 'beryllium', 'strontium', 'barium', 'radium', 'thorium', 'plutonium', 'polonium', 'bismuth', 'cerium', 'lanthanum', 'neodymium', 'samarium', 'europium', 'gadolinium', 'promethium', 'silicon', 'boron', 'arsenic', 'selenium', 'antimony', 'germanium', 'tellurium', 'iodine', 'fluorite', 'borax', 'pyrolusite', 'molybdenite', 'osmiridium', 'pollucite', 'monazite', 'rare_earth', 'baryte', 'palladium_hydride', 'bismuth_telluride', 'yag', 'ferrocerium',
          'pyrite', 'hematite', 'magnetite', 'graphite', 'calcite', 'malachite', 'azurite', 'gypsum', 'olivine', 'garnet', 'beryl', 'aquamarine', 'serpentine',
          'bauxite', 'spodumene', 'bastnasite',
          'iron', 'copper', 'gold', 'silver', 'tin', 'lead', 'zinc', 'mercury', 'aluminum', 'nickel', 'chromium', 'titanium', 'platinum', 'uranium', 'magnesium', 'calcium', 'sodium', 'potassium', 'enriched_uranium',
          'neptunium', 'americium', 'curium', 'berkelium', 'californium', 'protactinium', 'actinium', 'technetium', 'astatine', 'rutherfordium', 'dubnium', 'seaborgium', 'bohrium', 'hassium', 'meitnerium', 'darmstadtium', 'roentgenium', 'copernicium',
          'movable_type', 'vacuum_tube', 'integrated_circuit', 'microprocessor',
          'bioluminescent_fungus', 'truffle', 'dead_mans_fingers', 'witchs_butter',
          'lard', 'wool', 'embryo', 'cotton', 'popcorn', 'soybean', 'tofu', 'pea', 'lemon', 'strawberry', 'pear', 'cherry', 'fig', 'coffee', 'cocoa_bean', 'chocolate', 'stone', 'flint', 'limestone', 'ice', 'brick', 'adobe', 'mortar', 'candle', 'coccidiosis',
          'infectious_bursal_disease', 'infectious_bronchitis', 'colibacillosis', 'ascaridiasis',
          'ore', 'cinnabar', 'yellowcake', 'quicklime', 'oak_gall', 'thread', 'fibre', 'ink', 'mirror',
          'soap', 'lye', 'butter', 'ghee', 'curd', 'cheese', 'aged_cheese',
          'mozzarella', 'cheddar', 'parmesan', 'feta', 'cottage_cheese', 'custard',
          'blue_cheese', 'egg', 'boiled_egg', 'golden_egg', 'apple', 'tomato',
          'onion', 'garlic', 'bulb', 'potato', 'cassava', 'chilli', 'meatball', 'sausage',
          'bacon', 'chips', 'leaf', 'flower', 'root', 'herb', 'sprout', 'seedling',
          'corn_dolly', 'gingerbread_man', 'philosopher_stone', 'sugarcane',
          'turquoise', 'cacao_of_the_gods',
          'cucumber', 'wheat', 'grass', 'salt_fish', 'cured_meat', 'meat', 'bone', 'shell',
          'tissue', 'muscle', 'wood', 'glass', 'pickle', 'sauerkraut', 'kimchi',
          'salted_cabbage', 'cabbage', 'fruit', 'noodle', 'pasta_dough', 'pastry',
          'dough', 'salted_dough', 'risen_dough', 'flatbread', 'garlic_bread',
          'cheese_toastie', 'wrap', 'egg_sandwich', 'baked_potato', 'sundae',
          'ice_cream', 'caramel', 'malt_vinegar', 'vinegar', 'olive_oil',
          'herb_oil', 'garlic_butter', 'creamed_butter',
          'butterfly', 'dung_beetle', 'firefly', 'cockroach', 'spider', 'centipede', 'millipede', 'woodlouse',
          'snail', 'hookworm', 'enterobius_vermicularis', 'wuchereria_bancrofti', 'schistosoma', 'clonorchis_sinensis',
          'malaria', 'toxoplasmosis', 'giardiasis', 'amoebiasis', 'trichinosis', 'schistosomiasis',
          'producer', 'whale_barnacle', 'golden_poison_frog',
          'stem', 'node', 'internode', 'terminal_bud', 'axillary_bud', 'leaf_scar', 'cotyledon',
          // railways batch 1 — crushed rock, hand-sample scale alongside quartzite/gneiss
          'ballast'],
  '-1':  ['venus_flytrap', 'nepenthes', 'mistletoe', 'water_lily', 'orchid',
          'eagle', 'fifth_sun', 'popol_vuh',
          'monocot', 'dicot', 'buttress_root', 'brace_root', 'clinging_root', 'aerial_root', 'pneumatophore', 'ivy',
          'rooster', 'hen', 'chick', 'cockerel', 'pullet', 'capon', 'drake', 'duckling', 'gander', 'goose', 'gosling', 'tom', 'turkey_hen', 'poult', 'rabbit', 'kid', 'foal', 'piglet', 'carabeef', 'chevon',
          'mango', 'ginger', 'rhizome', 'celery', 'marjoram', 'parsley', 'sage', 'rosemary', 'basil', 'thyme', 'mint', 'tarragon', 'dill', 'coriander', 'chives', 'bay_leaf', 'oregano', 'sunflower', 'oil', 'soy_sauce', 'fish_sauce', 'nuoc_cham', 'lithium_graphite', 'stainless_steel', 'beryllium_copper', 'niobium_titanium', 'rose_gold', 'hard_lead', 'titanium_alloy', 'galvanized_iron', 'gold_amalgam', 'dental_amalgam', 'neon_light', 'ferrovanadium', 'nicad_battery', 'lithium_ion_battery', 'platinum_rhodium_gauze', 'platinum_iridium', 'hardened_platinum', 'tungsten_rhenium', 'rocket_nozzle_alloy', 'scandium_aluminum_alloy', 'gas_mantle', 'neodymium_magnet', 'samarium_cobalt_magnet', 'gadolinium_steel',
          'carbon_disulfide', 'disulfur_dichloride', 'phosphorus_trichloride', 'titanium_chloride', 'aluminum_copper_alloy', 'magnalium', 'nak_alloy', 'tin_silver_solder', 'beef', 'pork', 'mutton', 'venison', 'poultry', 'game', 'aged_beef', 'ham', 'stew', 'turmeric', 'carob', 'red_alga', 'hydrogenated_oil', 'sap', 'bark', 'cork', 'xylem', 'phloem', 'coconut', 'coconut_water', 'sugar_beet', 'mulberry', 'graft', 'hardwood', 'softwood', 'tallow', 'horn', 'antler', 'feather', 'down', 'oyster', 'swim_bladder', 'ambergris', 'baleen', 'manure', 'parchment', 'ivory', 'royal_jelly', 'rennet', 'whey', 'ricotta', 'starter_culture', 'pasteurised_milk', 'souring_kraut', 'kefir', 'buttermilk', 'miso', 'camembert', 'tuber', 'cutting', 'runner', 'obsidian', 'pumice', 'lignite', 'anthracite', 'marble', 'slate', 'magnet', 'copper_wire', 'voltaic_pile', 'electromagnet', 'heating_element', 'light_bulb', 'ipod', 'nike_plus_sensor', 'midsole_foam', 'athletic_shoe', 'polarizer', 'dvd_player', 'magnetic_tape', 'vhs', 'magnetron', 'scanner', 'barcode_scanner', 'wii_remote', 'digital_camera', 'sulfuric_acid', 'lead_acid_cell', 'electrolysis', 'electroplating', 'solar_cell', 'fungus', 'lichen', 'mycelium', 'mycorrhiza', 'root_nodule', 'polyp', 'coral', 'bleached_coral', 'earthworm', 'ascaridia_galli', 'detritus', 'humus', 'compost', 'rumen', 'pancreas', 'current', 'magnetic_field', 'barometer', 'pendulum_clock', 'sewing_machine', 'telegraph', 'telephone', 'radio', 'phonograph', 'x_ray', 'camera_obscura', 'photographic_plate', 'photograph', 'ether', 'typewriter', 'steel', 'bronze', 'brass', 'hide', 'leather', 'latex', 'rubber', 'vulcanised_rubber', 'canvas', 'silk', 'silkworm', 'cocoon', 'knife', 'rope', 'wheel', 'lamp', 'shoe', 'pipe', 'coal', 'coal_tar', 'wood_tar', 'ethanol', 'bakelite', 'polyethylene', 'snow', 'smoke', 'ozone', 'air', 'loess', 'fulgurite', 'bone_char', 'bottle', 'blackware', 'stockfish', 'chlorine', 'fluorine', 'bromine', 'argon', 'krypton', 'xenon', 'noble_mix', 'kelp', 'book', 'fetus', 'maize', 'barley', 'oat', 'carrot', 'lettuce', 'pumpkin', 'beet', 'banana', 'brewed_coffee', 'cocoa', 'duck', 'turkey', 'koala', 'platypus', 'lizard', 'turtle', 'cloth', 'clothing', 'paper', 'pulp', 'flax', 'water', 'mud', 'soil', 'tempered_clay', 'concrete', 'fire', 'steam',
          // mining value chains batch 2 — belt material and waste slurry, same item scale as rope/mud
          'conveyor_belt', 'tailings',
          'shiitake', 'maitake', 'spirulina', 'horsetail', 'dandelion', 'aloe_vera', 'ginseng', 'psyllium',
          'fly_agaric', 'death_cap', 'chanterelle', 'porcini', 'morel', 'puffball', 'stinkhorn', 'turkey_tail', 'slime_mold', 'shaggy_mane',
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
          'octopus', 'blue_ringed_octopus', 'vampire_squid', 'box_jellyfish', 'sea_anemone', 'crown_of_thorns', 'man_o_war',
          'anglerfish', 'pink_frogmouth', 'psychedelic_frogfish', 'stonefish', 'common_lionfish',
          'chihuahua', 'pug', 'jack_russell_terrier', 'dachshund', 'beagle', 'basenji',
          'gourd', 'mbira', 'gong', 'cymbal', 'bell', 'xylophone', 'angklung', 'maraca',
          'djembe', 'tabla', 'timpani', 'daf',
          'guitar', 'violin', 'morin_khuur', 'sitar', 'kora',
          'flute', 'pan_flute', 'trumpet', 'didgeridoo', 'bagpipes', 'shofar',
          'theremin', 'electric_guitar', 'synthesizer',
          'atlantic_herring', 'rainbow_trout', 'northern_pike', 'common_carp', 'goldfish', 'koi',
          'european_eel', 'european_plaice', 'clownfish', 'piranha', 'largemouth_bass',
          'dragonfly', 'locust', 'mantis', 'scorpion',
          'eoraptor', 'compsognathus', 'archaeopteryx', 'microraptor', 'psittacosaurus',
          'leptocyon',
          'ascaris_lumbricoides', 'lymphatic_filariasis',
          'sea_urchin', 'mutualism', 'pioneer_species', 'decomposer',
          'baboon', 'lemur', 'bald_eagle', 'peregrine_falcon', 'snowy_owl', 'turkey_vulture',
          'gila_monster', 'american_bullfrog', 'cane_toad', 'axolotl', 'fire_salamander',
          // railways batch 1 — small machine parts, hand-tool scale
          'roller_bearing', 'plain_bearing', 'air_brake'],
  '0':   [// mining value chains batch 2 — machine-sized equipment, a room-scale appliance
          'diesel_electric_drive',
          'welwitschia', 'rafflesia', 'bracken_fern',
          'jaguar', 'sun_stone', 'hero_twins',
          'quetzalcoatl', 'tezcatlipoca', 'huitzilopochtli', 'tlaloc', 'coatlicue', 'tonatiuh',
          'mictlantecuhtli', 'xiuhtecuhtli', 'centeotl', 'xolotl', 'kukulkan', 'itzamna',
          'ixchel', 'chaac', 'ek_chuah',
          'bull', 'heifer', 'steer', 'buffalo', 'donkey', 'boar', 'sow', 'gilt', 'barrow', 'ram', 'ewe', 'wether', 'buck', 'doe', 'stallion', 'mare', 'colt', 'filly', 'gelding',
          'calf', 'cactus', 'foxglove', 'winter_wheat', 'semi_dwarf_wheat', 'willow', 'bamboo', 'ox', 'whale', 'granite', 'basalt', 'sandstone', 'mudstone', 'shale', 'conglomerate', 'phyllite', 'schist', 'gneiss', 'quartzite', 'generator', 'electric_motor', 'transformer', 'refrigerator', 'printing_press', 'telescope', 'steam_engine', 'cotton_gin', 'elevator', 'internal_combustion_engine', 'lcd_screen', 'microwave_oven', 'plough', 'peat', 'forge', 'warhead', 'pig', 'sheep', 'horse', 'wolf', 'deer', 'bear', 'kangaroo', 'dingo', 'zebra', 'lion', 'camel', 'cow', 'goat', 'aurochs', 'tree', 'acacia', 'scarecrow', 'greenhouse', 'human', 'snake', 'rattlesnake',
          'proailurus', 'pseudaelurus', 'homotherium', 'panthera_zdanskyi', 'tiger', 'javan_tiger',
          'eucyon', 'canis_lepophagus', 'canis_etruscus', 'canis_mosbachensis',
          'dog', 'german_shepherd', 'border_collie', 'rottweiler', 'saint_bernard', 'siberian_husky', 'greyhound', 'afghan_hound', 'bloodhound', 'labrador_retriever', 'golden_retriever', 'bull_terrier',
          'piano',
          'cat', 'taenia_solium', 'taenia_saginata',
          'sand_tiger_shark', 'mako_shark', 'salmon_shark', 'eagle_ray', 'tope_shark', 'leopard_shark',
          'lemon_shark', 'bull_shark', 'blacktip_shark', 'oceanic_whitetip_shark', 'silky_shark',
          'blacktip_reef_shark', 'grey_reef_shark', 'whitetip_reef_shark', 'scalloped_hammerhead',
          'giant_pacific_octopus', 'zebra_shark', 'nurse_shark', 'giant_grouper',
          'pakicetus', 'ambulocetus', 'rodhocetus',
          'atlantic_cod', 'wels_catfish', 'nile_perch',
          'coelophysis', 'velociraptor', 'deinonychus', 'protoceratops', 'pachycephalosaurus', 'stegoceras',
          'herrerasaurus', 'oviraptor', 'massospondylus', 'camptosaurus',
          'primary_consumer', 'secondary_consumer', 'trophic_level', 'apex_predator', 'sea_otter', 'keystone_species', 'commensalism',
          'leopard', 'snow_leopard', 'cheetah', 'cougar',
          'red_fox', 'coyote', 'african_wild_dog',
          'polar_bear', 'giant_panda', 'sun_bear',
          'gorilla', 'chimpanzee', 'orangutan',
          'king_cobra', 'komodo_dragon',
          // railways batch 1 — metre-scale machine parts and infrastructure units
          'piston', 'axle', 'bogie', 'coupler', 'sleeper', 'block_signal'],
  '1':   ['saguaro', 'airplane',
          'oak', 'pine', 'rubber_tree', 'kapok', 'elephant', 'giraffe', 'nile_crocodile', 'american_alligator',
          'climax_community', 'food_chain',
          'basking_shark', 'megamouth_shark', 'great_white_shark', 'thresher_shark', 'goblin_shark',
          'manta_ray', 'tiger_shark', 'orca', 'great_hammerhead', 'giant_squid', 'lions_mane_jellyfish', 'whale_shark',
          'basilosaurus', 'dorudon', 'llanocetus',
          'swordfish', 'marlin',
          'allosaurus', 'spinosaurus', 'tyrannosaurus', 'plateosaurus', 'brachiosaurus', 'apatosaurus',
          'stegosaurus', 'ankylosaurus', 'triceratops', 'iguanodon', 'parasaurolophus', 'quetzalcoatlus', 'elasmosaurus',
          // dinosaurs batch 2 — a second sourced pass, same tens-of-metres/large-animal bucket as their batch 1 kin
          'dilophosaurus', 'ceratosaurus', 'carnotaurus', 'giganotosaurus', 'baryonyx', 'therizinosaurus',
          'gallimimus', 'diplodocus', 'euoplocephalus', 'styracosaurus', 'pentaceratops', 'maiasaura',
          // geography batch 1 — a sea cave (tens of metres) and a geyser's eruption column, both roughly building-scale
          'sea_cave', 'geyser',
          // mining value chains batch 2 — a single machine, tens of metres, the same bucket as a sea cave
          'drilling_rig', 'haul_truck', 'continuous_miner', 'longwall_shearer', 'crusher', 'ball_mill', 'flotation_cell', 'locomotive',
          // railways batch 1 — vehicle-scale rolling stock and locomotives, 10-20 m
          'steam_locomotive', 'diesel_electric_locomotive', 'electric_locomotive',
          'freight_wagon', 'hopper_car', 'tank_car', 'flatcar', 'boxcar', 'caboose',
          'rail', 'points_switch',
          // consumer-electronics batch 1 — the IMAX theatre and screen, tens of metres, the same bucket as a sea cave
          'imax_3d_projection'],
  '2':   ['giant_sequoia', 'coast_redwood',
          'mangrove', 'magma', 'lava', 'reef', 'dune', 'mist', 'fog', 'rain', 'wind', 'field', 'meadow', 'pasture', 'harvest', 'early_crop',
          'food_web', 'succession', 'limiting_factor', 'carrying_capacity', 'kelp_forest',
          // geography batch 1 — coastal and karst features and single landforms, tens to a couple hundred metres
          'sea_cliff', 'sea_arch', 'sea_stack', 'waterfall', 'sinkhole', 'cavern', 'moraine', 'mesa', 'butte', 'iceberg',
          // mythology batch 1 — underworld realms, described and drawn room-scale
          'mictlan', 'xibalba',
          // mining batch 1 — the mine working itself, room to building scale
          'placer_mining', 'room_and_pillar_mining', 'longwall_mining',
          // mining value chains batch 2 — a hundred-plus-metre machine or heap: Big Muskie was 150m long,
          // a Capesize bulk carrier about 290m, an ore stockpile a similarly sized mound
          'dragline_excavator', 'stockpile', 'bulk_carrier'],
  '3':   ['atoll', 'cloud', 'lightning', 'thunder', 'flood', 'rainbow', 'river', 'humongous_fungus',
          'trophic_cascade',
          // geography batch 1 — kilometre-scale landscape features, the same bucket as river/atoll/flood
          'mountain', 'volcano', 'canyon', 'glacier', 'fjord', 'meander', 'oxbow_lake', 'delta', 'floodplain', 'lagoon', 'estuary', 'caldera', 'plateau',
          // mining batch 1 — the whole open working, kilometre scale
          'open_pit_mining', 'strip_mining', 'mountaintop_removal', 'block_caving',
          // mining value chains batch 2 — a unit train (the record run was 7.35km) and the port precinct it feeds,
          // kilometre scale like the pit above them
          'ore_railway', 'port',
          // railways batch 1 — a classification yard's full ladder of tracks, km scale
          'rail_yard'],
  '4':   ['rift_valley', 'trench'],
  '6':   ['primordial_soup', 'planetesimal', 'moon', 'comet', 'asteroid', 'storm', 'hurricane', 'blizzard', 'sky', 'sea',
          'tundra', 'desert', 'taiga', 'rainforest'],
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
