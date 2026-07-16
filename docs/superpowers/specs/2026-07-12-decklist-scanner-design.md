# MTG Limited Decklist Scanner — Design

**Date:** 2026-07-12
**Status:** Approved (pending user review of this document)

## Problem

At live Marvel Super Heroes (MSH) draft events, players record their drafted pool
(TOTAL column) and their 40-card deck (PLAYED column) by hand on official pre-printed
deck checklist sheets. A staffer photographs each sheet on a phone and sends the photos
to an operator on a laptop. The operator needs each player's 40-card deck as clean
digital text, fast enough to paste into the broadcast graphics system before the
player's match goes on stream.

## What we're building

Two phases sharing one recognition core:

- **Phase 1 (now):** a Claude Code project skill, `/scan-decklist`. Operator drops
  photos into `inbox/`, runs the skill, reviews flagged issues conversationally, gets a
  copy-paste-ready `.txt` in `output/`. No API key, no app — Claude Code itself reads
  the photos. This also serves as the proving ground for recognition quality.
- **Phase 2 (after the event):** a handoff package for Josh (coworker who runs the
  team's data website). The event itself runs on Phase 1 as a proof of concept; then
  we bundle the results — one machine-readable JSON per decklist alongside the txt,
  the checklist data, and a written explanation of the schema and pipeline — and send
  it to Josh to integrate into his site. To support this, the CLI writes a `.json`
  next to every `.txt`.

## Key insight driving the design

The checklist sheet is fixed and known. Every printed card name and row number is
extracted from the official PDF once, ahead of time. Recognition therefore never reads
card names from the photo — it reads **handwritten digits next to known row numbers**,
and row → name mapping happens in code. Card names can never be misread.

## Input reality (validated against real event photos)

- A decklist submission is **1 or 2 photos**: main-set page always; MAR bonus-sheet
  page only if the player plays cards from it.
- Photos arrive rotated any direction (one sample was fully upside down), with
  photographer shadows, perspective tilt, on colored paper (paper color varies by
  player seat), sheets sitting on stacks of other sheets.
- **Our events are individual**, using the solo/draft header (verifier + player name
  fields + table #, as in the "PT MSH - Draft 1" PDF). The sample photos happen to be
  from a team event with a different header (Player A/B/C + Team Captain); the card
  grid is identical, so they remain valid fixtures for digit reading. Team-specific
  fields are not extracted or displayed.
- Handwriting realities: some rows have both TOTAL and PLAYED, some only TOTAL
  (sheet photographed mid-deckbuild); tally-style and overwritten digits; **red-ink
  judge corrections override original marks**; basic lands are digits in a corner box;
  a "first 3 letters of player's last name" box provides an identity cross-check.

## Components

### 1. Checklist data (`data/checklist.json`)

Built once by `scripts/build-checklist.ts` from the Scryfall API — the sheet's row
numbers are exactly Scryfall collector numbers (`msh` 1–276 = main grid; `mar`
41–100 = Source Material page; msh basics live at cn 277–286 and are not fetched,
since the sheet's basic-lands box has no row numbers). Contents:

- Entries: `{ page: "main"|"mar", row, name, displayName, isLand }` — `displayName`
  is Scryfall's `flavor_name` (the Marvel name shown on stream) when present, else
  the real name; `isLand` drives the land-count sanity check.
- Basics: `["Plains", "Island", "Swamp", "Mountain", "Forest"]` (sheet-box order).

The build fails loudly on any count mismatch or on spot-check pairs transcribed by
eye from the official PDF (e.g. main/88 = "Baron Strucker, HYDRA Overlord"), and the
same checks are committed as tests. This file is the single source of truth.

### 2. Recognition prompt (shared by both phases)

The vision model receives the photo(s) and instructions:

- Normalize orientation first (sheet may be rotated 90/180/270°).
- Identify the page (main vs MAR).
- Extract header fields: player first/last name, table #, last-3-letters box.
- For each card row bearing any mark: report `{ row, total, played, confidence,
  note }`. Column order on the sheet is PLAYED (left), TOTAL (right) under diagonal
  headers. Red-ink corrections override. Ambiguous digits (1/7, 4/9, overwrites) get
  `confidence: "low"` and a note — never a silent guess.
- Basic lands box: count per land.
- If the photo is too blurry/cropped to read reliably, say so and request a re-shoot
  instead of guessing.

Output is JSON of row/quantity pairs only — no card names.

### 3. Assembly + validation (code, not model)

- Map rows → names via `checklist.json`; merge main + MAR pages for one player.
- Merge duplicate rows of the same card into one line (the MAR page lists some cards
  on multiple rows as art variants — e.g., Heroic Intervention on rows 78–80).
- **PLAYED sum must equal exactly 40** including basic lands. If short and no MAR
  photo was provided, prompt: "sum is N — is there a MAR page for this player?"
- Sanity signal: lands (basics + nonbasic land rows) typically ≈ 16–18.
- Rows with TOTAL but blank PLAYED are listed separately as "drafted, not played"
  (also catches sheets photographed before deckbuild finished).
- All low-confidence reads are surfaced for human confirmation before export.
- Cross-check: last-3-letters box vs extracted last name.

### 4. Output (`output/<table>-<lastname>.txt`)

```
Player: Michael Steele (Table 125)

3 Web Up
1 Agent of Atlas
...
7 Plains
6 Mountain
```

Card lines are `<qty> <name>`, spells first (checklist order), basics last. Exact
formatting is deliberately trivial to change when the broadcast team asks. Phase 2
adds a "Copy decklist" button copying exactly this text.

### 5. Phase 1 skill (`.claude/skills/scan-decklist/`)

`/scan-decklist [photo paths]` — defaults to all unprocessed images in `inbox/`.
Steps: read photos → group pages by player (header name/table #) → recognize →
assemble/validate → show flagged issues + full list for review → on confirmation,
write `output/*.txt`. Processed photos are moved to `inbox/processed/`.

### 6. Phase 2: handoff package for Josh's website

After the event, `handoff/` contains everything Josh needs, generated from the run:

- `decklists/*.json` — one per player: `{ player: { firstName, lastName, table },
  cards: [{ name, qty, isLand }], basics: [{ name, qty, isLand }], playedTotal }`.
  Written by the CLI alongside each `.txt`.
- `decklists/*.txt` — the broadcast text versions.
- `checklist.json` — the full card reference (row numbers, names, land flags) in case
  his site wants to enrich or cross-link.
- `README.md` — plain-language explanation for Josh: what the data is, the JSON
  schema field by field, how it was produced (photo → digit recognition → validated
  against the printed checklist), known caveats, and what a future direct feed could
  look like if he wants to accept uploads on his site.
- Feature request to include in the README: **inline editing on his page** — when a
  wrong quantity is spotted on the displayed decklist, the operator should be able to
  correct it right there via a number dropdown on each card row, rather than
  re-uploading a file.

## Testing

- **Checklist parser:** hard assertions — expected row counts (276 main, 60 MAR),
  every name matches Scryfall exactly.
- **Recognition:** the three real event photos (IMG_3435/3436/3437, table 125 team)
  are the fixture set. Success = extracted decklists match a human reading of the
  sheets, with every genuinely ambiguous mark flagged rather than guessed.
- **Validation logic:** unit tests for sum-to-40, MAR-merge, missing-page prompting,
  drafted-not-played separation.
- Handoff JSON is exercised by the CLI tests (every `--write` produces txt + json).

## Error handling

| Condition | Behavior |
|---|---|
| Blurry/cropped/unreadable photo | Refuse + request re-shoot; never guess |
| Ambiguous digit | Flag with location; human confirms |
| PLAYED sum ≠ 40 | Blocking error naming the actual sum; suggests a missing MAR page when plausible |
| Red-ink corrections | Override original marks |
| Unknown sheet layout | Report "unrecognized sheet variant" rather than mis-mapping rows |

## Out of scope (for now)

- Direct API push to the broadcast system (future Phase 3; txt copy-paste is the contract).
- Sets other than MSH (structure supports adding a set: new PDF → new checklist.json).
- Team events (Player A/B/C + Team Captain header). If one comes up later, only header
  extraction and the output header line change.
- TOTAL-column/full-pool export (data is captured; only PLAYED is exported today).
- Building our own operator web app. The event runs on the Claude Code skill; the
  long-term home for the data is Josh's existing website, fed by the handoff package.
- Player-facing submission, auth, hosting — all Josh's-site territory if ever needed.
