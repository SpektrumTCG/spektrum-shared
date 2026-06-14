export * from "./cardRegistry";
export * from "./cards/generated";
// Legacy hand-written card data still consumed by spektrum-client:
//   fire.ts    -> newFireAvatarCards/newFireSpellCards (interactive tutorial)
//   premade.ts -> fetchPremadeDecks/resolvePremadeDeckCards (shop premade decks)
// These are NOT part of the CSV-generated catalog (cardRegistry). The other
// legacy files (water/red/neutral/advanced/conditional/nonElemental) were dead
// and removed.
export * from "./cards/fire";
export * from "./cards/premade";
