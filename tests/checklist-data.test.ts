import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

type Entry = { page: 'main' | 'mar'; row: number; name: string; displayName: string; isLand: boolean }
const data = JSON.parse(readFileSync('data/checklist.json', 'utf8')) as {
  entries: Entry[]
  basics: string[]
}
const find = (page: string, row: number) => data.entries.find(e => e.page === page && e.row === row)

// Spot-check pairs transcribed by eye from the official PDF renders.
describe('checklist data', () => {
  it('has 276 main rows and 60 mar rows', () => {
    expect(data.entries.filter(e => e.page === 'main')).toHaveLength(276)
    expect(data.entries.filter(e => e.page === 'mar')).toHaveLength(60)
  })

  it('has the five basics in sheet-box order', () => {
    expect(data.basics).toEqual(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'])
  })

  it('matches spot-checked main rows from the PDF', () => {
    expect(find('main', 1)?.name).toBe('Agent 13, Sharon Carter')
    expect(find('main', 88)?.name).toBe('Baron Strucker, HYDRA Overlord')
    expect(find('main', 133)?.name).toBe('Hex Magic')
    expect(find('main', 197)?.name).toBe('World War Hulk')
    expect(find('main', 242)?.name).toBe('A.I.M. Synthoids')
    expect(find('main', 257)?.name).toBe('A.I.M. Labs')
    expect(find('main', 276)?.name).toBe('Villainous Hideout')
  })

  it('matches spot-checked mar rows, with Marvel display names', () => {
    expect(find('mar', 41)?.name).toBe('Archangel of Thune')
    expect(find('mar', 41)?.displayName).toBe('Heaven-Sent Marvel')
    expect(find('mar', 47)?.displayName).toBe('Path to Exile')
    expect(find('mar', 79)?.displayName).toBe('Heroic Intervention')
    expect(find('mar', 100)?.name).toBe('Sword of Fire and Ice')
    expect(find('mar', 100)?.displayName).toBe('Patriotic Shield')
  })

  it('marks lands', () => {
    expect(find('main', 257)?.isLand).toBe(true)  // A.I.M. Labs (nonbasic land)
    expect(find('main', 1)?.isLand).toBe(false)
  })

  it('has display names on every entry', () => {
    for (const e of data.entries) {
      expect(e.displayName.length, `row ${e.page}/${e.row}`).toBeGreaterThan(0)
    }
  })
})
