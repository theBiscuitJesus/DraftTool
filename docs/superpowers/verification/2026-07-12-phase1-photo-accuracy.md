# Phase 1 Recognition Accuracy — Real Event Photos

**Date:** 2026-07-12
**Fixtures:** `tests/fixtures/photos/IMG_3435.jpg` (blue sheet, upside down, hand shadow), `IMG_3436.jpg` (pink sheet, red-ink judge correction), `IMG_3437.jpg` (green sheet, heavy diagonal shadow). All three from a real team event at table 125.

## Method

Two independent readers per photo, in isolated contexts: one following `.claude/skills/scan-decklist/SKILL.md` Step 1 verbatim (the event path), one doing a from-scratch careful transcription (ground truth). Both instructed to crop-zoom and to flag ambiguity rather than guess. Disagreements adjudicated by the coordinator with targeted zoomed crops. The adjudicated recognition JSON then ran through the real CLI (`assemble-decklist --write`).

## Results

| Sheet | Player | Rows agreed | PLAYED-column disagreements | Sum | Output |
|---|---|---|---|---|---|
| IMG_3435 (blue, 180° rotated) | Aleksander Jones, 125A | 41/44 | **0** (all 3 diffs in TOTAL column, all flagged low-confidence) | 40 exact, both readers | `output/125a-jones.txt/.json` |
| IMG_3436 (pink, red ink) | Amir Radmard, 125 | 44/45 | **0 after adjudication** — skill found row 267 (played 1) that ground truth missed; crop confirmed the mark; skill was right | 40 exact (GT read 39 due to the missed row) | `output/125-radmard.txt/.json` |
| IMG_3437 (green, shadow) | Michael Steele, 125 | 30/30 | **0** — perfect agreement including headers and basics | 40 exact, both readers | `output/125-steele.txt/.json` |

**Acceptance criterion (zero unflagged wrong digits on the PLAYED column): MET.** Every reading disagreement between the two readers was either (a) flagged low-confidence by at least one of them, or (b) in the pink sheet's case, a high-confidence skill reading that adjudication proved correct. No silent errors reached an output file.

## Errors caught, and by what

1. **Pink sheet header misread (skill reader):** read "Michael Steele" off the neighboring green sheet poking into frame. Caught two ways: ground-truth disagreement, AND the pipeline's own last-3-letters cross-check ("RAD" ≠ Steele) would have warned the operator regardless. Adjudicated by crop: Player B, Amir Radmard.
2. **Missed row 267 (ground-truth reader):** Gleaming Bastion "1 1" at the very bottom edge, missed because its crops stopped at row 264. Caught by the sum check (39 ≠ 40 — the exact scenario the validation was built for) and by the skill reader's full-coverage crops.
3. **Phantom marks in shadow:** at low zoom, the green sheet's shadowed BLACK section shows convincing fake digits, disproven at 3x zoom. Neither reader was fooled (both used crops), but a naive full-page read would be. Now codified as a mandatory rule in SKILL.md.

## Remaining ambiguities (all flagged, all TOTAL-column — none affect the 40-card decks)

- IMG_3435 rows 131–133 (scribbled cross-out over a "3"), 158/159 (one glyph spanning two rows: 7 vs 2+1), 273–275 (connected zigzag strokes).
- IMG_3436 rows 44–48 (loose cursive digits), row 215 red-ink correction (established: total 0).
- IMG_3437 rows 133–134 (two stacked strokes, 1+1 vs one tall 1).

At an event these would be shown to the operator only if they mattered; since they affect the drafted-pool display, not the deck, they are advisory.

## Caveats / follow-ups

- **Double-faced card names:** row 219 prints "King T'Challa" but Scryfall's name is "King T'Challa // Black Panther, Hope Enduring", which is what the broadcast txt currently shows. Cosmetic; fix by using the front-face name in `data/checklist.json` if the broadcast team objects.
- SKILL.md was updated with the two field learnings: mandatory crop-zoom (phantom marks in shadow) and the stacked-sheets header trap (verify header belongs to the grid's sheet; trust the last-3 box as a tripwire).
- Skill readings took several minutes per photo (thorough crop sweeps). At the event, budget ~5 minutes per sheet from photo to confirmed output.

## Go / no-go for the live event

**GO.** Across three adversarial real-world photos (rotation, shadows, colored paper, judge corrections, stacked sheets), the pipeline produced three exactly-40 decklists with zero unflagged digit errors, and its built-in safety nets (sum-to-40 gate, last-3 cross-check, low-confidence flagging) independently caught both real reading mistakes that occurred. The double-read used in this test is not needed at the event; the single skill pass plus the validation gates plus operator review of flagged rows is sufficient.
