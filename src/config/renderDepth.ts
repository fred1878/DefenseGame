/**
 * Defense field world-space draw order (higher depth = drawn on top).
 *
 * | Depth | Layer |
 * |-------|-------|
 * | -10 | ground |
 * | -9 | ground decor |
 * | 2–3 | map obstacles |
 * | 3–4 | floor AoE telegraphs (arrow rain, spell windup) |
 * | 4 | player sprite |
 * | 5 | enemy sprites |
 * | 7 | projectiles |
 * | 8 | enemy-attached combat FX (swipes, telegraph particles) |
 * | 12 | player attack / spell cone FX |
 * | 18–19 | player cast bar (world) |
 * | 20 | enemy nameplate + HP bar |
 */
export const DEFENSE_RENDER_DEPTH = {
  obstacleRock: 2,
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