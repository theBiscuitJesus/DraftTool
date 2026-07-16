import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync, rmSync, mkdirSync, statSync, readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { run, fillPdf } from '../scripts/fill-pdf.js'
import { loadPdfBytes } from '../lib/pdf-positions.js'
import type { RecognizedPage } from '../lib/assemble.js'

const OUT = 'scratch/test-out-fill-pdf'
beforeEach(() => {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
})

describe('fill-pdf CLI', () => {
  it('fills the main-page fixture and writes a non-trivial PDF with both source pages intact', async () => {
    const r = await run(['tests/fixtures/main-page.json', '--out', OUT])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain(`wrote ${OUT}/main-page-filled.pdf`)

    const path = `${OUT}/main-page-filled.pdf`
    expect(existsSync(path)).toBe(true)
    expect(statSync(path).size).toBeGreaterThan(50_000) // official PDF alone is ~900KB; a trivial/broken write would be tiny

    const doc = await PDFDocument.load(readFileSync(path))
    expect(doc.getPageCount()).toBe(2)
  })

  it('fills the mar-page fixture', async () => {
    const r = await run(['tests/fixtures/mar-page.json', '--out', OUT])
    expect(r.exitCode).toBe(0)
    const path = `${OUT}/mar-page-filled.pdf`
    expect(existsSync(path)).toBe(true)
    const doc = await PDFDocument.load(readFileSync(path))
    expect(doc.getPageCount()).toBe(2)
  })

  it('fills multiple inputs in one invocation', async () => {
    const r = await run(['tests/fixtures/main-page.json', 'tests/fixtures/mar-page.json', '--out', OUT])
    expect(r.exitCode).toBe(0)
    expect(existsSync(`${OUT}/main-page-filled.pdf`)).toBe(true)
    expect(existsSync(`${OUT}/mar-page-filled.pdf`)).toBe(true)
  })

  it('reports a clean error for a mistyped input path instead of crashing', async () => {
    const r = await run(['tests/fixtures/does-not-exist.json', '--out', OUT])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain('ERROR: cannot read tests/fixtures/does-not-exist.json:')
    expect(r.stdout).not.toContain('\n    at ')
  })

  it('gives a clean usage error with no arguments', async () => {
    const r = await run([])
    expect(r.exitCode).toBe(1)
    expect(r.stdout.toLowerCase()).toContain('usage')
  })
})

describe('fillPdf', () => {
  it('places a box for every recognized row (no silent drops) on the main page', async () => {
    const page: RecognizedPage = {
      page: 'main',
      photo: 'test.jpg',
      rows: [
        { row: 1, total: 2, played: 2, confidence: 'high' },
        { row: 276, total: 1, played: 1, confidence: 'low' },
      ],
    }
    // A row missing from the PDF's text layer would log a warning; capture
    // console.warn to assert none fired for these in-range rows.
    const warnings: unknown[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => warnings.push(args)
    try {
      const bytes = await fillPdf(page, loadPdfBytes())
      expect(bytes.byteLength).toBeGreaterThan(0)
    } finally {
      console.warn = originalWarn
    }
    expect(warnings).toEqual([])
  })
})
