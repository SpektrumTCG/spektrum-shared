import type { AvatarCard, ActionCard, ElementType } from '../../types/card'
import type { GameState } from '../../types/game'
import { updatePlayer } from './internals'
import { drawCard } from './cardOps'
import { hasEnoughSpektra, consumeSpektra } from './spektra'
import { checkDefeatedAvatars } from './combat'

export function playItem(state: GameState, playerIndex: 0 | 1, cardId: string): GameState {
  if (state.pendingChoice) return state
  const player = state.players[playerIndex]
  if (player.hasPlayedItemThisTurn) return state // 1 item per turn

  const card = player.hand.find(c => c.id === cardId)
  if (!card || card.type !== 'item') return state

  const itemCard = card as ActionCard

  // Check spektra cost
  const cost = (itemCard.spektraCost ?? []) as ElementType[]
  if (!hasEnoughSpektra(player, cost)) return state

  // Consume spektra
  let next = consumeSpektra(state, playerIndex, cost)

  // Remove from hand, add to discard pile, mark item played
  const updatedPlayer = next.players[playerIndex]
  next = updatePlayer(next, playerIndex, {
    ...updatedPlayer,
    hand: updatedPlayer.hand.filter(c => c.id !== cardId),
    discardPile: [...updatedPlayer.discardPile, card],
    hasPlayedItemThisTurn: true,
  })

  // Apply item effect
  const oppIdx = (playerIndex === 0 ? 1 : 0) as 0 | 1
  const effectType = itemCard.effectType ?? 'none'
  const effectValue = itemCard.effectValue ?? 0
  const effectValue2 = itemCard.effectValue2 ?? 0

  if (effectType === 'heal') {
    // Heal active avatar
    const p = next.players[playerIndex]
    if (p.activeAvatar) {
      const currentDmg = p.activeAvatar.counters?.damage ?? 0
      const healed = Math.max(0, currentDmg - effectValue)
      const updated: AvatarCard = {
        ...p.activeAvatar,
        counters: { ...(p.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), damage: healed },
      }
      next = updatePlayer(next, playerIndex, { ...p, activeAvatar: updated })
    }
  } else if (effectType === 'draw') {
    for (let i = 0; i < effectValue; i++) {
      next = drawCard(next, playerIndex)
    }
  } else if (effectType === 'discard_draw') {
    // Discard entire hand, then draw effectValue cards
    const p = next.players[playerIndex]
    next = updatePlayer(next, playerIndex, {
      ...p,
      hand: [],
      discardPile: [...p.discardPile, ...p.hand],
    })
    for (let i = 0; i < effectValue; i++) {
      next = drawCard(next, playerIndex)
    }
  } else if (effectType === 'discard_heal') {
    // Discard effectValue cards from hand, then heal effectValue2
    const p = next.players[playerIndex]
    const toDiscard = p.hand.slice(0, effectValue)
    next = updatePlayer(next, playerIndex, {
      ...p,
      hand: p.hand.slice(effectValue),
      discardPile: [...p.discardPile, ...toDiscard],
    })
    const p2 = next.players[playerIndex]
    if (p2.activeAvatar) {
      const currentDmg = p2.activeAvatar.counters?.damage ?? 0
      const healed = Math.max(0, currentDmg - effectValue2)
      const updated: AvatarCard = {
        ...p2.activeAvatar,
        counters: { ...(p2.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), damage: healed },
      }
      next = updatePlayer(next, playerIndex, { ...p2, activeAvatar: updated })
    }
  } else if (effectType === 'discard_retrieve') {
    // Discard effectValue cards, then retrieve effectValue2 avatar(s) from graveyard
    const p = next.players[playerIndex]
    const toDiscard = p.hand.slice(0, effectValue)
    next = updatePlayer(next, playerIndex, {
      ...p,
      hand: p.hand.slice(effectValue),
      discardPile: [...p.discardPile, ...toDiscard],
    })
    const p2 = next.players[playerIndex]
    const avatarsInGrave = p2.graveyard.filter(c => c.type === 'avatar')
    const retrieved = avatarsInGrave.slice(0, effectValue2)
    if (retrieved.length > 0) {
      next = updatePlayer(next, playerIndex, {
        ...p2,
        hand: [...p2.hand, ...retrieved],
        graveyard: p2.graveyard.filter(c => !retrieved.some(r => r.id === c.id)),
      })
    }
  } else if (effectType === 'discard_search') {
    // Discard effectValue avatar cards, search deck for same-element avatar
    const p = next.players[playerIndex]
    const avatarsInHand = p.hand.filter(c => c.type === 'avatar')
    const toDiscard = avatarsInHand.slice(0, effectValue)
    if (toDiscard.length > 0) {
      const searchElement = (toDiscard[0] as AvatarCard).element
      const found = p.deck.find(c => c.type === 'avatar' && c.element === searchElement)
      let newHand = p.hand.filter(c => !toDiscard.some(d => d.id === c.id))
      let newDeck = [...p.deck]
      if (found) {
        newHand = [...newHand, found]
        newDeck = newDeck.filter(c => c.id !== found.id)
      }
      next = updatePlayer(next, playerIndex, {
        ...p,
        hand: newHand,
        deck: newDeck,
        discardPile: [...p.discardPile, ...toDiscard],
      })
    }
  } else if (effectType === 'damage') {
    const opponent = next.players[oppIdx]
    if (opponent.activeAvatar && effectValue > 0) {
      const currentDmg = opponent.activeAvatar.counters?.damage ?? 0
      const updated: AvatarCard = {
        ...opponent.activeAvatar,
        counters: { ...(opponent.activeAvatar.counters ?? { damage: 0, bleed: 0, shield: 0 }), damage: currentDmg + effectValue },
      }
      next = updatePlayer(next, oppIdx, { ...opponent, activeAvatar: updated })
    }
  }

  next = {
    ...next,
    battleLog: [...next.battleLog, `${itemCard.name} used!`],
    lastAction: `${itemCard.name} used!`,
  }

  return checkDefeatedAvatars(next)
}
