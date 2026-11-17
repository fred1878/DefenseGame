import type Phaser from "phaser";
import {
  DEFENSE_OBSTACLE_PLACEMENTS,
  DEFENSE_RENDER_DEPTH,
  defenseHalfHeight,
  defenseHalfWidth,
  defenseObstacleSpriteAnchor,
  PLAYER_TUNING,
} from "../../config";
import { Player } from "../../entities/Player";
import { scaledDefenseObstacles, worldUnit } from "../../core/worldPixelScale";
import { buildGroundDecorLayer } from "../../world/buildGroundDecorLayer";
import { buildGroundLayer } from "../../world/buildGroundLayer";
import {
  configureDefenseFollowCamera,
  createDefenseWorldDisplayMask,
} from "../../world/defenseCamera";
import { configureDefenseObstacleSprite } from "../../world/defenseObstacleSprite";
import { defensePlayerStart } from "../../world/defenseSpawns";
import { defensePlayAreaLayout, readSafeInsets } from "../../ui/screenLayout";

export type DefenseWorldBootstrapResult = {
  player: Player;
  playerInvulnMs: number;
  obstacleGroup: Phaser.Physics.Arcade.StaticGroup;
  enemyGroup: Phaser.Physics.Arcade.Group;
  worldDisplayMask: Phaser.Display.Masks.GeometryMask;
  maskShape: Phaser.GameObjects.Graphics;
  applyWorldMask: (go: Phaser.GameObjects.GameObject) => void;
};

export type DefenseWorldBootstrapInput = {
  scene: Phaser.Scene;
  night: number;
  playerHpMax: number;
  endless: boolean;
};

/** Nav, ground, obstacles, player, play-area mask, camera (viewport PR #125). */
export function bootstrapDefenseWorld(
  input: DefenseWorldBootstrapInput,
): DefenseWorldBootstrapResult {
  const { scene, night, playerHpMax, endless } = input;
  const halfW = defenseHalfWidth();
  const halfH = defenseHalfHeight();
  scene.physics.world.setBounds(-halfW, -halfH, halfW * 2, halfH * 2);
  const groundLayer = buildGroundLayer(scene, halfW, halfH);
  const decorLayer = buildGroundDecorLayer(scene, halfW, halfH, night);

  const safe = readSafeInsets();
  const playArea = defensePlayAreaLayout(scene, safe);
  const { mask: worldDisplayMask, maskShape } = createDefenseWorldDisplayMask(
    scene,
    playArea,
  );
  groundLayer.setMask(worldDisplayMask);
  decorLayer.setMask(worldDisplayMask);

  const applyWorldMask = (go: Phaser.GameObjects.GameObject): void => {
    if ("setMask" in go) {
      (go as Phaser.GameObjects.Components.Mask & Phaser.GameObjects.GameObject).setMask(
        worldDisplayMask,
      );
    }
  };

  if (!endless) {
    const wall = scene.add
      .rectangle(0, -halfH + 20, halfW * 2, worldUnit(40, scene.registry), 0x52525b)
      .setOrigin(0.5, 0);
    applyWorldMask(wall);
  }

  const obstacleGroup = scene.physics.add.staticGroup();
  const scaledObstacles = scaledDefenseObstacles(scene.registry);
  for (let i = 0; i < DEFENSE_OBSTACLE_PLACEMENTS.length; i++) {
    const placement = DEFENSE_OBSTACLE_PLACEMENTS[i]!;
    const obs = scaledObstacles[i]!;
    const anchor = defenseObstacleSpriteAnchor(placement);
    const rock = scene.physics.add.staticImage(
      anchor.x,
      anchor.y,
      placement.textureKey,
    );
    configureDefenseObstacleSprite(rock, placement.textureKey, obs.w, obs.h);
    rock.setDepth(DEFENSE_RENDER_DEPTH.obstacleRock);
    applyWorldMask(rock);
    obstacleGroup.add(rock);
  }

  scene.cameras.main.setBounds(-halfW, -halfH, halfW * 2, halfH * 2);

  const start = defensePlayerStart();
  const player = new Player(scene, start.x, start.y, playerHpMax);
  player.damageable.hp = playerHpMax;
  player.damageable.alive = true;
  const playerInvulnMs = PLAYER_TUNING.nightSpawnInvulnMs;
  applyWorldMask(player.sprite);
  scene.physics.add.collider(player.sprite, obstacleGroup);
  const enemyGroup = scene.physics.add.group();
  scene.physics.add.collider(player.sprite, enemyGroup);
  scene.physics.add.collider(enemyGroup, enemyGroup);
  scene.physics.add.collider(enemyGroup, obstacleGroup);
  configureDefenseFollowCamera(scene.cameras.main, player.sprite, playArea);

  return {
    player,
    playerInvulnMs,
    obstacleGroup,
    enemyGroup,
    worldDisplayMask,
    maskShape,
    applyWorldMask,
  };
}