import { describe, expect, it, vi } from "vitest";
import {
  prepareEnemyNameplateForRespawn,
  recycleEnemyNameplateAfterDeath,
  stashEnemyNameplateForPool,
  type EnemyNameplate,
} from "./enemyNameplate";

function mockPlate(): EnemyNameplate {
  const container = {
    setAlpha: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
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
