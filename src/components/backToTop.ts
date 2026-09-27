import { t, onLocaleChange } from "../i18n";

const ARROW_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>';
/** Circumference of the progress ring (r = 21). */
const RING = 2 * Math.PI * 21;
/** Shown once the visitor has scrolled this far. */
const SHOW_AFTER = 480;

/**
 * Floating "back to top" button (bottom-left, away from the WhatsApp/call column). A thin gold ring
 * fills as the page scrolls; a tap glides back to the top (instantly with reduced motion).
 */
export function initBackToTop(): void {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "back-to-top";
  button.innerHTML = `
    <svg class="back-to-top__ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" />
      <circle class="back-to-top__progress" cx="24" cy="24" r="21" stroke-dasharray="${RING}" stroke-dashoffset="${RING}" />
    </svg>
    ${ARROW_ICON}`;
  const progress = button.querySelector<SVGCircleElement>(".back-to-top__progress")!;
  const setLabel = () => {
    button.setAttribute("aria-label", t("floatingActions.backToTop"));
    button.title = t("floatingActions.backToTop");
  };
  setLabel();
  onLocaleChange(setLabel);
  document.body.appendChild(button);

  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    button.classList.toggle("is-visible", y > SHOW_AFTER);
    progress.style.strokeDashoffset = String(RING * (1 - (max > 0 ? Math.min(1, y / max) : 0)));
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();

  button.addEventListener("click", (e) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    // From the keyboard (no pointer), focus moves to the top of the page with the view.
    if (e.detail === 0) document.querySelector<HTMLElement>(".skip-link")?.focus({ preventScroll: true });
    else button.blur();
  });
}
