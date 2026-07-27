const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function replacer(_: string, v: unknown): unknown {
  if (typeof v === 'bigint') return { __bigint: String(v) };
  return v;
}

function reviver(_: string, v: unknown): unknown {
  if (typeof v === 'string' && ISO_DATE_RE.test(v)) return new Date(v);
  if (v !== null && typeof v === 'object' && '__bigint' in (v as object))
    return BigInt((v as Record<string, string>).__bigint);
  return v;
}

/** Serialize any value (including BigInt and Date) to a JSON string safe for cache storage. */
export function cacheSerialize(value: unknown): string {
  return JSON.stringify(value, replacer);
}

/** Deserialize a string produced by cacheSerialize, restoring BigInt and Date types. */
export function cacheDeserialize<T>(raw: string): T {
  return JSON.parse(raw, reviver) as T;
}
