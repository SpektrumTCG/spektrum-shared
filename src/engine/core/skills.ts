import type { AvatarCard, Skill, SkillCheckState, SkillCheckPlayerState } from '../../types/card'
import type { GameState, Player } from '../../types/game'
import { updatePlayer } from './internals'
import { drawCard } from './cardOps'
import { hasEnoughSpektra, consumeSpektra } from './spektra'
import { checkDefeatedAvatars } from './combat'

export function executeSkill(
  state: GameState,
  playerIndex: 0 | 1,
  skillIndex: number,
  targetPlayerIndex?: 0 | 1,
): GameState {
  if (state.pendingChoice) return state
  const player = state.players[playerIndex]
  const avatar = player.activeAvatar
  if (!avatar || avatar.isTapped) return state

  // Get the skill
  const skills = avatar.skills ?? [avatar.skill1, avatar.skill2].filter(Boolean)
  const skill = skills[skillIndex] as Skill | undefined
  if (!skill) return state

  // Check spektra cost
  const cost = skill.spektraCost ?? []
  if (!hasEnoughSpektra(player, cost)) return state

  // Consume spektra
  let next = consumeSpektra(state, playerIndex, cost)

  // Calculate damage
  const baseDamage = skill.damage ?? 0
  const oppIdx = targetPlayerIndex ?? (playerIndex === 0 ? 1 : 0) as 0 | 1
  const opponent = next.players[oppIdx]

  // Process bleed-on-attack: if attacker has bleed, take bleed damage before attacking
  if (avatar.counters?.bleed && avatar.counters.bleed > 0) {
    const bleedDmg = avatar.counters.bleed
    const currentDmg = avatar.counters?.damage ?? 0
    const updatedAvatar: AvatarCard = {
      ...avatar,
      counters: { ...avatar.counters, damage: currentDmg + bleedDmg },
    }
    const updatedPlayer = { ...next.players[playerIndex], activeAvatar: updatedAvatar }
    next = updatePlayer(next, playerIndex, updatedPlayer)

    // Check if avatar died from bleed
    if ((updatedAvatar.counters?.damage ?? 0) >= updatedAvatar.health) {
      next = {
        ...next,
        battleLog: [...next.battleLog, `${avatar.name} collapsed from bleed damage!`],
      }
      return checkDefeatedAvatars(next)
    }
  }

  // Apply damage to opponent's active avatar
  if (baseDamage > 0 && opponent.activeAvatar) {
    const oppAvatar = opponent.activeAvatar
    const currentDmg = oppAvatar.counters?.damage ?? 0
    const updatedOppAvatar: AvatarCard = {
      ...oppAvatar,
      counters: { ...(oppAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), damage: currentDmg + baseDamage },
    }
    const updatedOpp = { ...opponent, activeAvatar: updatedOppAvatar }
    next = updatePlayer(next, oppIdx, updatedOpp)
  }

  // Apply additional effects based on effectType
  if (skill.effectType && skill.effectType !== 'none') {
    next = applySkillEffect(next, playerIndex, oppIdx, skill)
  }

  // Mark avatar as tapped
  const tappedAvatar: AvatarCard = { ...(next.players[playerIndex].activeAvatar!), isTapped: true }
  next = updatePlayer(next, playerIndex, { ...next.players[playerIndex], activeAvatar: tappedAvatar })

  // Add battle log
  next = {
    ...next,
    battleLog: [...next.battleLog, `${avatar.name} used ${skill.name}${baseDamage > 0 ? ` for ${baseDamage} damage` : ''}!`],
    lastAction: `${avatar.name} used ${skill.name}!`,
  }

  // Check for defeated avatars
  next = checkDefeatedAvatars(next)

  return next
}

function applySkillEffect(state: GameState, playerIdx: 0 | 1, oppIdx: 0 | 1, skill: Skill): GameState {
  const effectValue = skill.effectValue ?? 0
  const player = state.players[playerIdx]
  const opponent = state.players[oppIdx]

  switch (skill.effectType) {
    case 'heal': {
      if (!player.activeAvatar) return state
      const currentDmg = player.activeAvatar.counters?.damage ?? 0
      const healed = Math.max(0, currentDmg - effectValue)
      const updatedAvatar: AvatarCard = {
        ...player.activeAvatar,
        counters: { ...(player.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), damage: healed },
      }
      return updatePlayer(state, playerIdx, { ...player, activeAvatar: updatedAvatar })
    }
    case 'shield': {
      if (!player.activeAvatar) return state
      const currentShield = player.activeAvatar.counters?.shield ?? 0
      const updatedAvatar: AvatarCard = {
        ...player.activeAvatar,
        counters: { ...(player.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), shield: currentShield + effectValue },
      }
      return updatePlayer(state, playerIdx, { ...player, activeAvatar: updatedAvatar })
    }
    case 'bleed': {
      if (!opponent.activeAvatar) return state
      const currentBleed = opponent.activeAvatar.counters?.bleed ?? 0
      const updatedOppAvatar: AvatarCard = {
        ...opponent.activeAvatar,
        counters: { ...(opponent.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), bleed: currentBleed + effectValue },
      }
      return updatePlayer(state, oppIdx, { ...opponent, activeAvatar: updatedOppAvatar })
    }
    case 'draw': {
      let next = state
      for (let i = 0; i < effectValue; i++) {
        next = drawCard(next, playerIdx)
      }
      return next
    }
    default:
      return state
  }
}

// ─── Helper to build SkillCheckState from full GameState ─────────────────────

export function toSkillCheckState(state: GameState, playerIndex: 0 | 1): SkillCheckState {
  const pi = playerIndex
  const oi = (pi === 0 ? 1 : 0) as 0 | 1
  const toCheckPlayer = (p: Player): SkillCheckPlayerState => ({
    hand: p.hand,
    spektraPile: p.spektraPile,
    usedSpektraPile: p.usedSpektraPile,
    activeAvatar: p.activeAvatar,
    reserveAvatars: p.reserveAvatars,
    graveyard: p.graveyard,
    avatarToSpektraCount: p.avatarToSpektraCount,
  })
  return {
    player: toCheckPlayer(state.players[pi]),
    opponent: toCheckPlayer(state.players[oi]),
    gamePhase: state.phase,
    currentPlayer: pi === 0 ? 'player' : 'opponent',
  }
}
