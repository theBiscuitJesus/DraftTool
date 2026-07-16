export function playedTotal(deck) {
    return [...deck.cards, ...deck.basics].reduce((sum, c) => sum + c.qty, 0);
}
export function validate(deck, opts = {}) {
    const expectedPool = opts.expectedPool === undefined ? 42 : opts.expectedPool;
    const issues = [];
    const total = playedTotal(deck);
    if (total !== 40) {
        let message = `PLAYED column sums to ${total}, expected exactly 40`;
        if (total < 40 && !deck.hasMarPage)
            message += ' — is there a MAR bonus-sheet page for this player?';
        issues.push({ severity: 'error', message });
    }
    const lands = [...deck.cards, ...deck.basics].filter(c => c.isLand).reduce((s, c) => s + c.qty, 0);
    if (lands < 14 || lands > 20) {
        issues.push({ severity: 'warning', message: `${lands} lands is unusual for limited (typical is 16-18)` });
    }
    if (expectedPool !== null && deck.poolTotal !== expectedPool) {
        issues.push({
            severity: 'error',
            message: `drafted pool (TOTAL column, basics excluded) sums to ${deck.poolTotal}, expected exactly ${expectedPool} — a TOTAL digit is misread or a page is missing`,
        });
    }
    for (const lc of deck.lowConfidence) {
        let message = `low-confidence read: ${lc.name} (row ${lc.row}, ${lc.page} page)`;
        if (lc.note)
            message += `: ${lc.note}`;
        issues.push({ severity: 'warning', message });
    }
    for (const w of deck.warnings)
        issues.push({ severity: 'warning', message: w });
    const { lastName, table, last3 } = deck.player;
    if (last3 && lastName && !lastName.toLowerCase().startsWith(last3.toLowerCase())) {
        issues.push({ severity: 'warning', message: `last-3-letters box "${last3}" does not match last name "${lastName}"` });
    }
    if (!lastName)
        issues.push({ severity: 'warning', message: 'player last name missing (needed for output filename)' });
    if (!table)
        issues.push({ severity: 'warning', message: 'table number missing (needed for output filename)' });
    return issues;
}
