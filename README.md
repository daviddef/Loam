# Loam

*Pack one: dirt to dinner*

A combination game where **every recipe is a real fact**, and the game tells you
which of its answers are science and which are stories.

The competitors split cleanly: Little Alchemy and Doodle God are fun but invent
their chemistry; Infinite Craft generates infinite plausible nonsense with an
LLM; ChemCrafter is accurate but narrow. Nobody owns *true and fun*. This does.

**The game is the graph.** The app is a viewer for it. So the graph is built,
validated and playtested first — before a line of Swift.

---

## Slice status

| | |
|---|---|
| Domain | Dirt to Dinner — soil, fire, farming, fermentation, cooking |
| Elements | **226** (217 workshop · 9 folklore) |
| Recipes | **461** (344 merges · 117 verb processes) |
| Starters | 🪨 Stone · 💧 Water · ☀️ Sun · 🌰 Seed |
| Reachable | **226 / 226** from the four starters |
| Deepest chain | 36 crafts |
| Daily challenges | 37 viable targets before a repeat |
| Sourced | **461 / 461** recipes, every URL machine-verified |
| Audited | **70** claims checked against primary reporting — **17 were wrong** |
| Unaudited numeric claims | **0** |
| Routes per element | **2.04** · 1 sole-route by design |
| Mechanism prose | **~10,000 words** |

Run `node tools/graph.mjs path penicillin` for the headline chain: 22 steps from
four rocks to antibiotics, every one of them true.

## Design model

**Two gestures, and only two.**

- **Merge** — drag element onto element. Commutative. `flour + water → dough`
- **Process** — drag element onto a verb tool. Unary. `clay ⟶ 🔥 Heat → pot`

The verb layer is the main mechanical departure from the genre. Little Alchemy
is `A + B` and nothing else; adding six process verbs multiplies content from
the same word list *and* teaches the actual scientific point — that process
determines outcome, not just ingredients.

Verbs unlock through play, which recapitulates tech history in miniature:

| Verb | Unlocked by | |
|---|---|---|
| ⏳ Wait · 🪨 Crush · ❄️ Chill | from the start | time, force and cold need no technology |
| 🔥 Heat | discovering `fire` | the first tool that makes new molecules |
| 🔪 Cut | discovering `flint` | needs an edge |
| 🫧 Ferment | discovering `yeast` | needs a microbe |

**Two shelves.** `workshop` recipes are real and carry a green *this is how it
works* card. `folklore` recipes are myths — Stone Soup, the Philosopher's Stone,
the Golden Egg — and carry a purple *a story we tell* card. You keep the whimsy
the genre is loved for, quarantined so it never contaminates the teaching. The
distinction itself is a media-literacy lesson delivered as a collection mechanic.

**Where the teaching lives.** `recipe.why` is the mechanism, shown at the moment
of discovery — that is the payload, and it arrives *after* the dopamine, never as
a gate. `element.fact` is a one-line codex entry for later browsing.

## Data

```
data/elements.json   id, name, emoji, shelf, tags, fact, starter?, terminal?
data/recipes.json    in[], verb?, out, why
data/verbs.json      the six process verbs and their unlock conditions
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

**Discoverability was the real design risk — now measured and solved.** Only 117
of 14,535 possible pairs are real recipes, a 0.8% blind hit rate, which costs
**91 attempts per discovery** in simulation. The shipped fix is a
secrets-remaining count on every shelf element: it cuts a 78-element field to 6
without naming a partner, and brings the cost to **25.7 attempts**. Tag-affinity
nudging — the intuitive answer — was simulated and **rejected**: it found 10 of
171 elements before stalling, because the best recipes cross categories on
purpose. See `tools/discover.mjs` and BACKLOG.md.

**The curve is healthy.** Elements cluster at par 6–12 with a long tail to 36 —
a broad, forgiving mid-game and a genuinely deep endgame.

## Next

1. **Art.** Emoji are placeholders and several repeat. Real icons are the
   largest remaining cost before this stops looking like a spreadsheet.
2. **Audit done.** If new content lands, the same rule applies: any claim with a
   number, date or name gets `verified` before it ships.
3. **Art** — the emoji are placeholders and a few repeat. Real icons are the
   largest art cost and the main thing separating this from a spreadsheet.
4. **Then** SwiftUI. The graph ships as bundled JSON or SQLite and works fully
   offline. *(Correction: an earlier draft said Infinite Craft "cannot" ship
   offline. It has shipped iOS since April 2024 with ~52k US ratings. Offline is
   still a genuine advantage — novel combinations need its server — but the
   original framing overstated it.)*
