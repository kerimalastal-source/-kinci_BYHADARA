// Lighter WebP copies of the site's JPG photos (made by scripts/images/build-webp.py),
// so phones and tablets download a size that fits them instead of the full photo.

/** Widths of the WebP copies; keep in sync with WIDTHS in scripts/images/build-webp.py. */
const WEBP_WIDTHS = [320, 640, 1280];

interface Photo {
  src: string;
  width: number;
}

const hasCopies = (photo: Photo) => photo.src.startsWith("/") && photo.src.endsWith(".jpg");

/** URL of the WebP copy of a given width (only for widths below the photo's own). */
const copyUrl = (photo: Photo, width: number) => `${photo.src.slice(0, -4)}-${width}.webp`;

/** "…-320.webp 320w, …-640.webp 640w, …-1280.webp 1280w, ….jpg 2000w" */
export function photoSrcset(photo: Photo): string {
  if (!hasCopies(photo)) return "";
  const copies = WEBP_WIDTHS.filter((w) => w < photo.width).map((w) => `${copyUrl(photo, w)} ${w}w`);
  return [...copies, `${photo.src} ${photo.width}w`].join(", ");
}

/** `src`, `srcset` and `sizes` attributes for an <img>; `sizes` is how wide the image shows. */
export function photoAttrs(photo: Photo, sizes: string): string {
  const srcset = photoSrcset(photo);
  return `src="${photo.src}"${srcset ? ` srcset="${srcset}" sizes="${sizes}"` : ""}`;
}

/** The 1280px copy for full-width backgrounds on phones and tablets (the original on large screens). */
export function photoForPhones(photo: Photo): string {
  return hasCopies(photo) && photo.width > 1280 ? copyUrl(photo, 1280) : photo.src;
}

/** Inline style for a full-width hero background: the shade on top of the photo, lighter on small screens. */
export function heroBackground(photo: Photo, shade: string): string {
  return `--hero-shade: ${shade}; --hero-photo: url('${photo.src}'); --hero-photo-sm: url('${photoForPhones(photo)}')`;
}
