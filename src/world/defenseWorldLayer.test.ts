import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import {
  adoptDefenseWorldObject,
  isInDefenseWorldLayer,
} from "./defenseWorldLayer";

function mockLayer(): Phaser.GameObjects.Layer {
  const children: Phaser.GameObjects.GameObject[] = [];
  const layer = {
    add(go: Phaser.GameObjects.GameObject) {
      children.push(go);
      (
        go as { parentContainer?: Phaser.GameObjects.GameObject }
      ).parentContainer = layer as unknown as Phaser.GameObjects.GameObject;
    },
    children,
  };
  return layer as unknown as Phaser.GameObjects.Layer;
}

describe("defenseWorldLayer", () => {
  it("detects objects parented under the world layer", () => {
    const worldLayer = mockLayer();
    const child = {
      parentContainer: undefined,
    } as unknown as Phaser.GameObjects.GameObject;
    worldLayer.add(child);
    expect(isInDefenseWorldLayer(child, worldLayer)).toBe(true);
  });

  it("adoptDefenseWorldObject parents scene-root objects", () => {
    const worldLayer = mockLayer();
    const gfx = {
      parentContainer: undefined,
    } as unknown as Phaser.GameObjects.GameObject;
    adoptDefenseWorldObject(gfx, worldLayer);
    expect(isInDefenseWorldLayer(gfx, worldLayer)).toBe(true);
  });
});
