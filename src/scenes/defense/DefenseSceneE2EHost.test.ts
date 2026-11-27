import { describe, expect, it } from "vitest";
import * as impl from "./DefenseSceneE2E";
import { createDefenseSceneE2eHost } from "./DefenseSceneE2EHost";
import type { DefenseSceneE2eDelegate } from "./DefenseSceneE2ETypes";

const helperNames = Object.keys(impl).filter(
  (k) =>
    k.startsWith("defenseSceneE2e") &&
    typeof (impl as Record<string, unknown>)[k] === "function",
);

describe("createDefenseSceneE2eHost", () => {
  it("exposes every defenseSceneE2e* helper without the prefix", () => {
    const host = createDefenseSceneE2eHost({} as DefenseSceneE2eDelegate);
    const keys = Object.keys(host).sort();
    expect(keys).toHaveLength(helperNames.length);
    expect(keys).toContain("enemyCount");
    expect(keys).toContain("isReady");
    expect(keys).toContain("bottomChromeTextureKey");
    expect(keys).not.toContain("e2eEnemyCount");
  });

  it("passes the bound scene first, then the caller's args", () => {
    const alive = { damageable: { alive: true, hp: 3 }, defId: "grunt" };
    const dead = { damageable: { alive: false, hp: 0 }, defId: "grunt" };
    const scene = {
      run: { enemies: [alive, dead, alive] },
    } as unknown as DefenseSceneE2eDelegate;
    const host = createDefenseSceneE2eHost(scene);
    expect(host.enemyCount()).toBe(2);
    expect(host.livingEnemyHps()).toEqual([3, 3]);
  });
});

describe("setAutoAttackEnabled", () => {
  it("flips the run's auto-attack flag", () => {
    const scene = {
      run: { autoAttackEnabled: true },
    } as unknown as DefenseSceneE2eDelegate;
    const host = createDefenseSceneE2eHost(scene);
    host.setAutoAttackEnabled(false);
    expect(host.autoAttackEnabled()).toBe(false);
  });
});
