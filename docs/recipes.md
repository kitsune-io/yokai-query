# Recipes

A collection of practical patterns for Yokai Query.

## 1) Prefetch on hover

```ts
function useUserPrefetch(id: string) {
  return () =>
    useQueryStore.getState().prefetchQuery(["user", id], {
      fetcher: () => api.get(`/users/${id}`),
      staleTime: 60_000,
    });
}
```

## 2) Pagination with cursor

```ts
const feed = useInfiniteQuery(["feed"], {
  enabled: true,
  initialPageParam: 0,
  fetcher: ({ pageParam }) => api.get(`/feed?page=${pageParam}`),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});

const loadMore = () => feed.fetchNextPage();
```

## 3) Optimistic toggle

```ts
const { mutate } = useMutation({
  mutationKey: ["todos"],
  mutationFn: (todo) => api.post("/todos/toggle", todo),
  optimistic: [
    {
      key: ["todos"],
      update: (prev) =>
        (prev ?? []).map((t: any) =>
          t.id === todo.id ? { ...t, done: !t.done } : t
        ),
    },
  ],
  invalidateKeys: [["todos"]],
});
```

## 4) Manual cache hydrate after login

```ts
function onLoginSuccess(user: any) {
  useQueryStore.getState().setQueryData(["me"], user, {
    staleTime: 5 * 60_000,
  });
}
```

## 5) Custom retry by error

```ts
const query = useQuery(["users"], {
  enabled: true,
  fetcher: () => api.get("/users"),
  retry: {
    attempts: 3,
    delay: (attempt) => attempt * 200,
    retryOn: (err) => !String(err).includes("401"),
  },
});
```

## 6) Cancel by tags

```ts
useQueryStore.getState().cancelByTags(["users"]);
```

## 7) Background refetch

```ts
const query = useQuery(["stats"], {
  enabled: true,
  fetcher: () => api.get("/stats"),
  staleTime: 10_000,
  background: true,
});
```
