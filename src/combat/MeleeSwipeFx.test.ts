import { describe, expect, it } from "vitest";
import { meleeSwipeRotation } from "./MeleeSwipeFx";

/** `slash-arc-v2` bisector is west when sprite rotation is 0. */
function slashAimDirection(spriteRotation: number): number {
  return spriteRotation + Math.PI;
}

function rotationAimsAlong(spriteRotation: number, facingRad: number): void {
  const aim = slashAimDirection(spriteRotation);
  const d = Math.hypot(
    Math.cos(aim) - Math.cos(facingRad),
    Math.sin(aim) - Math.sin(facingRad),
  );
  expect(d).toBeLessThan(1e-6);
}

describe("meleeSwipeRotation", () => {
  it("flips slash default west to match east attack facing", () => {
    expect(meleeSwipeRotation(0)).toBeCloseTo(Math.PI);
    rotationAimsAlong(meleeSwipeRotation(Math.PI), Math.PI);
    rotationAimsAlong(meleeSwipeRotation(0), 0);
  });

  it("tracks player atan2 facings", () => {
    for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      rotationAimsAlong(meleeSwipeRotation(facing), facing);
    }
  });
});