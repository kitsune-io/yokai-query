# API

## Exports

- `api`
- `createQueryClient`
- `useQueryStore`
- `useQuery`, `useInfiniteQuery`, `useMutation`
- Auth: `setAuthToken`, `clearAuthToken`, `createBetterAuthBridge`

## Store API (imperativo)

```ts
const store = useQueryStore.getState();

await store.fetchQuery(["users"], {
  fetcher: () => api.get("/users"),
  staleTime: 30_000,
});

store.setQueryData(["users"], [{ id: 1, name: "Ada" }]);
store.invalidateTags(["users"]);
```

Batch:

```ts
store.batch(() => {
  store.invalidate(["users"]);
  store.invalidateByPrefix("posts");
});
```

Notas:

- `invalidate*` conserva la data en cache y la marca stale.
