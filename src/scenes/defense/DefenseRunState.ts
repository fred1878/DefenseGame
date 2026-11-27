import type Phaser from "phaser";
import { SpellCastController } from "../../combat/SpellCastController";
import { SpellInputQueue } from "../../combat/spellInputQueue";
import { EnemySpellStatusMap } from "../../combat/enemySpellStatus";
import type { SpellBlizzardChannelFx } from "../../combat/SpellBlizzardChannelFx";
import type { SpellHealChannelFx } from "../../combat/SpellHealChannelFx";
import type { SpellIceCastWindupFx } from "../../combat/SpellIceCastWindupFx";
import { EnemyIceRootFxController } from "../../combat/EnemyIceRootFx";
import { EnemyIceStunFxController } from "../../combat/EnemyIceStunFx";
import type { SpellGroundAoeTelegraph } from "../../combat/SpellGroundAoeTelegraph";
import type { SpellGroundZone } from "../../combat/spellGroundZone";
import type { SpellEnemyTarget } from "../../combat/SpellEffects";
import type { DefenseObstacleRect } from "../../config/defense";
import type { EndlessRunSelection } from "../../core/defenseRunMode";
import type { SaveGame } from "../../core/saveTypes";
import type { FocusTapFlash } from "../../debug/TouchInputDebugDraw";
import type { VirtualStick } from "../../input/VirtualStick";
import type { EnemyInstance } from "../../entities/Enemy";
import type {
  EnemyProjectile,
  PlayerProjectile,
} from "../../entities/Projectile";
import type { Player } from "../../entities/Player";
import type { CastBar } from "../../ui/CastBar";
import type { SpellBar } from "../../ui/SpellBar";
import type { GroundTargetReticle } from "../../ui/GroundTargetReticle";
import type { SafeInsets } from "../../ui/screenLayout";
import type { TouchButtonHandle } from "../../ui/touchButton";
import type { DefenseTargeting } from "./DefenseTargeting";
import type { DefensePlayerCombatHost } from "./DefensePlayerCombat";
import type { DefenseGroundAimHost } from "./DefenseGroundAim";
import type { DefenseSpellDirectorHost } from "./DefenseSpellDirector";
import type { SpellBlastFxDef } from "./DefensePlayerCombat";

export type EnemyPathGoal = {
  targetKind: "wall" | "player";
  x: number;
  y: number;
};

export type IceWallExpiry = {
  sprite: Phaser.Physics.Arcade.Image;
  expiresAt: number;
};

/**
 * Scene-provided behaviour the defense helpers call back into. Built once by
 * DefenseScene; every entry is a plain function (no live getters).
 */
export type DefenseServices = {
  wu: (atDefault2x: number) => number;
  enemyTargets: () => SpellEnemyTarget[];
  resolveStrikeMode: (auto: boolean) => "melee" | "ranged";
  flashNova: (
    x: number,
    y: number,
    radius: number,
    def?: SpellBlastFxDef,
  ) => void;
  timeNow: () => number;
  delayedCall: (ms: number, fn: () => void) => void;
  registerWorldDraw: (go: Phaser.GameObjects.GameObject) => void;
  beginSpellCast: (spellId: string) => void;
  /** Fired whenever `pendingGroundCast` changes (input modality sync). */
  onPendingGroundCastChanged: (spellId: string | null) => void;
};

/**
 * All per-run mutable state of a defense night plus the scene services, in one
 * object the helpers share by reference. Replaces the old getter/setter proxy
 * (`buildSceneHost`) on DefenseScene: the scene and its helpers read and write
 * the same fields directly.
 */
export class DefenseRunState
  implements
    DefenseSpellDirectorHost,
    DefensePlayerCombatHost,
    DefenseGroundAimHost
{
  // Scene handles, assigned in DefenseScene.create().
  save!: SaveGame;
  player!: Player;
  stick!: VirtualStick;
  safe!: SafeInsets;
  targeting!: DefenseTargeting;
  spellBar!: SpellBar;
  castBar!: CastBar;
  groundReticle!: GroundTargetReticle;
  obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  obstacleBlockers: DefenseObstacleRect[] = [];

  // Combat entities.
  enemies: EnemyInstance[] = [];
  projectiles: PlayerProjectile[] = [];
  enemyProjectiles: EnemyProjectile[] = [];
  projectileSerial = 0;
  enemyPathGoals = new Map<string, EnemyPathGoal>();
  wallHp = 0;
  wallHpStart = 0;
  playerInvulnMs = 0;
  autoAttackEnabled = true;
  focusTapFlash: FocusTapFlash | null = null;

  // Run mode / outcome.
  rewardGold = 0;
  spawnPlanComplete = false;
  nightEnded = false;
  endlessSelections: EndlessRunSelection[] | null = null;
  endlessInfiniteHp = false;
  wavePlannerMode = false;
  returnToTownBtn: TouchButtonHandle | null = null;
  leaveEndlessBtn: TouchButtonHandle | null = null;

  // Spells.
  spellCaster = new SpellCastController();
  spellInputQueue = new SpellInputQueue();
  enemySpellStatus = new EnemySpellStatusMap();
  spellChannelArea: { x: number; y: number } | null = null;
  spellGroundZones: SpellGroundZone[] = [];
  groundAim: { x: number; y: number } | null = null;
  groundAoeTelegraph: SpellGroundAoeTelegraph | null = null;
  lingerAoeTelegraph: SpellGroundAoeTelegraph | null = null;
  blizzardChannelFx: SpellBlizzardChannelFx | null = null;
  healChannelFx: SpellHealChannelFx | null = null;
  iceCastWindupFx: SpellIceCastWindupFx | null = null;
  readonly enemyIceRootFx: EnemyIceRootFxController;
  readonly enemyIceStunFx: EnemyIceStunFxController;
  channelAreaStarted = false;
  shadowformEndsAt = 0;
  iceWallExpires: IceWallExpiry[] = [];
  private pendingGroundCastId: string | null = null;

  // Services (see DefenseServices).
  readonly wu: DefenseServices["wu"];
  readonly enemyTargets: DefenseServices["enemyTargets"];
  readonly resolveStrikeMode: DefenseServices["resolveStrikeMode"];
  readonly flashNova: DefenseServices["flashNova"];
  readonly timeNow: DefenseServices["timeNow"];
  readonly delayedCall: DefenseServices["delayedCall"];
  readonly registerWorldDraw: DefenseServices["registerWorldDraw"];
  readonly maskWorldObject: DefenseServices["registerWorldDraw"];
  readonly beginSpellCast: DefenseServices["beginSpellCast"];
  private readonly onPendingGroundCastChanged: DefenseServices["onPendingGroundCastChanged"];

  constructor(
    readonly scene: Phaser.Scene,
    services: DefenseServices,
  ) {
    this.enemyIceRootFx = new EnemyIceRootFxController(scene);
    this.enemyIceStunFx = new EnemyIceStunFxController(scene);
    this.wu = services.wu;
    this.enemyTargets = services.enemyTargets;
    this.resolveStrikeMode = services.resolveStrikeMode;
    this.flashNova = services.flashNova;
    this.timeNow = services.timeNow;
    this.delayedCall = services.delayedCall;
    this.registerWorldDraw = services.registerWorldDraw;
    this.maskWorldObject = services.registerWorldDraw;
    this.beginSpellCast = services.beginSpellCast;
    this.onPendingGroundCastChanged = services.onPendingGroundCastChanged;
  }

  get pendingGroundCast(): string | null {
    return this.pendingGroundCastId;
  }

  set pendingGroundCast(v: string | null) {
    this.pendingGroundCastId = v;
    this.onPendingGroundCastChanged(v);
  }

  nextProjectileId = (): string => `spell_proj_${this.projectileSerial++}`;

  nextPlayerProjectileId = (): string => `p_${this.projectileSerial++}`;

  filterDeadEnemies = (): void => {
    this.enemies = this.enemies.filter((e) => e.damageable.alive);
  };
}
