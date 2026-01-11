import { useQueryStore } from "./client";
import { QueryEntry, QueryKey } from "../types";
import { hashKey } from "../utils/keys";

export type CacheSnapshot = {
  version: number;
  createdAt: number;
  entries: Record<string, Omit<QueryEntry, "fetcher">>;
};

export const exportCacheSnapshot = (): CacheSnapshot => {
  const state = useQueryStore.getState();
  const entries: Record<string, Omit<QueryEntry, "fetcher">> = {};
  Object.entries(state.queries).forEach(([key, entry]) => {
    const { fetcher: _f, error: _e, ...rest } = entry;
    entries[key] = rest;
  });
  return { version: 1, createdAt: Date.now(), entries };
};

export const importCacheSnapshot = (snapshot: CacheSnapshot) => {
  if (!snapshot?.entries) return;
  const next = Object.fromEntries(
    Object.entries(snapshot.entries).map(([k, entry]) => {
      return [
        k,
        {
          ...entry,
          staleTime: entry.staleTime,
          cacheTime: entry.cacheTime,
        } as QueryEntry,
      ];
    })
  );
  useQueryStore.setState({ queries: next });
};

export const setSnapshotEntry = (key: QueryKey, entry: QueryEntry) => {
  const hashedKey = hashKey(key);
  useQueryStore.setState((state) => ({
    queries: { ...state.queries, [hashedKey]: entry },
  }));
};
