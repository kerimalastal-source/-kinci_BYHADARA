interface LightboxImage {
  src: string;
  alt: string;
}

let overlay: HTMLDivElement | null = null;
let images: LightboxImage[] = [];
let currentIndex = 0;

function render(): void {
  if (!overlay) return;
  const img = images[currentIndex];
  const imgEl = overlay.querySelector<HTMLImageElement>(".lightbox__image")!;
  imgEl.src = img.src;
  imgEl.alt = img.alt;
  const counter = overlay.querySelector<HTMLElement>(".lightbox__counter")!;
  counter.textContent = `${currentIndex + 1} / ${images.length}`;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowRight") step(1);
  if (e.key === "ArrowLeft") step(-1);
}

function step(delta: number): void {
  currentIndex = (currentIndex + delta + images.length) % images.length;
  render();
}

export function openLightbox(imgs: LightboxImage[], startIndex: number): void {
  images = imgs;
  currentIndex = startIndex;

  overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.innerHTML = `
    <button type="button" class="lightbox__close" aria-label="Close">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
    <button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Previous">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
    <figure class="lightbox__figure">
      <img class="lightbox__image" src="" alt="" />
    </figure>
    <button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Next">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>
    <span class="lightbox__counter"></span>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  render();

  overlay.querySelector(".lightbox__close")!.addEventListener("click", closeLightbox);
  overlay.querySelector(".lightbox__nav--prev")!.addEventListener("click", () => step(-1));
  overlay.querySelector(".lightbox__nav--next")!.addEventListener("click", () => step(1));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLightbox();
  });
  document.addEventListener("keydown", onKeydown);
}

export function closeLightbox(): void {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onKeydown);
}
