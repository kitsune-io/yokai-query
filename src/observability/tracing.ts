import type { QueryFetcher, QueryKey } from "../types";

export type FetchTrace = {
  key?: QueryKey;
  label?: string;
  start: number;
  end: number;
  duration: number;
  success: boolean;
  error?: unknown;
};

export type FetchTraceHandlers = {
  onStart?: (info: { key?: QueryKey; label?: string }) => void;
  onSuccess?: (info: FetchTrace) => void;
  onError?: (info: FetchTrace) => void;
  onSettled?: (info: FetchTrace) => void;
};

export const wrapFetcher = <T>(
  fetcher: QueryFetcher<T>,
  handlers: FetchTraceHandlers,
  meta?: { key?: QueryKey; label?: string }
): QueryFetcher<T> => {
  return async (ctx?: { signal?: AbortSignal }) => {
    const start = Date.now();
    handlers.onStart?.({ key: meta?.key, label: meta?.label });
    try {
      const fn = fetcher as any;
      const result =
        typeof fn === "function" && fn.length >= 1 ? fn(ctx) : fn();
      const data = await result;
      const end = Date.now();
      const trace: FetchTrace = {
        key: meta?.key,
        label: meta?.label,
        start,
        end,
        duration: end - start,
        success: true,
      };
      handlers.onSuccess?.(trace);
      handlers.onSettled?.(trace);
      return data;
    } catch (error) {
      const end = Date.now();
      const trace: FetchTrace = {
        key: meta?.key,
        label: meta?.label,
        start,
        end,
        duration: end - start,
        success: false,
        error,
      };
      handlers.onError?.(trace);
      handlers.onSettled?.(trace);
      throw error;
    }
  };
};
