import { readFileSync } from "node:fs";
import path from "node:path";
import { applyDefenseMaps } from "../core/data/applyDefenseMaps";
import { applyEnemyAi } from "../config/enemy";
import { applyGameplay } from "../config/gameplay";
import { applyDamageNumbers } from "../config/damageNumbers";
import { normalizeDamageNumbers } from "../core/data/normalizeDamageNumbers";
import { normalizeGameplay } from "../core/data/normalizeGameplay";
import { applyHitFlashConfig } from "../config/hitFlash";
import { applySpellInputTuning } from "../config/spellInput";
import { applyPlayerTuning } from "../config/player";
import {
  applyEnemyBodyRadii,
  applyEntityPhysics,
} from "../entities/entityPhysics";
import {
  normalizeEnemyRow,
  type EnemyDefInput,
} from "../core/data/normalizeEnemy";
import { normalizeEnemyAi } from "../core/data/normalizeEnemyAi";
import { normalizeEntityPhysics } from "../core/data/normalizeEntityPhysics";
import { normalizeHitFlash } from "../core/data/normalizeHitFlash";
import { deriveGroundTapAutoCastSpellIds } from "../content/spellGroundTapCast";
import type { SpellDefinition } from "../content/spells";
import { setSpellCatalog } from "../content/spells";
import { normalizeSpellCatalog } from "../core/data/normalizeSpells";
import { normalizeSpellInput } from "../core/data/normalizeSpellInput";
import { normalizePlayerConfig } from "../core/data/normalizePlayer";
const dataDir = path.join(process.cwd(), "public/data");

function readPublicJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8")) as T;
}

/** Mirror BootScene config apply using shipped `public/data/*.json`. */
export function bootPublicConfigFixtures(): void {
  applyGameplay(normalizeGameplay(readPublicJson("gameplay.json")));
  applyDamageNumbers(
    normalizeDamageNumbers(readPublicJson("damage-numbers.json")),
  );
  applyDefenseMaps(readPublicJson("defense-maps.json"));
  const enemiesRaw =
    readPublicJson<Record<string, EnemyDefInput>>("enemies.json");
  const enemies = Object.fromEntries(
    Object.entries(enemiesRaw).map(([id, row]) => [
      id,
      normalizeEnemyRow(id, row),
    ]),
  );
  applyEnemyBodyRadii(enemies);
  applyEntityPhysics(
    normalizeEntityPhysics(readPublicJson("entity-physics.json")),
  );
  applyEnemyAi(normalizeEnemyAi(readPublicJson("enemy-ai.json")));
  const { endlessPanelDefaultConcurrent: _ui, ...tuning } =
    normalizePlayerConfig(readPublicJson("player.json"));
  applyPlayerTuning(tuning);
  applyHitFlashConfig(normalizeHitFlash(readPublicJson("hit-flash.json")));
  const spells = normalizeSpellCatalog(
    readPublicJson<{ spells: SpellDefinition[] }>("spells.json"),
  );
  setSpellCatalog(spells);
  const spellInputTuning = normalizeSpellInput(
    readPublicJson("spell_input.json"),
  );
  applySpellInputTuning({
    ...spellInputTuning,
    groundTapAutoCastSpellIds: deriveGroundTapAutoCastSpellIds(spells),
  });
}

bootPublicConfigFixtures();
