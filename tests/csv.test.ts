import { describe, it, expect } from 'vitest'
import { toCsvRows, formatCsv } from '../lib/csv.js'
import { loadChecklist } from '../lib/checklist.js'
import type { RecognizedPage } from '../lib/assemble.js'

const checklist = loadChecklist()

describe('toCsvRows', () => {
  it('keeps BOTH total and played on a played row', () => {
    const page: RecognizedPage = {
      page: 'main', photo: 'x.jpg',
      player: { firstName: 'Carolyn', lastName: 'Pardee', table: '21' },
      rows: [{ row: 8, total: 2, played: 1, confidence: 'high' }], // row 8 = Brave Brawler
    }
    const brave = toCsvRows([page], checklist).find(r => r.card === 'Brave Brawler')!
    expect(brave).toMatchObject({ player: 'Carolyn Pardee', table: '21', total: 2, played: 1 })
  })

  it('emits a drafted-but-not-played row with played left blank (null)', () => {
    const page: RecognizedPage = { page: 'main', photo: 'x.jpg', rows: [{ row: 1, total: 1, played: null, confidence: 'high' }] }
    expect(toCsvRows([page], checklist)[0]).toMatchObject({ total: 1, played: null })
  })

  it('merges art-variant rows of the same card, summing total and played', () => {
    const main: RecognizedPage = { page: 'main', photo: 'm.jpg', rows: [] }
    const mar: RecognizedPage = {
      page: 'mar', photo: 'r.jpg',
      rows: [ // MAR rows 79 & 80 are both Heroic Intervention
        { row: 79, total: 1, played: 1, confidence: 'high' },
        { row: 80, total: 1, played: 1, confidence: 'high' },
      ],
    }
    const hi = toCsvRows([main, mar], checklist).filter(r => r.card === 'Heroic Intervention')
    expect(hi).toHaveLength(1)
    expect(hi[0]).toMatchObject({ total: 2, played: 2 })
  })

  it('includes basics with played counts, ordered last in sheet-box order', () => {
    const page: RecognizedPage = {
      page: 'main', photo: 'x.jpg',
      rows: [{ row: 8, total: 1, played: 1, confidence: 'high' }],
      basics: { plains: 7, island: 4 },
    }
    const rows = toCsvRows([page], checklist)
    expect(rows[rows.length - 2]).toMatchObject({ card: 'Plains', played: 7, total: null })
    expect(rows[rows.length - 1]).toMatchObject({ card: 'Island', played: 4 })
  })

  it('carries confidence and note through for flagged cells', () => {
    const page: RecognizedPage = {
      page: 'main', photo: 'x.jpg',
      rows: [{ row: 8, total: 1, played: 1, confidence: 'low', note: 'could be 7' }],
    }
    expect(toCsvRows([page], checklist)[0]).toMatchObject({ confidence: 'low', note: 'could be 7' })
  })
})

describe('formatCsv', () => {
  it('writes the header and quotes card names containing commas', () => {
    const csv = formatCsv([
      { player: 'Carolyn Pardee', table: '21', card: 'Mockingbird, Ace Agent', total: 2, played: 2, confidence: 'high', note: '' },
    ])
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('player,table,card,total,played,confidence,note')
    expect(lines[1]).toContain('"Mockingbird, Ace Agent"')
  })

  it('renders null total/played as empty cells', () => {
    const csv = formatCsv([{ player: 'X', table: '1', card: 'Foo', total: 1, played: null, confidence: 'high', note: '' }])
    expect(csv.trim().split('\n')[1]).toBe('X,1,Foo,1,,high,')
  })
})
