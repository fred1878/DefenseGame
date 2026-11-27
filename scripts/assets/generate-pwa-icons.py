#!/usr/bin/env python3
"""Generate PWA icons from the player south-facing sprite.

Requires Pillow. Icons are committed under public/icons/; this script is only
needed when regenerating them.

  python3 scripts/assets/generate-pwa-icons.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / "public/assets/sprites/player_s.png"
OUT_DIR = REPO / "public/icons"
BACKGROUND = (15, 16, 20, 255)  # #0f1014, matches the game splash

# (filename, canvas size, target sprite size on the canvas)
# Maskable icons keep the sprite inside the 80% safe zone.
TARGETS = (
    ("icon-192.png", 192, 128),
    ("icon-512.png", 512, 384),
    ("icon-192-maskable.png", 192, 128),
    ("icon-512-maskable.png", 512, 320),
    ("apple-touch-icon.png", 180, 128),
)


def compose(source: Image.Image, size: int, sprite_target: int) -> Image.Image:
    scale = max(1, sprite_target // source.width)
    scaled = source.resize(
        (source.width * scale, source.height * scale),
        Image.Resampling.NEAREST,
    )
    canvas = Image.new("RGBA", (size, size), BACKGROUND)
    x = (size - scaled.width) // 2
    y = (size - scaled.height) // 2
    canvas.alpha_composite(scaled, (x, y))
    # Opaque: iOS home-screen icons and Android maskable adaptive icons
    # do not composite transparency reliably.
    return canvas.convert("RGB")


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, size, sprite_target in TARGETS:
        dest = OUT_DIR / name
        compose(source, size, sprite_target).save(dest, format="PNG")
        print(f"wrote {dest.relative_to(REPO)} ({size}x{size})")


if __name__ == "__main__":
    main()
