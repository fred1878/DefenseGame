#!/usr/bin/env python3
"""One-off: slice MobileRPG atlas.tga (already fetched) into DefenseGame public spell assets."""

from __future__ import annotations

import struct
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
ATLAS_TGA = Path("/tmp/mobilerpg-assets/atlas.tga")
OUT_ICONS = REPO / "public/assets/spells/icons"
OUT_FX = REPO / "public/assets/spells/fx"

# From fred1878/MobileRPG assets/atlas.txt (1024×1024 atlas)
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
    "proj_fire_bolt": (672, 544, 16, 16),
    "proj_ice_bolt": (720, 560, 16, 16),
    "proj_lightning_bolt": (768, 560, 16, 16),
    "proj_water_bolt": (816, 560, 16, 16),
    "proj_arc_bomb": (864, 560, 16, 16),
    "fire_nova_01": (256, 320, 64, 64),
    "fx_shockwave": (192, 0, 64, 64),
    "blizzard_01": (0, 384, 32, 32),
}

SPELL_ICON_OUT = {
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
    "heal": "icon_spell_08",
}


def read_tga_rgba(path: Path) -> tuple[int, int, bytes]:
    data = path.read_bytes()
    id_len = data[0]
    if data[2] != 2:
        raise RuntimeError(f"unsupported TGA type in {path}")
    w, h = struct.unpack_from("<HH", data, 12)
    depth = data[16]
    desc = data[17]
    offset = 18 + id_len
    px = depth // 8
    top_left = (desc & 0x20) != 0
    rgba = bytearray(w * h * 4)
    for y in range(h):
        src_y = y if top_left else (h - 1 - y)
        for x in range(w):
            s = offset + (src_y * w + x) * px
            d = (y * w + x) * 4
            b, g, r = data[s], data[s + 1], data[s + 2]
            a = data[s + 3] if px == 4 else 255
            rgba[d : d + 4] = (r, g, b, a)
    return w, h, bytes(rgba)


def crop(rgba: bytes, atlas_w: int, x: int, y: int, rw: int, rh: int) -> bytes:
    out = bytearray(rw * rh * 4)
    for dy in range(rh):
        for dx in range(rw):
            sx, sy = x + dx, y + dy
            si = (sy * atlas_w + sx) * 4
            di = (dy * rw + dx) * 4
            out[di : di + 4] = rgba[si : si + 4]
    return bytes(out)


def save_region(
    rgba: bytes,
    atlas_w: int,
    frame: str,
    dest: Path,
    icon_scale: int | None = None,
) -> None:
    x, y, rw, rh = FRAMES[frame]
    chunk = crop(rgba, atlas_w, x, y, rw, rh)
    img = Image.frombytes("RGBA", (rw, rh), chunk)
    if icon_scale and icon_scale != 1:
        img = img.resize((rw * icon_scale, rh * icon_scale), Image.NEAREST)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest)


def main() -> None:
    if not ATLAS_TGA.is_file():
        raise SystemExit(f"missing atlas: {ATLAS_TGA}")
    aw, ah, rgba = read_tga_rgba(ATLAS_TGA)
    if aw != 1024 or ah != 1024:
        raise SystemExit(f"unexpected atlas size {aw}x{ah}")

    for spell_id, frame in SPELL_ICON_OUT.items():
        save_region(
            rgba,
            aw,
            frame,
            OUT_ICONS / f"{spell_id}.png",
            icon_scale=2,
        )

    fx_out = {
        "fire-bolt-mrpg-16.png": "proj_fire_bolt",
        "ice-bolt-mrpg-16.png": "proj_ice_bolt",
        "lightning-bolt-mrpg-16.png": "proj_lightning_bolt",
        "water-bolt-mrpg-16.png": "proj_water_bolt",
        "arc-bomb-mrpg-16.png": "proj_arc_bomb",
        "fire-nova-mrpg-64.png": "fire_nova_01",
        "shockwave-mrpg-64.png": "fx_shockwave",
        "blizzard-mrpg-32.png": "blizzard_01",
    }
    for filename, frame in fx_out.items():
        save_region(rgba, aw, frame, OUT_FX / filename)

    print(f"wrote icons to {OUT_ICONS}")
    print(f"wrote fx to {OUT_FX}")


if __name__ == "__main__":
    main()