# Wave progression (`public/data/waves.json`)

Night keys match `save.night` when defense starts. Winning a night increments `save.night`.

Counts below are per-night totals (grunt groups summed). Nights **1–2** are a gentler intro (**grunts** and **skirmishers** only). From night **3** onward, the prior campaign ramp applies: skirmishers, sentry cover, and escalating **slow_siege**, **fast_sapper**, **charger**, **lobber**, and **ward** alongside the core grunt/bruiser/archer/javelineer mix through night **12**.

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
| 10 | 150 | 31× grunt, 4 bruisers; full specialist ramp + grunt reinforcement |
| 11 | 175 | 26× grunt, 4 bruisers; specialist counts peak before milestone |
| 12 | 200 | Milestone: 21× grunt, 5 bruisers, 5 archers, 6 javelineers; 3 siege, 4 charger, 3 lobber, 3 ward, 4 sapper |

Grunts, bruisers, and skirmishers path toward the **north wall** unless the player is within aggro with line of sight. Siege and sapper units use a tighter aggro disc. Wards screen nearby arrow/javelin/sentry allies.

Each enemy id has a unique `textureKey` (`enemy_<id>`) and four facing PNGs in `public/assets/sprites/enemies/<id>/`.

If a night is missing from JSON, `DataStore.getWaveForNight` falls back to the highest defined night ≤ requested night, then night `1`. After night **12**, wave data **repeats night 12**.