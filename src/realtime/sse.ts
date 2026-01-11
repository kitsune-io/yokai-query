import type { QueryKey, QueryStore } from "../types";
import { hashKey } from "../utils/keys";
import { useQueryStore } from "../store";

export type EventSourceLike = {
  addEventListener: (event: string, handler: (event: MessageEvent) => void) => void;
  removeEventListener: (
    event: string,
    handler: (event: MessageEvent) => void
  ) => void;
  close?: () => void;
};

export type SseCacheEvent<TPayload = unknown> = {
  event: string;
  key: (payload: TPayload) => QueryKey;
  update?: (prev: unknown | undefined, payload: TPayload) => unknown;
  invalidate?: boolean;
  parse?: (event: MessageEvent) => TPayload;
  setOptions?: {
    staleTime?: number;
    cacheTime?: number;
    refetchInterval?: number;
    tags?: string[];
    meta?: unknown;
    fetchedAt?: number;
  };
};

export type SseCacheBridgeOptions = {
  source: EventSourceLike;
  store?: { getState: () => QueryStore };
  events: SseCacheEvent[];
  parse?: (event: MessageEvent) => unknown;
  onError?: (error: unknown, event: MessageEvent, name: string) => void;
};

export type SseCacheConnection = {
  source: EventSourceLike;
  start: () => void;
  stop: () => void;
  dispose: () => void;
};

export type ConnectSseCacheOptions = Omit<SseCacheBridgeOptions, "source"> & {
  url: string;
  eventSourceInit?: EventSourceInit;
  autoStart?: boolean;
};

const defaultParse = (event: MessageEvent) => {
  if (typeof event.data !== "string") return event.data;
  try {
    return JSON.parse(event.data);
  } catch {
    return event.data;
  }
};

export const createSseCacheBridge = (options: SseCacheBridgeOptions) => {
  const store = options.store ?? useQueryStore;
  const handlers = new Map<string, Array<(event: MessageEvent) => void>>();

  const start = () => {
    options.events.forEach((evt) => {
      const handler = (event: MessageEvent) => {
        try {
          const parser = evt.parse ?? options.parse ?? defaultParse;
          const payload = parser(event) as unknown;
          const key = evt.key(payload as any);
          if (evt.invalidate) {
            store.getState().invalidate(key);
            return;
          }
          if (!evt.update) return;
          const hashedKey = hashKey(key);
          const prev = store.getState().queries[hashedKey]?.data;
          const next = evt.update(prev, payload as any);
          store.getState().setQueryData(key, next, evt.setOptions);
        } catch (error) {
          options.onError?.(error, event, evt.event);
        }
      };
      const list = handlers.get(evt.event) ?? [];
      list.push(handler);
      handlers.set(evt.event, list);
      options.source.addEventListener(evt.event, handler);
    });
  };

  const stop = () => {
    handlers.forEach((list, event) => {
      list.forEach((handler) => {
        options.source.removeEventListener(event, handler);
      });
    });
    handlers.clear();
  };

  return { start, stop };
};

export const connectSseCache = (options: ConnectSseCacheOptions): SseCacheConnection => {
  const { url, eventSourceInit, autoStart = true, ...bridgeOptions } = options;
  if (typeof EventSource === "undefined") {
    throw new Error("EventSource is not available in this environment.");
  }
  const source = new EventSource(url, eventSourceInit);
  const bridge = createSseCacheBridge({ ...bridgeOptions, source });
  if (autoStart) bridge.start();

  const dispose = () => {
    bridge.stop();
    source.close?.();
  };

  return {
    source,
    start: bridge.start,
    stop: bridge.stop,
    dispose,
  };
};
