import type { Card } from '../../types/card'
import type { GameState, Player } from '../../types/game'

/**
 * Internal engine helpers shared across core modules.
 *
 * NOT part of the public package surface — `engine/core/index.ts` deliberately
 * does not re-export this file, so these stay private to the engine.
 */

/** Return a new GameState with one player replaced (immutable). */
export function updatePlayer(state: GameState, index: 0 | 1, player: Player): GameState {
  const players: [Player, Player] = [state.players[0], state.players[1]]
  players[index] = player
  return { ...state, players }
}

/** Fisher–Yates shuffle into a fresh array (does not mutate input). */
export function shuffleCards(cards: Card[]): Card[] {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/** Untap a player's active and reserve avatars. */
export function untapAvatars(player: Player): Player {
  return {
    ...player,
    activeAvatar: player.activeAvatar ? { ...player.activeAvatar, isTapped: false } : null,
    reserveAvatars: player.reserveAvatars.map(a => ({ ...a, isTapped: false })),
  }
}
