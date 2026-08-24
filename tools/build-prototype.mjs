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
};
const art = J('../data/art.json');
const palette = J('../data/palette.json');
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
    `  .chip:has(.art[data-cat="${k}"]){--fam:var(--c-${k}-bs)}`,
  ].join('\n')).join('\n');
}

let html = readFileSync(u('../prototype/template.html'), 'utf8');

for (const [token, value] of [
  ['__PALETTE_CSS__', paletteCSS()],
  ['__CATEGORY_CSS__', catCSS()],
  ['__ART_RENDER__', artRender],
]) {
  if (!html.includes(token)) { console.error(`template is missing ${token}`); process.exit(1); }
  html = html.replace(token, value);
}

// Parse the page script before shipping it. A syntax error here kills the whole
// file silently — the page renders as an empty shell with nothing in the console.
const script = html.match(/<script>([\s\S]*?)<\/script>/);
if (!script) { console.error('no <script> block found'); process.exit(1); }
try {
  new Function(script[1]
    .replace('__GAME_DATA__', '{elements:[],recipes:[],verbs:[],bedrock:{atoms:[],compounds:[],composition:{}}}')
    .replace('__ART_DATA__', '{}'));
} catch (e) {
  console.error(`prototype script does not parse: ${e.message}`);
  process.exit(1);
}

html = html.replace('__GAME_DATA__', JSON.stringify(data))
           .replace('__ART_DATA__', JSON.stringify(art));

// Every item must have a drawing. A missing one renders as an empty square,
// which is the kind of thing that ships unnoticed.
const undrawn = data.elements.filter(e => !art[e.id]).map(e => e.id);
if (undrawn.length) { console.error(`no art for: ${undrawn.join(', ')}`); process.exit(1); }

writeFileSync(u('../prototype/index.html'), html);
console.log(`built prototype/index.html — ${data.elements.length} elements, ${data.recipes.length} recipes, ` +
            `${Object.keys(art).length} drawings, ${(html.length / 1024).toFixed(0)} KB`);
