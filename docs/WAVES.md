# Wave progression (`public/data/waves.json`)

Night keys match `save.night` when defense starts. Winning a night increments `save.night`.

| Night | rewardGold | Summary |
|------:|-----------:|---------|
| 1 | 40 | 5× grunt @ 0ms, 700ms stagger |
| 2 | 55 | 8× grunt, 550ms stagger |
| 3 | 70 | 6× grunt + 4× grunt @ 4s |
| 4 | 85 | 10× grunt, 450ms stagger |
| 5 | 100 | 12× grunt + 2× burst @ 8s |
| 6 | 115 | 14× grunt |
| 7 | 130 | 16× grunt, 350ms stagger |
| 8 | 150 | 18× grunt + 6× @ 6s |
| 9 | 175 | 20× grunt |
| 10 | 200 | 12× + 12× dual groups (milestone) |

All groups use `enemyId: "grunt"` until more enemy types exist. Tuning draft: Project store `docs/wave-progression-draft.md`.

Grunts spawn around the map edges and path toward the **north wall** unless the player is within aggro range with line of sight.

If a night is missing from JSON, `DataStore.getWaveForNight` falls back to the highest defined night ≤ requested night, then night `1`.