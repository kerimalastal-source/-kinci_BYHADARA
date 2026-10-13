"""Circles (lat, lon, radius km) that cover chosen districts of a Saudi city for Meta custom_locations.

    python3 -I scripts/ads/targeting-map/gulf_cover.py <districts.json> <city_id> <max_circles> "Name A" "Name B" ...

districts.json = homaily/Saudi-Arabia-Regions-Cities-and-Districts json/districts.json
(boundaries are [[lat, lon], ...] rings). Small districts: relax with env GOOD=0.6 OTHER=0.2. Every circle keeps >= 80% of its area inside the chosen
districts and <= 8% inside any other named district; the rest may be roads or unnamed land.
"""
import json, math, os, sys

data = json.load(open(sys.argv[1]))
city = int(sys.argv[2]); maxn = int(sys.argv[3]); wanted = set(sys.argv[4:])
polys = {}
for x in data:
    if x["city_id"] != city or not x["boundaries"]:
        continue
    polys.setdefault(x["name_en"], []).extend(x["boundaries"])
missing = wanted - set(polys)
if missing:
    sys.exit(f"unknown districts: {sorted(missing)}")


def inside(lat, lon, ring):
    c = False
    n = len(ring)
    for i in range(n):
        y1, x1 = ring[i]; y2, x2 = ring[(i + 1) % n]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            c = not c
    return c


pts = [p for n in wanted for r in polys[n] for p in r]
la0, la1 = min(p[0] for p in pts) - .03, max(p[0] for p in pts) + .03
lo0, lo1 = min(p[1] for p in pts) - .03, max(p[1] for p in pts) + .03
K = math.cos(math.radians((la0 + la1) / 2))
# Bounding boxes to speed up point-in-polygon.
boxes = {n: [(min(p[0] for p in r), max(p[0] for p in r), min(p[1] for p in r), max(p[1] for p in r)) for r in rs] for n, rs in polys.items()}


def where(lat, lon):
    for n, rs in polys.items():
        for r, (a, b, c, d) in zip(rs, boxes[n]):
            if a <= lat <= b and c <= lon <= d and inside(lat, lon, r):
                return n
    return None


step = 0.35
samples = []
la = la0
while la <= la1:
    lo = lo0
    while lo <= lo1:
        samples.append((la, lo, where(la, lo)))
        lo += step / (111.32 * K)
    la += step / 111.32
target = [i for i, s in enumerate(samples) if s[2] in wanted]


def members(la, lo, r):
    out = []
    for i, s in enumerate(samples):
        dy = (s[0] - la) * 111.32; dx = (s[1] - lo) * 111.32 * K
        if dx * dx + dy * dy <= r * r:
            out.append(i)
    return out


cands = []
for i in target[::2]:
    la, lo, _ = samples[i]
    for r in (1.0, 1.5, 2.0, 2.5, 3.0):
        m = members(la, lo, r)
        labs = [samples[j][2] for j in m]
        good = sum(1 for l in labs if l in wanted) / len(m)
        other = {}
        for l in labs:
            if l and l not in wanted:
                other[l] = other.get(l, 0) + 1
        if good < float(os.environ.get("GOOD", .80)) or (other and max(other.values()) / len(m) > float(os.environ.get("OTHER", .08))):
            continue
        cands.append(((round(la, 4), round(lo, 4), r), {j for j in m if samples[j][2] in wanted}))
covered = set(); chosen = []
while len(chosen) < maxn:
    best = max(cands, key=lambda t: len(t[1] - covered), default=None)
    if not best or len(best[1] - covered) < 4:
        break
    chosen.append(best[0]); covered |= best[1]
per = {}
for i in target:
    per.setdefault(samples[i][2], [0, 0])[1] += 1
    if i in covered:
        per[samples[i][2]][0] += 1
print(f"covered {len(covered)}/{len(target)} = {round(len(covered) / len(target) * 100)}% with {len(chosen)} circles")
for n, (a, b) in sorted(per.items()):
    print(f"  {n}: {round(a / b * 100)}%")
print(json.dumps(chosen))
