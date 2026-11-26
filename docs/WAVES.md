# Wave progression (`public/data/waves.json`)

Night keys match `save.night` when defense starts. Winning a night increments `save.night`.

Counts below are per-night totals (grunt groups summed). Nights **1–2** are a gentler intro (**grunts** and **skirmishers** only). From night **3** onward, the prior campaign ramp applies: skirmishers, sentry cover, and escalating **slow_siege**, **fast_sapper**, **charger**, **lobber**, and **ward** alongside the core grunt/bruiser/archer/javelineer mix through night **12**. Nights **13–20** are the late campaign: bigger versions of the night-12 mix plus reavers and skirmishers, tougher enemies (`hpMul`), harder hits (`damageMul`) and **elite** groups. Their multipliers were tuned against real headless fights (`npm run sim:fights`, see [ECONOMY_SIM.md](./ECONOMY_SIM.md)) so a median spender wins about 60–80% of late nights and a no-spend build mostly loses.

| Night | rewardGold | Summary |
|------:|-----------:|---------|
| 1 | 25 | Intro: 4× grunt |
| 2 | 32 | 4× grunt, 3× skirmisher |
| 3 | 40 | 5× grunt, 6× skirmisher; ward; sentry + arrow-rain archers |
| 4 | 55 | 6× grunt, 8× skirmisher; bruiser, siege, sentry, archer |
| 5 | 70 | 12× grunt, 10× skirmisher; sapper, siege, charger; archer, javelineer, reaver |
| 6 | 85 | 16× grunt, 2 bruisers; sapper×3, siege, charger, lobber×3; archer×3 |
| 7 | 100 | 15× grunt, 2 bruisers; all five specialists; archer×3, javelineer×3 |
| 8 | 115 | 18× grunt, 3 bruisers; siege×2, charger×2; lobber, ward; ranged mix |
| 9 | 130 | 21× grunt, 3 bruisers; sapper×3, siege×2, charger×2, lobber×2, ward |
| 10 | 170 | 28× grunt, 3 bruisers; full specialist ramp + grunt reinforcement (trimmed from 31 grunts / 4 bruisers in the nights 13–20 pass) |
| 11 | 175 | 26× grunt, 4 bruisers; specialist counts peak before milestone |
| 12 | 200 | Milestone: 21× grunt, 5 bruisers, 5 archers, 6 javelineers; 3 siege, 4 charger, 3 lobber, 3 ward, 4 sapper |
| 13 | 215 | 63 enemies, 7,266 HP: night-12 mix + 6 skirmishers, reaver; HP ×1.42, damage ×1.69; 1 elite bruiser |
| 14 | 230 | 69 enemies, 9,598 HP; HP ×1.69, damage ×1.96; 1 elite bruiser |
| 15 | 245 | 74 enemies, 12,613 HP; HP ×1.87, damage ×2.25; elite bruisers ×2, elite charger |
| 16 | 260 | 83 enemies, 16,063 HP; HP ×2.16, damage ×2.56; elite bruisers ×2, elite charger |
| 17 | 280 | 85 enemies, 19,467 HP; HP ×2.47, damage ×2.98; elite bruisers ×2, chargers ×2, ward |
| 18 | 300 | 97 enemies, 26,699 HP; HP ×2.79, damage ×3.33; elite bruisers ×3, chargers ×2, ward, siege ×2 |
| 19 | 320 | 100 enemies, 33,091 HP; HP ×3.27, damage ×3.8; elite bruisers ×3, chargers ×3, wards ×2, siege ×3 |
| 20 | 360 | Finale: 113 enemies, 50,618 HP in a 19 s spawn window; HP ×3.78, damage ×4.2; 6 elite bruisers (3 at ×9.8 HP), chargers ×3, wards ×2, siege ×4 |

**Group multipliers.** A group can set `hpMul` (enemy HP; at ×2 or more the
enemy is an **elite** and its nameplate reads "Elite …") and `damageMul`
(its `damage` and every combat `…Damage` number, e.g. charge or wall damage;
not `…DamageScale`). Elite groups (HP ×2.0–2.8) also hit 1.25× harder than
the rest of the night.

Grunts, bruisers, and skirmishers path toward the **north wall** unless the player is within aggro with line of sight. Siege and sapper units use a tighter aggro disc. Wards screen nearby arrow/javelin/sentry allies.

Each enemy id has a unique `textureKey` (`enemy_<id>`) and four facing PNGs in `public/assets/sprites/enemies/<id>/`.

If a night is missing from JSON, `DataStore.getWaveForNight` falls back to the highest defined night ≤ requested night, then night `1`. After night **20**, wave data **repeats night 20**.