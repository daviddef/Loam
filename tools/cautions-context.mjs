#!/usr/bin/env node
/* PRESENCE IS NOT SUPPORT.
 *
 * tools/cautions-suggest.mjs can tell you a figure appears in an article. It
 * cannot tell you the figure is about the thing you think it is, and this
 * session has collected the proof: a nicotine lethal dose that matched
 * "1400-1000 BCE" and "60 million trees"; a perforated artery killing "about
 * 20%" that matched "4 million people during 2015"; a 90% eradication rate
 * that matched "327,000 in 1990"; an H. pylori ulcer rate that matched urease
 * being 10% of total protein weight and a 2005 Nobel Prize.
 *
 * So this prints every figure a note asserts WITH THE SENTENCE AROUND IT in
 * the candidate article. It is the reading step, made fast — not skipped.
 *
 *   node tools/cautions-context.mjs <hazard_id> <Article_Title> [...pairs]
 */
import { readFileSync } from 'node:fs';
const C = JSON.parse(readFileSync('data/cautions.json','utf8'));
const args = process.argv.slice(2);
const figuresIn = t => [...new Set([...String(t).matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g)]
  .map(m=>m[0]).filter(r=>{const v=Number(r.replace(/,/g,''));return Number.isFinite(v)&&!(v<10&&Number.isInteger(v))}))];
for (let i=0;i<args.length;i+=2) {
  const id=args[i], title=args[i+1];
  const h=C.hazards[id];
  if(!h){console.log('no such hazard: '+id);continue}
  let text=null;
  for(let a=0;a<3&&!text;a++){ if(a) await new Promise(r=>setTimeout(r,3000*a));
    try{const r=await fetch('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles='+encodeURIComponent(title),{headers:{'User-Agent':'Loam/1.0 (audit)'}});
      text=(await r.json()).query.pages[0].extract||'';}catch{} }
  console.log('\n'+'='.repeat(72));
  console.log(id+'   ->   '+title+(text?'  ('+text.length+'c)':'  [UNREADABLE]'));
  console.log('NOTE: '+h.note);
  if(!text){continue}
  console.log('--- each asserted figure, in its sentence:');
  for(const f of figuresIn(h.note||'')){
    const plain=f.replace(/,/g,'');
    const forms=[f,plain,Number(plain).toLocaleString('en-US')];
    let found=false;
    for(const form of forms){
      const i=text.indexOf(form);
      if(i<0) continue;
      const s=text.lastIndexOf('.',i), e=text.indexOf('.',i+form.length);
      console.log('  ['+f+'] '+text.slice(s<0?0:s+1, e<0?i+120:e+1).trim().replace(/\s+/g,' ').slice(0,210));
      found=true; break;
    }
    if(!found) console.log('  ['+f+'] NOT PRESENT in any form');
  }
  await new Promise(r=>setTimeout(r,1500));
}
