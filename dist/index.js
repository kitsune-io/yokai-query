"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  addReadReceipt: () => addReadReceipt,
  api: () => api,
  clearAuthToken: () => clearAuthToken,
  connectSocketCache: () => connectSocketCache,
  connectSseCache: () => connectSseCache,
  createApiClient: () => createApiClient,
  createAuthBridgeFromEnv: () => createAuthBridgeFromEnv,
  createBetterAuthBridge: () => createBetterAuthBridge,
  createCacheVersionGuard: () => createCacheVersionGuard,
  createChatRoomBridge: () => createChatRoomBridge,
  createDefaultClient: () => createDefaultClient,
  createOfflineMutationQueue: () => createOfflineMutationQueue,
  createPrefetchScheduler: () => createPrefetchScheduler,
  createQueryClient: () => createQueryClient,
  createSocketCacheBridge: () => createSocketCacheBridge,
  createSseCacheBridge: () => createSseCacheBridge,
  createStoreEventReporter: () => createStoreEventReporter,
  createWebRtcPeer: () => createWebRtcPeer,
  exportCacheSnapshot: () => exportCacheSnapshot,
  getAuthToken: () => getAuthToken,
  importCacheSnapshot: () => importCacheSnapshot,
  setAuthToken: () => setAuthToken,
  setListCache: () => setListCache,
  startPresenceTtl: () => startPresenceTtl,
  useInfiniteQuery: () => useInfiniteQuery,
  useMutation: () => useMutation,
  useQuery: () => useQuery,
  useQueryStore: () => useQueryStore,
  useSimpleInfiniteQuery: () => useSimpleInfiniteQuery,
  useSimpleMutation: () => useSimpleMutation,
  useSimpleQuery: () => useSimpleQuery,
  wrapFetcher: () => wrapFetcher
});
module.exports = __toCommonJS(index_exports);

// src/api.ts
var import_fetch = require("@better-fetch/fetch");

// src/auth/token.ts
var authToken;
var setAuthToken = (token) => {
  authToken = token;
};
var clearAuthToken = () => {
  authToken = void 0;
};
var getAuthToken = () => authToken;

// src/api.ts
var api = (0, import_fetch.createFetch)({
  baseURL: "/api",
  throw: true,
  auth: {
    type: "Bearer",
    token: () => getAuthToken()
  },
  retry: {
    type: "linear",
    attempts: 3,
    delay: 300
  }
});

// src/api/client.ts
var resolveRetry = (path, rules) => {
  if (!rules) return void 0;
  const matched = rules.find((rule) => path.startsWith(rule.prefix));
  return matched?.retry;
};
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var runWithRetry = async (fn, retryCfg) => {
  const cfg = retryCfg ?? { attempts: 1 };
  const attempts = Math.max(1, cfg.attempts ?? 1);
  const retryOn = cfg.retryOn ?? (() => true);
  const delayCfg = cfg.delay ?? 0;
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      if (!retryOn(err, i + 1)) break;
      const ms = typeof delayCfg === "function" ? delayCfg(i + 1) : delayCfg;
      if (ms > 0) await sleep(ms);
    }
  }
  throw lastErr;
};
var createApiClient = (options = {}) => {
  const baseURL = options.baseURL ?? "/api";
  const tokenFn = options.getAuthToken ?? getAuthToken;
  const plugins = options.plugins ?? [];
  const request = async (path, init = {}) => {
    const url = `${baseURL}${path}`;
    const headers = new Headers(init.headers ?? {});
    const token = tokenFn();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const finalInit = { ...init, headers };
    plugins.forEach((p) => p.onRequest?.(url, finalInit));
    const retryCfg = resolveRetry(path, options.retryRules) ?? options.defaultRetry;
    return runWithRetry(async () => {
      try {
        const res = await fetch(url, finalInit);
        plugins.forEach((p) => p.onResponse?.(res));
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        plugins.forEach((p) => p.onError?.(err));
        throw err;
      }
    }, retryCfg);
  };
  return {
    request,
    get: (path, init) => request(path, { ...init, method: "GET" }),
    post: (path, body, init) => request(path, {
      ...init,
      method: "POST",
      body: body !== void 0 ? JSON.stringify(body) : void 0,
      headers: { "Content-Type": "application/json", ...init?.headers ?? {} }
    }),
    put: (path, body, init) => request(path, {
      ...init,
      method: "PUT",
      body: body !== void 0 ? JSON.stringify(body) : void 0,
      headers: { "Content-Type": "application/json", ...init?.headers ?? {} }
    }),
    patch: (path, body, init) => request(path, {
      ...init,
      method: "PATCH",
      body: body !== void 0 ? JSON.stringify(body) : void 0,
      headers: { "Content-Type": "application/json", ...init?.headers ?? {} }
    }),
    delete: (path, init) => request(path, { ...init, method: "DELETE" })
  };
};

// src/store/client.ts
var import_zustand = require("zustand");

// src/store/defaults.ts
var DEFAULT_STALE_TIME = 3e4;
var DEFAULT_CACHE_TIME = 5 * 6e4;
var createMetrics = () => ({
  hits: 0,
  misses: 0,
  fetches: 0,
  backgroundFetches: 0,
  dedupes: 0,
  errors: 0,
  invalidations: 0,
  gcEvictions: 0,
  lruEvictions: 0,
  prefetched: 0,
  mutations: 0,
  optimisticApplied: 0,
  optimisticRolledBack: 0,
  aborts: 0,
  retries: 0
});
var defaultConfig = {
  maxEntries: 200,
  persistence: {
    mode: "indexeddb",
    storageKey: "__query_cache__",
    dbName: "__query_cache_db__",
    storeName: "cache",
    flushDebounceMs: 250
  },
  debug: false,
  refetchOnFocus: true,
  refetchOnReconnect: false,
  refetchOnOnline: false,
  retry: {
    attempts: 1,
    delay: 300,
    retryOn: () => true
  },
  staleWhileRevalidate: false,
  selectMemoMaxEntries: 500,
  structuralSharing: true,
  gcIntervalMs: 6e4,
  suspense: false,
  throwOnError: false,
  queryDefaults: [],
  mutationDefaults: [],
  multiTabSync: {
    enabled: false,
    channelName: "__query_store_sync__"
  },
  devtools: {
    enabled: true,
    exposeToWindow: true,
    emitEvents: false,
    eventName: "__query_store__",
    overlay: {
      enabled: false,
      position: "bottom-right"
    }
  }
};

// src/utils/keys.ts
var stableStringify = (value) => {
  const stack = /* @__PURE__ */ new Set();
  const walk = (val) => {
    if (val === null) return "null";
    const type = typeof val;
    if (type === "string") return JSON.stringify(val);
    if (type === "number") return Number.isFinite(val) ? String(val) : "null";
    if (type === "boolean") return val ? "true" : "false";
    if (type === "undefined") return '"__undefined__"';
    if (type === "bigint") return JSON.stringify(`__bigint__:${val}`);
    if (type === "function") return '"__function__"';
    if (val instanceof Date) return JSON.stringify(`__date__:${val.toISOString()}`);
    if (Array.isArray(val)) {
      return `[${val.map((item) => walk(item)).join(",")}]`;
    }
    if (type === "object") {
      if (stack.has(val)) throw new Error("Circular value in query key");
      stack.add(val);
      const obj = val;
      const keys = Object.keys(obj).sort();
      const result = `{${keys.map((k) => `${JSON.stringify(k)}:${walk(obj[k])}`).join(",")}}`;
      stack.delete(val);
      return result;
    }
    return '"__unknown__"';
  };
  return walk(value);
};
var hashKey = (key) => {
  if (typeof key === "string") return key;
  return `k:${stableStringify(key)}`;
};
var keyToString = (key) => {
  if (typeof key === "string") return key;
  const first = key[0];
  if (typeof first === "string") return first;
  return hashKey(key);
};

// src/utils/equality.ts
var isPlainObject = (value) => {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
var replaceEqualDeep = (a, b) => {
  if (a === b) return a;
  if (Array.isArray(a) && Array.isArray(b)) {
    const length = b.length;
    const result = new Array(length);
    let equal = a.length === length;
    for (let i = 0; i < length; i += 1) {
      result[i] = replaceEqualDeep(a[i], b[i]);
      if (result[i] !== a[i]) equal = false;
    }
    return equal ? a : result;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      const out2 = {};
      bKeys.forEach((k) => {
        out2[k] = replaceEqualDeep(a[k], b[k]);
      });
      return out2;
    }
    let equal = true;
    const out = {};
    bKeys.forEach((k) => {
      const value = replaceEqualDeep(a[k], b[k]);
      out[k] = value;
      if (value !== a[k]) equal = false;
    });
    return equal ? a : out;
  }
  return b;
};

// src/utils/retry.ts
var isAbortError = (e) => {
  if (!e) return false;
  const anyE = e;
  return anyE?.name === "AbortError" || anyE?.code === 20;
};
var sleep2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var runWithRetry2 = async (fn, retryCfg, onRetryBump, onRetryEmit) => {
  const attempts = Math.max(1, retryCfg.attempts ?? 1);
  const retryOn = retryCfg.retryOn ?? (() => true);
  const delayCfg = retryCfg.delay ?? 0;
  let lastErr;
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
      const ms = typeof delayCfg === "function" ? delayCfg(i + 1) : delayCfg;
      if (ms > 0) await sleep2(ms);
    }
  }
  throw lastErr;
};

// src/storage/idb.ts
function idbOpen(dbName, storeName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(dbName, storeName, key, value) {
  const db = await idbOpen(dbName, storeName);
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(storeName).put({ key, value });
  });
  db.close();
}
async function idbGet(dbName, storeName, key) {
  const db = await idbOpen(dbName, storeName);
  const result = await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result?.value ?? void 0);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

// src/store/client.ts
function createQueryClient(userConfig) {
  const { multiTabSync: multiTabSyncOverride, ...userOverrides } = userConfig ?? {};
  const cfg = {
    ...defaultConfig,
    ...userOverrides,
    persistence: {
      ...defaultConfig.persistence,
      ...userOverrides.persistence ?? {}
    },
    retry: {
      ...defaultConfig.retry,
      ...userOverrides.retry ?? {}
    },
    multiTabSync: {
      ...defaultConfig.multiTabSync,
      ...multiTabSyncOverride ?? {}
    },
    devtools: {
      ...defaultConfig.devtools,
      ...userOverrides.devtools ?? {}
    }
  };
  const fetchers = /* @__PURE__ */ new Map();
  const infiniteFetchers = /* @__PURE__ */ new Map();
  const keyMap = /* @__PURE__ */ new Map();
  const resolveKey = (hashedKey) => keyMap.get(hashedKey) ?? hashedKey;
  const pollers = /* @__PURE__ */ new Map();
  const selectMemo = /* @__PURE__ */ new Map();
  const tagIndex = /* @__PURE__ */ new Map();
  const aborters = /* @__PURE__ */ new Map();
  const mutationAborters = /* @__PURE__ */ new Map();
  const observers = /* @__PURE__ */ new Map();
  const inFlightMeta = /* @__PURE__ */ new Map();
  let batchDepth = 0;
  let pendingQueries = null;
  let flushRequested = false;
  let flushTimer = null;
  const isBrowser = typeof window !== "undefined";
  const instanceId = Math.random().toString(36).slice(2);
  const channel = isBrowser && cfg.multiTabSync.enabled && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(cfg.multiTabSync.channelName) : null;
  let suppressBroadcast = false;
  const broadcast = (message) => {
    if (!channel || suppressBroadcast) return;
    channel.postMessage({ ...message, sourceId: instanceId });
  };
  const getQueryDefaultOptions = (key, config) => {
    const keyStr = keyToString(key);
    const defaults = config.queryDefaults ?? [];
    let merged = {};
    defaults.forEach((entry) => {
      if (keyStr.startsWith(entry.prefix)) {
        merged = { ...merged, ...entry.options };
      }
    });
    return merged;
  };
  const getMutationDefaultOptions = (key, config) => {
    if (!key) return {};
    const keyStr = keyToString(key);
    const defaults = config.mutationDefaults ?? [];
    let merged = {};
    defaults.forEach((entry) => {
      if (keyStr.startsWith(entry.key)) {
        merged = { ...merged, ...entry.options };
      }
    });
    return merged;
  };
  const applyStructuralSharing = (prev, next) => {
    if (!cfg.structuralSharing) return next;
    if (prev === void 0) return next;
    if (next === void 0) return next;
    return replaceEqualDeep(prev, next);
  };
  const store = (0, import_zustand.create)((set, get) => ({
    config: cfg,
    queries: {},
    inFlight: {},
    mutations: {},
    metrics: createMetrics(),
    dehydrate() {
      return serializeQueries(get().queries);
    },
    hydrate(data) {
      set({
        queries: Object.fromEntries(
          Object.entries(data).map(([k, q]) => [
            k,
            {
              ...q,
              staleTime: q.staleTime ?? DEFAULT_STALE_TIME,
              cacheTime: q.cacheTime ?? DEFAULT_CACHE_TIME,
              tags: q.tags ?? [],
              retry: q.retry,
              keyString: q.keyString ?? k
            }
          ])
        )
      });
      tagIndex.clear();
      selectMemo.clear();
      Object.entries(get().queries).forEach(([k, q]) => {
        keyMap.set(k, k);
        (q.tags ?? []).forEach((t) => {
          if (!tagIndex.has(t)) tagIndex.set(t, /* @__PURE__ */ new Set());
          tagIndex.get(t).add(k);
        });
      });
      if (isBrowser) {
        Object.entries(get().queries).forEach(([k, q]) => {
          ensurePoller(k, q.refetchInterval);
        });
      }
      devtoolsEmit("hydrate", { keys: Object.keys(get().queries) });
    },
    async fetchQuery(key, options) {
      const hashedKey = hashKey(key);
      keyMap.set(hashedKey, key);
      const defaults = getQueryDefaultOptions(key, get().config);
      const {
        suspense: _s,
        throwOnError: _t,
        keepPreviousData: _k,
        initialData: _i,
        placeholderData: _p,
        ...fetchDefaults
      } = defaults;
      const mergedOptions = {
        ...fetchDefaults,
        ...options,
        retry: options.retry ?? defaults.retry,
        tags: options.tags ?? defaults.tags,
        refetchInterval: options.refetchInterval ?? defaults.refetchInterval,
        abortOnNewFetch: options.abortOnNewFetch ?? defaults.abortOnNewFetch,
        background: options.background ?? defaults.background,
        skipStaleWhileRevalidate: options.skipStaleWhileRevalidate ?? false,
        staleTime: options.staleTime ?? defaults.staleTime,
        cacheTime: options.cacheTime ?? defaults.cacheTime
      };
      const {
        fetcher,
        staleTime = DEFAULT_STALE_TIME,
        cacheTime = DEFAULT_CACHE_TIME,
        background = false,
        skipStaleWhileRevalidate = false,
        meta,
        refetchInterval,
        tags,
        retry,
        abortOnNewFetch = true,
        onSuccess,
        onError,
        onSettled
      } = mergedOptions;
      fetchers.set(hashedKey, fetcher);
      setEntry(hashedKey, {
        staleTime,
        cacheTime,
        fetcher,
        refetchInterval,
        tags: tags ?? get().queries[hashedKey]?.tags ?? [],
        retry: retry ?? get().queries[hashedKey]?.retry,
        meta: meta ?? get().queries[hashedKey]?.meta,
        keyString: get().queries[hashedKey]?.keyString ?? keyToString(key)
      });
      syncTagsIndex(hashedKey, tags);
      ensurePoller(hashedKey, refetchInterval);
      const state = get();
      const entry = state.queries[hashedKey];
      const now = Date.now();
      const isStale = !entry?.fetchedAt || now - entry.fetchedAt > (entry?.staleTime ?? staleTime);
      if (entry?.data !== void 0 && !isStale) {
        bump({ hits: 1 });
        touch(hashedKey);
        debugLog("hit", hashedKey);
        devtoolsEmit("hit", { key: hashedKey });
        return entry.data;
      }
      if (state.inFlight[hashedKey]) {
        bump({ dedupes: 1 });
        debugLog("dedupe", hashedKey);
        devtoolsEmit("dedupe", { key: hashedKey });
        return state.inFlight[hashedKey];
      }
      const shouldBackground = entry?.data !== void 0 && isStale && !skipStaleWhileRevalidate && (background || get().config.staleWhileRevalidate);
      if (shouldBackground) {
        if (get().inFlight[hashedKey]) {
          bump({ dedupes: 1, backgroundFetches: 1 });
          debugLog("dedupe", hashedKey);
          devtoolsEmit("dedupe", { key: hashedKey });
          return entry.data;
        }
        bump({ hits: 1, backgroundFetches: 1 });
        debugLog("stale-hit+bg", hashedKey);
        devtoolsEmit("stale-hit+bg", { key: hashedKey });
        const originalKey = resolveKey(hashedKey);
        get().fetchQuery(originalKey, {
          ...mergedOptions,
          background: false,
          skipStaleWhileRevalidate: true
        }).catch(() => {
        });
        touch(hashedKey);
        return entry.data;
      }
      if (abortOnNewFetch) {
        get().abort(hashedKey);
      }
      bump({ misses: 1, fetches: 1 });
      debugLog("miss(fetch)", hashedKey);
      devtoolsEmit("miss(fetch)", { key: hashedKey });
      const controller = isBrowser ? new AbortController() : void 0;
      if (controller) aborters.set(hashedKey, controller);
      const promise = (async () => {
        try {
          const data = await runWithRetry2(
            async (attemptIndex) => {
              if (controller?.signal?.aborted) {
                throw controller.signal.reason ?? new DOMException("Aborted", "AbortError");
              }
              const f = fetcher;
              const maybePromise = typeof f === "function" && f.length >= 1 ? f({ signal: controller?.signal }) : f();
              return await maybePromise;
            },
            retry ?? entry?.retry ?? get().config.retry,
            (n) => bump({ retries: n }),
            (attempt, attempts) => devtoolsEmit("retry", { attempt, attempts })
          );
          setEntry(hashedKey, {
            data,
            error: void 0,
            fetchedAt: Date.now(),
            accessedAt: Date.now(),
            staleTime,
            cacheTime,
            refetchInterval,
            fetcher,
            tags: tags ?? get().queries[hashedKey]?.tags ?? [],
            retry: retry ?? get().queries[hashedKey]?.retry,
            meta: meta ?? get().queries[hashedKey]?.meta,
            keyString: get().queries[hashedKey]?.keyString ?? keyToString(key)
          });
          evictLRUIfNeeded();
          scheduleFlush();
          devtoolsEmit("fetch:success", { key: hashedKey });
          onSuccess?.(data);
          onSettled?.(data, void 0);
          return data;
        } catch (error) {
          if (isAbortError(error)) {
            bump({ aborts: 1 });
            setEntry(hashedKey, {
              error,
              fetchedAt: Date.now(),
              fetcher,
              lastAbortAt: Date.now(),
              meta: meta ?? get().queries[hashedKey]?.meta,
              keyString: get().queries[hashedKey]?.keyString ?? keyToString(key)
            });
            scheduleFlush();
            devtoolsEmit("fetch:abort", { key: hashedKey });
            throw error;
          }
          bump({ errors: 1 });
          setEntry(hashedKey, {
            error,
            fetchedAt: Date.now(),
            fetcher,
            meta: meta ?? get().queries[hashedKey]?.meta,
            keyString: get().queries[hashedKey]?.keyString ?? keyToString(key)
          });
          scheduleFlush();
          devtoolsEmit("fetch:error", { key: hashedKey });
          onError?.(error);
          onSettled?.(void 0, error);
          throw error;
        } finally {
          set((s) => {
            const next = { ...s.inFlight };
            delete next[hashedKey];
            return { inFlight: next };
          });
          if (controller && aborters.get(hashedKey) === controller) {
            aborters.delete(hashedKey);
          }
        }
      })();
      set((s) => ({ inFlight: { ...s.inFlight, [hashedKey]: promise } }));
      return promise;
    },
    async fetchInfiniteQuery(key, options) {
      const hashedKey = hashKey(key);
      keyMap.set(hashedKey, key);
      const defaults = getQueryDefaultOptions(key, get().config);
      const {
        suspense: _s,
        throwOnError: _t,
        keepPreviousData: _k,
        initialData: _i,
        placeholderData: _p,
        ...fetchDefaults
      } = defaults;
      const mergedOptions = {
        ...fetchDefaults,
        ...options,
        retry: options.retry ?? defaults.retry,
        tags: options.tags ?? defaults.tags,
        refetchInterval: options.refetchInterval ?? defaults.refetchInterval,
        abortOnNewFetch: options.abortOnNewFetch ?? defaults.abortOnNewFetch,
        background: options.background ?? defaults.background,
        staleTime: options.staleTime ?? defaults.staleTime,
        cacheTime: options.cacheTime ?? defaults.cacheTime
      };
      const {
        fetcher,
        pageParam,
        direction = "init",
        staleTime = DEFAULT_STALE_TIME,
        cacheTime = DEFAULT_CACHE_TIME,
        background = false,
        meta,
        refetchInterval,
        tags,
        retry,
        abortOnNewFetch = true,
        onSuccess,
        onError,
        onSettled
      } = mergedOptions;
      infiniteFetchers.set(
        hashedKey,
        fetcher
      );
      setEntry(hashedKey, {
        staleTime,
        cacheTime,
        refetchInterval,
        tags: tags ?? get().queries[hashedKey]?.tags ?? [],
        retry: retry ?? get().queries[hashedKey]?.retry,
        meta: meta ?? get().queries[hashedKey]?.meta,
        keyString: get().queries[hashedKey]?.keyString ?? keyToString(key)
      });
      syncTagsIndex(hashedKey, tags);
      ensurePoller(hashedKey, refetchInterval);
      const state = get();
      const entry = state.queries[hashedKey];
      const now = Date.now();
      const isStale = !entry?.fetchedAt || now - entry.fetchedAt > (entry?.staleTime ?? staleTime);
      const current = entry?.data;
      if (direction === "init" && current && !isStale && !background) {
        bump({ hits: 1 });
        touch(hashedKey);
        debugLog("hit", hashedKey);
        devtoolsEmit("hit", { key: hashedKey });
        return current;
      }
      if (state.inFlight[hashedKey]) {
        bump({ dedupes: 1 });
        debugLog("dedupe", hashedKey);
        devtoolsEmit("dedupe", { key: hashedKey });
        return state.inFlight[hashedKey];
      }
      if (direction === "init" && current && isStale && (background || get().config.staleWhileRevalidate)) {
        bump({ hits: 1, backgroundFetches: 1 });
        debugLog("stale-hit+bg", hashedKey);
        devtoolsEmit("stale-hit+bg", { key: hashedKey });
        const originalKey = resolveKey(hashedKey);
        get().refetchInfiniteQuery(originalKey).catch(() => {
        });
        touch(hashedKey);
        return current;
      }
      if (abortOnNewFetch) {
        get().abort(hashedKey);
      }
      bump({ misses: 1, fetches: 1 });
      debugLog("miss(fetch)", hashedKey);
      devtoolsEmit("miss(fetch)", { key: hashedKey });
      const controller = isBrowser ? new AbortController() : void 0;
      if (controller) aborters.set(hashedKey, controller);
      inFlightMeta.set(hashedKey, { direction });
      const promise = (async () => {
        try {
          const page = await runWithRetry2(
            async () => {
              if (controller?.signal?.aborted) {
                throw controller.signal.reason ?? new DOMException("Aborted", "AbortError");
              }
              return await fetcher({ pageParam, signal: controller?.signal });
            },
            retry ?? entry?.retry ?? get().config.retry,
            (n) => bump({ retries: n }),
            (attempt, attempts) => devtoolsEmit("retry", { attempt, attempts })
          );
          let next;
          if (!current) {
            next = { pages: [page], pageParams: [pageParam] };
          } else if (direction === "backward") {
            next = {
              pages: [page, ...current.pages],
              pageParams: [pageParam, ...current.pageParams]
            };
          } else {
            next = {
              pages: [...current.pages, page],
              pageParams: [...current.pageParams, pageParam]
            };
          }
          setEntry(hashedKey, {
            data: next,
            error: void 0,
            fetchedAt: Date.now(),
            accessedAt: Date.now(),
            staleTime,
            cacheTime,
            refetchInterval,
            tags: tags ?? get().queries[hashedKey]?.tags ?? [],
            retry: retry ?? get().queries[hashedKey]?.retry,
            meta: meta ?? get().queries[hashedKey]?.meta,
            keyString: get().queries[hashedKey]?.keyString ?? keyToString(key)
          });
          evictLRUIfNeeded();
          scheduleFlush();
          devtoolsEmit("fetch:success", { key: hashedKey });
          onSuccess?.(next);
          onSettled?.(next, void 0);
          return next;
        } catch (error) {
          if (isAbortError(error)) {
            bump({ aborts: 1 });
            setEntry(hashedKey, {
              error,
              fetchedAt: Date.now(),
              lastAbortAt: Date.now(),
              meta: meta ?? get().queries[hashedKey]?.meta,
              keyString: get().queries[hashedKey]?.keyString ?? keyToString(key)
            });
            scheduleFlush();
            devtoolsEmit("fetch:abort", { key: hashedKey });
            throw error;
          }
          bump({ errors: 1 });
          setEntry(hashedKey, {
            error,
            fetchedAt: Date.now(),
            meta: meta ?? get().queries[hashedKey]?.meta,
            keyString: get().queries[hashedKey]?.keyString ?? keyToString(key)
          });
          scheduleFlush();
          devtoolsEmit("fetch:error", { key: hashedKey });
          onError?.(error);
          onSettled?.(void 0, error);
          throw error;
        } finally {
          set((s) => {
            const next = { ...s.inFlight };
            delete next[hashedKey];
            return { inFlight: next };
          });
          inFlightMeta.delete(hashedKey);
          if (controller && aborters.get(hashedKey) === controller) {
            aborters.delete(hashedKey);
          }
        }
      })();
      set((s) => ({ inFlight: { ...s.inFlight, [hashedKey]: promise } }));
      return promise;
    },
    async refetchInfiniteQuery(key) {
      const hashedKey = hashKey(key);
      const entry = get().queries[hashedKey];
      const fetcher = infiniteFetchers.get(hashedKey);
      const data = entry?.data;
      if (!entry || !fetcher || !data) return void 0;
      if (get().inFlight[hashedKey]) {
        return get().inFlight[hashedKey];
      }
      const controller = isBrowser ? new AbortController() : void 0;
      if (controller) aborters.set(hashedKey, controller);
      inFlightMeta.set(hashedKey, { direction: "init" });
      const promise = (async () => {
        try {
          const pages = [];
          for (let i = 0; i < data.pageParams.length; i += 1) {
            const pageParam = data.pageParams[i];
            const page = await runWithRetry2(
              async (_attemptIndex) => {
                if (controller?.signal?.aborted) {
                  throw controller.signal.reason ?? new DOMException("Aborted", "AbortError");
                }
                const result = await fetcher({
                  pageParam,
                  signal: controller?.signal
                });
                return result;
              },
              entry.retry ?? get().config.retry,
              (n) => bump({ retries: n }),
              (attempt, attempts) => devtoolsEmit("retry", { attempt, attempts })
            );
            pages.push(page);
          }
          const next = {
            pages,
            pageParams: data.pageParams
          };
          setEntry(hashedKey, {
            data: next,
            error: void 0,
            fetchedAt: Date.now(),
            accessedAt: Date.now()
          });
          scheduleFlush();
          devtoolsEmit("fetch:success", { key: hashedKey });
          return next;
        } catch (error) {
          if (isAbortError(error)) {
            bump({ aborts: 1 });
            setEntry(hashedKey, {
              error,
              fetchedAt: Date.now(),
              lastAbortAt: Date.now()
            });
            scheduleFlush();
            devtoolsEmit("fetch:abort", { key: hashedKey });
            throw error;
          }
          bump({ errors: 1 });
          setEntry(hashedKey, { error, fetchedAt: Date.now() });
          scheduleFlush();
          devtoolsEmit("fetch:error", { key: hashedKey });
          throw error;
        } finally {
          set((s) => {
            const next = { ...s.inFlight };
            delete next[hashedKey];
            return { inFlight: next };
          });
          inFlightMeta.delete(hashedKey);
          if (controller && aborters.get(hashedKey) === controller) {
            aborters.delete(hashedKey);
          }
        }
      })();
      set((s) => ({ inFlight: { ...s.inFlight, [hashedKey]: promise } }));
      return promise;
    },
    async prefetchQuery(key, options) {
      const hashedKey = hashKey(key);
      bump({ prefetched: 1 });
      devtoolsEmit("prefetch", { key: hashedKey });
      await get().fetchQuery(key, { ...options, background: false });
    },
    invalidate(key) {
      const hashedKey = hashKey(key);
      bump({ invalidations: 1 });
      get().abort(hashedKey);
      withDraft(
        (draft) => {
          if (!draft[hashedKey]) return;
          draft[hashedKey] = {
            ...draft[hashedKey],
            fetchedAt: 0,
            error: void 0
          };
        },
        false
      );
      scheduleFlush();
      debugLog("invalidate", hashedKey);
      devtoolsEmit("invalidate", { key: hashedKey });
      broadcast({ type: "invalidate", payload: { key: hashedKey } });
    },
    invalidateByPrefix(prefix) {
      bump({ invalidations: 1 });
      const keys = Object.keys(get().queries).filter((k) => {
        const original = keyMap.get(k) ?? k;
        const keyString = get().queries[k]?.keyString ?? keyToString(original);
        return keyString.startsWith(prefix);
      });
      keys.forEach((k) => get().abort(k));
      withDraft(
        (draft) => {
          Object.keys(draft).forEach((k) => {
            const original = keyMap.get(k) ?? k;
            const keyString = draft[k]?.keyString ?? keyToString(original);
            if (!keyString.startsWith(prefix)) return;
            draft[k] = {
              ...draft[k],
              fetchedAt: 0,
              error: void 0
            };
          });
        },
        false
      );
      scheduleFlush();
      debugLog("invalidateByPrefix", prefix);
      devtoolsEmit("invalidateByPrefix", { prefix });
      broadcast({ type: "invalidateByPrefix", payload: { prefix } });
    },
    invalidateTags(tags) {
      bump({ invalidations: 1 });
      const list = Array.isArray(tags) ? tags : [tags];
      const keysToInvalidate = /* @__PURE__ */ new Set();
      list.forEach((t) => {
        const setKeys = tagIndex.get(t);
        if (!setKeys) return;
        setKeys.forEach((k) => keysToInvalidate.add(k));
      });
      get().batch(() => {
        keysToInvalidate.forEach((k) => get().invalidate(k));
      });
      debugLog("invalidateTags", list);
      devtoolsEmit("invalidateTags", {
        tags: list,
        keys: Array.from(keysToInvalidate)
      });
      broadcast({ type: "invalidateTags", payload: { tags: list } });
    },
    cancelByTags(tags) {
      const list = Array.isArray(tags) ? tags : [tags];
      const keysToCancel = /* @__PURE__ */ new Set();
      list.forEach((t) => {
        const setKeys = tagIndex.get(t);
        if (!setKeys) return;
        setKeys.forEach((k) => keysToCancel.add(k));
      });
      keysToCancel.forEach((k) => get().abort(k));
      devtoolsEmit("cancelTags", {
        tags: list,
        keys: Array.from(keysToCancel)
      });
    },
    abort(key) {
      const hashedKey = hashKey(key);
      const controller = aborters.get(hashedKey);
      if (!controller) return;
      try {
        controller.abort();
      } catch {
      }
      aborters.delete(hashedKey);
      devtoolsEmit("abort", { key: hashedKey });
    },
    cancelMutation(key) {
      const hashedKey = hashKey(key);
      const controller = mutationAborters.get(hashedKey);
      if (!controller) return;
      try {
        controller.abort();
      } catch {
      }
      mutationAborters.delete(hashedKey);
      devtoolsEmit("mutation:abort", { key: hashedKey });
    },
    batch(fn) {
      batchDepth += 1;
      try {
        fn();
      } finally {
        batchDepth -= 1;
        if (batchDepth === 0 && pendingQueries) {
          const next = pendingQueries;
          pendingQueries = null;
          set({ queries: next });
          if (flushRequested) {
            flushRequested = false;
            scheduleFlush();
          }
          devtoolsEmit("batch:flush", {});
        }
      }
    },
    gc() {
      const now = Date.now();
      let evicted = 0;
      withDraft((draft) => {
        Object.entries(draft).forEach(([k, q]) => {
          if (!q.fetchedAt) return;
          if (now - q.fetchedAt > q.cacheTime) {
            get().abort(k);
            ensurePoller(k, void 0);
            removeKeyFromAllTags(k);
            delete draft[k];
            evicted += 1;
          }
        });
      });
      if (evicted > 0) {
        bump({ gcEvictions: evicted });
        scheduleFlush();
        debugLog("gc evicted", evicted);
        devtoolsEmit("gc", { evicted });
      }
    },
    async mutate(opts) {
      bump({ mutations: 1 });
      devtoolsEmit("mutate:start", {});
      const defaults = getMutationDefaultOptions(opts.mutationKey, get().config);
      const mergedOptions = {
        ...defaults,
        ...opts,
        retry: opts.retry ?? defaults.retry,
        abortOnNewMutation: opts.abortOnNewMutation ?? defaults.abortOnNewMutation,
        invalidateKeys: opts.invalidateKeys ?? defaults.invalidateKeys,
        invalidatePrefixes: opts.invalidatePrefixes ?? defaults.invalidatePrefixes,
        invalidateTags: opts.invalidateTags ?? defaults.invalidateTags,
        optimistic: opts.optimistic ?? defaults.optimistic,
        updateCache: opts.updateCache ?? defaults.updateCache
      };
      const {
        mutationFn,
        variables,
        optimistic,
        updateCache,
        invalidateKeys,
        invalidatePrefixes,
        invalidateTags,
        onSuccess,
        onError,
        retry,
        abortOnNewMutation = true
      } = mergedOptions;
      const mutationKey = mergedOptions.mutationKey ?? "__mutation__";
      const hashedKey = hashKey(mutationKey);
      if (abortOnNewMutation) {
        get().cancelMutation(hashedKey);
      }
      const controller = isBrowser ? new AbortController() : void 0;
      if (controller) mutationAborters.set(hashedKey, controller);
      set((s) => ({
        mutations: {
          ...s.mutations,
          [hashedKey]: {
            status: "loading",
            data: s.mutations[hashedKey]?.data,
            error: void 0,
            variables,
            updatedAt: Date.now()
          }
        }
      }));
      const snapshots = /* @__PURE__ */ new Map();
      if (optimistic && optimistic.length > 0) {
        bump({ optimisticApplied: 1 });
        get().batch(() => {
          optimistic.forEach(({ key, update }) => {
            const k = hashKey(key);
            const prev = get().queries[k]?.data;
            snapshots.set(k, prev);
            setEntry(k, {
              data: update(prev),
              accessedAt: Date.now()
            });
          });
        });
        scheduleFlush();
        debugLog(
          "optimistic applied",
          optimistic.map((o) => o.key)
        );
        devtoolsEmit("mutate:optimistic", {
          keys: optimistic.map((o) => o.key)
        });
      }
      const promise = (async () => {
        try {
          const result = await runWithRetry2(
            async () => mutationFn(variables, { signal: controller?.signal }),
            retry ?? get().config.retry,
            (n) => bump({ retries: n }),
            (attempt, attempts) => devtoolsEmit("retry", { attempt, attempts })
          );
          if (updateCache && updateCache.length > 0) {
            get().batch(() => {
              updateCache.forEach(({ key, update }) => {
                const k = hashKey(key);
                const prev = get().queries[k]?.data;
                setEntry(k, {
                  data: update(prev, result),
                  fetchedAt: Date.now(),
                  accessedAt: Date.now()
                });
              });
            });
          }
          if (invalidateKeys && invalidateKeys.length || invalidatePrefixes && invalidatePrefixes.length || invalidateTags && invalidateTags.length) {
            get().batch(() => {
              invalidateKeys?.forEach((k) => get().invalidate(k));
              invalidatePrefixes?.forEach((p) => get().invalidateByPrefix(p));
              if (invalidateTags?.length) get().invalidateTags(invalidateTags);
            });
          }
          scheduleFlush();
          onSuccess?.(result, variables);
          devtoolsEmit("mutate:success", {});
          set((s) => ({
            mutations: {
              ...s.mutations,
              [hashedKey]: {
                status: "success",
                data: result,
                error: void 0,
                variables,
                updatedAt: Date.now()
              }
            }
          }));
          return result;
        } catch (error) {
          if (optimistic && optimistic.length > 0) {
            bump({ optimisticRolledBack: 1 });
            get().batch(() => {
              optimistic.forEach(({ key }) => {
                const k = hashKey(key);
                const prev = snapshots.get(k);
                setEntry(k, { data: prev, accessedAt: Date.now() });
              });
            });
            scheduleFlush();
            debugLog("optimistic rollback");
            devtoolsEmit("mutate:rollback", {
              keys: optimistic.map((o) => o.key)
            });
          }
          onError?.(error, variables);
          devtoolsEmit("mutate:error", {});
          set((s) => ({
            mutations: {
              ...s.mutations,
              [hashedKey]: {
                status: "error",
                data: s.mutations[hashedKey]?.data,
                error,
                variables,
                updatedAt: Date.now()
              }
            }
          }));
          throw error;
        } finally {
          if (controller && mutationAborters.get(hashedKey) === controller) {
            mutationAborters.delete(hashedKey);
          }
        }
      })();
      set((s) => ({
        mutations: {
          ...s.mutations,
          [hashedKey]: {
            status: "loading",
            data: s.mutations[hashedKey]?.data,
            error: void 0,
            variables,
            promise,
            updatedAt: Date.now()
          }
        }
      }));
      return promise;
    },
    setDebug(debug) {
      set((s) => ({ config: { ...s.config, debug } }));
      devtoolsEmit("config:debug", { debug });
    },
    setConfig(partial) {
      set((s) => ({
        config: {
          ...s.config,
          ...partial,
          persistence: {
            ...s.config.persistence,
            ...partial.persistence ?? {}
          },
          retry: {
            ...s.config.retry,
            ...partial.retry ?? {}
          },
          multiTabSync: {
            ...s.config.multiTabSync,
            ...partial.multiTabSync ?? {}
          },
          devtools: {
            ...s.config.devtools,
            ...partial.devtools ?? {}
          }
        }
      }));
      devtoolsEmit("config:set", { partial });
    },
    getMutation(key) {
      const hashedKey = hashKey(key);
      return get().mutations[hashedKey];
    },
    setQueryData(key, data, options) {
      const hashedKey = hashKey(key);
      keyMap.set(hashedKey, key);
      setEntry(hashedKey, {
        data,
        error: void 0,
        fetchedAt: options?.fetchedAt ?? Date.now(),
        accessedAt: Date.now(),
        staleTime: options?.staleTime ?? get().queries[hashedKey]?.staleTime ?? DEFAULT_STALE_TIME,
        cacheTime: options?.cacheTime ?? get().queries[hashedKey]?.cacheTime ?? DEFAULT_CACHE_TIME,
        refetchInterval: options?.refetchInterval ?? get().queries[hashedKey]?.refetchInterval,
        tags: options?.tags ?? get().queries[hashedKey]?.tags ?? [],
        retry: options?.retry ?? get().queries[hashedKey]?.retry,
        meta: options?.meta ?? get().queries[hashedKey]?.meta,
        keyString: get().queries[hashedKey]?.keyString ?? keyToString(key)
      });
      syncTagsIndex(hashedKey, options?.tags);
      evictLRUIfNeeded();
      scheduleFlush();
      devtoolsEmit("setQueryData", { key: hashedKey });
    },
    addObserver(key) {
      const hashedKey = hashKey(key);
      const next = (observers.get(hashedKey) ?? 0) + 1;
      observers.set(hashedKey, next);
      devtoolsEmit("observer:add", { key: hashedKey, count: next });
    },
    removeObserver(key) {
      const hashedKey = hashKey(key);
      const prev = observers.get(hashedKey) ?? 0;
      const next = Math.max(0, prev - 1);
      if (next === 0) observers.delete(hashedKey);
      else observers.set(hashedKey, next);
      devtoolsEmit("observer:remove", { key: hashedKey, count: next });
    },
    getObserversCount(key) {
      const hashedKey = hashKey(key);
      return observers.get(hashedKey) ?? 0;
    },
    getInFlightDirection(key) {
      const hashedKey = hashKey(key);
      return inFlightMeta.get(hashedKey)?.direction;
    },
    clear() {
      Object.keys(get().queries).forEach((k) => get().abort(k));
      if (isBrowser) {
        pollers.forEach((p) => window.clearInterval(p.timer));
      }
      pollers.clear();
      fetchers.clear();
      infiniteFetchers.clear();
      selectMemo.clear();
      tagIndex.clear();
      aborters.clear();
      mutationAborters.clear();
      keyMap.clear();
      observers.clear();
      inFlightMeta.clear();
      set({ queries: {}, inFlight: {}, mutations: {} });
      scheduleFlush();
      debugLog("clear");
      devtoolsEmit("clear", {});
      broadcast({ type: "clear", payload: {} });
    },
    getSnapshot() {
      const s = get();
      return {
        config: s.config,
        metrics: s.metrics,
        queryKeys: Object.keys(s.queries),
        inFlightKeys: Object.keys(s.inFlight).filter((k) => !!s.inFlight[k]),
        mutationKeys: Object.keys(s.mutations)
      };
    }
  }));
  const debugLog = (...args) => {
    const { config } = store.getState();
    if (!config.debug) return;
    console.debug("[QueryStore]", ...args);
  };
  const bump = (partial) => {
    store.setState((s) => ({
      metrics: {
        ...s.metrics,
        ...Object.fromEntries(
          Object.entries(partial).map(([k, v]) => [
            k,
            s.metrics[k] + v
          ])
        )
      }
    }));
  };
  const serializeQueries = (queries) => {
    const out = {};
    Object.entries(queries).forEach(([k, q]) => {
      const { fetcher: _f, error: _e, meta: _m, ...rest } = q;
      out[k] = rest;
    });
    return out;
  };
  const devtoolsEmit = (type, payload) => {
    const { devtools } = store.getState().config;
    if (!isBrowser) return;
    if (!devtools.enabled) return;
    if (devtools.emitEvents) {
      try {
        window.dispatchEvent(
          new CustomEvent(devtools.eventName, {
            detail: { type, payload, ts: Date.now() }
          })
        );
      } catch {
      }
    }
    if (store.getState().config.debug) {
      debugLog("event", type, payload);
    }
  };
  const scheduleFlush = () => {
    if (!isBrowser) return;
    const { persistence } = store.getState().config;
    if (persistence.mode === "none") return;
    if (flushTimer) window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(async () => {
      flushTimer = null;
      const { config, queries } = store.getState();
      const payload = serializeQueries(queries);
      try {
        if (config.persistence.mode === "session") {
          sessionStorage.setItem(
            config.persistence.storageKey,
            JSON.stringify(payload)
          );
          debugLog("persist(session) ok");
        } else if (config.persistence.mode === "indexeddb") {
          await idbSet(
            config.persistence.dbName,
            config.persistence.storeName,
            config.persistence.storageKey,
            payload
          );
          debugLog("persist(indexeddb) ok");
        }
      } catch (e) {
        debugLog("persist failed", e);
      }
    }, store.getState().config.persistence.flushDebounceMs);
  };
  const restorePersisted = async () => {
    if (!isBrowser) return;
    const { persistence } = store.getState().config;
    if (persistence.mode === "none") return;
    try {
      if (persistence.mode === "session") {
        const raw = sessionStorage.getItem(persistence.storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        store.getState().hydrate(parsed);
        debugLog("restore(session) ok");
      } else if (persistence.mode === "indexeddb") {
        const parsed = await idbGet(persistence.dbName, persistence.storeName, persistence.storageKey);
        if (!parsed) return;
        store.getState().hydrate(parsed);
        debugLog("restore(indexeddb) ok");
      }
    } catch (e) {
      debugLog("restore failed", e);
    }
  };
  const withDraft = (fn, flush = true) => {
    if (batchDepth > 0) {
      if (!pendingQueries) pendingQueries = { ...store.getState().queries };
      fn(pendingQueries);
      if (flush) flushRequested = true;
      return;
    }
    store.setState((s) => {
      const next = { ...s.queries };
      fn(next);
      return { queries: next };
    });
    if (flush) scheduleFlush();
  };
  const setEntry = (key, patch) => {
    withDraft((draft) => {
      const prev = draft[key];
      const hasData = Object.prototype.hasOwnProperty.call(patch, "data");
      const nextData = hasData ? applyStructuralSharing(prev?.data, patch.data) : prev?.data;
      draft[key] = {
        data: nextData,
        error: prev?.error,
        meta: prev?.meta,
        keyString: prev?.keyString,
        fetchedAt: prev?.fetchedAt,
        accessedAt: prev?.accessedAt,
        staleTime: prev?.staleTime ?? DEFAULT_STALE_TIME,
        cacheTime: prev?.cacheTime ?? DEFAULT_CACHE_TIME,
        refetchInterval: prev?.refetchInterval,
        fetcher: prev?.fetcher,
        tags: prev?.tags ?? [],
        retry: prev?.retry,
        lastAbortAt: prev?.lastAbortAt,
        ...patch
      };
    });
  };
  const touch = (key) => {
    setEntry(key, { accessedAt: Date.now() });
  };
  const evictLRUIfNeeded = () => {
    const { maxEntries } = store.getState().config;
    const queries = store.getState().queries;
    const keys = Object.keys(queries);
    if (keys.length <= maxEntries) return;
    const sorted = keys.map((k) => {
      const q = queries[k];
      const t = q.accessedAt ?? q.fetchedAt ?? 0;
      return { k, t };
    }).sort((a, b) => a.t - b.t);
    const toRemove = sorted.slice(0, Math.max(0, keys.length - maxEntries));
    if (toRemove.length === 0) return;
    store.getState().batch(() => {
      toRemove.forEach(({ k }) => {
        store.getState().invalidate(k);
      });
    });
    bump({ lruEvictions: toRemove.length });
    debugLog(
      "LRU evicted",
      toRemove.map((x) => x.k)
    );
    devtoolsEmit("lru", { keys: toRemove.map((x) => x.k) });
  };
  const ensurePoller = (key, interval) => {
    if (!isBrowser) return;
    if (!interval || interval <= 0) {
      const existing2 = pollers.get(key);
      if (existing2) window.clearInterval(existing2.timer);
      pollers.delete(key);
      return;
    }
    const existing = pollers.get(key);
    if (existing && existing.interval === interval) return;
    if (existing) window.clearInterval(existing.timer);
    const timer = window.setInterval(() => {
      const fetcher = fetchers.get(key);
      const entry = store.getState().queries[key];
      if (!fetcher || !entry) return;
      const originalKey = resolveKey(key);
      if (infiniteFetchers.has(key)) {
        store.getState().refetchInfiniteQuery(originalKey).catch(() => {
        });
        return;
      }
      store.getState().fetchQuery(originalKey, {
        fetcher,
        staleTime: entry.staleTime,
        cacheTime: entry.cacheTime,
        background: true,
        skipStaleWhileRevalidate: true,
        refetchInterval: interval,
        tags: entry.tags,
        retry: entry.retry
      }).catch(() => {
      });
    }, interval);
    pollers.set(key, { timer, interval });
  };
  const syncTagsIndex = (key, nextTags) => {
    if (!nextTags) return;
    removeKeyFromAllTags(key);
    nextTags.forEach((t) => {
      if (!tagIndex.has(t)) tagIndex.set(t, /* @__PURE__ */ new Set());
      tagIndex.get(t).add(key);
    });
  };
  const removeKeyFromAllTags = (key) => {
    tagIndex.forEach((setKeys) => {
      setKeys.delete(key);
    });
    Array.from(tagIndex.entries()).forEach(([t, setKeys]) => {
      if (setKeys.size === 0) tagIndex.delete(t);
    });
  };
  const refetchStaleQueries = () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const { queries, fetchQuery } = store.getState();
    Object.entries(queries).forEach(([key, q]) => {
      const observersCount = observers.get(key) ?? 0;
      if (observersCount === 0) return;
      if (!q.data) return;
      const isStale = !q.fetchedAt || Date.now() - q.fetchedAt > q.staleTime;
      if (!isStale) return;
      bump({ backgroundFetches: 1 });
      const originalKey = resolveKey(key);
      if (infiniteFetchers.has(key)) {
        store.getState().refetchInfiniteQuery(originalKey).catch(() => {
        });
        return;
      }
      const f = fetchers.get(key);
      if (!f) return;
      fetchQuery(originalKey, {
        fetcher: f,
        staleTime: q.staleTime,
        cacheTime: q.cacheTime,
        background: true,
        skipStaleWhileRevalidate: true,
        refetchInterval: q.refetchInterval,
        tags: q.tags,
        retry: q.retry
      }).catch(() => {
      });
    });
  };
  if (isBrowser) {
    restorePersisted().catch(() => {
    });
    if (cfg.refetchOnFocus) {
      window.addEventListener("focus", () => {
        refetchStaleQueries();
      });
    }
    if (cfg.refetchOnOnline) {
      window.addEventListener("online", () => {
        refetchStaleQueries();
      });
    }
    if (cfg.refetchOnReconnect) {
      window.addEventListener("focus", () => {
        refetchStaleQueries();
      });
    }
    if (cfg.devtools.enabled && cfg.devtools.exposeToWindow) {
      window.__QUERY_STORE__ = store;
      window.__QUERY_STORE_GET_SNAPSHOT__ = () => store.getState().getSnapshot();
      devtoolsEmit("devtools:exposed", {});
    }
    if (cfg.devtools.overlay?.enabled) {
      const position = cfg.devtools.overlay.position ?? "bottom-right";
      const styleBase = "position:fixed;z-index:2147483647;padding:8px 10px;background:#0f1115;color:#f8f8f2;border-radius:8px;font:12px/1.4 monospace;opacity:0.9;";
      const positionStyle = position === "bottom-left" ? "bottom:12px;left:12px;" : position === "top-right" ? "top:12px;right:12px;" : position === "top-left" ? "top:12px;left:12px;" : "bottom:12px;right:12px;";
      const root = document.createElement("div");
      root.setAttribute("style", `${styleBase}${positionStyle}`);
      const render = () => {
        const { metrics, queries, inFlight, mutations } = store.getState();
        root.textContent = `queries:${Object.keys(queries).length} inFlight:${Object.keys(inFlight).filter((k) => !!inFlight[k]).length} mutations:${Object.keys(mutations).length} hits:${metrics.hits} misses:${metrics.misses} errors:${metrics.errors}`;
      };
      render();
      document.body.appendChild(root);
      store.subscribe(render);
    }
    if (cfg.multiTabSync.enabled && channel) {
      channel.onmessage = (event) => {
        const message = event.data;
        if (message.sourceId === instanceId) return;
        suppressBroadcast = true;
        try {
          if (message.type === "invalidate") {
            store.getState().invalidate(message.payload.key);
          }
          if (message.type === "invalidateByPrefix") {
            store.getState().invalidateByPrefix(message.payload.prefix);
          }
          if (message.type === "invalidateTags") {
            store.getState().invalidateTags(message.payload.tags);
          }
          if (message.type === "clear") {
            store.getState().clear();
          }
        } finally {
          suppressBroadcast = false;
        }
      };
    }
  }
  if (cfg.gcIntervalMs && isBrowser) {
    window.setInterval(() => {
      store.getState().gc();
    }, cfg.gcIntervalMs);
  }
  return store;
}
var useQueryStore = createQueryClient();

// src/auth/betterAuth.ts
var resolveToken = (value) => {
  if (!value || typeof value !== "object") return void 0;
  const anyValue = value;
  return anyValue.token ?? anyValue.accessToken ?? anyValue.session?.token ?? anyValue.session?.accessToken ?? anyValue.data?.token ?? anyValue.data?.session?.token;
};
var createBetterAuthBridge = (client, options) => {
  const setToken = options?.setToken ?? setAuthToken;
  const getTokenFromResult = options?.getTokenFromResult ?? resolveToken;
  const getTokenFromSession = options?.getTokenFromSession ?? resolveToken;
  const clearCacheOnSignOut = options?.clearCacheOnSignOut ?? true;
  const resolveSignInEmail = () => {
    if (typeof client.signIn === "function") return client.signIn;
    return client.signIn?.email;
  };
  const resolveSignInSocial = () => {
    if (!client.signIn || typeof client.signIn === "function") return void 0;
    return client.signIn.social;
  };
  const resolveSignInOAuth2 = () => {
    if (!client.signIn || typeof client.signIn === "function") return void 0;
    return client.signIn.oauth2;
  };
  const signUpEmail = () => {
    if (typeof client.signUp === "function") return client.signUp;
    return client.signUp?.email;
  };
  const syncFromResult = (result) => {
    const token = getTokenFromResult(result);
    if (token) setToken(token);
    return result;
  };
  const refreshSession = async () => {
    if (!client.getSession) return void 0;
    const session = await client.getSession();
    const token = getTokenFromSession(session);
    setToken(token);
    return session;
  };
  const register = async (payload) => {
    const handler = signUpEmail();
    if (!handler) {
      throw new Error("better-auth client missing signUp.email");
    }
    const result = await handler(payload);
    return syncFromResult(result);
  };
  const signIn = async (payload) => {
    const handler = resolveSignInEmail();
    if (!handler) {
      throw new Error("better-auth client missing signIn.email");
    }
    const result = await handler(payload);
    return syncFromResult(result);
  };
  const signInSocial = async (payload) => {
    const handler = resolveSignInSocial();
    if (!handler) {
      throw new Error("better-auth client missing signIn.social");
    }
    const result = await handler(payload);
    return syncFromResult(result);
  };
  const signInOAuth2 = async (payload) => {
    const handler = resolveSignInOAuth2();
    if (!handler) {
      throw new Error("better-auth client missing signIn.oauth2");
    }
    const result = await handler(payload);
    return syncFromResult(result);
  };
  const signOut = async () => {
    const result = await client.signOut?.();
    clearAuthToken();
    if (clearCacheOnSignOut) {
      useQueryStore.getState().clear();
    }
    return result;
  };
  const requestPasswordReset = async (payload) => {
    if (!client.requestPasswordReset) {
      throw new Error("better-auth client missing requestPasswordReset");
    }
    return client.requestPasswordReset(payload);
  };
  const resetPassword = async (payload) => {
    if (!client.resetPassword) {
      throw new Error("better-auth client missing resetPassword");
    }
    return client.resetPassword(payload);
  };
  const changePassword = async (payload) => {
    if (!client.changePassword) {
      throw new Error("better-auth client missing changePassword");
    }
    return client.changePassword(payload);
  };
  return {
    client,
    register,
    signIn,
    signInSocial,
    signInOAuth2,
    signOut,
    refreshSession,
    requestPasswordReset,
    resetPassword,
    changePassword
  };
};

// src/auth/simple.ts
var resolveDefaultBaseURL = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }
  return "/api/auth";
};
var createAuthBridgeFromEnv = async (options = {}) => {
  let createAuthClient;
  try {
    const mod = await import("better-auth/client");
    createAuthClient = mod.createAuthClient;
    if (!createAuthClient) {
      throw new Error("better-auth/client did not export createAuthClient");
    }
  } catch (error) {
    throw new Error(
      "better-auth is required for createAuthBridgeFromEnv. Install it with `npm i better-auth`."
    );
  }
  const client = createAuthClient({
    baseURL: options.baseURL ?? resolveDefaultBaseURL(),
    plugins: options.plugins
  });
  return createBetterAuthBridge(client, {
    clearCacheOnSignOut: options.clearCacheOnSignOut
  });
};

// src/realtime/socket.ts
var createSocketCacheBridge = (options) => {
  const store = options.store ?? useQueryStore;
  const handlers = /* @__PURE__ */ new Map();
  const start = () => {
    options.events.forEach((evt) => {
      const handler = (payload) => {
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
var connectSocketCache = async (options) => {
  const { url, socketOptions, autoStart = true, ...bridgeOptions } = options;
  let ioFactory;
  try {
    const mod = await import("socket.io-client");
    ioFactory = mod.io;
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
    socket
  });
  if (autoStart) bridge.start();
  const dispose = () => {
    bridge.stop();
    if (typeof socket.disconnect === "function") {
      socket.disconnect();
      return;
    }
    if (typeof socket.close === "function") {
      socket.close();
    }
  };
  return {
    socket,
    start: bridge.start,
    stop: bridge.stop,
    dispose
  };
};

// src/realtime/sse.ts
var defaultParse = (event) => {
  if (typeof event.data !== "string") return event.data;
  try {
    return JSON.parse(event.data);
  } catch {
    return event.data;
  }
};
var createSseCacheBridge = (options) => {
  const store = options.store ?? useQueryStore;
  const handlers = /* @__PURE__ */ new Map();
  const start = () => {
    options.events.forEach((evt) => {
      const handler = (event) => {
        try {
          const parser = evt.parse ?? options.parse ?? defaultParse;
          const payload = parser(event);
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
var connectSseCache = (options) => {
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
    dispose
  };
};

// src/realtime/chat.ts
var dedupeById = (list, getId) => {
  if (!getId) return list;
  const seen = /* @__PURE__ */ new Set();
  return list.filter((item) => {
    const id = getId(item);
    if (id === void 0 || id === null) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};
var createChatRoomBridge = (options) => {
  const messageEvent = options.events?.message ?? "message:new";
  const presenceEvent = options.events?.presence ?? "presence:update";
  const typingEvent = options.events?.typing ?? "typing:update";
  const messageKey = options.messageKey ?? ["messages", options.roomId];
  const presenceKey = options.presenceKey ?? ["presence", options.roomId];
  const typingKey = options.typingKey ?? ["typing", options.roomId];
  return createSocketCacheBridge({
    socket: options.socket,
    events: [
      {
        event: messageEvent,
        key: () => messageKey,
        update: (prev, payload) => {
          const list = Array.isArray(prev) ? prev : [];
          const next = [...list, payload];
          return dedupeById(next, options.getMessageId);
        }
      },
      {
        event: presenceEvent,
        key: () => presenceKey,
        update: (_prev, payload) => payload
      },
      {
        event: typingEvent,
        key: () => typingKey,
        update: (_prev, payload) => payload
      }
    ],
    onError: options.onError
  });
};

// src/realtime/webrtc.ts
var createWebRtcPeer = (options) => {
  const pc = new RTCPeerConnection({
    iceServers: options.iceServers ?? []
  });
  let dataChannel = null;
  if (options.stream) {
    options.stream.getTracks().forEach((track) => {
      pc.addTrack(track, options.stream);
    });
  }
  pc.ontrack = (event) => options.onTrack?.(event);
  pc.onconnectionstatechange = () => options.onStateChange?.(pc.connectionState);
  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    options.onSignal({
      roomId: options.roomId,
      from: options.id,
      candidate: event.candidate.toJSON()
    });
  };
  pc.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onmessage = (msg) => options.onData?.(String(msg.data));
  };
  const ensureDataChannel = () => {
    if (dataChannel) return;
    dataChannel = pc.createDataChannel("chat");
    dataChannel.onmessage = (msg) => options.onData?.(String(msg.data));
  };
  const start = async () => {
    ensureDataChannel();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    options.onSignal({
      roomId: options.roomId,
      from: options.id,
      description: pc.localDescription ?? offer
    });
  };
  const handleSignal = async (payload) => {
    if (payload.from === options.id) return;
    if (payload.roomId !== options.roomId) return;
    if (payload.description) {
      await pc.setRemoteDescription(payload.description);
      if (payload.description.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        options.onSignal({
          roomId: options.roomId,
          from: options.id,
          description: pc.localDescription ?? answer
        });
      }
      return;
    }
    if (payload.candidate) {
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch {
      }
    }
  };
  const sendData = (data) => {
    dataChannel?.send(data);
  };
  const close = () => {
    dataChannel?.close();
    dataChannel = null;
    pc.close();
  };
  return { pc, start, handleSignal, sendData, close };
};

// src/observability/devtools.ts
var createStoreEventReporter = (options) => {
  if (typeof window === "undefined") {
    return () => {
    };
  }
  const eventName = options.eventName ?? useQueryStore.getState().config.devtools.eventName;
  const handler = (event) => {
    const detail = event.detail;
    if (!detail) return;
    options.onEvent(detail);
  };
  window.addEventListener(eventName, handler);
  return () => {
    window.removeEventListener(eventName, handler);
  };
};

// src/observability/tracing.ts
var wrapFetcher = (fetcher, handlers, meta) => {
  return async (ctx) => {
    const start = Date.now();
    handlers.onStart?.({ key: meta?.key, label: meta?.label });
    try {
      const fn = fetcher;
      const result = typeof fn === "function" && fn.length >= 1 ? fn(ctx) : fn();
      const data = await result;
      const end = Date.now();
      const trace = {
        key: meta?.key,
        label: meta?.label,
        start,
        end,
        duration: end - start,
        success: true
      };
      handlers.onSuccess?.(trace);
      handlers.onSettled?.(trace);
      return data;
    } catch (error) {
      const end = Date.now();
      const trace = {
        key: meta?.key,
        label: meta?.label,
        start,
        end,
        duration: end - start,
        success: false,
        error
      };
      handlers.onError?.(trace);
      handlers.onSettled?.(trace);
      throw error;
    }
  };
};

// src/prefetch/scheduler.ts
var createPrefetchScheduler = (options = {}) => {
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const delayMs = Math.max(0, options.delayMs ?? 0);
  const dedupe = options.dedupe ?? true;
  const maxPerSecond = Math.max(0, options.maxPerSecond ?? 0);
  const queue = [];
  const pending = /* @__PURE__ */ new Set();
  let active = 0;
  let draining = false;
  let tokens = maxPerSecond > 0 ? maxPerSecond : Infinity;
  const drain = () => {
    if (draining) return;
    draining = true;
    if (maxPerSecond > 0 && typeof window !== "undefined") {
      window.setInterval(() => {
        tokens = maxPerSecond;
      }, 1e3);
    }
    const step = () => {
      while (active < concurrency && queue.length > 0 && tokens > 0) {
        const task = queue.shift();
        const hashedKey = hashKey(task.key);
        if (dedupe) pending.delete(hashedKey);
        active += 1;
        if (maxPerSecond > 0) tokens -= 1;
        useQueryStore.getState().prefetchQuery(task.key, task.options).catch(() => {
        }).finally(() => {
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
  const schedule = (key, options2) => {
    const hashedKey = hashKey(key);
    if (dedupe && pending.has(hashedKey)) {
      return () => {
      };
    }
    if (dedupe) pending.add(hashedKey);
    queue.push({ key, options: options2 });
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

// src/store/versioning.ts
var createCacheVersionGuard = (options) => {
  if (typeof window === "undefined") {
    return { previousVersion: null, dispose: () => {
    } };
  }
  const storage = options.storage === "session" ? window.sessionStorage : window.localStorage;
  const persistenceKey = useQueryStore.getState().config.persistence.storageKey;
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
    return { previousVersion: previous, dispose: () => {
    } };
  }
  const channel = new BroadcastChannel(channelName);
  const handler = (event) => {
    const data = event.data;
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

// src/store/snapshot.ts
var exportCacheSnapshot = () => {
  const state = useQueryStore.getState();
  const entries = {};
  Object.entries(state.queries).forEach(([key, entry]) => {
    const { fetcher: _f, error: _e, ...rest } = entry;
    entries[key] = rest;
  });
  return { version: 1, createdAt: Date.now(), entries };
};
var importCacheSnapshot = (snapshot) => {
  if (!snapshot?.entries) return;
  const next = Object.fromEntries(
    Object.entries(snapshot.entries).map(([k, entry]) => {
      return [
        k,
        {
          ...entry,
          staleTime: entry.staleTime,
          cacheTime: entry.cacheTime
        }
      ];
    })
  );
  useQueryStore.setState({ queries: next });
};

// src/mutations/offlineQueue.ts
var createOfflineMutationQueue = (options = {}) => {
  const storageKey = options.storageKey ?? "__yokai_offline_queue__";
  const queue = [];
  const load = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      parsed.forEach((item) => {
        queue.push({
          key: item.key,
          vars: item.vars,
          run: async () => {
            throw new Error("Offline queue item missing run()");
          }
        });
      });
    } catch {
    }
  };
  const persist = () => {
    if (typeof window === "undefined") return;
    const snapshot = queue.map((item) => ({ key: item.key, vars: item.vars }));
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  };
  const enqueue = (key, vars, run) => {
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
      flush().catch(() => {
      });
    });
  }
  load();
  return { enqueue, flush, size: () => queue.length };
};

// src/realtime/presence.ts
var startPresenceTtl = (options) => {
  const interval = Math.max(1e3, options.intervalMs ?? 5e3);
  const hashedKey = hashKey(options.key);
  const getId = options.getId ?? ((entry) => entry.id);
  const tick = () => {
    const state = useQueryStore.getState();
    const prev = state.queries[hashedKey]?.data;
    const list = Array.isArray(prev) ? prev : [];
    const now = Date.now();
    const [keep, evicted] = list.reduce(
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
        tags: state.queries[hashedKey]?.tags
      });
      options.onEvict?.(evicted);
    }
  };
  const timer = window.setInterval(tick, interval);
  return () => window.clearInterval(timer);
};

// src/realtime/readReceipts.ts
var addReadReceipt = (receipt, options) => {
  const state = useQueryStore.getState();
  const hashedKey = hashKey(options.key);
  const prev = state.queries[hashedKey]?.data;
  const list = Array.isArray(prev) ? prev : [];
  const exists = list.some(
    (item) => item.messageId === receipt.messageId && item.userId === receipt.userId
  );
  if (exists) return;
  state.setQueryData(options.key, [...list, receipt], {
    tags: state.queries[hashedKey]?.tags
  });
};

// src/simple/cache.ts
function setListCache(key, item, options) {
  const state = useQueryStore.getState();
  const hashedKey = hashKey(key);
  const prev = state.queries[hashedKey]?.data;
  const list = Array.isArray(prev) ? prev : [];
  const next = options?.prepend ? [item, ...list] : [...list, item];
  let deduped = next;
  if (options?.idKey && options.unique !== false) {
    const seen = /* @__PURE__ */ new Set();
    deduped = next.filter((entry) => {
      const id = entry?.[options.idKey];
      if (id === void 0 || id === null) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  state.setQueryData(key, deduped, options?.setOptions);
}

// src/simple/store.ts
var createDefaultClient = (overrides) => createQueryClient(overrides);

// src/hooks/useQuery.ts
var import_react = require("react");
function useQuery(key, selectOrOptions) {
  const resolvedKey = hashKey(key);
  const options = typeof selectOrOptions === "function" ? { select: selectOrOptions } : selectOrOptions ?? {};
  const select = options.select;
  const config = useQueryStore.getState().config;
  const selectMemoMaxEntries = config.selectMemoMaxEntries ?? 0;
  const defaults = (config.queryDefaults ?? []).reduce(
    (acc, entry2) => {
      if (keyToString(key).startsWith(entry2.prefix)) {
        return { ...acc, ...entry2.options };
      }
      return acc;
    },
    {}
  );
  const {
    initialData: defaultInitialData,
    placeholderData: defaultPlaceholderData,
    ...restDefaults
  } = defaults;
  const mergedOptions = {
    ...restDefaults,
    ...options,
    retry: options.retry ?? defaults.retry,
    tags: options.tags ?? defaults.tags,
    refetchInterval: options.refetchInterval ?? defaults.refetchInterval,
    abortOnNewFetch: options.abortOnNewFetch ?? defaults.abortOnNewFetch,
    staleTime: options.staleTime ?? defaults.staleTime,
    cacheTime: options.cacheTime ?? defaults.cacheTime,
    initialData: options.initialData ?? defaultInitialData,
    placeholderData: options.placeholderData ?? defaultPlaceholderData
  };
  const suspense = mergedOptions.suspense ?? config.suspense;
  const throwOnError = mergedOptions.throwOnError ?? config.throwOnError;
  const keepPreviousData = mergedOptions.keepPreviousData ?? false;
  const previousDataRef = (0, import_react.useRef)(void 0);
  const previousKeyRef = (0, import_react.useRef)(void 0);
  const initialDataAppliedRef = (0, import_react.useRef)(void 0);
  const initialDataRef = (0, import_react.useRef)(null);
  const fetcherRef = (0, import_react.useRef)(mergedOptions.fetcher);
  const entry = useQueryStore((state) => state.queries[resolvedKey]);
  const isFetching = useQueryStore((state) => !!state.inFlight[resolvedKey]);
  let selected = entry?.data;
  if (entry?.data !== void 0 && select && selectMemoMaxEntries > 0) {
    const memo = useQueryStore.__selectMemo;
    if (!memo) {
      useQueryStore.__selectMemo = /* @__PURE__ */ new Map();
    }
    const cache = useQueryStore.__selectMemo;
    const prev = cache.get(resolvedKey);
    if (prev && prev.selectRef === select && prev.inputRef === entry.data) {
      selected = prev.output;
    } else {
      const out = select(entry.data);
      cache.delete(resolvedKey);
      cache.set(resolvedKey, {
        selectRef: select,
        inputRef: entry.data,
        output: out
      });
      if (selectMemoMaxEntries > 0 && cache.size > selectMemoMaxEntries) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== void 0) cache.delete(firstKey);
      }
      selected = out;
    }
  }
  const hasData = entry?.data !== void 0;
  const error = entry?.error;
  const fetchedAt = entry?.fetchedAt;
  const staleTime = entry?.staleTime;
  const cacheTime = entry?.cacheTime;
  const refetchInterval = entry?.refetchInterval;
  const tags = entry?.tags;
  const retry = entry?.retry;
  const entryFetcher = entry?.fetcher;
  const now = Date.now();
  const isStale = !fetchedAt || now - fetchedAt > (staleTime ?? DEFAULT_STALE_TIME);
  (0, import_react.useEffect)(() => {
    fetcherRef.current = mergedOptions.fetcher;
  }, [mergedOptions.fetcher]);
  (0, import_react.useEffect)(() => {
    const enabled = mergedOptions.enabled ?? false;
    if (!enabled) return;
    const f = fetcherRef.current;
    if (!f) return;
    if (isFetching) return;
    if (hasData && !isStale) return;
    if (initialDataRef.current?.key === resolvedKey && !hasData) return;
    useQueryStore.getState().fetchQuery(key, {
      fetcher: f,
      staleTime: mergedOptions.staleTime ?? staleTime ?? DEFAULT_STALE_TIME,
      cacheTime: mergedOptions.cacheTime ?? cacheTime ?? DEFAULT_CACHE_TIME,
      background: false,
      refetchInterval: mergedOptions.refetchInterval ?? refetchInterval,
      tags: mergedOptions.tags ?? tags,
      retry: mergedOptions.retry ?? retry,
      abortOnNewFetch: mergedOptions.abortOnNewFetch ?? true,
      onSuccess: mergedOptions.onSuccess,
      onError: mergedOptions.onError,
      onSettled: mergedOptions.onSettled,
      meta: mergedOptions.meta
    }).catch(() => {
    });
  }, [
    resolvedKey,
    mergedOptions.enabled,
    mergedOptions.staleTime,
    mergedOptions.cacheTime,
    mergedOptions.refetchInterval,
    JSON.stringify(mergedOptions.tags ?? [])
  ]);
  const refetch = async (opts) => {
    const state = useQueryStore.getState();
    const q = state.queries[resolvedKey];
    const fetcher = q?.fetcher ?? mergedOptions.fetcher;
    if (mergedOptions.enabled === false) return void 0;
    if (!fetcher) return void 0;
    return state.fetchQuery(key, {
      fetcher,
      staleTime: mergedOptions.staleTime ?? q.staleTime,
      cacheTime: mergedOptions.cacheTime ?? q.cacheTime,
      background: opts?.background ?? false,
      skipStaleWhileRevalidate: true,
      refetchInterval: mergedOptions.refetchInterval ?? q.refetchInterval,
      tags: mergedOptions.tags ?? q.tags,
      retry: mergedOptions.retry ?? q.retry,
      abortOnNewFetch: mergedOptions.abortOnNewFetch ?? true,
      onSuccess: mergedOptions.onSuccess,
      onError: mergedOptions.onError,
      onSettled: mergedOptions.onSettled,
      meta: mergedOptions.meta
    });
  };
  if (mergedOptions.initialData !== void 0) {
    if (initialDataRef.current?.key !== resolvedKey) {
      const value = typeof mergedOptions.initialData === "function" ? mergedOptions.initialData() : mergedOptions.initialData;
      if (value !== void 0) {
        initialDataRef.current = { key: resolvedKey, value };
      }
    }
  } else if (initialDataRef.current?.key === resolvedKey) {
    initialDataRef.current = null;
  }
  const initialDataValue = initialDataRef.current?.key === resolvedKey ? initialDataRef.current.value : void 0;
  (0, import_react.useEffect)(() => {
    const enabled = mergedOptions.enabled ?? false;
    if (!enabled) return;
    if (hasData) return;
    if (initialDataValue === void 0) return;
    if (initialDataAppliedRef.current === resolvedKey) return;
    useQueryStore.getState().setQueryData(resolvedKey, initialDataValue, {
      staleTime: mergedOptions.staleTime,
      cacheTime: mergedOptions.cacheTime,
      refetchInterval: mergedOptions.refetchInterval,
      tags: mergedOptions.tags,
      retry: mergedOptions.retry,
      meta: mergedOptions.meta
    });
    initialDataAppliedRef.current = resolvedKey;
  }, [
    resolvedKey,
    mergedOptions.enabled,
    mergedOptions.staleTime,
    mergedOptions.cacheTime,
    mergedOptions.refetchInterval,
    JSON.stringify(mergedOptions.tags ?? []),
    initialDataValue
  ]);
  (0, import_react.useEffect)(() => {
    if (!hasData) return;
    previousDataRef.current = selected;
    previousKeyRef.current = resolvedKey;
  }, [resolvedKey, hasData, selected]);
  let displayData = selected;
  let hasDisplayData = hasData;
  if (!hasData && initialDataValue !== void 0) {
    displayData = select ? select(initialDataValue) : initialDataValue;
    hasDisplayData = true;
  } else if (!hasData && keepPreviousData && previousDataRef.current !== void 0 && previousKeyRef.current !== resolvedKey) {
    displayData = previousDataRef.current;
    hasDisplayData = true;
  } else if (!hasData && isFetching && mergedOptions.placeholderData !== void 0) {
    const placeholder = typeof mergedOptions.placeholderData === "function" ? mergedOptions.placeholderData(
      previousDataRef.current
    ) : mergedOptions.placeholderData;
    displayData = placeholder;
    hasDisplayData = true;
  }
  (0, import_react.useEffect)(() => {
    useQueryStore.getState().addObserver(key);
    return () => {
      useQueryStore.getState().removeObserver(key);
    };
  }, [resolvedKey]);
  if (throwOnError && error) {
    throw error;
  }
  if (suspense && isFetching && !hasDisplayData) {
    const promise = useQueryStore.getState().inFlight[resolvedKey];
    if (promise) throw promise;
  }
  return {
    data: displayData,
    error,
    isLoading: isFetching && !hasDisplayData,
    isFetching,
    isStale,
    refetch
  };
}

// src/hooks/useInfiniteQuery.ts
var import_react2 = require("react");
function useInfiniteQuery(key, options) {
  const resolvedKey = hashKey(key);
  const config = useQueryStore.getState().config;
  const defaults = (config.queryDefaults ?? []).reduce(
    (acc, entry2) => {
      if (keyToString(key).startsWith(entry2.prefix)) {
        return { ...acc, ...entry2.options };
      }
      return acc;
    },
    {}
  );
  const {
    initialData: defaultInitialData,
    placeholderData: defaultPlaceholderData,
    ...restDefaults
  } = defaults;
  const mergedOptions = {
    ...restDefaults,
    ...options,
    retry: options.retry ?? defaults.retry,
    tags: options.tags ?? defaults.tags,
    refetchInterval: options.refetchInterval ?? defaults.refetchInterval,
    abortOnNewFetch: options.abortOnNewFetch ?? defaults.abortOnNewFetch,
    staleTime: options.staleTime ?? defaults.staleTime,
    cacheTime: options.cacheTime ?? defaults.cacheTime,
    initialData: options.initialData ?? defaultInitialData,
    placeholderData: options.placeholderData ?? defaultPlaceholderData
  };
  const suspense = mergedOptions.suspense ?? config.suspense;
  const throwOnError = mergedOptions.throwOnError ?? config.throwOnError;
  const keepPreviousData = mergedOptions.keepPreviousData ?? false;
  const previousDataRef = (0, import_react2.useRef)(
    void 0
  );
  const previousKeyRef = (0, import_react2.useRef)(void 0);
  const initialDataAppliedRef = (0, import_react2.useRef)(void 0);
  const initialDataRef = (0, import_react2.useRef)(null);
  const fetcherRef = (0, import_react2.useRef)(mergedOptions.fetcher);
  const entry = useQueryStore((state) => state.queries[resolvedKey]);
  const isFetching = useQueryStore((state) => !!state.inFlight[resolvedKey]);
  const data = entry?.data;
  const error = entry?.error;
  const hasData = entry?.data !== void 0;
  const fetchedAt = entry?.fetchedAt;
  const staleTime = entry?.staleTime;
  const cacheTime = entry?.cacheTime;
  const refetchInterval = entry?.refetchInterval;
  const tags = entry?.tags;
  const retry = entry?.retry;
  const now = Date.now();
  const isStale = !fetchedAt || now - fetchedAt > (staleTime ?? DEFAULT_STALE_TIME);
  (0, import_react2.useEffect)(() => {
    fetcherRef.current = mergedOptions.fetcher;
  }, [mergedOptions.fetcher]);
  (0, import_react2.useEffect)(() => {
    const enabled = mergedOptions.enabled ?? false;
    if (!enabled) return;
    if (!fetcherRef.current) return;
    if (isFetching) return;
    if (hasData && !isStale) return;
    if (initialDataRef.current?.key === resolvedKey && !hasData) return;
    useQueryStore.getState().fetchInfiniteQuery(key, {
      fetcher: fetcherRef.current,
      pageParam: mergedOptions.initialPageParam,
      direction: "init",
      staleTime: mergedOptions.staleTime ?? staleTime ?? DEFAULT_STALE_TIME,
      cacheTime: mergedOptions.cacheTime ?? cacheTime ?? DEFAULT_CACHE_TIME,
      background: false,
      refetchInterval: mergedOptions.refetchInterval ?? refetchInterval,
      tags: mergedOptions.tags ?? tags,
      retry: mergedOptions.retry ?? retry,
      abortOnNewFetch: mergedOptions.abortOnNewFetch ?? true,
      onSuccess: mergedOptions.onSuccess,
      onError: mergedOptions.onError,
      onSettled: mergedOptions.onSettled,
      meta: mergedOptions.meta
    }).catch(() => {
    });
  }, [
    resolvedKey,
    mergedOptions.enabled,
    mergedOptions.staleTime,
    mergedOptions.cacheTime,
    mergedOptions.refetchInterval,
    JSON.stringify(mergedOptions.tags ?? [])
  ]);
  if (mergedOptions.initialData !== void 0) {
    if (initialDataRef.current?.key !== resolvedKey) {
      const value = typeof mergedOptions.initialData === "function" ? mergedOptions.initialData() : mergedOptions.initialData;
      if (value !== void 0) {
        initialDataRef.current = { key: resolvedKey, value };
      }
    }
  } else if (initialDataRef.current?.key === resolvedKey) {
    initialDataRef.current = null;
  }
  const initialDataValue = initialDataRef.current?.key === resolvedKey ? initialDataRef.current.value : void 0;
  (0, import_react2.useEffect)(() => {
    const enabled = mergedOptions.enabled ?? false;
    if (!enabled) return;
    if (hasData) return;
    if (initialDataValue === void 0) return;
    if (initialDataAppliedRef.current === resolvedKey) return;
    useQueryStore.getState().setQueryData(resolvedKey, initialDataValue, {
      staleTime: mergedOptions.staleTime,
      cacheTime: mergedOptions.cacheTime,
      refetchInterval: mergedOptions.refetchInterval,
      tags: mergedOptions.tags,
      retry: mergedOptions.retry,
      meta: mergedOptions.meta
    });
    initialDataAppliedRef.current = resolvedKey;
  }, [
    resolvedKey,
    mergedOptions.enabled,
    mergedOptions.staleTime,
    mergedOptions.cacheTime,
    mergedOptions.refetchInterval,
    JSON.stringify(mergedOptions.tags ?? []),
    initialDataValue
  ]);
  (0, import_react2.useEffect)(() => {
    if (!hasData) return;
    previousDataRef.current = data;
    previousKeyRef.current = resolvedKey;
  }, [resolvedKey, hasData, data]);
  let displayData = data;
  let hasDisplayData = hasData;
  if (!hasData && initialDataValue !== void 0) {
    displayData = initialDataValue;
    hasDisplayData = true;
  } else if (!hasData && keepPreviousData && previousDataRef.current !== void 0 && previousKeyRef.current !== resolvedKey) {
    displayData = previousDataRef.current;
    hasDisplayData = true;
  } else if (!hasData && isFetching && mergedOptions.placeholderData !== void 0) {
    const placeholder = typeof mergedOptions.placeholderData === "function" ? mergedOptions.placeholderData(previousDataRef.current) : mergedOptions.placeholderData;
    displayData = placeholder;
    hasDisplayData = true;
  }
  const hasNextPage = !!displayData && mergedOptions.getNextPageParam(
    displayData.pages[displayData.pages.length - 1],
    displayData.pages,
    displayData.pageParams
  ) !== void 0;
  const hasPreviousPage = !!displayData && mergedOptions.getPreviousPageParam ? mergedOptions.getPreviousPageParam(
    displayData.pages[0],
    displayData.pages,
    displayData.pageParams
  ) !== void 0 : false;
  const fetchNextPage = async () => {
    if (mergedOptions.enabled === false) return void 0;
    const state = useQueryStore.getState();
    const current = state.queries[resolvedKey]?.data;
    const pageParam = current ? mergedOptions.getNextPageParam(
      current.pages[current.pages.length - 1],
      current.pages,
      current.pageParams
    ) : mergedOptions.initialPageParam;
    if (pageParam === void 0) return void 0;
    return state.fetchInfiniteQuery(key, {
      fetcher: fetcherRef.current,
      pageParam,
      direction: current ? "forward" : "init",
      staleTime: mergedOptions.staleTime ?? staleTime,
      cacheTime: mergedOptions.cacheTime ?? cacheTime,
      background: false,
      refetchInterval: mergedOptions.refetchInterval ?? refetchInterval,
      tags: mergedOptions.tags ?? tags,
      retry: mergedOptions.retry ?? retry,
      abortOnNewFetch: mergedOptions.abortOnNewFetch ?? true,
      onSuccess: mergedOptions.onSuccess,
      onError: mergedOptions.onError,
      onSettled: mergedOptions.onSettled,
      meta: mergedOptions.meta
    });
  };
  const fetchPreviousPage = async () => {
    if (mergedOptions.enabled === false) return void 0;
    if (!mergedOptions.getPreviousPageParam) return void 0;
    const state = useQueryStore.getState();
    const current = state.queries[resolvedKey]?.data;
    if (!current) return void 0;
    const pageParam = mergedOptions.getPreviousPageParam(
      current.pages[0],
      current.pages,
      current.pageParams
    );
    if (pageParam === void 0) return void 0;
    return state.fetchInfiniteQuery(key, {
      fetcher: fetcherRef.current,
      pageParam,
      direction: "backward",
      staleTime: mergedOptions.staleTime ?? staleTime,
      cacheTime: mergedOptions.cacheTime ?? cacheTime,
      background: false,
      refetchInterval: mergedOptions.refetchInterval ?? refetchInterval,
      tags: mergedOptions.tags ?? tags,
      retry: mergedOptions.retry ?? retry,
      abortOnNewFetch: mergedOptions.abortOnNewFetch ?? true,
      onSuccess: mergedOptions.onSuccess,
      onError: mergedOptions.onError,
      onSettled: mergedOptions.onSettled,
      meta: mergedOptions.meta
    });
  };
  const refetch = async () => {
    if (mergedOptions.enabled === false) return void 0;
    const state = useQueryStore.getState();
    const current = state.queries[resolvedKey]?.data;
    if (!current) return fetchNextPage();
    try {
      const result = await state.refetchInfiniteQuery(key);
      if (result) {
        mergedOptions.onSuccess?.(result);
        mergedOptions.onSettled?.(result, void 0);
      }
      return result;
    } catch (error2) {
      mergedOptions.onError?.(error2);
      mergedOptions.onSettled?.(void 0, error2);
      throw error2;
    }
  };
  (0, import_react2.useEffect)(() => {
    useQueryStore.getState().addObserver(key);
    return () => {
      useQueryStore.getState().removeObserver(key);
    };
  }, [resolvedKey]);
  if (throwOnError && error) {
    throw error;
  }
  if (suspense && isFetching && !hasDisplayData) {
    const promise = useQueryStore.getState().inFlight[resolvedKey];
    if (promise) throw promise;
  }
  const inFlightDirection = useQueryStore.getState().getInFlightDirection(resolvedKey);
  return {
    data: displayData,
    error,
    isLoading: isFetching && !hasDisplayData,
    isFetching,
    isFetchingNextPage: isFetching && inFlightDirection === "forward",
    isFetchingPreviousPage: isFetching && inFlightDirection === "backward",
    hasNextPage,
    hasPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    refetch
  };
}

// src/hooks/useMutation.ts
var import_react3 = require("react");
function useMutation(opts) {
  const [isLoading, setIsLoading] = (0, import_react3.useState)(false);
  const [error, setError] = (0, import_react3.useState)(void 0);
  const [data, setData] = (0, import_react3.useState)(void 0);
  const mutate = (0, import_react3.useCallback)(
    async (variables) => {
      setIsLoading(true);
      setError(void 0);
      try {
        const result = await useQueryStore.getState().mutate({
          ...opts,
          variables,
          onSuccess: (r, v) => {
            opts.onSuccess?.(r, v);
          },
          onError: (e, v) => {
            opts.onError?.(e, v);
          }
        });
        setData(result);
        opts.onSettled?.(result, void 0, variables);
        return result;
      } catch (e) {
        setError(e);
        opts.onSettled?.(void 0, e, variables);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [opts]
  );
  const reset = (0, import_react3.useCallback)(() => {
    setIsLoading(false);
    setError(void 0);
    setData(void 0);
  }, []);
  const cancel = (0, import_react3.useCallback)(() => {
    if (opts.mutationKey) {
      useQueryStore.getState().cancelMutation(opts.mutationKey);
    }
  }, [opts.mutationKey]);
  const status = isLoading ? "loading" : error ? "error" : data !== void 0 ? "success" : "idle";
  return { mutate, isLoading, error, data, reset, cancel, status };
}

// src/simple/hooks.ts
function useSimpleQuery(key, fetcher, options) {
  return useQuery(key, {
    ...options,
    fetcher,
    enabled: options?.enabled ?? true,
    keepPreviousData: options?.keepPreviousData ?? true
  });
}
function useSimpleMutation(mutationFn, options) {
  return useMutation({
    ...options,
    mutationFn
  });
}
function useSimpleInfiniteQuery(key, fetcher, options) {
  return useInfiniteQuery(key, {
    ...options,
    fetcher,
    enabled: options.enabled ?? true
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addReadReceipt,
  api,
  clearAuthToken,
  connectSocketCache,
  connectSseCache,
  createApiClient,
  createAuthBridgeFromEnv,
  createBetterAuthBridge,
  createCacheVersionGuard,
  createChatRoomBridge,
  createDefaultClient,
  createOfflineMutationQueue,
  createPrefetchScheduler,
  createQueryClient,
  createSocketCacheBridge,
  createSseCacheBridge,
  createStoreEventReporter,
  createWebRtcPeer,
  exportCacheSnapshot,
  getAuthToken,
  importCacheSnapshot,
  setAuthToken,
  setListCache,
  startPresenceTtl,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryStore,
  useSimpleInfiniteQuery,
  useSimpleMutation,
  useSimpleQuery,
  wrapFetcher
});
//# sourceMappingURL=index.js.map