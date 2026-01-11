import { QueryKey } from "../types";
import { useQueryStore } from "../store";
import { hashKey } from "../utils/keys";

export type PresenceEntry = {
  id: string;
  name?: string;
  status?: string;
  lastSeen?: number;
};

export type PresenceTtlOptions = {
  key: QueryKey;
  ttlMs: number;
  intervalMs?: number;
  getId?: (entry: PresenceEntry) => string;
  onEvict?: (evicted: PresenceEntry[]) => void;
};

export const startPresenceTtl = (options: PresenceTtlOptions) => {
  const interval = Math.max(1000, options.intervalMs ?? 5_000);
  const hashedKey = hashKey(options.key);
  const getId = options.getId ?? ((entry: PresenceEntry) => entry.id);

  const tick = () => {
    const state = useQueryStore.getState();
    const prev = state.queries[hashedKey]?.data;
    const list = Array.isArray(prev) ? (prev as PresenceEntry[]) : [];
    const now = Date.now();
    const [keep, evicted] = list.reduce<
      [PresenceEntry[], PresenceEntry[]]
    >(
      (acc, entry) => {
        const lastSeen = entry.lastSeen ?? 0;
        if (now - lastSeen <= options.ttlMs) {
          acc[0].push(entry);
        } else {
          acc[1].push(entry);
        }
        return acc;
      },
      [[], []]
    );

    if (evicted.length > 0) {
      state.setQueryData(options.key, keep, {
        tags: state.queries[hashedKey]?.tags,
      });
      options.onEvict?.(evicted);
    }
  };

  const timer = window.setInterval(tick, interval);
  return () => window.clearInterval(timer);
};
