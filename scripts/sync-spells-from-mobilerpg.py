#!/usr/bin/env python3
"""Merge MobileRPG timing/effect fields into public/data/spells.json (by spell name)."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPELLS_JSON = ROOT / "public" / "data" / "spells.json"

# DefenseGame id by MobileRPG .name (from spells_data.c)
NAME_TO_ID = {
    "Fire Bolt": "fire_bolt",
    "Ice Bolt": "ice_bolt",
    "Lightning Bolt": "lightning_bolt",
    "Water Bolt": "water_bolt",
    "Arc Bomb": "arc_bomb",
    "Swing": "swing",
    "Rend": "rend",
    "Cone Of Cold": "cone_of_cold",
    "Cone Of Fire": "cone_of_fire",
    "Fire Blast": "fire_blast",
    "Fire Nova": "fire_nova",
    "Blizzard": "blizzard",
    "Meteor": "meteor",
    "Frost Nova": "frost_nova",
    "Ice Wall": "ice_wall",
    "Flamestrike": "flamestrike",
    "Shadowform": "shadowform",
    "Deep Freeze": "deep_freeze",
    "Chain Lightning": "chain_lightning",
    "Blink": "blink",
    "Combustion": "combustion",
}

# Spell types that use duration as channel time (hero holds still).
CHANNELED_TYPES = {
    "SPELL_CHANNELED",
    "SPELL_CHANNELED_STARTUP_AREA_DOT",
}

GROUND_TARGET_TYPES = {
    "SPELL_CHANNELED_STARTUP_AREA_DOT",
    "SPELL_BLAST",  # meteor (non center)
}

FLOAT_RE = re.compile(r"[-+]?(?:\d+\.\d+|\d+|\.\d+)")
NAME_RE = re.compile(r'\.name\s*=\s*"([^"]+)"')
TYPE_RE = re.compile(r"\.type\s*=\s*(SPELL_\w+)")
COOLDOWN_RE = re.compile(r"\.cooldown\s*=\s*([-+.\d]+)f?")
STARTUP_RE = re.compile(r"\.startupDuration\s*=\s*([-+.\d]+)f?")
DURATION_RE = re.compile(r"\.duration\s*=\s*([-+.\d]+)f?")
CENTER_RE = re.compile(r"\.centerOnCaster\s*=\s*(true|false)")
RANGE_RE = re.compile(r"\.range\s*=\s*([-+.\d]+)f?")
EXPLOSION_RE = re.compile(r"\.explosionRadius\s*=\s*([-+.\d]+)f?")
HITBOX_R_RE = re.compile(
    r"\.hitbox\s*=\s*\{[^}]*\.radius\s*=\s*([-+.\d]+)f?",
    re.DOTALL,
)
BASE_DMG_RE = re.compile(r"\.baseDamage\s*=\s*(\d+)")
BURST_RE = re.compile(r"\.burstDamage\s*=\s*(\d+)")
SLOW_PCT_RE = re.compile(r"\.slowPct\s*=\s*([-+.\d]+)f?")
SLOW_DUR_RE = re.compile(r"\.slowDuration\s*=\s*([-+.\d]+)f?")
DOT_DPS_RE = re.compile(r"\.dotDps\s*=\s*([-+.\d]+)f?")
DOT_DUR_RE = re.compile(r"\.dotDuration\s*=\s*([-+.\d]+)f?")
ROOT_DUR_RE = re.compile(r"\.rootDuration\s*=\s*([-+.\d]+)f?")


def parse_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    depth = 0
    start = None
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                blocks.append(text[start : i + 1])
                start = None
    return blocks


def first_float(block: str, pattern: re.Pattern[str]) -> float | None:
    m = pattern.search(block)
    return float(m.group(1)) if m else None


def first_int(block: str, pattern: re.Pattern[str]) -> int | None:
    m = pattern.search(block)
    return int(m.group(1)) if m else None


def sec_to_ms(v: float | None) -> int:
    if v is None or v <= 0:
        return 0
    return int(round(v * 1000))


def target_mode(spell_type: str, center: bool, name: str) -> str:
    if name == "Heal":
        return "self"
    if spell_type == "SPELL_BLINK" or spell_type == "SPELL_SHADOWFORM":
        return "self"
    if spell_type in ("SPELL_INSTANT_TARGETED", "SPELL_TRACKING_PROJECTILE", "SPELL_TRACKING_SWING"):
        return "enemy"
    if spell_type in GROUND_TARGET_TYPES and not center:
        return "ground"
    if spell_type == "SPELL_CHANNELED" and not center:
        return "ground"
    return "none"


def main() -> None:
    c_path = ROOT / "scripts" / "data" / "mobilerpg-spells_data.c"
    if not c_path.exists():
        raise SystemExit(
            f"Missing {c_path}; copy MobileRPG src/spells_data.c there (see docs/mobilerpg-spell-port-plan.md).",
        )
    text = c_path.read_text(encoding="utf-8", errors="replace")
    parsed: dict[str, dict] = {}
    for block in parse_blocks(text):
        nm = NAME_RE.search(block)
        if not nm:
            continue
        name = nm.group(1)
        spell_id = NAME_TO_ID.get(name)
        if not spell_id:
            continue
        spell_type = TYPE_RE.search(block)
        st = spell_type.group(1) if spell_type else ""
        center_m = CENTER_RE.search(block)
        center = center_m.group(1) == "true" if center_m else False
        cooldown_ms = sec_to_ms(first_float(block, COOLDOWN_RE))
        cast_ms = sec_to_ms(first_float(block, STARTUP_RE))
        dur_s = first_float(block, DURATION_RE) or 0.0
        channel_ms = sec_to_ms(dur_s) if st in CHANNELED_TYPES else 0
        linger_ms = sec_to_ms(dur_s) if st == "SPELL_CHANNELED_STARTUP_AREA_DOT" else 0
        if st == "SPELL_CHANNELED_STARTUP_AREA_DOT":
            # Area ticks during channel; dot lingers after via dotDuration.
            linger_ms = sec_to_ms(first_float(block, DOT_DUR_RE))
        blast = first_float(block, EXPLOSION_RE)
        if blast is None:
            blast = first_float(block, HITBOX_R_RE)
        ground_range = first_float(block, RANGE_RE)
        on_hit: dict = {}
        slow_pct = first_float(block, SLOW_PCT_RE)
        slow_ms = sec_to_ms(first_float(block, SLOW_DUR_RE))
        if slow_pct and slow_pct > 0 and slow_ms > 0:
            on_hit["slowPct"] = slow_pct
            on_hit["slowMs"] = slow_ms
        dot_dps = first_float(block, DOT_DPS_RE)
        dot_ms = sec_to_ms(first_float(block, DOT_DUR_RE))
        if dot_dps and dot_dps > 0 and dot_ms > 0:
            on_hit["dotDps"] = dot_dps
            on_hit["dotMs"] = dot_ms
        root_ms = sec_to_ms(first_float(block, ROOT_DUR_RE))
        if root_ms > 0:
            on_hit["rootMs"] = root_ms
        burst_dmg = first_int(block, BURST_RE)
        base_dmg = first_int(block, BASE_DMG_RE)
        row: dict = {
            "castMs": cast_ms,
            "channelMs": channel_ms,
            "cooldownMs": cooldown_ms or None,
            "targetMode": target_mode(st, center, name),
            "centerOnCaster": center,
            "channelTickMs": 250 if channel_ms > 0 or st == "SPELL_CHANNELED_STARTUP_AREA_DOT" else 0,
            "groundTargetMaxRangeWu": int(ground_range) if ground_range and ground_range > 0 else None,
        }
        if blast and blast > 0:
            row["blastRadius"] = int(round(blast))
        if burst_dmg and burst_dmg > 0:
            row["burstDamage"] = burst_dmg
        if linger_ms > 0 and st == "SPELL_CHANNELED_STARTUP_AREA_DOT":
            row["lingerMs"] = linger_ms
            row["lingerTickMs"] = 250
        if on_hit:
            row["onHit"] = on_hit
        if base_dmg is not None and name == "Combustion":
            row["burstDamage"] = burst_dmg or base_dmg
        parsed[spell_id] = {k: v for k, v in row.items() if v is not None and v != 0 and v is not False}

    data = json.loads(SPELLS_JSON.read_text(encoding="utf-8"))
    for spell in data["spells"]:
        sid = spell["id"]
        patch = parsed.get(sid)
        if not patch:
            continue
        for key, val in patch.items():
            if key == "cooldownMs" and val:
                spell["cooldownMs"] = val
            elif key == "channelMs":
                spell["channelMs"] = val
            else:
                spell[key] = val
    SPELLS_JSON.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {len(parsed)} spells in {SPELLS_JSON}")


if __name__ == "__main__":
    main()