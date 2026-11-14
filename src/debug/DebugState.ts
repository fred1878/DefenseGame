export type DebugFlags = {
  showHitboxes: boolean;
  showTouchInput: boolean;
};

const REGISTRY_KEY = "debugFlags";

export function getDebugFlags(registry: Phaser.Data.DataManager): DebugFlags {
  const existing = registry.get(REGISTRY_KEY) as Partial<DebugFlags> | undefined;
  if (existing) {
    return {
      showHitboxes: existing.showHitboxes ?? false,
      showTouchInput: existing.showTouchInput ?? false,
    };
  }
  const defaults: DebugFlags = { showHitboxes: false, showTouchInput: false };
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

export function setShowTouchInput(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  const flags = getDebugFlags(registry);
  flags.showTouchInput = value;
  registry.set(REGISTRY_KEY, { ...flags });
}

export function showTouchInput(registry: Phaser.Data.DataManager): boolean {
  const flags = getDebugFlags(registry);
  return flags.showTouchInput ?? false;
}