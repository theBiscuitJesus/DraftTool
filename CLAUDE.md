# MTG Limited Decklist Scanner

Web app that converts photos of handwritten Magic: The Gathering limited decklists into digital versions, with PDF export.

## Project Overview

**Flow:** User uploads/takes photo of handwritten decklist -> AI vision extracts card names & quantities -> Display digital decklist -> Export as PDF

## Tech Stack

- **Frontend:** Next.js (React, TypeScript)
- **AI/OCR:** Claude Vision API (Anthropic) for handwriting recognition
- **PDF Export:** Client-side PDF generation
- **Styling:** Tailwind CSS

## Key Features

1. **Photo Upload** — Camera capture or file upload of handwritten decklist sheets
2. **AI Recognition** — Extract card names, quantities, and deck sections (main deck vs sideboard) from handwritten text
3. **Digital Display** — Show parsed decklist in a clean, editable format
4. **Card Validation** — Validate card names against MTG card database (Scryfall API)
5. **PDF Export** — Generate a clean PDF of the final decklist

## MTG Limited Decklist Context

A limited decklist typically has:
- **Player info** (name, DCI number, event, date)
- **Main deck** (minimum 40 cards) — card name + quantity
- **Sideboard** (remaining cards from sealed pool or draft picks)
- Cards are handwritten on an official decklist sheet

## Development Notes

- Use Scryfall API (https://scryfall.com/docs/api) for card data — free, no auth needed
- Limited formats: Draft, Sealed, Prerelease
- Common handwriting challenges: similar card names, abbreviations, messy writing
