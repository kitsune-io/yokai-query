import { QueryKey, QueryKeyHash } from "../types";

export const stableStringify = (value: unknown): string => {
  const stack = new Set<unknown>();
  const walk = (val: unknown): string => {
    if (val === null) return "null";
    const type = typeof val;
    if (type === "string") return JSON.stringify(val);
    if (type === "number") return Number.isFinite(val) ? String(val) : "null";
    if (type === "boolean") return val ? "true" : "false";
    if (type === "undefined") return "\"__undefined__\"";
    if (type === "bigint") return JSON.stringify(`__bigint__:${val}`);
    if (type === "function") return "\"__function__\"";
    if (val instanceof Date) return JSON.stringify(`__date__:${val.toISOString()}`);
    if (Array.isArray(val)) {
      return `[${val.map((item) => walk(item)).join(",")}]`;
    }
    if (type === "object") {
      if (stack.has(val)) throw new Error("Circular value in query key");
      stack.add(val);
      const obj = val as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const result = `{${keys
        .map((k) => `${JSON.stringify(k)}:${walk(obj[k])}`)
        .join(",")}}`;
      stack.delete(val);
      return result;
    }
    return "\"__unknown__\"";
  };
  return walk(value);
};

export const hashKey = (key: QueryKey): QueryKeyHash => {
  if (typeof key === "string") return key;
  return `k:${stableStringify(key)}`;
};

export const keyToString = (key: QueryKey): string => {
  if (typeof key === "string") return key;
  const first = key[0];
  if (typeof first === "string") return first;
  return hashKey(key);
};
