import { countries, defaultCountryIso2 } from "../data/countries";

/** Renders a country-code select + national-number input pair. `idPrefix` must be unique per form instance. */
export function renderPhoneInput(idPrefix: string, name: string): string {
  return `
    <div class="phone-field">
      <select class="phone-field__country" id="${idPrefix}-country" aria-label="Country code">
        ${countries
          .map(
            (c) =>
              `<option value="${c.dial}"${c.iso2 === defaultCountryIso2 ? " selected" : ""}>${c.name} (+${c.dial})</option>`
          )
          .join("")}
      </select>
      <input dir="ltr" type="tel" class="phone-field__number" id="${idPrefix}-number" name="${name}" placeholder="5xx xxx xx xx" autocomplete="tel-national" />
    </div>
  `;
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
