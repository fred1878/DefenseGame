import { describe, expect, it } from "vitest";
import { GAME } from "../config";
import {
  defensePlayAreaLayout,
  readSafeInsets,
} from "../ui/layout/screenLayout";
import { defenseWorldToScreen } from "./defenseCamera";

describe("defenseWorldToScreen", () => {
  it("maps world origin with viewport inset", () => {
    const scene = {
      scale: { width: GAME.width, height: GAME.height },
    } as Parameters<typeof defensePlayAreaLayout>[0];
    const safe = readSafeInsets();
    const play = defensePlayAreaLayout(scene, safe);
    const cam = {
      scrollX: 10,
      scrollY: 20,
      zoom: 1,
      x: play.x,
      y: play.y,
    } as Pick<
      Phaser.Cameras.Scene2D.Camera,
      "scrollX" | "scrollY" | "zoom" | "x" | "y"
    > as Phaser.Cameras.Scene2D.Camera;

    const pt = defenseWorldToScreen(cam, 0, 0);
    expect(pt.x).toBe(-10 + play.x);
    expect(pt.y).toBe(-20 + play.y);
  });
});
