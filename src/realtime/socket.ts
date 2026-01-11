import type { QueryKey, QueryStore } from "../types";
import { hashKey } from "../utils/keys";
import { useQueryStore } from "../store";

export type SocketLike = {
  on: (event: string, handler: (payload: any) => void) => void;
  off: (event: string, handler: (payload: any) => void) => void;
};

export type SocketCacheEvent<TPayload = unknown> = {
  event: string;
  key: (payload: TPayload) => QueryKey;
  update?: (prev: unknown | undefined, payload: TPayload) => unknown;
  invalidate?: boolean;
  setOptions?: {
    staleTime?: number;
    cacheTime?: number;
    refetchInterval?: number;
    tags?: string[];
    meta?: unknown;
    fetchedAt?: number;
  };
};

export type SocketCacheBridgeOptions = {
  socket: SocketLike;
  store?: { getState: () => QueryStore };
  events: SocketCacheEvent[];
  onError?: (error: unknown, payload: unknown, event: string) => void;
};

export type SocketCacheConnection = {
  socket: SocketLike & { disconnect?: () => void; close?: () => void };
  start: () => void;
  stop: () => void;
  dispose: () => void;
};

export type ConnectSocketCacheOptions = Omit<SocketCacheBridgeOptions, "socket"> & {
  url: string;
  socketOptions?: Record<string, unknown>;
  autoStart?: boolean;
};

export const createSocketCacheBridge = (options: SocketCacheBridgeOptions) => {
  const store = options.store ?? useQueryStore;
  const handlers = new Map<string, Array<(payload: any) => void>>();

  const start = () => {
    options.events.forEach((evt) => {
      const handler = (payload: unknown) => {
        try {
          const key = evt.key(payload);
          if (evt.invalidate) {
            store.getState().invalidate(key);
            return;
          }
          if (!evt.update) return;
          const hashedKey = hashKey(key);
          const prev = store.getState().queries[hashedKey]?.data;
          const next = evt.update(prev, payload);
          store.getState().setQueryData(key, next, evt.setOptions);
        } catch (error) {
          options.onError?.(error, payload, evt.event);
        }
      };
      const list = handlers.get(evt.event) ?? [];
      list.push(handler);
      handlers.set(evt.event, list);
      options.socket.on(evt.event, handler);
    });
  };

  const stop = () => {
    handlers.forEach((list, event) => {
      list.forEach((handler) => {
        options.socket.off(event, handler);
      });
    });
    handlers.clear();
  };

  return { start, stop };
};

export const connectSocketCache = async (
  options: ConnectSocketCacheOptions
): Promise<SocketCacheConnection> => {
  const { url, socketOptions, autoStart = true, ...bridgeOptions } = options;

  let ioFactory: (
    url: string,
    opts?: Record<string, unknown>
  ) => SocketLike & { disconnect?: () => void; close?: () => void };

  try {
    const mod = await import("socket.io-client");
    ioFactory = (mod as any).io;
    if (!ioFactory) {
      throw new Error("socket.io-client did not export io()");
    }
  } catch {
    throw new Error(
      "socket.io-client is required for connectSocketCache. Install it with `npm i socket.io-client`."
    );
  }

  const socket = ioFactory(url, socketOptions);
  const bridge = createSocketCacheBridge({
    ...bridgeOptions,
    socket,
  });

  if (autoStart) bridge.start();

  const dispose = () => {
    bridge.stop();
    if (typeof (socket as any).disconnect === "function") {
      (socket as any).disconnect();
      return;
    }
    if (typeof (socket as any).close === "function") {
      (socket as any).close();
    }
  };

  return {
    socket,
    start: bridge.start,
    stop: bridge.stop,
    dispose,
  };
};
