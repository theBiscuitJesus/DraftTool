import { describe, it, expect } from 'vitest'
import { assertRecognizedPage } from '../lib/recognized-page.js'

const valid = {
  page: 'main',
  photo: 'a.jpg',
  rows: [{ row: 42, total: 3, played: 3, confidence: 'high' }],
}

describe('assertRecognizedPage', () => {
  it('accepts a valid page and returns it typed', () => {
    const result = assertRecognizedPage(valid, 'a.json')
    expect(result.page).toBe('main')
  })

  it('rejects wrong-case page value ("MAIN")', () => {
    expect(() => assertRecognizedPage({ ...valid, page: 'MAIN' }, 'a.json')).toThrow(/a\.json/)
    expect(() => assertRecognizedPage({ ...valid, page: 'MAIN' }, 'a.json')).toThrow(/page/)
  })

  it('rejects an unknown page value', () => {
    expect(() => assertRecognizedPage({ ...valid, page: 'sideboard' }, 'a.json')).toThrow(/page/)
  })

  it('rejects non-object input', () => {
    expect(() => assertRecognizedPage(null, 'a.json')).toThrow(/a\.json/)
    expect(() => assertRecognizedPage('nope', 'a.json')).toThrow(/a\.json/)
  })

  it('rejects rows that is not an array', () => {
    expect(() => assertRecognizedPage({ ...valid, rows: 'nope' }, 'a.json')).toThrow(/rows/)
  })

  it('rejects a row with a non-numeric row field', () => {
    expect(() =>
      assertRecognizedPage({ ...valid, rows: [{ row: '42', total: 1, played: 1, confidence: 'high' }] }, 'a.json'),
    ).toThrow(/row/)
  })

  it('rejects a row with a non-numeric, non-null total', () => {
    expect(() =>
      assertRecognizedPage({ ...valid, rows: [{ row: 42, total: '3', played: 1, confidence: 'high' }] }, 'a.json'),
    ).toThrow(/total/)
  })

  it('rejects a row with a non-numeric, non-null played', () => {
    expect(() =>
      assertRecognizedPage({ ...valid, rows: [{ row: 42, total: 3, played: 'yes', confidence: 'high' }] }, 'a.json'),
    ).toThrow(/played/)
  })

  it('accepts null total/played', () => {
    const result = assertRecognizedPage(
      { ...valid, rows: [{ row: 42, total: null, played: null, confidence: 'high' }] },
      'a.json',
    )
    expect(result.rows[0].total).toBeNull()
  })

  it('rejects an invalid confidence value', () => {
    expect(() =>
      assertRecognizedPage({ ...valid, rows: [{ row: 42, total: 1, played: 1, confidence: 'medium' }] }, 'a.json'),
    ).toThrow(/confidence/)
  })

  it('rejects player.table when it is a number instead of string', () => {
    expect(() =>
      assertRecognizedPage({ ...valid, player: { table: 125 } }, 'a.json'),
    ).toThrow(/a\.json/)
    expect(() =>
      assertRecognizedPage({ ...valid, player: { table: 125 } }, 'a.json'),
    ).toThrow(/player/)
  })

  it('rejects basics.plains when it is a string instead of number', () => {
    expect(() =>
      assertRecognizedPage({ ...valid, basics: { plains: '9' } }, 'a.json'),
    ).toThrow(/a\.json/)
    expect(() =>
      assertRecognizedPage({ ...valid, basics: { plains: '9' } }, 'a.json'),
    ).toThrow(/basics/)
  })
})
