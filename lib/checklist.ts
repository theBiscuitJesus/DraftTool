import { readFileSync } from 'node:fs'

export type ChecklistEntry = {
  page: 'main' | 'mar'
  row: number
  name: string
  displayName: string
  isLand: boolean
}
export type Checklist = { entries: ChecklistEntry[]; basics: string[] }

export function loadChecklist(path = 'data/checklist.json'): Checklist {
  return JSON.parse(readFileSync(path, 'utf8')) as Checklist
}

export function lookupRow(c: Checklist, page: 'main' | 'mar', row: number): ChecklistEntry | undefined {
  return c.entries.find(e => e.page === page && e.row === row)
}
