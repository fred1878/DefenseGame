#!/usr/bin/env python3
"""Build the isometric town atlases under public/assets/town/iso/ from the free art packs.

Usage: python3 scripts/build-town-iso-assets.py <packs-dir>
  <packs-dir> holds the downloaded packs (sdavgha-*, kyndrael-castle-sampler, antahonist-terrain).
  They are NOT committed: the licences forbid redistributing them as standalone packs. Only the
  sprites the town uses are written, graded and packed into atlases. See CREDITS.md.

Inputs: scripts/town-iso/sprites.json (sprite list, crops, fog ellipses per stage).
Outputs (public/assets/town/iso/):
  town-iso-lit.{json,png}    tappable buildings: full colour, ~12% brighter
  town-iso-dim*.{json,png}   scenery: desaturated, darkened, cool tint (tint per item at runtime)
  town-iso-ground.{json,png} Antahonist ground tiles + corner autotiles, darkened/desaturated
  town-iso-fog-{1,2,3}.png   fog outside the town footprint (alpha), drawn over the ground
  town-iso-vignette.png      screen vignette, town-iso-light.png (additive light), town-iso-smoke.png
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/assets/town/iso')
SPEC = json.load(open(os.path.join(ROOT, 'scripts/town-iso/sprites.json')))
PACKS = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('TOWN_ISO_PACKS', '')
if not PACKS or not os.path.isdir(PACKS):
    sys.exit('usage: build-town-iso-assets.py <packs-dir>')

W, H = 1080, 2400            # mockup world
CROP = (90, 220, 990, 2220)  # visible 900x2000 window (0.6x on a 540x1200 screen)
PAD = 2


def grade(im, sat, val, tint=(0, 0, 0), amt=0.0):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    rgb = a[..., :3]
    lum = (rgb @ np.array([.299, .587, .114], np.float32))[..., None]
    rgb = lum + (rgb - lum) * sat
    rgb = rgb * val
    rgb = rgb * (1 - amt) + np.array(tint, np.float32) * amt
    a[..., :3] = np.clip(rgb, 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def load_sprite(key):
    s = SPEC['sprites'][key]
    im = Image.open(os.path.join(PACKS, s['src'])).convert('RGBA')
    if s['stripShadow']:  # Kyndrael bakes a translucent cast shadow; SdavGha has none
        a = np.array(im)
        m = (a[..., 3] > 0) & (a[..., 3] < 255)
        a[m] = 0
        im = Image.fromarray(a)
    return im.crop(tuple(s['crop']))


def pack(images, max_w=2048, max_h=2048):
    """Shelf packer -> list of pages [(page_w, page_h, [(name, x, y, im)])]."""
    items = sorted(images.items(), key=lambda kv: (-kv[1].height, -kv[1].width))
    pages, cur, x, y, shelf_h, used_w = [], [], 0, 0, 0, 0
    for name, im in items:
        w, h = im.width + PAD * 2, im.height + PAD * 2
        if x + w > max_w:
            x, y, shelf_h = 0, y + shelf_h, 0
        if y + h > max_h:
            pages.append(cur)
            cur, x, y, shelf_h = [], 0, 0, 0
        cur.append((name, x + PAD, y + PAD, im))
        x += w
        shelf_h = max(shelf_h, h)
    if cur:
        pages.append(cur)
    out = []
    for p in pages:
        pw = max(px + im.width + PAD for _, px, _, im in p)
        ph = max(py + im.height + PAD for _, _, py, im in p)
        out.append((pw, ph, p))
    return out


def write_atlas(name, images, max_w=2048, max_h=2048):
    textures = []
    pages = pack(images, max_w, max_h)
    for i, (pw, ph, p) in enumerate(pages):
        img_name = f'{name}.png' if len(pages) == 1 else f'{name}-{i}.png'
        sheet = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
        frames = []
        for fname, x, y, im in p:
            sheet.paste(im, (x, y))
            frames.append({'filename': fname, 'rotated': False, 'trimmed': False,
                           'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height},
                           'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
                           'sourceSize': {'w': im.width, 'h': im.height}})
        sheet.save(os.path.join(OUT, img_name), optimize=True)
        textures.append({'image': img_name, 'format': 'RGBA8888', 'size': {'w': pw, 'h': ph},
                         'scale': 1, 'frames': frames})
    json.dump({'textures': textures, 'meta': {'app': 'scripts/build-town-iso-assets.py'}},
              open(os.path.join(OUT, f'{name}.json'), 'w'), separators=(',', ':'))
    return [t['image'] for t in textures]


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.png') or f.endswith('.json'):  # keep LICENSE-NOTE.md
            os.remove(os.path.join(OUT, f))
    base_val = SPEC['baseDimValue']
    lit = {k: grade(load_sprite(k), 1.0, 1.12) for k in SPEC['lit']}
    dim = {k: grade(load_sprite(k), 0.42, base_val, (28, 30, 44), 0.12) for k in SPEC['dim']}
    written = write_atlas('town-iso-lit', lit)
    written += write_atlas('town-iso-dim', dim)

    # ground: base tiles (+variants) and the corner autotile sets the town uses
    terrain = os.path.join(PACKS, 'antahonist-terrain')
    ground = {}
    for t in ('grass', 'grass_dry', 'dirt', 'mud', 'cobble', 'flagstone'):
        d = os.path.join(terrain, 'tiles_192', t)
        for f in sorted(os.listdir(d)):
            ground[f[:-4]] = Image.open(os.path.join(d, f))
    for pair in ('grass__dirt', 'grass_dry__dirt', 'grass__mud', 'dirt__cobble', 'grass__cobble', 'grass__flagstone'):
        d = os.path.join(terrain, 'transitions_192', pair)
        for f in sorted(os.listdir(d)):
            ground[f[:-4]] = Image.open(os.path.join(d, f))
    ground = {k: grade(v, 0.4, 0.56, (34, 38, 52), 0.25) for k, v in ground.items()}
    written += write_atlas('town-iso-ground', ground, 1024, 1024)

    # fog per stage (same formula as the approved mockup), 1/4 resolution of the visible window
    rng = np.random.default_rng(3)
    noise = np.asarray(Image.fromarray((rng.random((H // 40, W // 40)) * 255).astype(np.uint8))
                       .resize((W, H), Image.BICUBIC), np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    for i, f in enumerate(SPEC['fog'], start=1):
        e = np.sqrt(((xx - 540) / (f['ax'] * 1.05)) ** 2 + ((yy - f['cy']) / (f['ay'] * 1.05)) ** 2)
        fog = np.clip((e - 0.95) / 0.7 + (noise - 0.5) * 0.35, 0, 0.8)
        a = np.zeros((H, W, 4), np.uint8)
        a[..., 0], a[..., 1], a[..., 2] = 16, 17, 24
        a[..., 3] = (fog * 255).astype(np.uint8)
        im = Image.fromarray(a).crop(CROP).resize((225, 500), Image.LANCZOS)
        im.save(os.path.join(OUT, f'town-iso-fog-{i}.png'), optimize=True)
        written.append(f'town-iso-fog-{i}.png')
    vg = np.clip(1 - (((xx - 540) / 760) ** 2 + ((yy - 1300) / 1500) ** 2) * 0.55, 0.35, 1)
    a = np.zeros((H, W, 4), np.uint8)
    a[..., 3] = ((1 - vg) * 255).astype(np.uint8)
    Image.fromarray(a).crop(CROP).resize((225, 500), Image.LANCZOS).save(
        os.path.join(OUT, 'town-iso-vignette.png'), optimize=True)
    # additive light (white, alpha falloff (1-d)^2) and a soft smoke puff
    n = 128
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    d = np.sqrt(((x - n / 2 + .5) / (n / 2)) ** 2 + ((y - n / 2 + .5) / (n / 2)) ** 2)
    a = np.zeros((n, n, 4), np.uint8)
    a[..., :3] = 255
    a[..., 3] = (np.clip(1 - d, 0, 1) ** 2 * 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(OUT, 'town-iso-light.png'), optimize=True)
    n = 48
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    d = np.sqrt(((x - n / 2 + .5) / (n / 2)) ** 2 + ((y - n / 2 + .5) / (n / 2)) ** 2)
    a = np.zeros((n, n, 4), np.uint8)
    a[..., 0], a[..., 1], a[..., 2] = 165, 165, 175
    a[..., 3] = (np.exp(-(d ** 2) * 4) * np.clip(1 - d, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(OUT, 'town-iso-smoke.png'), optimize=True)
    written += ['town-iso-vignette.png', 'town-iso-light.png', 'town-iso-smoke.png']
    for f in written:
        p = os.path.join(OUT, f)
        print(f'{f}: {Image.open(p).size} {os.path.getsize(p) // 1024} KiB')


if __name__ == '__main__':
    main()
