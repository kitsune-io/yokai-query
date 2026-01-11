import { RetryOptions } from "../types";

export const isAbortError = (e: unknown) => {
  if (!e) return false;
  const anyE = e as any;
  return anyE?.name === "AbortError" || anyE?.code === 20;
};

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const runWithRetry = async <T>(
  fn: (attemptIndex: number) => Promise<T>,
  retryCfg: RetryOptions,
  onRetryBump: (n: number) => void,
  onRetryEmit?: (attempt: number, attempts: number) => void
): Promise<T> => {
  const attempts = Math.max(1, retryCfg.attempts ?? 1);
  const retryOn = retryCfg.retryOn ?? (() => true);
  const delayCfg = retryCfg.delay ?? 0;

  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      if (i > 0) {
        onRetryBump(1);
        onRetryEmit?.(i + 1, attempts);
      }
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (isAbortError(e)) throw e;
      if (i === attempts - 1) break;
      if (!retryOn(e, i + 1)) break;

      const ms =
        typeof delayCfg === "function"
          ? delayCfg(i + 1)
          : (delayCfg as number);
      if (ms > 0) await sleep(ms);
    }
  }

  throw lastErr;
};
