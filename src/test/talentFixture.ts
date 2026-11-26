import { normalizeTalents } from "../core/normalizeTalents";
import type { TalentCatalog } from "../talents/talentTypes";

/** Small inline `talents.json` for unit tests (not the shipped tree). */
export function talentFixtureRaw(): Record<string, unknown> {
  return {
    config: {
      pointsPerNightWon: 2,
      pointsPerNightLost: 1,
      startingPoints: 1,
      resetCostGold: 40,
      tierThresholds: [0, 2, 3],
    },
    branches: [
      {
        id: "a",
        name: "Alpha",
        icon: "sword",
        tiers: [
          {
            nodes: [
              {
                id: "a1",
                name: "A One",
                icon: "sword",
                maxRank: 2,
                description: "Hit harder.",
                perRank: {
                  modifiers: [{ stat: "meleeDamage", value: 3 }],
                },
              },
            ],
          },
          {
            exclusive: true,
            nodes: [
              {
                id: "a2x",
                name: "A Two X",
                icon: "wind",
                maxRank: 1,
                requires: ["a1"],
                description: "Faster.",
                perRank: {
                  modifiers: [{ stat: "cooldownPct", value: 10 }],
                },
              },
              {
                id: "a2y",
                name: "A Two Y",
                icon: "nope",
                maxRank: 1,
                requires: ["a1"],
                description: "Stun.",
                perRank: {
                  procs: [{ kind: "stun", chancePct: 10, ms: 300 }],
                },
              },
            ],
          },
          {
            nodes: [
              {
                id: "a3",
                name: "A Three",
                icon: "star",
                maxRank: 2,
                requires: ["a2x", "a2y"],
                description: "Tough.",
                perRank: {
                  modifiers: [
                    { stat: "maxHp", value: 5 },
                    { stat: "spellCooldownPct", spell: "meteor", value: 5 },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        id: "b",
        name: "Beta",
        icon: "bow",
        tiers: [
          {
            nodes: [
              {
                id: "b1",
                name: "B One",
                icon: "bow",
                maxRank: 1,
                description: "Fire!",
                perRank: {
                  modifiers: [
                    { stat: "elementDamagePct", element: "fire", value: 10 },
                    { stat: "spellDamagePct", spell: "meteor", value: 5 },
                  ],
                },
              },
            ],
          },
          {
            nodes: [
              {
                id: "b2",
                name: "B Two",
                icon: "target",
                maxRank: 1,
                description: "No prerequisite listed.",
                perRank: {},
              },
            ],
          },
        ],
      },
    ],
  };
}

export function talentFixture(): TalentCatalog {
  return normalizeTalents(talentFixtureRaw());
}
