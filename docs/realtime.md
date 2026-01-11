# Realtime (Socket.IO)

Yokai Query can treat realtime events as cache updates. The store already
supports `setQueryData` and invalidations, so you only need to wire socket
events to cache updates.

## Install

No extra install needed when using `yokai-query` (it bundles `socket.io-client`).

## Bridge

```ts
import { io } from "socket.io-client";
import { createSocketCacheBridge } from "yokai-query";

const socket = io("http://localhost:4000", { autoConnect: false });

const bridge = createSocketCacheBridge({
  socket,
  events: [
    {
      event: "message:new",
      key: (msg) => ["messages", msg.roomId],
      update: (prev, msg) => {
        const list = Array.isArray(prev) ? prev : [];
        return [...list, msg];
      },
    },
  ],
});

bridge.start();
socket.connect();
```

## Simple helper

```ts
import { connectSocketCache } from "yokai-query";

const { socket, dispose } = await connectSocketCache({
  url: "http://localhost:4000",
  events: [
    {
      event: "message:new",
      key: (msg) => ["messages", msg.roomId],
      update: (prev, msg) => {
        const list = Array.isArray(prev) ? prev : [];
        return [...list, msg];
      },
    },
  ],
});

socket.on("connect", () => console.log("connected"));

// later
// dispose();
```

## SSE

You can also use Server-Sent Events without extra deps:

```ts
import { connectSseCache } from "yokai-query";

const { dispose } = connectSseCache({
  url: "/events",
  events: [
    {
      event: "message",
      key: (msg) => ["messages", msg.roomId],
      update: (prev, msg) => [...(Array.isArray(prev) ? prev : []), msg],
    },
  ],
});
```

## Chat + presence presets

```ts
import { createChatRoomBridge } from "yokai-query";

const bridge = createChatRoomBridge({
  socket,
  roomId: "room-1",
  getMessageId: (msg) => msg.id,
});

bridge.start();
```

Events used by default:
- `message:new` -> `["messages", roomId]` (append)
- `presence:update` -> `["presence", roomId]` (replace)
- `typing:update` -> `["typing", roomId]` (replace)

## WebRTC (signaling helper)

```ts
import { createWebRtcPeer } from "yokai-query";

const peer = createWebRtcPeer({
  id: "alice",
  onSignal: (payload) => socket.emit("rtc:signal", payload),
});

socket.on("rtc:signal", (payload) => peer.handleSignal(payload));
await peer.start();
```

This helper handles offer/answer/ICE for 1:1 calls. Use your socket/SSE for signaling.

## Notes

- Use `invalidate` when you prefer server re-sync instead of patching cache.
- Keep payloads minimal and de-dupe on `id` if needed.
- Socket.IO is optional; any client with `on/off` works.
- `connectSocketCache` uses `socket.io-client` (bundled with `yokai-query`).
