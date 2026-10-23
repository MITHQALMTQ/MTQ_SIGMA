#!/usr/bin/env python3
"""MTQΣ landing — globe coastline generator.

Generates src/components/landing/globe-coasts.ts: orthographic coastline +
country-border path data for the holographic Earth, matching the projection
of globe-dots.ts (lat0=20N, lon0=10E, center 300,300, radius 240, viewbox 600).

Source: public-domain countries GeoJSON
(raw.githubusercontent.com/johan/world.geo.json — Natural Earth derived).

Run:  curl -s -o /tmp/world.geo.json \
        https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json
      python3 scripts/gen-globe-coasts.py
"""
import json
import math

SRC = "/tmp/world.geo.json"
OUT = "/home/z/my-project/src/components/landing/globe-coasts.ts"

LAT0 = 20.0
LON0 = 10.0
CX = 300.0
CY = 300.0
R = 240.0


def project(lat, lon):
    """Orthographic projection; returns (x, y) or None if on far side."""
    la = math.radians(lat)
    lo = math.radians(lon - LON0)
    la0 = math.radians(LAT0)
    cos_c = math.sin(la0) * math.sin(la) + math.cos(la0) * math.cos(la) * math.cos(lo)
    if cos_c <= 0.0:
        return None
    x = CX + R * math.cos(la) * math.sin(lo)
    y = CY - R * (math.cos(la0) * math.sin(la) - math.sin(la0) * math.cos(la) * math.cos(lo))
    return round(x, 1), round(y, 1)


def path_for_ring(ring, step):
    """SVG path for one polygon ring; splits into subpaths at the horizon."""
    pts = [project(lat, lon) for lon, lat in ring[::step]]
    parts = []
    cur = []

    def flush():
        if len(cur) >= 2:
            parts.append("M" + "L".join(f"{p[0]} {p[1]}" for p in cur))
        del cur[:]

    prev = None
    for pt in pts:
        if pt is None:
            flush()
            prev = None
            continue
        if prev is not None and abs(pt[0] - prev[0]) < 1.1 and abs(pt[1] - prev[1]) < 1.1:
            continue
        cur.append(pt)
        prev = pt
    flush()
    return "".join(parts)


def main():
    data = json.load(open(SRC))
    coast_paths = []
    border_paths = []
    for feat in data["features"]:
        geom = feat["geometry"]
        if geom["type"] == "Polygon":
            polys = [geom["coordinates"]]
        elif geom["type"] == "MultiPolygon":
            polys = geom["coordinates"]
        else:
            continue
        for poly in polys:
            for j, ring in enumerate(poly):
                if len(ring) < 4:
                    continue
                # skip tiny islands (< ~2.5px)
                lons = [c[0] for c in ring]
                lats = [c[1] for c in ring]
                if max(lons) - min(lons) < 0.55 and max(lats) - min(lats) < 0.55:
                    continue
                n = len(ring)
                step = 1 if n < 120 else (2 if n < 500 else 3)
                d = path_for_ring(ring, step)
                if len(d) > 14:
                    (coast_paths if j == 0 else border_paths).append(d)

    def chunk(paths, per=36):
        return ["".join(paths[i:i + per]) for i in range(0, len(paths), per)]

    coasts = chunk(coast_paths)
    borders = chunk(border_paths)
    total = sum(map(len, coasts)) + sum(map(len, borders))

    with open(OUT, "w") as f:
        f.write("// MTQΣ landing — holographic globe coastline + border geometry.\n")
        f.write("// GENERATED from public-domain countries GeoJSON (johan/world.geo.json,\n")
        f.write("// Natural Earth derived) via orthographic projection (lat0=20N,\n")
        f.write("// lon0=10E) — identical projection to globe-dots.ts (center 300,300,\n")
        f.write("// radius 240, viewbox 600). Regenerate via scripts/gen-globe-coasts.py.\n")
        f.write("// Do not hand-edit.\n\n")
        f.write("export const GLOBE_COASTS: readonly string[] = [\n")
        for c in coasts:
            f.write(f"  `{c}`,\n")
        f.write("] as const;\n\n")
        f.write("export const GLOBE_BORDERS: readonly string[] = [\n")
        for b in borders:
            f.write(f"  `{b}`,\n")
        f.write("] as const;\n")
    print(f"coast subpaths: {len(coast_paths)}, border subpaths: {len(border_paths)}")
    print(f"module size: {len(open(OUT).read())/1024:.0f} KB")


if __name__ == "__main__":
    main()
