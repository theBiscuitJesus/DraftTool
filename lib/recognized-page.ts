import type { RecognizedPage } from './assemble.js'

function fail(filename: string, problem: string): never {
  throw new Error(`${filename}: ${problem}`)
}

/**
 * Validates JSON produced by the vision model at the CLI trust boundary.
 * Throws a plain Error (message: "<filename>: <field problem>") on any
 * shape mismatch — callers should catch it and print a clean ERROR line,
 * never let it propagate as a stack trace.
 */
export function assertRecognizedPage(value: unknown, filename: string): RecognizedPage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(filename, 'expected a JSON object')
  }
  const v = value as Record<string, unknown>

  if (v.page !== 'main' && v.page !== 'mar') {
    fail(filename, `page must be "main" or "mar", got ${JSON.stringify(v.page)}`)
  }
  if (typeof v.photo !== 'string') {
    fail(filename, `photo must be a string, got ${JSON.stringify(v.photo)}`)
  }
  if (!Array.isArray(v.rows)) {
    fail(filename, `rows must be an array, got ${JSON.stringify(v.rows)}`)
  }

  v.rows.forEach((row: unknown, i: number) => {
    if (typeof row !== 'object' || row === null) {
      fail(filename, `rows[${i}] must be an object`)
    }
    const r = row as Record<string, unknown>
    if (typeof r.row !== 'number') {
      fail(filename, `rows[${i}].row must be a number, got ${JSON.stringify(r.row)}`)
    }
    if (r.total !== null && typeof r.total !== 'number') {
      fail(filename, `rows[${i}].total must be a number or null, got ${JSON.stringify(r.total)}`)
    }
    if (r.played !== null && typeof r.played !== 'number') {
      fail(filename, `rows[${i}].played must be a number or null, got ${JSON.stringify(r.played)}`)
    }
    if (r.confidence !== 'high' && r.confidence !== 'low') {
      fail(filename, `rows[${i}].confidence must be "high" or "low", got ${JSON.stringify(r.confidence)}`)
    }
  })

  if (v.player && typeof v.player === 'object' && v.player !== null) {
    const player = v.player as Record<string, unknown>
    for (const [key, value] of Object.entries(player)) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        fail(filename, `player.${key} must be a string, got ${JSON.stringify(value)}`)
      }
    }
  }

  if (v.basics && typeof v.basics === 'object' && v.basics !== null) {
    const basics = v.basics as Record<string, unknown>
    for (const [key, value] of Object.entries(basics)) {
      if (value !== undefined && value !== null && typeof value !== 'number') {
        fail(filename, `basics.${key} must be a number, got ${JSON.stringify(value)}`)
      }
    }
  }

  return v as RecognizedPage
}
