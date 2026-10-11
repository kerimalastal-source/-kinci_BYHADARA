import json, math, sys
geo, out = sys.argv[1], sys.argv[2]
d = json.load(open(geo))
LON0, LON1, LAT0, LAT1 = 28.30, 28.90, 40.93, 41.25
K = math.cos(math.radians(41.05))
W = 1600
s = W / ((LON1 - LON0) * K)
H = round((LAT1 - LAT0) * s)
TOP = 150
def P(lon, lat): return ((lon - LON0) * K * s, (LAT1 - lat) * s + TOP)
def rpx(km): return km / 111.32 * s

paths = []
for f in d["features"]:
    name = f["properties"]["name"]
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    dstr = ""
    for poly in polys:
        ring = poly[0]
        pts = [P(x, y) for x, y in ring]
        dstr += "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z"
    paths.append((name, dstr))

focus = {"Büyükçekmece", "Beylikdüzü", "Başakşehir", "Arnavutköy", "Avcılar", "Bakırköy", "Küçükçekmece"}
svg = []
for name, dstr in paths:
    if name == "Esenyurt":
        fill, stroke = "#d9d4c7", "#b5ad99"
    elif name in focus:
        fill, stroke = "#fbf9f4", "#c8bfa8"
    else:
        fill, stroke = "#f1eee6", "#d6cfbd"
    svg.append(f'<path d="{dstr}" fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')

circles = [
 ("buy",41.0288,28.5275,3),("buy",41.0692,28.5811,3),("buy",41.0513,28.4442,3),("buy",41.0198,28.593,3),("buy",41.1007,28.593,3),("buy",41.0782,28.5335,3),
 ("buy",41.0333,28.4858,3),("buy",41.0603,28.4144,3),("buy",41.0019,28.5275,3),("buy",41.0468,28.593,3),("buy",41.0917,28.605,2.5),("buy",41.0827,28.5275,3),
 ("bey",40.9835,28.654,3),("bey",40.988,28.6242,3),("bey",40.979,28.6659,3),("bey",40.9925,28.6301,3),
 ("bah",41.075,28.69,2),("isp",41.05,28.712,2),("kay",41.108,28.77,2.5),("arn",41.185,28.74,4),("flo",40.978,28.788,2),("yes",40.963,28.823,2),
]
for _, la, lo, r in circles:
    x, y = P(lo, la)
    svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rpx(r):.1f}" fill="#c9a24b" fill-opacity="0.30" stroke="#a8822f" stroke-width="2.2"/>')

def label(lon, lat, ar, tr, dx=0, dy=0, big=False, muted=False):
    x, y = P(lon, lat); x += dx; y += dy
    fs = 30 if big else 25
    col = "#7a7466" if muted else "#0f2b21"
    return (f'<g transform="translate({x:.1f},{y:.1f})">'
            f'<text text-anchor="middle" font-family="Plex" font-weight="700" font-size="{fs}" fill="{col}" paint-order="stroke" stroke="#ffffff" stroke-width="7" stroke-linejoin="round">{ar}</text>'
            f'<text y="{fs*0.95:.0f}" text-anchor="middle" font-family="Inter" font-weight="600" font-size="{fs*0.62:.0f}" fill="{col}" paint-order="stroke" stroke="#ffffff" stroke-width="5" stroke-linejoin="round">{tr}</text></g>')

labels = [
 label(28.47, 41.112, "بيوكجكمجة (كلها)", "Büyükçekmece", big=True),
 label(28.645, 40.945, "بيليكدوزو (كلها)", "Beylikdüzü", big=True),
 label(28.69, 41.098, "بهتشه شهير", "Bahçeşehir", dx=10),
 label(28.735, 41.030, "إسبارتاكوله", "Ispartakule", dx=40, dy=5),
 label(28.77, 41.137, "كايا شهير", "Kayaşehir", dy=-5),
 label(28.74, 41.228, "أرناؤوط كوي", "Arnavutköy"),
 label(28.785, 41.000, "فلوريا", "Florya", dx=-10, dy=-12),
 label(28.86, 40.995, "يشيل كوي", "Yeşilköy"),
 label(28.662, 41.045, "إسنيورت (مستبعدة)", "Esenyurt", muted=True),
 label(28.45, 40.975, "بحر مرمرة", "Sea of Marmara", muted=True),
]

html = f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:Plex;src:url(file://FONTS/plex-700.ttf);font-weight:700}}
@font-face{{font-family:Plex;src:url(file://FONTS/plex-500.ttf);font-weight:500}}
@font-face{{font-family:Inter;src:url(file://FONTS/inter-600.ttf);font-weight:600}}
html,body{{margin:0;background:#dfe9ec}}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H+TOP+90}" viewBox="0 0 {W} {H+TOP+90}">
<rect width="100%" height="100%" fill="#dfe9ec"/>
{''.join(svg)}
{''.join(labels)}
<rect x="0" y="0" width="{W}" height="{TOP}" fill="#0f2b21"/>
<text x="{W-40}" y="66" text-anchor="end" font-family="Plex" font-weight="700" font-size="44" fill="#ffffff">المجموعة الأولى: بيوكجكمجة وغرب إسطنبول</text>
<text x="{W-40}" y="118" text-anchor="end" font-family="Plex" font-weight="500" font-size="28" fill="#e6d3a3">‏22 دائرة على أماكن السكن · 225 ليرة باليوم · فيلا مرمرة هيفن</text>
<rect x="0" y="{H+TOP}" width="{W}" height="90" fill="#ffffff"/>
<circle cx="{W-60}" cy="{H+TOP+45}" r="16" fill="#c9a24b" fill-opacity="0.35" stroke="#a8822f" stroke-width="2.2"/>
<text x="{W-90}" y="{H+TOP+55}" text-anchor="end" font-family="Plex" font-weight="500" font-size="26" fill="#0f2b21">دائرة إعلانية (2–4 كم)</text>
<rect x="{W-560}" y="{H+TOP+29}" width="34" height="32" fill="#d9d4c7" stroke="#b5ad99"/>
<text x="{W-540-50}" y="{H+TOP+55}" text-anchor="end" font-family="Plex" font-weight="500" font-size="26" fill="#0f2b21">إسنيورت (غير مشمولة)</text>
<text x="40" y="{H+TOP+55}" font-family="Plex" font-weight="500" font-size="22" fill="#7a7466">‏22 دائرة · الحدود تقريبية</text>
</svg></body></html>'''
open(out, "w").write(html)
print(W, H+TOP+90)
