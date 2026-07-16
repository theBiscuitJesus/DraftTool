import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChecklist } from '../lib/checklist.js';
import { assemble } from '../lib/assemble.js';
import { assertRecognizedPage } from '../lib/recognized-page.js';
import { validate, playedTotal } from '../lib/validate.js';
import { formatDecklist, outputFilename } from '../lib/format.js';
const USAGE = 'usage: assemble-decklist <page.json> [page2.json] [--write] [--force] [--out DIR] [--checklist FILE]\n';
export function run(args) {
    const out = [];
    const write = args.includes('--write');
    const force = args.includes('--force');
    const outDirIdx = args.indexOf('--out');
    let outDir = 'output';
    if (outDirIdx >= 0) {
        const outDirValue = args[outDirIdx + 1];
        if (outDirValue === undefined || outDirValue.startsWith('--')) {
            return { exitCode: 1, stdout: USAGE };
        }
        outDir = outDirValue;
    }
    const clIdx = args.indexOf('--checklist');
    let checklistPath;
    if (clIdx >= 0) {
        const clValue = args[clIdx + 1];
        if (clValue === undefined || clValue.startsWith('--')) {
            return { exitCode: 1, stdout: USAGE };
        }
        checklistPath = clValue;
    }
    const valueFlags = new Set(['--out', '--checklist']);
    const files = args.filter((a, i) => !a.startsWith('--') && !valueFlags.has(args[i - 1]));
    if (files.length === 0) {
        return { exitCode: 1, stdout: USAGE };
    }
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
            pages.push(assertRecognizedPage(parsed, f));
        }
        catch (e) {
            return { exitCode: 1, stdout: `ERROR: ${e.message}\n` };
        }
    }
    let checklist;
    try {
        checklist = loadChecklist(checklistPath);
    }
    catch (e) {
        return { exitCode: 1, stdout: `ERROR: cannot read checklist ${checklistPath ?? 'data/checklist.json'}: ${e.message}\n` };
    }
    const deck = assemble(pages, checklist);
    const issues = validate(deck);
    const hasErrors = issues.some(i => i.severity === 'error');
    for (const i of issues)
        out.push(`${i.severity.toUpperCase()}: ${i.message}`);
    for (const d of deck.draftedNotPlayed)
        out.push(`DRAFTED-NOT-PLAYED: ${d.total} ${d.name}`);
    out.push('');
    const text = formatDecklist(deck);
    out.push(text);
    if (write && (!hasErrors || force)) {
        mkdirSync(outDir, { recursive: true });
        const path = join(outDir, outputFilename(deck));
        writeFileSync(path, text);
        const handoff = {
            player: { firstName: deck.player.firstName, lastName: deck.player.lastName, table: deck.player.table },
            cards: deck.cards,
            basics: deck.basics,
            playedTotal: playedTotal(deck),
        };
        const jsonPath = path.replace(/\.txt$/, '.json');
        writeFileSync(jsonPath, JSON.stringify(handoff, null, 2) + '\n');
        out.push(`wrote ${path} and ${jsonPath}`);
    }
    else if (write && hasErrors) {
        out.push('not written: fix errors above or rerun with --force');
    }
    return { exitCode: hasErrors ? 1 : 0, stdout: out.join('\n') + '\n' };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const r = run(process.argv.slice(2));
    console.log(r.stdout);
    process.exit(r.exitCode);
}
