"""Makes lighter WebP copies of the site's JPG photos for phones and tablets.

For every JPG under public/images/{projects,blog,pages} (and the home hero),
writes <name>-<width>.webp for each width in WIDTHS that is smaller than the
photo. The originals stay as they are (link previews, large screens), and
src/utils/responsiveImage.ts builds the matching srcset: keep WIDTHS in sync.

Run from the repo root after adding or replacing photos:
    python3 scripts/images/build-webp.py
Existing copies are skipped unless the JPG is newer.
"""
from pathlib import Path

from PIL import Image, ImageOps

WIDTHS = (320, 640, 1280)
# Slightly lower quality for the big copies: they are shown on dense screens, where it does not show.
QUALITY = {320: 78, 640: 78, 1280: 70}
ROOT = Path(__file__).resolve().parents[2] / "public"
SOURCES = [*ROOT.glob("images/projects/*/*.jpg"), *ROOT.glob("images/blog/*.jpg"), *ROOT.glob("images/pages/*.jpg"), ROOT / "hero-istanbul.jpg"]


def main() -> None:
    made = saved = 0
    for jpg in SOURCES:
        with Image.open(jpg) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
        for width in WIDTHS:
            if width >= image.width:
                continue
            out = jpg.with_name(f"{jpg.stem}-{width}.webp")
            if out.exists() and out.stat().st_mtime >= jpg.stat().st_mtime:
                continue
            height = round(image.height * width / image.width)
            image.resize((width, height), Image.LANCZOS).save(out, "WEBP", quality=QUALITY[width], method=6)
            made += 1
            saved += out.stat().st_size
    print(f"{made} WebP copies written ({saved / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
