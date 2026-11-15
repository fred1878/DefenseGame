"""Parse MobileRPG assets/atlas.txt frame rects (top-left origin, matches tga_atlas_io)."""

from __future__ import annotations

import re
from pathlib import Path

_FRAME_RE = re.compile(r"^frame\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$")


def parse_atlas_frames(path: Path) -> dict[str, tuple[int, int, int, int]]:
    frames: dict[str, tuple[int, int, int, int]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith("frame "):
            continue
        m = _FRAME_RE.match(line)
        if not m:
            continue
        name, x, y, w, h = m.groups()
        frames[name] = (int(x), int(y), int(w), int(h))
    return frames


def resolve_frame(
    frame: str,
    frames: dict[str, tuple[int, int, int, int]],
    fallbacks: dict[str, str],
) -> tuple[str, tuple[int, int, int, int]]:
    """Return (resolved_name, rect), following fallbacks when the primary slot is bad."""
    chain = [frame]
    seen = {frame}
    while frame in fallbacks:
        frame = fallbacks[frame]
        if frame in seen:
            raise ValueError(f"fallback cycle at {frame}")
        seen.add(frame)
        chain.append(frame)
    resolved = chain[-1]
    rect = frames.get(resolved)
    if rect is None:
        raise KeyError(f"missing atlas frame {resolved!r} (from {chain[0]!r})")
    return resolved, rect