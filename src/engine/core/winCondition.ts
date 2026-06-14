import type { GameState } from '../../types/game'

/**
 * A player loses when their life cards reach 0 — that is the only hard loss.
 * Life cards are the redeploy resource (the defeat flow draws one into hand to
 * field a new avatar), so an empty board with life cards remaining is NOT a
 * loss. Checking only this condition also makes the result order-independent:
 * whichever player is actually out of life cards loses.
 */
export function checkWinner(state: GameState): string | null {
  if (state.winner) return state.winner

  for (const pi of [0, 1] as const) {
    if (state.players[pi].lifeCards.length === 0) {
      return state.players[pi === 0 ? 1 : 0].id
    }
  }
  return null
}
