export class ConfigLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigLoadError";
  }
}

export function requireRecord(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigLoadError(`Expected object at ${path}`);
  }
  return value as Record<string, unknown>;
}

export function requireFiniteNumber(
  value: unknown,
  path: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConfigLoadError(`Missing or invalid number at ${path}`);
  }
  return value;
}

export function requireNumberFields(
  obj: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) {
    out[key] = requireFiniteNumber(obj[key], `${path}.${key}`);
  }
  return out;
}