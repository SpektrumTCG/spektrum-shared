/**
 * Deterministic win-condition tests. Unlike the random buildTestDeck() helper
 * used elsewhere, these construct explicit board states so the assertions never
 * depend on shuffle order.
 *
 * Rule under test: a player loses when their life cards reach 0. Running out of
 * life cards is the hard loss and takes priority — a player who still holds life
 * cards has not lost, even with an empty board, because the defeat flow draws a
 * life card to redeploy.
 */
import { startGame, checkWinner } from '../../engine'
import { cardRegistry } from '../../data/cardRegistry'
import type { AvatarCard } from '../../types/card'
import type { GameState } from '../../types/game'

function buildTestDeck() {
  const avatars = cardRegistry.getCardsByType('avatar').slice(0, 5) as AvatarCard[]
  const spells = cardRegistry.getCardsByType('spell').slice(0, 10)
  return cardRegistry.shuffleDeck([...avatars, ...spells])
}

function freshState(): GameState {
  return startGame(buildTestDeck(), buildTestDeck())
}

describe('checkWinner', () => {
  it('returns null when both players still hold life cards', () => {
    const base = freshState()
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], activeAvatar: null, reserveAvatars: [], hand: [] },
        { ...base.players[1], activeAvatar: null, reserveAvatars: [], hand: [] },
      ],
    }
    expect(checkWinner(state)).toBeNull()
  })

  it('declares the opponent the winner when a player runs out of life cards', () => {
    const base = freshState()
    const state: GameState = {
      ...base,
      players: [base.players[0], { ...base.players[1], lifeCards: [] }],
    }
    expect(checkWinner(state)).toBe(base.players[0].id)
  })

  it('prioritizes a hard loss (0 life cards) over an opponent with an empty board', () => {
    const base = freshState()
    const state: GameState = {
      ...base,
      players: [
        // p0: empty board but still holds life cards — NOT lost
        { ...base.players[0], activeAvatar: null, reserveAvatars: [], hand: [] },
        // p1: out of life cards — the real loser
        { ...base.players[1], lifeCards: [] },
      ],
    }
    expect(checkWinner(state)).toBe(base.players[0].id)
  })

  it('respects an explicitly set winner', () => {
    const base = freshState()
    expect(checkWinner({ ...base, winner: 'someone' })).toBe('someone')
  })
})
