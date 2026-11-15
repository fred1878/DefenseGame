import { meleeChaserBehavior } from "./meleeChaser";
import type { EnemyBehavior } from "./types";

/** Same pathing as grunt; reach and cadence come from `BRUISER_MELEE_TUNING`. */
export const bruiserBehavior: EnemyBehavior = meleeChaserBehavior;