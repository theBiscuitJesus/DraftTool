import { describe, it, expect } from 'vitest'
import { loadChecklist, lookupRow } from '../lib/checklist.js'

describe('loadChecklist', () => {
  const c = loadChecklist()

  it('loads all entries', () => {
    expect(c.entries).toHaveLength(336)
    expect(c.basics).toHaveLength(5)
  })

  it('looks up rows by page and number', () => {
    expect(lookupRow(c, 'main', 133)?.name).toBe('Hex Magic')
    expect(lookupRow(c, 'mar', 100)?.displayName).toBe('Patriotic Shield')
  })

  it('returns undefined for unknown rows', () => {
    expect(lookupRow(c, 'main', 300)).toBeUndefined()
    expect(lookupRow(c, 'mar', 1)).toBeUndefined()
  })
})
