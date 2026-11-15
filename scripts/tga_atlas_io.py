#!/usr/bin/env python3
"""
MobileRPG-compatible TGA read (matches src/assets.c + assets/tools/tga_atlas_io.py).

- On disk: BGRA, type 2 (raw) or type 10 (RLE), top-left origin when descriptor bit 0x20 set.
- In memory: RGBA row-major, y=0 is top (atlas.txt frame y matches these x,y).
"""

from __future__ import annotations

import struct
from pathlib import Path


def _decode_rle_rgba32(src: bytes, src_pos: int, pixel_count: int) -> bytes:
    out = bytearray(pixel_count * 4)
    out_i = 0
    pos = src_pos
    src_len = len(src)
    while out_i < pixel_count * 4:
        if pos >= src_len:
            raise RuntimeError("RLE truncated")
        header = src[pos]
        pos += 1
        count = (header & 0x7F) + 1
        if header & 0x80:
            if pos + 4 > src_len:
                raise RuntimeError("RLE run truncated")
            b, g, r, a = src[pos], src[pos + 1], src[pos + 2], src[pos + 3]
            pos += 4
            for _ in range(count):
                out[out_i : out_i + 4] = (b, g, r, a)
                out_i += 4
        else:
            nbytes = count * 4
            if pos + nbytes > src_len:
                raise RuntimeError("RLE raw packet truncated")
            out[out_i : out_i + nbytes] = src[pos : pos + nbytes]
            out_i += nbytes
            pos += nbytes
    return bytes(out)


def read_tga_rgba(path: str | Path) -> tuple[int, int, bytes]:
    """Decode full 32-bit TGA (type 2 or 10) to RGBA."""
    data = Path(path).read_bytes()
    if len(data) < 18:
        raise RuntimeError(f"TGA too small: {path}")
    id_len = data[0]
    image_type = data[2]
    width, height = struct.unpack_from("<HH", data, 12)
    depth = data[16]
    desc = data[17]
    if image_type not in (2, 10):
        raise RuntimeError(f"Unsupported TGA type {image_type} in {path}")
    if depth != 32:
        raise RuntimeError(f"Unsupported TGA depth {depth} in {path}")
    offset = 18 + id_len
    pixel_count = width * height
    if image_type == 2:
        need = pixel_count * 4
        if len(data) < offset + need:
            raise RuntimeError(f"TGA payload truncated in {path}")
        bgra = data[offset : offset + need]
    else:
        bgra = _decode_rle_rgba32(data, offset, pixel_count)

    top_left = (desc & 0x20) != 0
    rgba = bytearray(pixel_count * 4)
    for y in range(height):
        src_y = y if top_left else (height - 1 - y)
        for x in range(width):
            si = (src_y * width + x) * 4
            di = (y * width + x) * 4
            b, g, r, a = bgra[si], bgra[si + 1], bgra[si + 2], bgra[si + 3]
            rgba[di : di + 4] = (r, g, b, a)
    return width, height, bytes(rgba)


def read_tga_region_rgba(
    path: str | Path, x: int, y: int, w: int, h: int
) -> bytes:
    """Read atlas frame rect in atlas.txt coordinates (top-left origin)."""
    data = Path(path).read_bytes()
    if len(data) < 18:
        raise RuntimeError(f"TGA too small: {path}")
    id_len = data[0]
    image_type = data[2]
    if image_type not in (2, 10):
        raise RuntimeError(f"TGA type {image_type} unsupported in {path}")
    width, height = struct.unpack_from("<HH", data, 12)
    depth = data[16]
    desc = data[17]
    if depth != 32:
        raise RuntimeError(f"TGA depth {depth} unsupported")
    offset = 18 + id_len
    pixel_count = width * height
    if image_type == 2:
        if len(data) < offset + pixel_count * 4:
            raise RuntimeError("TGA raw payload truncated")
        bgra = data[offset : offset + pixel_count * 4]
    else:
        bgra = _decode_rle_rgba32(data, offset, pixel_count)

    top_left = (desc & 0x20) != 0
    out = bytearray(w * h * 4)
    for dy in range(h):
        sy = y + dy
        if not top_left:
            sy = height - 1 - sy
        for dx in range(w):
            sx = x + dx
            si = (sy * width + sx) * 4
            di = (dy * w + dx) * 4
            out[di + 0] = bgra[si + 2]
            out[di + 1] = bgra[si + 1]
            out[di + 2] = bgra[si + 0]
            out[di + 3] = bgra[si + 3]
    return bytes(out)