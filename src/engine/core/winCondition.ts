import type { AvatarCard } from '../../types/card'
import type { GameState } from '../../types/game'

export function checkWinner(state: GameState): string | null {
  if (state.winner) return state.winner

  for (const pi of [0, 1] as const) {
    const player = state.players[pi]
    // Lose if life cards reach 0
    if (player.lifeCards.length === 0) {
      return state.players[pi === 0 ? 1 : 0].id
    }
    // Lose if no active avatar, no reserve avatars, and no Level 1 avatar in hand to deploy
    if (!player.activeAvatar && player.reserveAvatars.length === 0) {
      const hasPlayableAvatar = player.hand.some(c => c.type === 'avatar' && Number((c as AvatarCard).level) === 1)
      if (!hasPlayableAvatar) {
        return state.players[pi === 0 ? 1 : 0].id
      }
    }
  }
  return null
}
