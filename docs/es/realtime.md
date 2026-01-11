# Realtime (Socket.IO)

Yokai Query puede tratar eventos en tiempo real como actualizaciones del
cache. El store ya soporta `setQueryData` e invalidaciones, asi que solo hay
que conectar los eventos del socket con updates del cache.

## Install

No necesitas instalar nada extra cuando usas `yokai-query` (incluye `socket.io-client`).

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

## Helper simple

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

// luego
// dispose();
```

## SSE

Tambien podes usar Server-Sent Events sin deps extra:

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

## Presets de chat + presence

```ts
import { createChatRoomBridge } from "yokai-query";

const bridge = createChatRoomBridge({
  socket,
  roomId: "room-1",
  getMessageId: (msg) => msg.id,
});

bridge.start();
```

Eventos por defecto:
- `message:new` -> `["messages", roomId]` (append)
- `presence:update` -> `["presence", roomId]` (replace)
- `typing:update` -> `["typing", roomId]` (replace)

## WebRTC (helper de signaling)

```ts
import { createWebRtcPeer } from "yokai-query";

const peer = createWebRtcPeer({
  id: "alice",
  onSignal: (payload) => socket.emit("rtc:signal", payload),
});

socket.on("rtc:signal", (payload) => peer.handleSignal(payload));
await peer.start();
```

Este helper maneja offer/answer/ICE para llamadas 1:1. Usa tu socket/SSE para signaling.

## Notas

- Usa `invalidate` si preferis re-sync del server en vez de parchear cache.
- Dedupea por `id` si es necesario.
- Socket.IO es opcional; cualquier cliente con `on/off` funciona.
- `connectSocketCache` usa `socket.io-client` (incluido en `yokai-query`).
