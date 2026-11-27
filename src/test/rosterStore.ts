import { DataStore } from "../core/data/DataStore";
import { shippedEnemyCombat } from "./shippedEnemyCombat";

/** DataStore with one wave spawning each id once; enemy CR = index + 1. */
export function rosterStore(ids: string[]): DataStore {
  const s = new DataStore();
  s.enemies = Object.fromEntries(
    ids.map((id, i) => [
      id,
      {
        hp: 10,
        speedWu: 1,
        damage: 1,
        weight: 100,
        behavior: "meleeChaser",
        textureKey: `enemy_${id}`,
        displayName: id.toUpperCase(),
        challengeRating: i + 1,
        bodyRadiusWu: 14,
        combat: shippedEnemyCombat("grunt"),
      },
    ]),
  ) as DataStore["enemies"];
  s.player = { endlessPanelDefaultConcurrent: 2 } as DataStore["player"];
  s.waves = {
    "1": {
      rewardGold: 1,
      groups: ids.map((enemyId) => ({
        atMs: 0,
        enemyId,
        count: 1,
        intervalMs: 0,
      })),
    },
  } as DataStore["waves"];
  return s;
}
