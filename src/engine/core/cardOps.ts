import type { AvatarCard } from '../../types/card'
import type { GameState } from '../../types/game'
import { updatePlayer } from './internals'

export function drawCard(state: GameState, playerIndex: 0 | 1): GameState {
  const player = state.players[playerIndex]
  if (player.deck.length === 0) return state

  const [drawn, ...remainingDeck] = player.deck
  return updatePlayer(state, playerIndex, {
    ...player,
    hand: [...player.hand, drawn],
    deck: remainingDeck,
  })
}

export function addToSpektra(state: GameState, playerIndex: 0 | 1, cardId: string): GameState {
  if (state.pendingChoice) return state
  const player = state.players[playerIndex]
  if (player.avatarToSpektraCount >= 1) return state // Limit: 1 per turn

  const card = player.hand.find(c => c.id === cardId)
  if (!card) return state

  return updatePlayer(state, playerIndex, {
    ...player,
    hand: player.hand.filter(c => c.id !== cardId),
    spektraPile: [...player.spektraPile, card],
    avatarToSpektraCount: player.avatarToSpektraCount + 1,
  })
}

export function playAvatar(
  state: GameState,
  playerIndex: 0 | 1,
  cardId: string,
  slot: 'active' | number
): GameState {
  if (state.pendingChoice) return state
  const player = state.players[playerIndex]
  const card = player.hand.find(c => c.id === cardId)
  if (!card || card.type !== 'avatar') return state

  const avatar = card as AvatarCard
  if (Number(avatar.level) !== 1) return state // Only Level 1 can be placed directly

  const placed: AvatarCard = { ...avatar, turnPlayed: state.currentTurn, isTapped: false }

  if (slot === 'active') {
    if (player.activeAvatar) return state // Slot occupied
    return updatePlayer(state, playerIndex, {
      ...player,
      hand: player.hand.filter(c => c.id !== cardId),
      activeAvatar: placed,
    })
  }

  const reserveIdx = slot as number
  if (reserveIdx < 0 || reserveIdx >= 2) return state
  if (player.reserveAvatars[reserveIdx]) return state // Slot occupied

  const reserve = [...player.reserveAvatars]
  reserve[reserveIdx] = placed
  return updatePlayer(state, playerIndex, {
    ...player,
    hand: player.hand.filter(c => c.id !== cardId),
    reserveAvatars: reserve,
  })
}
