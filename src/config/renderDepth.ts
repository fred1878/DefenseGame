/**
 * Defense field world-space draw order (higher depth = drawn on top).
 *
 * | Depth | Layer |
 * |-------|-------|
 * | -10 | ground |
 * | -9 | ground decor |
 * | 1–2 | obstacle colliders (invisible gameplay blockers) |
 * | 3 | obstacleBlock + floor AoE telegraphs (arrow rain, spell windup) |
 * | 4 | player sprite + spell ground windup |
 * | 5 | enemy sprites |
 * | 6 | obstacle cosmetic sprites (v2 art above entities) |
 * | 7 | projectiles |
 * | 8 | enemy-attached combat FX (swipes, telegraph particles) |
 * | 12 | player attack / spell cone FX |
 * | 18–19 | player cast bar (world) |
 * | 20 | enemy nameplate + HP bar |
 */
export const DEFENSE_RENDER_DEPTH = {
  /** Cosmetic obstacle art — above player/enemy sprites, below projectiles. */
  obstacleRock: 6,
  obstacleBlock: 3,
  floorTelegraph: 3,
  spellGroundTelegraph: 4,
  player: 4,
  enemy: 5,
  projectile: 7,
  enemyCombatFx: 8,
  playerCombatFx: 12,
  castBarBg: 18,
  castBarFill: 19,
  enemyNameplate: 20,
} as const;
