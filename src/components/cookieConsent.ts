import { t, link, onLocaleChange } from "../i18n";
import { consentSummary, setConsent, storedConsent, trackingConfigured, type ConsentChoice } from "../utils/tracking";
import { reportConsent } from "../utils/visitorTracker";

/**
 * Cookie notice: Meta Pixel and Google tags only load after the visitor allows them (see utils/tracking.ts).
 * A small card at the bottom-left (full width on phones), shown until the visitor chooses:
 * "Accept" and "Decline" side by side, and a small "Customise" link that turns the card into
 * two switches (analytics = Google Analytics, advertising = Meta + Google Ads).
 * "Cookie settings" in the footer ([data-cookie-settings]) brings it back to change the choice.
 */

/** Section 8 of the privacy policy: cookies and similar technologies. */
const POLICY_ANCHOR = "#policy-8";

type Category = keyof ConsentChoice;
const CATEGORIES: Category[] = ["analytics", "ads"];

let panel: HTMLElement | null = null;
let view: "main" | "settings" = "main";
/** The switches while the settings view is open (kept across a language change). */
let draft: ConsentChoice = { analytics: false, ads: false };
/** Shown on its own (not reopened from the footer): this visit's answer goes into the statistics. */
let counted = false;
let resize: ResizeObserver | null = null;

function option(key: Category | "essential"): string {
  const id = `consent-${key}`;
  const control =
    key === "essential"
      ? `<span class="cookie-consent__always">${t("consent.alwaysOn")}</span>`
      : `<span class="consent-switch">
          <input type="checkbox" role="switch" id="${id}" data-consent-option="${key}"${draft[key] ? " checked" : ""}>
          <span class="consent-switch__track" aria-hidden="true"></span>
        </span>`;
  return `
    <li class="cookie-consent__option">
      <div class="cookie-consent__option-text">
        ${key === "essential" ? `<span class="cookie-consent__option-title">` : `<label class="cookie-consent__option-title" for="${id}">`}${t(`consent.${key}Title`)}${key === "essential" ? "</span>" : "</label>"}
        <p>${t(`consent.${key}Text`)}</p>
      </div>
      ${control}
    </li>`;
}

function render(el: HTMLElement): void {
  el.setAttribute("aria-label", t("consent.label"));
  el.classList.toggle("cookie-consent--settings", view === "settings");
  const more = `<a href="${link("/privacy")}${POLICY_ANCHOR}">${t("consent.more")}</a>`;
  if (view === "settings") {
    el.innerHTML = `
      <div class="cookie-consent__body">
        <p class="cookie-consent__title">${t("consent.settingsTitle")}</p>
        <p class="cookie-consent__text">${t("consent.settingsIntro")} ${more}</p>
      </div>
      <ul class="cookie-consent__options">
        ${option("essential")}
        ${CATEGORIES.map(option).join("")}
      </ul>
      <div class="cookie-consent__actions">
        <button type="button" class="btn btn--outline" data-consent="denied">${t("consent.declineAll")}</button>
        <button type="button" class="btn btn--primary" data-consent="save">${t("consent.save")}</button>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="cookie-consent__body">
      <p class="cookie-consent__title">${t("consent.title")}</p>
      <p class="cookie-consent__text">${t("consent.text")} ${more}</p>
    </div>
    <div class="cookie-consent__actions">
      <button type="button" class="btn btn--outline" data-consent="denied">${t("consent.decline")}</button>
      <button type="button" class="btn btn--primary" data-consent="granted">${t("consent.accept")}</button>
    </div>
    <button type="button" class="cookie-consent__customize" data-consent-view="settings">${t("consent.customize")}</button>`;
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

function showSettings(el: HTMLElement): void {
  view = "settings";
  render(el);
  el.querySelector<HTMLInputElement>("[data-consent-option]")?.focus();
}

function open(focus = false): void {
  if (panel) {
    if (focus) panel.querySelector<HTMLElement>("[data-consent], [data-consent-option]")?.focus();
    return;
  }
  view = "main";
  draft = storedConsent() ?? { analytics: false, ads: false };
  const el = document.createElement("section");
  el.className = "cookie-consent";
  render(el);
  el.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target.closest("[data-consent-view]")) {
      showSettings(el);
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-consent]");
    if (!button) return;
    const action = button.dataset.consent;
    if (action === "granted") close({ analytics: true, ads: true });
    else if (action === "denied") close({ analytics: false, ads: false });
    else close({ ...draft });
  });
  el.addEventListener("change", (event) => {
    const input = (event.target as Element).closest<HTMLInputElement>("[data-consent-option]");
    if (input) draft[input.dataset.consentOption as Category] = input.checked;
  });
  document.body.appendChild(el);
  document.body.classList.add("consent-open");
  trackHeight(el);
  panel = el;
  requestAnimationFrame(() => el.classList.add("is-visible"));
  if (focus) el.querySelector<HTMLButtonElement>("[data-consent]")?.focus();
}

function close(choice: ConsentChoice): void {
  setConsent(choice);
  if (counted) reportConsent(consentSummary(choice));
  counted = false;
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
