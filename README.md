# Loam

**A combination game where every recipe is a real fact, and the game shows you
the receipts.**

Four starting things — stone, water, sun, seed — and everything else in the world
made from them. Drag one onto another, or drop one on a tool. Every discovery
tells you the actual mechanism and links a source.

*Pack one: Dirt to Dinner — soil, fire, farming, fermentation and cooking.*

```
🍰 Cake  ⟵ 🔥 Heat
└─ 🥣 Cake Batter
   ├─ 🥣 Cake Mix
   │  ├─ 🧈 Creamed Butter ⟵ 🧈 Butter ⟵ 🥛 Cream ⟵ 🥛 Milk ⟵ 🐄 Cow ⟵ 🐂 Aurochs
   │  └─ 🥚 Egg ⟵ 🐔 Chicken ⟵ 🌾 Pasture ⟵ 🍀 Grass ⟵ 🟫 Soil ⟵ 🪨 Stone
   └─ 🥣 Flour ⟵ 🟨 Grain ⟵ 🌾 Wheat ⟵ 🍀 Grass

Cake is 10 chemical elements and starlight: C · H · O · N · S · P · Si · K · Al · He
```

## Why it exists

The genre splits cleanly and nobody occupies the good quadrant. Little Alchemy
and Doodle God are fun but invent their chemistry — *horse + rainbow = unicorn*.
Infinite Craft generates infinite plausible nonsense with a language model.
ChemCrafter is accurate but narrow.

Loam is the one where the recipes are true and you can check them.

`sand + ash → glass` · `copper + tin → bronze` · `milk ⟶ ferment → yoghurt` ·
`limestone + clay ⟶ heat → cement`

## The state of it

| | |
|---|---|
| Elements | **197** |
| Recipes | **395** |
| Reachable from the four starters | **197 / 197** |
| Routes per element | **2.01** |
| Sourced | **395 / 395**, every URL machine-validated |
| Claims audited against primary reporting | **64** — of which **17 were wrong** |

That last row is the point of the project. Auditing our own confident, fluent
prose found **a 36% first-pass error rate**. Verification is not optional, and it
is not something you can skip because the writing sounds right.

## How it is kept honest

**No URL in this repository was written by hand.** `data/sources.json` holds
article *titles*; `tools/sources.mjs` resolves them against the live Wikipedia
API, follows redirects, and fails on anything that does not exist. The first run
caught one title that did not exist and four that silently redirected elsewhere.

Two flags separate what is checkable from what is checked:

- `verified` — independently checked against primary reporting. Shows a ✓ in game.
- `supported` — standard mechanism the cited article states directly.

`node tools/validate.mjs` is the gate. It proves every element is reachable from
the four starters *given the verb unlock order*, rejects ambiguous gestures,
requires a source on every recipe, and warns when an element has only one route
in. No source, no ship.

## Two gestures, and only two

**Merge** — drag element onto element. Commutative. `flour + water → dough`
**Process** — drag element onto a verb tool. `clay ⟶ 🔥 Heat → pot`

Six process verbs — Wait, Crush, Chill, Heat, Cut, Ferment — unlock through play:
Heat needs `fire`, Cut needs `flint`, Ferment needs `yeast`. This is the main
mechanical departure from the genre, and it teaches the actual scientific point:
outcome depends on process, not just ingredients.

## Below the game

A read-only substrate that appears at the bottom of a provenance tree: the full
periodic table (all 118 validated), compounds with molecular formulas, all 20
amino acids with residue *and* free formulas, six named bond types, and the
biological organisation ladder — atoms → molecules → monomers → polymers →
structures → assemblies → cells → tissues.

## Run it

The prototype is a single offline HTML file. No build step, no server.

```
open prototype/index.html
```

To work on the data:

```
node tools/validate.mjs        # integrity, reachability, source gate
node tools/sources.mjs check   # resolve every title against Wikipedia
node tools/graph.mjs stats     # difficulty curve
node tools/provenance.mjs cake # full ancestry, down to the elements
node tools/redundancy.mjs list # single-route elements, worst blockers first
node tools/build-prototype.mjs # bake the data into prototype/index.html
```

Edit `prototype/template.html`, never the built file.

## Data

```
data/elements.json   id, name, emoji, shelf, tags, fact, starter?, terminal?
data/recipes.json    in[], verb?, out, why, src, verified?/supported?
data/verbs.json      the six process verbs and their unlock conditions
data/bedrock.json    atoms, compounds, amino acids, linkages, tiers
data/sources.json    article titles, resolved to URLs by tools/sources.mjs
```

Whimsy is not removed, it is quarantined. `workshop` recipes are real and carry a
green *this is how it works* card. `folklore` recipes — Stone Soup, the
Philosopher's Stone — carry a purple *a story we tell* card. The game tells you
which is which, which is a media-literacy lesson delivered as a collection
mechanic.

## Contributing

Corrections are the most valuable contribution. If a `why` is wrong, open an
issue with a source — we have a documented 36% first-pass error rate and no
illusions about it.

New recipes need: a real mechanism, a source that resolves, and preferably a
second true route into the same element. `node tools/validate.mjs` must pass.

## Licence

CC BY-NC 4.0 — see [LICENSE](LICENSE). Use it, learn from it, build on it.
Don't sell it.
