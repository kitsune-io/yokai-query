import { Metrics, QueryClientConfig } from "../types";

export const DEFAULT_STALE_TIME = 30_000;
export const DEFAULT_CACHE_TIME = 5 * 60_000;

export const createMetrics = (): Metrics => ({
  hits: 0,
  misses: 0,
  fetches: 0,
  backgroundFetches: 0,
  dedupes: 0,
  errors: 0,
  invalidations: 0,
  gcEvictions: 0,
  lruEvictions: 0,
  prefetched: 0,
  mutations: 0,
  optimisticApplied: 0,
  optimisticRolledBack: 0,
  aborts: 0,
  retries: 0,
});

export const defaultConfig: QueryClientConfig = {
  maxEntries: 200,
  persistence: {
    mode: "indexeddb",
    storageKey: "__query_cache__",
    dbName: "__query_cache_db__",
    storeName: "cache",
    flushDebounceMs: 250,
  },
  debug: false,
  refetchOnFocus: true,
  refetchOnReconnect: false,
  refetchOnOnline: false,
  retry: {
    attempts: 1,
    delay: 300,
    retryOn: () => true,
  },
  staleWhileRevalidate: false,
  selectMemoMaxEntries: 500,
  structuralSharing: true,
  gcIntervalMs: 60_000,
  suspense: false,
  throwOnError: false,
  queryDefaults: [],
  mutationDefaults: [],
  multiTabSync: {
    enabled: false,
    channelName: "__query_store_sync__",
  },
  devtools: {
    enabled: true,
    exposeToWindow: true,
    emitEvents: false,
    eventName: "__query_store__",
    overlay: {
      enabled: false,
      position: "bottom-right",
    },
  },
};
