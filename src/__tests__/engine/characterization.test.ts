/**
 * Characterization tests — pin the CURRENT behavior of gameEngine functions
 * that the modularization moves between files. These assert behavior as it is
 * today (not as it "should" be); they are the safety net proving the split
 * changed structure without changing behavior.
 *
 * Covers the gaps left by gameEngine.test.ts (setup/draw/spektra-add/phase/win)
 * and pendingChoice.test.ts (spells/items/choices): spektra cost math, combat
 * defeat + life-card prize, evolution, and turn rotation.
 */
import {
  startGame,
  hasEnoughSpektra,
  consumeSpektra,
  checkDefeatedAvatars,
  evolveAvatar,
  nextTurn,
} from '../../engine'
import { cardRegistry } from '../../data/cardRegistry'
import type { Card, AvatarCard, ElementType } from '../../types/card'
import type { GameState, Player } from '../../types/game'

function buildTestDeck() {
  const avatars = cardRegistry.getCardsByType('avatar').slice(0, 5) as AvatarCard[]
  const spells = cardRegistry.getCardsByType('spell').slice(0, 10)
  return cardRegistry.shuffleDeck([...avatars, ...spells])
}

function freshState(): GameState {
  return startGame(buildTestDeck(), buildTestDeck())
}

function spektraCard(id: string, element: ElementType): Card {
  return { id, name: id, type: 'spell', element, rarity: 'Common' } as Card
}

function avatar(over: Partial<AvatarCard> = {}): AvatarCard {
  return {
    id: 'a',
    name: 'A',
    type: 'avatar',
    element: 'fire',
    subType: 'kujana',
    level: 1,
    health: 6,
    rarity: 'Common',
    ...over,
  }
}

describe('hasEnoughSpektra', () => {
  const withPile = (pile: Card[]) => ({ spektraPile: pile }) as Player

  it('empty cost is always payable', () => {
    expect(hasEnoughSpektra(withPile([]), [])).toBe(true)
  })

  it('exact element match pays', () => {
    const p = withPile([spektraCard('f1', 'fire'), spektraCard('w1', 'water')])
    expect(hasEnoughSpektra(p, ['fire'])).toBe(true)
  })

  it('neutral card covers a specific-element shortfall', () => {
    const p = withPile([spektraCard('n1', 'neutral')])
    expect(hasEnoughSpektra(p, ['fire'])).toBe(true)
  })

  it('neutral cost is a wildcard paid by any card', () => {
    const p = withPile([spektraCard('w1', 'water')])
    expect(hasEnoughSpektra(p, ['neutral'])).toBe(true)
  })

  it('returns false when the pile cannot cover the cost', () => {
    const p = withPile([spektraCard('f1', 'fire')])
    expect(hasEnoughSpektra(p, ['fire', 'fire'])).toBe(false)
  })
})

describe('consumeSpektra', () => {
  it('moves consumed cards from spektraPile to graveyard', () => {
    const base = freshState()
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], spektraPile: [spektraCard('f1', 'fire'), spektraCard('w1', 'water')], graveyard: [] },
        base.players[1],
      ],
    }
    const next = consumeSpektra(state, 0, ['fire'])
    expect(next.players[0].spektraPile).toHaveLength(1)
    expect(next.players[0].spektraPile[0].id).toBe('w1')
    expect(next.players[0].graveyard.map(c => c.id)).toContain('f1')
  })

  it('empty cost returns the same state reference', () => {
    const state = freshState()
    expect(consumeSpektra(state, 0, [])).toBe(state)
  })

  it('pays specific element before consuming a neutral wildcard card', () => {
    const base = freshState()
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], spektraPile: [spektraCard('n1', 'neutral'), spektraCard('f1', 'fire')], graveyard: [] },
        base.players[1],
      ],
    }
    // cost = one fire: should take the fire card, leaving the neutral behind
    const next = consumeSpektra(state, 0, ['fire'])
    expect(next.players[0].spektraPile.map(c => c.id)).toEqual(['n1'])
  })
})

describe('checkDefeatedAvatars', () => {
  it('removes a lethally-damaged active avatar, promotes a reserve, and awards a life-card prize', () => {
    const base = freshState()
    const lethal = avatar({ id: 'dead', health: 6, counters: { damage: 6 } as AvatarCard['counters'] })
    const reserve = avatar({ id: 'bench', health: 6 })
    const prize = spektraCard('life', 'fire')

    const state: GameState = {
      ...base,
      players: [
        base.players[0], // attacker
        {
          ...base.players[1],
          activeAvatar: lethal,
          reserveAvatars: [reserve],
          lifeCards: [prize],
        },
      ],
    }

    const next = checkDefeatedAvatars(state)

    // defeated avatar gone, reserve promoted to active
    expect(next.players[1].activeAvatar?.id).toBe('bench')
    expect(next.players[1].reserveAvatars).toHaveLength(0)
    // attacker takes the life-card prize into hand
    expect(next.players[0].hand.map(c => c.id)).toContain('life')
    expect(next.players[1].lifeCards).toHaveLength(0)
  })

  it('leaves an undamaged avatar untouched', () => {
    const base = freshState()
    const healthy = avatar({ id: 'ok', health: 6, counters: { damage: 1 } as AvatarCard['counters'] })
    const state: GameState = {
      ...base,
      players: [base.players[0], { ...base.players[1], activeAvatar: healthy }],
    }
    expect(checkDefeatedAvatars(state).players[1].activeAvatar?.id).toBe('ok')
  })
})

describe('evolveAvatar', () => {
  it('evolves a level-1 active avatar into a matching level-2 card, preserving counters', () => {
    const base = freshState()
    const level1 = avatar({ id: 'base1', level: 1, turnPlayed: 0, counters: { damage: 2 } as AvatarCard['counters'] })
    const level2 = avatar({ id: 'evo2', name: 'Evolved', level: 2 })

    const state: GameState = {
      ...base,
      currentTurn: 2,
      players: [
        { ...base.players[0], activeAvatar: level1, hand: [level2 as Card] },
        base.players[1],
      ],
    }

    const next = evolveAvatar(state, 0, 'evo2', 'active')
    expect(next.players[0].activeAvatar?.id).toBe('evo2')
    expect(next.players[0].activeAvatar?.counters?.damage).toBe(2)
    expect(next.players[0].hand.find(c => c.id === 'evo2')).toBeUndefined()
  })

  it('rejects evolution when the level-2 subType does not match the base', () => {
    const base = freshState()
    const level1 = avatar({ id: 'base1', level: 1, subType: 'kujana', turnPlayed: 0 })
    const level2 = avatar({ id: 'evo2', level: 2, subType: 'other' })
    const state: GameState = {
      ...base,
      currentTurn: 2,
      players: [{ ...base.players[0], activeAvatar: level1, hand: [level2 as Card] }, base.players[1]],
    }
    // unchanged: still the level-1 base, card still in hand
    expect(evolveAvatar(state, 0, 'evo2', 'active')).toBe(state)
  })
})

describe('nextTurn', () => {
  it('switches the active player, increments the turn, and lands in main1', () => {
    const state = freshState()
    const next = nextTurn(state)
    expect(next.currentPlayerIndex).not.toBe(state.currentPlayerIndex)
    expect(next.currentTurn).toBe(state.currentTurn + 1)
    expect(next.phase).toBe('main1')
  })

  it('is blocked while a pendingChoice is unresolved', () => {
    const base = freshState()
    const blocked: GameState = { ...base, pendingChoice: { playerIndex: 0, type: 'peek_place', cards: [], count: 0, sourceCardName: 'x' } }
    expect(nextTurn(blocked)).toBe(blocked)
  })
})
