import { RetryOptions } from "../types";
import { getAuthToken } from "../auth/token";

export type ApiPlugin = {
  onRequest?: (input: RequestInfo, init: RequestInit) => void;
  onResponse?: (response: Response) => void;
  onError?: (error: unknown) => void;
};

export type ApiRetryRule = {
  prefix: string;
  retry: RetryOptions;
};

export type ApiClientOptions = {
  baseURL?: string;
  getAuthToken?: () => string | undefined;
  defaultRetry?: RetryOptions;
  retryRules?: ApiRetryRule[];
  plugins?: ApiPlugin[];
};

const resolveRetry = (path: string, rules?: ApiRetryRule[]) => {
  if (!rules) return undefined;
  const matched = rules.find((rule) => path.startsWith(rule.prefix));
  return matched?.retry;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const runWithRetry = async <T>(
  fn: () => Promise<T>,
  retryCfg?: RetryOptions
): Promise<T> => {
  const cfg = retryCfg ?? { attempts: 1 };
  const attempts = Math.max(1, cfg.attempts ?? 1);
  const retryOn = cfg.retryOn ?? (() => true);
  const delayCfg = cfg.delay ?? 0;

  let lastErr: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      if (!retryOn(err, i + 1)) break;
      const ms =
        typeof delayCfg === "function" ? delayCfg(i + 1) : delayCfg;
      if (ms > 0) await sleep(ms);
    }
  }

  throw lastErr;
};

export const createApiClient = (options: ApiClientOptions = {}) => {
  const baseURL = options.baseURL ?? "/api";
  const tokenFn = options.getAuthToken ?? getAuthToken;
  const plugins = options.plugins ?? [];

  const request = async <T = unknown>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> => {
    const url = `${baseURL}${path}`;
    const headers = new Headers(init.headers ?? {});
    const token = tokenFn();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const finalInit: RequestInit = { ...init, headers };
    plugins.forEach((p) => p.onRequest?.(url, finalInit));

    const retryCfg =
      resolveRetry(path, options.retryRules) ?? options.defaultRetry;

    return runWithRetry(async () => {
      try {
        const res = await fetch(url, finalInit);
        plugins.forEach((p) => p.onResponse?.(res));
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as T;
      } catch (err) {
        plugins.forEach((p) => p.onError?.(err));
        throw err;
      }
    }, retryCfg);
  };

  return {
    request,
    get: <T = unknown>(path: string, init?: RequestInit) =>
      request<T>(path, { ...init, method: "GET" }),
    post: <T = unknown>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, {
        ...init,
        method: "POST",
        body: body !== undefined ? JSON.stringify(body) : undefined,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      }),
    put: <T = unknown>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, {
        ...init,
        method: "PUT",
        body: body !== undefined ? JSON.stringify(body) : undefined,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      }),
    patch: <T = unknown>(path: string, body?: unknown, init?: RequestInit) =>
      request<T>(path, {
        ...init,
        method: "PATCH",
        body: body !== undefined ? JSON.stringify(body) : undefined,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      }),
    delete: <T = unknown>(path: string, init?: RequestInit) =>
      request<T>(path, { ...init, method: "DELETE" }),
  };
};
