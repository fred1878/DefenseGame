import type {
  AffixDef,
  AffixTier,
  GearCatalog,
  ItemInstance,
  RolledAffix,
  SaveGear,
} from "../../gear/gearTypes";
import type { SpellId } from "../../content/spells";
import type { SaveSpellBar } from "../../core/save/saveTypes";
import type { TalentCatalog, SaveTalents } from "../../talents/talentTypes";
import { type ElementBar, elementBar } from "./spellBars";

/**
 * School-specialised versions of a save for the real-fight harness
 * (`npm run sim:fights -- --schools fire,frost,lightning`). Each build keeps
 * the save's items (base, rarity, item level, affix count) and its total
 * talent points, so builds stay comparable with the save they come from:
 *
 * - Gear: defensive affixes (Sturdy, Vital, of Speed), affixes already in
 *   the school's pool (re-keyed to its spells) and uniques stay. Every
 *   other affix becomes the school's first legal pick for its
 *   position (prefix: element damage, then Arcane spell power; suffix:
 *   of Mastery / of Quickening on the school's spells, then the school's
 *   weapon proc), rolled at the same point of the new affix's tier for the
 *   item level as the old roll. With no legal unused pick the old affix
 *   stays, so no item carries an affix twice.
 * - Talents: Sorcery first (Arcane Study 3, Kindling 2, the school's tier-3
 *   node, Focus 3, Meteor Storm 1); points left over keep the save's other
 *   talents, dropping the deepest tiers first.
 * - Bar: the school's element bar (spellBars.ELEMENT_BARS).
 */
export type School = "fire" | "frost" | "lightning";

type SchoolSpec = {
  bar: ElementBar;
  prefixes: string[];
  suffixes: string[];
  /** Spells for of Mastery / of Quickening, used in turn. */
  mastery: SpellId[];
  quickening: SpellId[];
  /** Sorcery tier-3 pick (pick one). Fire has no fire node there, so it
   * takes Overcharge only to reach Focus and Meteor Storm. */
  tier3: string;
};

export const SCHOOLS: Record<School, SchoolSpec> = {
  fire: {
    bar: "fire",
    prefixes: ["fiery", "arcane"],
    suffixes: ["of_mastery", "of_quickening", "of_embers"],
    mastery: ["cone_of_fire", "flamestrike", "combustion", "fire_nova"],
    quickening: ["fire_nova", "flamestrike", "combustion", "arc_bomb"],
    tier3: "overcharge",
  },
  frost: {
    bar: "frost",
    prefixes: ["icy", "arcane"],
    suffixes: ["of_quickening", "of_mastery", "of_frost"],
    mastery: ["blizzard"],
    quickening: ["cone_of_cold", "deep_freeze", "frost_nova"],
    tier3: "deep_winter",
  },
  lightning: {
    bar: "lightning",
    prefixes: ["shocking", "arcane"],
    suffixes: ["of_mastery", "of_quickening", "of_thunder"],
    mastery: ["chain_lightning", "lightning_bolt"],
    quickening: ["chain_lightning", "lightning_bolt"],
    tier3: "overcharge",
  },
};

export const KEPT_AFFIXES = ["sturdy", "vital", "of_speed"];

/**
 * Highest tier open at this item level. Compares `minItemLevel` rather than
 * relying on the tiers being stored in ascending order, so a tier inserted out
 * of order still resolves correctly.
 */
function tierAt(def: AffixDef, itemLevel: number): AffixTier | undefined {
  let best: AffixTier | undefined;
  for (const tier of def.tiers) {
    if (tier.minItemLevel > itemLevel) continue;
    if (!best || tier.minItemLevel > best.minItemLevel) best = tier;
  }
  return best;
}

function rollLike(
  from: AffixDef,
  value: number,
  to: AffixDef,
  itemLevel: number,
): number {
  const a = tierAt(from, itemLevel);
  const b = tierAt(to, itemLevel)!;
  const span = a ? a.max - a.min : 0;
  const frac = span > 0 ? (value - a!.min) / span : 1;
  const f = Math.min(1, Math.max(0, frac));
  return Math.round(b.min + f * (b.max - b.min));
}

function keyedSpell(
  id: string,
  spec: SchoolSpec,
  turn: { mastery: number; quickening: number },
): string | undefined {
  if (id !== "of_mastery" && id !== "of_quickening") return undefined;
  const kind = id === "of_mastery" ? "mastery" : "quickening";
  const spells = spec[kind];
  return spells[turn[kind]++ % spells.length];
}

function schoolItem(
  catalog: GearCatalog,
  item: ItemInstance,
  spec: SchoolSpec,
  turn: { mastery: number; quickening: number },
): ItemInstance {
  const base = catalog.bases[item.baseId];
  if (item.uniqueId || !base) return item;
  const pool = new Set([...spec.prefixes, ...spec.suffixes]);
  // Kept and already-school affixes stay; nothing is picked twice.
  const stays = (id: string) => KEPT_AFFIXES.includes(id) || pool.has(id);
  const used = new Set(item.affixes.map((a) => a.id).filter(stays));
  const affixes = item.affixes.map((rolled): RolledAffix => {
    const old = catalog.affixes[rolled.id];
    if (!old || KEPT_AFFIXES.includes(rolled.id)) return rolled;
    if (pool.has(rolled.id)) {
      const spell = keyedSpell(rolled.id, spec, turn);
      return spell ? { ...rolled, spell } : rolled;
    }
    const picks = old.position === "prefix" ? spec.prefixes : spec.suffixes;
    const pick = picks
      .map((id) => catalog.affixes[id])
      .find(
        (d): d is AffixDef =>
          !!d &&
          !used.has(d.id) &&
          d.types.includes(base.type) &&
          !!tierAt(d, item.itemLevel),
      );
    if (!pick) return rolled;
    used.add(pick.id);
    const value = rollLike(old, rolled.value, pick, item.itemLevel);
    const spell = keyedSpell(pick.id, spec, turn);
    return spell ? { id: pick.id, value, spell } : { id: pick.id, value };
  });
  return { ...item, affixes };
}

export function schoolGear(
  catalog: GearCatalog,
  gear: SaveGear,
  school: School,
): SaveGear {
  const spec = SCHOOLS[school];
  const turn = { mastery: 0, quickening: 0 };
  const equipped = new Set(Object.values(gear.equipped));
  return {
    ...gear,
    items: gear.items.map((item) =>
      equipped.has(item.uid) ? schoolItem(catalog, item, spec, turn) : item,
    ),
  };
}

type Rank = { branch: number; tier: number; id: string };

/** Each tier with ranks has enough points in the branch's earlier tiers. */
export function talentsLegal(
  catalog: TalentCatalog,
  ranks: Record<string, number>,
): boolean {
  return catalog.branches.every((branch) => {
    let below = 0;
    return branch.tiers.every((tier, i) => {
      const here = tier.nodes.reduce((n, d) => n + (ranks[d.id] ?? 0), 0);
      const needs = catalog.config.tierThresholds[i] ?? 0;
      const taken = tier.nodes.filter((d) => (ranks[d.id] ?? 0) > 0);
      const ok =
        here === 0 ||
        (below >= needs &&
          (!tier.exclusive || taken.length <= 1) &&
          taken.every(
            (d) =>
              d.requires.length === 0 ||
              d.requires.some((r) => (ranks[r] ?? 0) > 0),
          ));
      below += here;
      return ok;
    });
  });
}

export function schoolTalents(
  catalog: TalentCatalog,
  talents: SaveTalents,
  school: School,
): SaveTalents {
  let left = Object.values(talents.ranks).reduce((a, b) => a + b, 0);
  const sorcery = catalog.branches.find((b) => b.id === "sorcery");
  const path: [string, number][] = [
    ["arcane_study", 3],
    ["kindling", 2],
    [SCHOOLS[school].tier3, 1],
    ["focus", 3],
    ["meteor_storm", 1],
  ];
  const ranks: Record<string, number> = {};
  for (const [id, max] of path) {
    const n = Math.min(max, left);
    if (n > 0) ranks[id] = n;
    left -= n;
  }
  const sorceryIds = new Set(
    sorcery?.tiers.flatMap((t) => t.nodes.map((n) => n.id)) ?? [],
  );
  const others: Rank[] = catalog.branches.flatMap((branch, b) =>
    branch.tiers.flatMap((tier, t) =>
      tier.nodes
        .filter((n) => !sorceryIds.has(n.id))
        .flatMap((n) =>
          Array.from({ length: talents.ranks[n.id] ?? 0 }, () => ({
            branch: b,
            tier: t,
            id: n.id,
          })),
        ),
    ),
  );
  // Shallow tiers first, so trimming drops the deepest ones.
  others.sort((a, b) => a.tier - b.tier || a.branch - b.branch);
  for (const r of others.slice(0, Math.max(0, left))) {
    ranks[r.id] = (ranks[r.id] ?? 0) + 1;
  }
  return { ...talents, ranks: dropIllegal(catalog, ranks) };
}

/** Drop ranks from the deepest tier until every tier is reachable. */
function dropIllegal(
  catalog: TalentCatalog,
  ranks: Record<string, number>,
): Record<string, number> {
  const out = { ...ranks };
  while (!talentsLegal(catalog, out)) {
    const deepest = catalog.branches
      .flatMap((b) =>
        b.tiers.flatMap((t, i) => t.nodes.map((n) => [n.id, i] as const)),
      )
      .filter(([id]) => (out[id] ?? 0) > 0)
      .sort((a, b) => b[1] - a[1])[0];
    if (!deepest) break;
    const [id] = deepest;
    out[id] = (out[id] ?? 0) - 1;
    if (out[id] === 0) delete out[id];
  }
  return out;
}

type SchoolSaveInput = {
  gear: SaveGear;
  talents: SaveTalents;
  spellBar: SaveSpellBar;
};

/** The save rebuilt as a `school` build (gear, talents, bar). */
export function schoolSave<T extends SchoolSaveInput>(
  catalog: GearCatalog,
  talentCatalog: TalentCatalog,
  save: T,
  school: School,
): T {
  const slots = save.spellBar.slots;
  const bar = elementBar(
    slots.filter((s): s is SpellId => !!s),
    SCHOOLS[school].bar,
    slots.length,
  );
  const padded = [
    ...bar,
    ...Array(Math.max(0, slots.length - bar.length)).fill(""),
  ] as SpellId[];
  return {
    ...save,
    gear: schoolGear(catalog, save.gear, school),
    talents: schoolTalents(talentCatalog, save.talents, school),
    spellBar: {
      ...save.spellBar,
      slots: padded,
      autoCastSpellIds: [...padded],
    },
  };
}
