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

export function requireFiniteNumber(value: unknown, path: string): number {
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

/** Optional numeric field; throws when present but not a finite number. */
export function optionalFiniteNumber(
  value: unknown,
  path: string,
): number | undefined {
  if (value === undefined) return undefined;
  return requireFiniteNumber(value, path);
}

/** Spec for a group of all-number JSON sections: section name → required keys. */
export type NumberSectionSpec = Record<string, readonly string[]>;

/** Parsed shape of a {@link NumberSectionSpec}. */
export type NumberSections<S extends NumberSectionSpec> = {
  [K in keyof S]: Record<S[K][number], number>;
};

/** Read nested all-number sections (`root[section][key]`); every key is required. */
export function requireNumberSections<S extends NumberSectionSpec>(
  root: Record<string, unknown>,
  spec: S,
  path: string,
): NumberSections<S> {
  const out: Record<string, Record<string, number>> = {};
  for (const [name, keys] of Object.entries(spec)) {
    const block = requireRecord(root[name], `${path}.${name}`);
    out[name] = requireNumberFields(block, keys, `${path}.${name}`);
  }
  return out as NumberSections<S>;
}

/** Every key named in a section spec (for `DATA_FIELDS.md` parity). */
export function numberSectionKeys(spec: NumberSectionSpec): string[] {
  return [...new Set(Object.values(spec).flat())].sort();
}
