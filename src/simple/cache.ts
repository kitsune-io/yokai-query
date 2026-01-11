import { QueryKey } from "../types";
import { hashKey } from "../utils/keys";
import { useQueryStore } from "../store";

export type SetListCacheOptions<T> = {
  prepend?: boolean;
  idKey?: keyof T;
  unique?: boolean;
  setOptions?: {
    staleTime?: number;
    cacheTime?: number;
    refetchInterval?: number;
    tags?: string[];
    meta?: unknown;
    fetchedAt?: number;
  };
};

export function setListCache<T>(
  key: QueryKey,
  item: T,
  options?: SetListCacheOptions<T>
) {
  const state = useQueryStore.getState();
  const hashedKey = hashKey(key);
  const prev = state.queries[hashedKey]?.data;
  const list = Array.isArray(prev) ? (prev as T[]) : [];
  const next = options?.prepend ? [item, ...list] : [...list, item];

  let deduped = next;
  if (options?.idKey && options.unique !== false) {
    const seen = new Set<unknown>();
    deduped = next.filter((entry) => {
      const id = entry?.[options.idKey as keyof T];
      if (id === undefined || id === null) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  state.setQueryData(key, deduped, options?.setOptions);
}
