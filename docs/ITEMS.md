# Items: rarity and item level

How gear is generated, read straight from `src/gear/` (`itemGen.ts`, `loot.ts`,
`shops.ts`, `stats.ts`) and the data in `public/data/items.json`, `loot.json`
and `shops.json`. The economy sim's HTML report embeds the same summary
(`src/sim/economy/itemSystem.ts`); update both if the rules change.

## 1. Item level (ilvl): where it comes from

| Source | Item level | Rarity weights | Price paid |
|---|---|---|---|
| Night won | night + 0..1 (`nightWon.min/maxItemLevelOffset`), 1–2 items | `nightWon.rarityByLevel` | – |
| Night lost | night − 1..0 (min 1), 0–1 items | `nightLost.rarityByLevel` | – |
| Trader | night + 0..2, 6 items per restock | `shops.trader.rarityWeights` (15/52/25/7/1) | 125% |
| Blacksmith | the base's own `minItemLevel` (always common, no affixes), unlocked by `unlockNight` | – | 100% |

Item level controls three things: which bases can roll, which rarities are
allowed, and how strong affix values are. It also raises the price.

## 2. Rarity

1. **Weights.** Drops look up the `rarityByLevel` band with the highest
   `fromLevel` ≤ ilvl (bands are keyed by *item* level, not night). A rarity
   missing from the band has weight 0. The trader uses its fixed weights. With
   no weights given, `items.json` rarity `weight` is used (60/28/9/2.5/0.5).
2. **Minimum item level.** Rarities above the ilvl are removed: rare needs 3,
   epic 6, legendary 8.
3. **Legendary = unique.** `legendary.uniquesOnly`: the item becomes a unique
   picked uniformly from uniques whose `itemLevel` ≤ the ilvl. If none fits it
   falls back to epic.

Current drop bands (`loot.json`, won night): ilvl 1+ 70/30 common/magic;
3+ adds 12% rare; 6+ 35/40/20/5 with epic; 9+ 25/40/25/8/2 with legendary.
Lost nights: ilvl 1+ 80/20, 4+ 60/32/8.

## 3. Base item

Uniform among bases with `minItemLevel` ≤ ilvl. Bases 5 or more levels
below the ilvl are "outdated" and get weight 0.35, so higher ilvl favours
newer bases without removing old ones.

## 4. Affixes

| Rarity | Affixes | Price × |
|---|---|---|
| Common | 0 | 1 |
| Magic | 1–2 | 1.5 |
| Rare | 2–3 | 2.2 |
| Epic | 3–4 | 3.2 |
| Legendary (unique) | fixed stats | fixed price |

- At most 2 prefixes and 2 suffixes, no duplicate affix, chosen by affix
  `weight` among affixes allowed on the slot.
- **Value:** each affix has tiers with a `minItemLevel`. The item uses the
  **highest tier unlocked at its ilvl** and rolls a whole number in that
  tier's range. Most affixes unlock tiers at ilvl 1/4/7/10; elemental and
  on-hit proc affixes at 2/5/8. So *rarity decides how many affixes, item
  level decides how big they are.*
- If a magic+ item can't roll any affix it is downgraded to common.
- Spell affixes (e.g. "+% damage to a spell") pick a random spell from
  their list.

## 5. Stat caps

Attack speed 100% (attack timings are divided, multiplier floor 0.25), move
speed 40%, lifesteal 25%, spell cooldown 60%. Armour gives
`armour / (armour + 60)` damage reduction, capped at 75%.

## 6. Price

```
price = round(basePrice × rarity.priceMul × (1 + itemLevelPriceStepPct/100 × (ilvl − base.minItemLevel)))   (min 1)
uniques: their fixed price (400–480g)
shop price = round(price × shop.priceMulPct / 100)   (min 1)
sell value = floor(price × loot.sellBackPct / 100)     (50%)
```

`itemLevelPriceStepPct` is 8, so each level above the base's minimum adds 8%
of the base price.
