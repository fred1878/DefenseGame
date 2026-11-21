import { describe, expect, it } from "vitest";
import type { DataStore } from "../core/DataStore";
import { sumChallengeRating } from "./challengeRating";

describe("sumChallengeRating", () => {
  it("sums count times per-enemy rating", () => {
    const store = {
      enemies: {
        grunt: { challengeRating: 2 },
        bruiser: { challengeRating: 7 },
      },
    } as unknown as DataStore;
    expect(
      sumChallengeRating(store, [
        { enemyId: "grunt", count: 3 },
        { enemyId: "bruiser", count: 1 },
      ]),
    ).toBe(13);
  });
});