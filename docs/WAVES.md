# Wave progression (`public/data/waves.json`)

Night keys match `save.night` when defense starts. Winning a night increments `save.night`.

| Night | rewardGold | Summary |
|------:|-----------:|---------|
| 1 | 40 | 5× grunt; 1 archer + 1 javelineer (late, long interval) |
| 2 | 55 | 8× grunt; 1 archer + 1 javelineer |
| 3 | 70 | 10× grunt; 1 archer + 1 javelineer |
| 4 | 85 | 10× grunt; 2 archers + 1 javelineer |
| 5 | 100 | 14× grunt; 2 archers + 2 javelineers |
| 6 | 115 | 14× grunt; 2 archers + 2 javelineers |
| 7 | 130 | 16× grunt; 3 archers + 2 javelineers |
| 8 | 150 | 24× grunt; 3 archers + 3 javelineers |
| 9 | 175 | 20× grunt; 3 archers + 4 javelineers |
| 10 | 200 | 8+8 grunts, 4× archer, 5× javelineer (milestone) |

Nights **1–10** each include at least one `arrow_rain_archer` and one `javelineer` group; counts and intervals ramp from 1+1 on early nights toward night 10’s mix. Grunts remain the backbone every night.

Grunts spawn around the map edges and path toward the **north wall** unless the player is within aggro range with line of sight.

If a night is missing from JSON, `DataStore.getWaveForNight` falls back to the highest defined night ≤ requested night, then night `1`.