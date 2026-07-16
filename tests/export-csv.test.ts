import { describe, it, expect, beforeEach } from 'vitest'
import { run } from '../scripts/export-csv.js'
import { rmSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'

const OUT = 'scratch/test-out-export-csv'
beforeEach(() => { rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true }) })

describe('export-csv CLI', () => {
  it('exports a combined CSV from main + mar pages', () => {
    const r = run(['tests/fixtures/main-page.json', 'tests/fixtures/mar-page.json', '--out', `${OUT}/decklists.csv`])
    expect(r.exitCode).toBe(0)
    const csv = readFileSync(`${OUT}/decklists.csv`, 'utf8')
    expect(csv.split('\n')[0]).toBe('player,table,card,total,played,confidence,note')
    expect(csv).toContain('Michael Steele')
    expect(csv).toContain('Heroic Intervention')
    expect(csv).toMatch(/,Plains,,9,/) // basic: total blank, played 9
  })

  it('reports per-decklist validation in stdout and marks a valid deck OK', () => {
    const r = run(['tests/fixtures/main-page.json', 'tests/fixtures/mar-page.json', '--out', `${OUT}/d.csv`])
    expect(r.stdout).toContain('Michael Steele')
    expect(r.stdout).toContain('played=40')
    expect(r.stdout).toContain('OK')
  })

  it('flags a non-40 deck in the summary but still writes the CSV', () => {
    const r = run(['tests/fixtures/main-page.json', '--out', `${OUT}/d.csv`])
    expect(existsSync(`${OUT}/d.csv`)).toBe(true)
    expect(r.stdout).toContain('ERROR')
    expect(r.stdout).toContain('37')
  })

  it('does not enforce a drafted-pool size by default (draft-friendly)', () => {
    // main-page pool sums to 39; without --pool that must NOT be an error
    const r = run(['tests/fixtures/main-page.json', '--out', `${OUT}/d.csv`])
    expect(r.stdout).not.toContain('pool')
  })

  it('enforces the pool total when --pool N is given', () => {
    const r = run(['tests/fixtures/main-page.json', '--pool', '42', '--out', `${OUT}/d.csv`])
    expect(r.stdout).toContain('pool')
    expect(r.stdout).toContain('39')
    expect(r.stdout).toContain('42')
  })

  it('rejects a non-numeric --pool value cleanly', () => {
    const r = run(['tests/fixtures/main-page.json', '--pool', 'banana', '--out', `${OUT}/d.csv`])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain('ERROR')
    expect(r.stdout).not.toContain('\n    at ')
  })

  it('accepts an explicit --checklist path (for plugin/bundled use)', () => {
    const r = run(['tests/fixtures/main-page.json', '--checklist', 'data/checklist.json', '--out', `${OUT}/d.csv`])
    expect(r.exitCode).toBe(0)
    expect(readFileSync(`${OUT}/d.csv`, 'utf8')).toContain('Michael Steele')
  })

  it('errors cleanly when --checklist points at a missing file', () => {
    const r = run(['tests/fixtures/main-page.json', '--checklist', 'nope/checklist.json', '--out', `${OUT}/d.csv`])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain('ERROR: cannot read checklist')
    expect(r.stdout).not.toContain('\n    at ')
  })

  it('reads every *.json in a directory', () => {
    writeFileSync(`${OUT}/main-page.json`, readFileSync('tests/fixtures/main-page.json', 'utf8'))
    writeFileSync(`${OUT}/mar-page.json`, readFileSync('tests/fixtures/mar-page.json', 'utf8'))
    const r = run([OUT, '--out', `${OUT}/decklists.csv`])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain('played=40')
  })

  it('attaches a header-light MAR page to its main page by table + last-3 tag', () => {
    // main: Steele, table 125, last3 STE. mar carries only table + last3.
    writeFileSync(`${OUT}/main.json`, readFileSync('tests/fixtures/main-page.json', 'utf8'))
    const mar = JSON.parse(readFileSync('tests/fixtures/mar-page.json', 'utf8'))
    mar.player = { table: '125', last3: 'STE' }
    writeFileSync(`${OUT}/mar.json`, JSON.stringify(mar))
    const r = run([`${OUT}/main.json`, `${OUT}/mar.json`, '--out', `${OUT}/d.csv`])
    expect(r.stdout).toContain('Processed 1 decklist(s)') // merged, not two
    expect(r.stdout).toContain('played=40')
    expect(r.stdout).not.toContain('could not be matched')
  })

  it('errors cleanly on a missing input path (no stack trace)', () => {
    const r = run(['tests/fixtures/nope.json', '--out', `${OUT}/d.csv`])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain('ERROR')
    expect(r.stdout).not.toContain('\n    at ')
  })

  it('gives a usage error when --out has no value', () => {
    const r = run(['tests/fixtures/main-page.json', '--out'])
    expect(r.exitCode).toBe(1)
    expect(r.stdout.toLowerCase()).toContain('usage')
  })
})
