import type Phaser from "phaser";
import { COMBAT_FX_ASSETS, SPELL_FX_ASSETS } from "../content/assets";
import { HOLY_FX_ASSETS } from "../content/holyFxAssets";
import { ICE_FX_ASSETS } from "../content/iceFxAssets";
import { PVFX_FX_ASSETS } from "../content/combatPvfxAssets";
import { MELEE_FX_ASSETS } from "../content/meleeFxAssets";
import { SMOKE_FX_ASSETS } from "../content/smokeFxAssets";
import { isE2EEnabled } from "./e2eMode";
import { publishE2E } from "./e2eGlobal";

/** Publish whether every combat / spell FX texture is loaded (E2E only). */
export function markE2EAssetsLoaded(game: Phaser.Game): void {
  if (!isE2EEnabled()) return;
  const keys = [
    ...COMBAT_FX_ASSETS.map((a) => a.key),
    ...SPELL_FX_ASSETS.map((a) => a.key),
    ...HOLY_FX_ASSETS.map((a) => a.key),
    ...ICE_FX_ASSETS.map((a) => a.key),
    ...PVFX_FX_ASSETS.map((a) => a.key),
    ...MELEE_FX_ASSETS.map((a) => a.key),
    ...SMOKE_FX_ASSETS.map((a) => a.key),
  ];
  const ok = keys.every((k) => game.textures.exists(k));
  publishE2E({ assetsLoaded: ok, flags: { combatFxKeys: keys.join(",") } });
}
