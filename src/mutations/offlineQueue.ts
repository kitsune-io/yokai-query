import { useQueryStore } from "../store";

export type OfflineMutation<TVars, TResult> = {
  key: string;
  vars: TVars;
  run: (vars: TVars) => Promise<TResult>;
};

export type OfflineQueueOptions = {
  storageKey?: string;
  autoFlush?: boolean;
};

export const createOfflineMutationQueue = (options: OfflineQueueOptions = {}) => {
  const storageKey = options.storageKey ?? "__yokai_offline_queue__";
  const queue: OfflineMutation<any, any>[] = [];

  const load = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Array<{ key: string; vars: unknown }>;
      parsed.forEach((item) => {
        queue.push({
          key: item.key,
          vars: item.vars,
          run: async () => {
            throw new Error("Offline queue item missing run()");
          },
        });
      });
    } catch {
      // ignore
    }
  };

  const persist = () => {
    if (typeof window === "undefined") return;
    const snapshot = queue.map((item) => ({ key: item.key, vars: item.vars }));
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  };

  const enqueue = <TVars, TResult>(
    key: string,
    vars: TVars,
    run: (vars: TVars) => Promise<TResult>
  ) => {
    queue.push({ key, vars, run });
    persist();
  };

  const flush = async () => {
    const snapshot = [...queue];
    queue.length = 0;
    persist();
    for (const item of snapshot) {
      try {
        await item.run(item.vars);
      } catch {
        queue.push(item);
      }
    }
    persist();
  };

  if (options.autoFlush && typeof window !== "undefined") {
    window.addEventListener("online", () => {
      flush().catch(() => {});
    });
  }

  load();

  return { enqueue, flush, size: () => queue.length };
};
