import { useQueryStore } from "./client";

export type CacheVersionGuardOptions = {
  version: string;
  storage?: "local" | "session";
  channelName?: string;
  clearOnMismatch?: boolean;
  onMismatch?: (previous: string | null, next: string) => void;
};

export const createCacheVersionGuard = (options: CacheVersionGuardOptions) => {
  if (typeof window === "undefined") {
    return { previousVersion: null as string | null, dispose: () => {} };
  }

  const storage =
    options.storage === "session" ? window.sessionStorage : window.localStorage;
  const persistenceKey =
    useQueryStore.getState().config.persistence.storageKey;
  const versionKey = `${persistenceKey}::version`;
  const previous = storage.getItem(versionKey);
  const next = options.version;
  const clearOnMismatch = options.clearOnMismatch ?? true;

  if (previous !== next) {
    if (clearOnMismatch) {
      useQueryStore.getState().clear();
    }
    options.onMismatch?.(previous, next);
    storage.setItem(versionKey, next);
  }

  const channelName = options.channelName ?? "yokai-query-cache";
  if (typeof BroadcastChannel === "undefined") {
    return { previousVersion: previous, dispose: () => {} };
  }

  const channel = new BroadcastChannel(channelName);
  const handler = (event: MessageEvent) => {
    const data = event.data as { type?: string; version?: string } | undefined;
    if (!data || data.type !== "cache:version") return;
    if (data.version !== next && clearOnMismatch) {
      useQueryStore.getState().clear();
    }
  };

  channel.addEventListener("message", handler);
  channel.postMessage({ type: "cache:version", version: next });

  const dispose = () => {
    channel.removeEventListener("message", handler);
    channel.close();
  };

  return { previousVersion: previous, dispose };
};
