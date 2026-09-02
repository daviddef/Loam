#!/usr/bin/env node
// Bakes the data into the prototype so it opens by double-click (file:// blocks fetch).
import { readFileSync, writeFileSync } from 'node:fs';
const u = (f) => new URL(f, import.meta.url);
const J = (f) => JSON.parse(readFileSync(u(f), 'utf8'));

const data = {
  elements: J('../data/elements.json'),
  recipes:  J('../data/recipes.json'),
  verbs:    J('../data/verbs.json').verbs,
  bedrock:  J('../data/bedrock.json'),
  taxonomy: J('../data/taxonomy.json'),
};
const art = J('../data/art.json');
const palette = J('../data/palette.json');
const scale = J('../data/scale.json');
const cautions = J('../data/cautions.json').hazards;
const labels = J('../data/labels.json');
const allergens = J('../data/allergens.json');
const reactions = J('../data/reactions.json');
const artRender = readFileSync(u('../prototype/art-render.js'), 'utf8');

/**
 * Emit the palette as CSS custom properties.
 *
 * This is generated rather than written by hand so the stylesheet can never
 * drift from data/palette.json — which is itself derived from the Munsell
 * renotation table. Change a notation, rebuild, and the whole game moves.
 */
function paletteCSS() {
  const cat = palette.categories, sur = palette.surfaces;
  const lines = [];
  lines.push('  /* Derived from the Munsell renotation data — see tools/palette.mjs.');
  lines.push('     Do not hand-edit: run `node tools/palette.mjs` instead. */');
  for (const [k, v] of Object.entries(cat)) {
    lines.push(`  --c-${k}-bs:${v.hex};   /* ${v.notation} */`);
    lines.push(`  --c-${k}-hi:${v.hi.hex};   /* ${v.hi.notation} */`);
    lines.push(`  --c-${k}-lo:${v.lo.hex};   /* ${v.lo.notation} */`);
  }
  for (const [k, v] of Object.entries(sur)) lines.push(`  --s-${k}:${v.hex};   /* ${v.notation} */`);
  return lines.join('\n');
}

/** Per-category role bindings, so a drawing reads its own colours from [data-cat]. */
function catCSS() {
  return Object.keys(palette.categories).map(k => [
    `  .art[data-cat="${k}"]{--bs:var(--c-${k}-bs);--hi:var(--c-${k}-hi);--lo:var(--c-${k}-lo)}`,
    // The card reads its category off the drawing it contains, so no call site
    // has to remember to label it.
    `  .chip:has(.art[data-cat="${k}"]){--fam:var(--c-${k}-bs);--fam-rule:var(--c-${k}-hi)}`,
    `  body.t-manual .chip:has(.art[data-cat="${k}"]){--fam-rule:var(--c-${k}-bs)}`,
  ].join('\n')).join('\n');
}

let html = readFileSync(u('../prototype/template.html'), 'utf8');

/* The two interface marks are baked in rather than rendered at runtime: they sit
 * in the header, and a header that pops in after the script runs looks broken. */
function uiGlyph(id) {
  const rec = art[id];
  const paint = r => typeof r !== 'string' ? 'var(--gh)'
    : r[0] === '#' ? r : r.includes('-') ? `var(--c-${r})` : `var(--${r})`;
  const shape = s => ({
    p: () => `<path d="${s[1]}" fill="${paint(s[2])}"/>`,
    s: () => `<path d="${s[1]}" fill="none" stroke="${paint(s[2])}" stroke-width="${s[3]}" stroke-linecap="round" stroke-linejoin="round"/>`,
    c: () => `<circle cx="${s[1]}" cy="${s[2]}" r="${s[3]}" fill="${paint(s[4])}"/>`,
    e: () => `<ellipse cx="${s[1]}" cy="${s[2]}" rx="${s[3]}" ry="${s[4]}" fill="${paint(s[5])}"/>`,
    g: () => `<g transform="rotate(${s[1]} ${s[2]} ${s[3]})">${s[4].map(shape).join('')}</g>`,
  }[s[0]] || (() => ''))();
  return `<svg class="art" viewBox="0 0 60 60" data-cat="${rec.c}" aria-hidden="true">` +
         rec.s.map(shape).join('') + '</svg>';
}

for (const [token, value] of [
  ['__UI_SETTINGS__', uiGlyph('ui_settings')],
  ['__UI_TIDY__', uiGlyph('ui_tidy')],
  ['__UI_UNDO__', uiGlyph('ui_undo')],
  ['__UI_NUDGE__', uiGlyph('ui_nudge')],
  ['__UI_SCAN__', uiGlyph('ui_scan')],
  ['__UI_CIRCLE__', uiGlyph('ui_circle')],
  ['__UI_MOTES__', uiGlyph('ui_motes')],
  ['__UI_CONSOLIDATE__', uiGlyph('ui_consolidate')],
  ['__UI_TABLE__', uiGlyph('ui_table')],
  ['__UI_SHUTTER__', uiGlyph('ui_shutter')],
  ['__UI_GALLERY__', uiGlyph('ui_gallery')],
  ['__UI_DIGITS__', uiGlyph('ui_digits')],
  ['__UI_AMINO__', uiGlyph('ui_amino')],
  ['__UI_LADDER__', uiGlyph('ui_ladder')],
  ['__UI_EYE__', uiGlyph('ui_eye')],
  ['__UI_CARCINOGEN__', uiGlyph('ui_carcinogen')],
  // ui_shelf came back: it is the All/Found toggle's mark now, which is the
  // same idea the Shelf tab used to carry.
  ['__UI_SHELF__', uiGlyph('ui_shelf')],
  ['__UI_ELEMENTS__', uiGlyph('ui_elements')],
  ['__UI_ANIMALS__', uiGlyph('ui_animals')],
  ['__PALETTE_CSS__', paletteCSS()],
  ['__CATEGORY_CSS__', catCSS()],
  ['__ART_RENDER__', artRender],
]) {
  if (!html.includes(token)) { console.error(`template is missing ${token}`); process.exit(1); }
  html = html.replaceAll(token, value);
}

// Parse the page script before shipping it. A syntax error here kills the whole
// file silently — the page renders as an empty shell with nothing in the console.
const script = html.match(/<script>([\s\S]*?)<\/script>/);
if (!script) { console.error('no <script> block found'); process.exit(1); }
try {
  new Function(script[1]
    .replace('__GAME_DATA__', '{elements:[],recipes:[],verbs:[],bedrock:{atoms:[],compounds:[],composition:{}},taxonomy:{ranks:[],groups:[]}}')
    .replace('__ART_DATA__', '{}')
    .replace('__SCALE_DATA__', '{}')
    .replace('__CAUTION_DATA__', '{}')
    .replace('__LABEL_DATA__', '{aliases:{},vague:{}}')
    .replace('__ALLERGEN_DATA__', '{}')
    .replace('__REACTION_DATA__', '{}'));
} catch (e) {
  console.error(`prototype script does not parse: ${e.message}`);
  process.exit(1);
}

html = html.replace('__GAME_DATA__', JSON.stringify(data))
           .replace('__ART_DATA__', JSON.stringify(art))
           .replace('__SCALE_DATA__', JSON.stringify(scale))
           .replace('__CAUTION_DATA__', JSON.stringify(cautions))
           .replace('__LABEL_DATA__', JSON.stringify(labels))
           .replace('__ALLERGEN_DATA__', JSON.stringify(allergens))
           .replace('__REACTION_DATA__', JSON.stringify(reactions));

// Every item must have a drawing. A missing one renders as an empty square,
// which is the kind of thing that ships unnoticed.
const undrawn = data.elements.filter(e => !art[e.id]).map(e => e.id);
if (undrawn.length) { console.error(`no art for: ${undrawn.join(', ')}`); process.exit(1); }
const unsized = data.elements.filter(e => !scale[e.id]).map(e => e.id);
if (unsized.length) { console.error(`no scale for: ${unsized.join(', ')}`); process.exit(1); }

writeFileSync(u('../prototype/index.html'), html);
console.log(`built prototype/index.html — ${data.elements.length} elements, ${data.recipes.length} recipes, ` +
            `${Object.keys(art).length} drawings, ${(html.length / 1024).toFixed(0)} KB`);
