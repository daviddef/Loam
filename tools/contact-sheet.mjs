#!/usr/bin/env node
/**
 * contact-sheet.mjs — render every item, in every theme, on one page.
 *
 * This is the thing you look at before committing to an art direction, and
 * the thing you look at after every batch of drawings. If two items in a
 * category stop looking like they came from the same hand, it shows up here
 * first.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = f => readFileSync(join(root, f), 'utf8');

const elements = JSON.parse(R('data/elements.json'));
const art = JSON.parse(R('data/art.json'));
const palette = JSON.parse(R('data/palette.json'));
const render = R('prototype/art-render.js');

/* Theme tokens are generated from the palette, so this page can never drift
 * from what the game actually ships. */
function vars() {
  let css = '';
  for (const [k, v] of Object.entries(palette.categories)) {
    css += `  --c-${k}-bs:${v.hex}; --c-${k}-hi:${v.hi.hex}; --c-${k}-lo:${v.lo.hex};\n`;
  }
  for (const [k, v] of Object.entries(palette.surfaces)) css += `  --s-${k}:${v.hex};\n`;
  // The global roles every drawing can reach for, whatever its category.
  css += `  --ik:${palette.surfaces.ink.hex};\n`;
  css += `  --gh:${palette.surfaces.rule.hex};\n`;
  css += `  --ground:${palette.surfaces.ground.hex};\n`;
  css += `  --discovery:${palette.surfaces.discovery.hex};\n`;
  return css;
}
const catRules = Object.keys(palette.categories).map(k =>
  `.art[data-cat="${k}"]{--bs:var(--c-${k}-bs);--hi:var(--c-${k}-hi);--lo:var(--c-${k}-lo)}`).join('\n');

/* The three items the research says decide whether the direction holds. */
const DECIDER = ['soil', 'spaghetti_meatballs', 'disulfide'];

const byCat = {};
for (const e of elements) (byCat[art[e.id].c] ||= []).push(e);

const cell = e => `<figure><div class="frame">__ART_${e.id}__</div>` +
  `<figcaption><b>${e.name}</b><i>${e.id}</i></figcaption></figure>`;

const html = `<meta charset="utf-8">\n<title>Loam Contact Sheet</title>
<style>
:root{
${vars()}
  --paper:#F4E3CA;
}
*{box-sizing:border-box}
body{margin:0;background:var(--s-ground);color:var(--s-ink);
     font:400 14px/1.5 ui-monospace,"SF Mono",Menlo,monospace;padding:26px 22px 80px}
h1{font:600 20px/1.2 Georgia,serif;margin:0 0 2px}
p.sub{color:var(--s-inkQuiet);margin:0 0 22px;font-size:12.5px;max-width:72ch}
h2{font:500 11px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;
   color:var(--s-discovery);margin:30px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--s-rule)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:14px}
figure{margin:0;text-align:center}
.frame{aspect-ratio:1;display:grid;place-items:center;background:var(--s-panel);
       border:1px solid var(--s-rule);border-radius:2px}
.art{width:76%;height:76%;display:block}
figcaption b{display:block;font:500 10.5px/1.25 Georgia,serif;color:var(--s-ink);margin-top:5px;
             letter-spacing:.02em}
figcaption i{display:block;font-style:normal;font-size:8.5px;color:var(--s-inkQuiet);
             letter-spacing:.04em;word-break:break-all}
${catRules}

/* the decider strip */
.decide{display:flex;gap:20px;flex-wrap:wrap;background:var(--s-panel);padding:20px;
        border:1px solid var(--s-rule);border-radius:3px;margin-bottom:8px}
.decide .frame{width:150px;height:150px}
.note{color:var(--s-inkQuiet);font-size:12px;margin:0 0 26px;max-width:70ch}

/* size ladder — does it survive the shrink? */
.ladder{display:flex;align-items:flex-end;gap:22px;background:var(--s-panel);
        padding:20px;border:1px solid var(--s-rule);border-radius:3px}
.ladder div{text-align:center}
.ladder .art{display:block;margin:0 auto 6px}
.ladder span{font-size:9px;color:var(--s-inkQuiet)}

/* theme: field manual — same geometry, ink on paper */
.manual{background:var(--paper);padding:20px;border-radius:3px;
  background-image:linear-gradient(#DCCDB0 1px,transparent 1px),linear-gradient(90deg,#DCCDB0 1px,transparent 1px);
  background-size:20px 20px}
.manual .frame{background:transparent;border:0}
.manual figcaption b{color:#2B2115}
.manual figcaption i{color:#7A6A52}
.manual .art [data-f]{fill:none;stroke:#2B2115;stroke-width:1.4;
                      stroke-linejoin:round;stroke-linecap:round}
.manual .art [data-s]{stroke:#2B2115}
.manual{--ik:#2B2115;--gh:#9C8B6E;--ground:#F4E3CA;--discovery:#2B2115}
</style>

<h1>Loam — every item, one hand</h1>
<p class="sub">226 items. Colour never appears in the geometry: each shape names a role and the
theme decides what a role looks like. Everything below is the same drawing data twice.</p>

<h2>The decider</h2>
<p class="note">Soil, Spaghetti &amp; Meatballs, and a Disulfide Bond. If these three look like they
came from the same hand, the direction holds. If they don't, no amount of paper texture saves it.</p>
<div class="decide">${DECIDER.map(id => {
  const e = elements.find(x => x.id === id);
  return `<figure><div class="frame">__ART_${id}__</div><figcaption><b>${e.name}</b><i>${art[id].c}</i></figcaption></figure>`;
}).join('')}</div>

<h2>Does it survive the shrink</h2>
<p class="note">Same item at canvas, shelf and thumbnail size. Anything that turns to mush at 28px
fails — that is where a hatched or fine-line direction dies.</p>
<div class="ladder">${['bread', 'cell', 'wheat', 'fire', 'dna'].map(id =>
  [96, 56, 36, 24].map(px => `<div><div style="width:${px}px;height:${px}px">__ART_${id}__</div><span>${px}</span></div>`).join('')
).join('')}</div>

${Object.entries(byCat).sort((a, b) => b[1].length - a[1].length).map(([c, list]) => `
<h2>${c} · ${list.length}</h2>
<div class="grid">${list.map(cell).join('')}</div>`).join('')}

<h2>Theme · field manual</h2>
<p class="note">The same 226 drawings with one stylesheet swapped: fills become strokes, the ground
becomes graph paper. No geometry was redrawn.</p>
<div class="manual"><div class="grid">${elements.slice(0, 48).map(cell).join('')}</div></div>

<script>
const ART = ${JSON.stringify(art)};
${render}
document.querySelectorAll('.frame,[style*="width"]').forEach(() => {});
</script>`;

/* Substitute the art server-side so the page needs no JS to look right. */
let outHtml = html;
const seen = new Set();
for (const e of elements) seen.add(e.id);
outHtml = outHtml.replace(/__ART_([a-z_]+)__/g, (_, id) => {
  const rec = art[id];
  if (!rec) return '';
  return svgFor(id, rec);
});

function paint(role) {
  if (typeof role !== 'string') return 'var(--gh)';
  if (role.charCodeAt(0) === 35) return role;
  if (role.indexOf('-') > 0) return `var(--c-${role})`;
  return `var(--${role})`;
}
function shape(s) {
  switch (s[0]) {
    case 'p': return `<path data-f d="${s[1]}" fill="${paint(s[2])}"/>`;
    case 's': return `<path data-s d="${s[1]}" fill="none" stroke="${paint(s[2])}" stroke-width="${s[3]}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'c': return `<circle data-f cx="${s[1]}" cy="${s[2]}" r="${s[3]}" fill="${paint(s[4])}"/>`;
    case 'e': return `<ellipse data-f cx="${s[1]}" cy="${s[2]}" rx="${s[3]}" ry="${s[4]}" fill="${paint(s[5])}"/>`;
    case 'g': return `<g transform="rotate(${s[1]} ${s[2]} ${s[3]})">${s[4].map(shape).join('')}</g>`;
    default:  return '';
  }
}
function svgFor(id, rec) {
  return `<svg class="art" viewBox="0 0 60 60" data-cat="${rec.c}" aria-hidden="true">` +
         rec.s.map(shape).join('') + '</svg>';
}

writeFileSync(join(root, 'brand/contact-sheet.html'), outHtml);
console.log(`  wrote brand/contact-sheet.html — ${elements.length} items, ${(outHtml.length / 1024).toFixed(0)} kB`);
