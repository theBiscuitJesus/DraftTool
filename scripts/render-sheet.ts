// Render recognition JSON as a printable mirror of the official checklist
// sheet: same sections, same row order, digits in the PLAYED/TOTAL boxes.
// Usage: npx tsx scripts/render-sheet.ts scratch/recognition/<page>.json [--out DIR]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadChecklist } from '../lib/checklist.js'
import type { RecognizedPage, RecognizedRow } from '../lib/assemble.js'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function renderSheet(page: RecognizedPage): string {
  const checklist = loadChecklist()
  const names = new Map(checklist.entries.filter(e => e.page === 'main').map(e => [e.row, e.displayName]))
  const marks = new Map<number, RecognizedRow>(page.rows.map(r => [r.row, r]))

  // yellow = row is in the deck (has a played value); orange = unsure of the digit
  const cell = (v: number | null | undefined, cls: string) =>
    `<td class="n${cls}">${v ?? ''}</td>`

  const section = (title: string, lo: number, hi: number) => {
    let rows = ''
    for (let n = lo; n <= hi; n++) {
      const m = marks.get(n)
      const cls = m?.confidence === 'low' ? ' unsure' : m?.played != null ? ' indeck' : ''
      rows += `<tr>${cell(m?.played, cls)}${cell(m?.total, cls)}<td class="r">${n}</td><td class="c">${esc(names.get(n) ?? '')}</td></tr>`
    }
    return `<table><thead><tr><th class="n">PLD</th><th class="n">TOT</th><th class="r"></th><th class="c">${title}</th></tr></thead><tbody>${rows}</tbody></table>`
  }

  const basicsRows = (['plains', 'island', 'swamp', 'mountain', 'forest'] as const)
    .map(k => `<tr><td class="n${page.basics?.[k] ? ' indeck' : ''}">${page.basics?.[k] || ''}</td><td class="c">${k[0].toUpperCase() + k.slice(1)}</td></tr>`)
    .join('')
  const basics = `<table class="basics"><thead><tr><th class="n">PLD</th><th class="c">BASIC LANDS</th></tr></thead><tbody>${basicsRows}</tbody></table>`

  const p = page.player ?? {}
  const playedSum =
    page.rows.reduce((s, r) => s + (r.played ?? 0), 0) +
    Object.values(page.basics ?? {}).reduce((s, v) => s + (v ?? 0), 0)

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.lastName ?? '')} sheet check</title><style>
  body { font: 6.5pt/1.25 -apple-system, Helvetica, sans-serif; margin: 12px; }
  h1 { font-size: 11pt; margin: 0 0 2px; }
  .meta { font-size: 8pt; margin-bottom: 6px; }
  .cols { display: flex; gap: 6px; align-items: flex-start; }
  .col { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 0.5px solid #999; padding: 0.5px 2px; }
  th { background: #eee; font-size: 5.5pt; text-align: left; }
  td.n, th.n { width: 14px; text-align: center; font-weight: 700; font-size: 7.5pt; }
  td.r { width: 16px; text-align: right; color: #777; }
  td.c { overflow: hidden; white-space: nowrap; max-width: 110px; text-overflow: ellipsis; }
  td.indeck { background: #fff176; }
  td.unsure { background: #ffb74d; }
  .basics td.c { font-weight: 600; }
  @media print { body { margin: 0; } }
  </style></head><body>
  <h1>${esc([p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown player')} — Table ${esc(p.table ?? '?')}</h1>
  <div class="meta">Scanned from ${esc(page.photo)} · played sum ${playedSum} · yellow = in deck (has a PLAYED number) · orange = unsure of the digit, verify against the sheet</div>
  <div class="cols">
    <div class="col">${section('WHITE', 1, 42)}</div>
    <div class="col">${section('BLUE', 43, 84)}</div>
    <div class="col">${section('BLACK', 85, 123)}</div>
    <div class="col">${section('RED', 124, 160)}</div>
  </div>
  <div style="height:6px"></div>
  <div class="cols">
    <div class="col">${section('GREEN', 161, 197)}</div>
    <div class="col">${section('MULTICOLOR', 198, 235)}</div>
    <div class="col">${section('', 236, 241)}${section('ARTIFACTS', 242, 256)}${section('NONBASIC LANDS', 257, 267)}</div>
    <div class="col">${section('', 268, 276)}${basics}</div>
  </div>
  </body></html>`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const outIdx = args.indexOf('--out')
  const outDir = outIdx >= 0 ? args[outIdx + 1] : 'output'
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')
  for (const f of files) {
    const page = JSON.parse(readFileSync(f, 'utf8')) as RecognizedPage
    mkdirSync(outDir, { recursive: true })
    const base = (f.split('/').pop() ?? 'sheet').replace(/\.json$/, '')
    const path = join(outDir, `${base}-sheet.html`)
    writeFileSync(path, renderSheet(page))
    console.log(`wrote ${path}`)
  }
}
