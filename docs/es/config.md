# Configuracion

```ts
import { createQueryClient } from "yokai-query";

const client = createQueryClient({
  maxEntries: 200,
  refetchOnFocus: true,
  refetchOnOnline: false,
  retry: { attempts: 2, delay: 300 },
  staleWhileRevalidate: true,
  structuralSharing: true,
  selectMemoMaxEntries: 200,
  gcIntervalMs: 60_000,
  persistence: {
    mode: "indexeddb",
    storageKey: "__query_cache__",
    dbName: "__query_cache_db__",
    storeName: "cache",
    flushDebounceMs: 250,
  },
  devtools: {
    enabled: true,
    exposeToWindow: true,
    emitEvents: false,
    eventName: "__query_store__",
    overlay: { enabled: false, position: "bottom-right" },
  },
  multiTabSync: {
    enabled: false,
    channelName: "yokai-query",
  },
});
```

## Defaults por prefix

```ts
queryDefaults: [
  {
    prefix: "users",
    options: {
      staleTime: 60_000,
      retry: { attempts: 2 },
      keepPreviousData: true,
      suspense: false,
    },
  },
]
```

## Defaults de mutacion

```ts
mutationDefaults: [
  {
    key: "users",
    options: {
      retry: { attempts: 2 },
      abortOnNewMutation: true,
    },
  },
]
```

## Multi-tab sync

```ts
const client = createQueryClient({
  multiTabSync: { enabled: true, channelName: "yokai-query" },
});
```

## Config completo (tipos)

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
