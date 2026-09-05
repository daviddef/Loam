/* FETCHING THE ARTICLE WE CITED, AND KEEPING IT.
 *
 * Extracted from tools/audit.mjs so the effects audit can use the same
 * machinery rather than a second, subtly different copy of it. The disk cache
 * is shared, which matters more than the code is: Wikipedia throttles this
 * address after a few dozen requests, and an uncached tool can only ever check
 * a fraction of its claims per run — which makes it something you run once
 * rather than something that runs on every change.
 *
 * A throttled run reports every claim as "could not be checked", and that
 * looks exactly like a clean result if you are not paying attention. So the
 * failure count is exported and every caller is expected to print it.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const API = 'https://en.wikipedia.org/w/api.php';
const UA = { 'User-Agent': 'Loam/1.0 (source audit; contact via repo)' };
const CACHE_DIR = join(ROOT, '.cache/articles');
mkdirSync(CACHE_DIR, { recursive: true });

const cachePath = t => join(CACHE_DIR, createHash('sha1').update(t).digest('hex').slice(0, 16) + '.txt');
const readDisk = t => { const f = cachePath(t); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
const writeDisk = (t, text) => { try { writeFileSync(cachePath(t), text); } catch {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const cache = new Map();
const wikiCache = new Map();
export const stats = { failures: 0, fetched: 0, fromCache: 0 };

/** The Wikipedia title inside a cited URL, or null if it is not one. */
export const titleOf = src => {
  const m = /en\.wikipedia\.org\/wiki\/([^#?]+)/.exec(src || '');
  return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
};

/** Plain text of an article, cached on disk and for the run. */
export async function articleText(title) {
  if (cache.has(title)) { stats.fromCache++; return cache.get(title); }
  const disk = readDisk(title);
  if (disk) { stats.fromCache++; cache.set(title, disk); return disk; }
  const url = `${API}?action=query&prop=extracts&explaintext=1&redirects=1&format=json` +
              `&titles=${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(2500 * attempt);
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) break;
      const j = await res.json();
      const page = Object.values(j?.query?.pages || {})[0];
      const text = page && page.extract ? page.extract : null;
      cache.set(title, text);
      if (text) { writeDisk(title, text); stats.fetched++; }
      await sleep(700);
      return text;
    } catch { /* retry */ }
  }
  stats.failures++;
  cache.set(title, null);
  return null;
}

/** The rendered page with tags stripped — the only way to see a transcluded
 *  infobox, and a second chance when the prose alone does not carry a claim. */
export async function renderedText(title) {
  const url = `${API}?action=parse&prop=text&formatversion=2&format=json&page=${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return '';
    const j = await res.json();
    return (j?.parse?.text || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;|&#\d+;/gi, ' ')
      .replace(/\s+/g, ' ');
  } catch { return ''; }
}

/** Wikitext plus the rendered page, for facts that live only in an infobox. */
export async function articleWikitext(title) {
  if (wikiCache.has(title)) return wikiCache.get(title);
  const disk = readDisk('wiki:' + title);
  if (disk) { wikiCache.set(title, disk); return disk; }
  const url = `${API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
              `&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(2500 * attempt);
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) break;
      const j = await res.json();
      const page = (j?.query?.pages || [])[0];
      let wiki = page?.revisions?.[0]?.slots?.main?.content || '';
      wiki += '\n' + await renderedText(title);
      wikiCache.set(title, wiki);
      if (wiki) writeDisk('wiki:' + title, wiki);
      await sleep(400);
      return wiki;
    } catch { /* retry */ }
  }
  wikiCache.set(title, '');
  return '';
}
