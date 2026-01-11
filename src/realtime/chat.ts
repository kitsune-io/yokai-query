import type { QueryKey } from "../types";
import { createSocketCacheBridge, SocketLike } from "./socket";

export type ChatBridgeOptions<TMessage, TPresence, TTyping> = {
  socket: SocketLike;
  roomId: string;
  messageKey?: QueryKey;
  presenceKey?: QueryKey;
  typingKey?: QueryKey;
  getMessageId?: (message: TMessage) => unknown;
  events?: {
    message?: string;
    presence?: string;
    typing?: string;
  };
  onError?: (error: unknown, payload: unknown, event: string) => void;
};

const dedupeById = <T>(list: T[], getId?: (item: T) => unknown) => {
  if (!getId) return list;
  const seen = new Set<unknown>();
  return list.filter((item) => {
    const id = getId(item);
    if (id === undefined || id === null) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const createChatRoomBridge = <
  TMessage = unknown,
  TPresence = unknown,
  TTyping = unknown
>(
  options: ChatBridgeOptions<TMessage, TPresence, TTyping>
) => {
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
          const list = Array.isArray(prev) ? (prev as TMessage[]) : [];
          const next = [...list, payload as TMessage];
          return dedupeById(next, options.getMessageId);
        },
      },
      {
        event: presenceEvent,
        key: () => presenceKey,
        update: (_prev, payload) => payload as TPresence,
      },
      {
        event: typingEvent,
        key: () => typingKey,
        update: (_prev, payload) => payload as TTyping,
      },
    ],
    onError: options.onError,
  });
};
