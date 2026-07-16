import { lookupRow } from './checklist.js';
const BOX_ORDER = ['plains', 'island', 'swamp', 'mountain', 'forest'];
/**
 * Turn one player's recognized page(s) into CSV rows. Rows for the same card
 * (e.g. MAR art variants on adjacent rows) are merged, summing total and played.
 * Card names come from the checklist by row number — never from the photo.
 * Unknown row numbers are skipped here; the CLI surfaces them via validate().
 */
export function toCsvRows(pages, checklist) {
    const ordered = [...pages].sort((a, b) => (a.page === b.page ? 0 : a.page === 'main' ? -1 : 1));
    const playerSrc = ordered.find(p => p.player && Object.values(p.player).some(Boolean))?.player ?? {};
    const player = [playerSrc.firstName, playerSrc.lastName].filter(Boolean).join(' ');
    const table = playerSrc.table ?? '';
    const byName = new Map();
    for (const page of ordered) {
        const pagePri = page.page === 'main' ? 0 : 1;
        for (const r of [...page.rows].sort((a, b) => a.row - b.row)) {
            const entry = lookupRow(checklist, page.page, r.row);
            if (!entry)
                continue;
            let acc = byName.get(entry.displayName);
            if (!acc) {
                acc = { card: entry.displayName, total: null, played: null, confidence: 'high', notes: [], sort: pagePri * 1000 + r.row };
                byName.set(entry.displayName, acc);
            }
            if (r.total != null)
                acc.total = (acc.total ?? 0) + r.total;
            if (r.played != null)
                acc.played = (acc.played ?? 0) + r.played;
            if (r.confidence === 'low')
                acc.confidence = 'low';
            if (r.note)
                acc.notes.push(r.note);
        }
    }
    const cardRows = [...byName.values()]
        .sort((a, b) => a.sort - b.sort)
        .map(a => ({
        player, table, card: a.card, total: a.total, played: a.played,
        confidence: a.confidence, note: a.notes.join('; '),
    }));
    // Basics come from the corner box (main page): played counts, plus the rare
    // TOTAL-column basics (basicsTotal). Ordered as printed on the sheet, last.
    const basicsSrc = ordered.find(p => p.basics && Object.values(p.basics).some(Boolean))?.basics ?? {};
    const basicsTotalSrc = ordered.find(p => p.basicsTotal && Object.values(p.basicsTotal).some(Boolean))?.basicsTotal ?? {};
    const basicRows = [];
    for (const key of BOX_ORDER) {
        const played = basicsSrc[key];
        const total = basicsTotalSrc[key];
        if ((played ?? 0) > 0 || (total ?? 0) > 0) {
            basicRows.push({
                player, table, card: key[0].toUpperCase() + key.slice(1),
                total: total ?? null, played: played ?? null, confidence: 'high', note: '',
            });
        }
    }
    return [...cardRows, ...basicRows];
}
const HEADER = ['player', 'table', 'card', 'total', 'played', 'confidence', 'note'];
const esc = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
const cell = (v) => (v == null ? '' : esc(String(v)));
export function formatCsv(rows) {
    const lines = [HEADER.join(',')];
    for (const r of rows) {
        lines.push([r.player, r.table, r.card, r.total, r.played, r.confidence, r.note].map(cell).join(','));
    }
    return lines.join('\n') + '\n';
}
