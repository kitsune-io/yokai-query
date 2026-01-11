import { useQueryStore } from "../store";

export type StoreEventDetail = {
  type: string;
  payload: unknown;
  ts: number;
};

export type StoreEventReporterOptions = {
  eventName?: string;
  onEvent: (event: StoreEventDetail) => void;
};

export const createStoreEventReporter = (
  options: StoreEventReporterOptions
) => {
  if (typeof window === "undefined") {
    return () => {};
  }
  const eventName =
    options.eventName ?? useQueryStore.getState().config.devtools.eventName;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail as StoreEventDetail | undefined;
    if (!detail) return;
    options.onEvent(detail);
  };

  window.addEventListener(eventName, handler);
  return () => {
    window.removeEventListener(eventName, handler);
  };
};
