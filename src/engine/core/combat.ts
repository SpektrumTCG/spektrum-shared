import type { AvatarCard } from '../../types/card'
import type { GameState, Player } from '../../types/game'
import { destroyAvatar } from '../destroyAvatar'
import { updatePlayer } from './internals'

export function checkDefeatedAvatars(state: GameState): GameState {
  let next = state

  for (const pi of [0, 1] as const) {
    const player = next.players[pi]

    // Check active avatar
    if (player.activeAvatar) {
      const dmg = player.activeAvatar.counters?.damage ?? 0
      if (dmg >= player.activeAvatar.health) {
        next = handleAvatarDefeat(next, pi, 'active')
      }
    }

    // Check reserve avatars
    const updatedPlayer = next.players[pi]
    for (let ri = updatedPlayer.reserveAvatars.length - 1; ri >= 0; ri--) {
      const reserve = updatedPlayer.reserveAvatars[ri]
      if (reserve) {
        const dmg = reserve.counters?.damage ?? 0
        if (dmg >= reserve.health) {
          next = handleAvatarDefeat(next, pi, ri)
        }
      }
    }
  }

  return next
}

function handleAvatarDefeat(state: GameState, playerIndex: 0 | 1, slot: 'active' | number): GameState {
  const player = state.players[playerIndex]
  let defeatedAvatar: AvatarCard | null = null

  if (slot === 'active') {
    defeatedAvatar = player.activeAvatar
  } else {
    defeatedAvatar = player.reserveAvatars[slot as number] ?? null
  }

  if (!defeatedAvatar) return state

  // Send to graveyard
  const graveyardCards = destroyAvatar(defeatedAvatar)

  let updated: Player = {
    ...player,
    graveyard: [...player.graveyard, ...graveyardCards],
  }

  if (slot === 'active') {
    updated.activeAvatar = null

    // Promote first reserve to active
    const firstReserve = updated.reserveAvatars.find(a => a !== null && a !== undefined)
    if (firstReserve) {
      updated.activeAvatar = firstReserve
      updated.reserveAvatars = updated.reserveAvatars.filter(a => a !== firstReserve)
    }
  } else {
    const reserve = [...updated.reserveAvatars]
    reserve.splice(slot as number, 1)
    updated.reserveAvatars = reserve
  }

  let next = updatePlayer(state, playerIndex, updated)

  next = {
    ...next,
    battleLog: [...next.battleLog, `${defeatedAvatar.name} was defeated!`],
  }

  // Attacker takes a life card prize from the defeated player
  const attackerIdx: 0 | 1 = playerIndex === 0 ? 1 : 0
  const defeated = next.players[playerIndex]
  if (defeated.lifeCards.length > 0) {
    const [prizeCard, ...remainingLife] = defeated.lifeCards
    const attacker = next.players[attackerIdx]
    next = updatePlayer(next, playerIndex, {
      ...next.players[playerIndex],
      lifeCards: remainingLife,
    })
    next = updatePlayer(next, attackerIdx, {
      ...next.players[attackerIdx],
      hand: [...attacker.hand, prizeCard],
    })
    next = {
      ...next,
      battleLog: [...next.battleLog, `${attacker.name} takes a Life Card prize! (${defeated.name}: ${remainingLife.length} remaining)`],
    }
  }

  // Check if defeated player must promote a reserve or use life cards
  const p = next.players[playerIndex]
  if (!p.activeAvatar && p.reserveAvatars.length === 0 && p.lifeCards.length > 0) {
    // Life card goes to hand so they can deploy a new avatar
    const [lifeCard, ...remainingLife] = p.lifeCards
    next = updatePlayer(next, playerIndex, {
      ...next.players[playerIndex],
      lifeCards: remainingLife,
      hand: [...next.players[playerIndex].hand, lifeCard],
    })
    next = {
      ...next,
      battleLog: [...next.battleLog, `${p.name} uses a Life Card! (${remainingLife.length} remaining)`],
    }
  }

  return next
}
