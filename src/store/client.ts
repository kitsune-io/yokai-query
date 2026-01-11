
import { create } from "zustand";
import {
  FetchInfiniteQueryOptions,
  FetchQueryOptions,
  InfiniteData,
  MutationDefaultOptions,
  MutateOptions,
  QueryClientConfig,
  QueryClientConfigUpdate,
  QueryDefaultOptions,
  QueryEntry,
  QueryFetcher,
  QueryKey,
  QueryKeyHash,
  QueryStore,
  Metrics,
} from "../types";
import {
  DEFAULT_CACHE_TIME,
  DEFAULT_STALE_TIME,
  createMetrics,
  defaultConfig,
} from "./defaults";
import { hashKey, keyToString } from "../utils/keys";
import { replaceEqualDeep } from "../utils/equality";
import { isAbortError, runWithRetry } from "../utils/retry";
import { idbGet, idbSet } from "../storage/idb";

export function createQueryClient(userConfig?: QueryClientConfigUpdate) {
  const { multiTabSync: multiTabSyncOverride, ...userOverrides } =
    userConfig ?? {};
  const cfg: QueryClientConfig = {
    ...defaultConfig,
    ...userOverrides,
    persistence: {
      ...defaultConfig.persistence,
      ...(userOverrides.persistence ?? {}),
    },
    retry: {
      ...defaultConfig.retry,
      ...(userOverrides.retry ?? {}),
    },
    multiTabSync: {
      ...defaultConfig.multiTabSync,
      ...(multiTabSyncOverride ?? {}),
    },
    devtools: {
      ...defaultConfig.devtools,
      ...(userOverrides.devtools ?? {}),
    },
  };

  const fetchers = new Map<QueryKeyHash, QueryFetcher<unknown>>();
  const infiniteFetchers = new Map<
    QueryKeyHash,
    (ctx: { pageParam: unknown; signal?: AbortSignal }) => Promise<unknown>
  >();
  const keyMap = new Map<QueryKeyHash, QueryKey>();
  const resolveKey = (hashedKey: QueryKeyHash): QueryKey =>
    keyMap.get(hashedKey) ?? hashedKey;

  const pollers = new Map<QueryKeyHash, { timer: number; interval: number }>();

  const selectMemo = new Map<
    QueryKeyHash,
    { selectRef: Function; inputRef: unknown; output: unknown }
  >();

  const tagIndex = new Map<string, Set<QueryKeyHash>>();

  const aborters = new Map<QueryKeyHash, AbortController>();
  const mutationAborters = new Map<QueryKeyHash, AbortController>();
  const observers = new Map<QueryKeyHash, number>();
  const inFlightMeta = new Map<
    QueryKeyHash,
    { direction?: "forward" | "backward" | "init" }
  >();

  let batchDepth = 0;
  let pendingQueries: Record<QueryKeyHash, QueryEntry> | null = null;
  let flushRequested = false;

  let flushTimer: number | null = null;

  const isBrowser = typeof window !== "undefined";
  const instanceId = Math.random().toString(36).slice(2);
  const channel =
    isBrowser &&
    cfg.multiTabSync.enabled &&
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(cfg.multiTabSync.channelName)
      : null;
  let suppressBroadcast = false;
  const broadcast = (message: { type: string; payload?: unknown }) => {
    if (!channel || suppressBroadcast) return;
    channel.postMessage({ ...message, sourceId: instanceId });
  };
  const getQueryDefaultOptions = (
    key: QueryKey,
    config: QueryClientConfig
  ): QueryDefaultOptions => {
    const keyStr = keyToString(key);
    const defaults = config.queryDefaults ?? [];
    let merged: QueryDefaultOptions = {};
    defaults.forEach((entry) => {
      if (keyStr.startsWith(entry.prefix)) {
        merged = { ...merged, ...entry.options };
      }
    });
    return merged;
  };
  const getMutationDefaultOptions = (
    key: QueryKey | undefined,
    config: QueryClientConfig
  ): MutationDefaultOptions => {
    if (!key) return {};
    const keyStr = keyToString(key);
    const defaults = config.mutationDefaults ?? [];
    let merged: MutationDefaultOptions = {};
    defaults.forEach((entry) => {
      if (keyStr.startsWith(entry.key)) {
        merged = { ...merged, ...entry.options };
      }
    });
    return merged;
  };
  const applyStructuralSharing = <T>(prev: T | undefined, next: T): T => {
    if (!cfg.structuralSharing) return next;
    if (prev === undefined) return next;
    if (next === undefined) return next;
    return replaceEqualDeep(prev, next);
  };

  const store = create<QueryStore>((set, get) => ({
    config: cfg,

    queries: {},
    inFlight: {},
    mutations: {},

    metrics: createMetrics(),

    dehydrate() {
      return serializeQueries(get().queries);
    },

    hydrate(data) {
      set({
        queries: Object.fromEntries(
          Object.entries(data).map(([k, q]) => [
            k,
            {
              ...q,
              staleTime: q.staleTime ?? DEFAULT_STALE_TIME,
              cacheTime: q.cacheTime ?? DEFAULT_CACHE_TIME,
              tags: q.tags ?? [],
              retry: q.retry,
              keyString: q.keyString ?? k,
            } satisfies QueryEntry,
          ])
        ),
      });

      tagIndex.clear();
      selectMemo.clear();
      Object.entries(get().queries).forEach(([k, q]) => {
        keyMap.set(k, k);
        (q.tags ?? []).forEach((t) => {
          if (!tagIndex.has(t)) tagIndex.set(t, new Set());
          tagIndex.get(t)!.add(k);
        });
      });

      if (isBrowser) {
        Object.entries(get().queries).forEach(([k, q]) => {
          ensurePoller(k, q.refetchInterval);
        });
      }

      devtoolsEmit("hydrate", { keys: Object.keys(get().queries) });
    },

    async fetchQuery<T>(key: QueryKey, options: FetchQueryOptions<T>) {
      const hashedKey = hashKey(key);
      keyMap.set(hashedKey, key);
      const defaults = getQueryDefaultOptions(key, get().config);
      const {
        suspense: _s,
        throwOnError: _t,
        keepPreviousData: _k,
        initialData: _i,
        placeholderData: _p,
        ...fetchDefaults
      } = defaults;
      const mergedOptions: FetchQueryOptions<T> = {
        ...fetchDefaults,
        ...options,
        retry: options.retry ?? defaults.retry,
        tags: options.tags ?? defaults.tags,
        refetchInterval: options.refetchInterval ?? defaults.refetchInterval,
        abortOnNewFetch: options.abortOnNewFetch ?? defaults.abortOnNewFetch,
        background: options.background ?? defaults.background,
        skipStaleWhileRevalidate: options.skipStaleWhileRevalidate ?? false,
        staleTime: options.staleTime ?? defaults.staleTime,
        cacheTime: options.cacheTime ?? defaults.cacheTime,
      };
      const {
        fetcher,
        staleTime = DEFAULT_STALE_TIME,
        cacheTime = DEFAULT_CACHE_TIME,
        background = false,
        skipStaleWhileRevalidate = false,
        meta,
        refetchInterval,
        tags,
        retry,
        abortOnNewFetch = true,
        onSuccess,
        onError,
        onSettled,
      } = mergedOptions;

      fetchers.set(hashedKey, fetcher as QueryFetcher<unknown>);

      setEntry(hashedKey, {
        staleTime,
        cacheTime,
        fetcher,
        refetchInterval,
        tags: tags ?? get().queries[hashedKey]?.tags ?? [],
        retry: retry ?? get().queries[hashedKey]?.retry,
        meta: meta ?? get().queries[hashedKey]?.meta,
        keyString: get().queries[hashedKey]?.keyString ?? keyToString(key),
      });

      syncTagsIndex(hashedKey, tags);

      ensurePoller(hashedKey, refetchInterval);

      const state = get();
      const entry = state.queries[hashedKey];
      const now = Date.now();

      const isStale =
        !entry?.fetchedAt ||
        now - entry.fetchedAt > (entry?.staleTime ?? staleTime);

      if (entry?.data !== undefined && !isStale) {
        bump({ hits: 1 });
        touch(hashedKey);
        debugLog("hit", hashedKey);
        devtoolsEmit("hit", { key: hashedKey });
        return entry.data as T;
      }

      if (state.inFlight[hashedKey]) {
        bump({ dedupes: 1 });
        debugLog("dedupe", hashedKey);
        devtoolsEmit("dedupe", { key: hashedKey });
        return state.inFlight[hashedKey] as Promise<T>;
      }

      const shouldBackground =
        entry?.data !== undefined &&
        isStale &&
        !skipStaleWhileRevalidate &&
        (background || get().config.staleWhileRevalidate);
      if (shouldBackground) {
        if (get().inFlight[hashedKey]) {
          bump({ dedupes: 1, backgroundFetches: 1 });
          debugLog("dedupe", hashedKey);
          devtoolsEmit("dedupe", { key: hashedKey });
          return entry.data as T;
        }
        bump({ hits: 1, backgroundFetches: 1 });
        debugLog("stale-hit+bg", hashedKey);
        devtoolsEmit("stale-hit+bg", { key: hashedKey });

        const originalKey = resolveKey(hashedKey);
        get()
          .fetchQuery(originalKey, {
            ...mergedOptions,
            background: false,
            skipStaleWhileRevalidate: true,
          })
          .catch(() => {});
        touch(hashedKey);
        return entry.data as T;
      }

      if (abortOnNewFetch) {
        get().abort(hashedKey);
      }

      bump({ misses: 1, fetches: 1 });
      debugLog("miss(fetch)", hashedKey);
      devtoolsEmit("miss(fetch)", { key: hashedKey });

      const controller = isBrowser ? new AbortController() : undefined;
      if (controller) aborters.set(hashedKey, controller);

      const promise = (async () => {
        try {
          const data = await runWithRetry<T>(
            async (attemptIndex) => {
              if (controller?.signal?.aborted) {
                throw (
                  controller.signal.reason ??
                  new DOMException("Aborted", "AbortError")
                );
              }

              const f = fetcher as any;
              const maybePromise =
                typeof f === "function" && f.length >= 1
                  ? (f({ signal: controller?.signal }) as Promise<T>)
                  : (f() as Promise<T>);

              return await maybePromise;
            },
            retry ?? entry?.retry ?? get().config.retry,
            (n) => bump({ retries: n }),
            (attempt, attempts) => devtoolsEmit("retry", { attempt, attempts })
          );

          setEntry(hashedKey, {
            data,
            error: undefined,
            fetchedAt: Date.now(),
            accessedAt: Date.now(),
            staleTime,
            cacheTime,
            refetchInterval,
            fetcher,
            tags: tags ?? get().queries[hashedKey]?.tags ?? [],
            retry: retry ?? get().queries[hashedKey]?.retry,
            meta: meta ?? get().queries[hashedKey]?.meta,
            keyString: get().queries[hashedKey]?.keyString ?? keyToString(key),
          });

          evictLRUIfNeeded();

          scheduleFlush();
          devtoolsEmit("fetch:success", { key: hashedKey });
          onSuccess?.(data);
          onSettled?.(data, undefined);
          return data;
        } catch (error) {
          if (isAbortError(error)) {
            bump({ aborts: 1 });
            setEntry(hashedKey, {
              error,
              fetchedAt: Date.now(),
              fetcher,
              lastAbortAt: Date.now(),
              meta: meta ?? get().queries[hashedKey]?.meta,
              keyString:
                get().queries[hashedKey]?.keyString ?? keyToString(key),
            });
            scheduleFlush();
            devtoolsEmit("fetch:abort", { key: hashedKey });
            throw error;
          }

          bump({ errors: 1 });
          setEntry(hashedKey, {
            error,
            fetchedAt: Date.now(),
            fetcher,
            meta: meta ?? get().queries[hashedKey]?.meta,
            keyString: get().queries[hashedKey]?.keyString ?? keyToString(key),
          });
          scheduleFlush();
          devtoolsEmit("fetch:error", { key: hashedKey });
          onError?.(error);
          onSettled?.(undefined, error);
          throw error;
        } finally {
          set((s) => {
            const next = { ...s.inFlight };
            delete next[hashedKey];
            return { inFlight: next };
          });

          if (controller && aborters.get(hashedKey) === controller) {
            aborters.delete(hashedKey);
          }
        }
      })();

      set((s) => ({ inFlight: { ...s.inFlight, [hashedKey]: promise } }));
      return promise;
    },

    async fetchInfiniteQuery<TPage, TParam>(
      key: QueryKey,
      options: FetchInfiniteQueryOptions<TPage, TParam>
    ) {
      const hashedKey = hashKey(key);
      keyMap.set(hashedKey, key);
      const defaults = getQueryDefaultOptions(key, get().config);
      const {
        suspense: _s,
        throwOnError: _t,
        keepPreviousData: _k,
        initialData: _i,
        placeholderData: _p,
        ...fetchDefaults
      } = defaults;
      const mergedOptions: FetchInfiniteQueryOptions<TPage, TParam> = {
        ...fetchDefaults,
        ...options,
        retry: options.retry ?? defaults.retry,
        tags: options.tags ?? defaults.tags,
        refetchInterval: options.refetchInterval ?? defaults.refetchInterval,
        abortOnNewFetch: options.abortOnNewFetch ?? defaults.abortOnNewFetch,
        background: options.background ?? defaults.background,
        staleTime: options.staleTime ?? defaults.staleTime,
        cacheTime: options.cacheTime ?? defaults.cacheTime,
      };

      const {
        fetcher,
        pageParam,
        direction = "init",
        staleTime = DEFAULT_STALE_TIME,
        cacheTime = DEFAULT_CACHE_TIME,
        background = false,
        meta,
        refetchInterval,
        tags,
        retry,
        abortOnNewFetch = true,
        onSuccess,
        onError,
        onSettled,
      } = mergedOptions;

      infiniteFetchers.set(
        hashedKey,
        fetcher as (ctx: { pageParam: unknown; signal?: AbortSignal }) =>
          Promise<unknown>
      );

      setEntry(hashedKey, {
        staleTime,
        cacheTime,
        refetchInterval,
        tags: tags ?? get().queries[hashedKey]?.tags ?? [],
        retry: retry ?? get().queries[hashedKey]?.retry,
        meta: meta ?? get().queries[hashedKey]?.meta,
        keyString: get().queries[hashedKey]?.keyString ?? keyToString(key),
      });

      syncTagsIndex(hashedKey, tags);
      ensurePoller(hashedKey, refetchInterval);

      const state = get();
      const entry = state.queries[hashedKey];
      const now = Date.now();
      const isStale =
        !entry?.fetchedAt ||
        now - entry.fetchedAt > (entry?.staleTime ?? staleTime);

      const current = entry?.data as
        | InfiniteData<TPage, TParam>
        | undefined;

      if (direction === "init" && current && !isStale && !background) {
        bump({ hits: 1 });
        touch(hashedKey);
        debugLog("hit", hashedKey);
        devtoolsEmit("hit", { key: hashedKey });
        return current;
      }

      if (state.inFlight[hashedKey]) {
        bump({ dedupes: 1 });
        debugLog("dedupe", hashedKey);
        devtoolsEmit("dedupe", { key: hashedKey });
        return state.inFlight[hashedKey] as Promise<
          InfiniteData<TPage, TParam>
        >;
      }

      if (
        direction === "init" &&
        current &&
        isStale &&
        (background || get().config.staleWhileRevalidate)
      ) {
        bump({ hits: 1, backgroundFetches: 1 });
        debugLog("stale-hit+bg", hashedKey);
        devtoolsEmit("stale-hit+bg", { key: hashedKey });
        const originalKey = resolveKey(hashedKey);
        get()
          .refetchInfiniteQuery<TPage, TParam>(originalKey)
          .catch(() => {});
        touch(hashedKey);
        return current;
      }

      if (abortOnNewFetch) {
        get().abort(hashedKey);
      }

      bump({ misses: 1, fetches: 1 });
      debugLog("miss(fetch)", hashedKey);
      devtoolsEmit("miss(fetch)", { key: hashedKey });

      const controller = isBrowser ? new AbortController() : undefined;
      if (controller) aborters.set(hashedKey, controller);
      inFlightMeta.set(hashedKey, { direction });

      const promise = (async () => {
        try {
          const page = await runWithRetry<TPage>(
            async () => {
              if (controller?.signal?.aborted) {
                throw (
                  controller.signal.reason ??
                  new DOMException("Aborted", "AbortError")
                );
              }
              return await fetcher({ pageParam, signal: controller?.signal });
            },
            retry ?? entry?.retry ?? get().config.retry,
            (n) => bump({ retries: n }),
            (attempt, attempts) => devtoolsEmit("retry", { attempt, attempts })
          );

          let next: InfiniteData<TPage, TParam>;
          if (!current) {
            next = { pages: [page], pageParams: [pageParam] };
          } else if (direction === "backward") {
            next = {
              pages: [page, ...current.pages],
              pageParams: [pageParam, ...current.pageParams],
            };
          } else {
            next = {
              pages: [...current.pages, page],
              pageParams: [...current.pageParams, pageParam],
            };
          }

          setEntry(hashedKey, {
            data: next,
            error: undefined,
            fetchedAt: Date.now(),
            accessedAt: Date.now(),
            staleTime,
            cacheTime,
            refetchInterval,
            tags: tags ?? get().queries[hashedKey]?.tags ?? [],
            retry: retry ?? get().queries[hashedKey]?.retry,
            meta: meta ?? get().queries[hashedKey]?.meta,
            keyString: get().queries[hashedKey]?.keyString ?? keyToString(key),
          });

          evictLRUIfNeeded();
          scheduleFlush();
          devtoolsEmit("fetch:success", { key: hashedKey });
          onSuccess?.(next);
          onSettled?.(next, undefined);
          return next;
        } catch (error) {
          if (isAbortError(error)) {
            bump({ aborts: 1 });
            setEntry(hashedKey, {
              error,
              fetchedAt: Date.now(),
              lastAbortAt: Date.now(),
              meta: meta ?? get().queries[hashedKey]?.meta,
              keyString:
                get().queries[hashedKey]?.keyString ?? keyToString(key),
            });
            scheduleFlush();
            devtoolsEmit("fetch:abort", { key: hashedKey });
            throw error;
          }

          bump({ errors: 1 });
          setEntry(hashedKey, {
            error,
            fetchedAt: Date.now(),
            meta: meta ?? get().queries[hashedKey]?.meta,
            keyString: get().queries[hashedKey]?.keyString ?? keyToString(key),
          });
          scheduleFlush();
          devtoolsEmit("fetch:error", { key: hashedKey });
          onError?.(error);
          onSettled?.(undefined, error);
          throw error;
        } finally {
          set((s) => {
            const next = { ...s.inFlight };
            delete next[hashedKey];
            return { inFlight: next };
          });
          inFlightMeta.delete(hashedKey);
          if (controller && aborters.get(hashedKey) === controller) {
            aborters.delete(hashedKey);
          }
        }
      })();

      set((s) => ({ inFlight: { ...s.inFlight, [hashedKey]: promise } }));
      return promise;
    },

    async refetchInfiniteQuery<TPage, TParam>(key: QueryKey) {
      const hashedKey = hashKey(key);
      const entry = get().queries[hashedKey];
      const fetcher = infiniteFetchers.get(hashedKey) as
        | ((ctx: { pageParam: TParam; signal?: AbortSignal }) => Promise<TPage>)
        | undefined;
      const data = entry?.data as InfiniteData<TPage, TParam> | undefined;
      if (!entry || !fetcher || !data) return undefined;
      if (get().inFlight[hashedKey]) {
        return get().inFlight[hashedKey] as Promise<
          InfiniteData<TPage, TParam>
        >;
      }

      const controller = isBrowser ? new AbortController() : undefined;
      if (controller) aborters.set(hashedKey, controller);
      inFlightMeta.set(hashedKey, { direction: "init" });

      const promise = (async () => {
        try {
          const pages: TPage[] = [];
          for (let i = 0; i < data.pageParams.length; i += 1) {
            const pageParam = data.pageParams[i];
            const page = await runWithRetry<TPage>(
              async (_attemptIndex): Promise<TPage> => {
                if (controller?.signal?.aborted) {
                  throw (
                    controller.signal.reason ??
                    new DOMException("Aborted", "AbortError")
                  );
                }
                const result = await fetcher({
                  pageParam,
                  signal: controller?.signal,
                });
                return result as TPage;
              },
              entry.retry ?? get().config.retry,
              (n) => bump({ retries: n }),
              (attempt, attempts) => devtoolsEmit("retry", { attempt, attempts })
            );
            pages.push(page);
          }

          const next: InfiniteData<TPage, TParam> = {
            pages,
            pageParams: data.pageParams,
          };

          setEntry(hashedKey, {
            data: next,
            error: undefined,
            fetchedAt: Date.now(),
            accessedAt: Date.now(),
          });
          scheduleFlush();
          devtoolsEmit("fetch:success", { key: hashedKey });
          return next;
        } catch (error) {
          if (isAbortError(error)) {
            bump({ aborts: 1 });
            setEntry(hashedKey, {
              error,
              fetchedAt: Date.now(),
              lastAbortAt: Date.now(),
            });
            scheduleFlush();
            devtoolsEmit("fetch:abort", { key: hashedKey });
            throw error;
          }

          bump({ errors: 1 });
          setEntry(hashedKey, { error, fetchedAt: Date.now() });
          scheduleFlush();
          devtoolsEmit("fetch:error", { key: hashedKey });
          throw error;
        } finally {
          set((s) => {
            const next = { ...s.inFlight };
            delete next[hashedKey];
            return { inFlight: next };
          });
          inFlightMeta.delete(hashedKey);
          if (controller && aborters.get(hashedKey) === controller) {
            aborters.delete(hashedKey);
          }
        }
      })();

      set((s) => ({ inFlight: { ...s.inFlight, [hashedKey]: promise } }));
      return promise;
    },

    async prefetchQuery<T>(key: QueryKey, options: FetchQueryOptions<T>) {
      const hashedKey = hashKey(key);
      bump({ prefetched: 1 });
      devtoolsEmit("prefetch", { key: hashedKey });
      await get().fetchQuery<T>(key, { ...options, background: false });
    },

    invalidate(key) {
      const hashedKey = hashKey(key);
      bump({ invalidations: 1 });

      get().abort(hashedKey);
      withDraft(
        (draft) => {
          if (!draft[hashedKey]) return;
          draft[hashedKey] = {
            ...draft[hashedKey],
            fetchedAt: 0,
            error: undefined,
          };
        },
        false
      );
      scheduleFlush();
      debugLog("invalidate", hashedKey);
      devtoolsEmit("invalidate", { key: hashedKey });
      broadcast({ type: "invalidate", payload: { key: hashedKey } });
    },

    invalidateByPrefix(prefix) {
      bump({ invalidations: 1 });

      const keys = Object.keys(get().queries).filter((k) => {
        const original = keyMap.get(k) ?? k;
        const keyString =
          get().queries[k]?.keyString ?? keyToString(original as QueryKey);
        return keyString.startsWith(prefix);
      });
      keys.forEach((k) => get().abort(k));
      withDraft(
        (draft) => {
          Object.keys(draft).forEach((k) => {
            const original = keyMap.get(k) ?? k;
            const keyString =
              draft[k]?.keyString ?? keyToString(original as QueryKey);
            if (!keyString.startsWith(prefix)) return;
            draft[k] = {
              ...draft[k],
              fetchedAt: 0,
              error: undefined,
            };
          });
        },
        false
      );
      scheduleFlush();
      debugLog("invalidateByPrefix", prefix);
      devtoolsEmit("invalidateByPrefix", { prefix });
      broadcast({ type: "invalidateByPrefix", payload: { prefix } });
    },

    invalidateTags(tags) {
      bump({ invalidations: 1 });
      const list = Array.isArray(tags) ? tags : [tags];

      const keysToInvalidate = new Set<QueryKeyHash>();
      list.forEach((t) => {
        const setKeys = tagIndex.get(t);
        if (!setKeys) return;
        setKeys.forEach((k) => keysToInvalidate.add(k));
      });

      get().batch(() => {
        keysToInvalidate.forEach((k) => get().invalidate(k));
      });

      debugLog("invalidateTags", list);
      devtoolsEmit("invalidateTags", {
        tags: list,
        keys: Array.from(keysToInvalidate),
      });
      broadcast({ type: "invalidateTags", payload: { tags: list } });
    },

    cancelByTags(tags) {
      const list = Array.isArray(tags) ? tags : [tags];
      const keysToCancel = new Set<QueryKeyHash>();
      list.forEach((t) => {
        const setKeys = tagIndex.get(t);
        if (!setKeys) return;
        setKeys.forEach((k) => keysToCancel.add(k));
      });
      keysToCancel.forEach((k) => get().abort(k));
      devtoolsEmit("cancelTags", {
        tags: list,
        keys: Array.from(keysToCancel),
      });
    },

    abort(key) {
      const hashedKey = hashKey(key);
      const controller = aborters.get(hashedKey);
      if (!controller) return;
      try {
        controller.abort();
      } catch {}
      aborters.delete(hashedKey);
      devtoolsEmit("abort", { key: hashedKey });
    },

    cancelMutation(key) {
      const hashedKey = hashKey(key);
      const controller = mutationAborters.get(hashedKey);
      if (!controller) return;
      try {
        controller.abort();
      } catch {}
      mutationAborters.delete(hashedKey);
      devtoolsEmit("mutation:abort", { key: hashedKey });
    },

    batch(fn) {
      batchDepth += 1;
      try {
        fn();
      } finally {
        batchDepth -= 1;
        if (batchDepth === 0 && pendingQueries) {
          const next = pendingQueries;
          pendingQueries = null;
          set({ queries: next });
          if (flushRequested) {
            flushRequested = false;
            scheduleFlush();
          }
          devtoolsEmit("batch:flush", {});
        }
      }
    },

    gc() {
      const now = Date.now();
      let evicted = 0;

      withDraft((draft) => {
        Object.entries(draft).forEach(([k, q]) => {
          if (!q.fetchedAt) return;
          if (now - q.fetchedAt > q.cacheTime) {
            get().abort(k);
            ensurePoller(k, undefined);

            removeKeyFromAllTags(k);

            delete draft[k];
            evicted += 1;
          }
        });
      });

      if (evicted > 0) {
        bump({ gcEvictions: evicted });
        scheduleFlush();
        debugLog("gc evicted", evicted);
        devtoolsEmit("gc", { evicted });
      }
    },

    async mutate<TVars, TResult>(opts: MutateOptions<TVars, TResult>) {
      bump({ mutations: 1 });
      devtoolsEmit("mutate:start", {});

      const defaults = getMutationDefaultOptions(opts.mutationKey, get().config);
      const mergedOptions: MutateOptions<TVars, TResult> = {
        ...defaults,
        ...opts,
        retry: opts.retry ?? defaults.retry,
        abortOnNewMutation:
          opts.abortOnNewMutation ?? defaults.abortOnNewMutation,
        invalidateKeys: opts.invalidateKeys ?? defaults.invalidateKeys,
        invalidatePrefixes:
          opts.invalidatePrefixes ?? defaults.invalidatePrefixes,
        invalidateTags: opts.invalidateTags ?? defaults.invalidateTags,
        optimistic: opts.optimistic ?? defaults.optimistic,
        updateCache: opts.updateCache ?? defaults.updateCache,
      } as MutateOptions<TVars, TResult>;

      const {
        mutationFn,
        variables,
        optimistic,
        updateCache,
        invalidateKeys,
        invalidatePrefixes,
        invalidateTags,
        onSuccess,
        onError,
        retry,
        abortOnNewMutation = true,
      } = mergedOptions;

      const mutationKey = mergedOptions.mutationKey ?? "__mutation__";
      const hashedKey = hashKey(mutationKey);

      if (abortOnNewMutation) {
        get().cancelMutation(hashedKey);
      }

      const controller = isBrowser ? new AbortController() : undefined;
      if (controller) mutationAborters.set(hashedKey, controller);

      set((s) => ({
        mutations: {
          ...s.mutations,
          [hashedKey]: {
            status: "loading",
            data: s.mutations[hashedKey]?.data,
            error: undefined,
            variables,
            updatedAt: Date.now(),
          },
        },
      }));

      const snapshots = new Map<QueryKeyHash, unknown>();

      if (optimistic && optimistic.length > 0) {
        bump({ optimisticApplied: 1 });

        get().batch(() => {
          optimistic.forEach(({ key, update }) => {
            const k = hashKey(key);
            const prev = get().queries[k]?.data;
            snapshots.set(k, prev);

            setEntry(k, {
              data: update(prev),
              accessedAt: Date.now(),
            });
          });
        });

        scheduleFlush();
        debugLog(
          "optimistic applied",
          optimistic.map((o) => o.key)
        );
        devtoolsEmit("mutate:optimistic", {
          keys: optimistic.map((o) => o.key),
        });
      }

      const promise = (async () => {
        try {
          const result = await runWithRetry<TResult>(
            async () => mutationFn(variables, { signal: controller?.signal }),
            retry ?? get().config.retry,
            (n) => bump({ retries: n }),
            (attempt, attempts) => devtoolsEmit("retry", { attempt, attempts })
          );

          if (updateCache && updateCache.length > 0) {
            get().batch(() => {
              updateCache.forEach(({ key, update }) => {
                const k = hashKey(key);
                const prev = get().queries[k]?.data;
                setEntry(k, {
                  data: update(prev, result),
                  fetchedAt: Date.now(),
                  accessedAt: Date.now(),
                });
              });
            });
          }

          if (
            (invalidateKeys && invalidateKeys.length) ||
            (invalidatePrefixes && invalidatePrefixes.length) ||
            (invalidateTags && invalidateTags.length)
          ) {
            get().batch(() => {
              invalidateKeys?.forEach((k) => get().invalidate(k));
              invalidatePrefixes?.forEach((p) => get().invalidateByPrefix(p));
              if (invalidateTags?.length) get().invalidateTags(invalidateTags);
            });
          }

          scheduleFlush();
          onSuccess?.(result, variables);
          devtoolsEmit("mutate:success", {});
          set((s) => ({
            mutations: {
              ...s.mutations,
              [hashedKey]: {
                status: "success",
                data: result,
                error: undefined,
                variables,
                updatedAt: Date.now(),
              },
            },
          }));
          return result;
        } catch (error) {
          if (optimistic && optimistic.length > 0) {
            bump({ optimisticRolledBack: 1 });

            get().batch(() => {
              optimistic.forEach(({ key }) => {
                const k = hashKey(key);
                const prev = snapshots.get(k);
                setEntry(k, { data: prev, accessedAt: Date.now() });
              });
            });

            scheduleFlush();
            debugLog("optimistic rollback");
            devtoolsEmit("mutate:rollback", {
              keys: optimistic.map((o) => o.key),
            });
          }

          onError?.(error, variables);
          devtoolsEmit("mutate:error", {});
          set((s) => ({
            mutations: {
              ...s.mutations,
              [hashedKey]: {
                status: "error",
                data: s.mutations[hashedKey]?.data,
                error,
                variables,
                updatedAt: Date.now(),
              },
            },
          }));
          throw error;
        } finally {
          if (controller && mutationAborters.get(hashedKey) === controller) {
            mutationAborters.delete(hashedKey);
          }
        }
      })();

      set((s) => ({
        mutations: {
          ...s.mutations,
          [hashedKey]: {
            status: "loading",
            data: s.mutations[hashedKey]?.data,
            error: undefined,
            variables,
            promise,
            updatedAt: Date.now(),
          },
        },
      }));

      return promise;
    },

    setDebug(debug) {
      set((s) => ({ config: { ...s.config, debug } }));
      devtoolsEmit("config:debug", { debug });
    },

    setConfig(partial) {
      set((s) => ({
        config: {
          ...s.config,
          ...partial,
          persistence: {
            ...s.config.persistence,
            ...(partial.persistence ?? {}),
          },
          retry: {
            ...s.config.retry,
            ...(partial.retry ?? {}),
          },
          multiTabSync: {
            ...s.config.multiTabSync,
            ...(partial.multiTabSync ?? {}),
          },
          devtools: {
            ...s.config.devtools,
            ...(partial.devtools ?? {}),
          },
        },
      }));
      devtoolsEmit("config:set", { partial });
    },

    getMutation(key) {
      const hashedKey = hashKey(key);
      return get().mutations[hashedKey];
    },

    setQueryData(key, data, options) {
      const hashedKey = hashKey(key);
      keyMap.set(hashedKey, key);
      setEntry(hashedKey, {
        data,
        error: undefined,
        fetchedAt: options?.fetchedAt ?? Date.now(),
        accessedAt: Date.now(),
        staleTime:
          options?.staleTime ??
          get().queries[hashedKey]?.staleTime ??
          DEFAULT_STALE_TIME,
        cacheTime:
          options?.cacheTime ??
          get().queries[hashedKey]?.cacheTime ??
          DEFAULT_CACHE_TIME,
        refetchInterval:
          options?.refetchInterval ?? get().queries[hashedKey]?.refetchInterval,
        tags: options?.tags ?? get().queries[hashedKey]?.tags ?? [],
        retry: options?.retry ?? get().queries[hashedKey]?.retry,
        meta: options?.meta ?? get().queries[hashedKey]?.meta,
        keyString: get().queries[hashedKey]?.keyString ?? keyToString(key),
      });
      syncTagsIndex(hashedKey, options?.tags);
      evictLRUIfNeeded();
      scheduleFlush();
      devtoolsEmit("setQueryData", { key: hashedKey });
    },

    addObserver(key) {
      const hashedKey = hashKey(key);
      const next = (observers.get(hashedKey) ?? 0) + 1;
      observers.set(hashedKey, next);
      devtoolsEmit("observer:add", { key: hashedKey, count: next });
    },

    removeObserver(key) {
      const hashedKey = hashKey(key);
      const prev = observers.get(hashedKey) ?? 0;
      const next = Math.max(0, prev - 1);
      if (next === 0) observers.delete(hashedKey);
      else observers.set(hashedKey, next);
      devtoolsEmit("observer:remove", { key: hashedKey, count: next });
    },

    getObserversCount(key) {
      const hashedKey = hashKey(key);
      return observers.get(hashedKey) ?? 0;
    },

    getInFlightDirection(key) {
      const hashedKey = hashKey(key);
      return inFlightMeta.get(hashedKey)?.direction;
    },

    clear() {
      Object.keys(get().queries).forEach((k) => get().abort(k));

      if (isBrowser) {
        pollers.forEach((p) => window.clearInterval(p.timer));
      }
      pollers.clear();
      fetchers.clear();
      infiniteFetchers.clear();
      selectMemo.clear();
      tagIndex.clear();
      aborters.clear();
      mutationAborters.clear();
      keyMap.clear();
      observers.clear();
      inFlightMeta.clear();

      set({ queries: {}, inFlight: {}, mutations: {} });
      scheduleFlush();
      debugLog("clear");
      devtoolsEmit("clear", {});
      broadcast({ type: "clear", payload: {} });
    },

    getSnapshot() {
      const s = get();
      return {
        config: s.config,
        metrics: s.metrics,
        queryKeys: Object.keys(s.queries),
        inFlightKeys: Object.keys(s.inFlight).filter((k) => !!s.inFlight[k]),
        mutationKeys: Object.keys(s.mutations),
      };
    },
  }));

  const debugLog = (...args: unknown[]) => {
    const { config } = store.getState();
    if (!config.debug) return;
    console.debug("[QueryStore]", ...args);
  };

  const bump = (partial: Partial<Metrics>) => {
    store.setState((s) => ({
      metrics: {
        ...s.metrics,
        ...Object.fromEntries(
          Object.entries(partial).map(([k, v]) => [
            k,
            (s.metrics as any)[k] + (v as number),
          ])
        ),
      },
    }));
  };

  const serializeQueries = (queries: Record<QueryKeyHash, QueryEntry>) => {
    const out: Record<QueryKeyHash, Omit<QueryEntry, "fetcher">> = {};
    Object.entries(queries).forEach(([k, q]) => {
      const { fetcher: _f, error: _e, meta: _m, ...rest } = q;
      out[k] = rest;
    });
    return out;
  };

  const devtoolsEmit = (type: string, payload: unknown) => {
    const { devtools } = store.getState().config;
    if (!isBrowser) return;
    if (!devtools.enabled) return;

    if (devtools.emitEvents) {
      try {
        window.dispatchEvent(
          new CustomEvent(devtools.eventName, {
            detail: { type, payload, ts: Date.now() },
          })
        );
      } catch {}
    }

    if (store.getState().config.debug) {
      debugLog("event", type, payload);
    }
  };

  const scheduleFlush = () => {
    if (!isBrowser) return;
    const { persistence } = store.getState().config;
    if (persistence.mode === "none") return;

    if (flushTimer) window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(async () => {
      flushTimer = null;
      const { config, queries } = store.getState();
      const payload = serializeQueries(queries);

      try {
        if (config.persistence.mode === "session") {
          sessionStorage.setItem(
            config.persistence.storageKey,
            JSON.stringify(payload)
          );
          debugLog("persist(session) ok");
        } else if (config.persistence.mode === "indexeddb") {
          await idbSet(
            config.persistence.dbName,
            config.persistence.storeName,
            config.persistence.storageKey,
            payload
          );
          debugLog("persist(indexeddb) ok");
        }
      } catch (e) {
        debugLog("persist failed", e);
      }
    }, store.getState().config.persistence.flushDebounceMs);
  };

  const restorePersisted = async () => {
    if (!isBrowser) return;
    const { persistence } = store.getState().config;
    if (persistence.mode === "none") return;

    try {
      if (persistence.mode === "session") {
        const raw = sessionStorage.getItem(persistence.storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<
          QueryKeyHash,
          Omit<QueryEntry, "fetcher">
        >;
        store.getState().hydrate(parsed);
        debugLog("restore(session) ok");
      } else if (persistence.mode === "indexeddb") {
        const parsed = await idbGet<
          Record<QueryKeyHash, Omit<QueryEntry, "fetcher">>
        >(persistence.dbName, persistence.storeName, persistence.storageKey);
        if (!parsed) return;
        store.getState().hydrate(parsed);
        debugLog("restore(indexeddb) ok");
      }
    } catch (e) {
      debugLog("restore failed", e);
    }
  };

  const withDraft = (
    fn: (draft: Record<QueryKeyHash, QueryEntry>) => void,
    flush = true
  ) => {
    if (batchDepth > 0) {
      if (!pendingQueries) pendingQueries = { ...store.getState().queries };
      fn(pendingQueries);
      if (flush) flushRequested = true;
      return;
    }
    store.setState((s) => {
      const next = { ...s.queries };
      fn(next);
      return { queries: next };
    });
    if (flush) scheduleFlush();
  };

  const setEntry = (key: QueryKeyHash, patch: Partial<QueryEntry>) => {
    withDraft((draft) => {
      const prev = draft[key];
      const hasData = Object.prototype.hasOwnProperty.call(patch, "data");
      const nextData = hasData
        ? applyStructuralSharing(prev?.data, patch.data as any)
        : prev?.data;
      draft[key] = {
        data: nextData,
        error: prev?.error,
        meta: prev?.meta,
        keyString: prev?.keyString,
        fetchedAt: prev?.fetchedAt,
        accessedAt: prev?.accessedAt,
        staleTime: prev?.staleTime ?? DEFAULT_STALE_TIME,
        cacheTime: prev?.cacheTime ?? DEFAULT_CACHE_TIME,
        refetchInterval: prev?.refetchInterval,
        fetcher: prev?.fetcher,
        tags: prev?.tags ?? [],
        retry: prev?.retry,
        lastAbortAt: prev?.lastAbortAt,
        ...patch,
      };
    });
  };

  const touch = (key: QueryKeyHash) => {
    setEntry(key, { accessedAt: Date.now() });
  };

  const evictLRUIfNeeded = () => {
    const { maxEntries } = store.getState().config;
    const queries = store.getState().queries;
    const keys = Object.keys(queries);
    if (keys.length <= maxEntries) return;

    const sorted = keys
      .map((k) => {
        const q = queries[k];
        const t = q.accessedAt ?? q.fetchedAt ?? 0;
        return { k, t };
      })
      .sort((a, b) => a.t - b.t);

    const toRemove = sorted.slice(0, Math.max(0, keys.length - maxEntries));
    if (toRemove.length === 0) return;

    store.getState().batch(() => {
      toRemove.forEach(({ k }) => {
        store.getState().invalidate(k);
      });
    });

    bump({ lruEvictions: toRemove.length });
    debugLog(
      "LRU evicted",
      toRemove.map((x) => x.k)
    );
    devtoolsEmit("lru", { keys: toRemove.map((x) => x.k) });
  };

  const ensurePoller = (key: QueryKeyHash, interval?: number) => {
    if (!isBrowser) return;

    if (!interval || interval <= 0) {
      const existing = pollers.get(key);
      if (existing) window.clearInterval(existing.timer);
      pollers.delete(key);
      return;
    }

    const existing = pollers.get(key);
    if (existing && existing.interval === interval) return;
    if (existing) window.clearInterval(existing.timer);

    const timer = window.setInterval(() => {
      const fetcher = fetchers.get(key);
      const entry = store.getState().queries[key];
      if (!fetcher || !entry) return;
      const originalKey = resolveKey(key);

      if (infiniteFetchers.has(key)) {
        store
          .getState()
          .refetchInfiniteQuery(originalKey)
          .catch(() => {});
        return;
      }

      store
        .getState()
        .fetchQuery(originalKey, {
          fetcher: fetcher as any,
          staleTime: entry.staleTime,
          cacheTime: entry.cacheTime,
          background: true,
          skipStaleWhileRevalidate: true,
          refetchInterval: interval,
          tags: entry.tags,
          retry: entry.retry,
        })
        .catch(() => {});
    }, interval);

    pollers.set(key, { timer, interval });
  };

  const syncTagsIndex = (key: QueryKeyHash, nextTags?: string[]) => {
    if (!nextTags) return;

    removeKeyFromAllTags(key);

    nextTags.forEach((t) => {
      if (!tagIndex.has(t)) tagIndex.set(t, new Set());
      tagIndex.get(t)!.add(key);
    });
  };

  const removeKeyFromAllTags = (key: QueryKeyHash) => {
    tagIndex.forEach((setKeys) => {
      setKeys.delete(key);
    });

    Array.from(tagIndex.entries()).forEach(([t, setKeys]) => {
      if (setKeys.size === 0) tagIndex.delete(t);
    });
  };

  const refetchStaleQueries = () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const { queries, fetchQuery } = store.getState();
    Object.entries(queries).forEach(([key, q]) => {
      const observersCount = observers.get(key) ?? 0;
      if (observersCount === 0) return;
      if (!q.data) return;
      const isStale = !q.fetchedAt || Date.now() - q.fetchedAt > q.staleTime;
      if (!isStale) return;

      bump({ backgroundFetches: 1 });
      const originalKey = resolveKey(key);
      if (infiniteFetchers.has(key)) {
        store.getState().refetchInfiniteQuery(originalKey).catch(() => {});
        return;
      }

      const f = fetchers.get(key);
      if (!f) return;
      fetchQuery(originalKey, {
        fetcher: f as any,
        staleTime: q.staleTime,
        cacheTime: q.cacheTime,
        background: true,
        skipStaleWhileRevalidate: true,
        refetchInterval: q.refetchInterval,
        tags: q.tags,
        retry: q.retry,
      }).catch(() => {});
    });
  };

  if (isBrowser) {
    restorePersisted().catch(() => {});

    if (cfg.refetchOnFocus) {
      window.addEventListener("focus", () => {
        refetchStaleQueries();
      });
    }

    if (cfg.refetchOnOnline) {
      window.addEventListener("online", () => {
        refetchStaleQueries();
      });
    }

    if (cfg.refetchOnReconnect) {
      window.addEventListener("focus", () => {
        refetchStaleQueries();
      });
    }

    if (cfg.devtools.enabled && cfg.devtools.exposeToWindow) {
      (window as any).__QUERY_STORE__ = store;
      (window as any).__QUERY_STORE_GET_SNAPSHOT__ = () =>
        store.getState().getSnapshot();
      devtoolsEmit("devtools:exposed", {});
    }

    if (cfg.devtools.overlay?.enabled) {
      const position = cfg.devtools.overlay.position ?? "bottom-right";
      const styleBase =
        "position:fixed;z-index:2147483647;padding:8px 10px;background:#0f1115;color:#f8f8f2;border-radius:8px;font:12px/1.4 monospace;opacity:0.9;";
      const positionStyle =
        position === "bottom-left"
          ? "bottom:12px;left:12px;"
          : position === "top-right"
            ? "top:12px;right:12px;"
            : position === "top-left"
              ? "top:12px;left:12px;"
              : "bottom:12px;right:12px;";
      const root = document.createElement("div");
      root.setAttribute("style", `${styleBase}${positionStyle}`);
      const render = () => {
        const { metrics, queries, inFlight, mutations } = store.getState();
        root.textContent =
          `queries:${Object.keys(queries).length} ` +
          `inFlight:${Object.keys(inFlight).filter((k) => !!inFlight[k]).length} ` +
          `mutations:${Object.keys(mutations).length} ` +
          `hits:${metrics.hits} ` +
          `misses:${metrics.misses} ` +
          `errors:${metrics.errors}`;
      };
      render();
      document.body.appendChild(root);
      store.subscribe(render);
    }

    if (cfg.multiTabSync.enabled && channel) {
      channel.onmessage = (event) => {
        const message = event.data as {
          type: string;
          payload?: any;
          sourceId?: string;
        };
        if (message.sourceId === instanceId) return;
        suppressBroadcast = true;
        try {
          if (message.type === "invalidate") {
            store.getState().invalidate(message.payload.key);
          }
          if (message.type === "invalidateByPrefix") {
            store.getState().invalidateByPrefix(message.payload.prefix);
          }
          if (message.type === "invalidateTags") {
            store.getState().invalidateTags(message.payload.tags);
          }
          if (message.type === "clear") {
            store.getState().clear();
          }
        } finally {
          suppressBroadcast = false;
        }
      };
    }
  }

  if (cfg.gcIntervalMs && isBrowser) {
    window.setInterval(() => {
      store.getState().gc();
    }, cfg.gcIntervalMs);
  }

  return store;
}

export const useQueryStore = createQueryClient();
