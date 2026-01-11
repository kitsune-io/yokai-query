# Yokai Query

Yokai Query is a lightweight, Zustand-powered query/cache layer with a TanStack-like API. It provides fetch dedupe, stale/cache lifetimes, optimistic mutations, retries, persistence, invalidation, and optional devtools.

## Highlights

- Query cache with `staleTime`/`cacheTime` and LRU eviction
- In-flight dedupe and optional background refetch
- Configurable retries per query/mutation
- Persistence (session storage or IndexedDB) and hydrate/dehydrate
- Tag and prefix invalidation + batch
- Optimistic mutations with rollback
- Optional Suspense and error boundaries
- Infinite queries support
- Multi-tab sync (BroadcastChannel)

## Install

```bash
npm i yokai-query
```

Includes runtime deps (`zustand`, `@better-fetch/fetch`, `better-auth`, `socket.io-client`). Your app still needs `react` installed.

## Quick Start

```ts
import { api, useQuery, useMutation } from "yokai-query";

function useUsers() {
  return useQuery(["users"], {
    enabled: true,
    fetcher: () => api.get("/users"),
    staleTime: 30_000,
  });
}

function useCreateUser() {
  return useMutation({
    mutationKey: ["users"],
    mutationFn: (payload) => api.post("/users", payload),
    invalidateKeys: [["users"]],
  });
}
```

## Quick Start (ES)

```ts
import { api, useQuery, useMutation } from "yokai-query";

function useUsuarios() {
  return useQuery(["users"], {
    enabled: true,
    fetcher: () => api.get("/users"),
    staleTime: 30_000,
  });
}

function useCrearUsuario() {
  return useMutation({
    mutationKey: ["users"],
    mutationFn: (payload) => api.post("/users", payload),
    invalidateKeys: [["users"]],
  });
}
```

## Exports

- `api` - Better Fetch client instance
- `createQueryClient` - create a new store (SSR or multi-instance)
- `useQueryStore` - default singleton store
- `useQuery`, `useInfiniteQuery`, `useMutation` - React hooks
- `useSimpleQuery`, `useSimpleInfiniteQuery`, `useSimpleMutation` - simplified hooks
- `createDefaultClient` - convenience client creator
- `setListCache` - helper to append/prepend items in list cache
- `createAuthBridgeFromEnv` - simple Better Auth bridge from defaults
- `connectSocketCache` - simplified realtime helper
- `connectSseCache` - SSE cache bridge helper
- `createCacheVersionGuard` - cache versioning helper
- `createStoreEventReporter`, `wrapFetcher` - observability helpers
- `createPrefetchScheduler` - prefetch queue helper
- `createApiClient` - minimal fetch client with retry + hooks
- `createChatRoomBridge` - chat/presence/typing preset
- `createWebRtcPeer` - WebRTC signaling helper
- `createOfflineMutationQueue` - offline mutation queue
- `exportCacheSnapshot`, `importCacheSnapshot` - cache snapshots
- `startPresenceTtl` - presence expiry helper
- `addReadReceipt` - read receipts helper
- Types: `QueryKey`, `QueryStore`, `FetchQueryOptions`, `MutateOptions`, etc

## Docs

- `docs/getting-started.md`
- `docs/config.md`
- `docs/hooks.md`
- `docs/api.md`
- `docs/caching.md`
- `docs/mutations.md`
- `docs/advanced.md`
- `docs/options.md`
- `docs/recipes.md`
- `docs/auth.md`
- `docs/realtime.md`
- `docs/es/README.md` (Spanish)

## Example app

- `examples/playground/README.md`

## Notes

- Query keys can be strings or readonly arrays. Array keys are hashed with a stable serializer.
- `meta` is stored in memory but not persisted.
- `fetcher` functions are not persisted (they stay in memory).
- `invalidate*` keeps cached data and marks entries stale instead of removing them.

## Customization vs fixed behavior

Customizable:

- Per-hook options (`useQuery`, `useInfiniteQuery`, `useMutation`).
- Per-prefix defaults (`queryDefaults`, `mutationDefaults`).
- Global config via `createQueryClient` and `setConfig`.

Fixed (internal):

- Key hashing and in-flight dedupe strategy.
- LRU eviction policy and GC flow (configurable thresholds and intervals).
- Persistence and devtools implementations (configurable on/off).
