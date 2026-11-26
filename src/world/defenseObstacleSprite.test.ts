import { describe, expect, it } from "vitest";
import { fakeGameObject, fakeScene } from "../test/fakeScene";
import { configureDefenseObstacleArt } from "./defenseObstacleSprite";

describe("configureDefenseObstacleArt", () => {
  it("crops and sizes rock obstacle art", () => {
    const image = fakeGameObject("image");
    const scene = fakeScene();
    scene.registry.set("worldPixelScale", 2);
    configureDefenseObstacleArt(
      image as unknown as Phaser.GameObjects.Image,
      "obstacle_boulder_sm",
      scene.registry as import("phaser").Data.DataManager,
    );
    expect(image.callsTo("setCrop").length).toBeGreaterThan(0);
    expect(image.callsTo("setDisplaySize").length).toBeGreaterThan(0);
    expect(image.last("setOrigin")?.[0]).toBe(0.5);
  });
});
