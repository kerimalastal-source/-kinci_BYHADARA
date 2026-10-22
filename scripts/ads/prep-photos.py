"""Crop and resize ad photos to their exact on-screen pixel size (high quality, no browser scaling).

    python3 -I scripts/ads/prep-photos.py jobs.json

jobs.json: [{"src": path, "out": path, "box": [x, y, w, h] in source pixels, "size": [W, H] output pixels}]
LANCZOS resampling plus a light unsharp mask, saved as JPEG quality 96 (4:4:4).
"""
import json, sys
from PIL import Image, ImageFilter

for j in json.load(open(sys.argv[1])):
    im = Image.open(j["src"]).convert("RGB")
    x, y, w, h = j["box"]
    W, H = j["size"]
    crop = im.crop((round(x), round(y), round(x + w), round(y + h)))
    out = crop.resize((W, H), Image.LANCZOS)
    scale = W / max(w, 1)
    # Upscaled photos get a slightly stronger sharpen than downscaled ones.
    out = out.filter(ImageFilter.UnsharpMask(radius=1.4 if scale > 1 else 0.8, percent=70 if scale > 1 else 45, threshold=2))
    out.save(j["out"], quality=96, subsampling=0)
    print(f"{j['out'].rsplit('/', 1)[-1]}: crop {round(w)}x{round(h)} -> {W}x{H} ({scale:.2f}x)")
