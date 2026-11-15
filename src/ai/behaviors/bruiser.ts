import { meleeChaserBehavior } from "./meleeChaser";
import type { EnemyBehavior } from "./types";

/** Same pathing as grunt; reach and cadence come from per-enemy `combat.melee` in data. */
export const bruiserBehavior: EnemyBehavior = meleeChaserBehavior;