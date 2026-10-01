"""Adds one blog article (5 languages + cover photo) to the site.

    python3 scripts/blog/add-article.py scripts/blog/out/<slug>.json            # add to the site
    python3 scripts/blog/add-article.py scripts/blog/out/<slug>.json --draft    # check + cover only

The JSON (written by the weekly blog session, see scripts/blog/README.md):
{
  "slug": "gross-vs-net-area",
  "cover": { "photo": "/images/projects/lotus-sisli/apartment-living.jpg", "focus": 0.5 },
  "en": { "category": "...", "title": "...", "excerpt": "...", "body": ["...", "## Subheading", "..."] },
  "ar": {...}, "fa": {...}, "fr": {...}, "ru": {...}
}

With --draft (the weekly session) it only validates the article and writes the cropped
cover to scripts/blog/out/<slug>.jpg; nothing on the site changes.
Without it (the HADARA session, after the owner approves) it crops the cover to 3:2 into
public/images/blog/<slug>.jpg, makes the WebP copies,
adds the post at the top of src/data/blog.ts and inserts blogData.<slug> into every
dictionary without reformatting the rest of the file.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
LOCALES = ("en", "ar", "fa", "fr", "ru")
MAX_W, RATIO = 1536, 3 / 2


def fail(msg: str) -> None:
    print("ERROR: " + msg)
    sys.exit(1)


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--draft"]
    draft = "--draft" in sys.argv[1:]
    if len(args) != 1:
        fail("usage: python3 scripts/blog/add-article.py <article.json> [--draft]")
    src_json = Path(args[0])
    art = json.loads(src_json.read_text(encoding="utf-8"))
    slug = art.get("slug", "")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug):
        fail(f"bad slug {slug!r}")

    blog_ts = ROOT / "src/data/blog.ts"
    ts = blog_ts.read_text(encoding="utf-8")
    if f'slug: "{slug}"' in ts:
        fail(f"{slug} already exists in src/data/blog.ts")

    for loc in LOCALES:
        c = art.get(loc)
        if not isinstance(c, dict):
            fail(f"missing locale {loc}")
        for key in ("category", "title", "excerpt"):
            if not isinstance(c.get(key), str) or not c[key].strip():
                fail(f"{loc}.{key} is empty")
        body = c.get("body")
        if not isinstance(body, list) or len(body) < 4 or not all(isinstance(p, str) and p.strip() for p in body):
            fail(f"{loc}.body needs at least 4 non-empty paragraphs")
        for text in [c["category"], c["title"], c["excerpt"], *body]:
            if re.search(r"[<>]", text):
                fail(f"{loc}: no HTML allowed ({text[:40]}...)")
        if body[0].startswith("## "):
            fail(f"{loc}.body must start with a paragraph, not a subheading")
    heads = [sum(p.startswith("## ") for p in art[loc]["body"]) for loc in LOCALES]
    if len(set(heads)) != 1 or len({len(art[loc]["body"]) for loc in LOCALES}) != 1:
        fail(f"all languages need the same structure (paragraphs/subheadings): {heads}")

    # Cover: crop to 3:2 around the vertical focus point, at most 1536 px wide.
    cover = art.get("cover", {})
    src = ROOT / "public" / cover.get("photo", "").lstrip("/")
    if not src.is_file():
        fail(f"cover photo not found: {src}")
    with Image.open(src) as original:
        im = ImageOps.exif_transpose(original).convert("RGB")
    w, h = im.size
    if w / h > RATIO:
        cw, ch = round(h * RATIO), h
        x = round((w - cw) * float(cover.get("focusX", 0.5)))
        box = (x, 0, x + cw, ch)
    else:
        cw, ch = w, round(w / RATIO)
        y = round((h - ch) * float(cover.get("focus", 0.5)))
        box = (0, y, cw, y + ch)
    im = im.crop(box)
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(MAX_W / RATIO)), Image.LANCZOS)
    if draft:
        dest = src_json.parent / f"{slug}.jpg"
        im.save(dest, "JPEG", quality=86, optimize=True, progressive=True)
        words = len(" ".join(art["en"]["body"]).split())
        print(f"draft ok: {slug}, cover {dest} ({im.width}x{im.height}), {words} English words")
        return
    dest = ROOT / "public/images/blog" / f"{slug}.jpg"
    im.save(dest, "JPEG", quality=86, optimize=True, progressive=True)
    subprocess.run([sys.executable, str(ROOT / "scripts/images/build-webp.py")], check=True)

    # blog.ts: newest first (lowest priority number).
    prios = [int(p) for p in re.findall(r"priority:\s*(-?\d+)", ts)]
    prio = min(prios) - 1 if prios else 0
    entry = (
        "  {\n"
        f'    slug: "{slug}",\n'
        f"    priority: {prio},\n"
        f'    coverImage: {{ src: "/images/blog/{slug}.jpg", width: {im.width}, height: {im.height} }}\n'
        "  },\n"
    )
    marker = "export const blogPosts: BlogPost[] = [\n"
    if marker not in ts:
        fail("blogPosts array not found")
    blog_ts.write_text(ts.replace(marker, marker + entry, 1), encoding="utf-8")

    # Dictionaries: insert right after `"blogData": {` keeping the file's own formatting.
    for loc in LOCALES:
        path = ROOT / f"src/i18n/{loc}.json"
        text = path.read_text(encoding="utf-8")
        opener = '  "blogData": {\n'
        if text.count(opener) != 1:
            fail(f"blogData block not found in {loc}.json")
        block = json.dumps(art[loc], ensure_ascii=False, indent=2).replace("\n", "\n    ")
        text = text.replace(opener, f'{opener}    "{slug}": {block},\n', 1)
        json.loads(text)  # still valid JSON
        path.write_text(text, encoding="utf-8")

    words = len(" ".join(art["en"]["body"]).split())
    print(f"added {slug}: priority {prio}, cover {im.width}x{im.height}, {words} English words")


if __name__ == "__main__":
    main()
