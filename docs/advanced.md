# Advanced

This document covers advanced features and production details.

## Suspense and error boundaries

- `suspense` and `throwOnError` are off by default.
- You can enable them globally in config or per query via options.

Example:

```ts
const client = createQueryClient({
  suspense: true,
  throwOnError: true,
});
```

## Multi-tab sync

BroadcastChannel can propagate cache invalidations across tabs:

```ts
createQueryClient({
  multiTabSync: { enabled: true, channelName: "yokai-query" },
});
```

Sync propagates `invalidate`, `invalidateByPrefix`, `invalidateTags`, and `clear`.

## Devtools

Config:

```ts
devtools: {
  enabled: true,
  exposeToWindow: true,
  emitEvents: false,
  eventName: "__query_store__",
  overlay: { enabled: false, position: "bottom-right" },
}
```

- When `exposeToWindow` is true, `window.__QUERY_STORE__` is set.
- `emitEvents` sends `CustomEvent` entries for external tooling.
- `overlay` renders a small in-page metrics widget.

## SSR

Create a client per request, then dehydrate and hydrate on the client:

```ts
const client = createQueryClient();
const state = client.getState().dehydrate();

useQueryStore.getState().hydrate(state);
```

## Refetching on focus/online

- `refetchOnFocus`: refetch stale queries on window focus.
- `refetchOnOnline`: refetch stale queries on `online` event.
- `refetchOnReconnect`: alias for focus-based refetch.

Only queries with active observers are refetched.

## Query defaults

You can define per-prefix defaults:

```ts
queryDefaults: [
  {
    prefix: "users",
    options: { staleTime: 60_000, keepPreviousData: true },
  },
],
```

## Mutation defaults

```ts
mutationDefaults: [
  {
    key: "users",
    options: { retry: { attempts: 2 }, abortOnNewMutation: true },
  },
],
```

## Meta

`meta` can be attached to entries and read in the store. It is not persisted.

## Manual cache updates

`setQueryData` lets you update cache outside of queries:

```ts
useQueryStore.getState().setQueryData(["users"], nextUsers);
```

## Tag cancellation

`cancelByTags(tags)` aborts in-flight queries that match any tag.

## Customization surface

Yokai Query is customizable at multiple levels:

- Global defaults via `createQueryClient(config)`.
- Per-prefix defaults via `queryDefaults` and `mutationDefaults`.
- Per-hook overrides in `useQuery` / `useInfiniteQuery` / `useMutation`.
- Imperative overrides via `setConfig` and `setQueryData` at runtime.

## Simple helpers

If you want fewer knobs, Yokai Query provides lightweight helpers.

### useSimpleQuery

```ts
import { useSimpleQuery } from "yokai-query";

const users = useSimpleQuery(["users"], () => api.get("/users"));
```

With onSettled:

```ts
const users = useSimpleQuery(
  ["users"],
  () => api.get("/users"),
  {
    onSettled: (data, error) => {
      console.log("users settled", { data, error });
    },
  }
);
```

Defaults:
- `enabled: true`
- `keepPreviousData: true`

You can still pass any `UseQueryOptions` except `fetcher`.

### useSimpleMutation

```ts
import { useSimpleMutation } from "yokai-query";

const createUser = useSimpleMutation((payload: { name: string }) =>
  api.post("/users", payload)
);
```

With onSettled:

```ts
const createUser = useSimpleMutation(
  (payload: { name: string }) => api.post("/users", payload),
  {
    onSettled: (data, error, vars) => {
      console.log("mutation settled", { data, error, vars });
    },
  }
);
```

Accepts the same options as `useMutation` (without `mutationFn`).

### useSimpleInfiniteQuery

```ts
import { useSimpleInfiniteQuery } from "yokai-query";

const feed = useSimpleInfiniteQuery(
  ["feed"],
  ({ pageParam }) => api.get(`/feed?cursor=${pageParam ?? 0}`),
  { initialPageParam: 0, getNextPageParam: (last) => last.nextCursor }
);
```

With onSettled:

```ts
const feed = useSimpleInfiniteQuery(
  ["feed"],
  ({ pageParam }) => api.get(`/feed?cursor=${pageParam ?? 0}`),
  {
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
    onSettled: (data, error) => {
      console.log("feed settled", { data, error });
    },
  }
);
```

### createDefaultClient

```ts
import { createDefaultClient } from "yokai-query";

const client = createDefaultClient();
```

This is a thin alias for `createQueryClient()` with the standard defaults.

### setListCache

```ts
import { setListCache } from "yokai-query";

setListCache(["users"], { id: 123, name: "Ada" }, { prepend: true, idKey: "id" });
```

### createAuthBridgeFromEnv

```ts
import { createAuthBridgeFromEnv } from "yokai-query";

const auth = await createAuthBridgeFromEnv();
```

Uses `better-auth` (bundled with `yokai-query`) and defaults to `window.location.origin + "/api/auth"`.

## Cache versioning

To invalidate persisted cache across deployments, use a version guard:

```ts
import { createCacheVersionGuard } from "yokai-query";

const guard = createCacheVersionGuard({
  version: "2025-01-01",
  storage: "local",
  channelName: "yokai-cache",
});

// guard.dispose() if needed
```

## Observability

You can listen to devtools events (enable `devtools.emitEvents`):

```ts
import { createStoreEventReporter } from "yokai-query";

const stop = createStoreEventReporter({
  onEvent: (event) => console.log(event.type, event.payload),
});
```

You can also wrap fetchers for tracing:

```ts
import { wrapFetcher } from "yokai-query";

const fetcher = wrapFetcher(
  () => api.get("/users"),
  { onSettled: (trace) => console.log(trace.duration) },
  { label: "users" }
);
```

## Prefetch scheduler

Queue prefetches with a small concurrency budget:

```ts
import { createPrefetchScheduler } from "yokai-query";

const scheduler = createPrefetchScheduler({ concurrency: 2, delayMs: 100 });
scheduler.schedule(["users"], { fetcher: () => api.get("/users") });
```

## Prefetch rate limiting

```ts
const scheduler = createPrefetchScheduler({
  concurrency: 2,
  maxPerSecond: 4,
});
```

## Offline mutation queue

Queue mutations while offline and flush on reconnect:

```ts
import { createOfflineMutationQueue } from "yokai-query";

const queue = createOfflineMutationQueue({ autoFlush: true });

queue.enqueue("create-user", { name: "Ada" }, (vars) =>
  api.post("/users", vars)
);
```

## Cache export/import

```ts
import { exportCacheSnapshot, importCacheSnapshot } from "yokai-query";

const snapshot = exportCacheSnapshot();
importCacheSnapshot(snapshot);
```

## Presence TTL

```ts
import { startPresenceTtl } from "yokai-query";

const stop = startPresenceTtl({
  key: ["presence", "room-1"],
  ttlMs: 30_000,
});
```

## Read receipts

```ts
import { addReadReceipt } from "yokai-query";

addReadReceipt(
  { messageId: "m1", userId: "u1", readAt: Date.now() },
  { key: ["reads", "room-1"] }
);
```

## Simple API client

If you want a minimal client with auth + retries + hooks:

```ts
import { createApiClient } from "yokai-query";

const client = createApiClient({
  baseURL: "/api",
  defaultRetry: { attempts: 2, delay: 200 },
  retryRules: [{ prefix: "/users", retry: { attempts: 3 } }],
  plugins: [{ onError: (err) => console.warn(err) }],
});
```
