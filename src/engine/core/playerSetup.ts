import type { Card } from '../../types/card'
import type { GameState, Player } from '../../types/game'
import { shuffleCards } from './internals'

const INITIAL_HAND_SIZE = 5
const INITIAL_LIFE_CARDS = 4

function createPlayer(id: string, name: string, deck: Card[], isActive: boolean): Player {
  const shuffled = shuffleCards(deck)
  return {
    id,
    name,
    health: 20,
    maxHealth: 20,
    energy: { fire: 0, water: 0, ground: 0, air: 0, neutral: 0 },
    spektraPile: [],
    usedSpektraPile: [],
    lifeCards: shuffled.splice(0, INITIAL_LIFE_CARDS),
    hand: shuffled.splice(0, INITIAL_HAND_SIZE),
    deck: shuffled,
    discardPile: [],
    graveyard: [],
    field: [],
    activeAvatar: null,
    reserveAvatars: [],
    counters: { bleed: 0, burn: 0, poison: 0, stun: 0, shield: 0 },
    discardedThisTurn: [],
    isActivePlayer: isActive,
    avatarToSpektraCount: 0,
    hasPlayedItemThisTurn: false,
    equipmentActivations: {},
  }
}

export function startGame(playerDeck: Card[], opponentDeck: Card[]): GameState {
  return {
    currentTurn: 1,
    phase: 'setup',
    players: [
      createPlayer('player', 'Player', playerDeck, true),
      createPlayer('opponent', 'Opponent', opponentDeck, false),
    ],
    currentPlayerIndex: 0 as 0 | 1,
    winner: null,
    turnTimer: 120,
    lastAction: 'Game started — deploy your Active Avatar!',
    battleLog: ['Game started', 'Setup Phase: Deploy your Active Avatar from your hand.'],
    effectStack: [],
    pendingChoice: null,
  }
}
