// Generated from current socket usage. Single source of truth for
// client/server socket contracts. Add events here first, then wire them.
//
// Two server namespaces are modeled together:
//   • Ante battle socket (path: /ante-socket)  -- staking 1v1 matches
//   • Multiplayer / PvP socket (path: /socket.io) -- casual/ranked + custom rooms
//
// Both share a single Server/Client interface so a single socket.io client
// pointed at either namespace gets full type coverage. Where an event is
// only meaningful on one namespace, that's noted in the comment above it.
//
// Payload types are intentionally loose where the runtime is loose today
// (e.g. `deck: unknown[]`, `gameState: unknown`). The contract documents
// reality, not aspirations — tightening these is a separate task.

// ---------------------------------------------------------------------------
// Ante-specific payload types (mirrored from server/types/anteBattle.ts and
// src/services/anteMatchmaking.ts; both files predate this contract).
// ---------------------------------------------------------------------------

export type AnteCardRarity = "rare" | "super_rare" | "mythic";

export interface AnteWageredCard {
  cardId: string;
  cardName: string;
  rarity: AnteCardRarity;
  nftMint: string;
  ownerWallet: string;
  imagePath?: string;
}

export interface AnteOpponentInfo {
  playerId: string;
  walletAddress: string;
  wageredCard: AnteWageredCard;
}

export interface AnteMatchFoundPayload {
  battleId: string;
  opponent: AnteOpponentInfo;
  yourCard: AnteWageredCard;
}

export interface AnteBattleCompletedPayload {
  battleId: string;
  winnerId: string;
  wonCard: AnteWageredCard | null;
  lostCard: AnteWageredCard | null;
  blockchainSignature?: string;
  transferStatus?: "confirmed" | "failed" | "pending";
}

// ---------------------------------------------------------------------------
// PvP-specific payload types. GameRoom / Player live in the client store
// (`src/stores/useMultiplayerStore.ts`); re-declared structurally here so the
// shared package has zero app-side dependencies.
// ---------------------------------------------------------------------------

export interface PvPPlayer {
  id: string;
  name: string;
  avatar?: string | null;
  isReady: boolean;
  isHost: boolean;
  deck?: unknown[];
  socketId?: string;
}

export interface PvPGameRoom {
  id: string;
  name: string;
  players: PvPPlayer[];
  maxPlayers: number;
  // Server emits 'custom' for host-created rooms; client store currently
  // narrows to 'tournament'. Listing both keeps the contract honest until
  // those representations are reconciled in a follow-up.
  gameMode: "casual" | "ranked" | "custom" | "tournament";
  status: "waiting" | "ready" | "playing" | "finished";
  settings: {
    timeLimit: number;
    deckRestrictions: string[];
    allowSpectators: boolean;
  };
}

export interface PvPGameAction {
  type: string;
  playerId: string;
  data: unknown;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Server -> Client events
// ---------------------------------------------------------------------------

export interface ServerToClientEvents {
  // --- Shared / generic ----------------------------------------------------
  /** Generic error envelope. Used by both ante and PvP code paths. */
  error: (payload: { message: string }) => void;

  // --- Ante battle ---------------------------------------------------------
  match_found: (
    payload: AnteMatchFoundPayload | PvPGameRoom,
  ) => void;
  queue_joined: (payload: {
    rarity: AnteCardRarity;
    position: number;
  }) => void;
  queue_error: (payload: { error: string }) => void;
  queue_cancelled: () => void;
  confirmation_received: (payload: { battleId: string }) => void;
  battle_start: (payload: {
    battleId: string;
    gameState?: unknown;
  }) => void;
  ante_game_state_updated: (payload: { gameState: unknown }) => void;
  ante_action_rejected: (payload: { action: string; error: string }) => void;
  battle_opponent_disconnected: (payload: {
    battleId: string;
    result?: "win" | "loss";
    reason: string;
  }) => void;
  transfer_pending: (payload: {
    battleId: string;
    winnerId: string;
    status: string;
  }) => void;
  transfer_failed: (payload: { battleId: string; error?: string }) => void;
  battle_completed: (payload: AnteBattleCompletedPayload) => void;

  // --- PvP / multiplayer rooms --------------------------------------------
  player_registered: (player: PvPPlayer) => void;
  matchmaking_started: (payload: { gameMode: "casual" | "ranked" }) => void;
  matchmaking_cancelled: () => void;
  room_created: (room: PvPGameRoom | undefined) => void;
  create_room_error: (error: string) => void;
  // Server emits the result of getRoom() directly which can be undefined
  // when the room has just been finalised but not yet re-fetched. Listening
  // sides must guard.
  room_joined: (room: PvPGameRoom | undefined) => void;
  room_updated: (room: PvPGameRoom) => void;
  room_left: () => void;
  join_room_error: (error: string) => void;
  available_rooms: (rooms: PvPGameRoom[]) => void;
  game_starting: (room: PvPGameRoom) => void;
  game_started: (payload: {
    room: PvPGameRoom;
    gameState: unknown;
  }) => void;
  game_state_updated: (payload: unknown) => void;
  game_action: (action: PvPGameAction) => void;
  action_rejected: (payload: { action?: string; error?: string }) => void;
  deck_accepted: () => void;
  deck_rejected: (payload: { error?: string }) => void;
  queue_stats: (stats: unknown) => void;
  game_finished: (result: unknown) => void;
  reconnect_failed: (payload: { error: string }) => void;
  game_state_sync: (payload: {
    room: PvPGameRoom;
    gameState: unknown;
    timestamp: number;
  }) => void;
  opponent_disconnected: (payload: {
    playerId: string;
    result: "win" | "loss";
    reason: string;
    turn?: number;
  }) => void;
  player_disconnected: (payload: {
    playerId: string;
    reason: string;
  }) => void;
}

// ---------------------------------------------------------------------------
// Client -> Server events
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  // --- Ante battle ---------------------------------------------------------
  join_queue: (payload: {
    playerId: string;
    wageredCard: AnteWageredCard;
  }) => void;
  cancel_queue: (payload: { playerId: string }) => void;
  confirm_battle: (payload: {
    battleId: string;
    playerId: string;
    deck: unknown[];
  }) => void;
  battle_result: (payload: {
    battleId: string;
    winnerId: string;
  }) => void;
  ante_game_action: (payload: {
    battleId: string;
    action: unknown;
  }) => void;
  request_ante_state: (payload: {
    battleId: string;
    playerId?: string;
  }) => void;

  // --- PvP / multiplayer rooms --------------------------------------------
  register_player: (payload: {
    playerId?: string;
    name: string;
    avatar?: string | null;
    walletAddress?: string | null;
  }) => void;
  start_matchmaking: (payload: { gameMode: "casual" | "ranked" }) => void;
  stop_matchmaking: () => void;
  create_room: (payload: {
    name: string;
    settings?: unknown;
  }) => void;
  join_room: (roomId: string) => void;
  leave_room: () => void;
  set_ready: (ready: boolean) => void;
  submit_deck: (payload: { deck?: unknown[]; deckId?: string }) => void;
  start_game: (payload: {
    player1Deck: unknown[];
    player2Deck: unknown[];
  }) => void;
  game_action: (action: unknown) => void;
  game_finished: (result: unknown) => void;
  get_available_rooms: () => void;
  get_queue_stats: () => void;
  request_game_state: () => void;
  forfeit_game: () => void;
}

// ---------------------------------------------------------------------------
// Server-internal + per-socket data
// ---------------------------------------------------------------------------

export interface InterServerEvents {
  // No inter-server socket.io adapters in use today. Kept for completeness so
  // the Server<> generic stays 4-arg.
}

/**
 * Per-socket data attached by the auth middleware in
 * server/services/anteWebSocket.ts and server/services/multiplayerWebSocket.ts.
 * Both middlewares verify a Clerk JWT then attach `userId` + `walletAddress`.
 */
export interface SocketData {
  userId?: string;
  walletAddress?: string;
}
