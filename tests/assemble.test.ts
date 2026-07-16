import { describe, it, expect } from 'vitest'
import { loadChecklist } from '../lib/checklist.js'
import { assemble, type RecognizedPage } from '../lib/assemble.js'

const checklist = loadChecklist()

const mainPage: RecognizedPage = {
  page: 'main',
  photo: 'a.jpg',
  player: { firstName: 'Michael', lastName: 'Steele', table: '125', last3: 'STE' },
  rows: [
    { row: 42, total: 3, played: 3, confidence: 'high' },   // White Widow, Free Agent
    { row: 133, total: 2, played: 1, confidence: 'low', note: 'could be 7' }, // Hex Magic
    { row: 88, total: 1, played: null, confidence: 'high' }, // drafted, not played
    { row: 257, total: 1, played: 1, confidence: 'high' },  // A.I.M. Labs (land)
  ],
  basics: { plains: 7, mountain: 6 },
}

const marPage: RecognizedPage = {
  page: 'mar',
  photo: 'b.jpg',
  rows: [
    { row: 79, total: 1, played: 1, confidence: 'high' },   // Heroic Intervention
    { row: 80, total: 1, played: 1, confidence: 'high' },   // Heroic Intervention (art variant)
    { row: 41, total: 1, played: 1, confidence: 'high' },   // Heaven-Sent Marvel
  ],
}

describe('assemble', () => {
  const deck = assemble([mainPage, marPage], checklist)

  it('extracts player info', () => {
    expect(deck.player).toEqual({ firstName: 'Michael', lastName: 'Steele', table: '125', last3: 'STE' })
  })

  it('keeps played cards in checklist order: main rows then mar rows', () => {
    expect(deck.cards.map(c => c.name)).toEqual([
      'White Widow, Free Agent',
      'Hex Magic',
      'A.I.M. Labs',
      'Heaven-Sent Marvel',
      'Heroic Intervention',
    ])
  })

  it('merges duplicate mar art-variant rows into one line', () => {
    expect(deck.cards.find(c => c.name === 'Heroic Intervention')?.qty).toBe(2)
  })

  it('uses quantities from the PLAYED column', () => {
    expect(deck.cards.find(c => c.name === 'White Widow, Free Agent')?.qty).toBe(3)
    expect(deck.cards.find(c => c.name === 'Hex Magic')?.qty).toBe(1)
  })

  it('maps basics in sheet-box order with zeros dropped', () => {
    expect(deck.basics).toEqual([
      { name: 'Plains', qty: 7, isLand: true },
      { name: 'Mountain', qty: 6, isLand: true },
    ])
  })

  it('separates drafted-not-played rows', () => {
    expect(deck.draftedNotPlayed).toEqual([{ name: 'Baron Strucker, HYDRA Overlord', total: 1 }])
  })

  it('surfaces low-confidence rows with names resolved', () => {
    expect(deck.lowConfidence).toEqual([{ page: 'main', row: 133, name: 'Hex Magic', note: 'could be 7' }])
  })

  it('computes poolTotal from TOTAL columns across pages, basicsTotal included when present', () => {
    expect(deck.poolTotal).toBe(10)
    const withBasicsTotal = assemble([{ ...mainPage, basicsTotal: { plains: 2 } }, marPage], checklist)
    expect(withBasicsTotal.poolTotal).toBe(12)
  })

  it('flags mar page presence and land types', () => {
    expect(deck.hasMarPage).toBe(true)
    expect(deck.cards.find(c => c.name === 'A.I.M. Labs')?.isLand).toBe(true)
  })

  it('warns on unknown rows instead of crashing', () => {
    const bad = assemble([{ ...mainPage, rows: [{ row: 999, total: 1, played: 1, confidence: 'high' }] }], checklist)
    expect(bad.warnings.some(w => w.includes('999'))).toBe(true)
    expect(bad.cards).toHaveLength(0)
  })

  it('uses displayName for mar cards (Marvel names)', () => {
    expect(deck.cards.some(c => c.name === 'Heaven-Sent Marvel')).toBe(true)
    expect(deck.cards.some(c => c.name === 'Archangel of Thune')).toBe(false)
  })

  it('works with a main page alone', () => {
    const solo = assemble([mainPage], checklist)
    expect(solo.hasMarPage).toBe(false)
  })

  it('does not let an empty player/basics object on a mar page listed first shadow the main page data', () => {
    const emptyMar: RecognizedPage = { page: 'mar', photo: 'c.jpg', player: {}, rows: [], basics: {} }
    const result = assemble([emptyMar, mainPage], checklist)
    expect(result.player).toEqual({ firstName: 'Michael', lastName: 'Steele', table: '125', last3: 'STE' })
    expect(result.basics).toEqual([
      { name: 'Plains', qty: 7, isLand: true },
      { name: 'Mountain', qty: 6, isLand: true },
    ])
  })
})
