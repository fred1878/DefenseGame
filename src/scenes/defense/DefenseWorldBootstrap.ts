import { defenseObstaclePlacements } from "../../config/defense";
import { PALETTE } from "../../ui/theme/uiPalette";
import { playerTuning } from "../../config/player";
import Phaser from "phaser";
import {
  DEFENSE_RENDER_DEPTH,
  type DefenseObstacleRect,
  defenseHalfHeight,
  defenseHalfWidth,
  defenseObstacleSpriteDisplayPosition,
} from "../../config";
import { flashSpriteTint } from "../../combat/fx/HitFlash";
import { Player } from "../../entities/Player";
import { DamageNumberFx } from "./DamageNumberFx";
import { worldUnit } from "../../config/worldScale";
import {
  correctPlayerObstacleBlockerOverlap,
  createDefenseObstacleCollider,
  defenseObstacleBlockerRects,
} from "../../world/defenseObstacleBlocker";
import { buildGroundDecorLayer } from "../../world/buildGroundDecorLayer";
import { buildGroundLayer } from "../../world/buildGroundLayer";
import {
  setupDefenseCameraRig,
  type DefenseCameraRig,
} from "../../world/defenseCamera";
import {
  DEFENSE_WORLD_LAYER_REGISTRY_KEY,
  installDefenseWorldLayerHook,
  setDefenseWorldLayerTarget,
} from "../../world/defenseWorldAddHook";
import { configureDefenseObstacleArt } from "../../world/defenseObstacleSprite";
import { defensePlayerStart } from "../../world/defenseSpawns";
import {
  defensePlayAreaLayout,
  readSafeInsets,
} from "../../ui/layout/screenLayout";

export type DefenseWorldBootstrapResult = {
  player: Player;
  playerInvulnMs: number;
  /** Live gameplay blockers (nav + path debug + Arcade) after world-layer adopt. */
  obstacleBlockers: DefenseObstacleRect[];
  obstacleGroup: Phaser.Physics.Arcade.StaticGroup;
  enemyGroup: Phaser.Physics.Arcade.Group;
  cameraRig: DefenseCameraRig;
  registerWorldDraw: (go: Phaser.GameObjects.GameObject) => void;
  registerUiDraw: (go: Phaser.GameObjects.GameObject) => void;
  damageNumbers: DamageNumberFx;
};

export type DefenseWorldBootstrapInput = {
  scene: Phaser.Scene;
  night: number;
  playerHpMax: number;
  endless: boolean;
};

/** Nav, ground, obstacles, player, play-area camera viewport (REFACTOR_PLAN PR #125). */
export function bootstrapDefenseWorld(
  input: DefenseWorldBootstrapInput,
): DefenseWorldBootstrapResult {
  const { scene, night, playerHpMax, endless } = input;
  const reg = scene.registry;
  const halfW = defenseHalfWidth(reg);
  const halfH = defenseHalfHeight(reg);
  scene.registry.remove(DEFENSE_WORLD_LAYER_REGISTRY_KEY);
  scene.physics.world.setBounds(-halfW, -halfH, halfW * 2, halfH * 2);
  const groundLayer = buildGroundLayer(scene, halfW, halfH);
  const decorLayer = buildGroundDecorLayer(scene, halfW, halfH, night);

  const safe = readSafeInsets();
  const playArea = defensePlayAreaLayout(scene, safe);

  const start = defensePlayerStart();
  const player = new Player(scene, start.x, start.y, playerHpMax);
  player.damageable.hp = playerHpMax;
  player.damageable.alive = true;
  const damageNumbers = new DamageNumberFx(scene);
  player.damageable.onDamaged = (amount, flavor) => {
    flashSpriteTint(scene, player.sprite, flavor);
    damageNumbers.floatFromSource(player.damageable.id, player.sprite, amount, {
      flavor,
    });
  };
  player.damageable.onHealed = (amount) => {
    damageNumbers.floatFromSource(player.damageable.id, player.sprite, amount, {
      heal: true,
    });
  };

  const cameraRig = setupDefenseCameraRig(scene, player.sprite, playArea);
  const { registerUi, registerWorld, worldLayer } = cameraRig;
  setDefenseWorldLayerTarget(scene, worldLayer);

  registerWorld(groundLayer);
  registerWorld(decorLayer);
  registerWorld(player.sprite);

  if (!endless) {
    const wall = scene.add
      .rectangle(
        0,
        -halfH + 20,
        halfW * 2,
        worldUnit(40, scene.registry),
        PALETTE.zinc600,
      )
      .setOrigin(0.5, 0);
    registerWorld(wall);
  }

  const obstacleGroup = scene.physics.add.staticGroup();
  const obstacleBlockers = defenseObstacleBlockerRects(scene.registry);
  for (let i = 0; i < defenseObstaclePlacements().length; i++) {
    const placement = defenseObstaclePlacements()[i]!;
    const blocker = obstacleBlockers[i]!;
    const displayPos = defenseObstacleSpriteDisplayPosition(placement, reg);
    const art = scene.add.image(
      displayPos.x,
      displayPos.y,
      placement.textureKey,
    );
    art.setDepth(DEFENSE_RENDER_DEPTH.obstacleRock);
    configureDefenseObstacleArt(art, placement.textureKey, reg);
    registerWorld(art);

    const collider = createDefenseObstacleCollider(
      scene,
      blocker,
      DEFENSE_RENDER_DEPTH.obstacleRock - 1,
    );
    registerWorld(collider);
    obstacleGroup.add(collider);
  }

  scene.cameras.main.setBounds(-halfW, -halfH, halfW * 2, halfH * 2);

  const playerInvulnMs = playerTuning().nightSpawnInvulnMs;
  scene.physics.add.collider(player.sprite, obstacleGroup);
  const enemyGroup = scene.physics.add.group();
  scene.physics.add.collider(player.sprite, enemyGroup);
  scene.physics.add.collider(enemyGroup, enemyGroup);
  scene.physics.add.collider(enemyGroup, obstacleGroup);

  installDefenseWorldLayerHook(scene, worldLayer);

  return {
    player,
    playerInvulnMs,
    obstacleBlockers,
    obstacleGroup,
    enemyGroup,
    cameraRig,
    registerWorldDraw: registerWorld,
    registerUiDraw: registerUi,
    damageNumbers,
  };
}

/** Push the player out of obstacle blockers after every Arcade world step (unbound on shutdown). */
export function bindPlayerObstacleCorrection(
  scene: Phaser.Scene,
  getPlayer: () => Player,
  getObstacleBlockers: () => DefenseObstacleRect[],
): void {
  const onObstacleWorldStep = (): void => {
    correctPlayerObstacleBlockerOverlap(
      getPlayer().sprite,
      getObstacleBlockers(),
    );
  };
  scene.physics.world.on(
    Phaser.Physics.Arcade.Events.WORLD_STEP,
    onObstacleWorldStep,
  );
  scene.events.once("shutdown", () => {
    scene.physics.world?.off(
      Phaser.Physics.Arcade.Events.WORLD_STEP,
      onObstacleWorldStep,
    );
  });
}
