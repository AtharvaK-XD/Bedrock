"""
Samples public/logo.png into a deterministic set of triangle shards for the
launch video's logo-assembly animation (remotion/launch/scenes/Reveal.tsx).

Each output triangle is [x1, y1, x2, y2, x3, y3, shade] in the logo's
512x512 pixel space. Only triangles whose centroid lands on an opaque logo
pixel are kept, so the shards trace the real logo silhouette.

Usage (from repo root):  python -I scripts/launch-video/build-logo-shards.py
"""
import json
import os
import random

from PIL import Image

SRC = os.path.join("public", "logo.png")
OUT = os.path.join("remotion", "launch", "data", "logoShards.json")
CELL = 18
JITTER = 5
SEED = 2026


def main():
    rng = random.Random(SEED)
    img = Image.open(SRC).convert("RGBA")
    px = img.load()
    w, h = img.size
    x0, y0, x1, y1 = img.getbbox()

    cols = (x1 - x0) // CELL + 2
    rows = (y1 - y0) // CELL + 2
    verts = [
        [
            (
                x0 + c * CELL + (rng.uniform(-JITTER, JITTER) if 0 < c < cols - 1 else 0),
                y0 + r * CELL + (rng.uniform(-JITTER, JITTER) if 0 < r < rows - 1 else 0),
            )
            for c in range(cols)
        ]
        for r in range(rows)
    ]

    def opaque(x, y):
        xi, yi = int(x), int(y)
        return 0 <= xi < w and 0 <= yi < h and px[xi, yi][3] > 128

    tris = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            a, b = verts[r][c], verts[r][c + 1]
            d, e = verts[r + 1][c], verts[r + 1][c + 1]
            pair = [(a, b, e), (a, e, d)] if rng.random() < 0.5 else [(a, b, d), (b, e, d)]
            for t in pair:
                cx = sum(p[0] for p in t) / 3
                cy = sum(p[1] for p in t) / 3
                if opaque(cx, cy):
                    shade = round(rng.uniform(0.82, 1.0), 3)
                    tris.append([round(v, 1) for p in t for v in p] + [shade])

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"size": w, "bbox": [x0, y0, x1, y1], "tris": tris}, f, separators=(",", ":"))
    print(f"wrote {len(tris)} shards to {OUT}")


if __name__ == "__main__":
    main()
