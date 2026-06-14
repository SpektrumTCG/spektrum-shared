/**
 * Pins that BaseAI.canAffordSpektra and the engine's hasEnoughSpektra agree on
 * affordability across a battery of cases. This is the safety net for unifying
 * the two implementations: if every case matches on the current (pre-unify)
 * code, delegating the AI helper to the engine is behavior-preserving.
 */
import { BaseAI } from '../../ai/BaseAI'
import { hasEnoughSpektra } from '../../engine'
import type { AIDifficulty } from '../../types/ai'
import type { ElementType } from '../../types/card'
import type { GameState, Player } from '../../types/game'

// Expose the protected helper for direct testing.
class ProbeAI extends BaseAI {
  decide(): never {
    throw new Error('not used')
  }
  affords(cost: string[] | undefined, pile: Array<{ element?: string }>): boolean {
    return this.canAffordSpektra(cost, pile)
  }
}

const probe = new ProbeAI('regular' as AIDifficulty)

function pile(...elements: string[]): Array<{ element?: string }> {
  return elements.map((element, i) => ({ id: `c${i}`, element }))
}

const cases: Array<{ name: string; cost: ElementType[]; pile: Array<{ element?: string }> }> = [
  { name: 'empty cost, empty pile', cost: [], pile: [] },
  { name: 'empty cost, nonempty pile', cost: [], pile: pile('fire') },
  { name: 'exact single match', cost: ['fire'], pile: pile('fire') },
  { name: 'exact match among others', cost: ['fire'], pile: pile('fire', 'water') },
  { name: 'neutral card covers specific', cost: ['fire'], pile: pile('neutral') },
  { name: 'neutral cost paid by any', cost: ['neutral'], pile: pile('water') },
  { name: 'neutral cost paid by neutral', cost: ['neutral'], pile: pile('neutral') },
  { name: 'insufficient: too few cards', cost: ['fire', 'fire'], pile: pile('fire') },
  { name: 'insufficient: wrong element no neutral', cost: ['fire'], pile: pile('water') },
  { name: 'empty pile, nonempty cost', cost: ['fire'], pile: [] },
  { name: 'multi same element met', cost: ['fire', 'fire'], pile: pile('fire', 'fire') },
  { name: 'multi same element, one neutral cover', cost: ['fire', 'fire'], pile: pile('fire', 'neutral') },
  { name: 'mixed specific + neutral met', cost: ['fire', 'neutral'], pile: pile('fire', 'water') },
  { name: 'mixed specific + neutral, neutral short', cost: ['fire', 'neutral'], pile: pile('fire') },
  { name: 'oversupply', cost: ['fire'], pile: pile('fire', 'fire', 'water', 'neutral') },
  { name: 'two specific diff elements met', cost: ['fire', 'water'], pile: pile('fire', 'water') },
  { name: 'two specific, one via neutral', cost: ['fire', 'water'], pile: pile('fire', 'neutral') },
  { name: 'all neutral cost, exact count', cost: ['neutral', 'neutral'], pile: pile('fire', 'water') },
  { name: 'all neutral cost, short', cost: ['neutral', 'neutral'], pile: pile('fire') },
  { name: 'undefined element treated as neutral', cost: ['fire'], pile: [{ element: undefined }] },
]

describe('spektra affordability: AI helper vs engine', () => {
  it.each(cases)('agree on: $name', ({ cost, pile: p }) => {
    const aiResult = probe.affords(cost, p)
    const engineResult = hasEnoughSpektra({ spektraPile: p } as unknown as Player, cost)
    expect(aiResult).toBe(engineResult)
  })
})
