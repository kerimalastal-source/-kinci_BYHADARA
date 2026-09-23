/** Fades/slides [data-reveal] elements into view once, staggered by their index among siblings. */
export function initScrollReveal(container: ParentNode): void {
  const elements = container.querySelectorAll<HTMLElement>("[data-reveal]");
  if (elements.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const index = Number(el.dataset.revealIndex ?? 0);
          setTimeout(() => el.classList.add("is-visible"), index * 80);
          observer.unobserve(el);
        }
      }
    },
    { threshold: 0.2 }
  );

  elements.forEach((el) => observer.observe(el));
}
