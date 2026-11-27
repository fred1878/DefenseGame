import type Phaser from "phaser";
import type { defenseMinimapLayout } from "../../ui/defenseMinimap";
import {
  combatChromeLayout,
  defensePlayAreaLayout,
} from "../../ui/screenLayout";
import { hudTextPosition } from "../../ui/defenseHudLayout";
import type { DefenseSceneE2eDelegate } from "./DefenseSceneE2ETypes";

/** E2E hooks: HUD layout probe and HUD band pixel sampling. */

export function defenseSceneE2eHudLayoutProbe(scene: DefenseSceneE2eDelegate): {
  playArea: ReturnType<typeof defensePlayAreaLayout>;
  chrome: ReturnType<typeof combatChromeLayout>;
  hudText: { x: number; y: number };
  minimap: ReturnType<typeof defenseMinimapLayout>;
} {
  const playArea = defensePlayAreaLayout(scene, scene.run.safe);
  const chrome = combatChromeLayout(scene, scene.run.safe);
  const hud = hudTextPosition(scene.run.safe);
  return {
    playArea,
    chrome,
    hudText: hud,
    minimap: scene.minimapLayout,
  };
}

function defenseSceneE2eHudBandPixelProbePoints(
  scene: DefenseSceneE2eDelegate,
): {
  topBand: { x: number; y: number };
  bottomBand: { x: number; y: number };
  playArea: { x: number; y: number };
} {
  const probe = defenseSceneE2eHudLayoutProbe(scene);
  return {
    topBand: {
      x: Math.round(scene.scale.width * 0.22),
      y: Math.max(8, Math.round(probe.playArea.topBandBottom * 0.42)),
    },
    bottomBand: {
      x: Math.round(scene.scale.width * 0.28),
      y: Math.round(
        probe.playArea.bottomBandTop +
          (scene.scale.height - probe.playArea.bottomBandTop) * 0.22,
      ),
    },
    playArea: {
      x: Math.round(scene.scale.width / 2),
      y: Math.round(probe.playArea.y + probe.playArea.height * 0.55),
    },
  };
}

function readPixelFromSnapshot(
  scene: DefenseSceneE2eDelegate,
  image: HTMLImageElement,
  gameX: number,
  gameY: number,
): { r: number; g: number; b: number; a: number; luminance: number } {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const bufW = image.width;
  const bufH = image.height;
  const bx = Math.min(bufW - 1, Math.max(0, Math.round((gameX / w) * bufW)));
  const by = Math.min(bufH - 1, Math.max(0, Math.round((gameY / h) * bufH)));
  const scratch = document.createElement("canvas");
  scratch.width = bufW;
  scratch.height = bufH;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { r: 0, g: 0, b: 0, a: 0, luminance: 0 };
  }
  ctx.drawImage(image, 0, 0);
  const d = ctx.getImageData(bx, by, 1, 1).data;
  const r = d[0] ?? 0;
  const g = d[1] ?? 0;
  const b = d[2] ?? 0;
  const a = d[3] ?? 0;
  return { r, g, b, a, luminance: (r + g + b) / 3 };
}

export function defenseSceneE2eSampleHudBandPixelsAsync(
  scene: DefenseSceneE2eDelegate,
): Promise<{
  points: {
    topBand: { x: number; y: number };
    bottomBand: { x: number; y: number };
    playArea: { x: number; y: number };
  };
  topBand: { r: number; g: number; b: number; a: number; luminance: number };
  bottomBand: { r: number; g: number; b: number; a: number; luminance: number };
  playArea: { r: number; g: number; b: number; a: number; luminance: number };
}> {
  const points = defenseSceneE2eHudBandPixelProbePoints(scene);
  return new Promise((resolve) => {
    scene.game.renderer.snapshot(
      (image: HTMLImageElement | Phaser.Display.Color) => {
        if (!(image instanceof HTMLImageElement)) {
          const zero = { r: 0, g: 0, b: 0, a: 0, luminance: 0 };
          resolve({
            points,
            topBand: zero,
            bottomBand: zero,
            playArea: zero,
          });
          return;
        }
        resolve({
          points,
          topBand: readPixelFromSnapshot(
            scene,
            image,
            points.topBand.x,
            points.topBand.y,
          ),
          bottomBand: readPixelFromSnapshot(
            scene,
            image,
            points.bottomBand.x,
            points.bottomBand.y,
          ),
          playArea: readPixelFromSnapshot(
            scene,
            image,
            points.playArea.x,
            points.playArea.y,
          ),
        });
      },
    );
  });
}
