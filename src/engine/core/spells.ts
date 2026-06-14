import type { AvatarCard, ActionCard, ElementType } from '../../types/card'
import type { GameState } from '../../types/game'
import { updatePlayer, shuffleCards } from './internals'
import { drawCard } from './cardOps'
import { hasEnoughSpektra, consumeSpektra } from './spektra'
import { checkDefeatedAvatars } from './combat'

export function playSpell(state: GameState, playerIndex: 0 | 1, cardId: string): GameState {
  if (state.pendingChoice) return state
  const player = state.players[playerIndex]
  const card = player.hand.find(c => c.id === cardId)
  if (!card || (card.type !== 'spell' && card.type !== 'quickSpell')) return state

  const spellCard = card as ActionCard

  // Check spektra cost
  const cost = (spellCard.spektraCost ?? []) as ElementType[]
  if (!hasEnoughSpektra(player, cost)) return state

  // Consume spektra
  let next = consumeSpektra(state, playerIndex, cost)

  // Remove from hand, add to discard pile
  const updatedPlayer = next.players[playerIndex]
  next = updatePlayer(next, playerIndex, {
    ...updatedPlayer,
    hand: updatedPlayer.hand.filter(c => c.id !== cardId),
    discardPile: [...updatedPlayer.discardPile, card],
  })

  // Apply spell effect
  const oppIdx = (playerIndex === 0 ? 1 : 0) as 0 | 1
  const effectType = spellCard.effectType ?? 'damage'
  const effectValue = spellCard.effectValue ?? 0
  const effectValue2 = spellCard.effectValue2 ?? 0
  const opponent = next.players[oppIdx]

  if (effectType === 'damage' || effectType === 'none') {
    // Direct damage to opponent's active avatar
    if (opponent.activeAvatar && effectValue > 0) {
      const currentDmg = opponent.activeAvatar.counters?.damage ?? 0
      const updatedOpp: AvatarCard = {
        ...opponent.activeAvatar,
        counters: { ...(opponent.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), damage: currentDmg + effectValue },
      }
      next = updatePlayer(next, oppIdx, { ...opponent, activeAvatar: updatedOpp })
    }
  } else if (effectType === 'heal') {
    const myPlayer = next.players[playerIndex]
    if (myPlayer.activeAvatar) {
      const currentDmg = myPlayer.activeAvatar.counters?.damage ?? 0
      const healed = Math.max(0, currentDmg - effectValue)
      const updated: AvatarCard = {
        ...myPlayer.activeAvatar,
        counters: { ...(myPlayer.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), damage: healed },
      }
      next = updatePlayer(next, playerIndex, { ...myPlayer, activeAvatar: updated })
    }
  } else if (effectType === 'draw') {
    for (let i = 0; i < effectValue; i++) {
      next = drawCard(next, playerIndex)
    }
  } else if (effectType === 'bleed') {
    if (opponent.activeAvatar) {
      const currentBleed = opponent.activeAvatar.counters?.bleed ?? 0
      const updated: AvatarCard = {
        ...opponent.activeAvatar,
        counters: { ...(opponent.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), bleed: currentBleed + effectValue },
      }
      next = updatePlayer(next, oppIdx, { ...opponent, activeAvatar: updated })
    }
  } else if (effectType === 'shield') {
    const myPlayer = next.players[playerIndex]
    if (myPlayer.activeAvatar) {
      const currentShield = myPlayer.activeAvatar.counters?.shield ?? 0
      const updated: AvatarCard = {
        ...myPlayer.activeAvatar,
        counters: { ...(myPlayer.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), shield: currentShield + effectValue },
      }
      next = updatePlayer(next, playerIndex, { ...myPlayer, activeAvatar: updated })
    }
  } else if (effectType === 'reveal_choose') {
    // Reveal top N cards; player picks 1 for hand, rest are shuffled back.
    const myPlayer = next.players[playerIndex]
    const revealed = myPlayer.deck.slice(0, effectValue)
    if (revealed.length > 0) {
      next = updatePlayer(next, playerIndex, { ...myPlayer, deck: myPlayer.deck.slice(revealed.length) })
      next = {
        ...next,
        pendingChoice: { playerIndex, type: 'reveal_choose', cards: revealed, count: 1, sourceCardName: spellCard.name },
      }
    }
  } else if (effectType === 'peek_place') {
    // Look at the top N cards, then place them back — information only.
    // Cards never leave the deck; resolveChoice just acknowledges.
    const myPlayer = next.players[playerIndex]
    const peeked = myPlayer.deck.slice(0, Math.max(1, effectValue))
    if (peeked.length > 0) {
      next = {
        ...next,
        pendingChoice: { playerIndex, type: 'peek_place', cards: peeked, count: 0, sourceCardName: spellCard.name },
      }
    }
  } else if (effectType === 'peek_place_draw') {
    // Look at the top (effectValue + effectValue2) cards: choose effectValue
    // to place back on top of the deck, draw the rest.
    const myPlayer = next.players[playerIndex]
    const takeCount = effectValue + effectValue2
    const taken = myPlayer.deck.slice(0, takeCount)
    if (taken.length > effectValue) {
      next = updatePlayer(next, playerIndex, { ...myPlayer, deck: myPlayer.deck.slice(taken.length) })
      next = {
        ...next,
        pendingChoice: { playerIndex, type: 'peek_place_draw', cards: taken, count: effectValue, sourceCardName: spellCard.name },
      }
    }
    // With effectValue or fewer cards available there is nothing to choose —
    // everything would go back on top, so the effect fizzles.
  } else if (effectType === 'draw_discard') {
    // Draw N, then choose M cards from hand to discard.
    for (let i = 0; i < effectValue; i++) {
      next = drawCard(next, playerIndex)
    }
    const myPlayer = next.players[playerIndex]
    const discardCount = Math.min(effectValue2, myPlayer.hand.length)
    if (discardCount > 0) {
      next = {
        ...next,
        pendingChoice: { playerIndex, type: 'draw_discard', cards: myPlayer.hand, count: discardCount, sourceCardName: spellCard.name },
      }
    }
  }

  next = {
    ...next,
    battleLog: [...next.battleLog, `${spellCard.name} cast!`],
    lastAction: `${spellCard.name} cast!`,
  }

  return checkDefeatedAvatars(next)
}

/**
 * Resolve an interactive mid-action choice created by playSpell (e.g.
 * reveal_choose). Validation failures return the same state reference so the
 * server surfaces them as rejected actions.
 */
export function resolveChoice(state: GameState, playerIndex: 0 | 1, chosenCardIds: string[]): GameState {
  const pending = state.pendingChoice
  if (!pending || pending.playerIndex !== playerIndex) return state
  if (chosenCardIds.length !== pending.count) return state

  const player = state.players[playerIndex]

  switch (pending.type) {
    case 'peek_place': {
      // Acknowledge-only: the peeked cards never left the deck.
      return {
        ...state,
        pendingChoice: null,
        battleLog: [...state.battleLog, `${player.name} looked at the top of their deck.`],
      }
    }
    case 'reveal_choose': {
      const chosen = pending.cards.filter(c => chosenCardIds.includes(c.id))
      if (chosen.length !== pending.count) return state
      const rest = pending.cards.filter(c => !chosenCardIds.includes(c.id))
      const next = updatePlayer(state, playerIndex, {
        ...player,
        hand: [...player.hand, ...chosen],
        deck: shuffleCards([...player.deck, ...rest]),
      })
      return {
        ...next,
        pendingChoice: null,
        battleLog: [...next.battleLog, `${player.name} added a card to their hand (${pending.sourceCardName}).`],
      }
    }
    case 'peek_place_draw': {
      const chosen = pending.cards.filter(c => chosenCardIds.includes(c.id))
      if (chosen.length !== pending.count) return state
      const drawn = pending.cards.filter(c => !chosenCardIds.includes(c.id))
      const next = updatePlayer(state, playerIndex, {
        ...player,
        deck: [...chosen, ...player.deck],
        hand: [...player.hand, ...drawn],
      })
      return {
        ...next,
        pendingChoice: null,
        battleLog: [...next.battleLog, `${player.name} arranged the top of their deck and drew ${drawn.length} card${drawn.length === 1 ? '' : 's'} (${pending.sourceCardName}).`],
      }
    }
    case 'draw_discard': {
      const chosen = player.hand.filter(c => chosenCardIds.includes(c.id))
      if (chosen.length !== pending.count) return state
      const next = updatePlayer(state, playerIndex, {
        ...player,
        hand: player.hand.filter(c => !chosenCardIds.includes(c.id)),
        discardPile: [...player.discardPile, ...chosen],
      })
      return {
        ...next,
        pendingChoice: null,
        battleLog: [...next.battleLog, `${player.name} discarded ${chosen.length} card${chosen.length === 1 ? '' : 's'} (${pending.sourceCardName}).`],
      }
    }
    default:
      return state
  }
}
