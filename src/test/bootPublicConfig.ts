import { readFileSync } from "node:fs";
import path from "node:path";
import { applyDefenseMaps } from "../config/defenseMaps";
import { applyEnemyAi } from "../config/enemy";
import { applyPlayerTuning } from "../config/player";
import { applyEntityPhysics } from "../entities/entityPhysics";
import { applyEnemyCombatDefaults } from "../core/enemyTuning";
import { normalizeEnemyAi } from "../core/normalizeEnemyAi";
import { normalizeEntityPhysics } from "../core/normalizeEntityPhysics";
import { normalizePlayerConfig } from "../core/normalizePlayer";
const dataDir = path.join(process.cwd(), "public/data");

function readPublicJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8")) as T;
}

/** Mirror BootScene config apply using shipped `public/data/*.json`. */
export function bootPublicConfigFixtures(): void {
  applyDefenseMaps(readPublicJson("defense-maps.json"));
  applyEnemyCombatDefaults(readPublicJson("enemy-combat-defaults.json"));
  applyEntityPhysics(normalizeEntityPhysics(readPublicJson("entity-physics.json")));
  applyEnemyAi(normalizeEnemyAi(readPublicJson("enemy-ai.json")));
  const { endlessPanelDefaultConcurrent: _ui, ...tuning } = normalizePlayerConfig(
    readPublicJson("player.json"),
  );
  applyPlayerTuning(tuning);
}

bootPublicConfigFixtures();