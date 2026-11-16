# Wave progression (`public/data/waves.json`)

Night keys match `save.night` when defense starts. Winning a night increments `save.night`.

Counts below are per-night totals (grunt groups summed). Nights **1–10** include skirmishers, sentry cover, and ramping groups for **slow_siege**, **fast_sapper**, **charger**, **lobber**, and **ward** alongside the core grunt/bruiser/archer/javelineer mix.

| Night | rewardGold | Summary |
|------:|-----------:|---------|
| 1 | 40 | 7× grunt, 2 skirmisher; sapper + sentry late; archer + javelineer |
| 2 | 55 | 11× grunt, 2 skirmisher; sapper, siege, sentry, archer, javelineer |
| 3 | 70 | 13× grunt; bruiser; sapper, siege, charger; archer + javelineer |
| 4 | 85 | 13× grunt, 2 bruisers; sapper×2, siege, charger, lobber; archer×3, javelineer×2 |
| 5 | 100 | 15× grunt, 2 bruisers; all five specialists; archer×3, javelineer×3 |
| 6 | 115 | 18× grunt, 3 bruisers; siege×2, charger×2; lobber, ward; ranged mix |
| 7 | 130 | 21× grunt, 3 bruisers; sapper×3, siege×2, charger×2, lobber×2, ward |
| 8 | 150 | 31× grunt, 4 bruisers; full specialist ramp + grunt reinforcement |
| 9 | 175 | 26× grunt, 4 bruisers; specialist counts peak before milestone |
| 10 | 200 | Milestone: 21× grunt, 5 bruisers, 5 archers, 6 javelineers; 3 siege, 4 charger, 3 lobber, 3 ward, 4 sapper |

Grunts, bruisers, and skirmishers path toward the **north wall** unless the player is within aggro with line of sight. Siege and sapper units use a tighter aggro disc. Wards screen nearby arrow/javelin/sentry allies.

Each enemy id has a unique `textureKey` (`enemy_<id>`) and four facing PNGs in `public/assets/sprites/enemies/<id>/`.

If a night is missing from JSON, `DataStore.getWaveForNight` falls back to the highest defined night ≤ requested night, then night `1`.