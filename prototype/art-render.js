/* ── art renderer ─────────────────────────────────────────────────────────
 * Turns a shape record from data/art.json into inline SVG.
 *
 * No shape carries a colour. Every fill and stroke resolves to a CSS custom
 * property, so a theme is a stylesheet — not a second set of drawings.
 *
 *   lo | bs | hi          the item's own category, set by [data-cat]
 *   ik | gh               ink and ghost, global
 *   ground | discovery    surfaces, global
 *   plant-bs, fire-hi ... another category's colour, for a detail
 *   #RRGGBB               a literal — reserved for CPK atom colours
 */
function artPaint(role) {
  if (typeof role !== 'string') return 'var(--gh)';
  if (role.charCodeAt(0) === 35) return role;              // '#'
  if (role.indexOf('-') > 0) return `var(--c-${role})`;
  return `var(--${role})`;
}

function artShape(s) {
  switch (s[0]) {
    case 'p': return `<path data-f d="${s[1]}" fill="${artPaint(s[2])}"/>`;
    case 's': return `<path data-s d="${s[1]}" fill="none" stroke="${artPaint(s[2])}" ` +
                     `stroke-width="${s[3]}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'c': return `<circle data-f cx="${s[1]}" cy="${s[2]}" r="${s[3]}" fill="${artPaint(s[4])}"/>`;
    case 'e': return `<ellipse data-f cx="${s[1]}" cy="${s[2]}" rx="${s[3]}" ry="${s[4]}" fill="${artPaint(s[5])}"/>`;
    case 'g': return `<g transform="rotate(${s[1]} ${s[2]} ${s[3]})">${s[4].map(artShape).join('')}</g>`;
    default:  return '';
  }
}

function artSVG(id, cls) {
  const rec = ART[id];
  if (!rec) return `<svg class="art${cls ? ' ' + cls : ''}" viewBox="0 0 60 60" aria-hidden="true"></svg>`;
  return `<svg class="art${cls ? ' ' + cls : ''}" viewBox="0 0 60 60" data-cat="${rec.c}" aria-hidden="true">` +
         rec.s.map(artShape).join('') + '</svg>';
}

function artCat(id) { return (ART[id] || { c: 'craft' }).c; }
