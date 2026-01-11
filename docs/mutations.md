# Mutations

Mutations run through the store and can update cache optimistically.

## Basic usage

```ts
const { mutate } = useMutation({
  mutationFn: (payload) => api.post("/users", payload),
  invalidateKeys: [["users"]],
});
```

## Options

- `mutationFn`: async function `(vars, { signal }) => TResult`.
- `mutationKey`: optional key for defaults and cancellation.
- `retry`: per-mutation retry config.
- `abortOnNewMutation`: abort previous mutation with the same key.
- `optimistic`: array of `{ key, update }` applied before request.
- `updateCache`: array of `{ key, update }` applied on success.
- `invalidateKeys`, `invalidatePrefixes`, `invalidateTags`.
- `onSuccess`, `onError`, `onSettled`.

Note:

- Invalidation keeps cached data and marks it stale instead of removing it.

## Optimistic updates

Optimistic updates apply immediately and rollback on error:

```ts
const { mutate } = useMutation({
  mutationKey: ["todos"],
  mutationFn: (todo) => api.post("/todos", todo),
  optimistic: [
    { key: ["todos"], update: (prev) => [...(prev ?? []), todo] },
  ],
  updateCache: [
    {
      key: ["todo", todo.id],
      update: () => todo,
    },
  ],
  invalidateKeys: [["todos"]],
});
```

## Mutation state

The store tracks mutation state by `mutationKey`:

```ts
const state = useQueryStore.getState().getMutation(["todos"]);
```

`useMutation` also exposes `status` (`idle`, `loading`, `success`, `error`).

## Cancellation

- `abortOnNewMutation`: aborts a previous mutation with the same key.
- `cancel()` in `useMutation` calls `cancelMutation(mutationKey)`.
