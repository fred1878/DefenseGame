/**
 * E2E-only damage tally for the real-fight harness (`npm run sim:fights`):
 * damage dealt to enemies by damage flavor (physical = weapons, elements =
 * spells, procs and bombs), so fights can be compared with the sim's power
 * model term by term.
 */
export type CombatTally = Record<string, { damage: number; hits: number }>;

let tally: CombatTally = {};

export function resetCombatTally(): void {
  tally = {};
}

export function recordCombatDamage(flavor: string | undefined, amount: number) {
  if (!(amount > 0)) return;
  const key = flavor || "physical";
  const row = tally[key] ?? { damage: 0, hits: 0 };
  row.damage += amount;
  row.hits += 1;
  tally[key] = row;
}

/** Copy of the tally since the last reset. */
export function combatTally(): CombatTally {
  return structuredClone(tally);
}
