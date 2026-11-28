/**
 * Plain-English explainer of the rarity / item level system, embedded in the
 * HTML report. Mirrors docs/ITEMS.md — keep both in sync with src/gear/ (itemGen, loot, shops, itemStats).
 */
export const ITEM_SYSTEM_HTML = `<h2>How rarity and item level work</h2>
<ul>
<li><b>Item level (ilvl)</b> is set where the item is made.
<ul>
<li>Night drops: won night = night − 1..0, lost night = night − 1..0 (min 1). Won nights roll 1 item (80%) or 2 (20%); lost nights drop nothing (<code>nightLost.maxRolls</code> 0, <code>loot.json</code>).</li>
<li>Trader: 6 items at night + 0..2, sold at 125% (<code>shops.json</code>); upgrades raise this to 9 items at night + 0..3, 105%, better rarities and a paid reroll (20/18/15g). Each night the trader also posts 3–4 buy requests (a base, a slot at a minimum rarity, or a unique, rolled from every item in the game) that pay 150% of a matching bag item's value.</li>
<li>Blacksmith: fixed list unlocked by night; each is a <i>common</i> with no affixes at the base's own <code>minItemLevel</code>, sold at 100%. Upgrades add 1–3 rolled <i>masterwork</i> items (magic+ at night + 0..2), a 10–20% discount and earlier unlocks.</li>
</ul></li>
<li><b>Rarity</b> is a weighted roll. Drops use the <code>rarityByLevel</code> band with the highest <code>fromLevel</code> ≤ ilvl (missing rarities = weight 0); shops use their own weights (trader 15/52/25/7/1 at L0; missing rarities also 0). Rarities have a minimum ilvl: rare 3, epic 6, legendary 8.</li>
<li><b>Uniques</b>: <code>uniqueChanceByRarity</code> gives each rarity a percent chance to be an authored unique of that rarity instead of a base with affixes (magic 3, rare 8, epic 18, legendary 100; common never). A unique needs a level gate ≤ ilvl and a base of the rolled type, keeps the rolled item level, and keeps its fixed stats and price. A 100% rarity is uniques-only and is skipped when no unique fits, so legendary falls back to epic.</li>
<li><b>Base</b>: uniform among bases with <code>minItemLevel</code> ≤ ilvl, then staleness tapers the weight: 1 up to 3 levels below ilvl, 0.5 at 4, 0.375 at 5, 0.25 at 6, 0.125 at 7 and 0 from 8 down.</li>
<li><b>Affixes</b>: common 0, magic 1–2, rare 2–3, epic 3–4; at most 2 prefixes + 2 suffixes, no duplicates, weighted by affix weight. Value = random integer inside the <i>highest tier unlocked</i> at the ilvl (tiers usually start at ilvl 1/4/7/10/13/16/19; elemental and proc affixes at 2/5/8/11/15/19). So ilvl decides how strong affixes can be, rarity decides how many.</li>
<li><b>Caps</b>: attack speed 100%, move speed 40%, lifesteal 25%, spell cooldown 60%; armour reduction = armour / (armour + 60), max 75%.</li>
<li><b>Uniques</b> exist at magic, rare, epic and legendary tiers: 6 / 6 / 6 / 11 authored items with fixed stats and fixed price (70–620g by tier), available from their own item level up. A unique only rolls at its own rarity, and their effects go beyond stats: procs from armour slots, two procs on one weapon, all-spell cooldowns, named-spell damage, wider swing arcs and longer ranged reach.</li>
<li><b>Price</b> = base price × rarity multiplier (1 / 1.5 / 2.2 / 3.2) × (1 + 8% × (ilvl − base minItemLevel)), rounded. Shop price = price × shop % (trader 125, blacksmith 100). Selling pays floor(price × 30%).</li>
</ul>`;
