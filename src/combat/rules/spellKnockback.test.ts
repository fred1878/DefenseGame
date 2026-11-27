import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "../../core/configValidation";
import { spellProjectileDirectKnockback } from "./spellKnockback";

describe("spellProjectileDirectKnockback", () => {
  it("throws when the spell definition is missing", () => {
    expect(() => spellProjectileDirectKnockback("missing", undefined)).toThrow(
      ConfigLoadError,
    );
  });
});
