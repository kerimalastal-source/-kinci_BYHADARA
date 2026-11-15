"""Resizes the catalogue's photos to JPEG: python3 scripts/catalog/photos.py <jobs.json>
(jobs = [{"src", "out", "width", "quality"}], written by lib.mjs)."""
import json
import sys

from PIL import Image, ImageFilter

for job in json.load(open(sys.argv[1])):
    im = Image.open(job["src"]).convert("RGB")
    if im.width > job["width"]:
        h = round(im.height * job["width"] / im.width)
        im = im.resize((job["width"], h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=0.8, percent=40, threshold=2))
    im.save(job["out"], "JPEG", quality=job.get("quality", 84), optimize=True, progressive=True)
