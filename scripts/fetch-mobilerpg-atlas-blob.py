#!/usr/bin/env python3
"""
Download pristine MobileRPG assets/atlas.tga via the GitHub Git Blob API (base64 JSON).

Do NOT use cursor-github get_file_contents on atlas.tga — large binaries are written
through a UTF-8 path and pick up U+FFFD bytes (corrupt slices / rainbow spell icons).

Requires a PAT with read access to fred1878/MobileRPG:
  export MOBILERPG_GITHUB_TOKEN=<pat>
  python3 scripts/fetch-mobilerpg-atlas-blob.py
  export MOBILERPG_ATLAS_TGA=/tmp/mobilerpg-assets/atlas.tga
  python3 scripts/extract-mobilerpg-spell-assets.py
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import struct
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_BLOB_SHA = "0f29db6a21e931129b665354ec5183da2696cfac"
DEFAULT_OUT = Path("/tmp/mobilerpg-assets/atlas.tga")
EXPECTED_SIZE = 4194348
REPO = "fred1878/MobileRPG"


def _token() -> str:
    for key in (
        "MOBILERPG_GITHUB_TOKEN",
        "CARDGAME_DEBUG_GITHUB_PAT",
        "GITHUB_TOKEN",
    ):
        val = os.environ.get(key)
        if val:
            return val.strip()
    raise SystemExit(
        "Set MOBILERPG_GITHUB_TOKEN (PAT with read on fred1878/MobileRPG)",
    )


def _validate_tga(data: bytes) -> None:
    if len(data) < 18:
        raise SystemExit(f"TGA too small: {len(data)} bytes")
    if data.count(b"\xef\xbf\xbd") > 0:
        raise SystemExit(
            "atlas payload contains UTF-8 replacement bytes (corrupt download); "
            "use Git Blob API base64, not MCP raw file spill",
        )
    image_type = data[2]
    if image_type not in (2, 10):
        raise SystemExit(f"unsupported TGA type {image_type}")
    width, height = struct.unpack_from("<HH", data, 12)
    depth = data[16]
    if width != 1024 or height != 1024 or depth != 32:
        raise SystemExit(f"unexpected atlas geometry {width}x{height} depth={depth}")
    id_len = data[0]
    need = 18 + id_len + width * height * 4
    if image_type == 2 and len(data) < need:
        raise SystemExit(f"truncated atlas: got {len(data)} need>={need}")
    if len(data) != EXPECTED_SIZE:
        raise SystemExit(
            f"unexpected atlas size {len(data)} (expected {EXPECTED_SIZE} for main)",
        )


def fetch_blob(out: Path) -> None:
    sha = os.environ.get("MOBILERPG_ATLAS_BLOB_SHA", DEFAULT_BLOB_SHA)
    token = _token()
    url = f"https://api.github.com/repos/{REPO}/git/blobs/{sha}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as err:
        raise SystemExit(
            f"GitHub blob fetch failed ({err.code}): {err.reason}. "
            "Check PAT scope on fred1878/MobileRPG",
        ) from err

    if body.get("encoding") != "base64" or "content" not in body:
        raise SystemExit(f"unexpected blob response keys: {list(body.keys())}")
    data = base64.b64decode(body["content"])
    _validate_tga(data)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    md5 = hashlib.md5(data).hexdigest()
    print(f"wrote {out} ({len(data)} bytes) md5={md5}")


def main() -> int:
    out = Path(os.environ.get("MOBILERPG_ATLAS_TGA", DEFAULT_OUT))
    fetch_blob(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())