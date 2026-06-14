import type { Card, ElementType } from '../../types/card'
import type { GameState, Player } from '../../types/game'
import { updatePlayer } from './internals'

export function hasEnoughSpektra(player: Player, cost: ElementType[]): boolean {
  if (!cost || cost.length === 0) return true

  // Count available elements in spektra pile
  const available: Record<string, number> = {}
  let neutralAvailable = 0
  for (const card of player.spektraPile) {
    const el = card.element ?? 'neutral'
    if (el === 'neutral') {
      neutralAvailable++
    } else {
      available[el] = (available[el] ?? 0) + 1
    }
  }

  // Count needed elements — "neutral" in cost = wildcard (any element pays)
  let neutralNeeded = 0
  const needed: Record<string, number> = {}
  for (const el of cost) {
    if (el === 'neutral') {
      neutralNeeded++
    } else {
      needed[el] = (needed[el] ?? 0) + 1
    }
  }

  // Match specific element costs first; shortfall can be covered by neutral cards
  let neutralRemaining = neutralAvailable
  for (const [element, count] of Object.entries(needed)) {
    const have = available[element] ?? 0
    const shortfall = count - have
    if (shortfall > 0) {
      // Try to cover shortfall with neutral cards (neutral pays for any element)
      if (neutralRemaining >= shortfall) {
        neutralRemaining -= shortfall
      } else {
        return false
      }
    }
  }

  // "Neutral" cost entries are wildcards — any remaining card (including neutral) can pay
  // Specific cards that were over-allocated from the needed check above still count
  const leftoverSpecific = Object.entries(available).reduce((sum, [el, v]) => {
    return sum + Math.max(0, v - (needed[el] ?? 0))
  }, 0)

  return (leftoverSpecific + neutralRemaining) >= neutralNeeded
}

export function consumeSpektra(state: GameState, playerIndex: 0 | 1, cost: ElementType[]): GameState {
  if (!cost || cost.length === 0) return state
  const player = state.players[playerIndex]
  const remaining = [...player.spektraPile]
  const consumed: Card[] = []

  // Pay specific element costs first, then wildcards (neutral costs)
  const specificCosts = cost.filter(el => el !== 'neutral')
  const neutralCostCount = cost.length - specificCosts.length

  for (const element of specificCosts) {
    // Try exact element match first
    let idx = remaining.findIndex(c => (c.element ?? 'neutral') === element)
    // Fall back to neutral card (neutral pays for any element)
    if (idx === -1) idx = remaining.findIndex(c => (c.element ?? 'neutral') === 'neutral')
    if (idx === -1) return state
    consumed.push(remaining.splice(idx, 1)[0])
  }

  // Neutral cost = wildcard, any remaining card can pay
  for (let i = 0; i < neutralCostCount; i++) {
    if (remaining.length === 0) return state
    consumed.push(remaining.splice(0, 1)[0])
  }

  // Consumed spektra are permanently spent — go to graveyard
  return updatePlayer(state, playerIndex, {
    ...player,
    spektraPile: remaining,
    graveyard: [...player.graveyard, ...consumed],
  })
}
