# Hooks

This document covers the React hooks and their options in detail.

## useQuery

Signature:

```ts
useQuery<T, R = T>(
  key: QueryKey,
  options?: UseQueryOptions<T, R> | ((data: T) => R)
): {
  data: R | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isStale: boolean;
  refetch: (opts?: { background?: boolean }) => Promise<T | undefined>;
}
```

Options:

- `fetcher`: async function returning `T` (supports `{ signal }` argument for abort).
- `enabled`: default `false`. When `false`, auto-fetch does not run and `refetch` returns `undefined`.
- `select`: maps `T` to `R`. If `structuralSharing` + select memo is enabled, it reuses outputs.
- `suspense`: overrides config `suspense` for this query.
- `throwOnError`: overrides config `throwOnError` for this query.
- `keepPreviousData`: when the key changes, keep last data as display data until new data arrives.
- `initialData`: `T` or `() => T`. Applied once and stored in cache (only if `enabled`).
- `placeholderData`: `R` or `(prev) => R`. Used while fetching when there is no data.
- `onSuccess`, `onError`, `onSettled`: callbacks invoked on fetch completion.
- `meta`: stored in-memory on the entry (not persisted).
- `staleTime`, `cacheTime`, `refetchInterval`, `tags`, `retry`, `abortOnNewFetch`: standard cache and fetch controls.

Full list (with types):

- `fetcher?: (ctx?: { signal?: AbortSignal }) => Promise<T>`
- `enabled?: boolean`
- `select?: (data: T) => R`
- `suspense?: boolean`
- `throwOnError?: boolean`
- `keepPreviousData?: boolean`
- `initialData?: T | (() => T)`
- `placeholderData?: R | ((prev: R | undefined) => R)`
- `onSuccess?: (data: T) => void`
- `onError?: (error: unknown) => void`
- `onSettled?: (data: T | undefined, error: unknown | undefined) => void`
- `meta?: unknown`
- `staleTime?: number`
- `cacheTime?: number`
- `refetchInterval?: number`
- `tags?: string[]`
- `retry?: { attempts?: number; delay?: number | ((attemptIndex: number) => number); retryOn?: (error: unknown, attemptIndex: number) => boolean }`
- `abortOnNewFetch?: boolean`

Notes:

- `isLoading` is `true` only when fetching and no display data is available.
- `isFetching` reflects in-flight state even if there is cached data.
- If `suspense` is enabled and there is no display data, the hook throws the in-flight promise.
- If `throwOnError` is enabled and there is an error, the hook throws it.

Example (basic):

```ts
const { data, isLoading, isFetching, isStale, refetch } = useQuery(["users"], {
  enabled: true,
  fetcher: () => api.get("/users"),
  staleTime: 30_000,
  keepPreviousData: true,
});
```

Example (select + placeholder):

```ts
const count = useQuery(["users"], {
  enabled: true,
  fetcher: () => api.get("/users"),
  select: (users) => users.length,
  placeholderData: (prev) => prev ?? 0,
});
```

Example (initialData):

```ts
const query = useQuery(["me"], {
  enabled: true,
  fetcher: () => api.get("/me"),
  initialData: { id: 0, name: "Guest" },
});
```

Defaults and overrides:

- Global defaults live in `createQueryClient` config.
- Per-prefix defaults are set via `queryDefaults`.
- `useQuery` options override both.

## useInfiniteQuery

Signature:

```ts
useInfiniteQuery<TPage, TParam>(
  key: QueryKey,
  options: UseInfiniteQueryOptions<TPage, TParam>
): {
  data: InfiniteData<TPage, TParam> | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchNextPage: () => Promise<InfiniteData<TPage, TParam> | undefined>;
  fetchPreviousPage: () => Promise<InfiniteData<TPage, TParam> | undefined>;
  refetch: () => Promise<InfiniteData<TPage, TParam> | undefined>;
}
```

Options:

- `fetcher`: async function receiving `{ pageParam, signal }` and returning a page.
- `initialPageParam`: initial param for the first page.
- `getNextPageParam`: computes next param from current pages.
- `getPreviousPageParam`: optional, computes previous param.
- `enabled`: default `false`.
- `keepPreviousData`, `initialData`, `placeholderData`, `suspense`, `throwOnError`: same behavior as `useQuery`.
- `onSuccess`, `onError`, `onSettled`, `meta`.
- `staleTime`, `cacheTime`, `refetchInterval`, `tags`, `retry`, `abortOnNewFetch`.

Full list (with types):

- `fetcher: (ctx: { pageParam: TParam; signal?: AbortSignal }) => Promise<TPage>`
- `getNextPageParam: (lastPage: TPage, pages: TPage[], pageParams: TParam[]) => TParam | undefined`
- `getPreviousPageParam?: (firstPage: TPage, pages: TPage[], pageParams: TParam[]) => TParam | undefined`
- `initialPageParam: TParam`
- `enabled?: boolean`
- `suspense?: boolean`
- `throwOnError?: boolean`
- `keepPreviousData?: boolean`
- `initialData?: InfiniteData<TPage, TParam> | (() => InfiniteData<TPage, TParam>)`
- `placeholderData?: InfiniteData<TPage, TParam> | ((prev: InfiniteData<TPage, TParam> | undefined) => InfiniteData<TPage, TParam>)`
- `onSuccess?: (data: InfiniteData<TPage, TParam>) => void`
- `onError?: (error: unknown) => void`
- `onSettled?: (data: InfiniteData<TPage, TParam> | undefined, error: unknown | undefined) => void`
- `meta?: unknown`
- `staleTime?: number`
- `cacheTime?: number`
- `refetchInterval?: number`
- `tags?: string[]`
- `retry?: { attempts?: number; delay?: number | ((attemptIndex: number) => number); retryOn?: (error: unknown, attemptIndex: number) => boolean }`
- `abortOnNewFetch?: boolean`

Notes:

- `isFetchingNextPage`/`isFetchingPreviousPage` are derived from the in-flight direction.
- `refetch` replays all pages with the stored page params.

Example:

```ts
const query = useInfiniteQuery(["feed"], {
  enabled: true,
  initialPageParam: 0,
  fetcher: ({ pageParam }) => api.get(`/feed?page=${pageParam}`),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

## useMutation

Signature:

```ts
useMutation<TVars, TResult>(options: UseMutationOptions<TVars, TResult>): {
  mutate: (variables: TVars) => Promise<TResult>;
  isLoading: boolean;
  error: unknown;
  data: TResult | undefined;
  reset: () => void;
  cancel: () => void;
  status: "idle" | "loading" | "success" | "error";
}
```

Options:

- `mutationFn`: async function `(vars, { signal }) => TResult`.
- `mutationKey`: optional key for defaults and cancellation.
- `retry`: per-mutation retry config.
- `abortOnNewMutation`: abort previous mutation for the same key.
- `optimistic`: array of `{ key, update }` for optimistic updates.
- `updateCache`: array of `{ key, update }` to apply after success.
- `invalidateKeys`, `invalidatePrefixes`, `invalidateTags`.
- `onSuccess`, `onError`, `onSettled`.

Full list (with types):

- `mutationFn: (vars: TVars, ctx?: { signal?: AbortSignal }) => Promise<TResult>`
- `mutationKey?: QueryKey`
- `retry?: { attempts?: number; delay?: number | ((attemptIndex: number) => number); retryOn?: (error: unknown, attemptIndex: number) => boolean }`
- `abortOnNewMutation?: boolean`
- `optimistic?: Array<{ key: QueryKey; update: (prev: unknown | undefined) => unknown }>`
- `updateCache?: Array<{ key: QueryKey; update: (prev: unknown | undefined, result: TResult) => unknown }>`
- `invalidateKeys?: QueryKey[]`
- `invalidatePrefixes?: string[]`
- `invalidateTags?: string[]`
- `onSuccess?: (result: TResult, vars: TVars) => void`
- `onError?: (error: unknown, vars: TVars) => void`
- `onSettled?: (result: TResult | undefined, error: unknown | undefined, vars: TVars) => void`

Example:

```ts
const { mutate, status, cancel } = useMutation({
  mutationKey: ["users"],
  mutationFn: (payload) => api.post("/users", payload),
  optimistic: [
    { key: ["users"], update: (prev) => [...(prev ?? []), payload] },
  ],
  invalidateKeys: [["users"]],
});
```
