import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  TOWN_ISO_BUILDING_TIERS,
  TOWN_ISO_SPRITES,
  TOWN_ISO_STAGES,
} from "./townIsoStageData";

type Atlas = { textures: { frames: { filename: string }[] }[] };

function atlasFrames(file: string): Set<string> {
  const json = JSON.parse(
    readFileSync(
      new URL(`../../../public/assets/town/iso/${file}`, import.meta.url),
      "utf8",
    ),
  ) as Atlas;
  return new Set(json.textures.flatMap((t) => t.frames.map((f) => f.filename)));
}

describe("isometric town stage data", () => {
  const lit = atlasFrames("town-iso-lit.json");
  const dim = atlasFrames("town-iso-dim.json");

  it("has three stages that grow busier", () => {
    expect(TOWN_ISO_STAGES).toHaveLength(3);
    const counts = TOWN_ISO_STAGES.map((s) => s.scenery.length);
    expect(counts[2]!).toBeGreaterThan(counts[1]!);
    expect(TOWN_ISO_STAGES[2]!.smoke.length).toBeGreaterThan(
      TOWN_ISO_STAGES[1]!.smoke.length,
    );
  });

  it("every scenery sprite is packed in the dim atlas with pivot data", () => {
    for (const stage of TOWN_ISO_STAGES) {
      for (const [key] of stage.scenery) {
        expect(dim.has(key), key).toBe(true);
        expect(TOWN_ISO_SPRITES[key], key).toBeDefined();
      }
    }
  });

  it("every building has three tiers packed in the lit atlas", () => {
    expect(Object.keys(TOWN_ISO_BUILDING_TIERS)).toHaveLength(8);
    for (const [id, tiers] of Object.entries(TOWN_ISO_BUILDING_TIERS)) {
      expect(tiers, id).toHaveLength(3);
      for (const t of tiers) {
        expect(lit.has(t.key), t.key).toBe(true);
        expect(TOWN_ISO_SPRITES[t.key], t.key).toBeDefined();
      }
    }
  });
});
