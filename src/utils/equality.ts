export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export const replaceEqualDeep = <T>(a: T, b: T): T => {
  if (a === b) return a;
  if (Array.isArray(a) && Array.isArray(b)) {
    const length = b.length;
    const result = new Array(length);
    let equal = a.length === length;
    for (let i = 0; i < length; i += 1) {
      result[i] = replaceEqualDeep(a[i], b[i]);
      if (result[i] !== a[i]) equal = false;
    }
    return (equal ? a : (result as unknown as T));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      const out: Record<string, unknown> = {};
      bKeys.forEach((k) => {
        out[k] = replaceEqualDeep((a as any)[k], (b as any)[k]);
      });
      return out as T;
    }
    let equal = true;
    const out: Record<string, unknown> = {};
    bKeys.forEach((k) => {
      const value = replaceEqualDeep((a as any)[k], (b as any)[k]);
      out[k] = value;
      if (value !== (a as any)[k]) equal = false;
    });
    return (equal ? a : (out as T));
  }
  return b;
};
