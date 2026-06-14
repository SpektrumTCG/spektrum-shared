import type { GameState, Player, GamePhaseType } from '../../types/game'
import { updatePlayer, untapAvatars } from './internals'
import { drawCard } from './cardOps'

const MAX_HAND_SIZE = 8

const PHASE_ORDER: GamePhaseType[] = ['refresh', 'draw', 'main1', 'battle', 'main2', 'recheck', 'end']

export function endPhase(state: GameState): GameState {
  if (state.pendingChoice) return state // must resolve the pending choice first
  if (state.phase === 'game_over') return state
  if (state.phase === 'end') return nextTurn(state)

  // Setup phase: both players must have an active avatar before moving on
  if (state.phase === 'setup') {
    const player = state.players[state.currentPlayerIndex]
    if (!player.activeAvatar) return state

    const oppIndex: 0 | 1 = state.currentPlayerIndex === 0 ? 1 : 0
    const opponent = state.players[oppIndex]
    if (!opponent.activeAvatar) {
      return { ...state, currentPlayerIndex: oppIndex }
    }

    // Both have avatars — start the game with refresh phase for player 0
    return refreshPhase({ ...state, currentPlayerIndex: 0, currentTurn: 1 })
  }

  const idx = PHASE_ORDER.indexOf(state.phase)
  if (idx === -1) return state
  const nextPhaseType = PHASE_ORDER[idx + 1]
  if (!nextPhaseType) return { ...state, phase: 'end' }

  // Auto-process certain phases
  if (nextPhaseType === 'refresh') return refreshPhase(state)
  if (nextPhaseType === 'draw') return drawPhase(state)
  if (nextPhaseType === 'recheck') return recheckPhase(state)

  return { ...state, phase: nextPhaseType }
}

export function refreshPhase(state: GameState): GameState {
  const pi = state.currentPlayerIndex
  const player = state.players[pi]

  // Used spektra are consumed permanently — do NOT restore them
  const refreshedPlayer: Player = {
    ...player,
    // spektraPile stays as-is (already reduced by consumeSpektra)
    usedSpektraPile: [],
    avatarToSpektraCount: 0,
    hasPlayedItemThisTurn: false,
    equipmentActivations: {},
    discardedThisTurn: [],
  }

  // Untap all avatars
  const untapped = untapAvatars(refreshedPlayer)

  let next = updatePlayer(state, pi, untapped)
  next = { ...next, phase: 'draw' }

  // Auto-advance to draw
  return drawPhase(next)
}

export function drawPhase(state: GameState): GameState {
  let next = { ...state, phase: 'draw' as GamePhaseType }
  // Draw 1 card for active player (skip on turn 1 since they already drew in setup)
  next = drawCard(next, next.currentPlayerIndex)
  return { ...next, phase: 'main1' }
}

export function recheckPhase(state: GameState): GameState {
  const pi = state.currentPlayerIndex
  const player = state.players[pi]

  // Enforce max hand size — discard excess for AI, player handles via UI
  if (player.hand.length > MAX_HAND_SIZE && player.id === 'opponent') {
    const excess = player.hand.length - MAX_HAND_SIZE
    const discarded = player.hand.slice(-excess)
    const remaining = player.hand.slice(0, MAX_HAND_SIZE)
    const updated: Player = {
      ...player,
      hand: remaining,
      graveyard: [...player.graveyard, ...discarded],
    }
    return { ...updatePlayer(state, pi, updated), phase: 'end' }
  }

  return { ...state, phase: 'end' }
}

export function nextTurn(state: GameState): GameState {
  if (state.pendingChoice) return state
  const next: 0 | 1 = state.currentPlayerIndex === 0 ? 1 : 0
  const p0: Player = { ...state.players[0], isActivePlayer: next === 0, discardedThisTurn: [] }
  const p1: Player = { ...state.players[1], isActivePlayer: next === 1, discardedThisTurn: [] }
  const newState: GameState = {
    ...state,
    currentTurn: state.currentTurn + 1,
    phase: 'refresh',
    currentPlayerIndex: next,
    players: [p0, p1],
  }
  // Auto-process refresh → draw → main1
  return refreshPhase(newState)
}
