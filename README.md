# MTG Decklist Scanner — Claude Code plugin

Read photos of handwritten **Magic: The Gathering** limited decklist checklist
sheets and export them to CSV. The printed card names come from a bundled
checklist (they can never be misread); only the handwritten **TOTAL** (drafted)
and **PLAYED** (in the 40) digits are read, then the deck is validated to 40 cards.

Ships the **MSH (Marvel Super Heroes)** checklist. Recognition runs on **your own
Claude usage** when you invoke the skill — no API key, no cost to the author.

## Install

In Claude Code:

```
/plugin marketplace add theBiscuitJesus/DraftTool
/plugin install mtg-decklist@mtg-decklist-marketplace
```

Or from the terminal:

```
claude plugin marketplace add theBiscuitJesus/DraftTool
claude plugin install mtg-decklist@mtg-decklist-marketplace
```

**Prerequisite:** [Node.js](https://nodejs.org) 18+ on the machine (the export
step runs a small bundled script with `node`). Nothing else to install — the
runtime in `dist/` has no third-party dependencies.

## Use

In a folder where you want the output, tell Claude:

> scan these decklist photos: ./photos/IMG_3418.jpeg ./photos/IMG_3419.jpeg

Claude will read each sheet (cropping and zooming to read the digits reliably),
write a small recognition file per photo into `./decklist-work/`, then produce
`./decklist-out/decklists.csv` with one row per marked card:

```
player,table,card,total,played,confidence,note
Carolyn Pardee,21,"Mockingbird, Ace Agent",2,2,high,
Carolyn Pardee,21,"Nick Fury, Agent of S.H.I.E.L.D.",1,,high,
Carolyn Pardee,21,Plains,,7,high,
```

`total` = drafted, `played` = in the 40 (blank = drafted but not played). Cells
Claude wasn't sure about are marked `low` with a note, never silently guessed.
It prints a per-decklist summary and flags anything that doesn't sum to 40.

## What's in the box

| Path | Purpose |
| --- | --- |
| `skills/scan-decklist/SKILL.md` | The skill Claude follows to read + export |
| `dist/` | Compiled, dependency-free runtime (`node dist/scripts/export-csv.js`) |
| `data/checklist.json` | The MSH row → card-name reference (source of truth) |
| `tools/crop.ps1` | Windows helper for high-zoom crops during recognition |
| `lib/`, `scripts/`, `tests/` | TypeScript source + test suite |

## Notes & limits

- **Accuracy:** recognition is an interactive Claude-vision pass with a
  crop-and-zoom discipline — faint marks under photo shadows are flagged for you
  to confirm rather than guessed. Always eyeball the flagged cells.
- **Set:** MSH only. Adding a set = a new `checklist.json` (built from Scryfall
  collector numbers) and a matching sheet layout.
- **PDF export (optional):** `scripts/fill-pdf.ts` draws the reading onto a copy
  of the official PDF for print-and-compare. It needs `pdf-lib`, so run
  `npm install` in this directory once if you want it. The CSV path needs nothing.

## Development

```
npm install      # dev tooling (tsx, vitest, typescript, pdf-lib)
npm test         # vitest, full suite
npm run build    # recompile dist/ from lib/ + scripts/ (commit dist/ on release)
```

Bump `version` in `.claude-plugin/plugin.json` on each release so installers pick
up the update.
