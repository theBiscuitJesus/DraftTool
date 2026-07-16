// Locates the PLAYED/TOTAL mark boxes, basics box, and header fields on the
// official checklist PDF by reading text-layer positions with pdfjs-dist.
//
// Layout notes (derived by inspecting data/checklist-sheet.pdf):
// - Every row's number ("1".."276" on the main page, "41".."100" on the mar
//   page) is emitted as its own text item. On the main page these are
//   globally unique, so no page-region disambiguation is needed beyond
//   parsing the plain integer.
// - The card-name text item that follows each row number sits at one of a
//   small number of fixed "lane" x-positions (4 on the main page, 1 on the
//   mar page) that stay constant no matter how many lines the card name
//   wraps to. The row-number item's own x position (which IS right-aligned
//   and therefore wobbles a couple points depending on digit count) is only
//   used to pick the lane; the lane's fixed nameX is what box offsets are
//   computed from.
// - The row-number item's own y (baseline) is used for the vertical anchor
//   because it stays centered on its row even when the card name wraps to
//   two lines (see the mar page's row 41, "Heaven-Sent Marvel (Archangel of
//   Thune)").
// - The PLAYED and TOTAL boxes sit left of the row number, at fixed offsets
//   from the lane's nameX. Offsets below were measured empirically by
//   rendering the PDF to PNG at high resolution (scratch/render-pdf-page.swift)
//   and reading off grid-line pixel positions, then confirmed by re-rendering
//   filled test digits and eyeballing placement across multiple sections.
import { readFileSync } from 'node:fs';
// Offset from a row's lane nameX to the center of its PLAYED / TOTAL box.
const NAME_TO_PLAYED_DX = -37.62;
const NAME_TO_TOTAL_DX = -23.42;
// The BASIC LANDS box has PLAYED/TOTAL columns directly against the land-name
// label (no row-number column between), so it gets its own offset: the label
// x minus one column width (14.2, same column pitch as card rows) minus the
// half-cell that lands -9 in the TOTAL cell puts -23.2 in the PLAYED cell.
const BASICS_LABEL_TO_BOX_DX = -23.2;
// Offset from a row-number item's text baseline to its box's vertical center.
const NUM_TO_BOX_CENTER_DY = 1.91;
// The 4 main-page lanes: a reference x for the (wobbly, right-aligned) row
// number, mapped to the lane's fixed (rock-solid) card-name x.
const MAIN_LANES = [
    { numXRef: 60, nameX: 71.7246 },
    { numXRef: 200, nameX: 212.7724 },
    { numXRef: 341, nameX: 353.8202 },
    { numXRef: 481.5, nameX: 494.868 },
];
const MAR_LANES = [{ numXRef: 60, nameX: 71.7246 }];
// TABLE # box has no printed line to anchor to (it's an empty rectangle),
// so its write position is a fixed empirical constant rather than derived
// from text content.
const TABLE_BOX_X = 535;
const TABLE_BOX_Y = 764;
// The underline beneath "Player's First/Last Name" likewise isn't part of
// the text layer; measured via scratch/find-lines.swift pixel scan (a scan
// at a text-free x confirmed the true hairline sits at y=722.0 — an earlier
// pass at x=380 was fooled by a glyph stroke from the label text below it).
const HEADER_LINE_Y = 722.0;
function nearestLaneNameX(numX, lanes) {
    let best = lanes[0];
    let bestDist = Infinity;
    for (const lane of lanes) {
        const d = Math.abs(numX - lane.numXRef);
        if (d < bestDist) {
            bestDist = d;
            best = lane;
        }
    }
    return best.nameX;
}
function boxFromAnchor(nameX, anchorY) {
    return {
        playedX: nameX + NAME_TO_PLAYED_DX,
        totalX: nameX + NAME_TO_TOTAL_DX,
        centerY: anchorY + NUM_TO_BOX_CENTER_DY,
    };
}
async function getPageTextItems(pdfBytes, pageIndex) {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const page = await doc.getPage(pageIndex + 1);
    const content = await page.getTextContent();
    return content.items;
}
const BASIC_LABELS = {
    Plains: 'plains',
    Island: 'island',
    Swamp: 'swamp',
    Mountain: 'mountain',
    Forest: 'forest',
};
export async function extractMainPositions(pdfBytes) {
    const items = await getPageTextItems(pdfBytes, 0);
    const rows = new Map();
    const basics = new Map();
    let firstNameX;
    let lastNameX;
    for (const it of items) {
        const s = it.str.trim();
        const x = it.transform[4];
        const y = it.transform[5];
        if (/^[0-9]+$/.test(s)) {
            const n = parseInt(s, 10);
            if (n >= 1 && n <= 276) {
                const nameX = nearestLaneNameX(x, MAIN_LANES);
                rows.set(n, boxFromAnchor(nameX, y));
            }
            continue;
        }
        const basicKey = BASIC_LABELS[it.str];
        if (basicKey) {
            // single mark column: playedX === totalX keeps the highlight one cell wide
            basics.set(basicKey, {
                playedX: x + BASICS_LABEL_TO_BOX_DX,
                totalX: x + BASICS_LABEL_TO_BOX_DX,
                centerY: y + NUM_TO_BOX_CENTER_DY,
            });
            continue;
        }
        if (it.str.startsWith('Player') && it.str.includes('First Name'))
            firstNameX = x;
        if (it.str.startsWith('Player') && it.str.includes('Last Name'))
            lastNameX = x;
    }
    const header = firstNameX !== undefined && lastNameX !== undefined
        ? { firstNameX, lastNameX, lineY: HEADER_LINE_Y, tableX: TABLE_BOX_X, tableY: TABLE_BOX_Y }
        : undefined;
    return { rows, basics, header };
}
export async function extractMarPositions(pdfBytes) {
    const items = await getPageTextItems(pdfBytes, 1);
    const rows = new Map();
    for (const it of items) {
        const s = it.str.trim();
        if (!/^[0-9]+$/.test(s))
            continue;
        const n = parseInt(s, 10);
        if (n < 41 || n > 100)
            continue;
        const x = it.transform[4];
        const y = it.transform[5];
        const nameX = nearestLaneNameX(x, MAR_LANES);
        rows.set(n, boxFromAnchor(nameX, y));
    }
    return { rows, basics: new Map() };
}
export function loadPdfBytes(path = 'data/checklist-sheet.pdf') {
    return new Uint8Array(readFileSync(path));
}
