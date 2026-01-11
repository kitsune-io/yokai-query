# Hooks

Documento completo de hooks y opciones.

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

Opciones:

- `fetcher`: funcion async que retorna `T` (soporta `{ signal }` para abort).
- `enabled`: default `false`. Si es `false`, no auto-fetch y `refetch` devuelve `undefined`.
- `select`: transforma `T` en `R`.
- `suspense`: override de config.
- `throwOnError`: override de config.
- `keepPreviousData`: mantiene data anterior mientras llega la nueva.
- `initialData`: `T` o `() => T`. Se aplica una vez (solo si `enabled`).
- `placeholderData`: `R` o `(prev) => R`.
- `onSuccess`, `onError`, `onSettled`: callbacks por resultado.
- `meta`: se guarda en memoria (no se persiste).
- `staleTime`, `cacheTime`, `refetchInterval`, `tags`, `retry`, `abortOnNewFetch`.

Lista completa (con tipos):

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

Notas:

- `isLoading` es `true` solo si esta fetch y no hay display data.
- `isFetching` marca in-flight aunque haya cache.

Ejemplo (basico):

```ts
const { data, isLoading, isFetching, isStale } = useQuery(["users"], {
  enabled: true,
  fetcher: () => api.get("/users"),
  staleTime: 30_000,
  keepPreviousData: true,
});
```

Ejemplo (select + placeholder):

```ts
const count = useQuery(["users"], {
  enabled: true,
  fetcher: () => api.get("/users"),
  select: (users) => users.length,
  placeholderData: (prev) => prev ?? 0,
});
```

Ejemplo (initialData):

```ts
const query = useQuery(["me"], {
  enabled: true,
  fetcher: () => api.get("/me"),
  initialData: { id: 0, name: "Guest" },
});
```

Defaults y overrides:

- Defaults globales en `createQueryClient`.
- Defaults por prefix en `queryDefaults`.
- `useQuery` overridea todo.

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

Opciones:

- `fetcher`: recibe `{ pageParam, signal }` y retorna una pagina.
- `initialPageParam`: param inicial.
- `getNextPageParam`: calcula el siguiente param.
- `getPreviousPageParam`: opcional.
- `enabled`: default `false`.
- `keepPreviousData`, `initialData`, `placeholderData`, `suspense`, `throwOnError`: igual que `useQuery`.
- `onSuccess`, `onError`, `onSettled`, `meta`.
- `staleTime`, `cacheTime`, `refetchInterval`, `tags`, `retry`, `abortOnNewFetch`.

Lista completa (con tipos):

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

Ejemplo:

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

Opciones:

- `mutationFn`: `(vars, { signal }) => TResult`.
- `mutationKey`: key opcional para defaults y cancel.
- `retry`: retry por mutacion.
- `abortOnNewMutation`: aborta la anterior con la misma key.
- `optimistic`: `{ key, update }` para updates optimistas.
- `updateCache`: `{ key, update }` al success.
- `invalidateKeys`, `invalidatePrefixes`, `invalidateTags`.
- `onSuccess`, `onError`, `onSettled`.

Lista completa (con tipos):

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

Ejemplo:

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
