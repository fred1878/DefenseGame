#!/usr/bin/env python3
"""
Slice MobileRPG spell icons + FX from atlas.tga using atlas.txt rects + spells_data iconFrame.

Atlas source (not committed — ~4 MiB):
  export MOBILERPG_ATLAS_TGA=/path/to/MobileRPG/assets/atlas.tga
  default: /tmp/mobilerpg-assets/atlas.tga

Fetch pristine atlas first (avoids MCP UTF-8 corruption on large binaries):
  export MOBILERPG_GITHUB_TOKEN=<pat with MobileRPG read>
  python3 scripts/assets/fetch-mobilerpg-atlas-blob.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from mobilerpg_atlas_frames import parse_atlas_frames, resolve_frame  # noqa: E402
from tga_atlas_io import read_tga_region_rgba  # noqa: E402

OUT_ICONS = REPO / "public/assets/spells/icons"
OUT_FX = REPO / "public/assets/spells/fx"

DEFAULT_ATLAS_TXT = REPO / "scripts/data/mobilerpg-atlas.txt"

# iconFrame from MobileRPG src/spells_data.c (DefenseGame spell id -> atlas frame name)
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
    # Defense-only — no MobileRPG spell row; use world pickup health art.
    "heal": "pickup_health_0",
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

# Optional strip export for Boot-time blizzard channel anim (blizzard_01 … blizzard_10).
BLIZZARD_ANIM_FRAMES = [f"blizzard_{i:02d}" for i in range(1, 11)]

# Optional fallbacks when a spell's primary icon rect in atlas.txt is stale.
ICON_FRAME_FALLBACK: dict[str, str] = {}


def materialize_atlas(path: Path) -> Path:
    if not path.is_file():
        raise SystemExit(
            f"Missing atlas at {path}. Run scripts/assets/fetch-mobilerpg-atlas-blob.py "
            "then set MOBILERPG_ATLAS_TGA.",
        )
    raw = path.read_bytes()
    if raw.count(b"\xef\xbf\xbd") > 0:
        raise SystemExit(
            f"Corrupt atlas at {path} (UTF-8 replacement bytes). "
            "Re-fetch with scripts/assets/fetch-mobilerpg-atlas-blob.py.",
        )
    if len(raw) != 4194348:
        raise SystemExit(
            f"Unexpected atlas size {len(raw)} (expected 4194348). Re-fetch pristine blob.",
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
    atlas_txt = Path(
        os.environ.get("MOBILERPG_ATLAS_TXT", DEFAULT_ATLAS_TXT),
    )
    if not atlas_txt.is_file():
        raise SystemExit(f"Missing atlas.txt at {atlas_txt}")
    frames = parse_atlas_frames(atlas_txt)

    for spell_id, frame in SPELL_ICON_OUT.items():
        _resolved, (x, y, rw, rh) = resolve_frame(
            frame, frames, ICON_FRAME_FALLBACK,
        )
        rgba = read_tga_region_rgba(atlas_path, x, y, rw, rh)
        save_rgba(rgba, rw, rh, OUT_ICONS / f"{spell_id}.png", scale=2)

    for filename, frame in FX_OUT.items():
        if frame not in frames:
            raise SystemExit(f"FX frame {frame!r} missing from {atlas_txt}")
        x, y, rw, rh = frames[frame]
        rgba = read_tga_region_rgba(atlas_path, x, y, rw, rh)
        save_rgba(rgba, rw, rh, OUT_FX / filename)

    strip_path = OUT_FX / "blizzard-mrpg-anim-32.png"
    if all(name in frames for name in BLIZZARD_ANIM_FRAMES):
        slices: list[Image.Image] = []
        for name in BLIZZARD_ANIM_FRAMES:
            x, y, rw, rh = frames[name]
            rgba = read_tga_region_rgba(atlas_path, x, y, rw, rh)
            slices.append(Image.frombytes("RGBA", (rw, rh), rgba))
        w, h = slices[0].size
        sheet = Image.new("RGBA", (w * len(slices), h))
        for i, img in enumerate(slices):
            sheet.paste(img, (i * w, 0))
        strip_path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(strip_path, format="PNG")
        print(f"wrote blizzard anim strip -> {strip_path}")

    print(f"atlas.txt: {atlas_txt}")
    print(f"wrote icons -> {OUT_ICONS}")
    print(f"wrote fx -> {OUT_FX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())