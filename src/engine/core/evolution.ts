import type { AvatarCard } from '../../types/card'
import type { GameState, Player } from '../../types/game'
import { getValidEvolutionTargets } from '../getValidEvolutionTargets'
import { updatePlayer } from './internals'

export function evolveAvatar(
  state: GameState,
  playerIndex: 0 | 1,
  handCardId: string,
  targetSlot: 'active' | number
): GameState {
  if (state.pendingChoice) return state
  const player = state.players[playerIndex]
  const card = player.hand.find(c => c.id === handCardId)
  if (!card || card.type !== 'avatar') return state

  const level2Card = card as AvatarCard
  if (Number(level2Card.level) !== 2) return state

  // Validate evolution target
  const validSlots = getValidEvolutionTargets(level2Card, {
    activeAvatar: player.activeAvatar,
    reserveAvatars: player.reserveAvatars,
  }, state.currentTurn)

  if (!validSlots.includes(targetSlot)) return state

  // Get the target avatar
  let target: AvatarCard | null = null
  if (targetSlot === 'active') {
    target = player.activeAvatar
  } else {
    target = player.reserveAvatars[targetSlot as number] ?? null
  }
  if (!target) return state

  // Evolve: preserve counters and equipment from base
  const evolved: AvatarCard = {
    ...level2Card,
    turnPlayed: state.currentTurn,
    isTapped: target.isTapped ?? false,
    counters: target.counters ? { ...target.counters } : undefined,
    attachedEquipment: target.attachedEquipment ? [...target.attachedEquipment] : undefined,
    baseCard: target,
  }

  // Place evolved avatar
  let updated: Player
  if (targetSlot === 'active') {
    updated = {
      ...player,
      hand: player.hand.filter(c => c.id !== handCardId),
      activeAvatar: evolved,
    }
  } else {
    const reserve = [...player.reserveAvatars]
    reserve[targetSlot as number] = evolved
    updated = {
      ...player,
      hand: player.hand.filter(c => c.id !== handCardId),
      reserveAvatars: reserve,
    }
  }

  let next = updatePlayer(state, playerIndex, updated)
  next = {
    ...next,
    battleLog: [...next.battleLog, `${target.name} evolved into ${level2Card.name}!`],
    lastAction: `${target.name} evolved into ${level2Card.name}!`,
  }

  return next
}
