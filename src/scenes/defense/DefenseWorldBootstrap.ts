import type Phaser from "phaser";
import {
  DEFENSE_OBSTACLE_PLACEMENTS,
  DEFENSE_RENDER_DEPTH,
  PLAYER_TUNING,
  type DefenseObstacleRect,
  defenseHalfHeight,
  defenseHalfWidth,
  defenseObstacleSpriteDisplayPosition,
} from "../../config";
import { Player } from "../../entities/Player";
import { worldUnit } from "../../core/worldPixelScale";
import {
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
  setDefenseWorldLayerTarget,
} from "../../world/defenseWorldAddHook";
import { configureDefenseObstacleArt } from "../../world/defenseObstacleSprite";
import { defensePlayerStart } from "../../world/defenseSpawns";
import { defensePlayAreaLayout, readSafeInsets } from "../../ui/screenLayout";

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
  const halfW = defenseHalfWidth();
  const halfH = defenseHalfHeight();
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

  const cameraRig = setupDefenseCameraRig(scene, player.sprite, playArea);
  const { registerUi, registerWorld, worldLayer } = cameraRig;
  setDefenseWorldLayerTarget(scene, worldLayer);

  registerWorld(groundLayer);
  registerWorld(decorLayer);
  registerWorld(player.sprite);

  if (!endless) {
    const wall = scene.add
      .rectangle(0, -halfH + 20, halfW * 2, worldUnit(40, scene.registry), 0x52525b)
      .setOrigin(0.5, 0);
    registerWorld(wall);
  }

  const obstacleGroup = scene.physics.add.staticGroup();
  const obstacleBlockers = defenseObstacleBlockerRects(scene.registry);
  for (let i = 0; i < DEFENSE_OBSTACLE_PLACEMENTS.length; i++) {
    const placement = DEFENSE_OBSTACLE_PLACEMENTS[i]!;
    const blocker = obstacleBlockers[i]!;
    const displayPos = defenseObstacleSpriteDisplayPosition(placement);
    const art = scene.add.image(displayPos.x, displayPos.y, placement.textureKey);
    art.setDepth(DEFENSE_RENDER_DEPTH.obstacleRock);
    configureDefenseObstacleArt(art, placement.textureKey);
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

  const playerInvulnMs = PLAYER_TUNING.nightSpawnInvulnMs;
  scene.physics.add.collider(player.sprite, obstacleGroup);
  const enemyGroup = scene.physics.add.group();
  scene.physics.add.collider(player.sprite, enemyGroup);
  scene.physics.add.collider(enemyGroup, enemyGroup);
  scene.physics.add.collider(enemyGroup, obstacleGroup);

  return {
    player,
    playerInvulnMs,
    obstacleBlockers,
    obstacleGroup,
    enemyGroup,
    cameraRig,
    registerWorldDraw: registerWorld,
    registerUiDraw: registerUi,
  };
}