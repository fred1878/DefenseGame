import type Phaser from "phaser";
import type { AttackMode } from "../../config";
import type { EnemyDef } from "../../core/DataStore";
import type { EndlessRunSelection } from "../../core/defenseRunMode";
import type { SpellHealChannelFx } from "../../combat/SpellHealChannelFx";
import type { DefenseTargeting } from "./DefenseTargeting";
import type { EnemyInstance } from "../../entities/Enemy";
import type { PlayerProjectile } from "../../entities/Projectile";
import type { Player } from "../../entities/Player";
import type { VirtualStick } from "../../input/VirtualStick";
import type { SaveGame } from "../../core/saveTypes";
import type { SpellBar } from "../../ui/SpellBar";
import type { TouchButtonHandle } from "../../ui/touchButton";
import type { defenseMinimapLayout } from "../../ui/defenseMinimap";
import type { SafeInsets } from "../../ui/screenLayout";

export type DefenseObstacleBumpCardinal = "north" | "south" | "east" | "west";

export type DefenseObstacleBumpProbe = {
  player: { x: number; y: number };
  surfaceGapPx: number;
  penetrationPx: number;
  edgeErrPx: number;
  pastCenter: boolean;
};

/**
 * Scene surface required by Playwright / `installE2E` hooks.
 * Intentionally wider than public gameplay API — refactor PR1 (REFACTOR_PLAN).
 */
export type DefenseSceneE2eDelegate = Phaser.Scene & {
  readonly player: Player;
  readonly stick: VirtualStick;
  readonly projectiles: PlayerProjectile[];
  readonly wallHp: number;
  readonly save: SaveGame;
  readonly attackButton: Phaser.GameObjects.Container;
  readonly modeToggle: { container: Phaser.GameObjects.Container };
  readonly autoToggle: { container: Phaser.GameObjects.Container };
  readonly spellBar: SpellBar;
  readonly debugBtn: TouchButtonHandle;
  readonly potionBtn?: TouchButtonHandle;
  readonly bombBtn?: TouchButtonHandle;
  readonly autoAttackEnabled: boolean;
  spawnPlanComplete: boolean;
  readonly nightEnded: boolean;
  enemies: EnemyInstance[];
  readonly returnToTownBtn: TouchButtonHandle | null;
  readonly leaveEndlessBtn: TouchButtonHandle | null;
  readonly endlessSelections: EndlessRunSelection[] | null;
  readonly obstacleGroup: Phaser.Physics.Arcade.StaticGroup;
  readonly obstacleBlockers: import("../../config/defense").DefenseObstacleRect[];

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
  readonly endlessInfiniteHp: boolean;
  readonly safe: SafeInsets;
  readonly minimapLayout: ReturnType<typeof defenseMinimapLayout>;
  readonly targeting: DefenseTargeting;
  healChannelFx: SpellHealChannelFx | null;
  readonly registerWorldDraw: (go: Phaser.GameObjects.GameObject) => void;
};
