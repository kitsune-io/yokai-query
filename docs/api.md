# API

This document covers the public exports and the imperative store API.

## Exports

- `api`: Better Fetch client instance (`baseURL: /api`, `throw: true`, retry config).
- `createQueryClient`: create a query store instance (SSR-friendly).
- `useQueryStore`: default singleton client (client-side).
- Hooks: `useQuery`, `useInfiniteQuery`, `useMutation`.
- Types: `QueryKey`, `FetchQueryOptions`, `MutateOptions`, etc.
- Auth helpers: `setAuthToken`, `clearAuthToken`, `createBetterAuthBridge`.

## Query keys

A `QueryKey` can be a string or a readonly array. Array keys are hashed with a
stable serializer. Prefer arrays for structured keys:

```ts
const key = ["users", { page: 1 }];
```

## Better Fetch client

The default client is exported as `api`:

```ts
import { api } from "yokai-query";

const data = await api.get("/users");
```

You can also create your own client with `createFetch` if needed.

## createQueryClient

```ts
import { createQueryClient } from "yokai-query";

const client = createQueryClient({
  maxEntries: 200,
  persistence: { mode: "indexeddb" },
});
```

Each call returns a Zustand store with the full API.

## Imperative store API

These methods are on the store returned by `createQueryClient` and the default
`useQueryStore` singleton:

- `fetchQuery(key, options)`
- `fetchInfiniteQuery(key, options)`
- `refetchInfiniteQuery(key)`
- `prefetchQuery(key, options)`
- `invalidate(key)`
- `invalidateByPrefix(prefix)`
- `invalidateTags(tags)`
- `cancelByTags(tags)`
- `abort(key)`
- `cancelMutation(key)`
- `setQueryData(key, data, options)`
- `mutate(options)`
- `getMutation(key)`
- `batch(fn)`
- `gc()`
- `dehydrate()` / `hydrate(payload)`
- `setConfig(partial)` / `setDebug(boolean)`
- `clear()`
- `getSnapshot()`

Notes:

- `invalidate*` keeps cached data and marks it stale instead of deleting it.

Example (imperative fetch):

```ts
const store = useQueryStore.getState();

await store.fetchQuery(["users"], {
  fetcher: () => api.get("/users"),
  staleTime: 30_000,
});
```

Example (manual update + invalidate):

```ts
const store = useQueryStore.getState();

store.setQueryData(["users"], [{ id: 1, name: "Ada" }]);
store.invalidateTags(["users"]);
```

Example (batch):

```ts
const store = useQueryStore.getState();

store.batch(() => {
  store.invalidate(["users"]);
  store.invalidateByPrefix("posts");
});
```
