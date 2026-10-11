import json, math, sys
d = json.load(open(sys.argv[1])); target = sys.argv[2]; maxn = int(sys.argv[3])
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
pts=[p for r in polys[target] for p in r]
x0,x1=min(p[0] for p in pts),max(p[0] for p in pts); y0,y1=min(p[1] for p in pts),max(p[1] for p in pts)
step=0.5  # km sample grid
samples=[]  # (lat,lon,label)
la=y0-0.05
while la<=y1+0.05:
    lo=x0-0.06
    while lo<=x1+0.06:
        samples.append((la,lo,where(lo,la)))
        lo+=step/(111.32*K)
    la+=step/111.32
tgt=[i for i,s in enumerate(samples) if s[2]==target]
covered=set()
cands=[(s[0],s[1],r) for s in samples[::3] if s[2]==target for r in (2.0,2.5,3.0)]
def members(c):
    la,lo,r=c; out=[]
    for i,s in enumerate(samples):
        dy=(s[0]-la)*111.32; dx=(s[1]-lo)*111.32*K
        if dx*dx+dy*dy<=r*r: out.append(i)
    return out
info=[]
for c in cands:
    m=members(c)
    if not m: continue
    labs=[samples[i][2] for i in m]
    esen=labs.count("Esenyurt")/len(m); tg=labs.count(target)/len(m)
    if esen>0.03 or tg<0.55: continue
    info.append((c,set(i for i in m if samples[i][2]==target)))
chosen=[]
while len(chosen)<maxn:
    best=max(info,key=lambda t:len(t[1]-covered),default=None)
    if not best or len(best[1]-covered)<3: break
    chosen.append(best[0]); covered|=best[1]
print(f"{target}: covered {len(covered)}/{len(tgt)} = {round(len(covered)/len(tgt)*100)}%")
print(json.dumps([[round(c[0],4),round(c[1],4),c[2]] for c in chosen]))
