#!/usr/bin/env node
/**
 * strip.mjs — render a named handful of items on one page.
 *
 * The contact sheet is 230 items and several thousand pixels tall, which makes
 * it useless for looking closely at four drawings you just changed. This
 * renders exactly the ids you name, big, on one screen.
 *
 * Usage:  node tools/strip.mjs cell ribosome beta_sheet > /tmp/strip.html
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = f => JSON.parse(readFileSync(join(root, f), 'utf8'));
const art = R('data/art.json'), pal = R('data/palette.json'), els = R('data/elements.json');
const name = Object.fromEntries(els.map(e => [e.id, e.name]));

const ids = process.argv.slice(2).filter(id => art[id]);
if (!ids.length) { console.error('name some ids that exist'); process.exit(1); }

const paint = r => typeof r !== 'string' ? 'var(--gh)'
  : r[0] === '#' ? r : r.includes('-') ? `var(--c-${r})` : `var(--${r})`;
const shape = s => ({
  p: () => `<path d="${s[1]}" fill="${paint(s[2])}"/>`,
  s: () => `<path d="${s[1]}" fill="none" stroke="${paint(s[2])}" stroke-width="${s[3]}" stroke-linecap="round" stroke-linejoin="round"/>`,
  c: () => `<circle cx="${s[1]}" cy="${s[2]}" r="${s[3]}" fill="${paint(s[4])}"/>`,
  e: () => `<ellipse cx="${s[1]}" cy="${s[2]}" rx="${s[3]}" ry="${s[4]}" fill="${paint(s[5])}"/>`,
  g: () => `<g transform="rotate(${s[1]} ${s[2]} ${s[3]})">${s[4].map(shape).join('')}</g>`,
}[s[0]] || (() => ''))();

let vars = '';
for (const [k, v] of Object.entries(pal.categories)) vars += `--c-${k}-bs:${v.hex};--c-${k}-hi:${v.hi.hex};--c-${k}-lo:${v.lo.hex};`;
for (const [k, v] of Object.entries(pal.surfaces)) vars += `--s-${k}:${v.hex};`;
vars += `--ik:${pal.surfaces.ink.hex};--gh:${pal.surfaces.rule.hex};--ground:${pal.surfaces.ground.hex};--discovery:${pal.surfaces.discovery.hex};`;
const cat = Object.keys(pal.categories).map(k =>
  `svg[data-cat="${k}"]{--bs:var(--c-${k}-bs);--hi:var(--c-${k}-hi);--lo:var(--c-${k}-lo)}`).join('');

const cols = Math.min(ids.length, 6);
process.stdout.write(`<meta charset="utf-8"><title>strip</title><style>:root{${vars}}${cat}
body{margin:0;background:var(--s-ground);color:var(--s-ink);
  font:400 13px/1.4 "Source Serif 4",Georgia,serif;padding:26px;
  display:grid;grid-template-columns:repeat(${cols},1fr);gap:20px;align-content:start}
figure{margin:0;text-align:center}
svg{width:100%;aspect-ratio:1;background:var(--s-panel);border:1px solid var(--s-rule);
  border-radius:3px;padding:9px}
figcaption{margin-top:8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.sm{display:flex;gap:10px;justify-content:center;margin-top:10px}
.sm svg{width:34px;height:34px;padding:3px}
</style>` + ids.map(id =>
  `<figure><svg viewBox="0 0 60 60" data-cat="${art[id].c}">${art[id].s.map(shape).join('')}</svg>` +
  `<figcaption>${name[id] || id}</figcaption>` +
  `<div class="sm"><svg viewBox="0 0 60 60" data-cat="${art[id].c}">${art[id].s.map(shape).join('')}</svg></div>` +
  `</figure>`).join(''));
