# Caching

Yokai Query stores data in a Zustand store and treats it as a cache with
staleness and eviction rules.

## staleTime vs cacheTime

- `staleTime`: how long data is considered fresh. Fresh data is returned
  immediately without a network request.
- `cacheTime`: how long data is kept after it was fetched. When expired, the
  entry is removed by GC.

## In-flight dedupe

If a fetch for a key is already in progress, new calls return the same promise.
This avoids duplicate requests and keeps UI consistent.

## Stale-while-revalidate

If `staleWhileRevalidate` is enabled (config), stale data is returned
immediately and a background fetch updates the cache.

## LRU eviction

When the number of entries exceeds `maxEntries`, the least-recently accessed
entries are invalidated.

## Invalidation behavior

Invalidation marks entries as stale instead of removing cached data. The entry
remains available for display, but `fetchedAt` is reset and a refetch can
refresh it.

## GC

- `gc()` removes entries that exceeded `cacheTime`.
- `gcIntervalMs` can run GC on a timer in the browser.

Example:

```ts
const store = useQueryStore.getState();
store.gc();
```

## Persistence

Cache state can be persisted and rehydrated:

- `persistence.mode`: `"none" | "session" | "indexeddb"`.
- `dehydrate()` returns a serializable payload.
- `hydrate(payload)` restores it.

Notes:

- `fetcher` functions and `meta` are not persisted.
- Errors are not persisted.

## Structural sharing

If `structuralSharing` is enabled, deep-equal object graphs reuse references
across updates. This reduces re-renders and makes memoization more effective.

## Select memoization

`selectMemoMaxEntries` controls an LRU cache for `select` outputs inside
`useQuery`. Set to `0` to disable.

## Display data flow

`useQuery` and `useInfiniteQuery` can display data in this order:

1. Fresh cached data.
2. `initialData` (applied once and stored in cache).
3. `keepPreviousData` from the previous key.
4. `placeholderData` while fetching.

## isLoading vs isFetching

- `isFetching`: true while a request is in flight.
- `isLoading`: true only when fetching and there is no display data.
