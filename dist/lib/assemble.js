import { lookupRow } from './checklist.js';
export function assemble(pages, checklist) {
    const warnings = [];
    const cardsByName = new Map();
    const draftedNotPlayed = [];
    const lowConfidence = [];
    const ordered = [...pages].sort((a, b) => (a.page === b.page ? 0 : a.page === 'main' ? -1 : 1));
    const player = ordered.find(p => p.player && Object.values(p.player).some(Boolean))?.player ?? {};
    const poolTotal = pages.flatMap(p => p.rows).reduce((s, r) => s + (r.total ?? 0), 0) +
        pages.reduce((s, p) => s + Object.values(p.basicsTotal ?? {}).reduce((t, v) => t + (v ?? 0), 0), 0);
    for (const page of ordered) {
        const rows = [...page.rows].sort((a, b) => a.row - b.row);
        for (const r of rows) {
            const entry = lookupRow(checklist, page.page, r.row);
            if (!entry) {
                warnings.push(`unknown row ${r.row} on ${page.page} page (${page.photo}) — ignored`);
                continue;
            }
            if (r.confidence === 'low') {
                lowConfidence.push({ page: page.page, row: r.row, name: entry.displayName, ...(r.note ? { note: r.note } : {}) });
            }
            if (r.played && r.played > 0) {
                const existing = cardsByName.get(entry.displayName);
                if (existing)
                    existing.qty += r.played;
                else
                    cardsByName.set(entry.displayName, { name: entry.displayName, qty: r.played, isLand: entry.isLand });
            }
            else if (r.total && r.total > 0) {
                draftedNotPlayed.push({ name: entry.displayName, total: r.total });
            }
        }
    }
    const basicsSource = ordered.find(p => p.basics && Object.values(p.basics).some(Boolean))?.basics ?? {};
    const basics = [];
    const boxOrder = ['plains', 'island', 'swamp', 'mountain', 'forest'];
    for (const key of boxOrder) {
        const qty = basicsSource[key] ?? 0;
        if (qty > 0) {
            const name = key[0].toUpperCase() + key.slice(1);
            basics.push({ name, qty, isLand: true });
        }
    }
    return {
        player: {
            firstName: player.firstName ?? '',
            lastName: player.lastName ?? '',
            table: player.table ?? '',
            ...(player.last3 ? { last3: player.last3 } : {}),
        },
        cards: [...cardsByName.values()],
        basics,
        draftedNotPlayed,
        lowConfidence,
        warnings,
        hasMarPage: pages.some(p => p.page === 'mar'),
        poolTotal,
    };
}
