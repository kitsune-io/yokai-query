export type QueryKey = string | readonly unknown[];
export type QueryKeyHash = string;

export type QueryFetcher<T> =
  | (() => Promise<T>)
  | ((ctx: { signal?: AbortSignal }) => Promise<T>);

export type RetryOptions = {
  attempts?: number;
  delay?: number | ((attemptIndex: number) => number);
  retryOn?: (error: unknown, attemptIndex: number) => boolean;
};

export type QueryEntry<T = unknown> = {
  data?: T;
  error?: unknown;
  meta?: unknown;
  keyString?: string;
  fetchedAt?: number;
  accessedAt?: number;
  staleTime: number;
  cacheTime: number;
  refetchInterval?: number;
  fetcher?: QueryFetcher<T>;
  tags?: string[];
  retry?: RetryOptions;
  lastAbortAt?: number;
};

export type FetchQueryOptions<T> = {
  fetcher: QueryFetcher<T>;
  staleTime?: number;
  cacheTime?: number;
  background?: boolean;
  skipStaleWhileRevalidate?: boolean;
  meta?: unknown;
  refetchInterval?: number;
  tags?: string[];
  retry?: RetryOptions;
  abortOnNewFetch?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
  onSettled?: (data: T | undefined, error: unknown | undefined) => void;
};

export type InfiniteData<TPage, TParam> = {
  pages: TPage[];
  pageParams: TParam[];
};

export type FetchInfiniteQueryOptions<TPage, TParam> = {
  fetcher: (ctx: { pageParam: TParam; signal?: AbortSignal }) => Promise<TPage>;
  pageParam: TParam;
  direction?: "forward" | "backward" | "init";
  staleTime?: number;
  cacheTime?: number;
  background?: boolean;
  meta?: unknown;
  refetchInterval?: number;
  tags?: string[];
  retry?: RetryOptions;
  abortOnNewFetch?: boolean;
  onSuccess?: (data: InfiniteData<TPage, TParam>) => void;
  onError?: (error: unknown) => void;
  onSettled?: (
    data: InfiniteData<TPage, TParam> | undefined,
    error: unknown | undefined
  ) => void;
};

export type MutateOptions<TVars, TResult> = {
  mutationFn: (vars: TVars, ctx?: { signal?: AbortSignal }) => Promise<TResult>;
  mutationKey?: QueryKey;
  retry?: RetryOptions;
  abortOnNewMutation?: boolean;
  variables: TVars;
  optimistic?: Array<{
    key: QueryKey;
    update: (prev: unknown | undefined) => unknown;
  }>;
  updateCache?: Array<{
    key: QueryKey;
    update: (prev: unknown | undefined, result: TResult) => unknown;
  }>;
  invalidateKeys?: QueryKey[];
  invalidatePrefixes?: string[];
  invalidateTags?: string[];
  onSuccess?: (result: TResult, vars: TVars) => void;
  onError?: (error: unknown, vars: TVars) => void;
};

export type MutationState<TVars = unknown, TResult = unknown> = {
  status: "idle" | "loading" | "success" | "error";
  data?: TResult;
  error?: unknown;
  variables?: TVars;
  promise?: Promise<TResult>;
  updatedAt?: number;
};

export type Metrics = {
  hits: number;
  misses: number;
  fetches: number;
  backgroundFetches: number;
  dedupes: number;
  errors: number;
  invalidations: number;
  gcEvictions: number;
  lruEvictions: number;
  prefetched: number;
  mutations: number;
  optimisticApplied: number;
  optimisticRolledBack: number;
  aborts: number;
  retries: number;
};

export type PersistenceMode = "none" | "session" | "indexeddb";

export type MultiTabSyncConfig = {
  enabled: boolean;
  channelName: string;
};

export type QueryDefaultOptions = Partial<
  Omit<FetchQueryOptions<unknown>, "fetcher">
> & {
  suspense?: boolean;
  throwOnError?: boolean;
  keepPreviousData?: boolean;
  initialData?: unknown;
  placeholderData?: unknown;
};

export type QueryDefaults = {
  prefix: string;
  options: QueryDefaultOptions;
};

export type MutationDefaultOptions = Partial<
  Omit<MutateOptions<unknown, unknown>, "mutationFn" | "variables">
>;

export type MutationDefaults = {
  key: string;
  options: MutationDefaultOptions;
};

export type QueryClientConfig = {
  maxEntries: number;
  persistence: {
    mode: PersistenceMode;
    storageKey: string;
    dbName: string;
    storeName: string;
    flushDebounceMs: number;
  };
  debug: boolean;
  refetchOnFocus: boolean;
  refetchOnReconnect?: boolean;
  refetchOnOnline?: boolean;
  retry: RetryOptions;
  staleWhileRevalidate?: boolean;
  selectMemoMaxEntries?: number;
  structuralSharing?: boolean;
  gcIntervalMs?: number;
  suspense?: boolean;
  throwOnError?: boolean;
  queryDefaults?: QueryDefaults[];
  mutationDefaults?: MutationDefaults[];
  multiTabSync: MultiTabSyncConfig;
  devtools: {
    enabled: boolean;
    exposeToWindow: boolean;
    emitEvents: boolean;
    eventName: string;
    overlay?: {
      enabled: boolean;
      position:
        | "bottom-right"
        | "bottom-left"
        | "top-right"
        | "top-left";
    };
  };
};

export type QueryClientConfigUpdate = Omit<
  Partial<QueryClientConfig>,
  "multiTabSync"
> & {
  multiTabSync?: Partial<MultiTabSyncConfig>;
};

export type QueryStore = {
  config: QueryClientConfig;
  queries: Record<QueryKeyHash, QueryEntry>;
  inFlight: Record<QueryKeyHash, Promise<unknown> | undefined>;
  mutations: Record<QueryKeyHash, MutationState>;
  metrics: Metrics;
  dehydrate: () => Record<QueryKeyHash, Omit<QueryEntry, "fetcher">>;
  hydrate: (data: Record<QueryKeyHash, Omit<QueryEntry, "fetcher">>) => void;
  fetchQuery: <T>(key: QueryKey, options: FetchQueryOptions<T>) => Promise<T>;
  fetchInfiniteQuery: <TPage, TParam>(
    key: QueryKey,
    options: FetchInfiniteQueryOptions<TPage, TParam>
  ) => Promise<InfiniteData<TPage, TParam>>;
  refetchInfiniteQuery: <TPage, TParam>(
    key: QueryKey
  ) => Promise<InfiniteData<TPage, TParam> | undefined>;
  prefetchQuery: <T>(key: QueryKey, options: FetchQueryOptions<T>) => Promise<void>;
  invalidate: (key: QueryKey) => void;
  invalidateByPrefix: (prefix: string) => void;
  invalidateTags: (tags: string[] | string) => void;
  cancelByTags: (tags: string[] | string) => void;
  abort: (key: QueryKey) => void;
  cancelMutation: (key: QueryKey) => void;
  addObserver: (key: QueryKey) => void;
  removeObserver: (key: QueryKey) => void;
  getObserversCount: (key: QueryKey) => number;
  getInFlightDirection: (
    key: QueryKey
  ) => "forward" | "backward" | "init" | undefined;
  batch: (fn: () => void) => void;
  gc: () => void;
  mutate: <TVars, TResult>(opts: MutateOptions<TVars, TResult>) => Promise<TResult>;
  getMutation: (key: QueryKey) => MutationState | undefined;
  setQueryData: <T>(
    key: QueryKey,
    data: T,
    options?: {
      staleTime?: number;
      cacheTime?: number;
      refetchInterval?: number;
      tags?: string[];
      retry?: RetryOptions;
      meta?: unknown;
      fetchedAt?: number;
    }
  ) => void;
  setDebug: (debug: boolean) => void;
  setConfig: (partial: QueryClientConfigUpdate) => void;
  clear: () => void;
  getSnapshot: () => {
    config: QueryClientConfig;
    metrics: Metrics;
    queryKeys: string[];
    inFlightKeys: string[];
    mutationKeys: string[];
  };
};
