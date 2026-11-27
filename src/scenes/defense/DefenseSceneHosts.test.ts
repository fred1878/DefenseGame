import { afterEach, describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import type { DefenseRunState } from "./DefenseRunState";
import {
  defenseEnemySpawnerHost,
  defenseNightEndContext,
} from "./DefenseSceneHosts";
import {
  castTally,
  combatTally,
  resetCombatTally,
} from "../../e2e/combatTally";

const btn = () => ({
  container: {
    destroy: vi.fn(),
    setVisible: vi.fn(),
    disableInteractive: vi.fn(),
  },
});

function nightEnd() {
  const run = {
    save: {},
    player: {},
    wallHp: 5,
    safe: {},
    nightEnded: false,
    endlessSelections: [{}],
    leaveEndlessBtn: null as ReturnType<typeof btn> | null,
    returnToTownBtn: null as ReturnType<typeof btn> | null,
  };
  const topHud = { setVisible: vi.fn() };
  const registerUiDraw = vi.fn();
  const onReturnToTown = vi.fn();
  const ctx = defenseNightEndContext({
    scene: { registry: {} } as unknown as Phaser.Scene,
    run: run as unknown as DefenseRunState,
    hudText: {} as Phaser.GameObjects.Text,
    topHud: topHud as never,
    registerUiDraw,
    onReturnToTown,
  });
  return { run, topHud, registerUiDraw, onReturnToTown, ctx };
}

describe("defenseNightEndContext", () => {
  it("marks the night ended, clears endless and forwards draws / return", () => {
    const t = nightEnd();
    expect(t.ctx.wallHp).toBe(5);
    t.ctx.markNightEnded();
    expect(t.run.nightEnded).toBe(true);
    expect(t.topHud.setVisible).toHaveBeenCalledWith(false);
    t.ctx.setEndlessSelectionsNull();
    expect(t.run.endlessSelections).toBeNull();
    const go = {} as Phaser.GameObjects.GameObject;
    t.ctx.registerUiDraw(go);
    expect(t.registerUiDraw).toHaveBeenCalledWith(go);
    t.ctx.onReturnToTown();
    expect(t.onReturnToTown).toHaveBeenCalled();
  });

  it("hides the leave button only when there is one", () => {
    const t = nightEnd();
    t.ctx.hideLeaveEndlessBtn();
    const leave = btn();
    t.run.leaveEndlessBtn = leave;
    t.ctx.hideLeaveEndlessBtn();
    expect(leave.container.setVisible).toHaveBeenCalledWith(false);
    expect(leave.container.disableInteractive).toHaveBeenCalled();
  });

  it("replacing the return button destroys the old one, not the same one", () => {
    const t = nightEnd();
    const a = btn();
    const b = btn();
    t.ctx.setReturnToTownBtn(a as never);
    t.ctx.setReturnToTownBtn(a as never);
    expect(a.container.destroy).not.toHaveBeenCalled();
    t.ctx.setReturnToTownBtn(b as never);
    expect(a.container.destroy).toHaveBeenCalled();
    expect(t.run.returnToTownBtn).toBe(b);
  });
});

describe("defenseEnemySpawnerHost", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetCombatTally();
  });

  const make = () => {
    const run = { enemies: [], targeting: { setFocusEnemy: vi.fn() } };
    const damageNumbers = { floatFromSource: vi.fn() };
    const onRemovedFromPlay = vi.fn();
    const registerWorldDraw = vi.fn();
    const host = defenseEnemySpawnerHost({
      scene: {} as Phaser.Scene,
      store: {} as never,
      run: run as unknown as DefenseRunState,
      enemyGroup: {} as never,
      damageNumbers: damageNumbers as never,
      registerWorldDraw,
      onRemovedFromPlay,
    });
    return { run, damageNumbers, onRemovedFromPlay, registerWorldDraw, host };
  };
  const enemy = { damageable: { id: "e1" }, sprite: {} } as never;

  it("wires hooks, masking and damage numbers to the run", () => {
    const t = make();
    expect(t.host.enemies).toBe(t.run.enemies);
    t.host.hooks.onRemovedFromPlay();
    expect(t.onRemovedFromPlay).toHaveBeenCalled();
    t.host.hooks.onFocusEnemy("e1");
    expect(t.run.targeting.setFocusEnemy).toHaveBeenCalledWith("e1");
    const go = {} as Phaser.GameObjects.GameObject;
    t.host.maskWorldObject?.(go);
    expect(t.registerWorldDraw).toHaveBeenCalledWith(go);
    t.host.notifyDamaged?.(enemy, 7, "fire", "spell");
    expect(t.damageNumbers.floatFromSource).toHaveBeenCalledWith("e1", {}, 7, {
      flavor: "fire",
    });
  });

  it("records the combat tally only in E2E mode", () => {
    const t = make();
    t.host.notifyDamaged?.(enemy, 3, "fire", "spell");
    const before = JSON.stringify([combatTally(), castTally()]);
    vi.stubEnv("VITE_E2E", "true");
    t.host.notifyDamaged?.(enemy, 3, "fire", "spell");
    expect(JSON.stringify([combatTally(), castTally()])).not.toBe(before);
  });
});
