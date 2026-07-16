// Sheet row numbers are Scryfall collector numbers: msh 1-276 = main grid,
// mar 41-100 = Source Material page. The sheet's BASIC LANDS box has no row
// numbers (msh basics live at cn 277-286, two arts each — not fetched; the
// five names are constant).
import { writeFileSync } from 'node:fs'

type ScryCard = {
  name: string
  flavor_name?: string
  type_line?: string
  collector_number: string
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function fetchSet(query: string): Promise<ScryCard[]> {
  const cards: ScryCard[] = []
  let url: string | null =
    `https://api.scryfall.com/cards/search?unique=prints&order=set&q=${encodeURIComponent(query)}`
  while (url) {
    const res = await fetch(url, { headers: { 'User-Agent': 'mtg-decklist-scanner/1.0' } })
    if (!res.ok) throw new Error(`Scryfall ${res.status} for ${url}: ${await res.text()}`)
    const page = (await res.json()) as { data: ScryCard[]; has_more: boolean; next_page?: string }
    cards.push(...page.data)
    url = page.has_more ? page.next_page! : null
    await sleep(120)
  }
  return cards
}

function toEntry(page: 'main' | 'mar', c: ScryCard) {
  return {
    page,
    row: Number(c.collector_number),
    name: c.name,
    displayName: c.flavor_name ?? c.name,
    isLand: (c.type_line ?? '').includes('Land'),
  }
}

const mainCards = await fetchSet('e:msh cn>=1 cn<=276')
const mar = await fetchSet('e:mar cn>=41 cn<=100')

const entries = [
  ...mainCards.map(c => toEntry('main', c)),
  ...mar.map(c => toEntry('mar', c)),
].sort((a, b) => (a.page === b.page ? a.row - b.row : a.page === 'main' ? -1 : 1))

// Sheet-box order is fixed on the printed sheet, independent of collector order.
const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']

// Fail loudly if Scryfall doesn't match the printed sheet.
const checks: Array<[string, number, string]> = [
  ['main', 1, 'Agent 13, Sharon Carter'],
  ['main', 88, 'Baron Strucker, HYDRA Overlord'],
  ['main', 133, 'Hex Magic'],
  ['main', 276, 'Villainous Hideout'],
  ['mar', 41, 'Archangel of Thune'],
  ['mar', 100, 'Sword of Fire and Ice'],
]
if (mainCards.length !== 276) throw new Error(`expected 276 main cards, got ${mainCards.length}`)
if (mar.length !== 60) throw new Error(`expected 60 mar cards, got ${mar.length}`)
for (const [page, row, name] of checks) {
  const e = entries.find(x => x.page === page && x.row === row)
  if (e?.name !== name) throw new Error(`spot check failed: ${page}/${row} = ${e?.name}, expected ${name}`)
}

writeFileSync('data/checklist.json', JSON.stringify({ entries, basics }, null, 2) + '\n')
console.log(`wrote data/checklist.json: ${entries.length} entries`)
