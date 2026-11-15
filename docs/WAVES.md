# Wave progression (`public/data/waves.json`)

Night keys match `save.night` when defense starts. Winning a night increments `save.night`.

Counts below are per-night totals (grunt groups summed). ~30% more enemies than the baseline mix; **`bruiser`** (slow polearm melee) appears from night **3** onward.

| Night | rewardGold | Summary |
|------:|-----------:|---------|
| 1 | 40 | 7× grunt; 1 archer + 1 javelineer (late) |
| 2 | 55 | 11× grunt; 1 archer + 1 javelineer |
| 3 | 70 | 13× grunt; 1 bruiser; 1 archer + 1 javelineer |
| 4 | 85 | 13× grunt; 2 bruisers; 3 archers + 2 javelineers |
| 5 | 100 | 15× grunt; 2 bruisers; 3 archers + 3 javelineers |
| 6 | 115 | 18× grunt; 3 bruisers; 3 archers + 3 javelineers |
| 7 | 130 | 21× grunt; 3 bruisers; 4 archers + 3 javelineers |
| 8 | 150 | 31× grunt; 4 bruisers; 4 archers + 4 javelineers |
| 9 | 175 | 26× grunt; 4 bruisers; 4 archers + 5 javelineers |
| 10 | 200 | 21× grunt, 5 bruisers, 5× archer, 6× javelineer (milestone) |

Nights **1–10** each include at least one `arrow_rain_archer` and one `javelineer` group; counts and intervals ramp toward night 10’s mix. Grunts remain the backbone every night.

Grunts and bruisers spawn around the map edges and path toward the **north wall** unless the player is within aggro range with line of sight. Bruisers use the grunt sprite as a placeholder until dedicated art lands.

If a night is missing from JSON, `DataStore.getWaveForNight` falls back to the highest defined night ≤ requested night, then night `1`.