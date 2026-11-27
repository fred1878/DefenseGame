import type { DamageFlavor } from "../combat/rules/DamageSystem";
import type {
  HitFlashConfig,
  HitFlashFlavorEntry,
} from "../core/normalizeHitFlash";
import { setTuning, tuning } from "../tuning/gameTuning";

/** Replace runtime hit-flash tuning after `public/data/hit-flash.json` loads (Boot). */
export function applyHitFlashConfig(config: HitFlashConfig): void {
  setTuning("hitFlash", {
    durationMs: config.durationMs,
    flavors: { ...config.flavors },
  });
}

export function hitFlashDurationMs(): number {
  return tuning("hitFlash").durationMs;
}

export function hitFlashFlavorEntry(flavor: DamageFlavor): HitFlashFlavorEntry {
  return tuning("hitFlash").flavors[flavor];
}

export function hitFlashTintFor(flavor: DamageFlavor): number {
  return tuning("hitFlash").flavors[flavor].tint;
}
