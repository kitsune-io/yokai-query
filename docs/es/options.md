# Opciones

Fuente unica de todos los puntos de customizacion.

## Config global (createQueryClient)

- `maxEntries: number`
- `persistence: { mode: "none" | "session" | "indexeddb"; storageKey: string; dbName: string; storeName: string; flushDebounceMs: number }`
- `debug: boolean`
- `refetchOnFocus: boolean`
- `refetchOnReconnect?: boolean`
- `refetchOnOnline?: boolean`
- `retry: { attempts?: number; delay?: number | ((attemptIndex: number) => number); retryOn?: (error: unknown, attemptIndex: number) => boolean }`
- `staleWhileRevalidate?: boolean`
- `selectMemoMaxEntries?: number`
- `structuralSharing?: boolean`
- `gcIntervalMs?: number`
- `suspense?: boolean`
- `throwOnError?: boolean`
- `queryDefaults?: Array<{ prefix: string; options: QueryDefaultOptions }>`
- `mutationDefaults?: Array<{ key: string; options: MutationDefaultOptions }>`
- `multiTabSync: { enabled: boolean; channelName: string }`
- `devtools: { enabled: boolean; exposeToWindow: boolean; emitEvents: boolean; eventName: string; overlay?: { enabled: boolean; position: "bottom-right" | "bottom-left" | "top-right" | "top-left" } }`

## Opciones de query (useQuery)

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

## Opciones infinite (useInfiniteQuery)

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

## Opciones de mutation (useMutation)

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
