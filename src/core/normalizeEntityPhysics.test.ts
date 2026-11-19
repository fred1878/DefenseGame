import { describe, expect, it } from "vitest";
import { ENTITY_BODY_RADIUS_DEFAULTS } from "../entities/entityPhysics";
import { normalizeEntityPhysics } from "./normalizeEntityPhysics";

describe("normalizeEntityPhysics", () => {
  it("uses defaults when input is null", () => {
    const out = normalizeEntityPhysics(null);
    expect(out.entityBodyRadius.player).toBe(
      ENTITY_BODY_RADIUS_DEFAULTS.player,
    );
  });

  it("merges partial radii", () => {
    const out = normalizeEntityPhysics({
      entityBodyRadius: { grunt: 30 },
    });
    expect(out.entityBodyRadius.grunt).toBe(30);
    expect(out.entityBodyRadius.enemy).toBe(ENTITY_BODY_RADIUS_DEFAULTS.enemy);
  });
});