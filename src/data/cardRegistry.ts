import type { Card, ElementType, CardCategory } from '../types/card'
import { allCsvCards } from './cards/generated'

function flatArray(val: unknown): Card[] {
  if (!val) return []
  if (Array.isArray(val)) return val as Card[]
  return [val as Card]
}

// Single source of truth: CSV-generated cards.
// Legacy hand-written card files (fire.ts, water.ts, ...) are NOT aggregated:
// their ids never matched the CSV ids, so the old "fallback for ids not in CSV"
// filter let every legacy card leak through with stale card numbers, producing
// duplicate card_numbers with conflicting rarities in the DB catalog.
const ALL_CARDS: Card[] = flatArray(allCsvCards)

// Deduplicate by id
const uniqueCards: Card[] = Array.from(
  new Map(ALL_CARDS.map(c => [c.id, c])).values()
)

export const cardRegistry = {
  getAllCards: (): Card[] => uniqueCards,
  getCardById: (id: string): Card | undefined => uniqueCards.find(c => c.id === id),
  getCardsByElement: (element: ElementType): Card[] => uniqueCards.filter(c => c.element === element),
  getCardsByType: (type: CardCategory): Card[] => uniqueCards.filter(c => c.type === type),
  shuffleDeck: (deck: Card[]): Card[] => {
    const shuffled = [...deck]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  },
}
