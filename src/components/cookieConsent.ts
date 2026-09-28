import { t, link, onLocaleChange } from "../i18n";
import { setConsent, storedConsent, trackingConfigured, type Consent } from "../utils/tracking";
import { reportConsent } from "../utils/visitorTracker";

/**
 * Cookie notice: Meta Pixel and Google tags only load after "Accept" (see utils/tracking.ts).
 * A small card at the bottom-left (full width on phones), shown until the visitor chooses;
 * "Cookie settings" in the footer ([data-cookie-settings]) brings it back to change the choice.
 */

/** Section 8 of the privacy policy: cookies and similar technologies. */
const POLICY_ANCHOR = "#policy-8";

let panel: HTMLElement | null = null;
/** Shown on its own (not reopened from the footer): this visit's answer goes into the statistics. */
let counted = false;
let resize: ResizeObserver | null = null;

function render(el: HTMLElement): void {
  el.setAttribute("aria-label", t("consent.label"));
  el.innerHTML = `
    <div class="cookie-consent__body">
      <p class="cookie-consent__title">${t("consent.title")}</p>
      <p class="cookie-consent__text">${t("consent.text")} <a href="${link("/privacy")}${POLICY_ANCHOR}">${t("consent.more")}</a></p>
    </div>
    <div class="cookie-consent__actions">
      <button type="button" class="btn btn--outline" data-consent="denied">${t("consent.decline")}</button>
      <button type="button" class="btn btn--primary" data-consent="granted">${t("consent.accept")}</button>
    </div>`;
}

/** Lets the floating buttons and the saved-projects toast step up above the card on phones. */
function trackHeight(el: HTMLElement): void {
  const set = () => document.documentElement.style.setProperty("--consent-h", `${el.offsetHeight}px`);
  set();
  if ("ResizeObserver" in window) {
    resize = new ResizeObserver(set);
    resize.observe(el);
  }
}

function open(focus = false): void {
  if (panel) {
    if (focus) panel.querySelector<HTMLButtonElement>("[data-consent]")?.focus();
    return;
  }
  const el = document.createElement("section");
  el.className = "cookie-consent";
  render(el);
  el.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-consent]");
    if (button) close(button.dataset.consent as Consent);
  });
  document.body.appendChild(el);
  document.body.classList.add("consent-open");
  trackHeight(el);
  panel = el;
  requestAnimationFrame(() => el.classList.add("is-visible"));
  if (focus) el.querySelector<HTMLButtonElement>("[data-consent]")?.focus();
}

function close(choice: Consent): void {
  setConsent(choice);
  if (counted) reportConsent(choice);
  resize?.disconnect();
  resize = null;
  panel?.remove();
  panel = null;
  document.body.classList.remove("consent-open");
  document.documentElement.style.removeProperty("--consent-h");
}

export function initCookieConsent(): void {
  if (!trackingConfigured()) return;
  if (!storedConsent()) {
    open();
    counted = true;
    reportConsent("none");
  }
  document.addEventListener("click", (event) => {
    const trigger = (event.target as Element | null)?.closest?.("[data-cookie-settings]");
    if (!trigger) return;
    event.preventDefault();
    open(true);
  });
  onLocaleChange(() => {
    if (panel) render(panel);
  });
}

/** For the footer: the "Cookie settings" link, only when there are tags to consent to. */
export function cookieSettingsLink(className: string): string {
  return trackingConfigured() ? `<button type="button" class="${className}" data-cookie-settings>${t("footer.cookieSettings")}</button>` : "";
}
