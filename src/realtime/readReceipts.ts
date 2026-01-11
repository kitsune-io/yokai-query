import { QueryKey } from "../types";
import { useQueryStore } from "../store";
import { hashKey } from "../utils/keys";

export type ReadReceipt = {
  messageId: string;
  userId: string;
  readAt: number;
};

export type ReadReceiptOptions = {
  key: QueryKey;
};

export const addReadReceipt = (receipt: ReadReceipt, options: ReadReceiptOptions) => {
  const state = useQueryStore.getState();
  const hashedKey = hashKey(options.key);
  const prev = state.queries[hashedKey]?.data;
  const list = Array.isArray(prev) ? (prev as ReadReceipt[]) : [];
  const exists = list.some(
    (item) =>
      item.messageId === receipt.messageId && item.userId === receipt.userId
  );
  if (exists) return;
  state.setQueryData(options.key, [...list, receipt], {
    tags: state.queries[hashedKey]?.tags,
  });
};
