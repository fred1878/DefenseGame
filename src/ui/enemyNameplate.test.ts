import { describe, expect, it, vi } from "vitest";
import {
  destroyEnemyNameplate,
  prepareEnemyNameplateForRespawn,
  recycleEnemyNameplateAfterDeath,
  updateEnemyNameplate,
  stashEnemyNameplateForPool,
  type EnemyNameplate,
} from "./enemyNameplate";

function mockPlate(): EnemyNameplate {
  const container = {
    setAlpha: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  return {
    container: container as unknown as EnemyNameplate["container"],
    nameText: { setText: vi.fn() } as unknown as EnemyNameplate["nameText"],
    hpText: { setText: vi.fn() } as unknown as EnemyNameplate["hpText"],
    barGfx: {
      clear: vi.fn(),
      fillStyle: vi.fn().mockReturnThis(),
      fillRect: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(),
      strokeRect: vi.fn().mockReturnThis(),
    } as unknown as EnemyNameplate["barGfx"],
    barW: 52,
    barH: 4,
    barY: 3,
    dying: false,
  };
}

function mockScene() {
  const tweens = { killTweensOf: vi.fn(), add: vi.fn() };
  return { tweens } as unknown as Phaser.Scene;
}

describe("enemy nameplate pooling", () => {
  it("stashes hidden after death fade completes", () => {
    const plate = mockPlate();
    plate.dying = true;
    const scene = mockScene();
    stashEnemyNameplateForPool(plate, scene);
    expect(plate.dying).toBe(false);
    expect(plate.container.setAlpha).toHaveBeenCalledWith(0);
    expect(plate.container.setVisible).toHaveBeenCalledWith(false);
  });

  it("does not restore alpha to 1 when death fade completes", () => {
    const plate = mockPlate();
    const scene = mockScene();
    let onComplete: (() => void) | undefined;
    vi.mocked(scene.tweens.add).mockImplementation((cfg) => {
      onComplete = (cfg as { onComplete?: () => void }).onComplete;
      return {} as Phaser.Tweens.Tween;
    });
    recycleEnemyNameplateAfterDeath(plate, scene, vi.fn());
    expect(plate.dying).toBe(true);
    onComplete?.();
    expect(plate.dying).toBe(false);
    expect(plate.container.setAlpha).toHaveBeenCalledWith(0);
    expect(plate.container.setAlpha).not.toHaveBeenCalledWith(1);
  });

  it("prepareEnemyNameplateForRespawn clears dying so updates apply", () => {
    const plate = mockPlate();
    plate.dying = true;
    const scene = mockScene();
    prepareEnemyNameplateForRespawn(plate, scene);
    expect(plate.dying).toBe(false);
    expect(plate.container.setVisible).toHaveBeenCalledWith(true);
    expect(plate.container.setAlpha).toHaveBeenCalledWith(1);
  });
});

describe("destroyEnemyNameplate", () => {
  it("destroys a plate and ignores a missing one", () => {
    destroyEnemyNameplate(undefined);
    const plate = mockPlate();
    destroyEnemyNameplate(plate);
    expect(plate.container.destroy).toHaveBeenCalledWith(true);
  });
});

describe("updateEnemyNameplate leftover branches", () => {
  it("skips updates on a dying plate and draws no fill at zero HP", () => {
    const plate = mockPlate();
    const damageable = {
      id: "e1",
      hp: 0,
      maxHp: 10,
      alive: false,
      team: "enemy" as const,
    };
    plate.dying = true;
    updateEnemyNameplate(plate, 1, 2, 32, damageable);
    expect(plate.container.setPosition).not.toHaveBeenCalled();

    plate.dying = false;
    updateEnemyNameplate(plate, 3, 4, 32, damageable);
    expect(plate.hpText.setText).toHaveBeenCalledWith("0/10");
    expect(plate.barGfx.fillRect).toHaveBeenCalledTimes(1);
  });

  it("recycles nothing when the plate is missing or already dying", () => {
    const onComplete = vi.fn();
    recycleEnemyNameplateAfterDeath(undefined, mockScene(), onComplete);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const plate = mockPlate();
    plate.dying = true;
    recycleEnemyNameplateAfterDeath(plate, mockScene(), onComplete);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });
});
