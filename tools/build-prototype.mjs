#!/usr/bin/env node
// Bakes the data into the prototype so it opens by double-click (file:// blocks fetch).
import { readFileSync, writeFileSync } from 'node:fs';
const u = (f) => new URL(f, import.meta.url);
const data = {
  elements: JSON.parse(readFileSync(u('../data/elements.json'), 'utf8')),
  recipes:  JSON.parse(readFileSync(u('../data/recipes.json'), 'utf8')),
  verbs:    JSON.parse(readFileSync(u('../data/verbs.json'), 'utf8')).verbs,
  bedrock:  JSON.parse(readFileSync(u('../data/bedrock.json'), 'utf8')),
};
const template = readFileSync(u('../prototype/template.html'), 'utf8');

// Parse the page script before shipping it. A syntax error here kills the whole
// file silently — the page renders as an empty shell with nothing in the console.
const script = template.match(/<script>([\s\S]*?)<\/script>/);
if (!script) { console.error('no <script> block found'); process.exit(1); }
try {
  new Function(script[1].replace('__GAME_DATA__', '{elements:[],recipes:[],verbs:[],bedrock:{atoms:[],compounds:[],composition:{}}}'));
} catch (e) {
  console.error(`prototype script does not parse: ${e.message}`);
  process.exit(1);
}

const html = template.replace('__GAME_DATA__', JSON.stringify(data));
writeFileSync(u('../prototype/index.html'), html);
console.log(`built prototype/index.html — ${data.elements.length} elements, ${data.recipes.length} recipes, ${(html.length / 1024).toFixed(0)} KB`);
