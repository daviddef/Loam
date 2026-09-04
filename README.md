# Loam

*Pack one: dirt to dinner*

A combination game where **every recipe carries a source you can open**, and the
game tells you which of its answers are science and which are stories.

The claim is checkability, not infallibility — and that distinction is the whole
point. Auditing 99 of our own confident, fluent, well-written claims against
primary reporting found **48 of them wrong** — a 48% first-pass error rate, and
it has gone *up* as the sample grew. That is the strongest argument this project
has, and it is an argument against trusting anyone's prose, including ours. So every line is sourced, the sources are
machine-verified against live articles, and audited claims are marked as such.

The competitors split cleanly: Little Alchemy and Doodle God are fun but invent
their chemistry; Infinite Craft generates infinite plausible nonsense with an
LLM; ChemCrafter is careful but narrow. Nobody owns *true and fun*. This does.

**The game is the graph.** The app is a viewer for it. So the graph is built,
validated and playtested first — before a line of Swift.

---

## Slice status

| | |
|---|---|
| Domain | Dirt to Dinner, extending into chemistry, metallurgy, biology and reproduction |
| Elements | **7,423** (7,067 workshop · 356 folklore) |
| Recipes | **9,278** (8,349 merges · 929 verb processes) |
| Starters | Stone · Water · Sun · Seed |
| Reachable | **7,423 / 7,423** from the four starters |
| Deepest chain | 51 crafts |
| Sourced | **9,278 / 9,278** recipes, every URL machine-verified |
| Audited | **295** of the first 677 claims checked against primary reporting — **48 were wrong**. That 36% first-pass error rate is why nothing ships unverified. |
| Every claim machine-checked against its own source | numbers **0** unsupported · names **0** unreviewed |
| Routes per element | **1.25** · 5,938 still needing a second route · 1,878 sole-route by design |
| Hazards | **343**, covering 621 elements |
| Scale span | **19 orders of magnitude**, from a carbon atom to the sun |
| Drawings | **7,423**, none of them emoji |
| Colours | **28**, every one a measured Munsell chip |

Run `node tools/graph.mjs path penicillin` for the headline chain: 22 steps from
four rocks to antibiotics, every one of them true.

## The guide

**[guide.html](guide.html)** is the user and architectural guide — how the game
is played, how a thing gets its category, what every checking mechanism asks and
what it caught, where the facts come from, how a real food label is read, and
why every colour is a measured Munsell chip.

It is *generated*, not written: `node tools/guide.mjs` counts the corpus and
emits the page. This file spent a fortnight claiming 6,874 elements while the
corpus held 7,423, which is precisely the argument for not hand-maintaining a
second one. `node tools/guide.mjs --check` fails if it has drifted.

## Design model

**Two gestures, and only two.**

- **Merge** — drag element onto element. Commutative. `flour + water → dough`
- **Process** — drag element onto a verb tool. Unary. `clay ⟶ Heat → pot`

The verb layer is the main mechanical departure from the genre. Little Alchemy
is `A + B` and nothing else; adding six process verbs multiplies content from
the same word list *and* teaches the actual scientific point — that process
determines outcome, not just ingredients.

Verbs unlock through play, which recapitulates tech history in miniature:

| Verb | Unlocked by | |
|---|---|---|
| Wait · Crush · Chill | from the start | time, force and cold need no technology |
| Heat | discovering `fire` | the first tool that makes new molecules |
| Cut | discovering `flint` | needs an edge |
| Ferment | discovering `yeast` | needs a microbe |

**Two shelves.** `workshop` recipes are real and carry a *this is how it works*
card with a source you can open. `folklore` recipes are myths — Stone Soup, the
Philosopher's Stone, the Golden Egg — and are marked by an **absence**: no
accession number, no source, a dashed edge. You keep the whimsy the genre is
loved for, quarantined so it never contaminates the teaching. Marking it by
what is missing rather than by a colour is both a better media-literacy lesson
and one that survives colour blindness.

**Where the teaching lives.** `recipe.why` is the mechanism, shown at the moment
of discovery — that is the payload, and it arrives *after* the dopamine, never as
a gate. `element.fact` is a one-line codex entry for later browsing.

## How it looks

Nothing in this game is an emoji, and nothing in it is a rounded pill. Both are
the genre's signature — Little Alchemy, Infinite Craft and their imitators are
all emoji-in-a-lozenge on an empty light canvas — and both are also wrong for
the content. Emoji is somebody else's art, it renders differently on every
platform, and it cannot draw a peptide bond.

**Every item is a specimen card**: a drawing, a name, a category rule, an
accession number, and the item's order of magnitude in metres. A fixed portrait
footprint, so a rock and a cake occupy the same frame and are told apart by what
is *in* it. Everything below the drawing is rendered from data already in the
repo, so the cost of a new item is one shape.

**The drawings** are built from a kit of about forty parts on a 60x60 grid —
circles, arcs and tangent joins, placed on a grid rather than drawn freehand, so
item 340 will still match item 12 after a six-month gap. The molecular tier gets
its own drawing language: IUPAC skeletal convention, Jmol/RasMol CPK atom
colours, because that is what a chemist expects to see and the switch marks the
point where the player leaves the world of things.

**The palette is derived, not chosen.** `tools/palette.mjs` reads the Munsell
renotation data — the dataset behind the soil colour book that soil scientists
carry in the field — and converts the notations we use to sRGB through a
documented pipeline: xyY under Illuminant C, to XYZ, Bradford-adapted to D65,
to sRGB. Every colour in the game is a measured chip with a notation you can
look up, including the lighter and darker tints, which come from the same hue
page rather than from lightening a hex. Chroma is deliberately low, because real
soil is low-chroma and high-chroma warm earth is what "earthy palette" has come
to mean. Two warm colours exist and the difference between them carries meaning:
`accent` (5YR 6/6) is the interface — hover, focus, the current thing — and
`discovery` (5YR 6/12) is the only high-chroma colour in the game and appears at
exactly one moment, when something new exists. Used on a button, it would stop
meaning anything.

A game whose claim is that everything in it is sourced, whose colours are also
sourced, is a coherence a competitor cannot copy without copying the idea.

**Geometry never names a colour.** Each shape carries a *role* and the theme
decides what a role looks like. That is what makes the second theme — Field
manual, the same drawings unfilled, ink on paper — a stylesheet rather than a
second set of drawings, and it is why the seven backgrounds (tray, paper, graph,
deep, fluid, soil profile, void) cost nothing per theme.

```
tools/audit.mjs          checks the numbers in our prose against the cited article
tools/safety.mjs         instructional voice, hazard chains, guarantor language
tools/palette.mjs        Munsell notations -> sRGB, with provenance
tools/art.mjs            the parts kit, every drawing, and a sameness check
tools/scale.mjs          order of magnitude for every item
tools/contact-sheet.mjs  every item, every theme, on one page
tools/strip.mjs          a named handful, big, for checking a change
```

`node tools/art.mjs check` fingerprints every drawing and fails on any pair
inside a category too alike to tell apart at shelf size. It found nineteen real
collisions on its first run, including five identical drink glasses and a
hexagonal sulfur that should have been an S8 crown.

## Where things live

```
README.md      this file — what the game is and how it is built
ROADMAP.md     the plan, in priority order, with the evidence for each call
QUEUE.md       everything asked for and not yet shipped, with its evidence
SOURCES.md     provenance: every source opened, and what was taken from it
BACKLOG.md     the working log — history, not a plan
docs/          design notes and research that are not the plan
archive/       superseded one-offs, kept for the record, maintained by nobody
data/          the corpus (see below)
tools/         the build, the validator, and the checkers
prototype/     template.html is the source; index.html is generated from it
research/      per-batch research write-ups, one file per wave
brand/         icon and identity
```

## Data

```
data/elements.json   id, name, emoji, shelf, tags, fact, starter?, terminal?
                     (emoji is a label for the CLI tools only — the game draws
                      from data/art.json and never reads it)
data/recipes.json    in[], verb?, out, why
data/verbs.json      the eight process verbs and their unlock conditions
```

Schema rules, enforced by the validator:

- a recipe is **either** 2 inputs and no verb, **or** 1 input and a verb
- no two gestures may produce different results (no ambiguity)
- several recipes *may* produce the same element (multiple routes to a goal —
  `dinner` has two, deliberately)
- `terminal: true` marks an intended endpoint, so real dead ends stand out

## Tools

```bash
node tools/validate.mjs            # integrity + unlock-aware reachability. Run before every commit.
node tools/graph.mjs stats         # difficulty curve, hit rate
node tools/graph.mjs path <id>     # minimum craft chain, with the teaching text
node tools/graph.mjs challenges 20 # daily-challenge candidates and their par
node tools/graph.mjs longest       # deepest chains
node tools/sources.mjs check       # resolve every source title against the live Wikipedia API
node tools/sources.mjs apply       # write resolved src URLs into recipes.json
node tools/sources.mjs report      # source coverage
node tools/discover.mjs            # simulate assist policies, attempts per discovery
node tools/provenance.mjs <id>     # full ancestry tree back to the four starters
node tools/build-prototype.mjs     # bake data into prototype/index.html
```

`validate.mjs` exits non-zero on any error and is the gate for content work: it
proves every element is reachable from the four starters *given the verb unlock
order*, which is the property that is easy to break and impossible to spot by eye.

## Prototype

`prototype/index.html` — open it directly, no server. Built from
`prototype/template.html` with the data inlined (`file://` blocks `fetch`).
Edit the template, not the built file.

It exists to answer one question before any Swift is written: **does the drop
feel good, and does the fact land?** Drag chips together, drag them onto the
verb tray, tap a chip to put it away, Nudge reveals one half of a valid pair.

## Sourcing

Every recipe carries a `src`. **No URL in this repo was written by hand** — that
is the one discipline that matters here, because a confident, plausible,
non-existent citation is worse than no citation. `data/sources.json` holds
article *titles*; `tools/sources.mjs` resolves them against the live Wikipedia
API, follows redirects, fails on anything that does not exist, and only then
writes URLs. On the first run it caught one title that did not exist and four
that silently redirected.

Where an encyclopedia entry does not directly support a claim, `sources.json`
also takes literal primary-source URLs, which are checked by HTTP request.

**`src` means checkable, not checked**, so claims carry a second flag:

- `verified: true` — independently checked against primary reporting. Shows a ✓
  in the game.
- `supported: true` — standard mechanism the cited article states directly
  (photosynthesis, osmosis, gluten). No independent search; no tick.

**Every claim carrying a number, date or named person has now been audited — 47
of them. Seventeen were wrong.** A 36% error rate in confident, fluent,
plausible-sounding prose is the entire argument for doing this pass:

| Claim | Problem | Now |
|---|---|---|
| Greenhouse | Reproduced the classic flawed analogy — a real greenhouse works by blocking **convection**, not by trapping infrared | Corrected, and now teaches the misconception |
| Flint | Gave flint obsidian's record ("edge a few molecules thick, sharper than a scalpel") | Corrected; obsidian credited |
| Penicillin | "200 million lives" traces to a magazine ranking and is unknowable | Replaced with Fleming → Florey and Chain |
| Eggshell | "7,000 pores" is the bottom of a 7,000–17,000 range | Given as a range |
| Grassland | "A third of the land"; usual figure is nearer 40% | Corrected |
| Spark | "The oldest tool humans have" — Oldowan cutting tools predate fire by ~800,000 years | Corrected |
| Glass | Wood-ash flux drops silica's melting point to ~1000 °C, not 850 °C | Corrected |
| Pottery | Bound water leaves clay at ~450–650 °C, not "above 900 °C" | Corrected |
| Milk | "45 kg of grass a day" — a cow eats ~18 kg dry matter, nearer 90 kg fresh | Corrected |
| Mead | "Oldest alcoholic drink" — the oldest identified (Jiahu) is a honey/rice/fruit hybrid | Corrected |
| Beer | "Older than bread", "safer than water" — both contested, stated as fact | Narrowed to the boiling |
| Breakfast | Conflated the British full breakfast with Bernays' American bacon campaign | Corrected |
| Noodles | "Invented independently in three places" — not established | Replaced with Lajia |
| Cucumber | 96% water; USDA is nearer 95% | Corrected |
| Fire | Wonderwerk shows fire *use*, not demonstrably cooking | Softened |
| Tzatziki | Straining removes lactose and carbohydrate too, not "only" whey | Softened |
| Brewed tea | 80 °C tannin threshold I could not source | Precision dropped |
| Glass *(codex)* | "A liquid frozen mid-flow" — feeds the myth that glass flows | Corrected |

Confirmed as written: ~80 founder aurochs (Bollongino et al. 2012), 8:1
honey-to-wax, ~3 chickens per living human, flour-grinding at 32,000 BP,
handwashing ≈30% (Cochrane), Shubayqa flatbread at 14,400 BP, AVPN pizza at
430–485 °C in 60–90 s, the Margherita story as probable myth, and Bernays'
1922 Beech-Nut campaign.

Two claims were confirmed by arithmetic rather than search: steam's 5× energy
(2257 ÷ 418.6 = 5.4) and 24 Brix → ~13% ABV (× 0.55).

**A correction to a recipe's `why` must also be applied to the paired
`element.fact`.** Six codex entries were left repeating errors already fixed in
their recipes — an easy and invisible way to reintroduce a corrected claim.

## What the data already tells us

**Discoverability is the real design risk, and it gets harder as the graph
grows.** Blind pair-guessing now costs **119 attempts per discovery** in
simulation — it was 91 at 171 elements, and every element added makes the
haystack bigger faster than it adds needles. The shipped assist is a
secrets-remaining count on every shelf element, which narrows the field without
ever naming a partner and brings the cost to **38.8**; weighting toward the
richest elements gets it to **30.2**.

That is a 3.1× improvement and it is *not enough on its own*. The honest reading
is that the assist scales worse than the graph does, and the thing that actually
rescues a stuck player is the recipe index — every element shows what makes it
and what it makes, whether or not you have found it. Re-run `node
tools/discover.mjs` after any content batch: if the blind number climbs and the
assisted one climbs with it, the assist needs work, not more elements.

Tag-affinity nudging — the intuitive answer — was simulated and **rejected**: it
finds 21 of 231 elements before stalling, because the best recipes cross
categories on purpose. See `tools/discover.mjs` and BACKLOG.md.

**The curve is healthy.** Elements cluster at par 6–12 with a long tail to 36 —
a broad, forgiving mid-game and a genuinely deep endgame.

## Next

1. **Art — done.** All 410 items are drawn, plus the six process verbs. The
   `emoji` field survives in `data/elements.json` only as a label for the
   command-line tools, which cannot render SVG; the game never reads it.
2. **Audit.** 295 of 677 claims have been checked against primary reporting and
   48 of those were wrong. The rest are article-supported but not independently
   audited, and the ratio should keep moving. Any new claim carrying a number,
   date or name gets `verified` before it ships.
3. **Name clearance.** "Loam" is chosen but not cleared — App Store search,
   trademark and domain are all still open questions.
4. **Then** SwiftUI. The graph ships as bundled JSON or SQLite and works fully
   offline. *(Correction: an earlier draft said Infinite Craft "cannot" ship
   offline. It has shipped iOS since April 2024 with ~52k US ratings. Offline is
   still a genuine advantage — novel combinations need its server — but the
   original framing overstated it.)*
