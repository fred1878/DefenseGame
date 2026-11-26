/** Why a campaign defense night ended in a loss (win paths omit this). */
export type CampaignNightLossReason = "wall" | "player";

export type TrainingEndReason = "quit" | "player" | "wall";

export function campaignNightEndHeadline(
  won: boolean,
  night: number,
  lossReason?: CampaignNightLossReason,
): string {
  if (won) return `Night ${night} defended!`;
  if (lossReason === "wall") return `Night ${night} — wall breached`;
  if (lossReason === "player") return `Night ${night} — you fell`;
  return `Night ${night} lost`;
}

export function campaignNightEndFlavor(
  won: boolean,
  lossReason?: CampaignNightLossReason,
): string {
  if (won) return "Dawn breaks over the settlement.";
  if (lossReason === "wall")
    return "The north wall could not hold. Enemies pour through.";
  if (lossReason === "player")
    return "You collapse; the line must be retaken tomorrow.";
  return "Scouts recover what they can.";
}

/** Shown on the loot summary panel under the flavor line. */
export function campaignNightProgressNote(won: boolean, night: number): string {
  if (won) {
    return `Campaign advances — next defense is night ${night + 1}. Upgrade in town, then Gallows Square.`;
  }
  return `Campaign stays on night ${night} — no night advance. Town is open to upgrade gear and walls before you try again.`;
}

export function trainingEndHeadline(reason: TrainingEndReason): string {
  if (reason === "quit") return "Training ended";
  if (reason === "wall") return "Wall breached — training over";
  return "You fell — training over";
}

/** HUD sublines for endless / wave-planner exits (not the campaign loot panel). */
export function trainingEndHudLines(
  reason: TrainingEndReason,
): readonly [string, string] {
  const scope =
    reason === "quit"
      ? "Custom run ended"
      : "Endless training — not the campaign";
  return [scope, "No gold, loot, or campaign night progress"];
}

export function simulatedNightEndHeadline(won: boolean, quit: boolean): string {
  if (quit) return "Simulation ended";
  if (won) return "Wave cleared — simulation complete";
  return "Simulation failed";
}

export function simulatedNightEndHudLines(): readonly [string, string] {
  return ["Wave planner / simulation", "No gold earned · night unchanged"];
}
