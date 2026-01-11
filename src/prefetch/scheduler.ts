import { FetchQueryOptions, QueryKey } from "../types";
import { hashKey } from "../utils/keys";
import { useQueryStore } from "../store";

export type PrefetchTask<T> = {
  key: QueryKey;
  options: FetchQueryOptions<T>;
};

export type PrefetchSchedulerOptions = {
  concurrency?: number;
  delayMs?: number;
  dedupe?: boolean;
  maxPerSecond?: number;
};

export const createPrefetchScheduler = (
  options: PrefetchSchedulerOptions = {}
) => {
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const delayMs = Math.max(0, options.delayMs ?? 0);
  const dedupe = options.dedupe ?? true;
  const maxPerSecond = Math.max(0, options.maxPerSecond ?? 0);

  const queue: Array<PrefetchTask<any>> = [];
  const pending = new Set<string>();
  let active = 0;
  let draining = false;
  let tokens = maxPerSecond > 0 ? maxPerSecond : Infinity;

  const drain = () => {
    if (draining) return;
    draining = true;
    if (maxPerSecond > 0 && typeof window !== "undefined") {
      window.setInterval(() => {
        tokens = maxPerSecond;
      }, 1000);
    }
    const step = () => {
      while (active < concurrency && queue.length > 0 && tokens > 0) {
        const task = queue.shift()!;
        const hashedKey = hashKey(task.key);
        if (dedupe) pending.delete(hashedKey);
        active += 1;
        if (maxPerSecond > 0) tokens -= 1;
        useQueryStore
          .getState()
          .prefetchQuery(task.key, task.options)
          .catch(() => {})
          .finally(() => {
            active -= 1;
            if (queue.length > 0) {
              if (delayMs > 0) {
                setTimeout(step, delayMs);
              } else {
                step();
              }
            } else {
              draining = false;
            }
          });
      }
      if (queue.length === 0) {
        draining = false;
      }
    };
    step();
  };

  const schedule = <T>(key: QueryKey, options: FetchQueryOptions<T>) => {
    const hashedKey = hashKey(key);
    if (dedupe && pending.has(hashedKey)) {
      return () => {};
    }
    if (dedupe) pending.add(hashedKey);
    queue.push({ key, options });
    drain();
    return () => {
      const idx = queue.findIndex(
        (item) => hashKey(item.key) === hashedKey
      );
      if (idx >= 0) queue.splice(idx, 1);
      if (dedupe) pending.delete(hashedKey);
    };
  };

  const clear = () => {
    queue.length = 0;
    pending.clear();
  };

  return { schedule, clear };
};
