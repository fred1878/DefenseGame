export type DebugFlags = {
  showHitboxes: boolean;
};

const REGISTRY_KEY = "debugFlags";

export function getDebugFlags(registry: Phaser.Data.DataManager): DebugFlags {
  const existing = registry.get(REGISTRY_KEY) as DebugFlags | undefined;
  if (existing) return existing;
  const defaults: DebugFlags = { showHitboxes: false };
  registry.set(REGISTRY_KEY, defaults);
  return defaults;
}

export function setShowHitboxes(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  const flags = getDebugFlags(registry);
  flags.showHitboxes = value;
  registry.set(REGISTRY_KEY, { ...flags });
}

export function showHitboxes(registry: Phaser.Data.DataManager): boolean {
  return getDebugFlags(registry).showHitboxes;
}