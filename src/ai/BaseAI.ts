import type { AIDifficulty, AIDecision, AIPersonality } from '../types/ai'
import type { GameState, Player } from '../types/game'
import type { ElementType } from '../types/card'
import { hasEnoughSpektra } from '../engine'

export const AI_PERSONALITIES: Record<AIDifficulty, AIPersonality> = {
  newbie: {
    name: 'Rookie Trainer',
    difficulty: 'newbie',
    description: 'A new player learning the ropes',
    aggression: 30, caution: 20, efficiency: 25, strategy: 15,
    riskTolerance: 40, adaptability: 20, cardEvaluation: 30,
    favoriteElements: ['fire', 'neutral'],
    preferredPlayStyle: 'aggressive',
    mistakeChance: 35,
  },
  regular: {
    name: 'Experienced Duelist',
    difficulty: 'regular',
    description: 'A competent player with solid fundamentals',
    aggression: 60, caution: 55, efficiency: 65, strategy: 60,
    riskTolerance: 50, adaptability: 60, cardEvaluation: 70,
    favoriteElements: ['fire', 'water', 'ground'],
    preferredPlayStyle: 'balanced',
    mistakeChance: 15,
  },
  advanced: {
    name: 'Master Strategist',
    difficulty: 'advanced',
    description: 'An expert player with deep tactical knowledge',
    aggression: 75, caution: 85, efficiency: 90, strategy: 95,
    riskTolerance: 70, adaptability: 90, cardEvaluation: 95,
    favoriteElements: ['fire', 'water', 'ground', 'air'],
    preferredPlayStyle: 'control',
    mistakeChance: 5,
  },
}

export abstract class BaseAI {
  protected personality: AIPersonality

  constructor(difficulty: AIDifficulty) {
    this.personality = AI_PERSONALITIES[difficulty]
  }

  abstract decide(state: GameState, playerIndex?: 0 | 1): AIDecision

  protected endPhase(reason: string): AIDecision {
    return { type: 'endPhase', reasoning: reason, priority: 0 }
  }

  protected canAffordSpektra(cost: string[] | undefined, spektraPile: Array<{ element?: string }>): boolean {
    // Delegate to the engine's authoritative rule so AI affordability never
    // drifts from what playSpell / executeSkill will actually accept.
    return hasEnoughSpektra({ spektraPile } as unknown as Player, (cost ?? []) as ElementType[])
  }
}
