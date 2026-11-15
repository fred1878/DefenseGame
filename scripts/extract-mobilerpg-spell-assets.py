#!/usr/bin/env python3
"""
Slice MobileRPG spell icons + FX from atlas.tga using the same BGRA decode as the game.

Atlas source (not committed — ~4 MiB):
  export MOBILERPG_ATLAS_TGA=/path/to/MobileRPG/assets/atlas.tga
  default: /tmp/mobilerpg-assets/atlas.tga

Optional recovery from a raw GitHub MCP download (strip embedded newlines, truncate to 1024²×4):
  export MOBILERPG_ATLAS_SPILL=/path/to/atlas.tga.tool-spill
"""

from __future__ import annotations

import os
import struct
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "scripts"))
from tga_atlas_io import read_tga_region_rgba  # noqa: E402

OUT_ICONS = REPO / "public/assets/spells/icons"
OUT_FX = REPO / "public/assets/spells/fx"

FRAMES: dict[str, tuple[int, int, int, int]] = {
    "icon_spell_00": (256, 64, 32, 32),
    "icon_spell_01": (288, 64, 32, 32),
    "icon_spell_02": (320, 64, 32, 32),
    "icon_spell_03": (352, 64, 32, 32),
    "icon_spell_04": (256, 96, 32, 32),
    "icon_spell_05": (288, 96, 32, 32),
    "icon_spell_06": (320, 96, 32, 32),
    "icon_spell_07": (352, 96, 32, 32),
    "icon_spell_08": (256, 128, 32, 32),
    "icon_spell_09": (288, 128, 32, 32),
    "icon_spell_10": (320, 128, 32, 32),
    "icon_spell_11": (352, 128, 32, 32),
    "icon_spell_12": (384, 608, 32, 32),
    "icon_spell_13": (448, 608, 32, 32),
    "icon_spell_14": (384, 576, 32, 32),
    "icon_spell_15": (448, 576, 32, 32),
    "icon_spell_16": (384, 640, 32, 32),
    "fx_fire_bolt_0": (672, 544, 16, 16),
    "fx_ice_bolt_1": (720, 560, 16, 16),
    "fx_lightning_bolt_1": (768, 560, 16, 16),
    "fx_water_bolt_1": (816, 560, 16, 16),
    "fx_arc_bomb_1": (864, 560, 16, 16),
    "fire_nova_01": (256, 320, 64, 64),
    "fx_shockwave": (192, 0, 64, 64),
    "blizzard_01": (0, 384, 32, 32),
}

# spell_id -> atlas frame name
SPELL_ICON_OUT: dict[str, str] = {
    "fire_bolt": "icon_spell_00",
    "ice_bolt": "icon_spell_01",
    "lightning_bolt": "icon_spell_02",
    "water_bolt": "icon_spell_03",
    "arc_bomb": "icon_spell_14",
    "swing": "icon_spell_04",
    "rend": "icon_spell_05",
    "cone_of_cold": "icon_spell_15",
    "cone_of_fire": "icon_spell_07",
    "fire_blast": "icon_spell_12",
    "fire_nova": "icon_spell_09",
    "blizzard": "icon_spell_10",
    "meteor": "icon_spell_11",
    "frost_nova": "icon_spell_06",
    "ice_wall": "icon_spell_01",
    "flamestrike": "icon_spell_08",
    "shadowform": "icon_spell_13",
    "deep_freeze": "icon_spell_16",
    "chain_lightning": "icon_spell_02",
    "blink": "icon_spell_12",
    "combustion": "icon_spell_00",
    # No dedicated heal spell in MobileRPG — interim slice documented in port plan.
    "heal": "icon_spell_08",
}

FX_OUT: dict[str, str] = {
    "fire-bolt-mrpg-16.png": "fx_fire_bolt_0",
    "ice-bolt-mrpg-16.png": "fx_ice_bolt_1",
    "lightning-bolt-mrpg-16.png": "fx_lightning_bolt_1",
    "water-bolt-mrpg-16.png": "fx_water_bolt_1",
    "arc-bomb-mrpg-16.png": "fx_arc_bomb_1",
    "fire-nova-mrpg-64.png": "fire_nova_01",
    "shockwave-mrpg-64.png": "fx_shockwave",
    "blizzard-mrpg-32.png": "blizzard_01",
}


def materialize_atlas(path: Path) -> Path:
    spill = os.environ.get("MOBILERPG_ATLAS_SPILL")
    if spill and Path(spill).is_file():
        raw = Path(spill).read_bytes().replace(b"\n", b"")
        w, h = struct.unpack_from("<HH", raw, 12)
        need = 18 + w * h * 4
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw[:need])
    if not path.is_file():
        raise SystemExit(
            f"Missing atlas at {path}. Set MOBILERPG_ATLAS_TGA or MOBILERPG_ATLAS_SPILL.",
        )
    return path


def save_rgba(rgba: bytes, w: int, h: int, dest: Path, scale: int = 1) -> None:
    img = Image.frombytes("RGBA", (w, h), rgba)
    if scale != 1:
        img = img.resize((w * scale, h * scale), Image.Resampling.NEAREST)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, format="PNG")


def main() -> int:
    atlas_path = materialize_atlas(
        Path(os.environ.get("MOBILERPG_ATLAS_TGA", "/tmp/mobilerpg-assets/atlas.tga")),
    )

    for spell_id, frame in SPELL_ICON_OUT.items():
        x, y, rw, rh = FRAMES[frame]
        rgba = read_tga_region_rgba(atlas_path, x, y, rw, rh)
        save_rgba(rgba, rw, rh, OUT_ICONS / f"{spell_id}.png", scale=2)

    for filename, frame in FX_OUT.items():
        x, y, rw, rh = FRAMES[frame]
        rgba = read_tga_region_rgba(atlas_path, x, y, rw, rh)
        save_rgba(rgba, rw, rh, OUT_FX / filename)

    print(f"wrote icons -> {OUT_ICONS}")
    print(f"wrote fx -> {OUT_FX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())