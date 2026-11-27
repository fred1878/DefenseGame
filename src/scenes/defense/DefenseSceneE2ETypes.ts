import type Phaser from "phaser";
import type { AttackMode } from "../../config";
import type { EnemyDef } from "../../core/DataStore";
import type { TouchButtonHandle } from "../../ui/touchButton";
import type { defenseMinimapLayout } from "../../ui/defenseMinimap";
import type { DefenseRunState } from "./DefenseRunState";

export type DefenseObstacleBumpCardinal = "north" | "south" | "east" | "west";

export type DefenseObstacleBumpProbe = {
  player: { x: number; y: number };
  surfaceGapPx: number;
  penetrationPx: number;
  edgeErrPx: number;
  pastCenter: boolean;
};

/**
 * Scene surface required by Playwright / `installE2E` hooks. DefenseScene
 * satisfies this structurally (no cast): per-run state lives on `run`.
 */
export type DefenseSceneE2eDelegate = Phaser.Scene & {
  readonly run: DefenseRunState;
  readonly attackButton: Phaser.GameObjects.Container;
  readonly modeToggle: { container: Phaser.GameObjects.Container };
  readonly autoToggle: { container: Phaser.GameObjects.Container };
  readonly debugBtn: TouchButtonHandle;
  readonly potionBtn?: TouchButtonHandle | undefined;
  readonly bombBtn?: TouchButtonHandle | undefined;
  readonly minimapLayout: ReturnType<typeof defenseMinimapLayout>;

  spawnEnemyAt(
    x: number,
    y: number,
    def?: EnemyDef,
    defId?: string,
    hpOverride?: number,
  ): void;
  onSpellCastRequest(spellId: string): void;
  refreshModeToggle(mode: AttackMode): void;
  onScreenTap(pointer: Phaser.Input.Pointer): void;
  endNight(won: boolean): void;
  endEndlessRun(reason: "quit" | "player" | "wall"): void;
  isEndlessMode(): boolean;
};
