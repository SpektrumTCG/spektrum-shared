import { startGame, playSpell, resolveChoice, endPhase, playItem, executeSkill } from '../../engine'
import { cardRegistry } from '../../data/cardRegistry'
import type { ActionCard, AvatarCard, Card } from '../../types'
import type { GameState } from '../../types/game'

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeSpell(overrides: Partial<ActionCard>): ActionCard {
  return {
    id: 'test-spell',
    name: 'Test Spell',
    type: 'spell',
    element: 'water',
    spektraCost: [],
    ...overrides,
  } as ActionCard
}

function makeDeckCard(id: string): Card {
  return {
    id,
    name: `Deck ${id}`,
    type: 'spell',
    element: 'neutral',
    spektraCost: [],
  } as Card
}

function buildTestDeck() {
  const avatars = cardRegistry.getCardsByType('avatar').slice(0, 5) as AvatarCard[]
  const spells = cardRegistry.getCardsByType('spell').slice(0, 10)
  return cardRegistry.shuffleDeck([...avatars, ...spells])
}

/** Game state where player 0 has `spell` in hand and a known deck. */
function setupWithSpell(spell: ActionCard, deckIds: string[] = ['d1', 'd2', 'd3', 'd4', 'd5']): GameState {
  const base = startGame(buildTestDeck(), buildTestDeck())
  const player = {
    ...base.players[0],
    hand: [spell as Card],
    deck: deckIds.map(makeDeckCard),
  }
  return {
    ...base,
    phase: 'main1' as const,
    players: [player, base.players[1]] as GameState['players'],
  }
}

// ─── reveal_choose ────────────────────────────────────────────────────────────

describe('playSpell reveal_choose', () => {
  const spell = makeSpell({ id: 'reveal-3', name: 'Deepsea Insight', effectType: 'reveal_choose', effectValue: 3 })

  it('sets pendingChoice with top N cards removed from deck', () => {
    const state = setupWithSpell(spell)
    const next = playSpell(state, 0, spell.id)

    expect(next.pendingChoice).toBeTruthy()
    expect(next.pendingChoice!.type).toBe('reveal_choose')
    expect(next.pendingChoice!.playerIndex).toBe(0)
    expect(next.pendingChoice!.count).toBe(1)
    expect(next.pendingChoice!.cards.map(c => c.id)).toEqual(['d1', 'd2', 'd3'])
    expect(next.players[0].deck.map(c => c.id)).toEqual(['d4', 'd5'])
  })

  it('moves spell to discard pile', () => {
    const state = setupWithSpell(spell)
    const next = playSpell(state, 0, spell.id)
    expect(next.players[0].discardPile.some(c => c.id === spell.id)).toBe(true)
    expect(next.players[0].hand.some(c => c.id === spell.id)).toBe(false)
  })

  it('reveals only available cards when deck is short', () => {
    const state = setupWithSpell(spell, ['d1', 'd2'])
    const next = playSpell(state, 0, spell.id)
    expect(next.pendingChoice!.cards.map(c => c.id)).toEqual(['d1', 'd2'])
    expect(next.players[0].deck).toHaveLength(0)
  })

  it('does not set pendingChoice when deck is empty (spell still resolves)', () => {
    const state = setupWithSpell(spell, [])
    const next = playSpell(state, 0, spell.id)
    expect(next).not.toBe(state)
    expect(next.pendingChoice ?? null).toBeNull()
    expect(next.players[0].discardPile.some(c => c.id === spell.id)).toBe(true)
  })
})

describe('resolveChoice reveal_choose', () => {
  const spell = makeSpell({ id: 'reveal-3', name: 'Deepsea Insight', effectType: 'reveal_choose', effectValue: 3 })

  function pendingState(): GameState {
    return playSpell(setupWithSpell(spell), 0, spell.id)
  }

  it('puts chosen card in hand and rest back in deck, clears pendingChoice', () => {
    const state = pendingState()
    const next = resolveChoice(state, 0, ['d2'])

    expect(next.pendingChoice ?? null).toBeNull()
    expect(next.players[0].hand.some(c => c.id === 'd2')).toBe(true)
    // d1 and d3 shuffled back into deck alongside d4, d5
    const deckIds = next.players[0].deck.map(c => c.id).sort()
    expect(deckIds).toEqual(['d1', 'd3', 'd4', 'd5'])
  })

  it('rejects unknown card id (same state ref)', () => {
    const state = pendingState()
    expect(resolveChoice(state, 0, ['nope'])).toBe(state)
  })

  it('rejects wrong count (same state ref)', () => {
    const state = pendingState()
    expect(resolveChoice(state, 0, ['d1', 'd2'])).toBe(state)
    expect(resolveChoice(state, 0, [])).toBe(state)
  })

  it('rejects wrong player (same state ref)', () => {
    const state = pendingState()
    expect(resolveChoice(state, 1, ['d1'])).toBe(state)
  })

  it('rejects when no choice pending (same state ref)', () => {
    const state = setupWithSpell(spell)
    expect(resolveChoice(state, 0, ['d1'])).toBe(state)
  })
})

// ─── action blocking while choice pending ────────────────────────────────────

describe('pendingChoice blocks other actions', () => {
  const spell = makeSpell({ id: 'reveal-3', name: 'Deepsea Insight', effectType: 'reveal_choose', effectValue: 3 })

  function pendingState(): GameState {
    const base = setupWithSpell(spell)
    const second = makeSpell({ id: 'other-spell', name: 'Other', effectType: 'draw', effectValue: 1 })
    const withSecond = {
      ...base,
      players: [
        { ...base.players[0], hand: [...base.players[0].hand, second as Card] },
        base.players[1],
      ] as GameState['players'],
    }
    return playSpell(withSecond, 0, spell.id)
  }

  it('playSpell is rejected while a choice is pending', () => {
    const state = pendingState()
    expect(playSpell(state, 0, 'other-spell')).toBe(state)
  })

  it('endPhase is rejected while a choice is pending', () => {
    const state = pendingState()
    expect(endPhase(state)).toBe(state)
  })

  it('playItem is rejected while a choice is pending', () => {
    const state = pendingState()
    expect(playItem(state, 0, 'other-spell')).toBe(state)
  })

  it('executeSkill is rejected while a choice is pending', () => {
    const state = pendingState()
    expect(executeSkill(state, 0, 0)).toBe(state)
  })
})

// ─── peek_place ───────────────────────────────────────────────────────────────

describe('peek_place', () => {
  const spell = makeSpell({ id: 'peek-1', name: 'Check', effectType: 'peek_place', effectValue: 1 })

  it('sets acknowledge-only pendingChoice without removing cards from deck', () => {
    const state = setupWithSpell(spell)
    const next = playSpell(state, 0, spell.id)

    expect(next.pendingChoice!.type).toBe('peek_place')
    expect(next.pendingChoice!.count).toBe(0)
    expect(next.pendingChoice!.cards.map(c => c.id)).toEqual(['d1'])
    expect(next.players[0].deck.map(c => c.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5'])
  })

  it('resolveChoice with empty selection clears the choice, deck unchanged', () => {
    const state = playSpell(setupWithSpell(spell), 0, spell.id)
    const next = resolveChoice(state, 0, [])
    expect(next.pendingChoice ?? null).toBeNull()
    expect(next.players[0].deck.map(c => c.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5'])
  })

  it('does not set pendingChoice on empty deck', () => {
    const state = setupWithSpell(spell, [])
    const next = playSpell(state, 0, spell.id)
    expect(next).not.toBe(state)
    expect(next.pendingChoice ?? null).toBeNull()
  })
})

// ─── peek_place_draw ──────────────────────────────────────────────────────────

describe('peek_place_draw', () => {
  // Dew Drop: effectValue 1 (place on top), effectValue2 1 (draw) → look at top 2
  const spell = makeSpell({ id: 'dew-drop', name: 'Dew Drop', effectType: 'peek_place_draw', effectValue: 1, effectValue2: 1 })

  it('takes effectValue + effectValue2 cards from deck into pendingChoice', () => {
    const state = setupWithSpell(spell)
    const next = playSpell(state, 0, spell.id)

    expect(next.pendingChoice!.type).toBe('peek_place_draw')
    expect(next.pendingChoice!.count).toBe(1)
    expect(next.pendingChoice!.cards.map(c => c.id)).toEqual(['d1', 'd2'])
    expect(next.players[0].deck.map(c => c.id)).toEqual(['d3', 'd4', 'd5'])
  })

  it('resolveChoice places chosen card on top of deck and draws the rest', () => {
    const state = playSpell(setupWithSpell(spell), 0, spell.id)
    const next = resolveChoice(state, 0, ['d2'])

    expect(next.pendingChoice ?? null).toBeNull()
    expect(next.players[0].deck.map(c => c.id)).toEqual(['d2', 'd3', 'd4', 'd5'])
    expect(next.players[0].hand.some(c => c.id === 'd1')).toBe(true)
  })

  it('skips choice when only one card is available (placed back, nothing drawn)', () => {
    const state = setupWithSpell(spell, ['d1'])
    const next = playSpell(state, 0, spell.id)
    expect(next).not.toBe(state)
    expect(next.pendingChoice ?? null).toBeNull()
    expect(next.players[0].deck.map(c => c.id)).toEqual(['d1'])
  })
})

// ─── draw_discard ─────────────────────────────────────────────────────────────

describe('draw_discard', () => {
  // Ocean Memory: draw 1, discard 1
  const spell = makeSpell({ id: 'ocean-memory', name: 'Ocean Memory', effectType: 'draw_discard', effectValue: 1, effectValue2: 1 })

  it('draws N cards then sets pendingChoice over the hand', () => {
    const state = setupWithSpell(spell)
    const next = playSpell(state, 0, spell.id)

    // hand: spell played away, d1 drawn → 1 card
    expect(next.players[0].hand.map(c => c.id)).toEqual(['d1'])
    expect(next.pendingChoice!.type).toBe('draw_discard')
    expect(next.pendingChoice!.count).toBe(1)
    expect(next.pendingChoice!.cards.map(c => c.id)).toEqual(['d1'])
  })

  it('resolveChoice discards the chosen cards from hand', () => {
    const state = playSpell(setupWithSpell(spell), 0, spell.id)
    const next = resolveChoice(state, 0, ['d1'])

    expect(next.pendingChoice ?? null).toBeNull()
    expect(next.players[0].hand).toHaveLength(0)
    expect(next.players[0].discardPile.some(c => c.id === 'd1')).toBe(true)
  })

  it('clamps discard count to hand size', () => {
    const bigSpell = makeSpell({ id: 'big-discard', name: 'Big', effectType: 'draw_discard', effectValue: 1, effectValue2: 5 })
    const state = setupWithSpell(bigSpell, ['d1'])
    const next = playSpell(state, 0, bigSpell.id)
    // hand after: just d1 → count clamped to 1
    expect(next.pendingChoice!.count).toBe(1)
  })

  it('no pendingChoice when hand is empty after draw', () => {
    const noDraw = makeSpell({ id: 'no-draw', name: 'NoDraw', effectType: 'draw_discard', effectValue: 0, effectValue2: 1 })
    const state = setupWithSpell(noDraw, [])
    const next = playSpell(state, 0, noDraw.id)
    expect(next).not.toBe(state)
    expect(next.pendingChoice ?? null).toBeNull()
  })
})
