import { useEffect, useRef } from "react";
import {
  InfiniteData,
  QueryDefaultOptions,
  QueryKey,
  RetryOptions,
} from "../types";
import { DEFAULT_CACHE_TIME, DEFAULT_STALE_TIME } from "../store/defaults";
import { hashKey, keyToString } from "../utils/keys";
import { useQueryStore } from "../store";

export type UseInfiniteQueryOptions<TPage, TParam> = {
  fetcher: (ctx: { pageParam: TParam; signal?: AbortSignal }) => Promise<TPage>;
  getNextPageParam: (
    lastPage: TPage,
    pages: TPage[],
    pageParams: TParam[]
  ) => TParam | undefined;
  getPreviousPageParam?: (
    firstPage: TPage,
    pages: TPage[],
    pageParams: TParam[]
  ) => TParam | undefined;
  initialPageParam: TParam;
  enabled?: boolean;
  suspense?: boolean;
  throwOnError?: boolean;
  background?: boolean;
  keepPreviousData?: boolean;
  initialData?: InfiniteData<TPage, TParam> | (() => InfiniteData<TPage, TParam>);
  placeholderData?:
    | InfiniteData<TPage, TParam>
    | ((prev: InfiniteData<TPage, TParam> | undefined) => InfiniteData<TPage, TParam>);
  onSuccess?: (data: InfiniteData<TPage, TParam>) => void;
  onError?: (error: unknown) => void;
  onSettled?: (
    data: InfiniteData<TPage, TParam> | undefined,
    error: unknown | undefined
  ) => void;
  meta?: unknown;
  staleTime?: number;
  cacheTime?: number;
  refetchInterval?: number;
  tags?: string[];
  retry?: RetryOptions;
  abortOnNewFetch?: boolean;
};

export type UseInfiniteQueryReturn<TPage, TParam> = {
  data: InfiniteData<TPage, TParam> | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchNextPage: () => Promise<InfiniteData<TPage, TParam> | undefined>;
  fetchPreviousPage: () => Promise<InfiniteData<TPage, TParam> | undefined>;
  refetch: () => Promise<InfiniteData<TPage, TParam> | undefined>;
};

export function useInfiniteQuery<TPage, TParam>(
  key: QueryKey,
  options: UseInfiniteQueryOptions<TPage, TParam>
): UseInfiniteQueryReturn<TPage, TParam> {
  const resolvedKey = hashKey(key);
  const config = useQueryStore.getState().config;
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
  const mergedOptions: UseInfiniteQueryOptions<TPage, TParam> = {
    ...(restDefaults as Omit<
      UseInfiniteQueryOptions<TPage, TParam>,
      "initialData" | "placeholderData"
    >),
    ...options,
    retry: options.retry ?? defaults.retry,
    tags: options.tags ?? defaults.tags,
    refetchInterval: options.refetchInterval ?? defaults.refetchInterval,
    abortOnNewFetch: options.abortOnNewFetch ?? defaults.abortOnNewFetch,
    staleTime: options.staleTime ?? defaults.staleTime,
    cacheTime: options.cacheTime ?? defaults.cacheTime,
    initialData:
      options.initialData ??
      (defaultInitialData as
        | InfiniteData<TPage, TParam>
        | (() => InfiniteData<TPage, TParam>)
        | undefined),
    placeholderData:
      options.placeholderData ??
      (defaultPlaceholderData as
        | InfiniteData<TPage, TParam>
        | ((prev: InfiniteData<TPage, TParam> | undefined) => InfiniteData<TPage, TParam>)
        | undefined),
  };
  const suspense = mergedOptions.suspense ?? config.suspense;
  const throwOnError = mergedOptions.throwOnError ?? config.throwOnError;
  const keepPreviousData = mergedOptions.keepPreviousData ?? false;
  const previousDataRef = useRef<InfiniteData<TPage, TParam> | undefined>(
    undefined
  );
  const previousKeyRef = useRef<string | undefined>(undefined);
  const initialDataAppliedRef = useRef<string | undefined>(undefined);
  const initialDataRef = useRef<{
    key: string;
    value: InfiniteData<TPage, TParam>;
  } | null>(null);
  const fetcherRef = useRef(mergedOptions.fetcher);

  const entry = useQueryStore((state) => state.queries[resolvedKey]);
  const isFetching = useQueryStore((state) => !!state.inFlight[resolvedKey]);
  const data = entry?.data as InfiniteData<TPage, TParam> | undefined;
  const error = entry?.error;
  const hasData = entry?.data !== undefined;
  const fetchedAt = entry?.fetchedAt;
  const staleTime = entry?.staleTime;
  const cacheTime = entry?.cacheTime;
  const refetchInterval = entry?.refetchInterval;
  const tags = entry?.tags;
  const retry = entry?.retry;
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
    if (!fetcherRef.current) return;
    if (isFetching) return;
    if (hasData && !isStale) return;
    if (initialDataRef.current?.key === resolvedKey && !hasData) return;

    useQueryStore
      .getState()
      .fetchInfiniteQuery<TPage, TParam>(key, {
        fetcher: fetcherRef.current,
        pageParam: mergedOptions.initialPageParam,
        direction: "init",
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

  if (mergedOptions.initialData !== undefined) {
    if (initialDataRef.current?.key !== resolvedKey) {
      const value =
        typeof mergedOptions.initialData === "function"
          ? (mergedOptions.initialData as () => InfiniteData<TPage, TParam>)()
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
    useQueryStore
      .getState()
      .setQueryData<InfiniteData<TPage, TParam>>(resolvedKey, initialDataValue, {
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
    previousDataRef.current = data;
    previousKeyRef.current = resolvedKey;
  }, [resolvedKey, hasData, data]);

  let displayData = data;
  let hasDisplayData = hasData;

  if (!hasData && initialDataValue !== undefined) {
    displayData = initialDataValue;
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
        ? (mergedOptions.placeholderData as (
            prev: InfiniteData<TPage, TParam> | undefined
          ) => InfiniteData<TPage, TParam>)(previousDataRef.current)
        : mergedOptions.placeholderData;
    displayData = placeholder;
    hasDisplayData = true;
  }

  const hasNextPage =
    !!displayData &&
    mergedOptions.getNextPageParam(
      displayData.pages[displayData.pages.length - 1],
      displayData.pages,
      displayData.pageParams
    ) !== undefined;
  const hasPreviousPage =
    !!displayData &&
    mergedOptions.getPreviousPageParam
      ? mergedOptions.getPreviousPageParam(
          displayData.pages[0],
          displayData.pages,
          displayData.pageParams
        ) !== undefined
      : false;

  const fetchNextPage = async () => {
    if (mergedOptions.enabled === false) return undefined;
    const state = useQueryStore.getState();
    const current = state.queries[resolvedKey]?.data as
      | InfiniteData<TPage, TParam>
      | undefined;
    const pageParam = current
      ? mergedOptions.getNextPageParam(
          current.pages[current.pages.length - 1],
          current.pages,
          current.pageParams
        )
      : mergedOptions.initialPageParam;
    if (pageParam === undefined) return undefined;
    return state.fetchInfiniteQuery<TPage, TParam>(key, {
      fetcher: fetcherRef.current,
      pageParam,
      direction: current ? "forward" : "init",
      staleTime: mergedOptions.staleTime ?? staleTime,
      cacheTime: mergedOptions.cacheTime ?? cacheTime,
      background: false,
      refetchInterval: mergedOptions.refetchInterval ?? refetchInterval,
      tags: mergedOptions.tags ?? tags,
      retry: mergedOptions.retry ?? retry,
      abortOnNewFetch: mergedOptions.abortOnNewFetch ?? true,
      onSuccess: mergedOptions.onSuccess,
      onError: mergedOptions.onError,
      onSettled: mergedOptions.onSettled,
      meta: mergedOptions.meta,
    });
  };

  const fetchPreviousPage = async () => {
    if (mergedOptions.enabled === false) return undefined;
    if (!mergedOptions.getPreviousPageParam) return undefined;
    const state = useQueryStore.getState();
    const current = state.queries[resolvedKey]?.data as
      | InfiniteData<TPage, TParam>
      | undefined;
    if (!current) return undefined;
    const pageParam = mergedOptions.getPreviousPageParam(
      current.pages[0],
      current.pages,
      current.pageParams
    );
    if (pageParam === undefined) return undefined;
    return state.fetchInfiniteQuery<TPage, TParam>(key, {
      fetcher: fetcherRef.current,
      pageParam,
      direction: "backward",
      staleTime: mergedOptions.staleTime ?? staleTime,
      cacheTime: mergedOptions.cacheTime ?? cacheTime,
      background: false,
      refetchInterval: mergedOptions.refetchInterval ?? refetchInterval,
      tags: mergedOptions.tags ?? tags,
      retry: mergedOptions.retry ?? retry,
      abortOnNewFetch: mergedOptions.abortOnNewFetch ?? true,
      onSuccess: mergedOptions.onSuccess,
      onError: mergedOptions.onError,
      onSettled: mergedOptions.onSettled,
      meta: mergedOptions.meta,
    });
  };

  const refetch = async () => {
    if (mergedOptions.enabled === false) return undefined;
    const state = useQueryStore.getState();
    const current = state.queries[resolvedKey]?.data as
      | InfiniteData<TPage, TParam>
      | undefined;
    if (!current) return fetchNextPage();
    try {
      const result = await state.refetchInfiniteQuery<TPage, TParam>(key);
      if (result) {
        mergedOptions.onSuccess?.(result);
        mergedOptions.onSettled?.(result, undefined);
      }
      return result;
    } catch (error) {
      mergedOptions.onError?.(error);
      mergedOptions.onSettled?.(undefined, error);
      throw error;
    }
  };

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

  const inFlightDirection = useQueryStore
    .getState()
    .getInFlightDirection(resolvedKey);

  return {
    data: displayData,
    error,
    isLoading: isFetching && !hasDisplayData,
    isFetching,
    isFetchingNextPage:
      isFetching && inFlightDirection === "forward",
    isFetchingPreviousPage:
      isFetching && inFlightDirection === "backward",
    hasNextPage,
    hasPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    refetch,
  };
}
