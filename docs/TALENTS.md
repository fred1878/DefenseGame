# Talents (Milestone I)

A talent tree opened from the **Talents** button in town (next to Gear). Data:
[`public/data/talents.json`](../public/data/talents.json) (fields in
[DATA_FIELDS.md](./DATA_FIELDS.md#talentsjson)). Code: `src/talents/` (rules, text,
runtime), `src/ui/panels/TalentPanel.ts` + `src/ui/talentPanel/` (screen), and
`src/core/data/normalizeTalents.ts` (loading and checks).

## Rules

- **Points.** A new save starts with `startingPoints`. Each campaign night won
  adds `pointsPerNightWon` and each night lost adds `pointsPerNightLost`.
  Endless and wave-planner runs give nothing. Saves made before talents existed
  get `startingPoints + (night − 1) × pointsPerNightWon` on load. The save
  version does not change.
- **Ranks.** Each rank costs 1 point, up to the node's `maxRank`. A rank adds
  the node's `perRank` modifiers and procs again, so values and proc chances
  scale with the rank.
- **Tiers.** Tier N opens when that branch has `tierThresholds[N]` points spent
  in it. Every tier is also gated by `requires`: one of the listed talents must
  have at least 1 rank. These are the connectors drawn on screen.
- **Pick one.** A tier with `exclusive: true` (tier III in every branch) lets
  you learn only one of its nodes. Learning it locks the other.
- **Reset.** Refunds every point for `resetCostGold`. It needs a second tap to
  confirm, and it can't be used if nothing has been learned or you don't have
  enough gold.
- **Effects.** Talent bonuses go into the gear stat sum
  (`gearStatsFor(catalog, gear, bonus)` / `applyGearLoadout(gear, catalog, bonus)`),
  so combat, max HP, the Gear panel totals and the economy sim all include
  them. Caps from `items.json` `statCaps` still apply. Three new flat stats
  were added for talents (items can use them too): `meleeArcPct`,
  `rangedRangePct` and `cooldownPct`. `cooldownPct` is a flat spell cooldown
  cut, added to the per-spell cooldown reductions under the
  `spellCooldownPct` cap.
- **Safety on load.** Saved ranks are replayed tier by tier against the current
  tree. If any rank no longer fits (removed node, lowered `maxRank`, broken
  prerequisite or exclusive clash), the whole tree is refunded, so points are
  never lost.

## Current tree

Per rank values. Each branch holds 10 points and the full tree takes 30.

| Tier (opens at) | Blade | Marksman | Sorcery |
|-----------------|-------|----------|---------|
| I (0) | **Sharpened Edge** 3 ranks: +1.5 melee damage | **Steady Aim** 3: +1.5 ranged damage | **Arcane Study** 3: +8% spell power |
| II (2) | **Heavy Swing** 2: +3% weapon damage | **Long Draw** 2: +10% ranged range, +1 ranged damage | **Kindling** 2: +12% fire damage |
| III (4), pick one | **Wide Arc** 1: +30% melee arc, +1 melee damage / **Bloodletting** 1: +4% lifesteal | **Quick Nock** 1: +12% attack speed / **Frost Tips** 1: 30% chance to slow 30% for 1.5 s | **Deep Winter** 1: +25% frost damage / **Overcharge** 1: +25% lightning damage |
| IV (5) | **Iron Hide** 3: +5 armour, +5 max HP | **Deadeye** 3: +3% weapon damage | **Focus** 3: −5% spell cooldowns |
| V (8) | **Executioner** 1: +10% weapon damage, 12% chance to stun for 0.5 s | **Volley** 1: +10% attack speed, +3 ranged damage | **Meteor Storm** 1: +12% spell power, +25% Meteor damage |

## Placeholders awaiting confirmation

The mockup's numbers were all placeholders. Only its structure, labels and
style were kept. These values were picked against the economy sim and need
sign-off:

| Key | Value | Why |
|-----|-------|-----|
| `pointsPerNightWon` | 1 | About 13 points by night 12 (21 by night 20): one branch full plus part of a second |
| `pointsPerNightLost` | 0 | Losing a night already repeats it. Points stay tied to progress |
| `startingPoints` | 1 | Night 1 has something to learn, so the screen isn't empty |
| `resetCostGold` | 50 | Roughly one early night's reward. Cheap enough to experiment with, not free |
| `tierThresholds` | 0 / 2 / 4 / 5 / 8 | The mockup's 0/3/5/8/10 made tier IV unreachable (tiers I–III only hold 6 points) |
| All effect values, rank counts and descriptions | see table | Tuned so a full build adds about 15–20% power in the sim (below) |

## Economy sim

Each strategy spends its points on whatever raises its own score most, one
rank at a time, every town phase. Profiles stay in their branch first:

- melee-dps, tank, sustain and wall-turtle: Blade
- ranged: Marksman
- spell-caster: Sorcery
- everyone else: the whole tree

When the profile's branch has nothing left to learn, it falls back to the
whole tree. Turn talents off with `--no-talents` to compare. See
[ECONOMY_SIM.md](./ECONOMY_SIM.md).

The sim values damage, attack speed, armour, HP, lifesteal, procs (slow and
stun as crowd control), spell power and cooldowns. Melee arc and ranged range
count as zero (real fights showed swings barely multi-hit), so Wide Arc and
Long Draw's range are underrated there. Spells are valued by replaying the
auto-cast rotation; frost and lightning spells have cast windups and almost
never land in real fights, so Deep Winter and Overcharge are worth little in
the sim and in play (see ECONOMY_SIM.md, "Calibration").
