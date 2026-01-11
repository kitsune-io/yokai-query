# Mutations

## Basico

```ts
const { mutate } = useMutation({
  mutationFn: (payload) => api.post("/users", payload),
  invalidateKeys: [["users"]],
});
```

Nota:

- `invalidate*` conserva la data y la marca stale.

## Optimistic

```ts
const { mutate } = useMutation({
  mutationKey: ["todos"],
  mutationFn: (todo) => api.post("/todos", todo),
  optimistic: [
    { key: ["todos"], update: (prev) => [...(prev ?? []), todo] },
  ],
  invalidateKeys: [["todos"]],
});
```

## Cancel

```ts
const { cancel } = useMutation({
  mutationKey: ["todos"],
  mutationFn: (todo) => api.post("/todos", todo),
});
```
