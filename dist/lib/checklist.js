import { readFileSync } from 'node:fs';
export function loadChecklist(path = 'data/checklist.json') {
    return JSON.parse(readFileSync(path, 'utf8'));
}
export function lookupRow(c, page, row) {
    return c.entries.find(e => e.page === page && e.row === row);
}
