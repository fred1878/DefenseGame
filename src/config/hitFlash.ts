import type { DamageFlavor } from "../combat/DamageSystem";
import type {
  HitFlashConfig,
  HitFlashFlavorEntry,
} from "../core/normalizeHitFlash";

/** Active hit-flash tuning (from JSON after Boot). Uninitialized until `applyHitFlashConfig`. */
export let HIT_FLASH_CONFIG: HitFlashConfig = unsetHitFlashConfig();

function unsetHitFlashConfig(): HitFlashConfig {
  const trap = new Proxy({} as HitFlashConfig, {
    get() {
      throw new Error(
        "HIT_FLASH_CONFIG not loaded — Boot must apply public/data/hit-flash.json",
      );
    },
  });
  return trap;
}

/** Replace runtime hit-flash tuning after `public/data/hit-flash.json` loads (Boot). */
export function applyHitFlashConfig(config: HitFlashConfig): void {
  HIT_FLASH_CONFIG = {
    durationMs: config.durationMs,
    flavors: { ...config.flavors },
  };
}

export function hitFlashDurationMs(): number {
  return HIT_FLASH_CONFIG.durationMs;
}

export function hitFlashFlavorEntry(flavor: DamageFlavor): HitFlashFlavorEntry {
  return HIT_FLASH_CONFIG.flavors[flavor];
}

export function hitFlashTintFor(flavor: DamageFlavor): number {
  return HIT_FLASH_CONFIG.flavors[flavor].tint;
}
