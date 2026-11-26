# Economy and progression simulator

A headless Monte Carlo sim of the night → town → night campaign, used to tune
prices, rewards, drop rates and wave difficulty. It imports the real game code
(`src/gear/*` item generation, loot, shops, pricing and stats; wall upgrades
via `handleTownBuildingTap`; `createNewSave`; the night-end path
`resolveCampaignNightEnd`) and the bundled JSON in `public/data/`, so formulas are not
duplicated. Code: `src/sim/economy/`.

For how rarity and item level work, see [ITEMS.md](ITEMS.md) (also embedded
at the bottom of the HTML report).

## Run it

```bash
npm run sim:economy                          # 1000 runs × every strategy, seed 1
npm run sim:economy -- --runs 200 --strategy balanced
npm run sim:economy -- --win-model fixed --win-rate 0.85
npm run sim:economy -- --set loot.sellBackPct=30 --set waves.10.rewardGold=170
npm run sim:economy -- --overrides my-tuning.json --out sim-output/tuning-a
npm run sim:economy -- --help
```

Output goes to `sim-output/` (gitignored):

| File | Contents |
|---|---|
| `report.html` | Self-contained report (no scripts/network): strategy table, charts (gold, power vs difficulty, rarity mix, affordability), per-night tables, blacksmith price table, item-system explainer |
| `nights.csv` | One row per strategy × night: reach %, losses, flag, rarity mix, and p10/p50/p90 of every per-night metric |
| `runs.csv` | One row per run (totals, losses, final power) |
| `summary.json` | Everything above, machine-readable |

A 1000-run run of all five strategies takes about 35 s.

## Options

| Flag | Default | Meaning |
|---|---|---|
| `--runs N` | 1000 | Runs per strategy |
| `--seed N` | 1 | Base seed; run *i* uses seed + i (same seeds for every strategy) |
| `--strategy S` | all | `all` or one strategy id (see Strategies below) |
| `--nights N` | waves.json length | Campaign length |
| `--win-model` | power | `power` (power vs difficulty) or `fixed` |
| `--win-rate P` | 0.85 | Win chance per attempt for `--win-model fixed` |
| `--set file.path=value` | – | Override any data value (repeatable). Files: `items`, `loot`, `shops`, `consumables`, `waves`, `buildings`, `player`, `enemies`, `spells`. Object keys and array indexes are path segments (e.g. `waves.10.rewardGold`). Values are parsed as JSON, else string |
| `--overrides file.json` | – | `{ "loot": { "sellBackPct": 30 }, ... }` deep-merged (arrays replace) |
| `--no-sell` | – | Never sell surplus drops |
| `--no-talents` | – | Never spend talent points (compare against talent builds) |
| `--spell-dps`, `--grace`, `--threat`, `--steepness` | 12, 20, 0.5, 3 | Power model knobs (below) |
| `--easy`, `--hard` | 2, 1 | Power-ratio thresholds for the "too easy"/"too hard" flags |
| `--out DIR` | sim-output | Output folder |
| `--quiet` | – | Skip the console tables |

## What a run does

Per night attempt:

1. **Fight.** Win chance from the win model (below). If the chance is under
   75% the strategy uses all its potions and bombs first.
2. **Result** via the game's own `resolveCampaignNightEnd` (same as the real night end): a win pays
   `rewardGold` and advances; a loss pays `loot.lostNightGoldPct` (15%) and repeats the night (capped at
   nights × 4 attempts, then the run is "unfinished"). Drops come from
   `rollNightDrops` (won / lost table) into the bag; full bag ⇒ auto-sold.
   A win wears the wall by 2 HP; a loss knocks it down (rebuilt next night).
3. **Town.** Shops restock (`ensureShopStock`: trader stock and blacksmith
   masterworks at the bought shop level), blacksmith catalogue unlocks by
   night. The strategy equips upgrades, sells surplus at `sellBackPct`, and
   spends gold: wall levels (`handleTownBuildingTap`), gear, potions, shop
   levels (`upgradeShop`, which restocks that shop) and trader rerolls
   (`rerollTrader`) — all through the game's own functions.

### Strategies

Spending plans:

- **walls-first** – buy every wall level it can, then gear.
- **gear-first** – best gear upgrade per gold until nothing helps, then walls.
- **balanced** – greedy: whatever (gear or wall level) gives most power per gold.
- **potion-hoarder** – buy the cheapest potions/bombs until stacks are full or gold runs out, then balanced.
- **no-spend** – never buys; drops only. A baseline for "is the shop needed?".
- **shop-investor** – buys shop levels first (cheapest next level of either shop), then balanced.
- **reroller** – buys trader levels first, balanced, then rerolls the trader
  (up to 3 times a day, only while it has at least 2× the reroll cost) and
  shops again after each reroll.

Gear-priority profiles (balanced spending, but gear is scored as
`power ratio × focus stat / focus stat with no gear`, so they chase their stat
while still caring about overall power):

- **melee-dps** – melee DPS (weapon damage, attack speed).
- **ranged** – ranged DPS.
- **spell-caster** – average spell damage multiplier (spell power, element and named-spell boosts).
- **tank** – effective HP (armour, HP).
- **sustain** – lifesteal (`1 + lifesteal% / 10`).
- **wall-turtle** – walls first, then gear scored by effective HP; keeps spare gold.

walls-first, gear-first, balanced, the gear-priority profiles (except
wall-turtle), shop-investor and reroller put any gold left after their plan
into shop levels, then shop again at the new level. All strategies equip
strictly better items and (unless `--no-sell`) sell the rest of the bag.

### Talents

Talent points come in as they do in the game (`public/data/talents.json`).
In each town phase (and at the start of a run), every strategy spends all
its points one rank at a time. Each rank goes to the learnable talent that
raises its gear score the most. melee-dps, tank, sustain and wall-turtle stay
in Blade first, ranged in Marksman, and spell-caster in Sorcery. Other
strategies pick from the whole tree. Talent bonuses feed the same power model
as gear, and `cooldownPct` divides into spell DPS. `--no-talents` turns this
off. Each run's final ranks are on `RunResult.talents`. See
[TALENTS.md](./TALENTS.md).

### Win models

- **`power` (default).** Win chance follows player power vs night
  difficulty, so strategies, gear and wall actually matter and the sim can
  tell you *where* players fall behind:
  - offence = player DPS / required DPS, where player DPS = weapon damage ÷
    attack cycle + expected DoT procs + `spellDps` × gear spell multiplier,
    and required DPS = total wave HP ÷ (spawn span + `grace` s).
  - defence = EHP ÷ (wave damage × `threat`), EHP = max HP ÷ (1 − armour reduction)
    + lifesteal% × weapon DPS × fight time × 0.25 (`lifestealUptime`).
  - wall = wall HP ÷ (wall damage × `threat`).
  - ratio = offence^0.5 × defence^0.25 × wall^0.25; win = ratio^k / (1 + ratio^k), k = `steepness`.
  - Ratio 1 = 50% win; 2 ≈ 89%. It is a heuristic, not a combat sim:
    compare *relative* numbers (strategies, nights, before/after a change)
    rather than trusting absolute win rates.
- **`fixed`.** Every attempt wins with `--win-rate`. Use it to isolate pure
  economy (gold flow, affordability) from the difficulty model.

## Reading the output

- **Strategy table** – medians (p10–p90): nights played incl. repeats,
  losses, gold earned from nights, gold from sales, spend on wall / gear /
  potions / shop levels / rerolls, final trader and blacksmith level, nights
  flagged too easy / too hard, gold banked at the end, final average equipped
  ilvl, final power ratio vs the last night, and where final equipped gear
  came from (drops / trader / blacksmith %).
- **Per-night table** – per night: reward, enemy HP, % of runs reaching it,
  mean losses there, gold banked/spent, wall level, avg ilvl, DPS, EHP, power
  ratio p10/50/90, win %, % of shop items affordable on entering town, and the
  flag (median ratio ≥ `--easy` ⇒ too easy, < `--hard` ⇒ too hard).
- **Charts** – gold banked over nights, power vs difficulty (ratio 1 line),
  rarity mix of equipped gear, shop affordability.
- **Blacksmith prices** – each blacksmith item's price in "nights of pay" at
  its unlock night.

## Comparing against the old balance

`docs/sim-presets/pre-shop-upgrades.json` puts back the numbers from before
the shop-upgrade rebalance (sell-back 50%, lost nights pay 25% and drop up to
1 item, night 10 reward 150, old potion / bomb / late blacksmith prices) and
turns shop upgrades off. Run both with the same seed to compare:

```bash
npm run sim:economy -- --overrides docs/sim-presets/pre-shop-upgrades.json --out sim-output/before
npm run sim:economy -- --out sim-output/after
```

## Tuning workflow

1. Run the baseline (`npm run sim:economy -- --out sim-output/base`).
2. Try a change with `--set`/`--overrides` into another folder.
3. Compare the strategy tables and flags. When happy, make the change in
   `public/data/*.json` and re-run.
