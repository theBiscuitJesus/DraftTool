import { lookupRow, type Checklist } from './checklist.js'

export type RecognizedRow = {
  row: number
  total: number | null
  played: number | null
  confidence: 'high' | 'low'
  note?: string
}
export type RecognizedPage = {
  page: 'main' | 'mar'
  photo: string
  player?: { firstName?: string; lastName?: string; table?: string; last3?: string }
  rows: RecognizedRow[]
  basics?: Partial<Record<'plains' | 'island' | 'swamp' | 'mountain' | 'forest', number>>
  // rarely used: digits in the basics box's TOTAL column; counts toward the
  // drafted pool (played basics never do)
  basicsTotal?: Partial<Record<'plains' | 'island' | 'swamp' | 'mountain' | 'forest', number>>
}
export type DeckCard = { name: string; qty: number; isLand: boolean }
export type Decklist = {
  player: { firstName: string; lastName: string; table: string; last3?: string }
  cards: DeckCard[]
  basics: DeckCard[]
  draftedNotPlayed: { name: string; total: number }[]
  lowConfidence: { page: string; row: number; name: string; note?: string }[]
  warnings: string[]
  hasMarPage: boolean
  poolTotal: number // TOTAL-column sum across all pages, basics excluded; a draft pool is 42
}

export function assemble(pages: RecognizedPage[], checklist: Checklist): Decklist {
  const warnings: string[] = []
  const cardsByName = new Map<string, DeckCard>()
  const draftedNotPlayed: Decklist['draftedNotPlayed'] = []
  const lowConfidence: Decklist['lowConfidence'] = []

  const ordered = [...pages].sort((a, b) => (a.page === b.page ? 0 : a.page === 'main' ? -1 : 1))
  const player = ordered.find(p => p.player && Object.values(p.player).some(Boolean))?.player ?? {}
  const poolTotal =
    pages.flatMap(p => p.rows).reduce((s, r) => s + (r.total ?? 0), 0) +
    pages.reduce((s, p) => s + Object.values(p.basicsTotal ?? {}).reduce((t: number, v) => t + (v ?? 0), 0), 0)
  for (const page of ordered) {
    const rows = [...page.rows].sort((a, b) => a.row - b.row)
    for (const r of rows) {
      const entry = lookupRow(checklist, page.page, r.row)
      if (!entry) {
        warnings.push(`unknown row ${r.row} on ${page.page} page (${page.photo}) — ignored`)
        continue
      }
      if (r.confidence === 'low') {
        lowConfidence.push({ page: page.page, row: r.row, name: entry.displayName, ...(r.note ? { note: r.note } : {}) })
      }
      if (r.played && r.played > 0) {
        const existing = cardsByName.get(entry.displayName)
        if (existing) existing.qty += r.played
        else cardsByName.set(entry.displayName, { name: entry.displayName, qty: r.played, isLand: entry.isLand })
      } else if (r.total && r.total > 0) {
        draftedNotPlayed.push({ name: entry.displayName, total: r.total })
      }
    }
  }

  const basicsSource = ordered.find(p => p.basics && Object.values(p.basics).some(Boolean))?.basics ?? {}
  const basics: DeckCard[] = []
  const boxOrder = ['plains', 'island', 'swamp', 'mountain', 'forest'] as const
  for (const key of boxOrder) {
    const qty = basicsSource[key] ?? 0
    if (qty > 0) {
      const name = key[0].toUpperCase() + key.slice(1)
      basics.push({ name, qty, isLand: true })
    }
  }

  return {
    player: {
      firstName: player.firstName ?? '',
      lastName: player.lastName ?? '',
      table: player.table ?? '',
      ...(player.last3 ? { last3: player.last3 } : {}),
    },
    cards: [...cardsByName.values()],
    basics,
    draftedNotPlayed,
    lowConfidence,
    warnings,
    hasMarPage: pages.some(p => p.page === 'mar'),
    poolTotal,
  }
}
