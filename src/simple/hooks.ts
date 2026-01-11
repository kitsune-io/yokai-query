import { QueryFetcher, QueryKey } from "../types";
import {
  UseInfiniteQueryOptions,
  UseInfiniteQueryReturn,
  useInfiniteQuery,
} from "../hooks/useInfiniteQuery";
import { UseMutationOptions, useMutation } from "../hooks/useMutation";
import { UseQueryOptions, UseQueryReturn, useQuery } from "../hooks/useQuery";

export type { UseInfiniteQueryOptions, UseInfiniteQueryReturn } from "../hooks/useInfiniteQuery";
export type { UseMutationOptions } from "../hooks/useMutation";
export type { UseQueryOptions, UseQueryReturn } from "../hooks/useQuery";

export function useSimpleQuery<T, R = T>(
  key: QueryKey,
  fetcher: QueryFetcher<T>,
  options?: Omit<UseQueryOptions<T, R>, "fetcher">
): UseQueryReturn<T, R> {
  return useQuery<T, R>(key, {
    ...options,
    fetcher,
    enabled: options?.enabled ?? true,
    keepPreviousData: options?.keepPreviousData ?? true,
  });
}

export function useSimpleMutation<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
  options?: Omit<UseMutationOptions<TVars, TResult>, "mutationFn">
) {
  return useMutation<TVars, TResult>({
    ...options,
    mutationFn,
  });
}

export function useSimpleInfiniteQuery<TPage, TParam = unknown>(
  key: QueryKey,
  fetcher: (ctx: { pageParam: TParam }) => Promise<TPage>,
  options: Omit<UseInfiniteQueryOptions<TPage, TParam>, "fetcher">
): UseInfiniteQueryReturn<TPage, TParam> {
  return useInfiniteQuery<TPage, TParam>(key, {
    ...options,
    fetcher,
    enabled: options.enabled ?? true,
  });
}
