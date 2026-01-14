import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createAuthClient } from "better-auth/client";
import { genericOAuthClient } from "better-auth/client/plugins";
import {
  connectSocketCache,
  createApiClient,
  createCacheVersionGuard,
  createPrefetchScheduler,
  createSocketCacheBridge,
  createChatRoomBridge,
  createSseCacheBridge,
  createStoreEventReporter,
  createWebRtcPeer,
  createOfflineMutationQueue,
  createBetterAuthBridge,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryStore,
  exportCacheSnapshot,
  importCacheSnapshot,
  startPresenceTtl,
  addReadReceipt,
  wrapFetcher,
} from "yokai-query";
import { SocialButtonsGrid } from "./components/SocialButtons";
import "./styles.css";

type User = { id: number; name: string };
type FeedPage = { items: string[]; nextCursor?: number };
type ChatMessage = { id: number; text: string; user: string; ts: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let usersDb: User[] = [
  { id: 1, name: "Ada" },
  { id: 2, name: "Linus" },
  { id: 3, name: "Grace" },
];

const feedItems = Array.from({ length: 42 }, (_, i) => `Item #${i + 1}`);

const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  plugins: [genericOAuthClient()],
});
const auth = createBetterAuthBridge(authClient);

const createMockSocket = () => {
  const listeners = new Map<string, Set<(payload: any) => void>>();
  return {
    on(event: string, handler: (payload: any) => void) {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
    },
    off(event: string, handler: (payload: any) => void) {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(handler);
    },
    emit(event: string, payload: any) {
      const set = listeners.get(event);
      if (!set) return;
      set.forEach((handler) => handler(payload));
    },
  };
};

const createMockEventSource = () => {
  const listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  return {
    addEventListener(event: string, handler: (event: MessageEvent) => void) {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
    },
    removeEventListener(event: string, handler: (event: MessageEvent) => void) {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(handler);
    },
    emit(event: string, payload: unknown) {
      const set = listeners.get(event);
      if (!set) return;
      const message = { data: JSON.stringify(payload) } as MessageEvent;
      set.forEach((handler) => handler(message));
    },
  };
};

async function fetchUsers(
  shouldFail: boolean,
  signal?: AbortSignal
): Promise<User[]> {
  await sleep(400);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (shouldFail) throw new Error("users error");
  return [...usersDb];
}

async function fetchUser(id: number, signal?: AbortSignal): Promise<User> {
  await sleep(250);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const user = usersDb.find((u) => u.id === id);
  if (!user) throw new Error("user not found");
  return user;
}

async function createUser(name: string): Promise<User> {
  await sleep(300);
  const next: User = { id: Date.now(), name };
  usersDb = [next, ...usersDb];
  return next;
}

async function fetchFeed(pageParam: number): Promise<FeedPage> {
  await sleep(350);
  const pageSize = 8;
  const start = pageParam * pageSize;
  const items = feedItems.slice(start, start + pageSize);
  const nextCursor =
    start + pageSize < feedItems.length ? pageParam + 1 : undefined;
  return { items, nextCursor };
}

useQueryStore.getState().setConfig({
  persistence: {
    mode: "session",
    storageKey: "__query_cache__",
    dbName: "__query_cache_db__",
    storeName: "cache",
    flushDebounceMs: 250,
  },
  staleWhileRevalidate: true,
  selectMemoMaxEntries: 100,
  structuralSharing: true,
});

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [tab, setTab] = useState<
    | "queries"
    | "user"
    | "mutations"
    | "infinite"
    | "store"
    | "chat"
    | "webrtc"
    | "realtime"
    | "logs"
    | "extras"
  >("queries");
  const logId = useRef(0);
  const pushLog = (message: string) => {
    const id = (logId.current += 1);
    const entry = `${id.toString().padStart(3, "0")} | ${message}`;
    setLogs((prev) => [entry, ...prev].slice(0, 80));
    // eslint-disable-next-line no-console
    console.log(entry);
  };
  const logStore = (label: string) => {
    const state = useQueryStore.getState();
    const queryCount = Object.keys(state.queries).length;
    const inFlightCount = Object.keys(state.inFlight).filter(
      (k) => !!state.inFlight[k]
    ).length;
    const mutationCount = Object.keys(state.mutations).length;
    pushLog(
      `${label} | queries=${queryCount} inFlight=${inFlightCount} mutations=${mutationCount}`
    );
  };
  const [failUsers, setFailUsers] = useState(false);
  const [selectedId, setSelectedId] = useState(1);
  const [newUserName, setNewUserName] = useState("New user");
  const [resetEmail, setResetEmail] = useState("user@example.com");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [useRealSocket, setUseRealSocket] = useState(false);
  const [socketUrl, setSocketUrl] = useState("http://localhost:4000");
  const [socketConnected, setSocketConnected] = useState(false);
  const [messageText, setMessageText] = useState("Hello from client");
  const socketRef = useRef<any>(null);
  const sseRef = useRef<any>(null);
  const sseBridgeRef = useRef<ReturnType<typeof createSseCacheBridge> | null>(
    null
  );
  const schedulerRef = useRef(createPrefetchScheduler({ concurrency: 2 }));
  const reporterStopRef = useRef<null | (() => void)>(null);
  const optimisticIdRef = useRef<number | null>(null);
  const chatSocketRef = useRef(createMockSocket());
  const chatBridgeRef =
    useRef<ReturnType<typeof createChatRoomBridge> | null>(null);
  const [chatRoomId] = useState("room-1");
  const [chatMessage, setChatMessage] = useState("Hello room");
  const [typingUser, setTypingUser] = useState("Ada");
  const [presenceName, setPresenceName] = useState("Ada");
  const [presenceList, setPresenceList] = useState<
    Array<{ id: string; name: string; status: string }>
  >([]);
  const [webrtcStatus, setWebrtcStatus] = useState("idle");
  const [webrtcLog, setWebrtcLog] = useState<string[]>([]);
  const [webrtcDataMessage, setWebrtcDataMessage] = useState("ping");
  const [mediaStatus, setMediaStatus] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");
  const [mirrorCamera, setMirrorCamera] = useState(true);
  const webrtcLocalRef = useRef<HTMLVideoElement | null>(null);
  const webrtcRemoteRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mirroredStreamRef = useRef<MediaStream | null>(null);
  const webrtcPeersRef = useRef<{
    a?: ReturnType<typeof createWebRtcPeer>;
    b?: ReturnType<typeof createWebRtcPeer>;
  }>({});
  const [receiptLog, setReceiptLog] = useState<Array<{ messageId: string; userId: string }>>([]);
  const [offlineQueueSize, setOfflineQueueSize] = useState(0);
  const apiClient = useMemo(
    () =>
      createApiClient({
        baseURL: "/api",
        defaultRetry: { attempts: 2, delay: 200 },
      }),
    []
  );
  const offlineQueueRef = useRef(
    createOfflineMutationQueue({ autoFlush: true })
  );

  const usersQuery = useQuery(["users"], {
    enabled: true,
    fetcher: async ({ signal }) => {
      pushLog(`fetch users start (fail=${failUsers})`);
      const data = await fetchUsers(failUsers, signal);
      pushLog(`fetch users end (count=${data.length})`);
      return data;
    },
    staleTime: 2_000,
    cacheTime: 60_000,
    tags: ["users"],
    retry: { attempts: 2, delay: 200 },
    keepPreviousData: true,
    onError: (err) => {
      pushLog(`users error ${String(err)}`);
    },
    onSuccess: (data) => {
      pushLog(`users success (count=${data.length})`);
    },
  });

  const userQuery = useQuery(["user", selectedId], {
    enabled: true,
    fetcher: async ({ signal }) => {
      pushLog(`fetch user start (id=${selectedId})`);
      const data = await fetchUser(selectedId, signal);
      pushLog(`fetch user end (id=${selectedId})`);
      return data;
    },
    keepPreviousData: true,
    placeholderData: (prev) => prev ?? { id: 0, name: "Loading..." },
    onError: (err) => {
      pushLog(`user error (id=${selectedId}) ${String(err)}`);
    },
  });

  const feedQuery = useInfiniteQuery(["feed"], {
    enabled: true,
    initialPageParam: 0,
    fetcher: async ({ pageParam }) => {
      pushLog(`fetch feed start (page=${pageParam})`);
      const data = await fetchFeed(pageParam);
      pushLog(
        `fetch feed end (page=${pageParam}) items=${data.items.length} next=${
          data.nextCursor ?? "end"
        }`
      );
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const addUser = useMutation({
    mutationKey: ["users"],
    mutationFn: async (payload: { name: string; tempId?: number }) => {
      pushLog(`mutation start (add user="${payload.name}")`);
      const data = await createUser(payload.name);
      pushLog(`mutation end (id=${data.id})`);
      return data;
    },
    optimistic: [
      {
        key: ["users"],
        update: (prev) => {
          const base = Array.isArray(prev) ? (prev as User[]) : [];
          const tempId = optimisticIdRef.current ?? Date.now();
          return [{ id: tempId, name: newUserName }, ...base];
        },
      },
    ],
    updateCache: [
      {
        key: ["users"],
        update: (prev, result) => {
          const base = Array.isArray(prev) ? (prev as User[]) : [];
          const tempId = optimisticIdRef.current;
          const filtered = base.filter((u) => u.id !== tempId);
          const exists = filtered.some((u) => u.id === result.id);
          return exists ? filtered : [result, ...filtered];
        },
      },
    ],
    onError: (err) => {
      pushLog(`mutation error ${String(err)}`);
    },
  });

  const metrics = useQueryStore((s) => s.metrics);
  const queries = useQueryStore((s) => s.queries);
  const inFlight = useQueryStore((s) => s.inFlight);
  const mutations = useQueryStore((s) => s.mutations);
  const snapshot = useMemo(
    () => ({
      queryCount: Object.keys(queries).length,
      inFlightCount: Object.keys(inFlight).filter((k) => !!inFlight[k]).length,
      mutationCount: Object.keys(mutations).length,
    }),
    [queries, inFlight, mutations]
  );
  const realtimeStatusLabel = useRealSocket
    ? socketConnected
      ? "connected"
      : "disconnected"
    : "mock";
  const realtimeStatusClass = useRealSocket
    ? socketConnected
      ? "status-pill status-ok"
      : "status-pill status-off"
    : "status-pill status-mock";

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const messagesQuery = useQuery(["messages", "room-1"], {
    enabled: true,
    fetcher: async () => [],
    staleTime: Infinity,
    cacheTime: 5 * 60_000,
    tags: ["room:room-1"],
  });

  const chatMessagesQuery = useQuery(["messages", chatRoomId], {
    enabled: true,
    fetcher: async () => [],
    staleTime: Infinity,
    cacheTime: 5 * 60_000,
    tags: [`room:${chatRoomId}`],
  });

  const presenceQuery = useQuery(["presence", chatRoomId], {
    enabled: true,
    fetcher: async () => [],
    staleTime: Infinity,
    cacheTime: 5 * 60_000,
    tags: [`room:${chatRoomId}`],
  });

  const typingQuery = useQuery(["typing", chatRoomId], {
    enabled: true,
    fetcher: async () => [],
    staleTime: 5_000,
    cacheTime: 5 * 60_000,
    tags: [`room:${chatRoomId}`],
  });

  const sseQuery = useQuery(["sse", "demo"], {
    enabled: true,
    fetcher: async () => [],
    staleTime: Infinity,
    cacheTime: 5 * 60_000,
    tags: ["sse:demo"],
  });

  useEffect(() => {
    let active = true;
    let socket: any = null;
    let dispose: (() => void) | null = null;
    let handleConnect: (() => void) | null = null;
    let handleDisconnect: (() => void) | null = null;
    const events = [
      {
        event: "message:new",
        key: () => ["messages", "room-1"],
        update: (prev: unknown, payload: unknown) => {
          const list = Array.isArray(prev) ? (prev as ChatMessage[]) : [];
          return [...list, payload as ChatMessage];
        },
        setOptions: { tags: ["room:room-1"] },
      },
    ];

    const start = async () => {
      if (useRealSocket) {
        try {
          if (!active) return;
          const connection = await connectSocketCache({
            url: socketUrl,
            events,
            onError: (error, _payload, event) => {
              pushLog(`socket error (${event}) ${String(error)}`);
            },
          });
          if (!active) {
            connection.dispose();
            return;
          }
          socket = connection.socket;
          dispose = connection.dispose;
        } catch (error) {
          pushLog(`socket.io-client missing ${String(error)}`);
          setUseRealSocket(false);
          return;
        }
      } else {
        socket = createMockSocket();
        const bridge = createSocketCacheBridge({
          socket,
          events,
          onError: (error, _payload, event) => {
            pushLog(`socket error (${event}) ${String(error)}`);
          },
        });
        bridge.start();
        dispose = () => bridge.stop();
      }
      socketRef.current = socket;

      if (useRealSocket) {
        handleConnect = () => {
          setSocketConnected(true);
          pushLog("socket connected");
        };
        handleDisconnect = () => {
          setSocketConnected(false);
          pushLog("socket disconnected");
        };
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        setSocketConnected(!!socket.connected);
      } else {
        setSocketConnected(false);
      }
    };

    start().catch((error) => {
      pushLog(`socket init error ${String(error)}`);
    });

    return () => {
      active = false;
      if (socket && useRealSocket) {
        if (handleConnect) socket.off("connect", handleConnect);
        if (handleDisconnect) socket.off("disconnect", handleDisconnect);
      }
      dispose?.();
    };
  }, [useRealSocket, socketUrl]);

  useEffect(() => {
    const source = createMockEventSource();
    const bridge = createSseCacheBridge({
      source,
      events: [
        {
          event: "notice",
          key: () => ["sse", "demo"],
          update: (prev, payload) => {
            const list = Array.isArray(prev) ? (prev as any[]) : [];
            return [...list, payload as any];
          },
          setOptions: { tags: ["sse:demo"] },
        },
      ],
      onError: (error, _event, name) => {
        pushLog(`sse error (${name}) ${String(error)}`);
      },
    });

    sseRef.current = source;
    sseBridgeRef.current = bridge;
    bridge.start();

    return () => {
      bridge.stop();
      sseRef.current = null;
      sseBridgeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = chatSocketRef.current;
    const bridge = createChatRoomBridge({
      socket,
      roomId: chatRoomId,
      getMessageId: (msg: any) => msg.id,
      onError: (error, _payload, event) => {
        pushLog(`chat error (${event}) ${String(error)}`);
      },
    });
    chatBridgeRef.current = bridge;
    bridge.start();

    return () => {
      bridge.stop();
      chatBridgeRef.current = null;
    };
  }, [chatRoomId]);

  useEffect(() => {
    const next = Array.isArray(presenceQuery.data)
      ? (presenceQuery.data as Array<{ id: string; name: string; status: string }>)
      : [];
    setPresenceList(next);
  }, [presenceQuery.data]);

  useEffect(() => {
    if (!users.length) return;
    if (selectedId === 0) {
      setSelectedId(users[0]?.id ?? 1);
      return;
    }
    const exists = users.some((u) => u.id === selectedId);
    if (!exists) setSelectedId(users[0]?.id ?? 1);
  }, [users, selectedId]);

  const [presenceTtlEnabled, setPresenceTtlEnabled] = useState(false);

  useEffect(() => {
    if (!presenceTtlEnabled) return;
    const stop = startPresenceTtl({
      key: ["presence", chatRoomId],
      ttlMs: 120_000,
    });
    return () => stop();
  }, [chatRoomId, presenceTtlEnabled]);

  const requestMedia = async () => {
    setMediaStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      mediaStreamRef.current = stream;
      if (webrtcLocalRef.current) {
        webrtcLocalRef.current.srcObject = stream;
      }
      setMediaStatus("granted");
      pushLog("media permissions granted");
      return stream;
    } catch (err) {
      setMediaStatus("denied");
      pushLog(`media permissions denied ${String(err)}`);
      return null;
    }
  };
  const createMirroredStream = async (
    source: MediaStream
  ): Promise<MediaStream> => {
    const [videoTrack] = source.getVideoTracks();
    if (!videoTrack) return source;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = source;
    await video.play().catch(() => {});
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      const handler = () => {
        video.removeEventListener("loadedmetadata", handler);
        resolve();
      };
      video.addEventListener("loadedmetadata", handler);
    });
    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      if (!ctx) return;
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -width, 0, width, height);
      ctx.restore();
      requestAnimationFrame(draw);
    };
    draw();
    const mirrored = canvas.captureStream(30);
    source.getAudioTracks().forEach((track) => mirrored.addTrack(track));
    return mirrored;
  };
  const clearVideo = (el: HTMLVideoElement | null) => {
    if (!el) return;
    el.srcObject = null;
    el.src = "";
    el.load();
  };

  return (
    <div className="page">
      <h1>Yokai Query Playground</h1>
      <p className="muted">
        Tests core features with fake fetchers (no backend needed).
      </p>

      <div className="tabs">
        <button
          className={tab === "queries" ? "tab active" : "tab"}
          onClick={() => setTab("queries")}
        >
          Queries
        </button>
        <button
          className={tab === "user" ? "tab active" : "tab"}
          onClick={() => setTab("user")}
        >
          User detail
        </button>
        <button
          className={tab === "mutations" ? "tab active" : "tab"}
          onClick={() => setTab("mutations")}
        >
          Mutations
        </button>
        <button
          className={tab === "infinite" ? "tab active" : "tab"}
          onClick={() => setTab("infinite")}
        >
          Infinite
        </button>
        <button
          className={tab === "store" ? "tab active" : "tab"}
          onClick={() => setTab("store")}
        >
          Store
        </button>
        <button
          className={tab === "chat" ? "tab active" : "tab"}
          onClick={() => setTab("chat")}
        >
          Chat
        </button>
        <button
          className={tab === "webrtc" ? "tab active" : "tab"}
          onClick={() => setTab("webrtc")}
        >
          WebRTC
        </button>
        <button
          className={tab === "logs" ? "tab active" : "tab"}
          onClick={() => setTab("logs")}
        >
          Logs
        </button>
        <button
          className={tab === "extras" ? "tab active" : "tab"}
          onClick={() => setTab("extras")}
        >
          Extras
        </button>
        <button
          className={tab === "realtime" ? "tab active" : "tab"}
          onClick={() => setTab("realtime")}
        >
          Realtime
        </button>
      </div>

      <div className="grid">
        {tab === "queries" && (
          <section className="card">
            <h2>Users (useQuery)</h2>
            <p className="muted">
              staleTime/cacheTime, retry, tags, keepPreviousData, isFetching.
            </p>
            <div className="row">
              <button
                onClick={() => {
                  if (usersQuery.isFetching) {
                    pushLog("skip refetch users (already fetching)");
                    return;
                  }
                  pushLog("button refetch users");
                  logStore("PREV");
                  usersQuery.refetch();
                  logStore("NEXT");
                  pushLog("END refetch users");
                }}
              >
                Refetch
              </button>
              <button
                className="secondary"
                onClick={() => {
                  pushLog("button invalidate users");
                  logStore("PREV");
                  useQueryStore.getState().invalidate(["users"]);
                  logStore("NEXT");
                  pushLog("END invalidate users");
                }}
              >
                Invalidate key
              </button>
              <button
                className="secondary"
                onClick={() => {
                  pushLog("button invalidate tags users");
                  logStore("PREV");
                  useQueryStore.getState().invalidateTags(["users"]);
                  logStore("NEXT");
                  pushLog("END invalidate tags users");
                }}
              >
                Invalidate tag
              </button>
              <button
                className="danger"
                onClick={() => {
                  pushLog("button cancel by tags users");
                  logStore("PREV");
                  useQueryStore.getState().cancelByTags(["users"]);
                  logStore("NEXT");
                  pushLog("END cancel by tags users");
                }}
              >
                Cancel by tag
              </button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button
                className="secondary"
                onClick={() => {
                  pushLog("button toggle error users");
                  setFailUsers((v) => !v);
                }}
              >
                Toggle error: {failUsers ? "on" : "off"}
              </button>
              <button
                className="secondary"
                onClick={() => {
                  pushLog("button setQueryData users slice(0,1)");
                  logStore("PREV");
                  useQueryStore
                    .getState()
                    .setQueryData(["users"], users.slice(0, 1));
                  logStore("NEXT");
                  pushLog("END setQueryData users");
                }}
              >
                setQueryData
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div>isLoading: {String(usersQuery.isLoading)}</div>
              <div>isFetching: {String(usersQuery.isFetching)}</div>
              <div>isStale: {String(usersQuery.isStale)}</div>
              <pre>{JSON.stringify(usersQuery.data, null, 2)}</pre>
            </div>
          </section>
        )}

        {tab === "user" && (
          <section className="card">
            <h2>User detail (keepPreviousData)</h2>
            <div className="row">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(Number(e.target.value))}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (userQuery.isFetching) {
                    pushLog("skip refetch user (already fetching)");
                    return;
                  }
                  pushLog("button refetch user");
                  logStore("PREV");
                  userQuery.refetch();
                  logStore("NEXT");
                  pushLog("END refetch user");
                }}
              >
                Refetch
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div>isLoading: {String(userQuery.isLoading)}</div>
              <div>isFetching: {String(userQuery.isFetching)}</div>
              <pre>{JSON.stringify(userQuery.data, null, 2)}</pre>
            </div>
          </section>
        )}

        {tab === "mutations" && (
          <section className="card">
            <h2>Mutation (optimistic)</h2>
            <div className="row">
              <input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
              <button
                onClick={() => {
                  pushLog("button add user");
                  logStore("PREV");
                  optimisticIdRef.current = Date.now();
                  addUser.mutate({
                    name: newUserName,
                    tempId: optimisticIdRef.current,
                  });
                  logStore("NEXT");
                  pushLog("END add user");
                }}
              >
                Add user
              </button>
              <button
                className="secondary"
                onClick={() => {
                  pushLog("button cancel mutation users");
                  logStore("PREV");
                  addUser.cancel();
                  logStore("NEXT");
                  pushLog("END cancel mutation users");
                }}
              >
                Cancel mutation
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div>Status: {addUser.status}</div>
              <pre>{JSON.stringify(addUser.data, null, 2)}</pre>
            </div>
            <div style={{ marginTop: 16 }}>
              <h3>Social sign in (better-auth)</h3>
              <SocialButtonsGrid
                onClick={async (provider) => {
                  const base =
                    window.location.origin + window.location.pathname;
                  const callbackURL = base;
                  const errorCallbackURL = `${base}?auth=error`;
                  const newUserCallbackURL = `${base}?auth=welcome`;
                  pushLog(`button social sign in (${provider})`);
                  try {
                    if (provider === "instagram") {
                      await auth.signInOAuth2({
                        providerId: "instagram",
                        callbackURL,
                        errorCallbackURL,
                        newUserCallbackURL,
                      });
                    } else {
                      await auth.signInSocial({
                        provider,
                        callbackURL,
                        errorCallbackURL,
                        newUserCallbackURL,
                      });
                    }
                    pushLog(`social sign in success (${provider})`);
                  } catch (err) {
                    pushLog(
                      `social sign in error (${provider}) ${String(err)}`
                    );
                  }
                }}
              />
              <div className="row" style={{ marginTop: 12 }}>
                <button
                  className="secondary"
                  onClick={async () => {
                    pushLog("button sign out");
                    try {
                      await auth.signOut();
                      pushLog("sign out success");
                    } catch (err) {
                      pushLog(`sign out error ${String(err)}`);
                    }
                  }}
                >
                  Sign out
                </button>
              </div>
              <div style={{ marginTop: 12 }}>
                <h4>Password recovery</h4>
                <div className="row">
                  <input
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="email"
                  />
                  <button
                    onClick={async () => {
                      pushLog("button request password reset");
                      try {
                        await auth.requestPasswordReset({
                          email: resetEmail,
                          redirectTo: `${window.location.origin}${window.location.pathname}?auth=reset`,
                        });
                        pushLog("request password reset success");
                      } catch (err) {
                        pushLog(`request password reset error ${String(err)}`);
                      }
                    }}
                  >
                    Request reset
                  </button>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <input
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="token"
                  />
                  <input
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="new password"
                    type="password"
                  />
                  <button
                    onClick={async () => {
                      pushLog("button reset password");
                      try {
                        await auth.resetPassword({
                          token: resetToken,
                          newPassword: resetPassword,
                        });
                        pushLog("reset password success");
                      } catch (err) {
                        pushLog(`reset password error ${String(err)}`);
                      }
                    }}
                  >
                    Reset password
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "infinite" && (
          <section className="card">
            <h2>Infinite query</h2>
            <div className="row">
              <button
                onClick={() => {
                  pushLog("button fetch next page");
                  logStore("PREV");
                  feedQuery.fetchNextPage();
                  logStore("NEXT");
                  pushLog("END fetch next page");
                }}
              >
                Next page
              </button>
              <button
                className="secondary"
                onClick={() => {
                  if (feedQuery.isFetching || feedQuery.isFetchingNextPage) {
                    pushLog("skip refetch feed (already fetching)");
                    return;
                  }
                  pushLog("button refetch feed");
                  logStore("PREV");
                  feedQuery.refetch();
                  logStore("NEXT");
                  pushLog("END refetch feed");
                }}
              >
                Refetch
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div>hasNextPage: {String(feedQuery.hasNextPage)}</div>
              <div>isFetchingNext: {String(feedQuery.isFetchingNextPage)}</div>
              <pre>{JSON.stringify(feedQuery.data, null, 2)}</pre>
            </div>
          </section>
        )}

        {tab === "store" && (
          <section className="card">
            <h2>Store controls</h2>
            <div className="row">
              <button
                onClick={() => {
                  pushLog("button gc");
                  logStore("PREV");
                  useQueryStore.getState().gc();
                  logStore("NEXT");
                  pushLog("END gc");
                }}
              >
                GC
              </button>
              <button
                className="secondary"
                onClick={() => {
                  pushLog("button clear cache");
                  logStore("PREV");
                  useQueryStore.getState().clear();
                  logStore("NEXT");
                  pushLog("END clear cache");
                }}
              >
                Clear cache
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div>Queries: {snapshot.queryCount}</div>
              <div>InFlight: {snapshot.inFlightCount}</div>
              <div>Mutations: {snapshot.mutationCount}</div>
              <pre>{JSON.stringify(metrics, null, 2)}</pre>
            </div>
          </section>
        )}

        {tab === "chat" && (
          <section className="card">
            <h2>Chat + presence (mock socket)</h2>
            <p className="muted">
              Uses createChatRoomBridge with events for messages, presence, typing.
            </p>
            <div className="row">
              <input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="message"
              />
              <button
                onClick={() => {
                  const msg = {
                    id: Date.now(),
                    roomId: chatRoomId,
                    text: chatMessage,
                    user: "you",
                    ts: Date.now(),
                  };
                  chatSocketRef.current.emit("message:new", msg);
                  pushLog(`chat emit message:new (${msg.text})`);
                }}
              >
                Send message
              </button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <input
                value={presenceName}
                onChange={(e) => setPresenceName(e.target.value)}
                placeholder="name"
              />
              <button
                className="secondary"
                onClick={() => {
                  const next = [
                    ...presenceList,
                    {
                      id: `user-${Date.now()}`,
                      name: presenceName,
                      status: "online",
                    },
                  ];
                  chatSocketRef.current.emit("presence:update", next);
                  pushLog(`chat emit presence:update (${next.length})`);
                }}
              >
                Join
              </button>
              <button
                className="secondary"
                onClick={() => {
                  const next = presenceList.slice(0, -1);
                  chatSocketRef.current.emit("presence:update", next);
                  pushLog(`chat emit presence:update (${next.length})`);
                }}
              >
                Leave last
              </button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <input
                value={typingUser}
                onChange={(e) => setTypingUser(e.target.value)}
                placeholder="typing user"
              />
              <button
                className="secondary"
                onClick={() => {
                  const current = Array.isArray(typingQuery.data)
                    ? (typingQuery.data as string[])
                    : [];
                  const next = current.includes(typingUser)
                    ? current
                    : [...current, typingUser];
                  chatSocketRef.current.emit("typing:update", next);
                  pushLog(`chat emit typing:update (${next.length})`);
                }}
              >
                Typing
              </button>
              <button
                className="secondary"
                onClick={() => {
                  chatSocketRef.current.emit("typing:update", []);
                  pushLog("chat clear typing");
                }}
              >
                Clear typing
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div>Presence: {presenceQuery.data?.length ?? 0}</div>
              <pre>{JSON.stringify(presenceQuery.data, null, 2)}</pre>
            </div>
            <div style={{ marginTop: 12 }}>
              <div>Typing: {typingQuery.data?.length ?? 0}</div>
              <pre>{JSON.stringify(typingQuery.data, null, 2)}</pre>
            </div>
            <div style={{ marginTop: 12 }}>
              <div>Messages: {chatMessagesQuery.data?.length ?? 0}</div>
              <pre>{JSON.stringify(chatMessagesQuery.data, null, 2)}</pre>
            </div>
          </section>
        )}

        {tab === "webrtc" && (
          <section className="card">
            <h2>WebRTC (loopback demo)</h2>
            <p className="muted">
              Uses two peers with mock signaling. Optional audio/video.
            </p>
            <div className="row">
              <button
                onClick={async () => {
                  setWebrtcStatus("starting");
                  setWebrtcLog((prev) => ["start", ...prev].slice(0, 20));
                  const signaling = createMockSocket();
                  const sendSignal = (payload: any) => {
                    signaling.emit("rtc:signal", payload);
                  };
                  const handleSignal = (handler: (payload: any) => void) => {
                    signaling.on("rtc:signal", handler);
                    return () => signaling.off("rtc:signal", handler);
                  };
                  const stream =
                    mediaStreamRef.current ?? (await requestMedia());
                  const sendStream =
                    stream && mirrorCamera
                      ? await createMirroredStream(stream)
                      : stream;
                  if (sendStream !== stream) {
                    mirroredStreamRef.current = sendStream ?? null;
                  }
                  const peerA = createWebRtcPeer({
                    id: "a",
                    roomId: "demo",
                    stream: sendStream,
                    onSignal: sendSignal,
                    onData: (data) =>
                      setWebrtcLog((prev) =>
                        [`peerA data: ${data}`, ...prev].slice(0, 20)
                      ),
                    onStateChange: (state) => setWebrtcStatus(state),
                  });
                  const peerB = createWebRtcPeer({
                    id: "b",
                    roomId: "demo",
                    stream: null,
                    onSignal: sendSignal,
                    onData: (data) =>
                      setWebrtcLog((prev) =>
                        [`peerB data: ${data}`, ...prev].slice(0, 20)
                      ),
                    onTrack: (event) => {
                      if (webrtcRemoteRef.current) {
                        webrtcRemoteRef.current.srcObject = event.streams[0];
                      }
                    },
                    onStateChange: (state) =>
                      setWebrtcLog((prev) =>
                        [`peerB state: ${state}`, ...prev].slice(0, 20)
                      ),
                  });
                  const off = handleSignal((payload) => {
                    peerA.handleSignal(payload).catch(() => {});
                    peerB.handleSignal(payload).catch(() => {});
                  });
                  webrtcPeersRef.current = { a: peerA, b: peerB };
                  await peerA.start();
                  setWebrtcStatus("connecting");
                  setWebrtcLog((prev) => ["offer sent", ...prev].slice(0, 20));
                  setTimeout(() => off(), 10_000);
                }}
              >
                Start call
              </button>
              <button
                className="secondary"
                onClick={() => {
                  requestMedia().catch(() => {});
                }}
              >
                Request media
              </button>
              <button
                className="secondary"
                onClick={() => {
                  webrtcPeersRef.current.a?.sendData(webrtcDataMessage);
                  webrtcPeersRef.current.b?.sendData(`echo:${webrtcDataMessage}`);
                  setWebrtcLog((prev) => ["send data", ...prev].slice(0, 20));
                }}
              >
                Send data
              </button>
              <button
                className="secondary"
                onClick={() => {
                  webrtcPeersRef.current.a?.close();
                  webrtcPeersRef.current.b?.close();
                  webrtcPeersRef.current = {};
                  mirroredStreamRef.current?.getTracks().forEach((track) => {
                    track.stop();
                  });
                  mirroredStreamRef.current = null;
                  clearVideo(webrtcRemoteRef.current);
                  setWebrtcStatus("closed");
                  setWebrtcLog((prev) => ["closed", ...prev].slice(0, 20));
                }}
              >
                End call
              </button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <input
                value={webrtcDataMessage}
                onChange={(e) => setWebrtcDataMessage(e.target.value)}
                placeholder="data message"
              />
              <div>Status: {webrtcStatus}</div>
            </div>
            <div className="row muted" style={{ marginTop: 6 }}>
              <span>Media: {mediaStatus}</span>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="row muted">
                <input
                  type="checkbox"
                  checked={mirrorCamera}
                  onChange={(e) => setMirrorCamera(e.target.checked)}
                />
                Mirror camera
              </label>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <video
                ref={webrtcLocalRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: 160,
                  height: 120,
                  background: "#111",
                  transform: mirrorCamera ? "scaleX(-1)" : "none",
                }}
              />
              <video
                ref={webrtcRemoteRef}
                autoPlay
                playsInline
                style={{ width: 160, height: 120, background: "#111" }}
              />
            </div>
            <div className="row muted" style={{ marginTop: 6 }}>
              <span style={{ width: 160, textAlign: "center" }}>
                Local video
              </span>
              <span style={{ width: 160, textAlign: "center" }}>
                Remote video
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <pre>{webrtcLog.join("\n") || "No events yet."}</pre>
            </div>
          </section>
        )}

        {tab === "logs" && (
          <section className="card">
            <h2>Event log</h2>
            <p className="muted">Last 80 actions</p>
            <pre>{logs.join("\n") || "No events yet."}</pre>
          </section>
        )}

        {tab === "extras" && (
          <section className="card">
            <h2>Extras</h2>
            <p className="muted">Bloques con ejemplos compactos.</p>
            <div className="grid">
              <section className="card">
                <h3>Prefetch</h3>
                <p className="muted">Encola fetch con prioridad baja.</p>
                <button
                  onClick={() => {
                    pushLog("button schedule prefetch users");
                    schedulerRef.current.schedule(["users"], {
                      fetcher: ({ signal }) => fetchUsers(false, signal),
                      staleTime: 2_000,
                      cacheTime: 60_000,
                    });
                  }}
                >
                  Schedule prefetch
                </button>
              </section>

              <section className="card">
                <h3>Observability</h3>
                <p className="muted">Devtools events + traced fetch.</p>
                <div className="row">
                  <button
                    className="secondary"
                    onClick={() => {
                      pushLog("button enable devtools events");
                      useQueryStore.getState().setConfig({
                        devtools: { emitEvents: true },
                      });
                    }}
                  >
                    Enable events
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      if (reporterStopRef.current) {
                        pushLog("reporter already running");
                        return;
                      }
                      pushLog("start event reporter");
                      reporterStopRef.current = createStoreEventReporter({
                        onEvent: (event) => {
                          pushLog(`event ${event.type}`);
                        },
                      });
                    }}
                  >
                    Start reporter
                  </button>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button
                    className="secondary"
                    onClick={() => {
                      pushLog("button traced fetch");
                      const traced = wrapFetcher(
                        async () => {
                          await sleep(150);
                          return { ok: true };
                        },
                        {
                          onSettled: (trace) => {
                            pushLog(`trace duration ${trace.duration}ms`);
                          },
                        },
                        { label: "demo" }
                      );
                      traced().catch(() => {});
                    }}
                  >
                    Run traced fetch
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      pushLog("stop event reporter");
                      reporterStopRef.current?.();
                      reporterStopRef.current = null;
                    }}
                  >
                    Stop reporter
                  </button>
                </div>
              </section>

              <section className="card">
                <h3>Snapshot</h3>
                <p className="muted">Export/import cache.</p>
                <div className="row">
                  <button
                    className="secondary"
                    onClick={() => {
                      pushLog("button export cache snapshot");
                      const snap = exportCacheSnapshot();
                      sessionStorage.setItem(
                        "__yokai_snapshot__",
                        JSON.stringify(snap)
                      );
                      pushLog("snapshot saved");
                    }}
                  >
                    Export snapshot
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      pushLog("button import cache snapshot");
                      const raw = sessionStorage.getItem("__yokai_snapshot__");
                      if (!raw) {
                        pushLog("snapshot missing");
                        return;
                      }
                      importCacheSnapshot(JSON.parse(raw));
                      pushLog("snapshot restored");
                    }}
                  >
                    Import snapshot
                  </button>
                </div>
              </section>

              <section className="card">
                <h3>Offline queue</h3>
                <p className="muted">Encola mutations offline.</p>
                <div className="row">
                  <button
                    className="secondary"
                    onClick={() => {
                      pushLog("button enqueue offline mutation");
                      offlineQueueRef.current.enqueue(
                        "create-user",
                        { name: newUserName },
                        (vars) => apiClient.post("/users", vars)
                      );
                      setOfflineQueueSize(offlineQueueRef.current.size());
                    }}
                  >
                    Enqueue offline
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      pushLog("button flush offline queue");
                      offlineQueueRef.current.flush().catch(() => {});
                      setOfflineQueueSize(offlineQueueRef.current.size());
                    }}
                  >
                    Flush offline
                  </button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div>Queue size: {offlineQueueSize}</div>
                </div>
              </section>

              <section className="card">
                <h3>SSE</h3>
                <p className="muted">Mock EventSource updates.</p>
                <div className="row">
                  <button
                    className="secondary"
                    onClick={() => {
                      const payload = {
                        id: Date.now(),
                        message: "SSE update",
                      };
                      sseRef.current?.emit?.("notice", payload);
                      pushLog("sse emit notice");
                    }}
                  >
                    SSE emit
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div>SSE items: {sseQuery.data?.length ?? 0}</div>
                  <pre>{JSON.stringify(sseQuery.data, null, 2)}</pre>
                </div>
              </section>

              <section className="card">
                <h3>API client</h3>
                <p className="muted">Minimal fetch wrapper.</p>
                <button
                  className="secondary"
                  onClick={async () => {
                    pushLog("button api client request");
                    try {
                      await apiClient.get("/health");
                      pushLog("api client ok");
                    } catch (err) {
                      pushLog(`api client error ${String(err)}`);
                    }
                  }}
                >
                  API client request
                </button>
              </section>

              <section className="card">
                <h3>Cache versioning</h3>
                <p className="muted">Bump version to clear cache.</p>
                <button
                  className="secondary"
                  onClick={() => {
                    pushLog("button cache version bump");
                    createCacheVersionGuard({
                      version: `v-${Date.now()}`,
                      storage: "local",
                    });
                  }}
                >
                  Cache version bump
                </button>
              </section>
            </div>
          </section>
        )}

        {tab === "realtime" && (
          <section className="card">
            <h2>Realtime (Socket.IO)</h2>
            <p className="muted">
              Uses socket events to update the cache for room-1 messages.
            </p>
            <p className="muted">
              Real socket mode requires installing `socket.io-client` in the
              playground.
            </p>
            <div className="row">
              <button
                className="secondary"
                onClick={() => {
                  setUseRealSocket((v) => !v);
                  setSocketConnected(false);
                }}
              >
                {useRealSocket ? "Use mock socket" : "Use Socket.IO"}
              </button>
              <span className={realtimeStatusClass}>
                {realtimeStatusLabel}
              </span>
            </div>
            {useRealSocket && (
              <div className="row" style={{ marginTop: 8 }}>
                <input
                  value={socketUrl}
                  onChange={(e) => setSocketUrl(e.target.value)}
                  placeholder="socket url"
                />
              </div>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="message"
              />
              <button
                onClick={() => {
                  const msg: ChatMessage = {
                    id: Date.now(),
                    text: messageText,
                    user: "you",
                    ts: Date.now(),
                  };
                  const socket = socketRef.current as any;
                  socket?.emit?.("message:new", msg);
                  pushLog(`socket emit message:new (${msg.text})`);
                }}
              >
                Emit message
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div>Messages: {messagesQuery.data?.length ?? 0}</div>
              <pre>{JSON.stringify(messagesQuery.data, null, 2)}</pre>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
