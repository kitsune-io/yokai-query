# Getting Started

## Create a client

```ts
import { createQueryClient } from "yokai-query";

const queryClient = createQueryClient({
  refetchOnFocus: true,
  staleWhileRevalidate: true,
});
```

For typical client-side use, you can use the default singleton:

```ts
import { useQueryStore } from "yokai-query";
```

## Basic query

```ts
import { useQuery, api } from "yokai-query";

const { data, isLoading, isFetching, error } = useQuery(["users"], {
  enabled: true,
  fetcher: () => api.get("/users"),
  staleTime: 30_000,
  keepPreviousData: true,
});
```

## Select and placeholder

```ts
const usersCount = useQuery(["users"], {
  enabled: true,
  fetcher: () => api.get("/users"),
  select: (users) => users.length,
  placeholderData: (prev) => prev ?? 0,
});
```

## Infinite query

```ts
import { useInfiniteQuery } from "yokai-query";

const feed = useInfiniteQuery(["feed"], {
  enabled: true,
  initialPageParam: 0,
  fetcher: ({ pageParam }) => api.get(`/feed?page=${pageParam}`),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

## Mutation

```ts
import { useMutation } from "yokai-query";

const { mutate, status } = useMutation({
  mutationKey: ["users"],
  mutationFn: (payload) => api.post("/users", payload),
  invalidateKeys: [["users"]],
});
```

## Manual cache update

```ts
useQueryStore.getState().setQueryData(["users"], [{ id: 1, name: "Ada" }]);
```

## Persistence

```ts
const client = createQueryClient({
  persistence: { mode: "indexeddb" },
});
```

## SSR

Create one client per request and pass dehydrated state to the client.

```ts
const client = createQueryClient();
// server
const state = client.getState().dehydrate();

// client
useQueryStore.getState().hydrate(state);
```

## Next steps

- Recipes: `docs/recipes.md`
