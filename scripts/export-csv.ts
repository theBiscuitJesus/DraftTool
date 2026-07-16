import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadChecklist } from '../lib/checklist.js'
import { assertRecognizedPage } from '../lib/recognized-page.js'
import { assemble, type RecognizedPage } from '../lib/assemble.js'
import { validate, playedTotal } from '../lib/validate.js'
import { toCsvRows, formatCsv, type CsvRow } from '../lib/csv.js'

const USAGE =
  'usage: export-csv [DIR | page.json ...] [--out FILE] [--pool N|none] [--checklist FILE]\n' +
  '  default input:  scratch/recognition (all *.json)\n' +
  '  default output: output/decklists.csv\n' +
  '  --pool N        enforce a drafted-pool TOTAL of N (e.g. 42 for MSH sealed)\n' +
  '  --pool none     skip the pool check (default; pool size varies by format)\n' +
  '  --checklist F   path to checklist.json (default: data/checklist.json,\n' +
  '                  relative to the working directory)\n'

const VALUE_FLAGS = new Set(['--out', '--pool', '--checklist'])

function collectFiles(inputs: string[]): string[] {
  const files: string[] = []
  for (const p of inputs) {
    let st
    try {
      st = statSync(p)
    } catch (e) {
      throw new Error(`cannot read ${p}: ${(e as Error).message}`)
    }
    if (st.isDirectory()) {
      for (const name of readdirSync(p).sort()) if (name.endsWith('.json')) files.push(join(p, name))
    } else {
      files.push(p)
    }
  }
  return files
}

// A decklist is one main page plus an optional MAR bonus-sheet page for the
// same player. Main pages carry the full header (name + table); MAR pages
// often carry little or nothing, so they are attached by whatever identifying
// info they do have.
type Group = { key: string; table: string; lastName: string; last3: string; pages: RecognizedPage[] }

const norm = (s?: string): string => (s ?? '').trim().toLowerCase()
// The 3-letter tag both pages can share: the "first 3 letters of last name"
// box, or the first 3 letters of the last name itself.
const tag = (last3: string, lastName: string): string => last3 || lastName.slice(0, 3)

export function run(args: string[]): { exitCode: number; stdout: string } {
  const out: string[] = []
  const outIdx = args.indexOf('--out')
  let outFile = 'output/decklists.csv'
  if (outIdx >= 0) {
    const v = args[outIdx + 1]
    if (v === undefined || v.startsWith('--')) return { exitCode: 1, stdout: USAGE }
    outFile = v
  }
  // Batch default: don't assume a pool size (formats differ). Opt in with --pool N.
  let expectedPool: number | null = null
  const poolIdx = args.indexOf('--pool')
  if (poolIdx >= 0) {
    const v = args[poolIdx + 1]
    if (v === undefined || v.startsWith('--')) return { exitCode: 1, stdout: USAGE }
    if (/^(none|off|skip)$/i.test(v)) expectedPool = null
    else if (/^\d+$/.test(v)) expectedPool = Number(v)
    else return { exitCode: 1, stdout: `ERROR: --pool expects a number or "none", got "${v}"\n` }
  }
  const clIdx = args.indexOf('--checklist')
  let checklistPath: string | undefined
  if (clIdx >= 0) {
    const v = args[clIdx + 1]
    if (v === undefined || v.startsWith('--')) return { exitCode: 1, stdout: USAGE }
    checklistPath = v
  }
  const inputs = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1]))
  const inputPaths = inputs.length ? inputs : ['scratch/recognition']

  let files: string[]
  try {
    files = collectFiles(inputPaths)
  } catch (e) {
    return { exitCode: 1, stdout: `ERROR: ${(e as Error).message}\n` }
  }
  if (files.length === 0) {
    return { exitCode: 1, stdout: `ERROR: no recognition JSON files found in ${inputPaths.join(', ')}\n` }
  }

  const loaded: { page: RecognizedPage; file: string }[] = []
  for (const f of files) {
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(f, 'utf8'))
    } catch (e) {
      return { exitCode: 1, stdout: `ERROR: cannot read ${f}: ${(e as Error).message}\n` }
    }
    try {
      loaded.push({ page: assertRecognizedPage(parsed, f), file: f })
    } catch (e) {
      return { exitCode: 1, stdout: `ERROR: ${(e as Error).message}\n` }
    }
  }

  const groups: Group[] = []
  for (const { page, file } of loaded.filter(l => l.page.page === 'main')) {
    const table = norm(page.player?.table)
    const lastName = norm(page.player?.lastName)
    const last3 = norm(page.player?.last3)
    const key = table || lastName ? `${table}|${lastName}` : `main:${file}`
    let g = groups.find(x => x.key === key)
    if (!g) { g = { key, table, lastName, last3, pages: [] }; groups.push(g) }
    g.pages.push(page)
  }
  for (const { page, file } of loaded.filter(l => l.page.page === 'mar')) {
    const table = norm(page.player?.table)
    const last3 = norm(page.player?.last3)
    const lastName = norm(page.player?.lastName)
    const hasHeader = Boolean(table || last3 || lastName)
    const marTag = tag(last3, lastName)
    const matches = groups.filter(g => {
      if (!hasHeader) return false
      if (table && g.table && table !== g.table) return false
      const grpTag = tag(g.last3, g.lastName)
      if (marTag && grpTag && marTag !== grpTag) return false
      return true
    })
    if (matches.length === 1) matches[0].pages.push(page)
    else if (!hasHeader && groups.length === 1) groups[0].pages.push(page)
    else {
      groups.push({ key: `mar:${file}`, table, lastName, last3, pages: [page] })
      out.push(`WARNING: MAR page ${file} could not be matched to a single main page — exported on its own`)
    }
  }

  let checklist
  try {
    checklist = loadChecklist(checklistPath)
  } catch (e) {
    return { exitCode: 1, stdout: `ERROR: cannot read checklist ${checklistPath ?? 'data/checklist.json'}: ${(e as Error).message}\n` }
  }
  const allRows: CsvRow[] = []
  const summary: string[] = []
  for (const g of groups) {
    allRows.push(...toCsvRows(g.pages, checklist))
    const deck = assemble(g.pages, checklist)
    const issues = validate(deck, { expectedPool })
    const name = [deck.player.firstName, deck.player.lastName].filter(Boolean).join(' ') || g.key
    const errs = issues.filter(i => i.severity === 'error').length
    summary.push(`  ${name} (table ${deck.player.table || '?'}): played=${playedTotal(deck)} — ${errs === 0 ? 'OK' : `${errs} error(s)`}`)
    for (const i of issues) summary.push(`      ${i.severity.toUpperCase()}: ${i.message}`)
  }

  mkdirSync(dirname(outFile) || '.', { recursive: true })
  writeFileSync(outFile, formatCsv(allRows))
  out.push(`Processed ${groups.length} decklist(s) from ${files.length} page file(s):`)
  out.push(...summary)
  out.push(`wrote ${outFile} (${allRows.length} card rows)`)
  return { exitCode: 0, stdout: out.join('\n') + '\n' }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = run(process.argv.slice(2))
  console.log(r.stdout)
  process.exit(r.exitCode)
}
