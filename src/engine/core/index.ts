// Public engine surface, split by concern from the former gameEngine.ts.
// `internals.ts` (updatePlayer / shuffleCards / untapAvatars) is intentionally
// NOT re-exported — those stay private to the engine.
export * from './playerSetup'
export * from './phases'
export * from './cardOps'
export * from './spektra'
export * from './skills'
export * from './spells'
export * from './items'
export * from './evolution'
export * from './combat'
export * from './winCondition'
