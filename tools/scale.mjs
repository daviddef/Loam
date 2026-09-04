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
  '-10': [
          /* the universe closed, 4 Sep */
          'quantum_mechanics', 'uncertainty_principle', 'radioactivity', 'fusion', 'superconductivity',
          /* subatomic, 4 Sep */
          'fission',
          /* umbrella waves, 3 Sep */
          'spin', 'fermion', 'boson', 'quark', 'strange_quark', 'charm_quark', 'bottom_quark', 'top_quark', 'lepton', 'muon', 'tau', 'neutrino', 'electron_neutrino', 'muon_neutrino', 'tau_neutrino', 'gluon', 'w_boson', 'z_boson', 'higgs_boson', 'hadron', 'baryon', 'meson', 'metallic_bond', 'oxide', 'antimatter', 'pauli_exclusion_principle',
          /* completeness-audit wave, 2 Sep */
          'atom', 'chemical_bond', 'chemical_reaction', 'compound', 'element', 'hydrocarbon', 'molecule', 'nuclear_fission',
          'nuclear_fusion', 'oxidation',
          /* microbio wave, 2 Sep */
          'ion',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'ethane', 'hydrogen_cyanide', 'chlorine_dioxide', 'methylamine', 'dinitrogen_pentoxide', 'phosgene', 'bromate', 'dinitrogen_trioxide', 'iodide', 'hypochlorite', 'bicarbonate', 'chromate', 'sulfur_trioxide', 'dinitrogen_monoxide', 'isotope', 'half_life', 'ionic_bond', 'covalent_bond', 'hydrogen_bond', 'van_der_waals_force', 'hydrophobic_effect',
          'methane', 'phosphate', 'up_quark', 'down_quark', 'proton', 'neutron', 'electron', 'atomic_nucleus', 'photon', 'gamma_ray', 'deuterium', 'tritium', 'fission_product', 'carbon_monoxide', 'sulfur_dioxide', 'hydrogen_sulfide', 'nitric_oxide', 'nitrogen_dioxide', 'nitrate', 'hydrogen_chloride', 'hydrogen_fluoride', 'ammonia', 'acetylene', 'hydrogen', 'oxygen', 'nitrogen', 'carbon', 'sulfur', 'phosphorus',
          'carbon_dioxide', 'disulfide', 'hydrogen_gas', 'oxygen_gas', 'nitrogen_gas',
          'helium', 'neon',
          'carbon_tetrafluoride', 'nitrogen_trifluoride', 'chlorine_trifluoride', 'sulfur_hexafluoride', 'phosphorus_pentafluoride',
          'bromine_trifluoride', 'iodine_pentafluoride', 'bromine_monochloride', 'iodine_monochloride', 'iodine_monobromide', 'hydrogen_bromide', 'hydrogen_iodide',
          'positron',
          // sandboxels gapfill batch 1 — antiparticle and antimatter-atom scale, the same rack as proton/positron/hydrogen
          'antiproton', 'antihydrogen'],
  '-9':  [
          /* verb outcomes batch 3, 4 Sep */
          'lachrymatory_factor',
          /* verb outcomes batch 1, 4 Sep. a short starch chain */
          'dextrin',
          /* the universe closed, 4 Sep */
          'valence', 'isomer',
          /* head nouns, 4 Sep — R2, the umbrella pass */
          'bond',
          /* conditions, 4 Sep — scaled to the part that goes wrong */
          'vitamin_b1',
          /* parasites wave, 3 Sep */
          'praziquantel', 'albendazole', 'mebendazole', 'ivermectin', 'metronidazole', 'niclosamide', 'diethylcarbamazine', 'pyrantel_pamoate', 'nitazoxanide', 'quinine',
          'polycyclic_aromatic_hydrocarbon', 'naphthalene', 'anthracene', 'phenanthrene', 'benzanthracene', 'dibenzanthracene', 'benzo_a_pyrene', 'chlorinated_hydrocarbon', 'beta_propiolactone', 'ethyleneimine', 'nitrosamine', 'aflatoxin_b1', 'thalidomide', 'methylmercury', 'benzoic_acid', 'bha', 'bht', 'hydroxyl_radical', 'free_radical', 'carcinogen', 'mutagen', 'teratogen',
          /* unblocking-nouns wave, 2 Sep */
          'antibiotic', 'antifungal', 'antiviral', 'dna_methylation', 'genetic_code',
          /* DNA-structure fix, 2 Sep */ 'nucleoside', 'double_helix',
          /* completeness-audit wave, 2 Sep */
          'abscisic_acid', 'catalyst', 'cytokinin', 'estrogen', 'fat', 'glucagon', 'graphene', 'melatonin',
          'progesterone', 'testosterone',
          /* microbio wave, 2 Sep */
          'adjuvant', 'adp', 'aflatoxin', 'azole', 'cephalosporin', 'chloroquine', 'coenzyme', 'cofactor',
          'fluoroquinolone', 'macrolide', 'oseltamivir', 'protease_inhibitor', 'purine', 'pyrimidine', 'saturated_fat', 'steroid',
          'sterol', 'sucrose', 'sulfonamide', 'tetracycline', 'thymine_dimer', 'triclosan', 'triglyceride', 'unsaturated_fat',
          'vancomycin',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'potassium_acetate', 'calcium_acetate', 'sodium_citrate', 'sodium_nitrite', 'sulfate', 'hydrogen_sulfate', 'permanganate', 'dichromate', 'fructose', 'oxalate', 'potassium_nitrite', 'methyl_formate', 'nitrous_acid', 'hypochlorous_acid', 'chlorous_acid', 'chloric_acid', 'silicic_acid', 'pyridine', 'tartaric_acid', 'nickel_acetate', 'acetaldehyde', 'mannitol', 'styrene', 'lead_acetate', 'maltose', 'bisphenol_a', 'thymol', 'bromothymol_blue', 'ethylene_oxide', 'butanoic_acid', 'hypoiodous_acid', 'acetamide', 'dimethyl_sulfide', 'dimethyl_sulfoxide', 'eugenol', 'silver_acetate', 'phenolphthalein', 'stearic_acid', 'carbonic_acid', 'sulfurous_acid', 'galactose', 'camphor', 'lactose', 'capsaicin', 'benzaldehyde', 'allyl_isothiocyanate', 'nootkatone', 'nonadienal', 'filbertone', 'isoamyl_acetate', 'sotolon', 'diacetyl', 'skatole', 'linalool', 'limonene', 'methional', 'hexanal', 'vanillin', 'furaneol', 'cinnamaldehyde', 'citral', 'allicin', 'octenol', 'eucalyptol', 'theobromine', 'carvone', 'glycyrrhizin', 'sanshool', 'carthamin', 'cubeb_oil', 'black_seed_oil', 'quassin', 'alantolactone', 'geraniol', 'beta_ionone', 'ethyl_hexanoate', 'dimethyl_trisulfide', 'caryophyllene', 'coumarin', 'anethole', 'shikimic_acid', 'myristicin', 'sabinene', 'safrole', 'cineole', 'cuminaldehyde', 'fenchone', 'germacrene', 'pinene', 'thymoquinone', 'nigellone', 'paradol', 'picrocrocin', 'safranal', 'sedanolide', 'phenylethanethiol', 'pentylfuran', 'turmerone', 'ocimene', 'cyclic_amp', 'inositol_trisphosphate', 'diacylglycerol', 'cortisol', 'epinephrine', 'endorphin', 'oxytocin', 'vasopressin', 'nadh', 'gtp', 'pyruvate', 'auxin',
          'urushiol', 'juglone', 'piperine', 'gingerol', 'shogaol', 'vitamin_a', 'vitamin_d', 'thiamin', 'riboflavin', 'niacin', 'folate', 'vitamin_b6', 'vitamin_e', 'citric_acid', 'sodium_acetate', 'msg', 'inosinate', 'guanylate', 'ribonucleotides', 'beta_carotene', 'curcumin', 'betanin', 'ponceau_4r', 'red_40', 'yellow_5', 'yellow_6', 'blue_1', 'sorbate', 'benzoate', 'sulfite', 'nitrite', 'trans_fat', 'monoglyceride', 'lecithin', 'sorbitol', 'xylitol', 'aspartame', 'malic_acid', 'salicin', 'gibberellin', 'digoxin', 'lactic_acid', 'acetic_acid', 'lanolin', 'ribose', 'deoxyribose', 'adenine', 'guanine', 'cytosine', 'thymine', 'uracil', 'base_pair', 'phospholipid', 'cholesterol', 'thyroxine', 'ascorbate', 'hydroxyproline', 'porphyrin', 'heme', 'chlorophyll', 'cobalamin', 'retinal', 'selenocysteine', 'fatty_acid', 'iron_sulfur_cluster', 'methanol', 'formaldehyde', 'ethylene', 'phenol', 'tannin', 'glycine', 'alanine', 'serine', 'proline', 'tyrosine', 'aspartic_acid', 'glutamic_acid', 'glutamine', 'asparagine', 'arginine', 'valine', 'leucine', 'isoleucine', 'threonine', 'methionine', 'lysine', 'histidine', 'phenylalanine', 'tryptophan', 'glucose', 'amino_acid', 'cysteine', 'dipeptide', 'nucleotide', 'atp',
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
          'batrachotoxin',
          // poisonous plants batch 1 — alkaloid/cannabinoid toxins and psychoactive
          // compounds, the same molecule scale as digoxin/batrachotoxin above
          'atropine', 'thc', 'cocaine', 'nicotine', 'morphine', 'mescaline', 'psilocybin'],
  '-8':  [
          /* medicine and disease, 3 Sep */
          'vibrio_cholerae',
          'soot',
          /* unblocking-nouns wave, 2 Sep */
          'antitoxin', 'central_dogma', 'epigenetics', 'gene_expression', 'heterozygous', 'homozygous', 'recessive_allele', 'toxin',
          /* completeness-audit wave, 2 Sep */
          'blood_clotting', 'dominant_allele', 'gluten', 'growth_hormone', 'metabolism', 'photosynthesis', 'polymer',
          /* microbio wave, 2 Sep */
          'adhesin', 'anaerobic_respiration', 'antigen', 'antigenic_variation', 'aquaporin', 'bacterial_flagellum', 'beta_lactamase', 'beta_oxidation',
          'bt_toxin', 'calvin_cycle', 'carbon_fixation', 'catabolite_repression', 'cdna', 'cellulase', 'chitin', 'colony_blotting',
          'competitive_inhibition', 'complement_system', 'conjugate_vaccine', 'cytokine', 'denaturation', 'dna_library', 'dna_microarray', 'dna_probe',
          'electroporation', 'endotoxin', 'epitope', 'excision_repair', 'exotoxin', 'f_plasmid', 'fish_probe', 'genomic_island',
          'gfp', 'iga', 'ige', 'igg', 'igm', 'interferon', 'lipopolysaccharide', 'lipoprotein',
          'mhc_class_i', 'mhc_class_ii', 'monoclonal_antibody', 'mrna_vaccine', 'nitrogen_fixation', 'open_reading_frame', 'operator', 'outer_membrane',
          'peptidoglycan', 'phase_variation', 'photoreactivation', 'photosystem_i', 'pilus', 'poly_hydroxybutyrate', 'porin', 'prion',
          'promoter', 'proto_oncogene', 'proton_motive_force', 'r_plasmid', 'replica_plating', 'repressor', 'restriction_modification_system', 'rna_interference',
          'rubisco', 'selectable_marker', 'sigma_factor', 'sos_repair', 'subunit_vaccine', 'teichoic_acid', 'ti_plasmid', 'toll_like_receptor',
          'toxoid', 'transcription_terminator', 'transposon', 'two_component_system', 'virulence_factor',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'actin_filament', 'myosin', 'intermediate_filament', 'integrin', 'muscle_contraction', 'cell_migration', 'g_protein_coupled_receptor', 'receptor_tyrosine_kinase', 'adenylyl_cyclase', 'protein_kinase_a', 'phospholipase_c', 'protein_kinase_c', 'ras_protein', 'mapk_cascade', 'nuclear_receptor', 'sodium_channel', 'potassium_channel', 'amyloid_precursor_protein', 'amyloid_beta', 'tau_protein', 'alpha_synuclein', 'apolipoprotein_e', 'creb', 'hox_gene', 'reverse_transcriptase', 'rna_dependent_rna_polymerase', 'polyprotein', 'hemagglutinin', 'neuraminidase', 'integrase', 'gene_duplication', 'pseudogene', 'quaternary_structure', 'protein_domain', 'actin', 'kinesin', 'dynein', 'motor_protein', 'antibody', 'lysozyme', 'histone', 'nucleosome', 'telomere', 'telomerase', 'mismatch_repair', 'g_protein', 'phosphorylation', 'allosteric_regulation', 'restriction_enzyme', 'cloning_vector', 'recombinant_dna', 'taq_polymerase', 'pcr', 'gel_electrophoresis', 'hybridization', 'southern_blot', 'glycolysis', 'krebs_cycle', 'electron_transport_chain', 'atp_synthase', 'cellular_respiration', 'carbohydrate', 'nucleic_acid', 'operon', 'transcription_factor', 'oncogene', 'genotype',
          'maltodextrin', 'hydrolysed_vegetable_protein', 'carrageenan', 'alginate', 'xanthan_gum', 'gum_arabic', 'gellan_gum', 'arrowroot', 'lignin', 'pectin', 'phytochrome', 'isinglass', 'rna', 'transfer_rna', 'ribosomal_rna', 'ribozyme', 'viroid', 'glycogen', 'triple_helix', 'hemoglobin', 'myoglobin', 'photosystem_ii', 'cytochrome_c_oxidase', 'ferritin', 'zinc_finger', 'carbonic_anhydrase', 'glutathione_peroxidase', 'sulfite_oxidase', 'superoxide_dismutase', 'sodium_potassium_pump', 'rhodopsin', 'cellulose', 'chromatin', 'gene', 'allele', 'tumor_suppressor_gene', 'crispr', 'dna_sequencing', 'microtubule', 'polypeptide', 'protein', 'enzyme', 'collagen', 'keratin', 'membrane',
          // DNA-completeness batch 1 — the replication and expression machinery,
          // same enzyme/process scale as chromatin/gene/enzyme/protein
          'dna_helicase', 'primase', 'dna_polymerase', 'dna_ligase', 'dna_replication',
          'rna_polymerase', 'transcription', 'translation', 'exon', 'intron', 'splicing',
          'denatured_protein', 'starch', 'gelatin', 'ribosome', 'messenger_rna',
          'hyaluronic_acid', 'satellite',
          // cell biology batch 1 — membrane-sheet and DNA-loop scale, the same rack as membrane/chromatin/gene
          'nuclear_envelope', 'endoplasmic_reticulum', 'rough_endoplasmic_reticulum', 'smooth_endoplasmic_reticulum', 'cytoskeleton', 'cell_wall', 'plasmid',
          // poisonous plants batch 1 — a ribosome-inactivating protein, the same
          // protein scale as hemoglobin/enzyme/ferritin above
          'ricin'],
  '-6':  [
          /* verb outcomes batch 1, 4 Sep. a yeast cell, like the other yeasts */
          'lager_yeast',
          'culture_biology', 'stain',
          /* human disease, 4 Sep — the pathogen catalogue's third kingdom */
          'variola', 'sars_cov_2', 'coronavirus', 'ebola_virus', 'marburg_virus', 'lassa_virus', 'nipah_virus', 'hantavirus', 'dengue_virus', 'zika_virus', 'chikungunya_virus', 'hepatitis_b', 'hepatitis_c', 'herpes_simplex', 'varicella_zoster', 'rotavirus', 'mycobacterium_leprae', 'borrelia_burgdorferi', 'shigella', 'candida_albicans', 'aspergillus_fumigatus', 'cryptococcus_neoformans', 'canine_distemper_virus', 'feline_leukaemia_virus',
          /* animal disease, 4 Sep — the pathogen catalogue's second kingdom */
          'foot_and_mouth_virus', 'rinderpest_virus', 'african_swine_fever_virus', 'avian_influenza', 'newcastle_disease_virus', 'bluetongue_virus', 'canine_parvovirus', 'myxoma_virus', 'batrachochytrium', 'white_nose_fungus', 'paenibacillus_larvae', 'nosema', 'theileria', 'babesia',
          /* the pathogen catalogue, 4 Sep — organisms at their own size,
             diseases at the size of the part the symptom appears on */
          'xylella_fastidiosa', 'erwinia_amylovora', 'agrobacterium_tumefaciens', 'pseudomonas_syringae', 'candidatus_liberibacter', 'potato_virus_y', 'barley_yellow_dwarf_virus', 'puccinia_graminis', 'hemileia_vastatrix', 'magnaporthe_oryzae', 'fusarium_oxysporum', 'botrytis_cinerea', 'erysiphe', 'claviceps_purpurea', 'ustilago_maydis', 'venturia_inaequalis', 'ophiostoma_ulmi', 'cryphonectria_parasitica', 'hymenoscyphus_fraxineus', 'rhizoctonia_solani', 'verticillium_dahliae', 'phytophthora_infestans', 'plasmopara_viticola', 'plasmodiophora_brassicae',
          /* inversion fixes, 3 Sep */
          'basidium',
          /* parasites wave, 3 Sep */
          'apical_complex', 'kinetoplast', 'axostyle', 'undulating_membrane', 'hemozoin', 'flagellate', 'sucking_disc', 'polar_plug', 'nurse_cell', 'oncosphere', 'miracidium', 'cercaria', 'metacercaria', 'microfilaria', 'balantidium_coli', 'trypanosoma_brucei', 'trypanosoma_cruzi',
          'chromosomal_aberration',
          /* unblocking-nouns wave, 2 Sep */
          'adaptive_immunity', 'centromere', 'crossing_over', 'genome', 'innate_immunity', 'karyotype', 'opsonization', 'passive_immunity',
          'prokaryote', 'pure_culture', 'sex_chromosome',
          /* completeness-audit wave, 2 Sep */
          'antibiotic_resistance',
          /* microbio wave, 2 Sep */
          'actinomyces_israelii', 'arbovirus', 'ascomycete', 'attenuated_vaccine', 'auxotroph', 'bacillus_anthracis', 'bartonella_henselae', 'bdellovibrio',
          'bioremediation', 'bordetella_pertussis', 'brucella', 'campylobacter', 'capsule', 'chemotaxis', 'chlamydia_bacterium', 'chlamydia_trachomatis',
          'chytrid', 'clostridioides_difficile', 'clostridium', 'clostridium_botulinum', 'clostridium_perfringens', 'clostridium_tetani', 'coccus', 'conjugation',
          'corynebacterium_diphtheriae', 'cyclospora_cayetanensis', 'cytomegalovirus', 'deinococcus_radiodurans', 'denitrification', 'dermatophyte', 'endospore', 'epstein_barr_virus',
          'extreme_halophile', 'extremophile', 'food_spoilage', 'francisella_tularensis', 'gardnerella_vaginalis', 'growth_curve', 'haemophilus_ducreyi', 'halophile',
          'helicobacter_pylori', 'hepatitis_a_virus', 'heterocyst', 'human_herpesvirus_8', 'hyperthermophile', 'inactivated_vaccine', 'indicator_organism', 'iron_bacteria',
          'legionella', 'leptospira_interrogans', 'listeria_monocytogenes', 'measles_virus', 'methanogen', 'microbe', 'mimivirus', 'mrsa',
          'mumps_virus', 'mycobacterium_tuberculosis', 'mycoplasma', 'myxobacteria', 'neisseria_gonorrhoeae', 'nitrification', 'normal_microbiota', 'norovirus',
          'nucleoid', 'oomycete', 'opportunistic_pathogen', 'periplasm', 'peroxisome', 'plaque_assay', 'pneumocystis_jirovecii', 'pseudomonas_aeruginosa',
          'rhinovirus', 'rickettsia', 'rickettsia_rickettsii', 'rubella_virus', 'single_cell_protein', 'spirochete', 'staphylococcus_aureus', 'streptobacillus_moniliformis',
          'streptococcus_pneumoniae', 'streptococcus_pyogenes', 'thermophile', 'thermus_aquaticus', 'transduction', 'treponema_pallidum', 'west_nile_virus', 'yellow_fever_virus',
          'yersinia_pestis', 'zygomycete',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'refractory_period', 'node_of_ranvier', 'saltatory_conduction', 'mechanoreceptor', 'nociceptor', 'golgi_tendon_organ', 'long_term_potentiation', 'meissner_corpuscle', 'neuromuscular_junction', 'chemosynthesis', 'phytoplankton', 'nematocyst', 'endosymbiotic_theory', 'choanoflagellate', 'endophyte', 'frankia', 'pestalotiopsis', 'capsid', 'viral_envelope', 'nucleocapsid', 'tobacco_mosaic_virus', 'baltimore_classification', 'retrovirus', 'bacteriophage_t7', 'bacteriophage_lambda', 'bacteriophage_phix174', 'hiv', 'influenza_virus', 'rabies_virus', 'poliovirus', 'adenovirus', 'herpes_simplex_virus', 'sars_cov', 'human_papillomavirus', 'polyploidy', 'transformation', 'centrosome', 'horizontal_gene_transfer', 'endosymbiosis', 'tonicity', 'turgor_pressure', 'pinocytosis', 'quorum_sensing',
          's_thermophilus', 'l_bulgaricus', 'l_acidophilus', 'bifidobacterium', 'l_paracasei', 'l_plantarum', 'leuconostoc', 'lactococcus', 'acetobacter', 'penicillium', 'stoma', 'virus', 'vesicle', 'protocell', 'binary_fission', 'budding', 'bacteria', 'archaea', 'cyanobacteria', 'rhizobium', 'zooxanthellae', 'mitochondrion', 'chloroplast', 'spore', 'pollen', 'action_potential', 'yeast', 'mould', 'resistance', 'chromosome', 'nucleus', 'mitochondrial_dna',
          // natural history book batch 1 — single-celled protists, same microscopic scale
          'foraminifera', 'radiolarian', 'dinoflagellate', 'diatom_organism', 'euglena', 'paramecium',
          'bacteriophage', 'prophage', 'lysis', 'salmonella', 'streptomyces',
          'avibirnavirus', 'gammacoronavirus', 'e_coli',
          'cowpox', 'vaccine', 'immunity',
          // brain batch 1 — sub-cellular neural structures, same organelle/junction scale as vesicle/nucleus
          'axon', 'dendrite', 'myelin_sheath', 'synapse',
          // cell biology batch 1 — organelle scale, the same rack as mitochondrion/chloroplast/nucleus/vesicle
          'nucleolus', 'golgi_apparatus', 'lysosome', 'vacuole', 'centriole', 'cilia',
          // cell biology batch 1 — membrane-level processes, the same rack as action_potential/binary_fission
          'diffusion', 'osmosis', 'active_transport', 'endocytosis', 'exocytosis', 'phagocytosis'],
  '-5':  [
          /* computing and plants waves, 3 Sep */
          'bit', 'byte', 'hexadecimal', 'pixel',
          /* umbrella waves, 3 Sep */
          'protist', 'torsion',
          /* unblocking-nouns wave, 2 Sep */
          'macrophage', 'neutrophil',
          /* completeness-audit wave, 2 Sep */
          'capillary', 'companion_cell', 'double_fertilization', 'tracheid',
          /* microbio wave, 2 Sep */
          'apicomplexan', 'b_cell', 'clonal_selection', 'cytotoxic_t_cell', 'dendritic_cell', 'helper_t_cell', 'hybridoma', 'leishmania',
          'lymphocyte', 'mast_cell', 'memory_cell', 'naegleria_fowleri', 'natural_killer_cell', 'plasma_cell', 't_cell', 'trypanosoma',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'schwann_cell', 'photoreceptor', 'hair_cell', 'taste_bud', 'motor_neuron', 'amyloid_plaque', 'neurofibrillary_tangle', 'lewy_body', 'olfactory_receptor_neuron', 'purkinje_cell', 'chromatophore', 'eukaryote', 'sexual_reproduction', 'asexual_reproduction', 'apoptosis', 'cell_cycle', 'nondisjunction',
          'photosite',
          'yoghurt_culture', 'cytoplasm', 'alga', 'cell', 'mitosis', 'meiosis', 'sperm', 'polar_body', 'stem_cell', 'protozoan', 'eimeria',
          'plasmodium', 'toxoplasma_gondii', 'giardia', 'entamoeba_histolytica', 'trichomonas_vaginalis', 'cryptosporidium',
          // brain batch 1 — individual nerve and glial cells, same single-cell scale as cell/stem_cell
          'glia', 'astrocyte', 'oligodendrocyte',
          // cell biology batch 1 — whole-cell scale, the same rack as cell/sperm/stem_cell
          'flagella', 'neuron', 'muscle_cell', 'red_blood_cell', 'white_blood_cell', 'guard_cell', 'palisade_cell', 'goblet_cell', 'ciliated_cell'],
  '-4':  [
          /* verb outcomes batch 3, 4 Sep */
          'patina',
          /* places batch 2 — sub-Saharan Africa, 4 Sep. a coating a few micrometres thick */
          'desert_varnish',
          /* animal disease, 4 Sep — the pathogen catalogue's second kingdom */
          'sarcoptes_scabiei', 'mite',
          /* cycle N, from needs.mjs, 4 Sep */
          'phosphor',
          /* cycle F, from needs.mjs, 4 Sep */
          'silica',
          /* common words the corpus never had, 3 Sep */
          'snowflake',
          /* computing and plants waves, 3 Sep */
          'logic_gate', 'not_gate', 'or_gate', 'and_gate', 'nand_gate', 'xor_gate', 'multiplexer', 'flip_flop', 'half_adder', 'adder', 'alu', 'register', 'cache', 'data_bus', 'clock_signal',
          /* completeness-audit wave, 2 Sep */
          'alveolus', 'seasoning',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'sodium_hydroxide', 'potassium_hydroxide', 'calcium_hydroxide', 'silver_nitrate', 'zinc_chloride', 'sodium_carbonate', 'aluminium_sulfate', 'ammonium_phosphate', 'magnesium_phosphate', 'sodium_sulfate', 'ammonium_chloride', 'calcium_nitrate', 'barium_nitrate', 'sodium_phosphate', 'barium_sulfide', 'barium_carbonate', 'silver_phosphate', 'silver_oxide', 'ammonium_bromide', 'calcium_phosphate', 'sodium_chromate', 'potassium_cyanide', 'zinc_phosphate', 'ooid', 'iron_ii_sulfate', 'sodium_chlorate', 'sodium_perchlorate', 'barium_chlorate', 'barium_chlorite', 'phosphorous_acid', 'oxalic_acid', 'boric_acid', 'magnesium_hydroxide', 'barium_hydroxide', 'aluminum_hydroxide', 'ferrous_hydroxide', 'ferric_hydroxide', 'zinc_hydroxide', 'lithium_hydroxide', 'nickel_nitrate', 'sodium_dichromate', 'zinc_iodide', 'aluminum_bromide', 'barium_peroxide', 'sodium_percarbonate', 'sodium_sulfite', 'sodium_thiosulfate', 'potassium_iodate', 'potassium_thiocyanate', 'ferrocyanide', 'potassium_ferrocyanide', 'xenon_difluoride', 'lead_iodide', 'ammonium_iodide', 'ammonium_nitrite', 'nickel_sulfate', 'potassium_sulfite', 'silver_carbonate', 'sodium_amide', 'sodium_nitride', 'sodium_cyanide', 'strontium_nitrate', 'aluminum_fluoride', 'lithium_carbonate', 'lithium_phosphate', 'potassium_chlorate', 'potassium_chromate', 'zinc_sulfate', 'phosphorus_pentachloride', 'potassium_oxide', 'potassium_phosphate', 'silicon_carbide', 'wood_flour', 'cayenne', 'chili_powder', 'potassium_carbonate', 'sodium_oxide', 'zinc_nitrate', 'magnesium_nitrate', 'ammonium_acetate', 'magnesium_sulfate', 'aluminum_phosphate', 'potassium_dichromate', 'zinc_acetate', 'ammonium_sulfate', 'copper_sulfate', 'sodium_nitrate', 'silver_iodide', 'arsenic_trioxide', 'gold_iii_oxide', 'gold_sulfide', 'caraway', 'garlic_powder', 'onion_powder', 'garam_masala', 'curry_powder', 'five_spice', 'berbere', 'ras_el_hanout', 'quatre_epices', 'tabil', 'gomasio', 'jerk_seasoning', 'seven_spices', 'baharat', 'hawaij', 'advieh', 'gingerbread_spice_mix', 'speculaas_spice', 'apple_pie_spice', 'pumpkin_pie_spice', 'poultry_seasoning', 'cajun_seasoning', 'chesapeake_bay_seasoning', 'adobo_seasoning', 'barbecue_seasoning_rub', 'marine_snow', 'microbead', 'synthetic_microfiber', 'tire_wear_particle', 'biofilm',
          'coconut_sugar', 'guar_gum', 'locust_bean_gum', 'silicon_dioxide', 'annatto', 'caramel_colour', 'agar', 'paprika', 'carmine', 'shellac', 'roe', 'hydroxyapatite', 'fluorapatite', 'magnesium_oxide', 'zinc_oxide', 'copper_oxide', 'litharge', 'mercuric_oxide', 'alumina', 'potassium_chloride', 'potassium_iodide', 'sodium_fluoride', 'magnesium_nitride',
          // mining comprehensive batch — bagged/prilled granular chemicals and fine ground mill product,
          // same grain-size bucket as sand/clay
          'ammonium_nitrate', 'anfo', 'concentrate',
          // sandboxels gapfill batch 1 — a crystalline/granular explosive-precursor salt and mixed powder,
          // the same grain-size bucket as ammonium_nitrate/anfo
          'potassium_nitrate', 'gunpowder',
          // textiles batch 1 — a lake pigment, the same rack as carmine
          'rose_madder',
          'beryllium_fluoride', 'beryllium_chloride', 'beryllium_bromide', 'beryllium_iodide', 'magnesium_fluoride', 'magnesium_bromide', 'magnesium_iodide', 'calcium_bromide', 'calcium_iodide', 'strontium_fluoride', 'strontium_bromide', 'strontium_iodide', 'barium_fluoride', 'barium_chloride', 'barium_bromide', 'barium_iodide', 'radium_fluoride', 'radium_chloride', 'radium_bromide', 'radium_iodide',
          'lithium_fluoride', 'lithium_chloride', 'lithium_iodide', 'lithium_nitride', 'lithium_hydride', 'sodium_bromide', 'sodium_iodide', 'potassium_fluoride', 'caesium_chloride', 'iron_chloride', 'silver_chloride', 'xenon_tetrafluoride', 'lithium_oxide', 'sodium_peroxide', 'potassium_superoxide', 'titanium_dioxide', 'chromium_oxide', 'nickel_oxide', 'manganese_dioxide', 'tin_dioxide', 'silver_bromide', 'germanium_dioxide', 'rubidium_superoxide', 'strontium_chloride', 'luminous_paint', 'red_phosphor', 'signal_paint',
          'beryllium_oxide', 'strontium_oxide', 'barium_oxide', 'caesium_superoxide', 'calcium_hydride', 'magnesium_hydride', 'strontium_hydride', 'barium_hydride', 'sodium_hydride', 'potassium_hydride', 'rubidium_hydride', 'caesium_hydride', 'beryllium_nitride', 'calcium_nitride', 'strontium_nitride', 'barium_nitride', 'radium_nitride',
          'phosphorus_sesquisulfide', 'aluminum_chloride', 'aluminum_sulfide', 'copper_chloride', 'magnesium_chloride', 'magnesium_sulfide', 'calcium_chloride', 'sodium_sulfide', 'potassium_sulfide', 'tin_chloride', 'lead_chloride', 'gold_chloride', 'copper_fluoride', 'lithium_bromide', 'potassium_bromide', 'rubidium_fluoride', 'rubidium_chloride', 'rubidium_bromide', 'rubidium_iodide', 'caesium_fluoride', 'caesium_bromide', 'caesium_iodide', 'krypton_difluoride', 'cobalt_chloride', 'chromium_chloride', 'lanthanum_oxide', 'cerium_oxide', 'neodymium_oxide', 'europium_fluoride', 'europium_chloride', 'gadolinium_oxide', 'cosmic_dust', 'dust', 'ovum', 'zygote', 'morula', 'blastocyst', 'gastrula', 'flour', 'sugar', 'salt', 'tapioca', 'cement', 'cement_meal', 'breadcrumb', 'sand',
          'clay', 'malt', 'rubbed_flour', 'ash', 'charcoal', 'mince', 'cured_mince', 'scabies_mite',
          'lenticel', 'root_hair'],
  '-3':  [
          /* animal disease, 4 Sep — the pathogen catalogue's second kingdom */
          'varroa_mite', 'midge',
          /* cycle L, from needs.mjs, 4 Sep */
          'size',
          /* cycle J, from needs.mjs, 4 Sep */
          'dye', 'flux',
          /* cycle H, from needs.mjs, 4 Sep */
          'resistor',
          /* cycle E, from needs.mjs, 3 Sep */
          'film',
          /* cycle D, from needs.mjs, 3 Sep */
          'twist',
          /* medicine, clock and sword, from needs.mjs, 3 Sep */
          'symptom',
          /* parasites wave, 3 Sep */
          'scolex', 'rostellum', 'acetabulum', 'proglottid', 'tegument', 'cuticle', 'buccal_capsule', 'gynecophoral_canal',
          /* crops and materials wave, 2 Sep */
          'amaranth', 'canola', 'chia', 'fonio', 'juniper_berry', 'mung_bean', 'poppy_seed', 'spelt',
          'teff', 'triticale', 'wild_rice',
          /* unblocking-nouns wave, 2 Sep */
          'parasite',
          /* completeness-audit wave, 2 Sep */
          'apical_meristem', 'endosperm', 'gametophyte', 'meristem', 'seed_dormancy', 'spice', 'stratification', 'vascular_bundle',
          /* microbio wave, 2 Sep */
          'golden_rice', 'vector',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'nurdle', 'pine_nut', 'pumpkin_seed', 'anise', 'white_pepper', 'green_peppercorn', 'celery_seed', 'mace', 'sunflower_seed', 'fenugreek', 'herbes_de_provence', 'zaatar', 'dukkah', 'shichimi_togarashi', 'pickling_spice', 'crawfish_boil_spices', 'cubeb', 'myrtle', 'nigella', 'safflower', 'sichuan_pepper', 'capers', 'grains_of_paradise', 'black_cardamom', 'mastic', 'ajwain', 'amchoor', 'grains_of_selim', 'wattle', 'anardana', 'panch_phoran', 'chaat_masala', 'pacinian_corpuscle', 'muscle_spindle', 'zooplankton', 'plankton', 'dermal_denticle', 'otolith', 'copepod', 'amphipod', 'ossicles', 'weathered_plastic_debris', 'primary_microplastic', 'secondary_microplastic', 'microplastic', 'wasp', 'aphid', 'earwig', 'silverfish', 'bristletail', 'mayfly', 'springtail',
          'cumin', 'black_pepper', 'lentil', 'split_pea', 'farro', 'raisin', 'sesame', 'peanut', 'almond', 'lac_insect', 'cochineal', 'pearl', 'kefir_grains', 'koji', 'dew', 'frost', 'hail', 'seed', 'grain', 'rice', 'cooked_rice', 'sushi_rice', 'pilaf', 'legume',
          // super-nature batch 1 — a ~0.5mm tardigrade, same grain scale as seed/tick
          'tardigrade',
          'rye', 'quinoa', 'buckwheat', 'millet', 'sorghum', 'semolina', 'couscous',
          'nutmeg', 'clove', 'cardamom', 'saffron', 'mustard_seed', 'allspice', 'star_anise',
          'nectar', 'spark', 'beeswax', 'straw', 'bee', 'olive', 'grape', 'honey',
          // verb audit fixes batch 1 — dried grass, same bulk scale as straw
          'hay',
          'cane_juice', 'manna', 'granary', 'rutile',
          'ant', 'ladybird', 'termite', 'flea', 'tick',
          'duckweed', 'birds_nest_fungus', 'zombie_ant_fungus',
          'mosquito', 'trichinella_spiralis', 'head_louse', 'body_louse', 'bed_bug',
          'parasitism',
          'root_cap', 'root_meristem', 'elongation_zone'],
  '-2':  [
          /* verb outcomes batch 3, 4 Sep */
          'linseed_oil', 'verdigris',
          /* verb outcomes batch 2, 4 Sep. a temper grain, a sand grain, a chip of ice */
          'grog', 'silica_sand', 'crushed_ice',
          /* places batch 14, 4 Sep. a bar section */
          'wrought_iron',
          /* places batch 4 — Europe, 4 Sep. a hand sample, like the other rocks */
          'rock_salt',
          /* places batch 1, 4 Sep — a mortar joint, on the same rack as mortar */
          'sticky_rice_mortar',
          /* places batch 1 — the Senj worked example, 4 Sep. a hand sample of banded freshwater limestone, like limestone itself */
          'travertine',
          /* the universe closed, 4 Sep */
          'hormone', 'sediment', 'silt', 'vitamin',
          /* head nouns, 4 Sep — R2, the umbrella pass */
          'gland', 'lobe', 'fissure', 'fold', 'helix',
          /* assembly components, 4 Sep — 24 new needs lists asked for these */
          'anode', 'cathode', 'electrode', 'terminal', 'commutator', 'bushing', 'heddle', 'bobbin', 'cam', 'feed_dog', 'tension_disc', 'pivot', 'jewel', 'ring', 'share', 'wedge', 'nozzle', 'flyweight', 'rind', 'signature',
          /* conditions, 4 Sep — scaled to the part that goes wrong */
          'thyroid', 'goitre', 'heart_attack', 'cataract', 'ulcer', 'gout', 'bran',
          /* human disease, 4 Sep — the pathogen catalogue's third kingdom */
          'necator_americanus',
          /* the pathogen catalogue, 4 Sep — organisms at their own size,
             diseases at the size of the part the symptom appears on */
          'potato_blight', 'stem_rust', 'coffee_rust', 'rice_blast', 'grey_mould', 'noble_rot', 'powdery_mildew', 'downy_mildew', 'ergotism', 'corn_smut', 'apple_scab', 'citrus_greening', 'fireblight', 'crown_gall', 'clubroot', 'damping_off', 'verticillium_wilt', 'gangrene', 'dysentery',
          /* the needs loop closed, 4 Sep — the last 58 components */
          'rosin', 'soundpost', 'type', 'horsehair', 'fingerboard', 'palette', 'wafer', 'composing_stick', 'canary', 'tongs', 'damper', 'piano_action', 'headline', 'legend', 'deposit', 'interest', 'credit', 'doping', 'silvering',
          /* cycle N, from needs.mjs, 4 Sep */
          'tuner', 'inductor', 'coil', 'contour',
          /* cycle M, from needs.mjs, 4 Sep */
          'eyepiece', 'mask',
          /* cycle L, from needs.mjs, 4 Sep */
          'glazing_bar', 'cavity_wall_tie', 'sim_card', 'indicator',
          /* cycle K, from needs.mjs, 4 Sep */
          'insole', 'soundhole', 'fragrance', 'brake_pad', 'reflector', 'grease', 'touchscreen',
          /* cycle J, from needs.mjs, 4 Sep */
          'viewfinder', 'focus_ring', 'spine', 'saponification', 'perfume', 'annealing',
          /* cycle I, from needs.mjs, 4 Sep */
          'camshaft', 'wiper', 'fretboard', 'tuning_peg', 'computer_mouse',
          /* cycle H, from needs.mjs, 4 Sep */
          'circuit_board', 'fin', 'mainspring', 'balance_wheel', 'antenna', 'microphone', 'hops',
          /* cycle G, from needs.mjs, 4 Sep */
          'tang', 'guard', 'grip', 'pommel', 'glaze', 'slip',
          /* cycle F, from needs.mjs, 4 Sep */
          'primer', 'sealant', 'latch', 'bolt',
          /* cycle E, from needs.mjs, 3 Sep */
          'spoke', 'tine', 'binding',
          /* cycle D, from needs.mjs, 3 Sep */
          'aperture', 'shutter', 'wick', 'eyelet', 'fret', 'putty',
          /* the vehicle layer, from needs.mjs, 3 Sep */
          'spark_plug', 'foam',
          /* the mechanical layer, from needs.mjs, 3 Sep */
          'bearing',
          /* the house, from tools/needs.mjs, 3 Sep */
          'gravel',
          /* medicine and disease, 3 Sep */
          'vitamin_c',
          /* everyday: the last of them, 3 Sep */
          'charger',
          /* everyday: the desk, 3 Sep */
          'paperclip',
          /* everyday objects: parts and the street, 3 Sep */
          'pigment', 'paint',
          /* computing and plants waves, 3 Sep */
          'switch', 'relay', 'random_access_memory', 'read_only_memory', 'cpu', 'modem', 'carbon_black', 'isoprene', 'polyisoprene', 'resin', 'thorn', 'berry', 'aerenchyma',
          /* parasites wave, 3 Sep */
          'cysticercus', 'hydatid_cyst', 'trichuris_trichiura', 'strongyloides_stercoralis', 'fasciola_hepatica', 'paragonimus_westermani', 'echinococcus_granulosus', 'tsetse_fly', 'sandfly', 'black_fly', 'triatomine_bug',
          /* everyday objects, 3 Sep */
          'screw', 'pen', 'pencil', 'eraser', 'banknote', 'wallet', 'razor', 'tin_can', 'jar', 'mug', 'gear',
          /* additive and metals waves, 3 Sep */
          'indium', 'thallium', 'nihonium', 'flerovium', 'moscovium', 'livermorium', 'praseodymium', 'terbium', 'dysprosium', 'holmium', 'erbium', 'thulium', 'ytterbium', 'lutetium', 'francium', 'einsteinium', 'fermium', 'mendelevium', 'nobelium', 'lawrencium', 'cream_cheese', 'processed_cheese', 'soft_serve', 'carrageen_moss_pudding', 'jelly', 'spherified_pearl', 'dried_apricot', 'instant_mashed_potato', 'sugar_free_gum', 'tabletop_sweetener',
          'organogenesis',
          'grasshopper', 'wild_silk_moth', 'isopod', 'beetle', 'pipefish',
          /* asbestos chain, 2 Sep */ 'asbestos',
          /* crops and materials wave, 2 Sep */
          'alfalfa_sprout', 'aonla', 'boysenberry', 'chilli_pepper', 'currant', 'einkorn', 'elderberry', 'emmer',
          'fava_bean', 'feijoa', 'fiddlehead_fern', 'finger_lime', 'gooseberry', 'hop', 'huckleberry', 'jerusalem_artichoke',
          'jojoba', 'jujube', 'kamut', 'kiwifruit', 'kumquat', 'lingonberry', 'lupin', 'mangosteen',
          'medlar', 'meyer_lemon', 'microgreen', 'mung_bean_sprout', 'napa_cabbage', 'passionfruit', 'peat_moss', 'quince',
          'ramie', 'saskatoon_berry', 'sisal', 'snow_pea', 'sugarsnap_pea', 'water_chestnut',
          /* unblocking-nouns wave, 2 Sep */
          'abscess', 'meteoroid', 'trilobite',
          /* completeness-audit wave, 2 Sep */
          'alkali_metal', 'allotrope', 'angiosperm', 'anther', 'arachnid', 'artery', 'arthropod', 'bronchus',
          'carpel', 'collenchyma', 'connective_tissue', 'corrosion', 'cross_pollination', 'crustacean', 'crystal', 'epithelial_tissue',
          'flower_ovary', 'flower_style', 'geode', 'gravitropism', 'insect', 'larva', 'mesophyll', 'metal',
          'metalloid', 'mineral', 'mollusk', 'muscle_tissue', 'nervous_tissue', 'nonmetal', 'parenchyma', 'petal',
          'pith', 'pollination', 'pollinator', 'sclerenchyma', 'secondary_growth', 'self_pollination', 'semiconductor', 'senescence',
          'sepal', 'stamen', 'stigma', 'thigmotropism', 'vein', 'vernalization', 'wound_healing',
          /* microbio wave, 2 Sep */
          'acid_fast_stain', 'endospore_stain', 'gram_stain', 'negative_stain', 'nematode', 'plant_cuticle', 'plant_epidermis', 'trematode',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'para_dichlorobenzene', 'anhydrite', 'toes', 'watch', 'whistle', 'yoyo', 'bug', 'button', 'cookie', 'cracker', 'cupcake', 'doughnut', 'ear', 'greasepaint', 'sodium_potassium_tartrate', 'hexamine', 'ankle', 'building_block', 'bubble', 'lima_bean', 'black_eyed_pea', 'navy_bean', 'brazil_nut', 'tempeh', 'edamame', 'green_bean', 'falafel', 'zirconia', 'shallot', 'chestnut', 'magnesium_carbonate', 'ligament', 'earring', 'fingernail', 'hair', 'spring', 'slinky', 'sticker', 'postage_stamp', 'tape', 'nose', 'elderflower', 'oyster_leaf', 'paracress', 'yuzu', 'fines_herbes', 'incense', 'tomatillo', 'physalis', 'calamansi', 'key', 'liquorice', 'rose_petal', 'barberry', 'lemon_myrtle', 'dried_lime', 'stirrup', 'cornea', 'lens', 'iris', 'tympanic_membrane', 'olfactory_epithelium', 'bulldog_clamp', 'suture_needle', 'umbilical_cord_clamp', 'krill', 'nudibranch', 'tunicate', 'ampullae_of_lorenzini', 'spiracle', 'gill_raker', 'radula', 'operculum', 'byssus', 'prawn', 'fiddler_crab', 'fossil_mold', 'fossil_cast', 'index_fossil', 'sclerochronology', 'amniotic_egg', 'canine_tooth', 'molar', 'incisor', 'opposable_thumb', 'coprolite', 'peppered_moth', 'ventifact', 'phototropism',
          // mining comprehensive batch — broken/loose rock and small cast metal, hand-sample scale
          // alongside ore/stone/ballast/diamond/coin
          'run_of_mine', 'waste_rock', 'assay', 'dore',
          // verb audit fixes batch 1 — crushed glass aggregate, same hand-sample scale
          'cullet',
          // meteorite-impact batch 1 — hand-sample-scale fallen rock and impact
          // glass, same rack as stone/quartz/kunzite
          'meteorite', 'tektite', 'moldavite', 'australite',
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
          // early-people batch 1 — a ground earth pigment, the same hand-sample scale as hematite/pyrite
          'ochre',
          'pyrite', 'hematite', 'magnetite', 'graphite', 'calcite', 'malachite', 'azurite', 'gypsum', 'olivine', 'garnet', 'beryl', 'aquamarine', 'serpentine',
          'bauxite', 'spodumene', 'bastnasite',
          // gemstones batch 1 — hand-sample mineral specimens, the same rack as
          // quartz/corundum/ruby/garnet/beryl above
          'pyrope', 'spessartine', 'grossular', 'andradite', 'uvarovite',
          'heliodor', 'morganite', 'red_beryl',
          'amethyst', 'citrine', 'rose_quartz', 'smoky_quartz', 'aventurine_quartz', 'tigers_eye', 'rutilated_quartz',
          'chalcedony', 'agate', 'carnelian', 'jasper', 'chrysoprase', 'bloodstone', 'moss_agate', 'petrified_wood',
          'tourmaline', 'schorl', 'dravite', 'rubellite', 'indicolite', 'watermelon_tourmaline',
          'padparadscha', 'spinel', 'sodalite', 'hauyne', 'lapis_lazuli', 'scapolite', 'zircon', 'vesuvianite',
          'taaffeite', 'benitoite', 'topaz', 'chrysoberyl', 'alexandrite', 'cymophane',
          'andalusite', 'chiastolite', 'sillimanite', 'kyanite', 'enstatite', 'hypersthene',
          'iolite', 'peridot', 'sinhalite', 'kunzite', 'hiddenite',
          'zoisite', 'tanzanite', 'thulite', 'moonstone', 'labradorite', 'albite', 'sunstone', 'amazonite',
          'jadeite', 'nephrite', 'chrysocolla', 'dioptase',
          'dolomite', 'aragonite', 'rhodochrosite', 'rhodonite', 'smithsonite', 'cerussite', 'anglesite', 'celestine',
          'titanite', 'epidote', 'staurolite',
          'danburite', 'datolite', 'axinite', 'dumortierite', 'prehnite', 'petalite', 'euclase',
          'brazilianite', 'beryllonite', 'amblygonite', 'phosphophyllite', 'hambergite',
          'scheelite', 'cassiterite', 'jet', 'amber', 'tortoiseshell',
          'iron', 'copper', 'gold', 'silver', 'tin', 'lead', 'zinc', 'mercury', 'aluminum', 'nickel', 'chromium', 'titanium', 'platinum', 'uranium', 'magnesium', 'calcium', 'sodium', 'potassium', 'enriched_uranium',
          // sandboxels gapfill batch 1 — a hand-sample metal ingot, the same rack as tin/mercury/aluminum
          'gallium',
          'neptunium', 'americium', 'curium', 'berkelium', 'californium', 'protactinium', 'actinium', 'technetium', 'astatine', 'rutherfordium', 'dubnium', 'seaborgium', 'bohrium', 'hassium', 'meitnerium', 'darmstadtium', 'roentgenium', 'copernicium',
          'movable_type', 'vacuum_tube', 'integrated_circuit', 'microprocessor',
          'bioluminescent_fungus', 'truffle', 'dead_mans_fingers', 'witchs_butter',
          'lard', 'wool', 'embryo', 'parthenogenesis', 'cotton', 'popcorn', 'soybean', 'tofu', 'pea', 'lemon', 'strawberry', 'pear', 'cherry', 'fig', 'coffee', 'cocoa_bean', 'chocolate', 'stone', 'flint', 'limestone', 'ice', 'brick', 'adobe', 'mortar', 'candle', 'coccidiosis',
          // sandboxels gapfill batch 1 — a frozen block and a cast/pressed explosive charge,
          // the same hand-sample bucket as ice/candle
          'dry_ice', 'tnt', 'dynamite',
          'infectious_bursal_disease', 'infectious_bronchitis', 'colibacillosis', 'ascaridiasis',
          'ore', 'cinnabar', 'yellowcake', 'quicklime', 'oak_gall', 'thread', 'fibre', 'ink', 'mirror',
          // textiles batch 1 — a wisp of prepared fibre, the same rack as wool/thread/fibre
          'carded_wool',
          'soap', 'lye', 'butter', 'ghee', 'curd', 'cheese', 'aged_cheese',
          'mozzarella', 'cheddar', 'parmesan', 'feta', 'cottage_cheese', 'custard',
          'blue_cheese', 'egg', 'boiled_egg', 'golden_egg', 'apple', 'tomato',
          'onion', 'garlic', 'bulb', 'potato', 'cassava', 'chilli', 'meatball', 'sausage',
          'bacon', 'chips', 'leaf', 'flower', 'root', 'herb', 'sprout', 'seedling',
          // trees/plants batch 1 — tree-anatomy structures and a growth stage, same
          // small-scale rack as leaf/seedling
          'cambium', 'sapwood', 'heartwood', 'abscission', 'samara', 'catkin',
          'rootstock', 'scion', 'chill_hours', 'cone', 'deciduous', 'conifer',
          'gymnosperm', 'sapling',
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
          // sandboxels gapfill batch 1 — a hand-scale insect, and a shelled gastropod, the same rack as
          // butterfly/cockroach and snail
          'housefly', 'garden_snail',
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
  '-1':  [
          /* blow and smother batch 1, 5 Sep */
          'ember',
          /* places batch 22, 4 Sep */
          'shingle',
          /* places batch 20, 4 Sep */
          'pietra_dura',
          /* needs closure, 4 Sep */
          'balance', 'quenching_trough',
          /* places batch 19, 4 Sep */
          'shicra',
          /* verb outcomes batch 2, 4 Sep. a struck flake, centimetres */
          'conchoidal_flake',
          /* verb outcomes batch 1, 4 Sep. a jar */
          'crystallised_honey',
          /* verb outcomes batch 1, 4 Sep. a pod and a crumb */
          'dried_chilli', /* places batch 6c, 4 Sep — a cut block of sod */
          'turf',
          /* places batch 6, 4 Sep. a tile */
          'tilework',
          'molten_gold', 'molten_bronze',
          'microscope', 'missile',
          /* words that came back with nothing, 4 Sep */
          'molasses', 'rum', 'cologne', 'currency', 'banknote_pound', 'dollar',
          /* assembly components, 4 Sep — 24 new needs lists asked for these */
          'electrolyte', 'casing', 'armature', 'insulator', 'loudspeaker', 'shuttle', 'gimbal', 'filter', 'governor',
          /* human disease, 4 Sep — the pathogen catalogue's third kingdom */
          'schistosoma_mansoni',
          /* animal disease, 4 Sep — the pathogen catalogue's second kingdom */
          'dirofilaria_immitis',
          /* cycle N, from needs.mjs, 4 Sep */
          'transmitter', 'receiver', 'pickaxe', 'winch', 'screen',
          /* cycle M, from needs.mjs, 4 Sep */
          'stained_glass', 'altar', 'millstone', 'anchor', 'tube',
          /* cycle L, from needs.mjs, 4 Sep */
          'body_panel', 'fork_garden', 'damp_proof_course', 'roofing_felt', 'socket', 'hand', 'soundboard',
          /* cycle K, from needs.mjs, 4 Sep */
          'altimeter', 'last', 'pruning_shears', 'fuse_box',
          /* cycle J, from needs.mjs, 4 Sep */
          'leg', 'backrest', 'upholstery', 'cover', 'page', 'rag',
          /* cycle I, from needs.mjs, 4 Sep */
          'carburettor', 'starter_motor', 'brake_disc', 'shock_absorber', 'windscreen', 'seatbelt', 'muffler', 'motherboard', 'hard_drive', 'power_supply',
          /* cycle H, from needs.mjs, 4 Sep */
          'fan', 'case', 'heat_sink', 'hoe', 'watering_can', 'mash',
          /* cycle G, from needs.mjs, 4 Sep */
          'whetstone', 'quenching', 'firing', 'stud', 'door_frame', 'window_frame',
          /* cycle F, from needs.mjs, 4 Sep */
          'roof_tile', 'flashing', 'render', 'screed', 'underlay', 'block', 'sill', 'pane',
          /* cycle E, from needs.mjs, 3 Sep */
          'rim', 'hub', 'inner_tube', 'sprocket', 'pedal', 'handlebar', 'trowel', 'blowpipe',
          /* cycle D, from needs.mjs, 3 Sep */
          'wax', 'sole', 'heel', 'lace', 'cord', 'varnish', 'soda_ash',
          /* medicine, clock and sword, from needs.mjs, 3 Sep */
          'syringe', 'suture', 'bandage', 'wound', 'forceps', 'anaesthetic', 'escapement', 'hilt', 'scabbard', 'diagnosis',
          /* the vehicle layer, from needs.mjs, 3 Sep */
          'petrol', 'dial', 'speedometer', 'headlight',
          /* the mechanical layer, from needs.mjs, 3 Sep */
          'cylinder', 'crank', 'fulcrum', 'rod', 'valve', 'brake',
          /* the house, from tools/needs.mjs, 3 Sep */
          'plaster', 'mortar_lime', 'insulation', 'hinge',
          /* common words the corpus never had, 3 Sep */
          'kite', 'whisky', 'sushi', 'seaweed',
          /* everyday: the last of them, 3 Sep */
          'laptop', 'printer', 'monitor', 'speaker', 'headphones', 'purse', 'coat', 'jacket',
          /* everyday: tools, furniture, 3 Sep */
          'pliers', 'sandpaper', 'spirit_level', 'clamp', 'crowbar', 'pillow',
          /* everyday: the desk, 3 Sep */
          'clock', 'cardboard', 'ruler', 'stapler', 'notebook', 'rubber_stamp', 'highlighter', 'folder', 'binder',
          /* everyday: kitchen tools, 3 Sep */
          'saucepan', 'colander', 'sieve', 'whisk', 'grater', 'peeler', 'chopping_board', 'corkscrew', 'ladle', 'spatula', 'rolling_pin',
          /* everyday objects: parts and the street, 3 Sep */
          'blade', 'handle', 'drain', 'kerb', 'manhole',
          /* computing and plants waves, 3 Sep */
          'keyboard', 'punched_card', 'compiler', 'web_browser', 'server', 'ethernet', 'synthetic_rubber', 'tire',
          /* parasites wave, 3 Sep */
          'dracunculus_medinensis', 'onchocerca_volvulus', 'diphyllobothrium_latum',
          /* everyday objects, 3 Sep */
          'screwdriver', 'wrench', 'saw', 'axe', 'shovel', 'drill', 'tape_measure', 'scissors', 'plate', 'kettle', 'toaster', 'blender', 'basket', 'tap', 'lock', 'map', 'newspaper', 'shirt', 'trousers', 'carpet',
          /* umbrella waves, 3 Sep */
          'gastropod', 'cephalopod', 'bivalve', 'clam', 'squid', 'jellyfish', 'worm', 'flatworm', 'eggshell', 'carapace',
          /* additive and metals waves, 3 Sep */
          'gluten_free_bread', 'oat_milk', 'coffee_creamer', 'strawberry_yoghurt', 'cola', 'diet_soda', 'cordial', 'sweet_wine', 'yellow_mustard', 'corned_beef', 'surimi', 'shortening', 'whitfields_ointment', 'canned_heat',
          'tobacco_smoke',
          'mongoose', 'junglefowl', 'mallard', 'mackerel', 'myriapod', 'scorpionfish', 'lagomorph',
          /* crops and materials wave, 2 Sep */
          'abaca', 'acorn_squash', 'bamboo_shoot', 'blood_orange', 'bok_choy', 'canaigre_dock', 'chaya', 'chayote',
          'cherimoya', 'clover', 'coir', 'collard_green', 'daikon_radish', 'endive', 'fennel_bulb', 'honeydew_melon',
          'horseradish', 'jicama', 'jute', 'kenaf', 'kohlrabi', 'komatsuna', 'lotus_root', 'malabar_spinach',
          'mustard_green', 'new_zealand_spinach', 'parsnip', 'pawpaw', 'peppermint_crop', 'portobello_mushroom', 'radicchio', 'rutabaga',
          'saffron_crocus', 'samphire', 'sea_kale', 'spaghetti_squash', 'spanish_moss', 'spearmint_crop', 'sweetcorn', 'swiss_chard',
          'taro', 'tatsoi', 'turmeric_crop', 'woad', 'yam', 'yardlong_bean',
          /* unblocking-nouns wave, 2 Sep */
          'bone_marrow', 'cappuccino', 'cauldron', 'latte', 'marinara', 'masala_chai', 'mole_sauce', 'pesto',
          'petri_dish', 'phonograph_record', 'pus', 'qwerty', 'seismograph', 'thymus', 'wireless_telegraphy',
          /* completeness-audit wave, 2 Sep */
          'abacus', 'acid', 'adrenal_gland', 'alloy', 'alphabet', 'alternation_of_generations', 'amalgam', 'amphibian',
          'animal', 'annelid', 'arabic_script', 'base', 'bile', 'binary_code', 'braising', 'brewing',
          'caramelization', 'ceramic', 'chinese_characters', 'chordate', 'cnidarian', 'colloid', 'combustion', 'composite_material',
          'condiment', 'culture_medium', 'curing', 'cyrillic', 'dairy', 'devanagari', 'digestion', 'distillation',
          'diurnal', 'echinoderm', 'electricity', 'emulsion', 'epiphyte', 'esophagus', 'evaporation', 'femur',
          'flamethrower', 'food_drying', 'frog', 'gallbladder', 'galvanization', 'geez_script', 'gestation', 'gospel',
          'gravy', 'greek_alphabet', 'hadith', 'halogen', 'halophyte', 'hangul', 'interchangeable_parts', 'invertebrate',
          'joint', 'kana', 'kidney', 'latin_alphabet', 'leavening', 'liver', 'maillard_reaction', 'mammal',
          'mixture', 'musical_notation', 'noble_gas', 'nocturnal', 'nucleus_accumbens', 'organ', 'ovary', 'ph',
          'phoenix', 'pickling_process', 'pineal_gland', 'placenta', 'plastic', 'punnett_square', 'reptile', 'rib',
          'rodent', 'roux', 'sauce', 'script', 'scripture', 'searing', 'seed_dispersal', 'skull',
          'smoking_process', 'solution', 'sound', 'sporophyte', 'succulent', 'testis', 'thyroid_gland', 'trachea',
          'transpiration', 'uterus', 'vegetable', 'venom', 'vertebrate', 'vulcanization', 'writing_system', 'xerophyte',
          /* microbio wave, 2 Sep */
          'antiseptic', 'basidiomycete', 'bergeys_manual', 'buffer', 'dermis', 'disinfectant', 'elisa', 'epidermis',
          'fluorescence_microscope', 'fomite', 'food_irradiation', 'germicidal_uv', 'hepa_filter', 'light_microscope', 'lymph_node', 'pasteurization',
          'phase_contrast_microscope', 'phylogenetic_tree', 'sake', 'spleen', 'tampon', 'transgenic_plant', 'urethra', 'vagina',
          'wastewater',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'oxo_degradable_plastic', 'hydrogen_peroxide', 'hydrochloric_acid', 'carbon_tetrachloride', 'ammonium_bicarbonate', 'phosphoric_acid', 'potassium_bicarbonate', 'potassium_hypochlorite', 'necktie', 'toilet_paper', 'saliva', 'tongue', 'bristle', 'toothbrush', 'toy', 'towel', 'triangle', 'tricycle', 'stomach', 'umbrella', 'underwear', 'toy_wagon', 'washcloth', 'zipper', 'perchloric_acid', 'ammonium_hydroxide', 'hydroiodic_acid', 'formic_acid', 'hydrofluoric_acid', 'hydrocyanic_acid', 'polystyrene', 'tetrachloroethylene', 'cd', 'cereal', 'circle', 'comb', 'crayon', 'crown', 'cup', 'curtain', 'diaper', 'dress', 'drum', 'acetone', 'polycarbonate', 'ethylene_glycol', 'bleach', 'hypobromous_acid', 'hydrazine', 'sodium_silicate', 'chromic_acid', 'methyl_acetate', 'hexane', 'potassium_bitartrate', 'arm', 'baby', 'bag', 'bagel', 'backpack', 'balloon', 'ball', 'baseball_bat', 'bathtub', 'belt', 'bird', 'blanket', 'boot', 'bowl', 'broom', 'brush', 'bucket', 'almond_butter', 'marzipan', 'soy_milk', 'refried_beans', 'dal', 'hoppin_john', 'baked_beans', 'propylene', 'butadiene', 'acrylonitrile', 'nitrile_rubber', 'chloromethane', 'dimethyldichlorosilane', 'silicone', 'aniline', 'isocyanate', 'polyol', 'polyurethane', 'inconel_625', 'borosilicate_glass', 'polyacrylonitrile', 'carbon_fiber', 'epichlorohydrin', 'epoxy_resin', 'cfrp', 'glass_fiber', 'gfrp', 'wood_plastic_composite', 'pom_acetal', 'pps', 'epdm', 'chervil', 'lemongrass', 'savory', 'scallion', 'garlic_chives', 'balsamic_vinegar', 'sesame_oil', 'steak_sauce', 'relish', 'bouquet_garni', 'marinade', 'chloroform', 'chlorodifluoromethane', 'tetrafluoroethylene', 'ptfe', 'hexafluoropropylene', 'pfa', 'fkm', 'ethylidene_chloride', 'trichloroethane_111', 'chlorodifluoroethane', 'vinylidene_fluoride', 'pvdf', 'cfc_113', 'chlorotrifluoroethylene', 'ectfe', 'ethylene_dichloride', 'vinyl_chloride', 'pvc', 'ldpe', 'uhmwpe', 'pp', 'butane', 'polybutadiene', 'styrene_acrylonitrile', 'abs', 'xylene', 'terephthalic_acid', 'pet', 'hydroquinone', 'nitrobenzene', 'fluoroboric_acid', 'benzenediazonium_chloride', 'benzenediazonium_tetrafluoroborate', 'fluorobenzene', 'difluorobenzophenone', 'peek', 'cyclohexanone', 'hydroxylamine', 'cyclohexanone_oxime', 'caprolactam', 'nylon_6', 'phthalic_anhydride', 'methyl_ethyl_ketone', 'trichloroacetic_acid', 'acetonitrile', 'propane', 'pentane', 'octane', 'benzene', 'hydrobromic_acid', 'iodic_acid', 'turpentine', 'wire', 'battery', 'skin', 'elbow', 'envelope', 'eye', 'finger', 'flashlight', 'fork', 'garbage_can', 'glasses', 'glove', 'glue', 'hanger', 'hat', 'head', 'hoop', 'hose', 'sock', 'carbonated_water', 'soda', 'spider_web', 'spoon', 'squirrel', 'stick', 'stool', 'string', 'suitcase', 'sunglasses', 'sweater', 'swimsuit', 'teapot', 'olfactory_nerve', 'optic_nerve', 'trigeminal_nerve', 'vestibulocochlear_nerve', 'vagus_nerve', 'accessory_nerve', 'hypoglossal_nerve', 'durian', 'lavender', 'wakame', 'celeriac', 'pulque', 'tequila', 'cognac', 'cassia', 'galangal', 'harissa', 'chermoula', 'thai_curry_paste', 'achiote_paste', 'zhoug', 'enuma_elish', 'book_of_the_dead', 'bhagavad_gita', 'vedas', 'upanishads', 'torah', 'talmud', 'tanakh', 'quran', 'bible', 'guru_granth_sahib', 'elecampane', 'licorice', 'quassia', 'java_galangal', 'asafoetida', 'yerba_mate', 'bergamot', 'jasmine', 'plantain', 'butternut_squash', 'nasturtium', 'perilla', 'absinthe_wormwood', 'doenjang', 'gochujang', 'cuneiform', 'oracle_bone', 'phoenician_alphabet', 'chain', 'pandoras_box', 'golden_fleece', 'katana', 'gilgamesh', 'egyptian_hittite_treaty', 'domesday_book', 'magna_carta', 'kanban', 'composite_bow', 'greek_fire', 'flintlock_musket', 'ak47', 'poison_gas', 'retina', 'oculomotor_nerve', 'cochlea', 'vestibular_system', 'glossopharyngeal_nerve', 'basal_ganglia', 'substantia_nigra', 'wernicke_area', 'broca_area', 'sword', 'dagger', 'misericorde', 'longsword', 'gambeson', 'chain_mail', 'shield', 'kite_shield', 'plate_armor', 'war_hammer', 'war_mace', 'flail', 'crossbow', 'longbow', 'katar', 'kris', 'shotel', 'takouba', 'tulwar', 'flyssa', 'iklwa', 'shamshir', 'yataghan', 'repeating_crossbow', 'sling', 'macuahuitl', 'vexillum', 'saltire', 'oriflamme', 'ensign', 'tricolour', 'union_flag', 'dannebrog', 'flag_norway', 'flag_sweden', 'flag_finland', 'flag_iceland', 'flag_germany', 'flag_poland', 'flag_argentina', 'flag_uruguay', 'flag_brazil', 'flag_chile', 'wiphala', 'flag_venezuela', 'flag_costa_rica', 'flag_el_salvador', 'flag_panama', 'flag_jamaica', 'flag_cuba', 'flag_mexico', 'flag_canada', 'flag_united_states', 'gladius', 'lorica_segmentata', 'chainmail', 'rapier', 'scimitar', 'javelin_missile', 'tow_missile', 'hellfire_missile', 'm16_rifle', 'm4_carbine', 'm249_saw', 'm2_browning', 'allis_forceps', 'aplysia', 'bone_rongeur', 'deaver_retractor', 'debakey_forceps', 'dermatome', 'dilator', 'ear_syringe', 'gigli_saw', 'hemostat', 'laryngoscope', 'lateral_geniculate_nucleus', 'locus_coeruleus', 'magill_forceps', 'mouth_gag', 'needle_holder', 'olfactory_bulb', 'optic_chiasm', 'otoscope', 'periaqueductal_gray', 'raphe_nuclei', 'rectal_speculum', 'scalpel', 'spinothalamic_tract', 'striatum', 'suction_tube', 'surgical_scissors', 'tenaculum_forceps', 'thumb_forceps', 'trocar', 'tuning_fork', 'vaginal_speculum', 'ventral_tegmental_area', 'osmoregulation', 'countershading', 'bioluminescence', 'pinniped', 'sea_lion', 'seal', 'claspers', 'siphon', 'ink_sac', 'blowhole', 'melon', 'fluke', 'porpoise', 'crayfish', 'spiny_lobster', 'giant_isopod', 'molt', 'matchlock', 'wheellock', 'flintlock', 'arquebus', 'musket', 'pistol', 'flanged_mace', 'gauntlet', 'proof_armor', 'sallet', 'barbute', 'armet', 'close_helmet', 'burgonet', 'morion', 'katzbalger', 'schiavona', 'smallsword', 'main_gauche', 'plug_bayonet', 'socket_bayonet', 'jaw', 'lobe_finned_fish', 'tiktaalik', 'acanthostega', 'ichthyostega', 'tetrapod', 'amniote', 'synapsid', 'sauropsid', 'therapsid', 'cynodont', 'endothermy', 'bat', 'diaphragm', 'reticulum', 'omasum', 'abomasum', 'blubber', 'hibernation', 'lanternfish', 'hatchetfish', 'sinosauropteryx', 'heterodontosaurus', 'arandaspis', 'sacabambaspis', 'astraspis', 'cephalaspis', 'pteraspis', 'birkenia', 'conodont', 'placoderm', 'bothriolepis', 'coccosteus', 'climatius', 'cheirolepis', 'osteolepis', 'hagfish', 'lamprey', 'neoceratodus', 'morganucodon', 'monotreme', 'multituberculate', 'marsupial', 'placental', 'solenodon', 'laotian_rock_rat', 'indri', 'mountain_pygmy_possum', 'numbat', 'moth', 'stick_insect', 'exoskeleton', 'compound_eye', 'tracheal_system', 'insect_spiracle', 'hemolymph', 'malpighian_tubule', 'ecdysis', 'complete_metamorphosis', 'incomplete_metamorphosis', 'imaginal_disc', 'darwins_finches', 'rhizosphere', 'microbiome', 'probiotic', 'chewing_gum', 'single_use_plastic', 'ghost_net', 'photodegradation', 'plastic_recycling', 'pyrolysis', 'bioplastic', 'incineration', 'mul_apin', 'scale', 'big_dipper', 'gnomon', 'sundial', 'water_clock', 'armillary_sphere', 'antikythera_mechanism', 'astrolabe', 'merkhet', 'frost_heave', 'laterite', 'podzol', 'chernozem', 'gley_soil', 'black_cotton_soil', 'sextant', 'flag_of_netherlands', 'flag_of_ireland', 'flag_of_switzerland', 'flag_of_austria', 'flag_of_greece', 'flag_of_turkiye', 'flag_of_israel', 'flag_of_lebanon', 'flag_of_saudi_arabia', 'flag_of_iran', 'flag_of_japan', 'flag_of_south_korea', 'flag_of_china', 'flag_of_indonesia', 'flag_of_australia', 'flag_of_new_zealand', 'flag_of_papua_new_guinea',
          // mining comprehensive batch — a printed/tablet map or report, a drummed industrial liquid,
          // and cast metal sheet/ingot, same item scale as paper/sulfuric_acid/steel
          'geological_mapping', 'target_generation', 'feasibility_study', 'overburden',
          'nitric_acid', 'cyanide', 'matte', 'blister_copper', 'copper_cathode',
          'venus_flytrap', 'nepenthes', 'mistletoe', 'water_lily', 'orchid',
          'eagle', 'fifth_sun', 'popol_vuh',
          // egyptian gods batch 2 — a large raptor, same wingspan scale as eagle
          'griffon_vulture',
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
          'mango', 'ginger', 'rhizome', 'celery',
          // trees/plants batch 1 — hand-scale tropical fruits, same rack as mango
          'breadfruit', 'jackfruit', 'lychee', 'rambutan', 'longan', 'tamarind',
          'dragon_fruit', 'starfruit', 'soursop', 'akee', 'curry_leaf', 'marjoram', 'parsley', 'sage', 'rosemary', 'basil', 'thyme', 'mint', 'tarragon', 'dill', 'coriander', 'chives', 'bay_leaf', 'oregano', 'sunflower', 'oil', 'soy_sauce', 'fish_sauce', 'nuoc_cham', 'lithium_graphite', 'stainless_steel', 'beryllium_copper', 'niobium_titanium', 'rose_gold', 'hard_lead', 'titanium_alloy', 'galvanized_iron', 'gold_amalgam', 'dental_amalgam', 'neon_light', 'ferrovanadium', 'nicad_battery', 'lithium_ion_battery', 'platinum_rhodium_gauze', 'platinum_iridium', 'hardened_platinum', 'tungsten_rhenium', 'rocket_nozzle_alloy', 'scandium_aluminum_alloy', 'gas_mantle', 'neodymium_magnet', 'samarium_cobalt_magnet', 'gadolinium_steel',
          'carbon_disulfide', 'disulfur_dichloride', 'phosphorus_trichloride', 'titanium_chloride', 'aluminum_copper_alloy', 'magnalium', 'nak_alloy', 'tin_silver_solder', 'beef', 'pork', 'mutton', 'venison', 'poultry', 'game', 'aged_beef', 'ham', 'stew', 'turmeric', 'carob', 'red_alga', 'green_alga', 'hydrogenated_oil', 'sap', 'bark', 'cork', 'xylem', 'phloem', 'coconut', 'coconut_water', 'sugar_beet', 'mulberry', 'graft', 'hardwood', 'softwood', 'tallow', 'horn', 'antler', 'feather', 'down', 'oyster', 'swim_bladder', 'ambergris', 'baleen', 'manure', 'parchment', 'ivory', 'royal_jelly', 'rennet', 'whey', 'ricotta', 'starter_culture', 'pasteurised_milk', 'souring_kraut', 'kefir', 'buttermilk', 'miso', 'camembert', 'tuber', 'cutting', 'runner', 'obsidian', 'pumice', 'lignite', 'anthracite', 'marble', 'slate', 'magnet', 'copper_wire', 'voltaic_pile', 'electromagnet', 'heating_element', 'light_bulb', 'ipod', 'nike_plus_sensor', 'midsole_foam', 'athletic_shoe', 'polarizer', 'dvd_player', 'magnetic_tape', 'vhs', 'magnetron', 'scanner', 'barcode_scanner', 'wii_remote', 'digital_camera', 'sulfuric_acid',
          // sandboxels gapfill batch 1 — poured/drummed industrial liquids, the same item scale as sulfuric_acid
          'glycerol', 'toluene', 'nitroglycerin', 'liquid_hydrogen', 'liquid_nitrogen',
          'lead_acid_cell', 'electrolysis', 'electroplating', 'solar_cell', 'fungus', 'lichen', 'mycelium', 'mycorrhiza', 'root_nodule', 'polyp', 'coral', 'bleached_coral', 'earthworm', 'ascaridia_galli', 'detritus', 'humus', 'compost', 'rumen', 'pancreas',
          // flagship-animal-anatomy batch 1 — external/organ body parts, same rack as horn/antler/rumen/pancreas
          'mane', 'ossicone', 'shoulder_hump', 'pouch', 'hoof', 'trunk', 'cecum',
          // large-intestine batch 1 — organ-scale body parts and gut-physiology concepts, same rack
          // as cecum/rumen/pancreas above and mutualism/decomposer below
          'large_intestine', 'colon', 'haustra', 'rectum', 'appendix', 'peristalsis', 'gut_flora',
          // early-people batch 1 — hand-worked stone and wooden tools, the same rack as knife/rope/horn/antler
          'oldowan_tool', 'acheulean_handaxe', 'fire_drill', 'bow_drill', 'venus_figurine', 'atlatl',
          'current', 'magnetic_field', 'barometer',
          // weather batch 2 — hand-scale weather instruments, same rack as barometer
          'anemometer', 'rain_gauge', 'weather_vane', 'hygrometer',
          'pendulum_clock', 'sewing_machine', 'telegraph', 'telephone', 'radio', 'phonograph', 'x_ray', 'camera_obscura', 'photographic_plate', 'photograph', 'ether', 'typewriter', 'steel', 'bronze', 'brass', 'hide', 'leather', 'latex', 'rubber', 'vulcanised_rubber', 'canvas', 'silk', 'silkworm', 'cocoon', 'knife', 'rope', 'wheel', 'lamp', 'shoe', 'pipe', 'coal',
          // philosophy batch 1 — small hand-scale objects
          'box', 'veil',
          // big idea science batch 1 — a light form and a branching burn scar, same rack as x_ray/fulgurite
          'ultraviolet', 'lichtenberg_figure',
          // careers batch 1 — real hand tools, the same rack as knife/rope
          'chisel', 'stethoscope', 'dental_drill', 'compass', 'fire_hose', 'chalk',
          // cutaways batch 1 — small hand-scale parts
          'control_rod', 'heat_shield_tile', 'swashplate', 'rivet',
          // great inventors batch 1 — hand-scale devices and materials
          'bitumen', 'crankshaft', 'thermostat', 'bifocals', 'centrifugal_governor',
          'heliography', 'antiseptic_dressing', 'blasting_cap', 'metal_detector',
          'tesla_coil', 'mercaptopurine',
          // big idea science batch 1 — hand-sample-scale mineral/material specimens
          'fluorescent_mineral', 'aerogel',
          // seven wonders batch 1 — gold-and-ivory sculpting technique, a material not a structure
          'chryselephantine',
          // textiles batch 1 — hand tools, prepared crops and finished fabric, the same rack as knife/cloth/silk
          'wool_card', 'felt', 'spindle', 'flying_shuttle', 'knitting_needles', 'knitted_fabric', 'indigo', 'madder', 'dyed_cloth', 'coal_tar', 'wood_tar', 'ethanol', 'bakelite', 'polyethylene', 'snow', 'smoke', 'ozone', 'air', 'loess', 'fulgurite', 'bone_char', 'bottle', 'blackware', 'stockfish', 'chlorine', 'fluorine', 'bromine', 'argon', 'krypton', 'xenon', 'noble_mix', 'kelp', 'book', 'fetus', 'maize', 'barley', 'oat', 'carrot', 'lettuce', 'pumpkin', 'beet', 'banana', 'brewed_coffee', 'cocoa', 'duck', 'turkey', 'koala', 'platypus', 'lizard', 'turtle', 'cloth', 'clothing', 'paper', 'pulp', 'flax', 'water', 'mud', 'soil', 'tempered_clay', 'concrete', 'fire', 'steam',
          // mining value chains batch 2 — belt material and waste slurry, same item scale as rope/mud
          'conveyor_belt', 'tailings',
          // mining refining chains batch 1 — fuel lump and cast-metal lump, same rack as coal/steel
          'coke', 'pig_iron',
          'shiitake', 'maitake', 'spirulina', 'horsetail', 'dandelion', 'aloe_vera', 'ginseng', 'psyllium',
          'fly_agaric', 'death_cap', 'chanterelle', 'porcini', 'morel', 'puffball', 'stinkhorn', 'turkey_tail', 'slime_mold', 'shaggy_mane',
          // poisonous plants batch 1 — a small psilocybin mushroom, same cap scale as
          // the mushroom rack above; peyote is a famously tiny button cactus, a few
          // centimetres across, closer to this scale than a shrub's
          'psilocybin_mushroom', 'peyote',
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
          // musical instruments batch 2 — reed/free-reed instruments and their own
          // reed blades, same hand-scale rack as flute/trumpet
          'cane', 'bellows', 'clarinet', 'saxophone', 'oboe', 'bassoon', 'harmonica',
          'reed', 'double_reed', 'free_reed',
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
          // sandboxels gapfill batch 1 — a small commensal mammal and bird, and a walking toad,
          // the same rack as mouse/swan/cane_toad
          'rat', 'feral_pigeon', 'common_toad',
          // natural history book batch 1 — small invertebrates, small plants, small
          // mammals, birds, and reptiles, same small-animal scale as rat above
          'sponge', 'comb_jelly', 'hydra', 'planarian', 'leech', 'ribbon_worm',
          'bryozoan', 'lampshell', 'velvet_worm', 'horseshoe_crab', 'sea_spider',
          'tusk_shell', 'sea_cucumber', 'feather_star', 'slug', 'cuttlefish',
          'stonewort', 'hornwort', 'clubmoss',
          'hyrax', 'sengi', 'tenrec', 'golden_mole', 'colugo', 'echidna', 'opossum',
          'mesite', 'kagu', 'sunbittern', 'turaco', 'hoatzin', 'seriema', 'cuckoo_roller',
          'tuatara', 'amphisbaenian',
          // super-nature batch 1 — small-animal scale, same rack as rat
          'naked_mole_rat', 'fennec_fox', 'vampire_bat', 'aye_aye', 'star_nosed_mole',
          'barn_owl', 'archerfish', 'mantis_shrimp', 'pistol_shrimp', 'bombardier_beetle',
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
  '0':   [
          /* blow and smother batch 1, 5 Sep */
          'blast',
          /* places batch 27, 4 Sep */
          'fynbos',
          /* needs closure, 4 Sep */
          'drying',
          /* places batch 15, 4 Sep. a levelling bench */
          'surveying',
          /* places batch 11, 4 Sep. a person */
          'ancestral_puebloan',
          /* verb outcomes batch 1, 4 Sep. a clamp */
          'silage',
          /* places batch 9, 4 Sep. a person */
          'emperor',
          /* places batch 8b, 4 Sep — a person */
          'monk',
          /* places batch 7b, 4 Sep — a person */
          'farmer',
          /* places batch 6b, 4 Sep. a person */
          'mason',
          /* places batch 6, 4 Sep. a bundle of sticks projecting 60 cm */
          'toron',
          /* places batch 5, 4 Sep. people */
          'nabataean', 'hunter_gatherer',
          /* places batch 4b — the makers, 4 Sep. people */
          'abraham_darby', 'jorn_utzon',
          /* places batch 3 — Oceania, 4 Sep. people */
          'anangu', 'gunditjmara', 'rapa_nui_people',
          /* places batch 2 — sub-Saharan Africa, 4 Sep. a person, like the other peoples */
          'shona',
          /* places batch 1 — the Senj worked example, 4 Sep. a person, on the same rack as the other peoples and polities */
          'uskok',
          /* the head-noun tail, 4 Sep — R2 finished */
          'disorder', 'syndrome', 'therapy', 'treatment', 'patient', 'effect', 'cause', 'factor', 'variable', 'powder', 'paste', 'cluster', 'group', 'disc', 'dynasty', 'sector', 'economy', 'conflict', 'guidance', 'feedback', 'output', 'result', 'stand',
          'beauty',
          /* vehicles and marques, 4 Sep — "i cant find car" */
          'sedan', 'hatchback', 'suv', 'pickup', 'coupe', 'convertible', 'estate_car', 'limousine', 'jeep', 'taxi', 'bulldozer', 'fire_engine', 'race', 'toyota', 'ford', 'volkswagen', 'ferrari', 'tesla', 'mercedes', 'bmw', 'honda',
          /* the universe closed, 4 Sep */
          'tribe', 'justice', 'slavery', 'class', 'peace', 'skeleton', 'intestine', 'circulation', 'breathing', 'birth', 'death', 'ageing', 'genetics', 'respiration', 'reproduction', 'predation', 'decomposition', 'velocity', 'pressure', 'heat', 'thermodynamics', 'relativity', 'reduction', 'solvent', 'boiling', 'smelting', 'casting', 'forging', 'welding', 'weaving', 'dyeing', 'tanning', 'food', 'cooking', 'baking', 'roasting', 'preservation', 'famine', 'canoe', 'raft', 'navigation', 'tool', 'pulley', 'mechanism', 'program', 'network', 'artificial_intelligence', 'topology', 'medicine', 'drug', 'dose', 'hygiene', 'malnutrition', 'mental_illness', 'rock', 'weathering', 'organic_chemistry',
          /* mathematics, time and power, 4 Sep — R3 continued */
          'ratio', 'division', 'part', 'whole', 'fraction', 'limit', 'change', 'difference', 'calculus', 'axiom', 'proof', 'theorem', 'contradiction', 'paradox', 'equation', 'function', 'event', 'outcome', 'chance', 'probability', 'sample', 'statistics', 'average', 'symmetry', 'pi', 'fuel', 'waste', 'recycling',
          /* mind and culture, 4 Sep — R3, the abstract domains */
          'perception', 'consciousness', 'attention', 'emotion', 'fear', 'anger', 'happiness', 'love', 'attachment', 'grief', 'dream', 'sleep', 'thought', 'reason', 'learning', 'repetition', 'intelligence', 'problem', 'want', 'need', 'belief', 'knowledge', 'philosophy', 'question', 'ethics', 'art', 'colour', 'story', 'myth', 'ritual', 'festival', 'dance', 'song', 'poetry', 'instrument', 'resonator', 'painting', 'sculpture', 'architecture', 'tradition', 'generation', 'play', 'sport', 'rule', 'humour', 'surprise', 'expectation', 'pattern', 'fashion',
          /* head nouns, 4 Sep — R2, the umbrella pass */
          'system', 'cycle', 'theory', 'evidence', 'observation', 'measurement', 'standard', 'agreement', 'trust', 'selection', 'variation', 'population', 'structure', 'form', 'load', 'code', 'symbol', 'meaning', 'mark', 'machine', 'motor', 'zone', 'region', 'boundary', 'edge', 'rotation', 'axis',
          /* words that came back with nothing, 4 Sep */
          'poodle', 'labradoodle', 'cassowary', 'ratite', 'mustelid', 'weasel', 'badger',
          /* landscape, 4 Sep — on the gestures the gods were sitting on */
          'hearth',
          /* software abstractions sit where instruction and algorithm sit — with
             the person using them, not at a nanometre */
          'kernel', 'scheduler', 'device_driver', 'interrupt', 'process', 'morse_code', 'exchange',
          /* assembly components, 4 Sep — 24 new needs lists asked for these */
          'stator', 'warp', 'weft', 'shed', 'vacuum', 'cistern', 'mouldboard', 'horizon',
          /* conditions, 4 Sep — scaled to the part that goes wrong */
          'pain', 'anaemia', 'asthma', 'arthritis', 'osteoporosis', 'haemophilia', 'stroke', 'heart_failure', 'dehydration', 'hypothermia', 'altitude_sickness', 'pellagra', 'beriberi', 'kwashiorkor', 'childbirth', 'labour', 'hypothyroidism', 'bradycardia', 'lead_poisoning', 'carbon_monoxide_poisoning', 'night_blindness',
          /* human disease, 4 Sep — scaled to the person, as measles and cholera are */
          'chickenpox',
          /* the needs loop closed, 4 Sep — the last 58 components */
          'lid', 'peel', 'easel', 'costume', 'anvil', 'tripod', 'vat', 'condenser', 'evaporator', 'hopper', 'tail_vane', 'sail', 'kneading', 'grinding', 'lithography', 'advertisement', 'journalist', 'editor', 'clerk', 'conductor', 'rehearsal', 'platen', 'grid', 'modulation', 'cast_iron',
          /* cycle N, from needs.mjs, 4 Sep */
          'frequency', 'projection', 'deck', 'truss', 'cart', 'gate', 'well',
          /* cycle M, from needs.mjs, 4 Sep */
          'arch', 'column', 'vault', 'buttress', 'crane', 'cargo', 'stage', 'actor',
          /* the mind, 4 Sep — conceptual rack with logic and language */
          'mind', 'meditation',
          /* cycle L, from needs.mjs, 4 Sep */
          'worktop', 'track_gauge',
          /* cycle K, from needs.mjs, 4 Sep */
          'flap', 'cockpit', 'fireplace', 'soil_pipe',
          /* cycle J, from needs.mjs, 4 Sep */
          'firebox', 'carriage', 'signal',
          /* cycle I, from needs.mjs, 4 Sep */
          'fuel_tank', 'suspension', 'chassis',
          /* cycle H, from needs.mjs, 4 Sep */
          'press', 'cask', 'weight', 'mulch',
          /* cycle G, from needs.mjs, 4 Sep */
          'harrow', 'silo', 'water_tank',
          /* cycle F, from needs.mjs, 4 Sep */
          'rebar', 'rafter', 'ridge', 'batten', 'downpipe',
          /* cycle E, from needs.mjs, 3 Sep */
          'frame', 'tyre', 'spade', 'rake',
          /* cycle D, from needs.mjs, 3 Sep */
          'neck', 'furnace',
          /* medicine, clock and sword, from needs.mjs, 3 Sep */
          'surgery', 'nurse', 'doctor', 'pendulum',
          /* the vehicle layer, from needs.mjs, 3 Sep */
          'gearbox', 'clutch', 'driveshaft', 'differential', 'alternator', 'exhaust', 'catalytic_converter', 'steering_wheel', 'dashboard', 'seat',
          /* the mechanical layer, from needs.mjs, 3 Sep */
          'engine', 'lever', 'flywheel', 'boiler', 'pump', 'friction', 'surface', 'area',
          /* the house, from tools/needs.mjs, 3 Sep */
          'timber', 'beam', 'joist', 'lintel', 'plasterboard', 'floorboard', 'gutter', 'radiator',
          /* medicine and disease, 3 Sep */
          'polio', 'influenza', 'rabies', 'scurvy', 'rickets', 'cholera', 'oral_rehydration_therapy',
          /* common words the corpus never had, 3 Sep */
          'otter', 'skunk', 'crocodile', 'emu', 'statue', 'robot',
          /* society and economy, 3 Sep */
          'money', 'debt', 'tax', 'contract', 'property',
          /* physics: the measured quantities, 3 Sep — conceptual rack with logic/language */
          'light', 'mass', 'energy', 'time', 'distance', 'speed', 'acceleration', 'force', 'momentum', 'work', 'power', 'temperature', 'entropy',
          /* the abstract layer, 3 Sep — see the note on conceptual scale above */
          'counting', 'writing', 'number', 'zero', 'geometry', 'law', 'memory', 'history', 'agriculture', 'calendar',
          /* everyday: the last of them, 3 Sep */
          'crate', 'scooter',
          /* everyday: tools, furniture, 3 Sep */
          'vice', 'drawer', 'desk', 'wardrobe', 'mattress', 'mop',
          /* everyday objects: parts and the street, 3 Sep */
          'plank', 'pole', 'cable', 'sheet_metal', 'mesh', 'traffic_light', 'bollard', 'road_sign', 'litter_bin', 'postbox',
          /* geography wave, 3 Sep */
          'empire', 'treaty', 'sovereignty', 'independence', 'revolution', 'constitution', 'republic', 'referendum', 'colonialism', 'decolonisation', 'partition', 'unification',
          /* computing and plants waves, 3 Sep */
          'logic', 'algebra', 'boolean_algebra', 'truth_table', 'information_theory', 'moores_law', 'machine_code', 'assembly_language', 'programming_language', 'operating_system', 'file', 'filesystem', 'database', 'network_protocol', 'tcp', 'http', 'html', 'url', 'ip_address', 'domain_name_system', 'cipher', 'encryption', 'public_key', 'hash_function', 'digital_signature', 'prime_number', 'checksum', 'hamming_code', 'floating_point', 'ascii', 'unicode', 'instruction', 'computer_network', 'packet', 'jpeg', 'bitmap', 'font',
          /* parasites wave, 3 Sep */
          'taeniasis', 'cysticercosis', 'neurocysticercosis', 'ascariasis', 'hookworm_disease', 'trichuriasis', 'enterobiasis', 'strongyloidiasis', 'onchocerciasis', 'dracunculiasis', 'echinococcosis', 'fascioliasis', 'clonorchiasis', 'paragonimiasis', 'diphyllobothriasis', 'leishmaniasis', 'sleeping_sickness', 'chagas_disease', 'balantidiasis', 'trichomoniasis',
          /* everyday objects, 3 Sep */
          'oven', 'kiln', 'freezer', 'sink', 'shelf', 'cupboard', 'workbench', 'ladder', 'bicycle', 'drone', 'wall', 'roof', 'floor', 'room', 'chimney',
          /* umbrella waves, 3 Sep */
          'solid', 'liquid', 'gas', 'melting', 'freezing', 'vaporization', 'condensation', 'sublimation', 'deposition', 'ionization', 'organism', 'periodic_table', 'transition_metal', 'alkaline_earth_metal', 'lanthanide', 'actinide', 'fundamental_force', 'strong_force', 'weak_force', 'electromagnetism', 'standard_model',
          /* additive and metals waves, 3 Sep */
          'fracking_fluid', 'runway_deicer',
          'angiosarcoma', 'birth_defect',
          'wild_boar', 'mouflon', 'bezoar_ibex', 'wild_turkey', 'greylag_goose', 'ape', 'wild_coca', 'wild_tobacco', 'spurge', 'fern', 'requiem_shark', 'crocodilian', 'perissodactyl', 'african_wild_ass', 'equus', 'wild_dromedary', 'okapi', 'wild_water_buffalo', 'theropod',
          /* asbestos chain, 2 Sep */ 'mesothelioma',
          /* crops and materials wave, 2 Sep */
          'cattail_reed', 'coffee_crop', 'dill_crop', 'fennel_crop', 'guayule_shrub', 'hemp', 'papyrus_reed', 'sea_buckthorn',
          'sorghum_broomcorn', 'sweet_gale', 'tea_tea',
          /* unblocking-nouns wave, 2 Sep */
          'air_force', 'airborne_transmission', 'alexander_fleming', 'army', 'artillery_branch', 'aseptic_technique', 'attrition', 'bellerophon',
          'blockade', 'cavalry', 'clade', 'conscription', 'contact_tracing', 'contagion', 'deafness', 'edward_jenner',
          'epidemiology', 'eusociality', 'fenrir', 'guerrilla_warfare', 'hearing', 'heredity', 'ignaz_semmelweis', 'incubation_period',
          'infantry', 'joseph_lister', 'joust', 'legion', 'mendelian_inheritance', 'mercenary', 'navy', 'norns',
          'outbreak', 'phalanx', 'portcullis', 'quarantine', 'rabbi_loew', 'siege', 'siege_of_jerusalem', 'soldier',
          'space_race', 'standing_army', 'stromatolite', 'symbiosis', 'total_war', 'war',
          /* DNA-structure fix, 2 Sep */ 'rosalind_franklin',
          /* completeness-audit wave, 2 Sep */
          'addiction', 'adhd', 'afroasiatic', 'afterlife', 'algorithm', 'amharic', 'angel', 'anorexia_nervosa',
          'arabic', 'ardipithecus', 'artillery', 'austronesian', 'autism_spectrum_disorder', 'banshee', 'bengali', 'biological_domain',
          'bipedalism', 'blitzkrieg', 'carnivore', 'cello', 'chord', 'circadian_rhythm', 'circulatory_system', 'confirmation_bias',
          'creole', 'dagda', 'dialect', 'digestive_system', 'dravidian', 'dutch', 'ego', 'endocrine_system',
          'endoskeleton', 'english', 'esperanto', 'ethology', 'faith', 'fermentation', 'feudalism', 'food_safety',
          'french', 'freudian_id', 'genus', 'german', 'gestalt_psychology', 'god', 'golem', 'grammar',
          'greek', 'griffin', 'habituation', 'hajj', 'harmony', 'harp', 'hausa', 'heaven',
          'hebrew', 'herbivore', 'hindi', 'homo_sapiens', 'human_voice', 'hydrogen_bomb', 'immune_system', 'indo_european',
          'indonesian', 'industrial_revolution', 'integumentary_system', 'italian', 'japanese', 'javanese', 'jazz', 'kimberlite',
          'kingdom', 'korean', 'language', 'language_family', 'latin', 'lingua_franca', 'literacy', 'loanword',
          'lobotomy', 'lymphatic_system', 'mandarin', 'manhattan_project', 'mass_production', 'melody', 'menstrual_cycle', 'mermaid',
          'miracle', 'mnemonic', 'moirai', 'mouthfeel', 'multiple_intelligences', 'muscular_system', 'music', 'musical_scale',
          'napoleonic_wars', 'niger_congo', 'nutrition', 'nuwa', 'octave', 'omnivore', 'opera', 'organ_system',
          'pangu', 'parkinsons_disease', 'persian', 'perun', 'phoneme', 'phrenology', 'phylum', 'pidgin',
          'pitch', 'placebo_effect', 'polish', 'pope', 'portuguese', 'prayer', 'predator', 'prey',
          'priest', 'primate', 'prophet', 'psychology', 'puberty', 'punjabi', 'ramadan', 'religion',
          'reproductive_system', 'respiratory_system', 'rhythm', 'richter_scale', 'russian', 'sabbath', 'sacrament', 'sanskrit',
          'scavenger', 'elasmobranch', 'ray',
          'shark', 'sign_language', 'sin', 'sino_tibetan', 'skeletal_system', 'spanish', 'species',
          'states_of_matter', 'structuralism_psychology', 'sun_tzu', 'superego', 'swahili', 'symphony', 'tagalog', 'tamil',
          'tank', 'telugu', 'tempo', 'thai', 'thermoregulation', 'trench_warfare', 'trickster', 'troll',
          'turkic', 'turkish', 'umami', 'unicorn', 'urdu', 'urinary_system', 'vietnamese', 'werewolf',
          'word', 'world_war_one', 'world_war_two', 'worship', 'yoruba', 'zoology',
          /* microbio wave, 2 Sep */
          'actinomycosis', 'acute_retroviral_syndrome', 'aids', 'allergy', 'ames_test', 'anaphylaxis', 'autoclave', 'autoimmune_disease',
          'bacterial_vaginosis', 'basic_reproduction_number', 'binomial_nomenclature', 'bioinformatics', 'botulism', 'brucellosis', 'c_diff_infection', 'carl_woese',
          'cat_scratch_disease', 'chancroid', 'chlamydia', 'clinical_latency', 'cmv_retinitis', 'common_cold', 'confocal_microscope', 'cryptosporidiosis',
          'cyclosporiasis', 'cystitis', 'diphtheria', 'disease', 'encephalitis', 'endemic_disease', 'epidemic', 'fever',
          'folliculitis', 'gas_gangrene', 'germ_theory', 'gonorrhea', 'haart', 'hepatitis_a', 'herd_immunity', 'hiv_wasting_syndrome',
          'hypersensitivity', 'immunodeficiency', 'impetigo', 'incidence', 'infection', 'infectious_mononucleosis', 'infective_endocarditis', 'inflammation',
          'john_snow', 'kaposis_sarcoma', 'koch_postulates', 'leptospirosis', 'louis_pasteur', 'lyophilization', 'measles', 'meningitis',
          'meningococcemia', 'metagenomics', 'mumps', 'needle_borne_hiv_transmission', 'norovirus_gastroenteritis', 'nosocomial_infection', 'notifiable_disease', 'pandemic',
          'pathogen', 'paul_ehrlich', 'peptic_ulcer', 'perinatal_hiv_transmission', 'plague', 'pneumococcal_pneumonia', 'pneumocystis_pneumonia', 'poliomyelitis',
          'prevalence', 'pseudomonas_infection', 'pyelonephritis', 'rabies_encephalitis', 'rat_bite_fever', 'ringworm', 'robert_koch', 'rocky_mountain_spotted_fever',
          'rubella', 'scanning_electron_microscope', 'sepsis', 'septic_shock', 'staphylococcal_scalded_skin_syndrome', 'sterilization', 'strep_throat', 'syphilis',
          'tapeworm', 'tetanus', 'three_domain_system', 'toxic_shock_syndrome', 'toxoplasmic_encephalitis', 'transmission_electron_microscope', 'transplant_rejection', 'tuberculosis',
          'tularemia', 'typhoid_fever', 'van_leeuwenhoek', 'vulvovaginal_candidiasis', 'wart', 'water_activity', 'whooping_cough', 'yellow_fever',
          'zidovudine', 'zoonotic_disease',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'sahelanthropus_tchadensis', 'orrorin_tugenensis', 'ardipithecus_ramidus', 'australopithecus_africanus', 'paranthropus_boisei', 'homo_rudolfensis', 'homo_antecessor', 'homo_naledi', 'homo_floresiensis', 'denisovan', 'australopithecus_sediba', 'heidegger', 'sartre', 'camus', 'arendt', 'foucault', 'derrida', 'popper', 'kuhn', 'chomsky', 'peter_singer', 'william_of_ockham', 'ayn_rand', 'edward_said', 'habermas', 'isaiah_berlin', 'adorno', 'marcuse', 'levinas', 'merleau_ponty', 'quine', 'barthes', 'fanon', 'arne_naess', 'giordano_bruno', 'gilbert_ryle', 'j_l_austin', 'rene_girard', 'daniel_dennett', 'martha_nussbaum', 'hypatia', 'breccia', 'arkose', 'graywacke', 'tillite', 'chert', 'banded_iron_formation', 'oil_shale', 'phosphorite', 'toilet', 'tractor', 'vacuum_cleaner', 'window', 'chair', 'clown', 'door', 'dolphin', 'dresser', 'rhyolite', 'andesite', 'dacite', 'diorite', 'gabbro', 'syenite', 'peridotite', 'dunite', 'komatiite', 'anorthosite', 'pegmatite', 'perlite', 'tuff', 'xenolith', 'porphyry', 'bed', 'bridge', 'fence', 'ghost', 'goal', 'sofa', 'stairs', 'stove', 'swing', 'table', 'agave', 'animism', 'shamanism', 'ancestor_worship', 'the_dreaming', 'human_sacrifice', 'ahura_mazda', 'angra_mainyu', 'zoroaster', 'zoroastrianism', 'laozi', 'dao', 'wu_wei', 'daoism', 'mahavira', 'ahimsa', 'tirthankara', 'jainism', 'confucianism', 'junzi', 'marduk', 'mummification', 'shinto', 'kami', 'torii', 'ragnarok', 'valhalla', 'oracle', 'lares', 'dharma', 'karma', 'samsara', 'atman', 'brahman', 'moksha', 'guru', 'ashrama', 'yoga', 'puja', 'bhakti', 'adi_shankara', 'advaita_vedanta', 'shakti', 'moses', 'abraham', 'jesus', 'muhammad', 'guru_nanak', 'zarathustra', 'huxley', 'soul', 'reincarnation', 'nirvana', 'trinity', 'five_pillars', 'hinduism', 'buddhism', 'judaism', 'christianity', 'islam', 'taoism', 'sikhism', 'atheism', 'agnosticism', 'yin_yang', 'om', 'rabbi', 'monotheism', 'polytheism', 'syncretism', 'incarnation', 'messiah', 'covenant', 'ancestor_veneration', 'filial_piety', 'asceticism', 'pilgrimage', 'mantra', 'cross', 'sufism', 'ahmadiyya', 'shia_islam', 'sunni_islam', 'sharia', 'jihad', 'wahhabism', 'salafism', 'nation_of_islam', 'druze', 'bahai_faith', 'rastafari', 'santeria', 'haitian_vodou', 'cargo_cult', 'scientology', 'unification_church', 'wicca', 'unitarian_universalism', 'hare_krishna', 'falun_dafa', 'tenrikyo', 'cao_dai', 'jehovahs_witnesses', 'mormonism', 'quakers', 'amish', 'mennonites', 'shakers', 'seventh_day_adventist', 'pentecostalism', 'christian_science', 'salvation_army', 'anglicanism', 'lutheranism', 'presbyterianism', 'methodism', 'baptists', 'reform_judaism', 'orthodox_judaism', 'hasidic_judaism', 'conservative_judaism', 'kabbalah', 'vaishnavism', 'shaivism', 'shaktism', 'arya_samaj', 'transcendental_meditation', 'theravada_buddhism', 'mahayana_buddhism', 'zen_buddhism', 'tibetan_buddhism', 'pure_land_buddhism', 'nichiren_buddhism', 'soka_gakkai', 'hammurabi_code', 'indus_valley', 'shang_dynasty', 'minoan', 'mycenaean', 'bronze_age_collapse', 'assyrian_empire', 'cyrus_the_great', 'battle_of_marathon', 'alexander_the_great', 'qin_shi_huang', 'ashoka', 'hannibal', 'julius_caesar', 'cleopatra', 'augustus', 'kush', 'gandhi', 'four_noble_truths', 'noble_eightfold_path', 'middle_way', 'bodhisattva', 'dalai_lama', 'ten_commandments', 'diaspora', 'maimonides', 'nicene_creed', 'eucharist', 'baptism', 'monasticism', 'protestant_reformation', 'prometheus', 'epimetheus', 'pandora', 'atlas', 'deucalion', 'pyrrha', 'daedalus', 'icarus', 'phaethon', 'minotaur', 'theseus', 'ariadne', 'perseus', 'medusa', 'pegasus', 'andromeda', 'jason', 'medea', 'sphinx', 'oedipus', 'orpheus', 'eurydice', 'midas', 'echo_nymph', 'narcissus', 'arachne', 'psyche', 'janus', 'vesta', 'hestia', 'romulus', 'remus', 'aeneas', 'numa', 'cybele', 'attis', 'mithras', 'pygmalion', 'sibyl_of_cumae', 'umayyad_caliphate', 'abbasid_caliphate', 'seljuk_turks', 'byzantine_empire', 'crusades', 'cannon', 'ottoman_empire', 'genghis_khan', 'mongol_empire', 'black_death', 'kublai_khan', 'yuan_dynasty', 'ming_dynasty', 'zheng_he', 'qing_dynasty', 'samurai', 'kamakura_shogunate', 'delhi_sultanate', 'tamerlane', 'mughal_empire', 'khmer_empire', 'mali_empire', 'mansa_musa', 'aztec_empire', 'inca_empire', 'hernan_cortes', 'francisco_pizarro', 'smallpox_epidemic', 'martin_luther', 'hundred_years_war', 'joan_of_arc', 'sumer', 'akkadian_empire', 'hittites', 'minoan_crete', 'mycenaeans', 'olmecs', 'chavin_culture', 'achaemenid_empire', 'hellenistic_culture', 'roman_republic', 'punic_wars', 'fall_of_rome', 'celts', 'scythians', 'huns', 'mauryan_empire', 'gupta_empire', 'terracotta_army', 'han_dynasty', 'zapotec_civilization', 'maya_civilization', 'athenian_democracy', 'sparta', 'greco_persian_wars', 'peloponnesian_war', 'thales_of_miletus', 'pythagoras', 'heraclitus', 'parmenides', 'protagoras', 'democritus', 'mozi', 'diogenes_of_sinope', 'zeno_of_citium', 'stoicism', 'socratic_method', 'augustine_of_hippo', 'boethius', 'anselm', 'averroes', 'rumi', 'erasmus', 'machiavelli', 'montaigne', 'francis_bacon', 'hobbes', 'pascal', 'spinoza', 'leibniz', 'berkeley', 'voltaire', 'hume', 'rousseau', 'adam_smith', 'burke', 'bentham', 'wollstonecraft', 'hegel', 'schopenhauer', 'feuerbach', 'mill', 'kierkegaard', 'thoreau', 'peirce', 'james', 'nietzsche', 'saussure', 'husserl', 'bergson', 'dewey', 'santayana', 'unamuno', 'du_bois', 'russell', 'chernobog', 'belobog', 'baba_yaga', 'dievas', 'rainbow_serpent', 'baiame', 'taaroa', 'tane', 'rangi', 'papa', 'tawhirimatea', 'tu', 'maui', 'makemake', 'haua', 'spider_woman', 'raven_spirit', 'sedna', 'iktomi', 'nanabozho', 'kiviuq', 'inua', 'viracocha', 'ngai', 'amma', 'nommo', 'legba', 'cicero', 'charlemagne', 'william_the_conqueror', 'leonardo_da_vinci', 'michelangelo', 'henry_viii', 'elizabeth_i', 'nicolaus_copernicus', 'galileo_galilei', 'isaac_newton', 'louis_xiv', 'oliver_cromwell', 'george_washington', 'thomas_jefferson', 'benjamin_franklin', 'napoleon', 'karl_marx', 'charles_darwin', 'otto_von_bismarck', 'mohandas_gandhi', 'william_shakespeare', 'johann_sebastian_bach', 'sargon_of_akkad', 'battle_of_kadesh', 'fall_of_western_rome', 'battle_of_hastings', 'marco_polo', 'fall_of_constantinople', 'supply_chain', 'logistics', 'supply_chain_management', 'sales_forecasting', 'demand_planning', 'sales_and_operations_planning', 'inventory', 'inventory_management', 'safety_stock', 'economic_order_quantity', 'bullwhip_effect', 'just_in_time', 'lean_manufacturing', 'material_requirements_planning', 'enterprise_resource_planning', 'vendor_managed_inventory', 'distribution_requirements_planning', 'fire_lance', 'chariot', 'horse_archer', 'machine_gun', 'atomic_bomb', 'reflex_arc', 'eeg', 'alpha_wave', 'rem_sleep', 'halberd', 'pike', 'poleaxe', 'immortals', 'hoplite', 'sarissa', 'pilum', 'testudo', 'cataphract', 'varangian_guard', 'berserker', 'housecarl', 'knight', 'janissary', 'landsknecht', 'winged_hussar', 'naginata', 'parthian_shot', 'milgram_obedience_experiments', 'asch_conformity_experiments', 'narcissism', 'machiavellianism', 'psychopathy', 'dark_triad', 'd_factor', 'cognitive_dissonance', 'classical_conditioning', 'principles_of_persuasion', 'foot_in_the_door_technique', 'door_in_the_face_technique', 'groupthink', 'neuro_linguistic_programming', 'milton_erickson', 'bradley_ifv', 'm109_paladin', 'mlrs', 'himars', 'patriot_missile', 'hmmwv', 'stryker_vehicle', 'mrap_vehicle', 'neurodegeneration', 'dementia', 'alzheimers_disease', 'vascular_dementia', 'lewy_body_dementia', 'frontotemporal_dementia', 'alois_alzheimer', 'friedrich_lewy', 'arnold_pick', 'auguste_deter', 'otto_kernberg', 'marsha_linehan', 'john_gunderson', 'peter_fonagy', 'jeffrey_young', 'theodore_millon', 'robert_cloninger', 'mary_zanarini', 'thomas_widiger', 'object_relations_theory', 'splitting_defense_mechanism', 'transference_focused_psychotherapy', 'dialectical_behavior_therapy', 'mentalization_based_treatment', 'schema_therapy', 'good_psychiatric_management', 'alternative_dsm5_model_for_personality_disorders', 'temperament_and_character_inventory', 'mclean_study_of_adult_development', 'pavlov', 'watson', 'skinner', 'freud', 'jung', 'maslow', 'rogers', 'wundt', 'clinical_psychology', 'biological_psychology', 'educational_psychology', 'cognitive_psychology', 'forensic_psychology', 'social_psychology', 'industrial_organizational_psychology', 'health_psychology', 'experimental_psychology', 'developmental_psychology', 'abnormal_psychology', 'behaviorism', 'psychoanalysis', 'analytical_psychology', 'humanistic_psychology', 'child', 'jean_piaget', 'erik_erikson', 'john_bowlby', 'mary_ainsworth', 'lev_vygotsky', 'harry_harlow', 'sensorimotor_stage', 'object_permanence', 'preoperational_stage', 'egocentrism', 'conservation_task', 'concrete_operational_stage', 'formal_operational_stage', 'attachment_theory', 'strange_situation', 'secure_attachment', 'aaron_beck', 'ambivalent_attachment', 'amnesia', 'anosmia', 'antisocial_personality_disorder', 'autonomy_vs_shame_doubt', 'avoidant_attachment', 'avoidant_personality_disorder', 'babbling', 'behavior_shaping', 'borderline_personality_disorder', 'cannon_bard_theory', 'charles_bell', 'cognitive_behavioural_therapy', 'cold_war', 'conditioned_extinction', 'conditioned_response', 'conditioned_stimulus', 'contact_comfort', 'critical_period_hypothesis', 'cuban_missile_crisis', 'declarative_memory', 'dependent_personality_disorder', 'disorganized_attachment', 'drive_reduction_theory', 'epilepsy', 'episodic_memory', 'eric_kandel', 'evidence_based_practice', 'extended_deterrence', 'false_belief_task', 'family_systems_therapy', 'flexible_response', 'francois_magendie', 'generativity_vs_stagnation', 'heinz_kohut', 'henry_molaison', 'hervey_cleckley', 'hierarchy_of_needs', 'histrionic_personality_disorder', 'identity_vs_role_confusion', 'industry_vs_inferiority', 'inf_treaty', 'initiative_vs_guilt', 'integrity_vs_despair', 'intimacy_vs_isolation', 'james_lange_theory', 'korsakoff_syndrome', 'kraepelin', 'kretschmer', 'kurt_schneider', 'massive_retaliation', 'maternal_deprivation', 'memory_encoding', 'memory_retrieval', 'memory_storage', 'mutual_assured_destruction', 'narcissistic_personality_disorder', 'nato', 'nato_dual_track_decision', 'nato_nuclear_sharing', 'negative_punishment', 'negative_reinforcement', 'non_proliferation_treaty', 'nuclear_deterrence', 'nuclear_planning_group', 'observational_learning', 'obsessive_compulsive_personality_disorder', 'one_word_stage', 'operant_conditioning', 'overregularization', 'paranoid_personality_disorder', 'personality_disorder', 'positive_punishment', 'positive_reinforcement', 'private_speech', 'proactive_interference', 'procedural_memory', 'retroactive_interference', 'robert_hare', 'scaffolding', 'schizoid_personality_disorder', 'schizophrenia', 'schizotypal_personality_disorder', 'seizure', 'semantic_memory', 'sensory_memory', 'serial_position_effect', 'sociocultural_theory', 'spontaneous_recovery', 'stimulus_discrimination', 'stimulus_generalization', 'strategic_nuclear_weapon', 'stretch_reflex', 'tactical_nuclear_weapon', 'telegraphic_speech', 'theory_of_mind', 'trust_vs_mistrust', 'unconditioned_response', 'unconditioned_stimulus', 'vicarious_reinforcement', 'warsaw_pact', 'working_memory', 'zone_of_proximal_development', 'positive_psychology', 'personal_construct_psychology', 'unconscious_mind', 'transference', 'defence_mechanism', 'exposure_therapy', 'systematic_desensitization', 'hierarchy_of_evidence', 'meta_analysis', 'dodo_bird_verdict', 'case_formulation', 'structured_clinical_interview', 'beck_depression_inventory', 'global_assessment_of_functioning', 'transtheoretical_model', 'generalized_anxiety_disorder', 'panic_disorder', 'agoraphobia', 'obsessive_compulsive_disorder', 'posttraumatic_stress_disorder', 'major_depressive_disorder', 'bipolar_disorder', 'seasonal_affective_disorder', 'sociopathy', 'hydrothermal_vent', 'whale_fall', 'walrus', 'narwhal', 'wave', 'maximilian_armor', 'zweihander', 'radiometric_dating', 'sonar', 'echo_sounder', 'giant_tube_worm', 'troodon', 'bone_wars', 'cladoselache', 'stethacanthus', 'xenacanthus', 'eusthenopteron', 'panderichthys', 'latimeria', 'baiji', 'sumatran_rhinoceros', 'red_panda', 'pygmy_hippopotamus', 'gregor_mendel', 'alfred_russel_wallace', 'lynn_margulis', 'ernst_mayr', 'jbs_haldane', 'on_the_origin_of_species', 'holobiont', 'martinus_beijerinck', 'sergei_winogradsky', 'ilya_metchnikoff', 'georges_cuvier', 'charles_lyell', 'james_hutton', 'thomas_malthus', 'container_deposit_legislation', 'waste_picker', 'extended_producer_responsibility', 'circular_economy', 'constellation', 'ecliptic', 'zodiac', 'aries', 'taurus', 'gemini', 'cancer_constellation', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces', 'ursa_major', 'ursa_minor', 'cassiopeia', 'cepheus', 'orion', 'canis_major', 'canis_minor', 'scorpius', 'ophiuchus', 'serpens', 'cygnus', 'lyra', 'aquila', 'canes_venatici', 'bootes', 'corona_borealis', 'auriga', 'winter_triangle', 'summer_triangle', 'eratosthenes', 'hipparchus', 'claudius_ptolemy', 'eudoxus_of_cnidus', 'aristarchus_of_samos', 'frost_wedging', 'stalactite', 'stalagmite', 'cave_column', 'splash_erosion', 'rill_erosion', 'gully_erosion', 'zhang_heng', 'saros_cycle', 'metonic_cycle', 'five_themes_of_geography', 'reflecting_telescope', 'adaptive_optics', 'coronagraph', 'spectrograph', 'interferometer', 'voyager_program', 'sputnik_1', 'apollo_11', 'curiosity_rover', 'new_horizons', 'cassini_huygens', 'parallax', 'distance_decay', 'contagious_diffusion', 'hierarchical_diffusion', 'stimulus_diffusion', 'relocation_diffusion', 'migration', 'push_factor', 'pull_factor', 'urbanization', 'unitary_state', 'federalism', 'separatist_movement', 'self_determination', 'census', 'gerrymandering', 'primary_sector', 'secondary_sector', 'tertiary_sector', 'quaternary_sector', 'factors_of_production', 'comparative_advantage', 'footloose_industry', 'gini_coefficient', 'break_of_bulk', 'agglomeration', 'central_place_theory', 'suburbanization', 'redlining', 'white_flight', 'gentrification', 'urban_sprawl', 'homeostasis', 'diabetes', 'phenotype',
          // mining value chains batch 2 — machine-sized equipment, a room-scale appliance
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
          // Hindu mythology batch 2 (Krishna/Rama) — same human/idol scale as the pantheon above
          'krishna', 'radha', 'yashoda', 'kansa', 'rama', 'sita', 'ravana', 'lakshmana', 'arjuna',
          // a full pole weapon, the same order of magnitude as the human wielding it
          'trident',
          // egyptian gods batch 1 — deities and idols at human scale, and their new base ingredients:
          // a boat as drawn (a small hull), and animals in the ox/lion/wolf size class
          'ra', 'osiris', 'isis', 'horus', 'set', 'anubis', 'thoth', 'bastet', 'sobek', 'hathor',
          // egyptian gods batch 2 — same human/idol scale as the pantheon above
          'neith', 'seshat', 'nefertem', 'nekhbet', 'min', 'renenutet',
          'bes', 'mut', 'tefnut', 'sokar', 'wepwawet',
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
          // philosophy batch 1 — real philosophers, human scale
          'socrates', 'plato', 'aristotle', 'descartes', 'locke', 'kant', 'wittgenstein',
          'beauvoir', 'confucius', 'gautama_buddha', 'avicenna', 'plutarch', 'epicurus',
          'searle', 'turing', 'foot', 'rawls', 'aquinas',
          // did you know batch 1 — human-scale people, structures, and a genuinely
          // vehicle-scale meteorite (the largest single intact one known)
          'moat', 'drawbridge', 'viking', 'columbus', 'gladiator', 'tickle', 'sneeze',
          'hardtack', 'hoba',
          // science-for-learners batch 1 — medical/conceptual/historical-work entries,
          // no literal size, same convention as natural_selection above
          'leprosy', 'chaulmoogra_ester', 'artemisinin', 'lamarckism', 'abo_blood_group',
          'waggle_dance', 'book_of_optics', 'event_horizon_telescope',
          // super-nature batch 1 — medium-animal scale, same rack as fox
          'aardvark', 'beaver', 'pronghorn', 'satin_bowerbird', 'leatherback_turtle',
          'electric_eel', 'coconut_crab',
          // natural history book batch 1 — medium-large mammals, same rack as fox
          'manatee', 'dugong', 'pangolin', 'tapir', 'giant_anteater', 'wombat',
          // Greek/Roman mythology batch 1 — human- or large-animal-scale figures, the
          // same rack as the Aztec/Maya gods and jaguar above
          'zeus', 'hera', 'poseidon', 'hades', 'athena', 'apollo', 'artemis', 'ares',
          'aphrodite', 'hermes', 'dionysus', 'demeter', 'persephone', 'hephaestus',
          'cronus', 'gaia', 'uranus', 'rhea', 'eros', 'nike', 'helios', 'selene', 'eos',
          'pan', 'hypnos', 'heracles', 'odysseus', 'cerberus',
          'bull', 'heifer', 'steer', 'buffalo', 'donkey', 'boar', 'sow', 'gilt', 'barrow', 'ram', 'ewe', 'wether', 'buck', 'doe', 'stallion', 'mare', 'colt', 'filly', 'gelding',
          'calf', 'cactus', 'foxglove', 'winter_wheat', 'semi_dwarf_wheat', 'willow', 'bamboo', 'ox', 'whale', 'granite', 'basalt', 'sandstone', 'mudstone', 'shale', 'conglomerate', 'phyllite', 'schist', 'gneiss', 'quartzite', 'generator', 'electric_motor', 'transformer', 'refrigerator', 'printing_press', 'telescope', 'steam_engine', 'cotton_gin',
          // eyewitness universe batch 1 — observing instruments, same appliance scale as telescope
          'spectroscope', 'radio_telescope',
          // big idea science batch 1 — an appliance-scale device, and abstract medical/
          // conceptual/institutional entries with no literal size, same convention
          // natural_selection already uses at this same human/appliance scale
          'fuel_cell', 'als', 'echolocation', 'biomimicry', 'frozen_zoo',
          // great inventors batch 1 — appliance/vehicle-scale devices and 2 abstractions
          'archimedes_screw', 'elephant_clock', 'submarine', 'lightning_rod', 'automobile',
          // cutaways batch 1 — vehicle/appliance-scale machines
          'nuclear_reactor', 'corium', 'tunnel_boring_machine', 'ct_scanner', 'stand_mixer',
          'electric_car', 'icebreaker', 'snow_groomer', 'turboprop', 'abrams_tank',
          'tiger_tank', 'radar', 'stealth_aircraft', 'elliptical_wing',
          'ac_induction_motor', 'autogyro', 'liquid_fuel_rocket', 'enigma_machine', 'bombe',
          'hypertext', 'world_wide_web',
          // poisonous plants batch 1 — herb/shrub/vine-scale toxic and psychoactive
          // plants, the same rack as foxglove/cactus/willow above
          'deadly_nightshade', 'poison_hemlock', 'water_hemlock', 'castor_bean', 'oleander',
          'aconite', 'autumn_crocus', 'mayapple', 'pokeweed', 'larkspur', 'lily_of_the_valley',
          'giant_hogweed', 'rhododendron', 'datura', 'angels_trumpet', 'cannabis', 'coca',
          'tobacco', 'opium_poppy', 'morning_glory', 'ayahuasca_vine', 'salvia_divinorum',
          'sweet_flag', 'mescal_bean',
          // textiles batch 1 — floor-standing apparatus, the same rack as cotton_gin/printing_press
          'spinning_wheel', 'loom',
          'elevator', 'internal_combustion_engine', 'lcd_screen', 'microwave_oven', 'plough', 'peat', 'forge', 'warhead', 'pig', 'sheep', 'horse', 'wolf', 'deer', 'bear', 'kangaroo', 'dingo', 'zebra', 'lion', 'camel', 'cow', 'goat', 'aurochs', 'tree', 'acacia', 'scarecrow', 'greenhouse', 'human',
          // careers batch 1 — a person doing a job, same human scale as human itself
          'carpenter', 'electrician', 'plumber', 'astronomer', 'meteorologist', 'astronaut',
          'veterinarian', 'farm_manager', 'medical_doctor', 'dentist', 'railroad_engineer',
          'ships_captain', 'airline_pilot', 'firefighter', 'paramedic', 'chef', 'photographer',
          'jewelry_designer', 'textile_designer', 'teacher',
          // seven wonders batch 1 — the named historical people behind each wonder, human scale
          'khufu', 'pheidias', 'nebuchadnezzar', 'croesus', 'herostratus', 'sostratus',
          'mausolus', 'artemisia_ii', 'chares',
          'natural_selection', 'cystic_fibrosis', 'sickle_cell_anemia', 'cancer', 'tumor', 'metastasis', 'glioma', 'melanoma', 'leukemia', 'gene_therapy', 'dna_profile', 'cloning', 'snake', 'rattlesnake',
          // animal physiology batch 1 (How Animals Work) -- large mammals, same rack as lion/camel/dingo
          'rhinoceros', 'hyena',
          'proailurus', 'pseudaelurus', 'homotherium', 'panthera_zdanskyi', 'tiger', 'javan_tiger',
          'eucyon', 'canis_lepophagus', 'canis_etruscus', 'canis_mosbachensis',
          'dog', 'german_shepherd', 'border_collie', 'rottweiler', 'saint_bernard', 'siberian_husky', 'greyhound', 'afghan_hound', 'bloodhound', 'labrador_retriever', 'golden_retriever', 'bull_terrier',
          'piano',
          // musical instruments batch 2 — furniture-scale free-reed keyboard instruments
          'accordion', 'reed_organ',
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
          // early-people batch 1 — hominin species and a wall-sized cave painting, human/idol scale like human/gorilla, and a low dwelling, boat-sized like the vehicles above
          'australopithecus_afarensis', 'homo_habilis', 'homo_erectus', 'homo_heidelbergensis', 'homo_neanderthalensis', 'cave_painting', 'mammoth_bone_hut',
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
  '1':   [
          /* places batch 31, 4 Sep */
          'rock_cut_architecture',
          /* places batch 29, 4 Sep */
          'muqarnas',
          /* places batch 26, 4 Sep */
          'galleon',
          /* places batch 23, 4 Sep */
          'onion_dome',
          /* places batch 22, 4 Sep */
          'log_building',
          /* places batch 21, 4 Sep */
          'caisson',
          /* places batch 18, 4 Sep */
          'reservoir',
          /* places batch 13, 4 Sep. a span and a corner, metres */
          'dome', 'pendentive',
          /* places batch 12, 4 Sep. a sinkhole, tens of metres across */
          'cenote',
          /* places batch 11, 4 Sep. an overhang, metres deep */
          'alcove',
          /* places batch 10, 4 Sep. a five-storey timber tower */
          'pagoda',
          /* places batch 8, 4 Sep. a single flyer, metres */
          'flying_buttress',
          /* places batch 7, 4 Sep. a tank twelve metres long, and a wall panel */
          'great_bath', 'talud_tablero',
          /* places batch 4 — Europe, 4 Sep. a standing stone and a chamber roof, metres */
          'megalith', 'corbel_vault',
          /* places batch 3 — Oceania, 4 Sep. a colonnade, metres tall */
          'columnar_basalt',
          /* places batch 3 — Oceania, 4 Sep. four metres on average, ten at the largest raised */
          'moai',
          /* places batch 2 — sub-Saharan Africa, 4 Sep. twenty-four metres of standing stone */
          'aksum_obelisk',
          /* places batch 1 — the Senj worked example, 4 Sep. eighteen metres tall and twenty-three wide */
          'nehaj',
          /* the universe closed, 4 Sep */
          'igneous_rock', 'sedimentary_rock', 'metamorphic_rock', 'aqueduct', 'sewer', 'village', 'farm', 'railway', 'rocket',
          /* the pathogen catalogue, 4 Sep — organisms at their own size,
             diseases at the size of the part the symptom appears on */
          'dutch_elm_disease', 'chestnut_blight', 'ash_dieback', 'panama_disease',
          /* the needs loop closed, 4 Sep — the last 58 components */
          'quay', 'jetty', 'dock', 'breakwater', 'abutment', 'span', 'weir', 'channel', 'millrace', 'battlement', 'arrow_slit', 'courtyard', 'crypt', 'nave',
          /* cycle N, from needs.mjs, 4 Sep */
          'survey', 'pier', 'tunnel',
          /* cycle M, from needs.mjs, 4 Sep */
          'building', 'spire', 'shaft', 'harbour', 'lighthouse', 'theatre',
          /* cycle L, from needs.mjs, 4 Sep */
          'crop', 'cave',
          /* cycle K, from needs.mjs, 4 Sep */
          'cabin', 'operating_theatre', 'altitude',
          /* cycle J, from needs.mjs, 4 Sep */
          'ward',
          /* cycle G, from needs.mjs, 4 Sep */
          'irrigation', 'fertiliser', 'livestock',
          /* medicine, clock and sword, from needs.mjs, 3 Sep */
          'ambulance',
          /* the house, from tools/needs.mjs, 3 Sep */
          'foundation', 'ceiling', 'scaffold',
          /* common words the corpus never had, 3 Sep */
          'ship', 'blue_whale', 'pyramid',
          /* everyday: the last of them, 3 Sep */
          'tram', 'van', 'motorcycle', 'office', 'library',
          /* everyday: tools, furniture, 3 Sep */
          'tower',
          /* everyday objects: parts and the street, 3 Sep */
          'pavement', 'streetlight', 'pedestrian_crossing',
          /* computing and plants waves, 3 Sep */
          'jacquard_loom', 'tabulating_machine', 'turing_machine',
          /* everyday objects, 3 Sep */
          'truck', 'house', 'shop', 'road',
          'areca_palm', 'sauropod', 'pterosaur',
          /* crops and materials wave, 2 Sep */
          'agarwood_tree', 'alder_tree', 'almond_tree', 'argan_tree', 'ash_tree', 'camphor_tree', 'cashew_tree', 'cherry_wood_tree',
          'chestnut_tree', 'cinchona_tree', 'cinnamon_crop', 'clove_crop', 'cork_oak_tree', 'cypress_tree', 'date_palm', 'ebony_tree',
          'fir_tree', 'frankincense_tree', 'gum_arabic_tree', 'hazelnut_tree', 'lime_tree', 'mahogany_tree', 'mulberry_tree', 'myrrh_tree',
          'neem_tree', 'nutmeg_crop', 'olive_wood_tree', 'pecan_tree', 'raffia_palm', 'rattan_palm', 'rosewood_tree', 'sandalwood_tree',
          'shea_tree', 'spruce_tree', 'star_anise_crop', 'teak_tree', 'walnut_tree',
          /* unblocking-nouns wave, 2 Sep */
          'keep',
          /* completeness-audit wave, 2 Sep */
          'assembly_line', 'dragon', 'icbm', 'kaaba', 'orchestra', 'u_boat',
          /* microbio wave, 2 Sep */
          'activated_sludge', 'anaerobic_digestion', 'biomagnification', 'primary_treatment', 'secondary_treatment', 'septic_system', 'trickling_filter', 'water_treatment',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'train', 'bus', 'dinosaur', 'barn', 'fire_truck', 'mecca', 'synagogue', 'mosque', 'church', 'mohenjo_daro', 'war_elephant', 'torpedo', 'battering_ram', 'siege_tower', 'trebuchet', 'black_hawk', 'ch47_chinook', 'apache_helicopter', 'kiowa_warrior', 'rogue_wave', 'utahraptor', 'albertosaurus', 'yutyrannus', 'deinocheirus', 'majungasaurus', 'cryolophosaurus', 'argentinosaurus', 'mamenchisaurus', 'amargasaurus', 'edmontosaurus', 'corythosaurus', 'torosaurus', 'centrosaurus', 'kentrosaurus', 'borealopelta', 'pteranodon', 'mosasaurus', 'dunkleosteus', 'hubble_space_telescope', 'james_webb_space_telescope',
          // early-people batch 1 — a woolly mammoth, elephant-scale
          'mammoth',
          // mining comprehensive batch — tens-of-metres mining/processing equipment and a bench's own
          // scale, the same bucket as drilling_rig/ball_mill/haul_truck above
          'exploration_drilling', 'bench', 'blasting', 'excavator', 'grade_control',
          'magnetic_separation', 'gravity_separation', 'road_freight', 'car_dumper',
          'saguaro', 'airplane',
          'oak', 'pine', 'rubber_tree', 'kapok', 'elephant', 'de_extinction', 'giraffe', 'nile_crocodile', 'american_alligator',
          // natural history book batch 1 — tree-scale seed plants
          'cycad', 'ginkgo',
          // trees/plants batch 1 — real tree species, same tree scale as oak/pine
          'larch', 'cedar', 'juniper', 'holly', 'magnolia', 'maple', 'birch', 'beech',
          'elm', 'eucalyptus', 'baobab', 'banyan', 'aspen', 'crabapple',
          // poisonous plants batch 1 — full-sized trees and a tall columnar cactus,
          // the same rack as oak/pine/saguaro above
          'yew', 'strychnine_tree', 'horse_chestnut', 'betel_nut', 'san_pedro_cactus',
          // seven wonders batch 1 — statue/gate-scale monuments, tens of metres
          'statue_of_zeus', 'colossus_of_rhodes', 'ishtar_gate',
          // did you know batch 1 — ship- and settlement-scale, tens of metres
          'longship', 'caravel', 'lanse_aux_meadows',
          'climax_community', 'food_chain',
          'basking_shark', 'megamouth_shark', 'great_white_shark', 'thresher_shark', 'goblin_shark',
          'manta_ray', 'tiger_shark', 'orca', 'great_hammerhead', 'giant_squid', 'lions_mane_jellyfish', 'whale_shark',
          // science-for-learners batch 1 — a dolphin-scale marine reptile
          'ichthyosaur',
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
  '2':   [
          /* places batch 33, 5 Sep */
          'mogao_caves',
          /* places batch 32, 4 Sep */
          'leptis_magna',
          /* places batch 31, 4 Sep */
          'ajanta_caves',
          /* places batch 29, 4 Sep */
          'alhambra',
          /* places batch 28, 4 Sep */
          'prison', 'robben_island',
          /* places batch 25, 4 Sep */
          'sterkfontein',
          /* places batch 24, 4 Sep */
          'brimstone_hill',
          /* places batch 23, 4 Sep */
          'saint_basils',
          /* places batch 22, 4 Sep */
          'kizhi_pogost',
          /* places batch 21, 4 Sep */
          'suspension_bridge', 'great_house', 'brooklyn_bridge',
          /* places batch 20, 4 Sep */
          'taj_mahal',
          /* places batch 19, 4 Sep */
          'caral', 'concentric_castle', 'krak_des_chevaliers',
          /* places batch 18, 4 Sep */
          'tikal',
          /* places batch 17, 4 Sep — a karst tower, and a bay of 1,600 of them */
          'tower_karst',
          /* places batch 15, 4 Sep. a 274 m bridge and a 400 m palace */
          'pont_du_gard', 'potala',
          /* places batch 14, 4 Sep. a 330 m tower, a castle complex, a plan */
          'eiffel_tower', 'himeji', 'maze',
          /* places batch 13, 4 Sep. a basilica and a 400 m terrace wall */
          'hagia_sophia', 'sacsayhuaman',
          /* places batch 12, 4 Sep. a plug hundreds of metres high */
          'inselberg',
          /* places batch 12, 4 Sep. buildings and precincts */
          'palace', 'chichen_itza', 'sigiriya',
          /* places batch 11, 4 Sep. an order, on the conceptual rack with the other institutions */
          'teutonic_order',
          /* places batch 11, 4 Sep. a cliff-dwelling complex and a 21-hectare castle */
          'mesa_verde', 'malbork',
          /* places batch 10, 4 Sep. a method, on the conceptual rack */
          'dendrochronology',
          /* places batch 10, 4 Sep. a temple precinct, a circle, a headland */
          'horyuji', 'stonehenge', 'giants_causeway',
          /* places batch 9, 4 Sep. buildings and circuits, over a hundred metres */
          'amphitheatre', 'diocletians_palace', 'dubrovnik_walls', 'pula_arena',
          /* places batch 8, 4 Sep. buildings, tens to a hundred metres */
          'gothic', 'cathedral', 'chartres', 'mont_saint_michel',
          /* places batch 7, 4 Sep. a city of mounds, and a mound */
          'cahokia', 'earthwork',
          /* places batch 6b, 4 Sep. an institution, on the conceptual rack with the other societies */
          'guild',
          /* places batch 6, 4 Sep. buildings and squares, tens to hundreds of metres */
          'djenne_mosque', 'citadelle_laferriere', 'registan', 'madrasah',
          /* places batch 5, 4 Sep. a figure tens to hundreds of metres across */
          'geoglyph',
          /* places batch 5, 4 Sep. enclosures and monuments, tens to hundreds of metres */
          'gobekli_tepe', 'petra', 'borobudur', 'stupa',
          /* places batch 4b — the makers, 4 Sep. an age, on the same conceptual rack as the other periods */
          'neolithic',
          /* places batch 4 — Europe, 4 Sep. a village, a mound 85 m across, a cave system, a 30 m span */
          'skara_brae', 'newgrange', 'lascaux', 'iron_bridge',
          /* places batch 3 — Oceania, 4 Sep. a monolith 348 m high, a reef complex 1.5 km across, a building */
          'uluru', 'nan_madol', 'sydney_opera_house',
          /* places batch 2 — sub-Saharan Africa, 4 Sep. a rock-art site spread over a hillside */
          'twyfelfontein',
          /* places batch 2 — sub-Saharan Africa, 4 Sep. a church complex, a walled enclosure, a town — hundreds of metres */
          'lalibela', 'great_zimbabwe', 'kilwa_kisiwani', 'mapungubwe',
          /* mathematics, time and power, 4 Sep — R3 continued */
          'archaeology', 'refinery', 'solar_power', 'wind_power', 'dam', 'hydroelectricity', 'nuclear_power', 'industry', 'mining', 'pollution', 'natural_gas',
          /* landscape, 4 Sep — on the gestures the gods were sitting on */
          'cliff', 'scree', 'hot_spring',
          /* common words the corpus never had, 3 Sep */
          'swamp', 'oasis',
          /* society and economy, 3 Sep */
          'trade', 'government', 'democracy', 'monarchy', 'family',
          /* the abstract layer, 3 Sep — see the note on conceptual scale above */
          'day', 'month', 'year',
          /* everyday objects, 3 Sep */
          'school', 'hospital', 'market', 'street',
          /* asbestos chain, 2 Sep */ 'serpentinite',
          /* unblocking-nouns wave, 2 Sep */
          'bastion_fort', 'exaptation', 'fortification', 'heterozygote_advantage', 'kin_selection', 'motte_and_bailey', 'neoteny', 'permian_triassic_extinction',
          'rna_world', 'sexual_dimorphism',
          /* completeness-audit wave, 2 Sep */
          'aircraft_carrier', 'asgard', 'domestication', 'dreadnought', 'ecological_niche', 'elysium', 'factory', 'fitness',
          'gene_pool', 'habitat', 'homologous_structure', 'mimicry', 'tartarus', 'underworld', 'wind_turbine', 'yggdrasil',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'temple', 'carthage', 'labyrinth', 'medina', 'baghdad', 'forbidden_city', 'angkor_wat', 'tenochtitlan', 'machu_picchu', 'persepolis', 'teotihuacan', 'warehouse', 'zeppelin', 'law_of_superposition', 'geologic_time_scale', 'burgess_shale', 'lagerstatte', 'ocean_wave', 'swell', 'breaker', 'sea_ice', 'salt_marsh', 'k_pg_extinction', 'multicellularity', 'body_plan', 'evo_devo', 'coevolution', 'red_queen_hypothesis', 'hardy_weinberg_principle', 'stabilizing_selection', 'directional_selection', 'disruptive_selection', 'allopatric_speciation', 'sympatric_speciation', 'founder_effect', 'population_bottleneck', 'analogous_structure', 'convergent_evolution', 'divergent_evolution', 'atavism', 'biogenetic_law', 'spontaneous_generation', 'biogenesis', 'panspermia', 'molecular_evidence', 'catastrophism', 'uniformitarianism', 'punctuated_equilibrium', 'cambrian_explosion', 'luca', 'molecular_clock', 'vicariance', 'background_extinction_rate', 'gradualism', 'microevolution', 'macroevolution', 'comparative_anatomy', 'biogeography', 'plastic_pollution', 'marine_debris', 'landfill', 'exfoliation', 'thermokarst', 'solifluction', 'sheet_erosion', 'desert_pavement', 'barchan', 'nabta_playa', 'international_space_station', 'settlement', 'edge_city', 'ghetto',
          // mining comprehensive batch — hundred-plus-metre engineered structures and yards,
          // the same bucket as stockpile/bulk_carrier/hangar above
          'haul_road', 'mine_infrastructure', 'waste_dump', 'heap_leach', 'tailings_dam',
          // seven wonders batch 1 — hundred-metre-plus ancient monuments
          'great_pyramid', 'lighthouse_of_alexandria', 'mausoleum_halicarnassus',
          'temple_of_artemis', 'ziggurat', 'hanging_gardens',
          // did you know batch 1 — hundred-metre-plus historical structures
          'castle', 'colosseum',
          // cutaways batch 1 — hundred-metre-plus engineered structures
          'nuclear_power_plant', 'hydroelectric_dam', 'ocean_liner',
          'port_stockpile', 'stacker_reclaimer', 'ship_loader',
          'giant_sequoia', 'coast_redwood',
          'mangrove', 'magma', 'lava', 'reef', 'dune', 'mist', 'fog', 'rain', 'wind', 'field', 'meadow', 'pasture', 'harvest', 'early_crop',
          // weather batch 2 — precipitation types, same scale as rain
          'sleet', 'drizzle',
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
  '3':   [
          /* places batch 28, 4 Sep */
          'apartheid',
          /* places batch 27, 4 Sep */
          'table_mountain',
          /* places batch 26, 4 Sep */
          'old_havana',
          /* places batch 18, 4 Sep */
          'bagan',
          /* places batch 16, 4 Sep. a 12 km circuit and a city cluster */
          'benin_moat', 'merv',
          /* places batch 8, 4 Sep. a capital and its hinterland */
          'mbanza_kongo',
          /* places batch 7, 4 Sep. 116 hectares of drained wetland */
          'kuk_swamp',
          /* places batch 4 — Europe, 4 Sep. 327 m deep with 287 km of galleries */
          'wieliczka',
          /* places batch 1 — the Senj worked example, 4 Sep. a town, on the same rack as town and city */
          'senj',
          /* the universe closed, 4 Sep */
          'plain', 'forest', 'grassland', 'wetland', 'coast', 'prairie', 'lake', 'groundwater', 'drought',
          /* landscape, 4 Sep — on the gestures the gods were sitting on */
          'valley', 'gorge', 'snowline', 'treeline', 'crater',
          /* society and economy, 3 Sep */
          'society', 'nation',
          /* the abstract layer, 3 Sep — see the note on conceptual scale above */
          'city',
          /* everyday objects, 3 Sep */
          'town',
          /* unblocking-nouns wave, 2 Sep */
          'city_wall', 'eruption', 'lunar_eclipse', 'mont_blanc', 'solar_eclipse',
          /* completeness-audit wave, 2 Sep */
          'avalanche', 'ecosystem', 'jerusalem', 'landslide', 'monaco', 'olympus', 'rock_cycle', 'shield_volcano',
          'stratovolcano', 'water_cycle',
          /* microbio wave, 2 Sep */
          'carbon_cycle', 'eutrophication', 'nitrogen_cycle', 'sulfur_cycle',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'uruk', 'peninsula', 'archipelago', 'strait', 'isthmus', 'halocline', 'pycnocline', 'internal_wave', 'spring_tide', 'seamount', 'wallace_line', 'karst', 'badland', 'eclipse',
          // mining comprehensive batch — a slurry pipeline running tens of kilometres, km scale like the pit
          'slurry_pipeline',
          'atoll', 'cloud', 'lightning', 'thunder', 'flood', 'rainbow', 'river', 'humongous_fungus',
          // weather batch 2 — cloud genera, same km scale as generic cloud
          'cumulus', 'cirrus', 'stratus', 'cumulonimbus', 'nimbostratus',
          'trophic_cascade',
          // meteorite-impact batch 1 — a km-scale landform, same rack as volcano/mountain/caldera
          'impact_crater',
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
          // big idea science batch 1 — a real triple-junction rift region, same km scale as rift_valley
          'afar_triangle',
          // aviation batch 1 — a major runway can run 3-4 km, km scale like the yard above it
          'runway',
          // seashore batch 1 — the tide's rise and fall along a whole stretch of coastline, km scale like estuary/lagoon/fjord
          'tide'],
  '4':   [
          /* places batch 21, 4 Sep */
          'chaco_canyon',
          /* places batch 17, 4 Sep — a karst tower, and a bay of 1,600 of them */
          'ha_long_bay',
          /* places batch 5, 4 Sep. 1,300 km of line over 50 square kilometres */
          'nazca_lines',
          /* places batch 3 — Oceania, 4 Sep. an aquaculture system spread over a lava flow */
          'budj_bim',
          /* places batch 2 — sub-Saharan Africa, 4 Sep. a 48 km gorge and a caldera 20 km across */
          'olduvai_gorge', 'ngorongoro',
          /* places batch 1 — the Senj worked example, 4 Sep. sixteen lakes in an eight-kilometre staircase */
          'plitvice',
          /* landscape, 4 Sep — on the gestures the gods were sitting on */
          'erosion', 'sunset',
          /* geography wave, 3 Sep */
          'city_state', 'co_principality',
          /* unblocking-nouns wave, 2 Sep */
          'meteor', 'prague',
          /* completeness-audit wave, 2 Sep */
          'andorra', 'antigua_and_barbuda', 'aquifer', 'bahrain', 'barbados', 'dominica', 'fault', 'grenada',
          'liechtenstein', 'malta', 'nauru', 'saint_kitts_and_nevis', 'saint_lucia', 'saint_vincent_and_the_grenadines', 'san_marino',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'capital_city', 'continental_shelf', 'hadal_zone', 'continental_slope', 'singapore', 'electoral_district',
          'rift_valley', 'trench',
          // medical-technology batch 1 — the LHC's 27 km ring
          'hadron_collider',
          // aviation batch 1 — a whole airport site, several kilometres across, the same bucket as the LHC ring
          'airport'],
  '6':   [
          /* places batch 3 — Oceania, 4 Sep. 2,300 km of coral */
          'great_barrier_reef',
          /* the universe closed, 4 Sep */
          'weather', 'climate', 'greenhouse_effect',
          /* geography wave, 3 Sep */
          'british_empire', 'austria_hungary', 'czechoslovakia', 'yugoslavia',
          'africa', 'asia', 'europe', 'north_america', 'south_america',
          /* unblocking-nouns wave, 2 Sep */
          'atmosphere', 'aurora', 'great_oxidation_event', 'snowball_earth',
          /* completeness-audit wave, 2 Sep */
          'angola', 'belarus', 'benin', 'biome', 'botswana', 'bulgaria', 'burkina_faso', 'cameroon',
          'canada', 'central_african_republic', 'chad', 'continental_drift', 'crust', 'cuba', 'earth_core', 'eritrea',
          'finland', 'gabon', 'guatemala', 'guinea', 'guyana', 'honduras', 'ice_age', 'iceland',
          'iraq', 'kyrgyzstan', 'liberia', 'libya', 'malawi', 'mali', 'mantle', 'mauritania',
          'mexico', 'mozambique', 'myanmar', 'namibia', 'nicaragua', 'niger', 'norway', 'oman',
          'pangaea', 'plate_tectonics', 'power_grid', 'republic_of_the_congo', 'romania', 'somalia', 'south_sudan', 'subduction',
          'sudan', 'suriname', 'syria', 'tajikistan', 'tunisia', 'turkmenistan', 'uganda', 'ukraine',
          'united_states', 'yemen', 'zambia', 'zimbabwe',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'silk_road', 'continent', 'ocean', 'equator', 'hemisphere', 'latitude', 'longitude', 'prime_meridian', 'time_zone', 'tropic_of_cancer', 'tropic_of_capricorn', 'steppe', 'savanna', 'border', 'country', 'nation_state', 'population_density', 'photic_zone', 'aphotic_zone', 'twilight_zone', 'pelagic_zone', 'benthic_zone', 'upwelling', 'epipelagic_zone', 'mesopelagic_zone', 'bathypelagic_zone', 'abyssopelagic_zone', 'abyssal_plain', 'trade_winds', 'thermocline', 'ocean_current', 'coriolis_effect', 'gyre', 'el_nino', 'thermohaline_circulation', 'great_pacific_garbage_patch', 'permafrost', 'antarctica', 'arctic', 'china', 'japan', 'india', 'mongolia', 'kazakhstan', 'nepal', 'indonesia', 'philippines', 'thailand', 'cambodia', 'laos', 'vietnam', 'malaysia', 'north_korea', 'south_korea', 'afghanistan', 'uzbekistan', 'pakistan', 'bangladesh', 'australia', 'new_zealand', 'papua_new_guinea', 'halleys_comet', 'cultural_hearth', 'culture_region', 'sahara', 'nile', 'amazon_river', 'andes', 'alps', 'mediterranean_sea', 'argentina', 'brazil', 'chile', 'peru', 'colombia', 'venezuela', 'bolivia', 'ecuador', 'paraguay', 'uruguay', 'nigeria', 'egypt', 'south_africa', 'kenya', 'ethiopia', 'morocco', 'algeria', 'ghana', 'tanzania', 'senegal', 'democratic_republic_of_the_congo', 'madagascar', 'france', 'germany', 'italy', 'spain', 'united_kingdom', 'poland', 'greece', 'sweden', 'turkiye', 'saudi_arabia', 'iran',
          'primordial_soup', 'planetesimal', 'moon', 'comet', 'asteroid', 'storm', 'hurricane', 'blizzard', 'sky', 'sea',
          // did you know batch 1 — thousands of kilometres long, same regional scale
          'great_wall',
          // weather batch 2 — storm-system and climate-zone scale, same as storm/hurricane above
          'supercell', 'monsoon', 'anticyclone', 'low_pressure', 'warm_front', 'cold_front',
          'tropical_climate', 'arid_climate', 'temperate_climate',
          'tundra', 'desert', 'taiga', 'rainforest',
          // tech breakthroughs batch 1 — a worldwide network, the same planet-spanning bucket as sky/sea/desert
          'internet',
          // living-earth batch 1 — a plate, a plate boundary, or the fault system/ridge it forms, all continent-to-ocean-basin scale like desert/tundra/sea; earthquake grouped with the storm/hurricane phenomena it belongs beside
          'tectonic_plate', 'divergent_boundary', 'convergent_boundary', 'transform_boundary', 'mid_ocean_ridge', 'earthquake',
          // sandboxels gapfill batch 1 — a rotating vortex and an ocean-basin-crossing wave, the same
          // storm/hurricane-scale phenomenon bucket as earthquake; wind shear is the atmosphere-deep
          // differential that drives them, same scale as the storm system it forms over
          'wind_shear', 'tornado', 'tsunami'],
  '9':   [
          /* the universe closed, 4 Sep */
          'space', 'spacetime',
          /* mathematics, time and power, 4 Sep — R3 continued */
          'sunlight',
          /* head nouns, 4 Sep — R2, the umbrella pass */
          'giant', 'dwarf',
          /* umbrella waves, 3 Sep */
          'matter', 'life',
          /* unblocking-nouns wave, 2 Sep */
          'apparent_magnitude', 'asteroid_belt', 'astronomical_unit', 'binary_star', 'coronal_mass_ejection', 'cosmic_inflation', 'escape_velocity', 'event_horizon',
          'gravitational_lensing', 'gravitational_wave', 'gravity', 'heliosphere', 'hubbles_law', 'light_year', 'magnetosphere', 'main_sequence',
          'observable_universe', 'orbit', 'parsec', 'planetary_nebula', 'red_dwarf', 'solar_system', 'stellar_classification', 'sunspot',
          'supernova_remnant',
          /* microbio wave, 2 Sep */
          'big_bang', 'universe',
          // A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          'bok_globule', 'cometary_globule', 'herbig_haro_object', 't_tauri_star', 'herbig_ae_be_star', 'fu_orionis_star', 'sirius', 'betelgeuse', 'rigel', 'deneb', 'vega', 'altair', 'arcturus', 'procyon', 'aldebaran', 'regulus', 'antares', 'capella', 'castor', 'pollux', 'polaris', 'cigar_galaxy', 'whirlpool_galaxy', 'ring_nebula', 'alpha_centauri', 'proxima_centauri', 'virgo_cluster',
          'star', 'red_giant', 'white_dwarf', 'neutron_star', 'black_hole', 'supernova', 'nebula', 'planet', 'gas_giant', 'ice_giant', 'plasma', 'sun',
          // eyewitness universe batch 1 — everything astronomical/cosmological this
          // scale system has no bucket bigger than: stars, nebulae, galaxies, and
          // the universe's own large-scale abstractions all share this ceiling,
          // same as star/nebula/black_hole/planet above
          'protostar', 'brown_dwarf', 'supergiant', 'pulsar', 'crab_nebula',
          'galaxy', 'milky_way', 'andromeda_galaxy', 'spiral_galaxy', 'elliptical_galaxy',
          'barred_spiral_galaxy', 'lenticular_galaxy', 'local_group', 'galaxy_cluster',
          'supercluster', 'supermassive_black_hole', 'accretion_disc', 'active_galaxy',
          'quasar', 'seyfert_galaxy', 'radio_galaxy', 'exoplanet', 'cepheid_variable',
          'spectrum', 'redshift', 'dark_energy', 'dark_matter', 'cosmic_microwave_background',
          'globular_cluster', 'orion_nebula', 'pleiades',
          // planets batch 1 — the Sun's own planets, real moons, and ring systems,
          // same ceiling scale as planet/gas_giant/ice_giant above
          'mercury_planet', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus_planet',
          'neptune', 'pluto', 'io', 'europa', 'ganymede', 'callisto', 'saturn_rings',
          'cassini_division', 'titan', 'enceladus', 'mimas', 'titania', 'oberon',
          'miranda', 'triton', 'phobos', 'deimos', 'charon', 'ceres', 'eris', 'great_red_spot',
          // planets batch 2 — Neptune's own vanished storm, same ceiling as great_red_spot;
          // dwarf_planet is the taxonomic sibling of pluto/ceres/eris above; kuiper_belt and
          // oort_cloud are vast regions, same "big cosmic thing" tier as nebula/galaxy; solar_wind
          // is the Sun's own plasma in motion, same tier as plasma/sun; tidal_locking isn't a size
          // claim, filed at the real moons' own tier
          'great_dark_spot', 'dwarf_planet', 'kuiper_belt', 'oort_cloud', 'solar_wind', 'tidal_locking'],
  '5':   [
          /* places batch 10, 4 Sep. 117 km coast to coast */
          'hadrians_wall',
          /* places batch 1 — the Senj worked example, 4 Sep. a 145 km range */
          'velebit',// A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          /* completeness-audit wave, 2 Sep */
          'albania', 'armenia', 'azerbaijan', 'bahamas', 'belgium', 'belize', 'bhutan', 'bosnia_and_herzegovina',
          'burundi', 'cabo_verde', 'comoros', 'costa_rica', 'croatia', 'cyprus', 'czechia', 'denmark',
          'djibouti', 'dominican_republic', 'el_salvador', 'equatorial_guinea', 'estonia', 'eswatini', 'gambia', 'georgia',
          'guinea_bissau', 'haiti', 'hungary', 'jamaica', 'jordan', 'kiribati', 'kuwait', 'latvia',
          'lesotho', 'lithuania', 'luxembourg', 'marshall_islands', 'mauritius', 'micronesia', 'moldova', 'montenegro',
          'north_macedonia', 'palau', 'panama', 'qatar', 'rwanda', 'sao_tome_and_principe', 'serbia', 'seychelles',
          'sierra_leone', 'slovakia', 'slovenia', 'solomon_islands', 'timor_leste', 'togo', 'tonga', 'trinidad_and_tobago',
          'tuvalu', 'united_arab_emirates', 'vanuatu',
          'atlantis', 'chicxulub_crater', 'sri_lanka', 'maldives', 'taiwan', 'brunei', 'fiji', 'samoa', 'portugal', 'netherlands', 'switzerland', 'ireland', 'austria', 'israel', 'lebanon',
          ],
  '7':   [
          /* time as a period, 4 Sep — a span of history, not an object */
          'season', 'era', 'past', 'future', 'prehistory', 'bronze_age', 'iron_age', 'antiquity', 'middle_ages', 'renaissance', 'modernity', 'infinity',// A0b scale-fill batch, 2 Sep — closing the 2166-element scale.json gap, classified by 15 parallel research passes against this file's existing conventions
          /* unblocking-nouns wave, 2 Sep */
          'soviet_union',
          'russia',
          ],

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
