/**
 * Plain-English explainer of the rarity / item level system, embedded in the
 * HTML report. Mirrors docs/ITEMS.md — keep both in sync with src/gear/ (itemGen, loot, shops, stats).
 */
export const ITEM_SYSTEM_HTML = `<h2>How rarity and item level work</h2>
<ul>
<li><b>Item level (ilvl)</b> is set where the item is made.
<ul>
<li>Night drops: won night = night + 0..1, lost night = night − 1..0 (min 1). Won nights roll 1–2 items; lost nights drop nothing (<code>nightLost.maxRolls</code> 0, <code>loot.json</code>).</li>
<li>Trader: 6 items at night + 0..2, sold at 125% (<code>shops.json</code>); upgrades raise this to 9 items at night + 0..3, 105%, better rarities and a paid reroll.</li>
<li>Blacksmith: fixed list unlocked by night; each is a <i>common</i> with no affixes at the base's own <code>minItemLevel</code>, sold at 100%. Upgrades add 1–3 rolled <i>masterwork</i> items (magic+ at night + 0..2), a 10–20% discount and earlier unlocks.</li>
</ul></li>
<li><b>Rarity</b> is a weighted roll. Drops use the <code>rarityByLevel</code> band with the highest <code>fromLevel</code> ≤ ilvl (missing rarities = weight 0); shops use their own weights (trader 15/52/25/7/1 at L0; missing rarities also 0). Rarities have a minimum ilvl: rare 3, epic 6, legendary 8. Legendary is uniques-only: it needs a unique whose item level ≤ the item's ilvl, otherwise it becomes epic.</li>
<li><b>Base</b>: uniform among bases with <code>minItemLevel</code> ≤ ilvl; bases 5+ levels below ilvl get weight 0.35.</li>
<li><b>Affixes</b>: common 0, magic 1–2, rare 2–3, epic 3–4; at most 2 prefixes + 2 suffixes, no duplicates, weighted by affix weight. Value = random integer inside the <i>highest tier unlocked</i> at the ilvl (tiers usually start at ilvl 1/4/7/10; elemental and proc affixes at 2/5/8). So ilvl decides how strong affixes can be, rarity decides how many.</li>
<li><b>Caps</b>: attack speed 100%, move speed 40%, lifesteal 25%, spell cooldown 60%; armour reduction = armour / (armour + 60), max 75%.</li>
<li><b>Uniques</b> have a fixed item level, fixed stats and fixed price (400–480g).</li>
<li><b>Price</b> = base price × rarity multiplier (1 / 1.5 / 2.2 / 3.2) × (1 + 8% × (ilvl − base minItemLevel)), rounded. Shop price = price × shop % (trader 125, blacksmith 100). Selling pays floor(price × 30%).</li>
</ul>`;
