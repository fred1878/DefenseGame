import { tuning } from "../tuning/gameTuning";

/** SFX volumes (0–1) from `public/data/gameplay.json` `audio`. */
export function sfxVolumes() {
  return tuning("gameplay").audio;
}
