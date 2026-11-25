export type DebugFlags = {
  showHitboxes: boolean;
  showCombatRanges: boolean;
  showTouchInput: boolean;
  showEnemyPaths: boolean;
  showFpsCounter: boolean;
};

const REGISTRY_KEY = "debugFlags";

export function getDebugFlags(registry: Phaser.Data.DataManager): DebugFlags {
  const existing = registry.get(REGISTRY_KEY) as
    | Partial<DebugFlags>
    | undefined;
  if (existing) {
    return {
      showHitboxes: existing.showHitboxes ?? false,
      showCombatRanges: existing.showCombatRanges ?? false,
      showTouchInput: existing.showTouchInput ?? false,
      showEnemyPaths: existing.showEnemyPaths ?? false,
      showFpsCounter: existing.showFpsCounter ?? false,
    };
  }
  const defaults: DebugFlags = {
    showHitboxes: false,
    showCombatRanges: false,
    showTouchInput: false,
    showEnemyPaths: false,
    showFpsCounter: false,
  };
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

export function setShowCombatRanges(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  const flags = getDebugFlags(registry);
  flags.showCombatRanges = value;
  registry.set(REGISTRY_KEY, { ...flags });
}

export function showCombatRanges(registry: Phaser.Data.DataManager): boolean {
  return getDebugFlags(registry).showCombatRanges;
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

export function setShowEnemyPaths(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  const flags = getDebugFlags(registry);
  flags.showEnemyPaths = value;
  registry.set(REGISTRY_KEY, { ...flags });
}

export function showEnemyPaths(registry: Phaser.Data.DataManager): boolean {
  return getDebugFlags(registry).showEnemyPaths;
}

export function setShowFpsCounter(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  const flags = getDebugFlags(registry);
  flags.showFpsCounter = value;
  registry.set(REGISTRY_KEY, { ...flags });
}

export function showFpsCounter(registry: Phaser.Data.DataManager): boolean {
  return getDebugFlags(registry).showFpsCounter;
}
