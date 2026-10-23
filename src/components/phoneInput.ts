import { countries, defaultCountryIso2 } from "../data/countries";
import { getLocale, t } from "../i18n";

/*
 * The country code is a searchable field: typing a letter lists the matching countries (by their
 * name in the page language or in English, their ISO code, or the dialling code). The hidden
 * <select> stays the source of truth, so getPhoneValue() and any code that reads or sets its
 * selectedIndex keep working; set it and dispatch "change" and the field follows.
 */

const flag = (iso2: string) => iso2.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

let namesLocale = "";
let displayNames: Intl.DisplayNames | null = null;
function localName(iso2: string, fallback: string): string {
  if (namesLocale !== getLocale()) {
    namesLocale = getLocale();
    entries = null;
    try {
      displayNames = new Intl.DisplayNames([namesLocale], { type: "region" });
    } catch {
      displayNames = null;
    }
  }
  try {
    return displayNames?.of(iso2) || fallback;
  } catch {
    return fallback;
  }
}

/** Lower case, no accents or tatweel, Arabic/Persian letter variants folded, so "turkiye" finds "Türkiye". */
function fold(text: string): string {
  return text
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٟـ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىی]/g, "ي")
    .replace(/ک/g, "ك")
    .trim();
}

/** "🇸🇦 +966 · Saudi Arabia" (code first, so it stays visible when the name is cut). */
function display(index: number): string {
  const c = countries[index];
  if (!c) return "";
  // The LRM keeps "+966" in that order next to an Arabic or Persian name.
  return `${flag(c.iso2)} \u200E+${c.dial} · ${localName(c.iso2, c.name)}`;
}

/** Renders a searchable country-code field + national-number input pair. `idPrefix` must be unique per form instance. */
export function renderPhoneInput(idPrefix: string, name: string): string {
  const selected = Math.max(0, countries.findIndex((c) => c.iso2 === defaultCountryIso2));
  const label = t("phoneInput.label");
  return `
    <div class="phone-field">
      <select class="phone-field__country" id="${idPrefix}-country" aria-hidden="true" tabindex="-1">
        ${countries
          .map((c, i) => `<option value="${c.dial}"${i === selected ? " selected" : ""}>${c.name} (+${c.dial})</option>`)
          .join("")}
      </select>
      <div class="phone-field__picker">
        <input type="text" class="phone-field__code" id="${idPrefix}-code" dir="ltr" role="combobox"
          aria-label="${label}" aria-autocomplete="list" aria-expanded="false" aria-controls="${idPrefix}-codes"
          autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
          placeholder="${t("phoneInput.search")}" value="${display(selected)}" />
        <ul class="phone-field__menu" id="${idPrefix}-codes" role="listbox" aria-label="${label}" hidden></ul>
      </div>
      <input dir="ltr" type="tel" class="phone-field__number" id="${idPrefix}-number" name="${name}" placeholder="5xx xxx xx xx" autocomplete="tel-national" />
    </div>
  `;
}

interface Entry {
  index: number;
  local: string;
  english: string;
  iso2: string;
  dial: string;
}

let entries: Entry[] | null = null;
function allEntries(): Entry[] {
  localName("TR", ""); // resets the list when the page language changed
  if (entries) return entries;
  const collator = new Intl.Collator(getLocale());
  entries = countries
    .map((c, index) => {
      const local = localName(c.iso2, c.name);
      return { index, local, english: fold(c.name), iso2: c.iso2.toLowerCase(), dial: c.dial.replace(/\D/g, "") };
    })
    // Turkey first, then the countries in the page language's alphabetical order.
    .sort((a, b) => (a.iso2 === "tr" ? -1 : b.iso2 === "tr" ? 1 : collator.compare(a.local, b.local)));
  return entries;
}

/** Matching countries, best first: name or code starting with the query, then a word starting with it, then anywhere. */
function search(query: string): Entry[] {
  const all = allEntries();
  const q = fold(query.replace(/^\s*(\+|00)/, ""));
  if (!q) return all;
  const digits = /^\d[\d\s-]*$/.test(q) ? q.replace(/\D/g, "") : "";
  const ranked: { e: Entry; rank: number }[] = [];
  for (const e of all) {
    let rank = -1;
    if (digits) {
      if (e.dial.startsWith(digits)) rank = e.dial === digits ? 0 : 1;
    } else {
      const names = [fold(e.local), e.english];
      if (e.iso2 === q || names.some((n) => n.startsWith(q))) rank = 0;
      else if (names.some((n) => n.split(/[\s-]+/).some((w) => w.startsWith(q)))) rank = 1;
      else if (names.some((n) => n.includes(q))) rank = 2;
    }
    if (rank >= 0) ranked.push({ e, rank });
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.e);
}

interface Picker {
  input: HTMLInputElement;
  menu: HTMLUListElement;
  select: HTMLSelectElement;
}

function pickerOf(el: Element | null): Picker | null {
  const field = el?.closest(".phone-field");
  const input = field?.querySelector<HTMLInputElement>(".phone-field__code");
  const menu = field?.querySelector<HTMLUListElement>(".phone-field__menu");
  const select = field?.querySelector<HTMLSelectElement>(".phone-field__country");
  return input && menu && select ? { input, menu, select } : null;
}

function showList(p: Picker, query: string): void {
  const found = search(query);
  const id = p.menu.id;
  p.menu.innerHTML = found.length
    ? found
        .map(
          (e) =>
            `<li role="option" id="${id}-${e.index}" data-index="${e.index}" aria-selected="${e.index === p.select.selectedIndex}">` +
            `<span class="phone-field__flag" aria-hidden="true">${flag(e.iso2.toUpperCase())}</span>` +
            `<span class="phone-field__name">${e.local}</span>` +
            `<span class="phone-field__dial" dir="ltr">+${e.dial}</span></li>`
        )
        .join("")
    : `<li class="phone-field__empty" aria-disabled="true">${t("phoneInput.noResults")}</li>`;
  p.menu.hidden = false;
  p.input.setAttribute("aria-expanded", "true");
  // Typing highlights the best match; opening the list highlights (and shows) the current country.
  const target = query.trim()
    ? p.menu.querySelector<HTMLElement>("[data-index]")
    : p.menu.querySelector<HTMLElement>(`[data-index="${p.select.selectedIndex}"]`);
  highlight(p, target, !query.trim());
}

function highlight(p: Picker, item: HTMLElement | null, center = false): void {
  p.menu.querySelector(".is-active")?.classList.remove("is-active");
  if (!item) return p.input.removeAttribute("aria-activedescendant");
  item.classList.add("is-active");
  p.input.setAttribute("aria-activedescendant", item.id);
  if (center) p.menu.scrollTop = item.offsetTop - p.menu.clientHeight / 2 + item.offsetHeight / 2;
  else item.scrollIntoView({ block: "nearest" });
}

function close(p: Picker): void {
  p.menu.hidden = true;
  p.input.setAttribute("aria-expanded", "false");
  p.input.removeAttribute("aria-activedescendant");
  p.input.dir = "ltr";
  p.input.value = display(p.select.selectedIndex);
}

function choose(p: Picker, index: number): void {
  if (index !== p.select.selectedIndex) {
    p.select.selectedIndex = index;
    p.select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  close(p);
}

let started = false;
/** One set of document listeners for every phone field on the site (forms are re-rendered often). */
export function initPhoneInputs(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const isCode = (el: EventTarget | null): el is HTMLInputElement =>
    el instanceof HTMLInputElement && el.classList.contains("phone-field__code");

  document.addEventListener("focusin", (e) => {
    if (!isCode(e.target)) return;
    const p = pickerOf(e.target);
    if (!p || !p.menu.hidden) return;
    showList(p, "");
    e.target.select();
  });
  // Opening by tap when the field already has focus (the list was closed by a choice).
  document.addEventListener("click", (e) => {
    if (!isCode(e.target)) return;
    const p = pickerOf(e.target);
    if (p?.menu.hidden) {
      showList(p, "");
      e.target.select();
    }
  });
  document.addEventListener("input", (e) => {
    if (!isCode(e.target)) return;
    const p = pickerOf(e.target);
    if (!p) return;
    e.target.dir = "auto";
    showList(p, e.target.value);
  });
  document.addEventListener("keydown", (e) => {
    if (!isCode(e.target)) return;
    const p = pickerOf(e.target);
    if (!p) return;
    const items = [...p.menu.querySelectorAll<HTMLElement>("[data-index]")];
    const at = items.findIndex((i) => i.classList.contains("is-active"));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (p.menu.hidden) return showList(p, "");
      const next = e.key === "ArrowDown" ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
      highlight(p, items[next] ?? null);
    } else if (e.key === "Enter") {
      if (p.menu.hidden) return;
      e.preventDefault(); // never submit the form from the search box
      if (items[at]) choose(p, Number(items[at].dataset.index));
    } else if (e.key === "Escape" && !p.menu.hidden) {
      e.preventDefault();
      e.stopPropagation();
      close(p);
    } else if (e.key === "Tab" && !p.menu.hidden) {
      // Tab keeps a country the visitor has narrowed the list down to.
      if (p.input.value.trim() && items[at]) choose(p, Number(items[at].dataset.index));
      else close(p);
    }
  });
  // Keep focus in the search box while a country is pressed, then take it on click.
  document.addEventListener("mousedown", (e) => {
    if (e.target instanceof Element && e.target.closest(".phone-field__menu")) e.preventDefault();
  });
  document.addEventListener("click", (e) => {
    const item = e.target instanceof Element ? e.target.closest<HTMLElement>(".phone-field__menu [data-index]") : null;
    const p = pickerOf(item);
    if (item && p) choose(p, Number(item.dataset.index));
  });
  document.addEventListener("focusout", (e) => {
    if (!isCode(e.target)) return;
    const p = pickerOf(e.target);
    // A tap on the list (touch screens move focus first) is handled by its click.
    if (p && !(e.relatedTarget instanceof Element && p.menu.contains(e.relatedTarget))) {
      setTimeout(() => {
        if (document.activeElement !== p.input) close(p);
      }, 150);
    }
  });
  // The country chosen elsewhere (a pasted "+974 ..." number, a form reset) shows in the field.
  document.addEventListener("change", (e) => {
    if (e.target instanceof HTMLSelectElement && e.target.classList.contains("phone-field__country")) {
      const p = pickerOf(e.target);
      if (p && p.menu.hidden) p.input.value = display(e.target.selectedIndex);
    }
  });
  document.addEventListener("reset", (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    setTimeout(() => {
      form.querySelectorAll<HTMLSelectElement>(".phone-field__country").forEach((s) => {
        const p = pickerOf(s);
        if (p) close(p);
      });
    });
  });
}

/** Combined "+<dial> <number>" value, or "" if the national number is empty. */
export function getPhoneValue(container: ParentNode, idPrefix: string): string {
  const dial = container.querySelector<HTMLSelectElement>(`#${idPrefix}-country`)?.value ?? "";
  const number = container.querySelector<HTMLInputElement>(`#${idPrefix}-number`)?.value.trim() ?? "";
  return number ? `+${dial} ${number}` : "";
}

export function isPhoneFilled(container: ParentNode, idPrefix: string): boolean {
  return (container.querySelector<HTMLInputElement>(`#${idPrefix}-number`)?.value.trim() ?? "") !== "";
}

export function isPhoneValid(container: ParentNode, idPrefix: string): boolean {
  const number = container.querySelector<HTMLInputElement>(`#${idPrefix}-number`)?.value.trim() ?? "";
  return /^[\d\s-]{4,14}$/.test(number);
}

export function setPhoneInvalid(container: ParentNode, idPrefix: string, invalid: boolean): void {
  const input = container.querySelector<HTMLInputElement>(`#${idPrefix}-number`);
  input?.setAttribute("aria-invalid", invalid ? "true" : "false");
}
