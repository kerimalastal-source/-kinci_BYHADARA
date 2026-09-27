import { t, link, getProjectContent } from "../i18n";
import { getProjectBySlug } from "../data/projects";

// The visitor's shortlist of projects (the heart buttons). Kept in this browser
// only; the contact form preselects it so one enquiry covers every saved project.
const KEY = "hadara-favorites";
const EVENT = "hadara:favorites";
let memory: string[] = [];

const HEART_PATH =
  '<path d="M12 20.3s-7.4-4.4-9.2-9.3C1.7 7.8 3.9 4.6 7.2 4.6c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.2 4.4 6.4-1.8 4.9-9.2 9.3-9.2 9.3z"/>';
export const HEART_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${HEART_PATH}</svg>`;

export function getFavorites(): string[] {
  let list = memory;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(stored)) list = stored;
  } catch {
    // Storage blocked (private mode): the list lives for this page view only.
  }
  return [...new Set(list)].filter((slug): slug is string => typeof slug === "string" && Boolean(getProjectBySlug(slug)));
}

export function setFavorites(list: string[]): void {
  memory = [...new Set(list)];
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Kept in memory only.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const isFavorite = (slug: string) => getFavorites().includes(slug);

/** Contact page link that preselects every saved project. */
export const favoritesHref = () => `${link("/contact")}?project=${getFavorites().join(",")}`;

/** Heart toggle for a project; `variant` picks the look (over a card photo or on the dark hero). */
export function favoriteButton(slug: string, variant: "card" | "hero"): string {
  const on = isFavorite(slug);
  const name = getProjectContent(slug).name;
  return `<button type="button" class="fav-btn fav-btn--${variant}" data-fav="${slug}" aria-pressed="${on}" aria-label="${t(on ? "favorites.remove" : "favorites.add", { name })}">${HEART_ICON}</button>`;
}

/** Heart + count in the header, shown once something is saved. */
export function renderFavoritesLink(): string {
  const count = getFavorites().length;
  return `<a class="icon-btn fav-link" id="fav-link" href="${favoritesHref()}" aria-label="${t("favorites.header", { count })}"${count ? "" : " hidden"}>${HEART_ICON}<span class="fav-link__count" dir="ltr">${count}</span></a>`;
}

function syncButtons(): void {
  const favorites = getFavorites();
  document.querySelectorAll<HTMLButtonElement>("[data-fav]").forEach((btn) => {
    const slug = btn.dataset.fav!;
    const on = favorites.includes(slug);
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", t(on ? "favorites.remove" : "favorites.add", { name: getProjectContent(slug).name }));
  });
  const headerLink = document.querySelector<HTMLAnchorElement>("#fav-link");
  if (headerLink) {
    headerLink.hidden = favorites.length === 0;
    headerLink.href = favoritesHref();
    headerLink.setAttribute("aria-label", t("favorites.header", { count: favorites.length }));
    headerLink.querySelector(".fav-link__count")!.textContent = String(favorites.length);
  }
}

let toastTimer = 0;

function showToast(saved: boolean): void {
  document.querySelector(".fav-toast")?.remove();
  const count = getFavorites().length;
  const toast = document.createElement("div");
  toast.className = "fav-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <span class="fav-toast__icon${saved ? " is-on" : ""}">${HEART_ICON}</span>
    <span class="fav-toast__text">${t(saved ? "favorites.saved" : "favorites.removed")}</span>
    ${count ? `<a class="fav-toast__link" href="${favoritesHref()}">${t("favorites.enquire", { count })}</a>` : ""}`;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/** One delegated listener for every heart on every page, plus live updates of all hearts. */
export function initFavorites(): void {
  document.addEventListener("click", (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>("[data-fav]");
    if (!btn) return;
    e.preventDefault();
    const slug = btn.dataset.fav!;
    const list = getFavorites();
    const saved = !list.includes(slug);
    setFavorites(saved ? [...list, slug] : list.filter((s) => s !== slug));
    if (saved) {
      btn.classList.remove("is-popping");
      void btn.offsetWidth;
      btn.classList.add("is-popping");
    }
    showToast(saved);
  });
  window.addEventListener(EVENT, syncButtons);
  // Another tab changed the list.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) syncButtons();
  });
}
