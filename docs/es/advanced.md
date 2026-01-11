# Avanzado

## Suspense y error boundary

```ts
const client = createQueryClient({
  suspense: true,
  throwOnError: true,
});
```

## Multi-tab sync

```ts
createQueryClient({
  multiTabSync: { enabled: true, channelName: "yokai-query" },
});
```

## Devtools overlay

```ts
devtools: {
  enabled: true,
  exposeToWindow: true,
  overlay: { enabled: true, position: "bottom-right" },
}
```

## Manual cache

```ts
useQueryStore.getState().setQueryData(["users"], nextUsers);
```

## Cancelar por tags

```ts
useQueryStore.getState().cancelByTags(["users"]);
```

## Superficie de customizacion

Yokai Query es custom en varios niveles:

- Defaults globales via `createQueryClient(config)`.
- Defaults por prefix via `queryDefaults` y `mutationDefaults`.
- Overrides por hook en `useQuery` / `useInfiniteQuery` / `useMutation`.
- Overrides imperativos con `setConfig` y `setQueryData` en runtime.

## Helpers simples

Si queres menos knobs, Yokai Query trae helpers livianos.

### useSimpleQuery

```ts
import { useSimpleQuery } from "yokai-query";

const users = useSimpleQuery(["users"], () => api.get("/users"));
```

Con onSettled:

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

Podes pasar cualquier `UseQueryOptions` excepto `fetcher`.

### useSimpleMutation

```ts
import { useSimpleMutation } from "yokai-query";

const createUser = useSimpleMutation((payload: { name: string }) =>
  api.post("/users", payload)
);
```

Con onSettled:

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

Acepta las mismas opciones que `useMutation` (sin `mutationFn`).

### useSimpleInfiniteQuery

```ts
import { useSimpleInfiniteQuery } from "yokai-query";

const feed = useSimpleInfiniteQuery(
  ["feed"],
  ({ pageParam }) => api.get(`/feed?cursor=${pageParam ?? 0}`),
  { initialPageParam: 0, getNextPageParam: (last) => last.nextCursor }
);
```

Con onSettled:

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

Es un alias fino de `createQueryClient()` con defaults estandar.

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

Usa `better-auth` (incluido en `yokai-query`) y default a `window.location.origin + "/api/auth"`.

## Versionado de cache

Para invalidar cache persistido entre deploys:

```ts
import { createCacheVersionGuard } from "yokai-query";

const guard = createCacheVersionGuard({
  version: "2025-01-01",
  storage: "local",
  channelName: "yokai-cache",
});
```

## Observabilidad

Escucha eventos de devtools (requiere `devtools.emitEvents`):

```ts
import { createStoreEventReporter } from "yokai-query";

const stop = createStoreEventReporter({
  onEvent: (event) => console.log(event.type, event.payload),
});
```

Tambien podes envolver fetchers para tracing:

```ts
import { wrapFetcher } from "yokai-query";

const fetcher = wrapFetcher(
  () => api.get("/users"),
  { onSettled: (trace) => console.log(trace.duration) },
  { label: "users" }
);
```

## Prefetch scheduler

Queuea prefetch con presupuesto:

```ts
import { createPrefetchScheduler } from "yokai-query";

const scheduler = createPrefetchScheduler({ concurrency: 2, delayMs: 100 });
scheduler.schedule(["users"], { fetcher: () => api.get("/users") });
```

## Rate limit en prefetch

```ts
const scheduler = createPrefetchScheduler({
  concurrency: 2,
  maxPerSecond: 4,
});
```

## Cola offline de mutations

Encola mutations offline y flushea al reconectar:

```ts
import { createOfflineMutationQueue } from "yokai-query";

const queue = createOfflineMutationQueue({ autoFlush: true });

queue.enqueue("create-user", { name: "Ada" }, (vars) =>
  api.post("/users", vars)
);
```

## Exportar/importar cache

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

## Cliente API simple

Si queres un cliente minimo con auth + retry + hooks:

```ts
import { createApiClient } from "yokai-query";

const client = createApiClient({
  baseURL: "/api",
  defaultRetry: { attempts: 2, delay: 200 },
  retryRules: [{ prefix: "/users", retry: { attempts: 3 } }],
  plugins: [{ onError: (err) => console.warn(err) }],
});
```
