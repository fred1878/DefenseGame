import type Phaser from "phaser";
import {
  configurePixelArtTextures,
  cycleDebugWorldTextureFilter,
  DEBUG_WORLD_TEXTURE_FILTER_KEY,
  type WorldTextureFilterMode,
} from "./pixelArtTextures";

export { getDebugWorldTextureFilter } from "./pixelArtTextures";

export const DEBUG_CAMERA_ROUND_PIXELS_KEY = "debugCameraRoundPixels";
export const DEBUG_RENDERER_ROUND_PIXELS_KEY = "debugRendererRoundPixels";
export const DEBUG_SCALE_AUTO_ROUND_KEY = "debugScaleAutoRound";

export function worldTextureFilterLabel(mode: WorldTextureFilterMode): string {
  if (mode === "linear") return "Tex filter: linear";
  if (mode === "hybrid") return "Tex filter: hybrid";
  return "Tex filter: nearest";
}

function readBool(
  registry: Phaser.Data.DataManager,
  key: string,
  defaultValue: boolean,
): boolean {
  const v = registry.get(key) as boolean | undefined;
  return v === undefined ? defaultValue : v;
}

export function getDebugCameraRoundPixels(
  registry: Phaser.Data.DataManager,
): boolean {
  return readBool(registry, DEBUG_CAMERA_ROUND_PIXELS_KEY, true);
}

export function setDebugCameraRoundPixels(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  registry.set(DEBUG_CAMERA_ROUND_PIXELS_KEY, value);
}

export function getDebugRendererRoundPixels(
  registry: Phaser.Data.DataManager,
): boolean {
  return readBool(registry, DEBUG_RENDERER_ROUND_PIXELS_KEY, true);
}

export function setDebugRendererRoundPixels(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  registry.set(DEBUG_RENDERER_ROUND_PIXELS_KEY, value);
}

export function getDebugScaleAutoRound(
  registry: Phaser.Data.DataManager,
): boolean {
  return readBool(registry, DEBUG_SCALE_AUTO_ROUND_KEY, true);
}

export function setDebugScaleAutoRound(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  registry.set(DEBUG_SCALE_AUTO_ROUND_KEY, value);
}

export function onOffLabel(prefix: string, on: boolean): string {
  return `${prefix}: ${on ? "ON" : "OFF"}`;
}

/** Phaser copies `config.roundPixels` into each CameraManager at scene init only — toggle cameras live. */
export function applyRendererRoundPixels(game: Phaser.Game, on: boolean): void {
  const config = game.config as Phaser.Core.Config & { roundPixels?: boolean };
  if (typeof config.roundPixels === "boolean") {
    config.roundPixels = on;
  }
  for (const scene of game.scene.scenes) {
    if (!scene.sys?.isActive()) continue;
    const mgr = scene.cameras;
    if (mgr && "roundPixels" in mgr) {
      (mgr as { roundPixels: boolean }).roundPixels = on;
    }
    for (const cam of mgr.cameras) {
      cam.setRoundPixels(on);
    }
  }
}

export function applyCameraRoundPixels(game: Phaser.Game, on: boolean): void {
  for (const key of ["Boot", "Town", "Defense"] as const) {
    const scene = game.scene.getScene(key);
    if (!scene?.scene.isActive()) continue;
    scene.cameras.main.setRoundPixels(on);
  }
}

function textureHostScene(game: Phaser.Game): Phaser.Scene | null {
  for (const key of ["Defense", "Town", "Boot"] as const) {
    const s = game.scene.getScene(key);
    if (s?.scene.isActive()) return s;
  }
  return game.scene.scenes.find((s) => s.sys?.isActive()) ?? null;
}

/** Apply session pixel-render debug registry to scale, cameras, renderer, and textures. */
export function applyPixelRenderDebugSettings(game: Phaser.Game): void {
  const reg = game.registry;
  game.scale.autoRound = getDebugScaleAutoRound(reg);
  applyRendererRoundPixels(game, getDebugRendererRoundPixels(reg));
  applyCameraRoundPixels(game, getDebugCameraRoundPixels(reg));
  const host = textureHostScene(game);
  if (host) {
    configurePixelArtTextures(host);
  }
}

export function setDebugWorldTextureFilter(
  game: Phaser.Game,
  mode: WorldTextureFilterMode,
): WorldTextureFilterMode {
  game.registry.set(DEBUG_WORLD_TEXTURE_FILTER_KEY, mode);
  applyPixelRenderDebugSettings(game);
  const defense = game.scene.getScene("Defense");
  if (defense?.scene.isActive()) {
    defense.scene.restart();
  }
  return mode;
}

export function cycleWorldTextureFilter(
  game: Phaser.Game,
): WorldTextureFilterMode {
  const next = cycleDebugWorldTextureFilter(game.registry);
  return setDebugWorldTextureFilter(game, next);
}
