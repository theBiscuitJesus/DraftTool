import type { Decklist } from './assemble.js'

export function formatDecklist(deck: Decklist): string {
  const name = [deck.player.firstName, deck.player.lastName].filter(Boolean).join(' ')
  const lines = [
    `Player: ${name} (Table ${deck.player.table})`,
    '',
    ...deck.cards.map(c => `${c.qty} ${c.name}`),
    ...deck.basics.map(c => `${c.qty} ${c.name}`),
  ]
  return lines.join('\n') + '\n'
}

const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown'

export function outputFilename(deck: Decklist): string {
  return `${sanitize(deck.player.table)}-${sanitize(deck.player.lastName)}.txt`
}
