// Draws recognition JSON onto a copy of the official checklist PDF, for
// print-and-compare verification against a player's handwritten sheet.
// Usage: npx tsx scripts/fill-pdf.ts <recognition.json> [more.json...] [--out DIR]
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { assertRecognizedPage } from '../lib/recognized-page.js';
import { extractMainPositions, extractMarPositions, loadPdfBytes, } from '../lib/pdf-positions.js';
const USAGE = 'usage: fill-pdf <recognition.json> [more.json...] [--out DIR]\n';
const SOURCE_PDF = 'data/checklist-sheet.pdf';
const DARK_BLUE = rgb(0.05, 0.1, 0.55);
const YELLOW = rgb(1, 0.92, 0.4);
const ORANGE = rgb(1, 0.6, 0.2);
const FONT_SIZE = 7;
// Half-widths of the PLAYED/TOTAL boxes around their measured centers, used
// to size the highlight rectangle so it covers both boxes for a row without
// bleeding into the row-number column or the neighboring row.
const PLAYED_HALF_W = 7;
const TOTAL_HALF_W = 7.2;
const BOX_HALF_H = 3.4;
function digitBaselineY(centerY) {
    // Helvetica-Bold's visual (cap-height) center sits above the text
    // baseline; nudge the baseline down so the glyph itself centers on the box.
    return centerY - FONT_SIZE * 0.36;
}
function drawDigit(page, font, value, x, centerY) {
    const text = String(value);
    const width = font.widthOfTextAtSize(text, FONT_SIZE);
    page.drawText(text, { x: x - width / 2, y: digitBaselineY(centerY), size: FONT_SIZE, font, color: DARK_BLUE });
}
function drawHighlight(page, box, color) {
    const x = box.playedX - PLAYED_HALF_W;
    const width = box.totalX + TOTAL_HALF_W - x;
    page.drawRectangle({ x, y: box.centerY - BOX_HALF_H, width, height: BOX_HALF_H * 2, color, opacity: 0.55 });
}
function playedSum(page) {
    const rowSum = page.rows.reduce((s, r) => s + (r.played ?? 0), 0);
    const basicsSum = Object.values(page.basics ?? {}).reduce((s, v) => s + (v ?? 0), 0);
    return rowSum + basicsSum;
}
function poolSum(page) {
    const rowSum = page.rows.reduce((s, r) => s + (r.total ?? 0), 0);
    const basicsTotalSum = Object.values(page.basicsTotal ?? {}).reduce((s, v) => s + (v ?? 0), 0);
    return rowSum + basicsTotalSum;
}
// Running-tally box at the top of the sheet: the operator corrects digits and
// regenerates; PLAYED must land on exactly 40 and the drafted POOL on 42.
// Sums span ALL pages passed in one invocation (main + MAR), basics excluded
// from the pool.
function drawTallyBox(page, font, played, pool) {
    // sits over the unused "Card Pool Verification" verifier-name area
    const x = 50;
    const y = 716;
    const w = 140;
    const h = 34;
    const RED = rgb(0.78, 0, 0);
    page.drawRectangle({
        x, y, width: w, height: h,
        borderColor: DARK_BLUE, borderWidth: 1,
        color: rgb(1, 1, 1), opacity: 0.85,
    });
    page.drawText(`PLAYED: ${played} / 40`, {
        x: x + 8, y: y + 20, size: 9, font,
        color: played === 40 ? DARK_BLUE : RED,
    });
    page.drawText(`POOL: ${pool} / 42`, {
        x: x + 8, y: y + 7, size: 9, font,
        color: pool === 42 ? DARK_BLUE : RED,
    });
}
async function positionsFor(page, pdfBytes) {
    return page.page === 'main' ? extractMainPositions(pdfBytes) : extractMarPositions(pdfBytes);
}
export async function fillPdf(recognized, sourcePdfBytes, tally) {
    // pdf-lib and pdfjs-dist each consume the bytes they're handed (pdf-lib in
    // particular leaves the buffer unparsable for a second load), so give each
    // library — and each call, since fillPdf may run more than once against a
    // shared source buffer — its own copy.
    const doc = await PDFDocument.load(sourcePdfBytes.slice());
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pageIndex = recognized.page === 'main' ? 0 : 1;
    const targetPage = doc.getPages()[pageIndex];
    if (!targetPage)
        throw new Error(`source PDF has no page for "${recognized.page}"`);
    const positions = await positionsFor(recognized, sourcePdfBytes.slice());
    const missingRows = [];
    for (const r of recognized.rows) {
        const box = positions.rows.get(r.row);
        if (!box) {
            missingRows.push(r.row);
            continue;
        }
        const highlight = r.confidence === 'low' ? ORANGE : r.played !== null && r.played !== undefined ? YELLOW : null;
        if (highlight)
            drawHighlight(targetPage, box, highlight);
        if (r.played !== null && r.played !== undefined)
            drawDigit(targetPage, font, r.played, box.playedX, box.centerY);
        if (r.total !== null && r.total !== undefined)
            drawDigit(targetPage, font, r.total, box.totalX, box.centerY);
    }
    if (recognized.basics) {
        for (const [key, box] of positions.basics) {
            const value = recognized.basics[key];
            if (value && value > 0) {
                drawHighlight(targetPage, box, YELLOW);
                drawDigit(targetPage, font, value, box.playedX, box.centerY);
            }
        }
    }
    if (positions.header && recognized.player) {
        const { firstName, lastName, table } = recognized.player;
        const h = positions.header;
        const nameY = h.lineY + 3;
        if (firstName)
            targetPage.drawText(firstName, { x: h.firstNameX, y: nameY, size: 8, font, color: DARK_BLUE });
        if (lastName)
            targetPage.drawText(lastName, { x: h.lastNameX, y: nameY, size: 8, font, color: DARK_BLUE });
        if (table)
            targetPage.drawText(table, { x: h.tableX, y: h.tableY, size: 11, font, color: DARK_BLUE });
    }
    if (missingRows.length > 0) {
        console.warn(`fill-pdf: no box found for rows [${missingRows.join(', ')}] on ${recognized.page} page (${recognized.photo}) — skipped`);
    }
    if (recognized.page === 'main') {
        drawTallyBox(targetPage, font, tally?.played ?? playedSum(recognized), tally?.pool ?? poolSum(recognized));
    }
    const footer = `scanned from ${recognized.photo} — played sum ${playedSum(recognized)}`;
    targetPage.drawText(footer, { x: 20, y: 10, size: 6, font, color: DARK_BLUE });
    return doc.save();
}
async function run(args) {
    const out = [];
    const outIdx = args.indexOf('--out');
    let outDir = 'output';
    if (outIdx >= 0) {
        const value = args[outIdx + 1];
        if (value === undefined || value.startsWith('--'))
            return { exitCode: 1, stdout: USAGE };
        outDir = value;
    }
    const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
    if (files.length === 0)
        return { exitCode: 1, stdout: USAGE };
    const sourceBytes = loadPdfBytes(SOURCE_PDF);
    mkdirSync(outDir, { recursive: true });
    // Parse everything first: files passed together are one player's pages, and
    // the tally box must show sums across all of them (main + MAR).
    const pages = [];
    for (const f of files) {
        let raw;
        try {
            raw = readFileSync(f, 'utf8');
        }
        catch (e) {
            return { exitCode: 1, stdout: `ERROR: cannot read ${f}: ${e.message}\n` };
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch (e) {
            return { exitCode: 1, stdout: `ERROR: cannot read ${f}: ${e.message}\n` };
        }
        try {
            pages.push({ file: f, recognized: assertRecognizedPage(parsed, f) });
        }
        catch (e) {
            return { exitCode: 1, stdout: `ERROR: ${e.message}\n` };
        }
    }
    const tally = {
        played: pages.reduce((s, p) => s + playedSum(p.recognized), 0),
        pool: pages.reduce((s, p) => s + poolSum(p.recognized), 0),
    };
    for (const { file, recognized } of pages) {
        const filled = await fillPdf(recognized, sourceBytes, tally);
        // Forward-slash path: Node writes it fine on every OS and it prints
        // consistently (path.join would emit backslashes on Windows).
        const outPath = `${outDir}/${basename(file).replace(/\.json$/, '')}-filled.pdf`;
        writeFileSync(outPath, filled);
        out.push(`wrote ${outPath}`);
    }
    out.push(`tally: PLAYED ${tally.played} / 40, POOL ${tally.pool} / 42`);
    return { exitCode: 0, stdout: out.join('\n') + '\n' };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const r = await run(process.argv.slice(2));
    console.log(r.stdout);
    process.exit(r.exitCode);
}
export { run };
