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
          'carbon_dioxide', 'disulfide', 'hydrogen_gas', 'oxygen_gas', 'nitrogen_gas',
          'helium', 'neon',
          'carbon_tetrafluoride', 'nitrogen_trifluoride', 'chlorine_trifluoride', 'sulfur_hexafluoride', 'phosphorus_pentafluoride',
          'bromine_trifluoride', 'iodine_pentafluoride', 'bromine_monochloride', 'iodine_monochloride', 'iodine_monobromide', 'hydrogen_bromide', 'hydrogen_iodide',
          'positron'],
  '-9':  ['urushiol', 'juglone', 'piperine', 'gingerol', 'shogaol', 'vitamin_a', 'vitamin_d', 'thiamin', 'riboflavin', 'niacin', 'folate', 'vitamin_b6', 'vitamin_e', 'citric_acid', 'sodium_acetate', 'msg', 'inosinate', 'guanylate', 'ribonucleotides', 'beta_carotene', 'curcumin', 'betanin', 'ponceau_4r', 'red_40', 'yellow_5', 'yellow_6', 'blue_1', 'sorbate', 'benzoate', 'sulfite', 'nitrite', 'trans_fat', 'monoglyceride', 'lecithin', 'sorbitol', 'xylitol', 'aspartame', 'malic_acid', 'salicin', 'gibberellin', 'digoxin', 'lactic_acid', 'acetic_acid', 'lanolin', 'ribose', 'deoxyribose', 'adenine', 'guanine', 'cytosine', 'thymine', 'uracil', 'base_pair', 'phospholipid', 'cholesterol', 'thyroxine', 'ascorbate', 'hydroxyproline', 'porphyrin', 'heme', 'chlorophyll', 'cobalamin', 'retinal', 'selenocysteine', 'fatty_acid', 'iron_sulfur_cluster', 'methanol', 'formaldehyde', 'ethylene', 'phenol', 'tannin', 'glycine', 'alanine', 'serine', 'proline', 'tyrosine', 'aspartic_acid', 'glutamic_acid', 'glutamine', 'asparagine', 'arginine', 'valine', 'leucine', 'isoleucine', 'threonine', 'methionine', 'lysine', 'histidine', 'phenylalanine', 'tryptophan', 'glucose', 'amino_acid', 'cysteine', 'dipeptide', 'nucleotide', 'atp',
          'penicillin', 'dna', 'alpha_helix', 'beta_sheet', 'mutation',
          // DNA-completeness batch 1 — nucleotide/base-pair-scale sequence elements,
          // the same rack as base_pair/mutation/adenine
          'okazaki_fragment', 'codon', 'anticodon', 'point_mutation', 'frameshift_mutation',
          'creatine', 'citrulline', 'theanine', 'caffeine', 'alpha_gpc', 'synephrine', 'biotin', 'sucralose', 'fos',
          'salicylic_acid', 'aspirin', 'streptomycin', 'insulin',
          'nitrophenol', 'aminophenol', 'paracetamol', 'histamine', 'arachidonic_acid', 'prostaglandin',
          'fdg', 'fullerene', 'nanotube',
          // textiles batch 1 — dye-chemistry molecules, the same rack as tannin/curcumin/betanin
          'alizarin', 'leuco_indigo',
          // brain batch 1 — neurotransmitter molecules and their precursor, same molecule scale as histamine/thyroxine
          'neurotransmitter', 'choline', 'acetylcholine', 'dopamine', 'serotonin', 'glutamate', 'gaba', 'noradrenaline',
          // large-intestine batch 1 — a molecular-scale vitamin, the same rack as vitamin_a/vitamin_d/folate
          'vitamin_k',
          // amphibian batch 1 — an alkaloid toxin, the same molecule scale as digoxin/thyroxine
          'batrachotoxin'],
  '-8':  ['maltodextrin', 'hydrolysed_vegetable_protein', 'carrageenan', 'alginate', 'xanthan_gum', 'gum_arabic', 'gellan_gum', 'arrowroot', 'lignin', 'pectin', 'phytochrome', 'isinglass', 'rna', 'transfer_rna', 'ribosomal_rna', 'ribozyme', 'viroid', 'glycogen', 'triple_helix', 'hemoglobin', 'myoglobin', 'photosystem_ii', 'cytochrome_c_oxidase', 'ferritin', 'zinc_finger', 'carbonic_anhydrase', 'glutathione_peroxidase', 'sulfite_oxidase', 'superoxide_dismutase', 'sodium_potassium_pump', 'rhodopsin', 'cellulose', 'chromatin', 'gene', 'allele', 'crispr', 'dna_sequencing', 'microtubule', 'polypeptide', 'protein', 'enzyme', 'collagen', 'keratin', 'membrane',
          // DNA-completeness batch 1 — the replication and expression machinery,
          // same enzyme/process scale as chromatin/gene/enzyme/protein
          'dna_helicase', 'primase', 'dna_polymerase', 'dna_ligase', 'dna_replication',
          'rna_polymerase', 'transcription', 'translation', 'exon', 'intron', 'splicing',
          'denatured_protein', 'starch', 'gelatin', 'ribosome', 'messenger_rna',
          'hyaluronic_acid', 'satellite',
          // cell biology batch 1 — membrane-sheet and DNA-loop scale, the same rack as membrane/chromatin/gene
          'nuclear_envelope', 'endoplasmic_reticulum', 'rough_endoplasmic_reticulum', 'smooth_endoplasmic_reticulum', 'cytoskeleton', 'cell_wall', 'plasmid'],
  '-6':  ['s_thermophilus', 'l_bulgaricus', 'l_acidophilus', 'bifidobacterium', 'l_paracasei', 'l_plantarum', 'leuconostoc', 'lactococcus', 'acetobacter', 'penicillium', 'stoma', 'virus', 'vesicle', 'protocell', 'binary_fission', 'budding', 'bacteria', 'archaea', 'cyanobacteria', 'rhizobium', 'zooxanthellae', 'mitochondrion', 'chloroplast', 'spore', 'pollen', 'action_potential', 'yeast', 'mould', 'resistance', 'chromosome', 'nucleus', 'mitochondrial_dna',
          'bacteriophage', 'prophage', 'lysis', 'salmonella', 'streptomyces',
          'avibirnavirus', 'gammacoronavirus', 'e_coli',
          'cowpox', 'vaccine', 'immunity',
          // brain batch 1 — sub-cellular neural structures, same organelle/junction scale as vesicle/nucleus
          'axon', 'dendrite', 'myelin_sheath', 'synapse',
          // cell biology batch 1 — organelle scale, the same rack as mitochondrion/chloroplast/nucleus/vesicle
          'nucleolus', 'golgi_apparatus', 'lysosome', 'vacuole', 'centriole', 'cilia',
          // cell biology batch 1 — membrane-level processes, the same rack as action_potential/binary_fission
          'diffusion', 'osmosis', 'active_transport', 'endocytosis', 'exocytosis', 'phagocytosis'],
  '-5':  ['photosite',
          'yoghurt_culture', 'cytoplasm', 'alga', 'cell', 'mitosis', 'meiosis', 'sperm', 'polar_body', 'stem_cell', 'protozoan', 'eimeria',
          'plasmodium', 'toxoplasma_gondii', 'giardia', 'entamoeba_histolytica', 'trichomonas_vaginalis', 'cryptosporidium',
          // brain batch 1 — individual nerve and glial cells, same single-cell scale as cell/stem_cell
          'glia', 'astrocyte', 'oligodendrocyte',
          // cell biology batch 1 — whole-cell scale, the same rack as cell/sperm/stem_cell
          'flagella', 'neuron', 'muscle_cell', 'red_blood_cell', 'white_blood_cell', 'guard_cell', 'palisade_cell', 'goblet_cell', 'ciliated_cell'],
  '-4':  ['coconut_sugar', 'guar_gum', 'locust_bean_gum', 'silicon_dioxide', 'annatto', 'caramel_colour', 'agar', 'paprika', 'carmine', 'shellac', 'roe', 'hydroxyapatite', 'fluorapatite', 'magnesium_oxide', 'zinc_oxide', 'copper_oxide', 'litharge', 'mercuric_oxide', 'alumina', 'potassium_chloride', 'potassium_iodide', 'sodium_fluoride', 'magnesium_nitride',
          // mining comprehensive batch — bagged/prilled granular chemicals and fine ground mill product,
          // same grain-size bucket as sand/clay
          'ammonium_nitrate', 'anfo', 'concentrate',
          // textiles batch 1 — a lake pigment, the same rack as carmine
          'rose_madder',
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
  '-2':  [// mining comprehensive batch — broken/loose rock and small cast metal, hand-sample scale
          // alongside ore/stone/ballast/diamond/coin
          'run_of_mine', 'waste_rock', 'assay', 'dore',
          'sundew', 'edelweiss', 'moss', 'liverwort',
          // Greek/Roman mythology batch 1 — large-insect scale, the same rack as cockroach/dung_beetle
          'cicada',
          'seahorse',
          'drupe', 'walnut', 'sumac', 'lime', 'makrut_lime', 'jalapeno', 'chipotle', 'candied_fruit', 'steak',
          'kiwi', 'raspberry', 'blackberry', 'cranberry', 'blueberry', 'date', 'shrimp',
          'chickpea', 'bean', 'black_bean', 'pinto_bean', 'kidney_bean',
          'cashew', 'pistachio', 'pecan', 'hazelnut', 'macadamia', 'veal', 'lamb', 'nacre', 'sinew', 'bast_fibre', 'capsicum', 'quartz', 'feldspar', 'mica', 'corundum', 'diamond', 'ruby', 'sapphire', 'emerald', 'opal', 'copper_sulfide', 'zinc_sulfide', 'lead_sulfide', 'tarnish', 'rust', 'tungsten_carbide', 'calcium_carbide', 'titanium_nitride', 'p_type', 'n_type', 'diode', 'led', 'transistor', 'capacitor', 'accelerometer', 'photodiode', 'click_wheel', 'flash_memory', 'thin_film_transistor', 'liquid_crystal_cell', 'liquid_crystal', 'laser_diode', 'ccd_sensor', 'fingerprint_scanner', 'lodestone', 'filament', 'nichrome', 'coin', 'nail', 'needle', 'solder', 'galalith', 'manganese', 'cobalt', 'tungsten', 'molybdenum', 'vanadium', 'cadmium', 'palladium', 'rhodium', 'iridium', 'osmium', 'ruthenium', 'rhenium', 'hafnium', 'zirconium', 'tantalum', 'niobium', 'scandium', 'yttrium', 'lithium', 'caesium', 'rubidium', 'beryllium', 'strontium', 'barium', 'radium', 'thorium', 'plutonium', 'polonium', 'bismuth', 'cerium', 'lanthanum', 'neodymium', 'samarium', 'europium', 'gadolinium', 'promethium', 'silicon', 'boron', 'arsenic', 'selenium', 'antimony', 'germanium', 'tellurium', 'iodine', 'fluorite', 'borax', 'pyrolusite', 'molybdenite', 'osmiridium', 'pollucite', 'monazite', 'rare_earth', 'baryte', 'palladium_hydride', 'bismuth_telluride', 'yag', 'ferrocerium',
          // textiles batch 1 — a hand-sample mineral, the same rack as borax/fluorite
          'alum',
          'pyrite', 'hematite', 'magnetite', 'graphite', 'calcite', 'malachite', 'azurite', 'gypsum', 'olivine', 'garnet', 'beryl', 'aquamarine', 'serpentine',
          'bauxite', 'spodumene', 'bastnasite',
          'iron', 'copper', 'gold', 'silver', 'tin', 'lead', 'zinc', 'mercury', 'aluminum', 'nickel', 'chromium', 'titanium', 'platinum', 'uranium', 'magnesium', 'calcium', 'sodium', 'potassium', 'enriched_uranium',
          'neptunium', 'americium', 'curium', 'berkelium', 'californium', 'protactinium', 'actinium', 'technetium', 'astatine', 'rutherfordium', 'dubnium', 'seaborgium', 'bohrium', 'hassium', 'meitnerium', 'darmstadtium', 'roentgenium', 'copernicium',
          'movable_type', 'vacuum_tube', 'integrated_circuit', 'microprocessor',
          'bioluminescent_fungus', 'truffle', 'dead_mans_fingers', 'witchs_butter',
          'lard', 'wool', 'embryo', 'parthenogenesis', 'cotton', 'popcorn', 'soybean', 'tofu', 'pea', 'lemon', 'strawberry', 'pear', 'cherry', 'fig', 'coffee', 'cocoa_bean', 'chocolate', 'stone', 'flint', 'limestone', 'ice', 'brick', 'adobe', 'mortar', 'candle', 'coccidiosis',
          'infectious_bursal_disease', 'infectious_bronchitis', 'colibacillosis', 'ascaridiasis',
          'ore', 'cinnabar', 'yellowcake', 'quicklime', 'oak_gall', 'thread', 'fibre', 'ink', 'mirror',
          // textiles batch 1 — a wisp of prepared fibre, the same rack as wool/thread/fibre
          'carded_wool',
          'soap', 'lye', 'butter', 'ghee', 'curd', 'cheese', 'aged_cheese',
          'mozzarella', 'cheddar', 'parmesan', 'feta', 'cottage_cheese', 'custard',
          'blue_cheese', 'egg', 'boiled_egg', 'golden_egg', 'apple', 'tomato',
          'onion', 'garlic', 'bulb', 'potato', 'cassava', 'chilli', 'meatball', 'sausage',
          'bacon', 'chips', 'leaf', 'flower', 'root', 'herb', 'sprout', 'seedling',
          // Hindu mythology batch 1 — an aquatic flower, same rack as flower/leaf/root
          'lotus',
          'corn_dolly', 'gingerbread_man', 'philosopher_stone', 'sugarcane',
          'turquoise', 'cacao_of_the_gods',
          'cucumber', 'wheat', 'grass', 'salt_fish', 'cured_meat', 'meat', 'bone', 'shell',
          'tissue', 'muscle', 'wood', 'glass', 'pickle', 'sauerkraut', 'kimchi',
          // flagship-animal-anatomy batch 1 — hand-sample body parts, same rack as bone/muscle
          'tooth', 'sagittal_crest', 'claw', 'knuckle',
          // birds batch 1 — hand-sample body parts, same rack as bone/claw/tooth
          'beak', 'talon', 'hollow_bone',
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
          'ballast',
          'icsi_needle', 'nerve', 'stm_tip',
          // evolution batch 1 — a fossilized bone or shell, hand-sample scale alongside bone/shell
          'fossil',
          // domestic-cat batch 1 — hand-sample body parts, the same rack as bone/muscle/claw/nerve
          'cartilage', 'whisker', 'floating_clavicle', 'retractable_claw', 'tapetum_lucidum',
          'barbed_tongue', 'vomeronasal_organ', 'slit_pupil',
          // seashore batch 1 — small shelled intertidal animals, the same cm-scale rack as shrimp/seahorse/snail/shell
          'barnacle', 'periwinkle', 'limpet', 'chiton', 'whelk', 'hermit_crab', 'sand_dollar', 'porcelain_crab',
          // amphibian batch 1 — a clump of spawn, a larva, and organ/process-scale anatomy,
          // the same hand-sample rack as bone/muscle/nerve/golden_poison_frog above
          'frogspawn', 'tadpole', 'gill', 'lung', 'metamorphosis', 'amphibian_skin',
          'cutaneous_respiration', 'indicator_species', 'lateral_line'],
  '-1':  [// mining comprehensive batch — a printed/tablet map or report, a drummed industrial liquid,
          // and cast metal sheet/ingot, same item scale as paper/sulfuric_acid/steel
          'geological_mapping', 'target_generation', 'feasibility_study', 'overburden',
          'nitric_acid', 'cyanide', 'matte', 'blister_copper', 'copper_cathode',
          'venus_flytrap', 'nepenthes', 'mistletoe', 'water_lily', 'orchid',
          'eagle', 'fifth_sun', 'popol_vuh',
          // egyptian gods batch 1 — a wading marsh bird alongside duck/goose, and a hand-held organ alongside knife/rope
          'ibis', 'heart',
          // Greek/Roman mythology batch 1 — bird, hand-tool, instrument and small-plant scale
          'peacock', 'owl', 'helmet', 'lyre', 'poppy', 'arrow',
          // birds batch 1 — organ/whole-bird scale, same rack as feather/down/eagle/owl/duck/swan/raven
          'keel', 'flight_muscle', 'flight_feather', 'air_sac',
          'hummingbird', 'penguin', 'flamingo', 'albatross', 'ostrich', 'kiwi_bird',
          'toucan', 'woodpecker', 'pelican', 'heron', 'cormorant', 'parrot', 'swift',
          'monocot', 'dicot', 'buttress_root', 'brace_root', 'clinging_root', 'aerial_root', 'pneumatophore', 'ivy',
          'rooster', 'hen', 'chick', 'cockerel', 'pullet', 'capon', 'drake', 'duckling', 'gander', 'goose', 'gosling', 'tom', 'turkey_hen', 'poult', 'rabbit', 'kid', 'foal', 'piglet', 'carabeef', 'chevon',
          'mango', 'ginger', 'rhizome', 'celery', 'marjoram', 'parsley', 'sage', 'rosemary', 'basil', 'thyme', 'mint', 'tarragon', 'dill', 'coriander', 'chives', 'bay_leaf', 'oregano', 'sunflower', 'oil', 'soy_sauce', 'fish_sauce', 'nuoc_cham', 'lithium_graphite', 'stainless_steel', 'beryllium_copper', 'niobium_titanium', 'rose_gold', 'hard_lead', 'titanium_alloy', 'galvanized_iron', 'gold_amalgam', 'dental_amalgam', 'neon_light', 'ferrovanadium', 'nicad_battery', 'lithium_ion_battery', 'platinum_rhodium_gauze', 'platinum_iridium', 'hardened_platinum', 'tungsten_rhenium', 'rocket_nozzle_alloy', 'scandium_aluminum_alloy', 'gas_mantle', 'neodymium_magnet', 'samarium_cobalt_magnet', 'gadolinium_steel',
          'carbon_disulfide', 'disulfur_dichloride', 'phosphorus_trichloride', 'titanium_chloride', 'aluminum_copper_alloy', 'magnalium', 'nak_alloy', 'tin_silver_solder', 'beef', 'pork', 'mutton', 'venison', 'poultry', 'game', 'aged_beef', 'ham', 'stew', 'turmeric', 'carob', 'red_alga', 'hydrogenated_oil', 'sap', 'bark', 'cork', 'xylem', 'phloem', 'coconut', 'coconut_water', 'sugar_beet', 'mulberry', 'graft', 'hardwood', 'softwood', 'tallow', 'horn', 'antler', 'feather', 'down', 'oyster', 'swim_bladder', 'ambergris', 'baleen', 'manure', 'parchment', 'ivory', 'royal_jelly', 'rennet', 'whey', 'ricotta', 'starter_culture', 'pasteurised_milk', 'souring_kraut', 'kefir', 'buttermilk', 'miso', 'camembert', 'tuber', 'cutting', 'runner', 'obsidian', 'pumice', 'lignite', 'anthracite', 'marble', 'slate', 'magnet', 'copper_wire', 'voltaic_pile', 'electromagnet', 'heating_element', 'light_bulb', 'ipod', 'nike_plus_sensor', 'midsole_foam', 'athletic_shoe', 'polarizer', 'dvd_player', 'magnetic_tape', 'vhs', 'magnetron', 'scanner', 'barcode_scanner', 'wii_remote', 'digital_camera', 'sulfuric_acid', 'lead_acid_cell', 'electrolysis', 'electroplating', 'solar_cell', 'fungus', 'lichen', 'mycelium', 'mycorrhiza', 'root_nodule', 'polyp', 'coral', 'bleached_coral', 'earthworm', 'ascaridia_galli', 'detritus', 'humus', 'compost', 'rumen', 'pancreas',
          // flagship-animal-anatomy batch 1 — external/organ body parts, same rack as horn/antler/rumen/pancreas
          'mane', 'ossicone', 'shoulder_hump', 'pouch', 'hoof', 'trunk', 'cecum',
          // large-intestine batch 1 — organ-scale body parts and gut-physiology concepts, same rack
          // as cecum/rumen/pancreas above and mutualism/decomposer below
          'large_intestine', 'colon', 'haustra', 'rectum', 'appendix', 'peristalsis', 'gut_flora',
          'current', 'magnetic_field', 'barometer', 'pendulum_clock', 'sewing_machine', 'telegraph', 'telephone', 'radio', 'phonograph', 'x_ray', 'camera_obscura', 'photographic_plate', 'photograph', 'ether', 'typewriter', 'steel', 'bronze', 'brass', 'hide', 'leather', 'latex', 'rubber', 'vulcanised_rubber', 'canvas', 'silk', 'silkworm', 'cocoon', 'knife', 'rope', 'wheel', 'lamp', 'shoe', 'pipe', 'coal',
          // textiles batch 1 — hand tools, prepared crops and finished fabric, the same rack as knife/cloth/silk
          'wool_card', 'felt', 'spindle', 'flying_shuttle', 'knitting_needles', 'knitted_fabric', 'indigo', 'madder', 'dyed_cloth', 'coal_tar', 'wood_tar', 'ethanol', 'bakelite', 'polyethylene', 'snow', 'smoke', 'ozone', 'air', 'loess', 'fulgurite', 'bone_char', 'bottle', 'blackware', 'stockfish', 'chlorine', 'fluorine', 'bromine', 'argon', 'krypton', 'xenon', 'noble_mix', 'kelp', 'book', 'fetus', 'maize', 'barley', 'oat', 'carrot', 'lettuce', 'pumpkin', 'beet', 'banana', 'brewed_coffee', 'cocoa', 'duck', 'turkey', 'koala', 'platypus', 'lizard', 'turtle', 'cloth', 'clothing', 'paper', 'pulp', 'flax', 'water', 'mud', 'soil', 'tempered_clay', 'concrete', 'fire', 'steam',
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
          // cell biology batch 1 — a viscous body fluid, the same rack as broth/cream
          'mucus', 'blood',
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
          // japanese gods batch 1 — a hand-held bow and a portable drum, the same rack as knife/gong
          'bow', 'taiko',
          'theremin', 'electric_guitar', 'synthesizer',
          'atlantic_herring', 'rainbow_trout', 'northern_pike', 'common_carp', 'goldfish', 'koi',
          'european_eel', 'european_plaice', 'clownfish', 'piranha', 'largemouth_bass',
          'dragonfly', 'locust', 'mantis', 'scorpion',
          'eoraptor', 'compsognathus', 'archaeopteryx', 'microraptor', 'psittacosaurus',
          'leptocyon',
          'ascaris_lumbricoides', 'lymphatic_filariasis',
          'sea_urchin', 'mutualism', 'pioneer_species', 'decomposer',
          'baboon', 'lemur', 'bald_eagle', 'peregrine_falcon', 'snowy_owl', 'turkey_vulture',
          // animal physiology batch 1 (How Animals Work) -- smaller mammals, same rack as baboon/lemur/monkey
          'sloth', 'armadillo', 'hedgehog', 'meerkat',
          // Hindu mythology batch 1 — a waterfowl (goose/duck scale), a house mouse (rabbit-adjacent small
          // mammal), a tree-dwelling primate (baboon/lemur scale), a hand-held stringed instrument
          // (sitar scale) and a hand-carried sea-snail shell (knife/shoe scale)
          'swan', 'mouse', 'monkey', 'veena', 'conch',
          'gila_monster', 'american_bullfrog', 'cane_toad', 'axolotl', 'fire_salamander',
          // railways batch 1 — small machine parts, hand-tool scale
          'roller_bearing', 'plain_bearing', 'air_brake',
          'transducer', 'sound_wave', 'echo', 'ultrasound_scan', 'myoelectric_signal', 'bionic_arm',
          'hydraulic_pump', 'artificial_heart', 'reinforced_concrete', 'laser', 'holographic_plate', 'hologram',
          'scanning_tunneling_microscope',
          // tech breakthroughs batch 1 — handheld and tabletop electronics, same bucket as telephone/radio/digital_camera
          'atomic_clock', 'gps', 'cellular_telephone', 'smartphone', 'router', 'film_reel', 'movie_camera', 'cinematography',
          // aviation batch 1 — a poured or drummed liquid, same item scale as oil
          'petroleum', 'jet_fuel',
          // brain batch 1 — brain regions, tissue types, and brain-scale processes, same organ scale as pancreas/nerve
          'white_matter', 'gray_matter', 'cerebral_cortex', 'spinal_cord', 'brainstem', 'thalamus', 'hypothalamus',
          'pituitary_gland', 'hippocampus', 'amygdala', 'corpus_callosum', 'cerebrum', 'cerebellum', 'hindbrain',
          'brain', 'frontal_lobe', 'parietal_lobe', 'temporal_lobe', 'occipital_lobe', 'meninges',
          'cerebrospinal_fluid', 'blood_brain_barrier', 'cranial_nerve', 'spinal_nerve',
          'short_term_memory', 'long_term_memory', 'neuroplasticity', 'neurogenesis',
          // norse gods batch 1 — hand-tool and small-object scale, the same rack as rope/shoe/horn
          'raven', 'hammer', 'rune',
          // evolution batch 1 — a museum-specimen fossil and a living animal, same rack as archaeopteryx/fish
          'transitional_fossil', 'living_fossil',
          // seashore batch 1 — hand-sized shore animals and shore seaweed fronds, same rack as crab/oyster/kelp
          'mussel', 'sea_star', 'brittle_star', 'razor_clam', 'bladder_wrack', 'sea_lettuce',
          // amphibian batch 1 — hand-sized amphibian species, the same rack as axolotl/fire_salamander above
          'caecilian', 'surinam_toad', 'olm', 'siren'],
  '0':   [// mining value chains batch 2 — machine-sized equipment, a room-scale appliance
          'diesel_electric_drive',
          // mining comprehensive batch — a computer-built block model, same appliance bucket as computer
          'resource_estimation',
          'welwitschia', 'rafflesia', 'bracken_fern',
          'jaguar', 'sun_stone', 'hero_twins',
          'quetzalcoatl', 'tezcatlipoca', 'huitzilopochtli', 'tlaloc', 'coatlicue', 'tonatiuh',
          'mictlantecuhtli', 'xiuhtecuhtli', 'centeotl', 'xolotl', 'kukulkan', 'itzamna',
          'ixchel', 'chaac', 'ek_chuah',
          // african mythology batch 1 — Yoruba, Efik and Kuba deities, same human/idol scale as the Mesoamerican gods above
          'shango', 'obatala', 'orisha', 'eshu', 'elegua', 'olorun', 'yemoja', 'anansi', 'oya', 'babalu_aye', 'abassi', 'bumba',
          // Hindu mythology batch 1 — deities drawn at human/idol scale, the same rack as the Aztec/Maya pantheon above
          'brahma', 'vishnu', 'shiva', 'saraswati', 'lakshmi', 'parvati', 'durga', 'kali',
          'ganesha', 'hanuman', 'indra', 'agni', 'surya', 'vayu',
          // a full pole weapon, the same order of magnitude as the human wielding it
          'trident',
          // egyptian gods batch 1 — deities and idols at human scale, and their new base ingredients:
          // a boat as drawn (a small hull), and animals in the ox/lion/wolf size class
          'ra', 'osiris', 'isis', 'horus', 'set', 'anubis', 'thoth', 'bastet', 'sobek', 'hathor',
          'sekhmet', 'nephthys', 'nut', 'geb', 'shu', 'khnum', 'ptah', 'amun', 'maat', 'khonsu',
          'taweret', 'serket', 'wadjet', 'apep',
          'boat', 'hippopotamus', 'jackal', 'egyptian_cobra',
          // norse gods batch 1 — human/idol scale, the same rack as the Aztec/Maya deities above; spear is a ~2 m weapon, same order as a human
          'spear', 'odin', 'thor', 'loki', 'freyja', 'frigg', 'baldr', 'heimdall', 'tyr',
          'njord', 'skadi', 'sif', 'bragi', 'idun', 'hel', 'vidar', 'freyr',
          // japanese gods batch 1 — human-scale figures, the same rack as the Aztec/Maya deities above
          'izanagi', 'izanami', 'amaterasu', 'susanoo', 'tsukuyomi', 'kagutsuchi', 'inari',
          'ryujin', 'fujin', 'raijin', 'hachiman', 'tenjin', 'uke_mochi', 'mikaboshi',
          'ame_no_uzume', 'sarutahiko', 'fox',
          // Greek/Roman mythology batch 1 — human- or large-animal-scale figures, the
          // same rack as the Aztec/Maya gods and jaguar above
          'zeus', 'hera', 'poseidon', 'hades', 'athena', 'apollo', 'artemis', 'ares',
          'aphrodite', 'hermes', 'dionysus', 'demeter', 'persephone', 'hephaestus',
          'cronus', 'gaia', 'uranus', 'rhea', 'eros', 'nike', 'helios', 'selene', 'eos',
          'pan', 'hypnos', 'heracles', 'odysseus', 'cerberus',
          'bull', 'heifer', 'steer', 'buffalo', 'donkey', 'boar', 'sow', 'gilt', 'barrow', 'ram', 'ewe', 'wether', 'buck', 'doe', 'stallion', 'mare', 'colt', 'filly', 'gelding',
          'calf', 'cactus', 'foxglove', 'winter_wheat', 'semi_dwarf_wheat', 'willow', 'bamboo', 'ox', 'whale', 'granite', 'basalt', 'sandstone', 'mudstone', 'shale', 'conglomerate', 'phyllite', 'schist', 'gneiss', 'quartzite', 'generator', 'electric_motor', 'transformer', 'refrigerator', 'printing_press', 'telescope', 'steam_engine', 'cotton_gin',
          // textiles batch 1 — floor-standing apparatus, the same rack as cotton_gin/printing_press
          'spinning_wheel', 'loom',
          'elevator', 'internal_combustion_engine', 'lcd_screen', 'microwave_oven', 'plough', 'peat', 'forge', 'warhead', 'pig', 'sheep', 'horse', 'wolf', 'deer', 'bear', 'kangaroo', 'dingo', 'zebra', 'lion', 'camel', 'cow', 'goat', 'aurochs', 'tree', 'acacia', 'scarecrow', 'greenhouse', 'human', 'natural_selection', 'cystic_fibrosis', 'sickle_cell_anemia', 'cancer', 'gene_therapy', 'dna_profile', 'cloning', 'snake', 'rattlesnake',
          // animal physiology batch 1 (How Animals Work) -- large mammals, same rack as lion/camel/dingo
          'rhinoceros', 'hyena',
          'proailurus', 'pseudaelurus', 'homotherium', 'panthera_zdanskyi', 'tiger', 'javan_tiger',
          'eucyon', 'canis_lepophagus', 'canis_etruscus', 'canis_mosbachensis',
          'dog', 'german_shepherd', 'border_collie', 'rottweiler', 'saint_bernard', 'siberian_husky', 'greyhound', 'afghan_hound', 'bloodhound', 'labrador_retriever', 'golden_retriever', 'bull_terrier',
          'piano',
          'cat', 'taenia_solium', 'taenia_saginata',
          // domestic-cat batch 1 — cat-scale reflex/behaviour and breeds, same rack as cat/dog
          'righting_reflex', 'purr', 'manx', 'siamese', 'sphynx', 'devon_rex', 'scottish_fold',
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
          'piston', 'axle', 'bogie', 'coupler', 'sleeper', 'block_signal',
          // medical-technology batch 1 — machines the size of the room they sit in
          'superconducting_magnet', 'mri_scan', 'pet_scan', 'robotic_surgery',
          // tech breakthroughs batch 1 — a desktop computer tower and monitor, same appliance bucket as lcd_screen/refrigerator
          'computer', 'television', 'film_projector',
          // aviation batch 1 — metre-scale aircraft parts and engine stages
          'wing_spar', 'tail_stabilizer', 'aileron', 'rudder', 'tail_elevator', 'landing_gear',
          'propeller', 'compressor', 'combustor', 'turbine', 'jet_engine', 'turbofan',
          // brain batch 1 — nervous-system-level organ systems, whole-body scale like human
          'peripheral_nervous_system', 'central_nervous_system', 'nervous_system',
          'autonomic_nervous_system', 'sympathetic_nervous_system', 'parasympathetic_nervous_system',
          // seashore batch 1 — a rock pool a person looks down into, the same viewed-object scale as human/sea_otter
          'tide_pool',
          // amphibian batch 1 — up to 1.5 m long, the same rack as snake/human above
          'japanese_giant_salamander'],
  '1':   [// mining comprehensive batch — tens-of-metres mining/processing equipment and a bench's own
          // scale, the same bucket as drilling_rig/ball_mill/haul_truck above
          'exploration_drilling', 'bench', 'blasting', 'excavator', 'grade_control',
          'magnetic_separation', 'gravity_separation', 'road_freight', 'car_dumper',
          'saguaro', 'airplane',
          'oak', 'pine', 'rubber_tree', 'kapok', 'elephant', 'de_extinction', 'giraffe', 'nile_crocodile', 'american_alligator',
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
          'imax_3d_projection',
          // medical-technology batch 1 — a curtain wall as drawn: one building face, tens of metres
          'curtain_wall',
          // tech breakthroughs batch 1 — a satellite bus with solar panels extended, tens of metres like an airplane
          'communications_satellite', 'gps_satellite',
          // aviation batch 1 — whole airframes and airfield buildings, tens of metres
          'wing', 'fuselage', 'glider', 'hot_air_balloon', 'rotor', 'helicopter', 'parachute', 'jet_airliner', 'control_tower'],
  '2':   [// mining comprehensive batch — hundred-plus-metre engineered structures and yards,
          // the same bucket as stockpile/bulk_carrier/hangar above
          'haul_road', 'mine_infrastructure', 'waste_dump', 'heap_leach', 'tailings_dam',
          'port_stockpile', 'stacker_reclaimer', 'ship_loader',
          'giant_sequoia', 'coast_redwood',
          'mangrove', 'magma', 'lava', 'reef', 'dune', 'mist', 'fog', 'rain', 'wind', 'field', 'meadow', 'pasture', 'harvest', 'early_crop',
          'food_web', 'succession', 'limiting_factor', 'carrying_capacity', 'kelp_forest', 'evolution', 'common_ancestor', 'genetic_diversity',
          // living-earth batch 1 — abstract classification concepts, the same "as diagrammed" scale as common_ancestor/evolution
          'taxonomy', 'tree_of_life', 'cladistics',
          // evolution batch 1 — abstract mechanism and evidence concepts, the same conceptual rack as evolution/common_ancestor/genetic_diversity
          'genetic_drift', 'gene_flow', 'adaptation', 'sexual_selection', 'artificial_selection', 'reproductive_isolation', 'speciation',
          'adaptive_radiation', 'homology', 'vestigial_structure', 'fossil_record', 'extinction', 'mass_extinction', 'camouflage',
          // geography batch 1 — coastal and karst features and single landforms, tens to a couple hundred metres
          'sea_cliff', 'sea_arch', 'sea_stack', 'waterfall', 'sinkhole', 'cavern', 'moraine', 'mesa', 'butte', 'iceberg',
          // mythology batch 1 — underworld realms, described and drawn room-scale
          'mictlan', 'xibalba',
          // japanese gods batch 1 — a single rock cave, the same rack as cavern
          'ame_no_iwato',
          // mining batch 1 — the mine working itself, room to building scale
          'placer_mining', 'room_and_pillar_mining', 'longwall_mining',
          // mining value chains batch 2 — a hundred-plus-metre machine or heap: Big Muskie was 150m long,
          // a Capesize bulk carrier about 290m, an ore stockpile a similarly sized mound
          'dragline_excavator', 'stockpile', 'bulk_carrier',
          // medical-technology batch 1 — a skyscraper as drawn, hundreds of metres tall
          'skyscraper',
          // aviation batch 1 — an airship envelope (the Hindenburg was 245m) and a big airfield building, hundreds of metres
          'airship', 'hangar', 'taxiway',
          // seashore batch 1 — the shore band between the tide marks, hundreds of metres of coastline, same rack as sea_cliff/sea_arch
          'intertidal_zone'],
  '3':   [// mining comprehensive batch — a slurry pipeline running tens of kilometres, km scale like the pit
          'slurry_pipeline',
          'atoll', 'cloud', 'lightning', 'thunder', 'flood', 'rainbow', 'river', 'humongous_fungus',
          'trophic_cascade',
          // geography batch 1 — kilometre-scale landscape features, the same bucket as river/atoll/flood
          'mountain', 'volcano', 'canyon', 'glacier', 'fjord', 'meander', 'oxbow_lake', 'delta', 'floodplain', 'lagoon', 'estuary', 'caldera', 'plateau',
          // evolution batch 1 — a kilometre-scale landform, the same bucket as atoll/mountain
          'island',
          // mining batch 1 — the whole open working, kilometre scale
          'open_pit_mining', 'strip_mining', 'mountaintop_removal', 'block_caving',
          // mining value chains batch 2 — a unit train (the record run was 7.35km) and the port precinct it feeds,
          // kilometre scale like the pit above them
          'ore_railway', 'port',
          // railways batch 1 — a classification yard's full ladder of tracks, km scale
          'rail_yard',
          // aviation batch 1 — a major runway can run 3-4 km, km scale like the yard above it
          'runway',
          // seashore batch 1 — the tide's rise and fall along a whole stretch of coastline, km scale like estuary/lagoon/fjord
          'tide'],
  '4':   ['rift_valley', 'trench',
          // medical-technology batch 1 — the LHC's 27 km ring
          'hadron_collider',
          // aviation batch 1 — a whole airport site, several kilometres across, the same bucket as the LHC ring
          'airport'],
  '6':   ['primordial_soup', 'planetesimal', 'moon', 'comet', 'asteroid', 'storm', 'hurricane', 'blizzard', 'sky', 'sea',
          'tundra', 'desert', 'taiga', 'rainforest',
          // tech breakthroughs batch 1 — a worldwide network, the same planet-spanning bucket as sky/sea/desert
          'internet',
          // living-earth batch 1 — a plate, a plate boundary, or the fault system/ridge it forms, all continent-to-ocean-basin scale like desert/tundra/sea; earthquake grouped with the storm/hurricane phenomena it belongs beside
          'tectonic_plate', 'divergent_boundary', 'convergent_boundary', 'transform_boundary', 'mid_ocean_ridge', 'earthquake'],
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
