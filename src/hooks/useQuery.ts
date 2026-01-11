import { useEffect, useRef } from "react";
import { QueryFetcher, QueryKey, QueryDefaultOptions, RetryOptions } from "../types";
import { DEFAULT_CACHE_TIME, DEFAULT_STALE_TIME } from "../store/defaults";
import { hashKey, keyToString } from "../utils/keys";
import { useQueryStore } from "../store";

export type UseQueryReturn<T, R> = {
  data: R | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isStale: boolean;
  refetch: (opts?: { background?: boolean }) => Promise<T | undefined>;
};

export type UseQueryOptions<T, R> = {
  select?: (data: T) => R;
  fetcher?: QueryFetcher<T>;
  enabled?: boolean;
  suspense?: boolean;
  throwOnError?: boolean;
  background?: boolean;
  keepPreviousData?: boolean;
  initialData?: T | (() => T);
  placeholderData?: R | ((prev: R | undefined) => R);
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
  onSettled?: (data: T | undefined, error: unknown | undefined) => void;
  meta?: unknown;
  staleTime?: number;
  cacheTime?: number;
  refetchInterval?: number;
  tags?: string[];
  retry?: RetryOptions;
  abortOnNewFetch?: boolean;
};

export function useQuery<T, R = T>(
  key: QueryKey,
  selectOrOptions?: ((data: T) => R) | UseQueryOptions<T, R>
): UseQueryReturn<T, R> {
  const resolvedKey = hashKey(key);
  const options: UseQueryOptions<T, R> =
    typeof selectOrOptions === "function"
      ? { select: selectOrOptions }
      : selectOrOptions ?? {};

  const select = options.select;
  const config = useQueryStore.getState().config;
  const selectMemoMaxEntries = config.selectMemoMaxEntries ?? 0;
  const defaults = (config.queryDefaults ?? []).reduce<QueryDefaultOptions>(
    (acc, entry) => {
      if (keyToString(key).startsWith(entry.prefix)) {
        return { ...acc, ...entry.options };
      }
      return acc;
    },
    {}
  );
  const {
    initialData: defaultInitialData,
    placeholderData: defaultPlaceholderData,
    ...restDefaults
  } = defaults;
  const mergedOptions: UseQueryOptions<T, R> = {
    ...(restDefaults as Omit<UseQueryOptions<T, R>, "initialData" | "placeholderData">),
    ...options,
    retry: options.retry ?? defaults.retry,
    tags: options.tags ?? defaults.tags,
    refetchInterval: options.refetchInterval ?? defaults.refetchInterval,
    abortOnNewFetch: options.abortOnNewFetch ?? defaults.abortOnNewFetch,
    staleTime: options.staleTime ?? defaults.staleTime,
    cacheTime: options.cacheTime ?? defaults.cacheTime,
    initialData:
      options.initialData ??
      (defaultInitialData as T | (() => T) | undefined),
    placeholderData:
      options.placeholderData ??
      (defaultPlaceholderData as R | ((prev: R | undefined) => R) | undefined),
  };
  const suspense = mergedOptions.suspense ?? config.suspense;
  const throwOnError = mergedOptions.throwOnError ?? config.throwOnError;
  const keepPreviousData = mergedOptions.keepPreviousData ?? false;
  const previousDataRef = useRef<R | undefined>(undefined);
  const previousKeyRef = useRef<string | undefined>(undefined);
  const initialDataAppliedRef = useRef<string | undefined>(undefined);
  const initialDataRef = useRef<{ key: string; value: T } | null>(null);
  const fetcherRef = useRef<QueryFetcher<T> | undefined>(mergedOptions.fetcher);

  const entry = useQueryStore((state) => state.queries[resolvedKey]);
  const isFetching = useQueryStore((state) => !!state.inFlight[resolvedKey]);
  let selected: any = entry?.data as T | undefined;

  if (entry?.data !== undefined && select && selectMemoMaxEntries > 0) {
    const memo = (useQueryStore as any).__selectMemo as
      | Map<string, { selectRef: Function; inputRef: unknown; output: unknown }>
      | undefined;

    if (!memo) {
      (useQueryStore as any).__selectMemo = new Map();
    }
    const cache = (useQueryStore as any).__selectMemo as Map<
      string,
      { selectRef: Function; inputRef: unknown; output: unknown }
    >;

    const prev = cache.get(resolvedKey);
    if (prev && prev.selectRef === select && prev.inputRef === entry.data) {
      selected = prev.output as R;
    } else {
      const out = select(entry.data as T);
      cache.delete(resolvedKey);
      cache.set(resolvedKey, {
        selectRef: select,
        inputRef: entry.data,
        output: out,
      });
      if (selectMemoMaxEntries > 0 && cache.size > selectMemoMaxEntries) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
      selected = out as R;
    }
  }

  const hasData = entry?.data !== undefined;
  const error = entry?.error;
  const fetchedAt = entry?.fetchedAt;
  const staleTime = entry?.staleTime;
  const cacheTime = entry?.cacheTime;
  const refetchInterval = entry?.refetchInterval;
  const tags = entry?.tags;
  const retry = entry?.retry;
  const entryFetcher = entry?.fetcher;
  const now = Date.now();
  const isStale =
    !fetchedAt ||
    now - fetchedAt >
      (staleTime ?? DEFAULT_STALE_TIME);

  useEffect(() => {
    fetcherRef.current = mergedOptions.fetcher;
  }, [mergedOptions.fetcher]);

  useEffect(() => {
    const enabled = mergedOptions.enabled ?? false;
    if (!enabled) return;

    const f = fetcherRef.current;
    if (!f) return;

    if (isFetching) return;

    if (hasData && !isStale) return;
    if (initialDataRef.current?.key === resolvedKey && !hasData) return;

    useQueryStore
      .getState()
      .fetchQuery<T>(key, {
        fetcher: f,
        staleTime:
          mergedOptions.staleTime ?? staleTime ?? DEFAULT_STALE_TIME,
        cacheTime:
          mergedOptions.cacheTime ?? cacheTime ?? DEFAULT_CACHE_TIME,
        background: false,
        refetchInterval:
          mergedOptions.refetchInterval ?? refetchInterval,
        tags: mergedOptions.tags ?? tags,
        retry: mergedOptions.retry ?? retry,
        abortOnNewFetch: mergedOptions.abortOnNewFetch ?? true,
        onSuccess: mergedOptions.onSuccess,
        onError: mergedOptions.onError,
        onSettled: mergedOptions.onSettled,
        meta: mergedOptions.meta,
      })
      .catch(() => {});
  }, [
    resolvedKey,
    mergedOptions.enabled,
    mergedOptions.staleTime,
    mergedOptions.cacheTime,
    mergedOptions.refetchInterval,
    JSON.stringify(mergedOptions.tags ?? []),
  ]);

  const refetch = async (opts?: { background?: boolean }) => {
    const state = useQueryStore.getState();
    const q = state.queries[resolvedKey];
    const fetcher = (q?.fetcher ?? mergedOptions.fetcher) as
      | QueryFetcher<T>
      | undefined;

    if (mergedOptions.enabled === false) return undefined;

    if (!fetcher) return undefined;

    return state.fetchQuery<T>(key, {
      fetcher,
      staleTime: mergedOptions.staleTime ?? q.staleTime,
      cacheTime: mergedOptions.cacheTime ?? q.cacheTime,
      background: opts?.background ?? false,
      skipStaleWhileRevalidate: true,
      refetchInterval: mergedOptions.refetchInterval ?? q.refetchInterval,
      tags: mergedOptions.tags ?? q.tags,
      retry: mergedOptions.retry ?? q.retry,
      abortOnNewFetch: mergedOptions.abortOnNewFetch ?? true,
      onSuccess: mergedOptions.onSuccess,
      onError: mergedOptions.onError,
      onSettled: mergedOptions.onSettled,
      meta: mergedOptions.meta,
    });
  };

  if (mergedOptions.initialData !== undefined) {
    if (initialDataRef.current?.key !== resolvedKey) {
      const value =
        typeof mergedOptions.initialData === "function"
          ? (mergedOptions.initialData as () => T)()
          : mergedOptions.initialData;
      if (value !== undefined) {
        initialDataRef.current = { key: resolvedKey, value };
      }
    }
  } else if (initialDataRef.current?.key === resolvedKey) {
    initialDataRef.current = null;
  }

  const initialDataValue =
    initialDataRef.current?.key === resolvedKey
      ? initialDataRef.current.value
      : undefined;

  useEffect(() => {
    const enabled = mergedOptions.enabled ?? false;
    if (!enabled) return;
    if (hasData) return;
    if (initialDataValue === undefined) return;
    if (initialDataAppliedRef.current === resolvedKey) return;
    useQueryStore.getState().setQueryData<T>(resolvedKey, initialDataValue, {
      staleTime: mergedOptions.staleTime,
      cacheTime: mergedOptions.cacheTime,
      refetchInterval: mergedOptions.refetchInterval,
      tags: mergedOptions.tags,
      retry: mergedOptions.retry,
      meta: mergedOptions.meta,
    });
    initialDataAppliedRef.current = resolvedKey;
  }, [
    resolvedKey,
    mergedOptions.enabled,
    mergedOptions.staleTime,
    mergedOptions.cacheTime,
    mergedOptions.refetchInterval,
    JSON.stringify(mergedOptions.tags ?? []),
    initialDataValue,
  ]);

  useEffect(() => {
    if (!hasData) return;
    previousDataRef.current = selected as R | undefined;
    previousKeyRef.current = resolvedKey;
  }, [resolvedKey, hasData, selected]);

  let displayData = selected as R | undefined;
  let hasDisplayData = hasData;

  if (!hasData && initialDataValue !== undefined) {
    displayData = select
      ? select(initialDataValue)
      : (initialDataValue as unknown as R);
    hasDisplayData = true;
  } else if (
    !hasData &&
    keepPreviousData &&
    previousDataRef.current !== undefined &&
    previousKeyRef.current !== resolvedKey
  ) {
    displayData = previousDataRef.current;
    hasDisplayData = true;
  } else if (
    !hasData &&
    isFetching &&
    mergedOptions.placeholderData !== undefined
  ) {
    const placeholder =
      typeof mergedOptions.placeholderData === "function"
        ? (mergedOptions.placeholderData as (prev: R | undefined) => R)(
            previousDataRef.current
          )
        : mergedOptions.placeholderData;
    displayData = placeholder;
    hasDisplayData = true;
  }

  useEffect(() => {
    useQueryStore.getState().addObserver(key);
    return () => {
      useQueryStore.getState().removeObserver(key);
    };
  }, [resolvedKey]);

  if (throwOnError && error) {
    throw error;
  }
  if (suspense && isFetching && !hasDisplayData) {
    const promise = useQueryStore.getState().inFlight[resolvedKey];
    if (promise) throw promise;
  }

  return {
    data: displayData,
    error,
    isLoading: isFetching && !hasDisplayData,
    isFetching,
    isStale,
    refetch,
  };
}
