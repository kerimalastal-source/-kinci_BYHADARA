import json, math, sys
d = json.load(open(sys.argv[1]))
K = math.cos(math.radians(41.05))
polys = {}
for f in d["features"]:
    g = f["geometry"]; ps = g["coordinates"] if g["type"]=="MultiPolygon" else [g["coordinates"]]
    polys[f["properties"]["name"]] = [p[0] for p in ps]
def inside(pt, ring):
    x,y = pt; c=False; n=len(ring)
    for i in range(n):
        x1,y1=ring[i]; x2,y2=ring[(i+1)%n]
        if (y1>y)!=(y2>y) and x < (x2-x1)*(y-y1)/(y2-y1)+x1: c=not c
    return c
def where(lon,lat):
    for n,rs in polys.items():
        if any(inside((lon,lat),r) for r in rs): return n
    return "sea"
def frac(lat,lon,r):
    cnt={}; N=0
    for i in range(-12,13):
        for j in range(-12,13):
            dx=i/12*r; dy=j/12*r
            if dx*dx+dy*dy>r*r: continue
            la=lat+dy/111.32; lo=lon+dx/(111.32*K)
            w=where(lo,la); cnt[w]=cnt.get(w,0)+1; N+=1
    return {k:round(v/N*100) for k,v in sorted(cnt.items(),key=lambda x:-x[1])}
circles = json.loads(sys.argv[2])
for c in circles:
    print(c, frac(*c[1:]))
# district bboxes
for n in ["Beylikdüzü","Esenyurt","Büyükçekmece","Başakşehir","Avcılar","Arnavutköy","Silivri","Çatalca","Küçükçekmece","Bakırköy"]:
    pts=[p for r in polys[n] for p in r]
    print(n, round(min(p[0] for p in pts),3), round(max(p[0] for p in pts),3), round(min(p[1] for p in pts),3), round(max(p[1] for p in pts),3))
