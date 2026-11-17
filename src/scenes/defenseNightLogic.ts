export type NightEndEvaluation = false | { won: boolean };

export type EndlessEndEvaluation = false | { reason: "player" };

/**
 * Endless training ends only on player death — no wall objective.
 */
export function evaluateEndlessEnd(input: {
  nightEnded: boolean;
  playerHp: number;
}): EndlessEndEvaluation {
  if (input.nightEnded) return false;
  if (input.playerHp <= 0) return { reason: "player" };
  return false;
}

/** Pure guard for DefenseScene night-end checks (wall / player / clear). */
export function evaluateNightEnd(input: {
  nightEnded: boolean;
  wallHp: number;
  playerHp: number;
  spawnPlanComplete: boolean;
  livingEnemies: number;
}): NightEndEvaluation {
  if (input.nightEnded) return false;
  if (input.wallHp <= 0) return { won: false };
  if (input.playerHp <= 0) return { won: false };
  if (input.spawnPlanComplete && input.livingEnemies === 0) return { won: true };
  return false;
}