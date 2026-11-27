import type { GameplayTuning } from "../core/data/normalizeGameplay";
import { setTuning } from "../tuning/gameTuning";

/** Apply `public/data/gameplay.json` (Boot, test setup, sim). Read with `tuning("gameplay")`. */
export function applyGameplay(next: GameplayTuning): void {
  setTuning("gameplay", next);
}
