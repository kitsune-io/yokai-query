# Cache

## staleTime vs cacheTime

- `staleTime`: cuanto tiempo la data es fresca.
- `cacheTime`: cuanto tiempo se guarda antes de GC.

## Dedupe in-flight

Si hay un fetch en curso para una key, las nuevas llamadas usan la misma promesa.

## stale-while-revalidate

Si `staleWhileRevalidate` esta activo, devolves data vieja y refrescas en background.

## LRU y GC

- LRU invalida entradas viejas cuando se supera `maxEntries`.
- `gc()` borra entradas expiradas.

```ts
useQueryStore.getState().gc();
```

## Invalidation

Las invalidaciones no borran la data: solo la marcan como stale (`fetchedAt = 0`)
para forzar un refetch manteniendo el UI estable.

## Persistencia

- `dehydrate()` serializa
- `hydrate()` restaura

`fetcher` y `meta` no se persisten.
