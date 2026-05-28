# @spektrum/shared

Shared game engine, types, and socket.io contract for [Spektrum TCG](https://github.com/<org-tbd>).

Consumed by:
- `spektrum-client` (Next.js frontend)
- `spektrum-server` (Express + socket.io backend)

## Layout

- `src/engine/` — turn resolution, skill execution, win conditions
- `src/types/` — `Card`, `GameState`, `Player`, `Effect`
- `src/ai/` — opponent AI strategies (Newbie / Regular / Enhanced)
- `src/data/` — card registry + card sets
- `src/socket-events.ts` — typed `ClientToServerEvents` / `ServerToClientEvents` contract

## Use

```bash
npm install file:../spektrum-shared   # during local development
```

After the org publishes packages, switch to a versioned install:
```bash
npm install @spektrum/shared@^0.1.0
```

## Carved from

`spektrum-v2` monorepo, tag `pre-split`. History preserved via `git filter-repo`.
