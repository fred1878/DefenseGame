import { describe, expect, it } from "vitest";
import {
  ENEMY_FACING_VELOCITY_DEADZONE,
  cardinalFromVelocity,
  resolveEnemyCardinal,
} from "./enemyFacing";

describe("cardinalFromVelocity", () => {
  it("returns null inside the velocity dead zone", () => {
    expect(
      cardinalFromVelocity(3, -4, ENEMY_FACING_VELOCITY_DEADZONE),
    ).toBeNull();
    expect(cardinalFromVelocity(0, 0)).toBeNull();
  });

  it("picks dominant axis for movement", () => {
    expect(cardinalFromVelocity(40, 5)).toBe("e");
    expect(cardinalFromVelocity(-12, 90)).toBe("s");
    expect(cardinalFromVelocity(-20, -80)).toBe("n");
    expect(cardinalFromVelocity(-50, 10)).toBe("w");
  });
});

describe("resolveEnemyCardinal", () => {
  it("keeps last facing when idle and not moving", () => {
    expect(resolveEnemyCardinal(0, 0, 0, "w", false)).toBe("w");
  });

  it("uses combat aim when windup/active while stationary", () => {
    expect(resolveEnemyCardinal(0, 0, Math.PI / 2, "w", true)).toBe("s");
    expect(resolveEnemyCardinal(0, 0, -Math.PI / 2, "e", true)).toBe("n");
  });

  it("movement wins over aim when above dead zone", () => {
    expect(resolveEnemyCardinal(100, 0, Math.PI / 2, "s", true)).toBe("e");
  });
});
