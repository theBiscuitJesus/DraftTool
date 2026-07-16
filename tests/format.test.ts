import { describe, it, expect } from 'vitest'
import { formatDecklist, outputFilename } from '../lib/format.js'
import type { Decklist } from '../lib/assemble.js'

const deck: Decklist = {
  player: { firstName: 'Michael', lastName: 'Steele', table: '125' },
  cards: [
    { name: 'Web Up', qty: 3, isLand: false },
    { name: 'Heroic Intervention', qty: 2, isLand: false },
  ],
  basics: [
    { name: 'Plains', qty: 7, isLand: true },
    { name: 'Mountain', qty: 6, isLand: true },
  ],
  draftedNotPlayed: [{ name: 'Hex Magic', total: 1 }],
  lowConfidence: [],
  warnings: [],
  hasMarPage: true,
  poolTotal: 42,
}

describe('formatDecklist', () => {
  it('produces the exact broadcast text', () => {
    expect(formatDecklist(deck)).toBe(
      'Player: Michael Steele (Table 125)\n' +
      '\n' +
      '3 Web Up\n' +
      '2 Heroic Intervention\n' +
      '7 Plains\n' +
      '6 Mountain\n'
    )
  })

  it('never includes drafted-not-played cards', () => {
    expect(formatDecklist(deck)).not.toContain('Hex Magic')
  })
})

describe('outputFilename', () => {
  it('builds table-lastname.txt, sanitized', () => {
    expect(outputFilename(deck)).toBe('125-steele.txt')
  })

  it('sanitizes punctuation and spaces', () => {
    const d = { ...deck, player: { firstName: 'A', lastName: "O'Brien Jr", table: '12 A' } }
    expect(outputFilename(d)).toBe('12a-obrienjr.txt')
  })

  it('falls back when fields are missing', () => {
    const d = { ...deck, player: { firstName: '', lastName: '', table: '' } }
    expect(outputFilename(d)).toBe('unknown-unknown.txt')
  })
})
