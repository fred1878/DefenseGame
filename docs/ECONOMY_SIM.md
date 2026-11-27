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
| `--model fitted.json` | – | Power model knobs from a fitted model file (`npm run sim:fights -- fit --out`); the flags below override it |
| `--still-share`, `--moving-share` | 0.1, 0.5 | Share of the fight standing still (whole bar auto-casts) and moving (instant spells only) |
| `--crowd-area`, `--exposure` | 640000, 0.5 | Crowd area (wu²) for area hits; incoming damage × (kill time ÷ fight time)^exposure |
| `--grace`, `--threat`, `--steepness` | 45, 0.35, 2 | Power model knobs (below) |
| `--weights O,D,W` | 0,0.9,0.1 | Offence, defence and wall exponents of the power ratio. Offence still counts through `exposure` (fast kills take less damage) |
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
  tell you *where* players fall behind. The model is crowd-aware and its
  knobs are fitted to real headless fights (next section):
  - **Weapon:** single-target DPS (damage ÷ attack cycle + expected DoT
    procs) × uptime (melee 0.65, ranged 0.30, measured from the damage
    tally). Melee swings count `weaponCrowd` (0) of the extra enemies in the
    arc: real fights showed no measurable multi-hit gain, knockback scatters
    packs.
  - **Spells:** the default bar in the bot's auto-cast order (longest
    cooldown first) is replayed for a minute with the game's own
    `pickAutoCastSpell`, standing (whole bar) and moving (instant spells
    only). Spell DPS = gear multiplier × (`still-share` × standing DPS +
    `moving-share` × moving DPS); AoE spells hit 1 + (alive − 1) × area ÷
    `crowd-area` enemies.
  - **Bombs** use the same crowd rule over a 90 wu radius; potions add EHP.
  - **Crowd:** enemies alive at once = count × kill time ÷ (spawn span +
    kill time), solved as a fixed point with the area hits above.
  - offence = effective DPS ÷ (wave HP ÷ (spawn span + `grace`)).
  - defence = EHP ÷ (wave damage × `threat` × exposure × crowd control),
    exposure = (kill time ÷ fight time)^`exposure`, crowd control = 1 −
    0.3 × slow/stun proc uptime. EHP = max HP ÷ (1 − armour reduction) +
    potions + lifesteal healing over the kill time.
  - wall = wall HP ÷ (wall damage × `threat` × exposure).
  - ratio = offence^0 × defence^0.9 × wall^0.1; win = ratio^k / (1 + ratio^k), k = `steepness` (2).
  - The fit put the wall weight at 0; it is kept at 0.1 so wall upgrades
    still count (it costs 0.007 log loss). Compare *relative* numbers more
    than absolute win rates.
- **`fixed`.** Every attempt wins with `--win-rate`. Use it to isolate pure
  economy (gold flow, affordability) from the difficulty model.

## Checking the model against real fights

`npm run sim:fights` is the real-fight harness (`scripts/sim-fights.mjs`).
`run` plays the sim per strategy, saves each chosen night's starting save at
the p10 / p50 / p90 power ratio (and with `--behind`, a median save from
three nights earlier), then replays every save in the real game through the
manual Playwright spec `e2e/win-model.spec.ts` (`@manual`, not in CI;
headless Chromium, `/?e2e=1&campaignWaves=1`, 8 workers). The bot
auto-attacks with the better weapon mode, auto-casts the whole bar (see
"Spell bars" below), targets the enemy nearest the north wall, kites in
ranged mode, backs off under 35% HP, stands still under 70% HP while a heal
is ready (and never moves during a heal, which needs the player still),
drinks a potion (Q) under 45% HP and throws a bomb (E) when 5+ enemies are
within 160 px. A night is won if `save.night`
advanced. Each fight also records the game's damage tally by flavour
(physical = weapon; elements = spells, procs, bombs), the same damage by
source (`bySource`: a spell id, its DoTs included; `melee` / `ranged`
weapon hits; `proc` for gear DoTs; bombs under their own id), the casts
started per spell, the HP the player regained and the bar it used.

### Spell bars

Auto-cast takes the first ready slot from the left. A filler, a damage
spell that is ready again as soon as it finishes (`fire_bolt`, `ice_bolt`,
`water_bolt` at 150 ms, and `blizzard`, whose 1.5 s cooldown runs out during
its own 4 s channel), starves every slot after it, so a bar has exactly one
filler, last. `src/sim/economy/spellBars.ts` builds the bars the sim and the
harness use:

- **cooldown** (default): the save's own spells, every cooldown spell
  (damage, control and heals) longest cooldown first, then the save's
  highest-DPS filler; other fillers are dropped.
- **fire** (`--schools fire`): `cone_of_fire`, `flamestrike`,
  `combustion`, `arc_bomb`, `fire_nova` (fire's five best cooldown spells
  by damage per cooldown second), heals, then `fire_bolt`.
- **frost**, **frost-bolt**, **lightning** (`--bars`): an element-focused bar
  for the same save: the element's spells first (frost: `frost_nova`,
  `deep_freeze`, `cone_of_cold`; `ice_wall` is not pool-selectable yet;
  lightning: `chain_lightning`, `lightning_bolt`), then `heal`,
  `flash_heal` and the save's other cooldown spells in cooldown order, then
  one filler: `blizzard` (frost), `ice_bolt` (frost-bolt) or the save's own
  (lightning). Every spell up to implementation phase 4 can be put on the
  bar from night 1, so these bars are legal on every night.

Heals in the game auto-cast whenever they are ready, at any HP.

```bash
# real fights on the shipped data (builds dist with build:e2e if missing; --build forces it)
npm run sim:fights -- --nights 7,10,12,14,16,18,20 --strategies balanced,ranged,spell-caster,no-spend
# candidate data without a rebuild: overrides are served to the game in place of /data/*.json
npm run sim:fights -- --nights 13,16,20 --overrides candidate-waves.json --out sim-output/fights/cand
npm run sim:fights -- report sim-output/fights/cand [--model fitted.json]   # predicted vs real
npm run sim:fights -- tally sim-output/fights/*                             # damage tally vs model DPS
npm run sim:fights -- fit sim-output/fights/* --fix steepness=2 --out fitted.json
```

Two replay options change the bot, not the game: `--full-cast` makes it
finish every cast (it holds still through windups and channels, and stops
when a windup spell is ready and an enemy is in reach, so auto-cast can start
it), and `--bars cooldown,frost,frost-bolt,lightning` replays each save once
per bar above (gear and talents stay the save's own, labelled
`strategy/frost` etc.). `--saves DIR/snapshots.json` replays an earlier
run's saves instead of playing the sim again, so a rerun uses the very same
saves. `--resume` keeps the out folder's results and plays only the
fights still missing one (use it with `--saves` so the snapshots match).

`--no-auto-attack` turns the HUD auto attack off for the night (the bot
never taps attack either), so the player makes no weapon attacks; the
result rows carry `autoAttack`.

`--schools generic,fire,frost,lightning` replays each save once per school
build (`src/sim/economy/schoolBuilds.ts`), labelled `strategy/fire` etc.;
`generic` is the save as it is. A school build keeps the save's items
(base, rarity, item level, affix count) and its talent points:

- **Gear**: Sturdy, Vital, of Speed, uniques and affixes already in the
  school's pool (Mastery / Quickening re-keyed to its spells) stay. Every
  other affix on an equipped item becomes the school's first legal pick for its position
  and item type: prefixes the element (Fiery / Icy / Shocking), then
  Arcane; suffixes of Mastery and of Quickening keyed to the school's
  spells (frost: Quickening first), then the school's weapon proc (of
  Embers / of Frost / of Thunder). The new roll sits at the same point of
  its tier for the item level as the old one. With no legal unused pick
  (e.g. Sharp on gloves) the old affix stays, so no item has an affix twice.
- **Talents**: Sorcery first: Arcane Study 3, Kindling 2, Deep Winter
  (frost) or Overcharge (lightning; fire takes it too, only to reach the
  next tiers), Focus 3, Meteor Storm 1. Points left keep the save's other
  talents, shallowest tiers first.
- **Bar**: the school's bar above (generic: cooldown).

Superseded first full-cast check (spell-caster saves, nights 7–20 ×
p10/p50/p90, one fight each; the default bot lost one fight's result at
night 20 p90). Its bars were flawed: every slot sorted by cooldown with all
three fillers kept, so `water_bolt` starved the slots after it and the heals
never fired, and "frost first" put the no-cooldown `ice_bolt` in front,
which then was the only spell cast:

| Bar order | Default bot won | Full-cast bot won | Frost / lightning share of damage (full-cast) |
|---|---|---|---|
| cooldown | 30/41 | 31/42 | 0% / 1.9% |
| frost first | 35/42 | 1/42 | 42.0% / 0% |
| lightning first | 37/42 | 31/42 | 0% / 2.3% |

Rerun with the fixed bars (the same 42 spell-caster saves, nights 7–20 ×
p10/p50/p90, one fight each; a few fights wrote no result):

| Bar | Current bot won | Full-cast bot won | Frost / lightning / fire share (full-cast) |
|---|---|---|---|
| cooldown | 25/42 | 24/40 | 0% / 0% / 18.7% |
| frost (blizzard filler) | 31/42 | 33/42 | 12.7% / 0% / 17.0% |
| frost-bolt (ice_bolt filler) | 29/41 | 30/42 | 14.3% / 0% / 16.5% |
| lightning | 29/42 | 27/41 | 0% / 4.2% / 18.3% |

The rest was physical (weapon) damage. Heals now fire about 4–5 times a
fight. The same saves for balanced, ranged and no-spend (from the final
batch) won 21/32, 21/33 and 9/31 with the fixed bar, against 26/32, 26/33
and 12/31 with the old one (which spammed the instant `water_bolt`, castable
while moving).

`fit` does coordinate descent on the model knobs by log loss over nights ≥
`--min-night` (13); earlier nights are held out and only scored.

### Calibration (November 2026)

422 real fights: shipped waves (129, nights 3–20, plus `--behind` saves),
three candidate wave sets for nights 13–20 (213) and the final waves (131,
nights 7–20). Weapon uptimes and spell shares were pinned from the damage
tally (`tally`: melee dealt 0.65× its single-target DPS over a fight with no
trend in crowd size, ranged 0.30×; element damage ≈ 0.49 × moving bar DPS +
0.11 × standing bar DPS). The other knobs were fitted on nights 13–20 with
steepness pinned at 2 (steeper fits overfit: held-out log loss went up).

| | Old model (0.2/0.6/0.2, k 4, spell 12 DPS) | Crowd model (fitted) | Base rate |
|---|---|---|---|
| Log loss, all 422 fights | 1.006 | 0.425 | 0.635 |
| Log loss, held-out nights 3–12 (77 fights) | 0.425 | 0.413 | 0.433 |
| Final waves (131 fights, out of sample) | 1.198 | 0.437 | 0.609 |
| Final waves: mean predicted vs real | 27% vs 70% | 65% vs 70% | – |

Each fight is scored on the waves it was played on. (The first version of
this table scored some fights on the wrong wave set; these are the
corrected numbers.)

Final waves, per night (predicted → real):

| Night | 7 | 10 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Old model | 75% | 54% | 70% | 33% | 20% | 16% | 10% | 9% | 5% | 5% | 4% |
| Crowd model | 90% | 85% | 90% | 73% | 68% | 64% | 56% | 54% | 47% | 46% | 41% |
| Real | 67% | 92% | 100% | 67% | 83% | 58% | 73% | 67% | 58% | 58% | 50% |

Per strategy on the final waves (predicted → real): balanced 78% → 81%,
ranged 66% → 79%, spell-caster 72% → 85%, no-spend 44% → 36% (old model:
36 / 31 / 31 / 12%). The crowd model still under-rates late nights a little
and over-rates night 7 (no-spend lost all three there).

What the tally showed:

- **Melee arcs barely multi-hit in practice.** Weapon damage per second
  does not grow with enemies alive; knockback (250) scatters packs.
- **Cast-windup spells almost never land.** In every batch frost and
  lightning damage were 0 and fire was 3–12% (mostly nova, bombs and
  burns): the bot keeps moving, auto-cast skips windup spells while moving,
  and movement interrupts them. Water bolt (instant, 150 ms) does 22–46% of
  all damage.
- Spell-caster still wins as often as balanced in real fights; the old model
  rated it weakest because it valued element boosts on spells that never
  cast.

### Retune of nights 13–20

Nights 13–20 keep their groups; `hpMul` ramps ×1.5 → ×2.8 and `damageMul`
×1.3 → ×2.0 on top of the previous values (nights 1–12 unchanged). Real
fights on the final waves, nights 13–20 (one fight per save, so most cells
are 2–3 fights):

| Build | Won |
|---|---|
| Spenders (balanced, ranged, spell-caster), p50 | 20/23 (87%) |
| Spenders, all tiers | 55/71 (77%) |
| Spenders, p10 | 12/24 (50%) |
| Spenders, p90 | 23/24 (night 20: 2/3) |
| No-spend p10 / p50 | 0/16 |
| No-spend p90 (lucky drops) | 6/8 |

Pooled with the two earlier runs of the same waves, median spenders won
40/53 (75%) of nights 13–20. Night 20: p50 spenders 3/3, p90 2/3, p10 0/3.

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
