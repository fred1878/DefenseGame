import * as impl from "./DefenseSceneE2E";
import type { DefenseSceneE2eDelegate } from "./DefenseSceneE2ETypes";

const PREFIX = "defenseSceneE2e";

type Impl = typeof impl;
type ImplFnName = Extract<keyof Impl, `${typeof PREFIX}${string}`>;

/** `defenseSceneE2eFooBar` -> `fooBar`. */
type HostKey<K extends string> = K extends `${typeof PREFIX}${infer Rest}`
  ? Uncapitalize<Rest>
  : never;

/** Drop the leading scene argument; scene-free helpers pass through. */
type Bound<F> = F extends (...args: infer A) => infer R
  ? A extends [DefenseSceneE2eDelegate, ...infer Rest]
    ? (...args: Rest) => R
    : A extends []
      ? () => R
      : never
  : never;

/**
 * Every `defenseSceneE2e*` helper from the DefenseSceneE2E barrel, bound to
 * one scene and renamed without the prefix (`defenseSceneE2eEnemyCount(scene)`
 * -> `host.enemyCount()`). Adding a helper to the barrel exposes it here; no
 * per-method wrapper on DefenseScene is needed.
 */
export type DefenseSceneE2eHost = {
  [K in ImplFnName as HostKey<K>]: Bound<Impl[K]>;
};

// Compile-time guard: every helper either takes the scene first or no args
// (the runtime binding below relies on that via `fn.length`).
type BadHelpers = {
  [K in ImplFnName]: Bound<Impl[K]> extends never ? K : never;
}[ImplFnName];
const assertNoBadHelpers: [BadHelpers] extends [never] ? true : BadHelpers =
  true;
void assertNoBadHelpers;

export function createDefenseSceneE2eHost(
  scene: DefenseSceneE2eDelegate,
): DefenseSceneE2eHost {
  const host: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(impl)) {
    if (typeof value !== "function" || !name.startsWith(PREFIX)) continue;
    const fn = value as (...args: unknown[]) => unknown;
    const rest = name.slice(PREFIX.length);
    const key = rest.charAt(0).toLowerCase() + rest.slice(1);
    host[key] =
      fn.length === 0 ? fn : (...args: unknown[]) => fn(scene, ...args);
  }
  return host as DefenseSceneE2eHost;
}
