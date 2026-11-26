import { describe, expect, it } from "vitest";
import Phaser from "phaser";
import { fakeGameObject, fakeScene, finishTween } from "./fakeScene";

type Harness = {
  originX: number;
  originY: number;
  x: number;
  y: number;
  then?: unknown;
  body: { velocity: { x: number; y: number } };
  input: { enabled: boolean };
  setOrigin: (x?: number, y?: number) => unknown;
  setPosition: (x: number, y?: number) => unknown;
  setVelocity: (vx: number, vy?: number) => unknown;
  setInteractive: () => unknown;
  disableInteractive: () => unknown;
};

describe("fakeScene helpers", () => {
  it("covers default origin, velocity, and disable without input", () => {
    const obj = fakeGameObject("image", [10, 20]) as unknown as Harness;
    obj.setOrigin();
    expect(obj.originX).toBe(0.5);
    expect(obj.originY).toBe(0.5);
    obj.setOrigin(0.25);
    expect(obj.originX).toBe(0.25);
    expect(obj.originY).toBe(0.25);
    obj.setPosition(3);
    expect(obj.x).toBe(3);
    expect(obj.y).toBe(20);
    obj.setPosition(4, 5);
    expect(obj.y).toBe(5);
    obj.setVelocity(7);
    expect(obj.body.velocity.x).toBe(7);
    expect(obj.body.velocity.y).toBe(7);
    obj.disableInteractive();
    obj.setInteractive();
    obj.disableInteractive();
    expect(obj.input.enabled).toBe(false);
    expect(obj.then).toBeUndefined();
  });

  it("finishes a tween whose target is a single object", () => {
    const target = { alpha: 1 };
    const updates: number[] = [];
    finishTween({
      targets: target,
      alpha: 0,
      duration: 100,
      onUpdate: () => updates.push(target.alpha),
      onComplete: () => updates.push(-1),
    });
    expect(target.alpha).toBe(0);
    expect(updates).toEqual([0, -1]);
  });

  it("builds a scene with add helpers", () => {
    const scene = fakeScene();
    const addImage = scene.add.image;
    if (!addImage) throw new Error("expected scene.add.image");
    const img = addImage(1, 2, "tex");
    expect(img.x).toBe(1);
    expect(img.y).toBe(2);
  });
});

describe("fakeScene leftover helpers", () => {
  it("covers mask, body reset, off, anim get, and camera helpers", () => {
    const scene = fakeScene({
      textures: ["tex"],
      anims: ["walk"],
      audio: ["sfx"],
    });
    const addImage = scene.add.image;
    if (!addImage) throw new Error("expected scene.add.image");
    const img = addImage(1, 2, "tex") as unknown as {
      filters: {
        external: { addMask: (src: unknown) => { kind: string } };
      };
      body: { reset: () => void };
      off: (event: string) => unknown;
      on: (event: string, fn: () => void) => unknown;
    };
    const mask = img.filters.external.addMask("src");
    expect(mask.kind).toBe("mask");
    img.body.reset();
    let fired = 0;
    img.on("pointerdown", () => {
      fired += 1;
    });
    img.off("pointerdown");
    expect(scene.anims.get("walk")).toEqual({ key: "walk", duration: 0 });
    expect(scene.anims.get("missing")).toBeUndefined();
    expect(scene.cameras.main.getWorldPoint(3, 4)).toEqual({ x: 3, y: 4 });
    expect(scene.sys.isActive()).toBe(true);
    expect(fired).toBe(0);
  });
});

describe("finishTween leftover branches", () => {
  it("finishes a tween whose targets are an array of objects", () => {
    const a = { alpha: 1 };
    const b = { alpha: 1 };
    finishTween({
      targets: [a, b],
      alpha: 0.25,
      duration: 50,
    });
    expect(a.alpha).toBe(0.25);
    expect(b.alpha).toBe(0.25);
  });
});

describe("fakeGameObject leftover branches", () => {
  it("falls back to Object.prototype when the stub class is missing", () => {
    const objects = Phaser.GameObjects as unknown as Record<string, unknown>;
    const prev = objects.GameObject;
    delete objects.GameObject;
    try {
      const go = fakeGameObject("not-a-real-kind", [1, 2]);
      expect(go.x).toBe(1);
      expect(go.y).toBe(2);
    } finally {
      objects.GameObject = prev;
    }
  });
});
