import { describe, it, expect } from 'vitest'
import { validate, playedTotal } from '../lib/validate.js'
import type { Decklist, DeckCard } from '../lib/assemble.js'

function deck(overrides: Partial<Decklist> = {}): Decklist {
  // 23 spells + 17 basics = a legal 40-card deck
  const cards: DeckCard[] = [
    { name: 'Hex Magic', qty: 20, isLand: false },
    { name: 'A.I.M. Labs', qty: 3, isLand: true },
  ]
  return {
    player: { firstName: 'Michael', lastName: 'Steele', table: '125', last3: 'STE' },
    cards,
    basics: [
      { name: 'Plains', qty: 8, isLand: true },
      { name: 'Mountain', qty: 6, isLand: true },
    ],
    draftedNotPlayed: [],
    lowConfidence: [],
    warnings: [],
    hasMarPage: false,
    poolTotal: 42,
    ...overrides,
  }
}

describe('validate', () => {
  it('errors when the drafted pool is not exactly 42', () => {
    const issues = validate(deck({ poolTotal: 39, basics: [{ name: 'Plains', qty: 9, isLand: true }, { name: 'Mountain', qty: 8, isLand: true }] }))
    const err = issues.filter(i => i.severity === 'error' && i.message.includes('pool'))
    expect(err).toHaveLength(1)
    expect(err[0].message).toContain('39')
    expect(err[0].message).toContain('42')
  })

  it('skips the pool check when expectedPool is null', () => {
    const issues = validate(deck({ poolTotal: 39 }), { expectedPool: null })
    expect(issues.some(i => i.message.includes('pool'))).toBe(false)
  })

  it('honors a custom expectedPool (e.g. 45 for draft)', () => {
    const issues = validate(deck({ poolTotal: 42 }), { expectedPool: 45 })
    const err = issues.find(i => i.severity === 'error' && i.message.includes('pool'))
    expect(err?.message).toContain('45')
    expect(err?.message).toContain('42')
  })

  it('sums played cards and basics', () => {
    expect(playedTotal(deck())).toBe(37)
  })

  it('errors when the sum is not exactly 40', () => {
    const issues = validate(deck())
    const err = issues.find(i => i.severity === 'error')
    expect(err?.message).toContain('37')
    expect(err?.message).toContain('MAR')  // under 40, no mar page → hint
  })

  it('passes a clean 40-card deck', () => {
    const d = deck({ basics: [{ name: 'Plains', qty: 9, isLand: true }, { name: 'Mountain', qty: 8, isLand: true }] })
    expect(playedTotal(d)).toBe(40)
    expect(validate(d).filter(i => i.severity === 'error')).toHaveLength(0)
  })

  it('does not hint about MAR when a mar page was provided', () => {
    const issues = validate(deck({ hasMarPage: true }))
    expect(issues.find(i => i.severity === 'error')?.message).not.toContain('MAR')
  })

  it('warns on unusual land counts', () => {
    const d = deck({
      cards: [{ name: 'Hex Magic', qty: 30, isLand: false }],
      basics: [{ name: 'Plains', qty: 10, isLand: true }],
    })
    expect(playedTotal(d)).toBe(40)
    expect(validate(d).some(i => i.severity === 'warning' && i.message.includes('land'))).toBe(true)
  })

  it('warns per low-confidence row', () => {
    const issues = validate(deck({ lowConfidence: [{ page: 'main', row: 133, name: 'Hex Magic', note: 'could be 7' }] }))
    expect(issues.some(i => i.message.includes('Hex Magic') && i.message.includes('could be 7'))).toBe(true)
  })

  it('passes through assembly warnings', () => {
    expect(validate(deck({ warnings: ['unknown row 999'] })).some(i => i.message.includes('999'))).toBe(true)
  })

  it('cross-checks the last-3-letters box', () => {
    const issues = validate(deck({ player: { firstName: 'M', lastName: 'Jones', table: '1', last3: 'STE' } }))
    expect(issues.some(i => i.message.includes('STE'))).toBe(true)
  })

  it('warns when filename fields are missing', () => {
    const issues = validate(deck({ player: { firstName: '', lastName: '', table: '' } }))
    expect(issues.filter(i => i.severity === 'warning').length).toBeGreaterThanOrEqual(1)
  })
})
