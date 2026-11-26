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

A 300-run run of every strategy over 20 nights takes about 2 minutes (1000 runs about 6).

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
| `--spell-dps`, `--grace`, `--threat`, `--steepness` | 12, 20, 0.5, 4 | Power model knobs (below) |
| `--weights O,D,W` | 0.2,0.6,0.2 | Offence, defence and wall exponents of the power ratio. `--weights 0.5,0.25,0.25 --steepness 3` is the model from before the real-combat check |
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
   The campaign is 20 nights (`waves.json`).
3. **Town.** Shops restock (`ensureShopStock`: trader stock and blacksmith
   masterworks at the bought shop level), blacksmith catalogue unlocks by
   night. The strategy equips upgrades, sells surplus at `sellBackPct`, and
   first sells any bag item that matches a trader **buy request** (best
   payout first, 150% of the item's value), then spends gold: wall levels (`handleTownBuildingTap`), gear, potions, shop
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
    + lifesteal% × weapon DPS × fight time × 0.25 (`lifestealUptime`). Wave
    damage is one hit from every enemy, scaled by each group's `damageMul`.
  - wall = wall HP ÷ (wall damage × `threat`).
  - ratio = offence^0.2 × defence^0.6 × wall^0.2; win = ratio^k / (1 + ratio^k), k = `steepness` (4).
  - Ratio 1 = 50% win; 1.2 ≈ 67%; 1.5 ≈ 84%; 2 ≈ 94%. It is still a
    heuristic, not a combat sim: compare *relative* numbers (strategies,
    nights, before/after a change) more than absolute win rates.
  - The weights come from real fights (below). The old model (0.5/0.25/0.25,
    k 3) leaned on offence, but in real play a low-DPS player still wins,
    just slowly; what loses nights is the player dying.
- **`fixed`.** Every attempt wins with `--win-rate`. Use it to isolate pure
  economy (gold flow, affordability) from the difficulty model.

## Checking the model against real fights

`scripts/win-model-snapshots.mjs` runs the sim (balanced strategy) and saves
the player's save at chosen nights for four gear levels: the p10, p50 and p90
power ratio of the runs, plus a "behind" save (lowest ratio seen). The manual
Playwright spec `e2e/win-model.spec.ts` (`@manual`, not in CI) then loads each
save in the real game (`/?e2e=1&campaignWaves=1`, so the real waves.json
groups spawn at random positions), and a simple bot plays the night: it
auto-attacks, casts every spell when ready, uses melee or ranged by whichever
does more DPS, targets the enemy closest to the north wall, kites in ranged
mode and backs off under 35% HP. A night counts as won if `save.night`
advanced. Results go to `sim-output/win-model-results.jsonl`.

```bash
npm run build:e2e
node scripts/win-model-snapshots.mjs sim-output/win-model-snapshots.json --nights 5,8,10,12,15,18,20
E2E_WORKERS=8 WIN_MODEL_SNAPSHOTS=sim-output/win-model-snapshots.json WIN_MODEL_REPEATS=3 \
  npx playwright test e2e/win-model.spec.ts --project=chromium
```

First check (84 fights: nights 5, 8, 10, 12, 15, 18, 20 × 4 gear levels × 3
repeats, old waves without `damageMul`):

| Night | 5 | 8 | 10 | 12 | 15 | 18 | 20 | All |
|---|---|---|---|---|---|---|---|---|
| Old model predicted | 78% | 61% | 53% | 53% | 53% | 50% | 49% | 57% |
| Bot won | 42% | 58% | 75% | 67% | 83% | 92% | 100% | 74% |

Losses were almost all player deaths. Low offence barely mattered (a night-20
save at offence ratio 0.46 still won 3/3, it just took 202 s). Log loss:
old model 55.8, a flat base rate 48.3, the new 0.2/0.6/0.2 k 4 model 39.0,
best fit (pure defence, k 6) 30.0. The new default sits between the old model
and the best fit on purpose: the bot is simple (charges into melee, never
drinks potions) and the sample is small. Night 5 is the hardest early night
for the bot (12 grunts + 10 skirmishers + charger and reaver all at once).

Check on the shipped waves (nights 13–20 with `damageMul` 1.3–2.1) and
talents on (48 fights: nights 12, 15, 18, 20 × 4 gear levels × 3 repeats):

| Night | 12 | 15 | 18 | 20 | All |
|---|---|---|---|---|---|
| Model predicted | 76% | 58% | 48% | 45% | 57% |
| Bot won | 100% | 92% | 100% | 100% | 98% |

Even the "behind" saves (model 11–41%) won 11 of 12. In those wins the bot
kept 85–95% of its HP and the wall was almost never hit: with 60–70 enemies
alive at once, they die before they get close. So **the model still
over-rates late nights**. The likely gap is crowd damage: weapon arcs, AoE
spells and on-hit procs hit many enemies at once, but the model's offence
treats player DPS as single-target against the night's total HP. Treat the
late-night win chances as relative (how strategies and nights compare), and
expect real late nights to be easier than the table says until offence is
modelled for crowds or the waves are pushed harder in real play.

## Reading the output

- **Strategy table** – medians (p10–p90): nights played incl. repeats,
  losses, gold earned from nights, gold from sales, spend on wall / gear /
  potions / shop levels / rerolls, final trader and blacksmith level, nights
  flagged too easy / too hard, gold banked at the end, final average equipped
  ilvl, final power ratio vs the last night, and where final equipped gear
  came from (drops / trader / blacksmith %), and gold from trader buy
  requests (`requestGold`, `requestsFilled`).
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
