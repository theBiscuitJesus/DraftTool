---
name: scan-decklist
description: Read photos of handwritten Magic&colon; The Gathering limited decklist checklist sheets and export them to CSV (card, TOTAL drafted, PLAYED). Use when the user asks to scan, read, decipher, or process MTG decklist / checklist-sheet photos, or points at a folder of them.
---

# Scan Decklist

Turn photos of handwritten MTG limited decklist **checklist sheets** into a CSV
(one row per marked card: card name, TOTAL drafted, PLAYED), validated to a
40-card deck.

**Key idea:** the printed card names and row numbers are fixed and known — they
live in the bundled `checklist.json`. Recognition therefore never reads card
names from the photo; it reads only the **handwritten digits** next to each row,
and code maps row → name. Card names can never be misread.

Bundled files are referenced with `${CLAUDE_PLUGIN_ROOT}` (the plugin's install
directory). User photos and output CSVs live in the **user's current working
directory** — never write into the plugin directory.

## Inputs

- Photo path(s) or a folder given as arguments → process those.
- Otherwise ask the user where the photos are.

A player's decklist is 1–2 photos: the main-set page (always) plus a "Source
Material (MAR)" bonus-sheet page (only if they play bonus cards). Group photos by
player using the header (name / table number); if grouping is ambiguous, ask.

This plugin ships the checklist for the **MSH (Marvel Super Heroes)** set. If a
photo doesn't match that layout, say so rather than guessing rows.

## Step 1 — Read each photo (vision)

Look at the photo directly. Rules:

- The sheet may be photographed rotated any direction (including upside down) —
  orient yourself by the printed text before reading anything.
- **Never trust a full-page read for digits.** Crop each section's mark columns
  and re-read at 3x+ zoom. Shadowed regions produce convincing phantom pen marks
  at low zoom — a cell counts as marked only if the mark survives a zoomed crop
  with gridlines. Sweep shadowed sections at zoom to confirm they are empty.
  - **Windows:** `powershell -File "${CLAUDE_PLUGIN_ROOT}/tools/crop.ps1" -Src photo.jpeg -X 95 -Y 600 -W 780 -H 560 -Scale 3.2 -Out crop.png`
  - **macOS/Linux:** `sips -c <hPx> <wPx> --cropOffset <yPx> <xPx> photo.jpg --out crop.png` (`sips -r 180` to rotate first)
- The sheet is always skewed/curved, so **never assign PLAYED vs TOTAL by
  absolute position** — trace each row's own cell dividers at high zoom and
  re-read the row number sitting next to a mark. Column mis-assignment on
  single-mark rows is the #1 error source.
- Each card row has two narrow columns under diagonal headers:
  **PLAYED is the left column, TOTAL is the right column.** Read both.
- The main page has color sections (WHITE, BLUE, BLACK, RED, GREEN, MULTICOLOR,
  ARTIFACTS, NONBASIC LANDS) with rows 1–276 plus a BASIC LANDS box; the MAR page
  is titled "SOURCE MATERIAL (MAR)" with rows 41–100.
- Only report rows with a handwritten mark. Read the digit(s) exactly.
- **Red-ink marks are judge corrections and override the original writing.**
- If a digit is ambiguous (1 vs 7, 4 vs 9, overwritten, tally-style), report your
  best reading with `"confidence": "low"` and a `note`. **Never silently guess.**
- Header fields: player first name, last name, table #, and the "First 3 letters
  of player's last name" box (cross-check it against the last name — a mismatch
  usually means you read a neighboring sheet's header).
- BASIC LANDS box (main page only): the handwritten count next to each land.
- If a photo is too blurry, dark, or cropped to read reliably, **stop and ask for
  a re-shoot.** Do not produce guessed output.

Write one JSON file per photo into a work folder in the user's directory
(e.g. `./decklist-work/<photo-basename>.json`):

```json
{
  "page": "main",
  "photo": "IMG_3418.jpeg",
  "player": { "firstName": "Carolyn", "lastName": "Pardee", "table": "21", "last3": "PAR" },
  "rows": [
    { "row": 8, "total": 2, "played": 1, "confidence": "high" },
    { "row": 213, "total": null, "played": null, "confidence": "low", "note": "faint mark under shadow; excluded" }
  ],
  "basics": { "plains": 7, "island": 4, "forest": 4 }
}
```

MAR pages need no `basics`; give them the player's `table` + `last3` so they pair
with the main page. Use `null` for an empty column in a marked row. Rare: digits
in the basics box's TOTAL column go in a separate `"basicsTotal": { ... }`.
Never write card names into the JSON — names come from the checklist downstream.

## Step 2 — Export the CSV

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/scripts/export-csv.js" ./decklist-work \
  --out ./decklist-out/decklists.csv \
  --checklist "${CLAUDE_PLUGIN_ROOT}/data/checklist.json"
```

This needs only **Node** — no `npm install`. It groups pages into decklists
(main + MAR, matched by table + last-3 tag), writes one CSV row per marked card
(keeping BOTH TOTAL and PLAYED), and prints a per-player validation summary
(PLAYED-to-40, low-confidence flags). Drafted-but-not-played cards show a TOTAL
with a blank PLAYED. Invalid decks are reported but still exported, so one bad
sheet never blocks the batch. You can pass explicit file paths instead of a
folder (e.g. one player's two pages).

Pool check: off by default (pool size varies by format). Add `--pool 42` to
enforce the MSH sealed-pool rule. The 40-card PLAYED check always runs.

## Step 3 — Review

Show the user **every ERROR and WARNING** (never hide them), plus the deck. The
strongest signal is PLAYED summing to exactly **40** with 16–18 lands. For each
low-confidence cell, describe what the mark looks like and where (section + card
name) and ask the user to confirm. When they give a correction, confirm which
column (PLAYED vs TOTAL) before editing the JSON, then re-run Step 2 until clean.

Optional: `assemble-decklist.js` writes a plain `<qty> <name>` text list, and
`fill-pdf.js` draws the reading onto a copy of the official PDF for
print-and-compare (the PDF tool additionally needs `pdf-lib`, so run
`npm install` in the plugin directory once if you want it).
