function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeJsonValue(
  value: unknown,
  seen: WeakSet<object>,
): unknown {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry, seen));
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([key, entry]) => [String(key), sanitizeJsonValue(entry, seen)]),
    );
  }
  if (value instanceof Set) {
    return [...value].map((entry) => sanitizeJsonValue(entry, seen));
  }
  if (ArrayBuffer.isView(value)) {
    return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  if (!isPlainObject(value)) {
    return String(value);
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalized = sanitizeJsonValue(entry, seen);
    if (normalized !== undefined) {
      sanitized[key] = normalized;
    }
  }
  seen.delete(value);
  return sanitized;
}

export function toJsonTransportValue<T>(value: T): T {
  return sanitizeJsonValue(value, new WeakSet<object>()) as T;
}

export function stringifyJsonTransport(value: unknown): string {
  return JSON.stringify(toJsonTransportValue(value));
}
