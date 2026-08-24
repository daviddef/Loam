# Vendored reference data

## munsell-real.dat

The Munsell renotation data — real (physically realisable) colours.

- Source: Munsell Color Science Laboratory, Rochester Institute of Technology
- URL: https://www.rit-mcsl.org/MunsellRenotation/real.dat
- Retrieved: 2026-08-25
- Columns: `h V C x y Y` — Munsell hue, value, chroma, then CIE 1931 x, y
  chromaticity and Y luminance factor (%), under **Illuminant C, 2° observer**.
- 2734 rows.

This is the dataset behind the Munsell soil colour book that soil scientists
carry in the field. `tools/palette.mjs` converts the notations we use into
sRGB (adapting C -> D65 by Bradford) so that Loam's palette is *derived*, not
eyeballed — the same standard we hold the recipes to.

Nothing in the game reads this file at runtime. It is the input to
`tools/palette.mjs`, whose output (`data/palette.json`) is what ships.
