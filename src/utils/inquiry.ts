// Sends a form to the inquiries inbox (POST /api/inquiry, supabase/migrations/0007) —
// used by the contact, property request and consultation forms. When the inbox can't take
// it (network error, or the migration hasn't been run yet), the form falls back to its
// old mailto: delivery, so a message is never lost.
import { t, getLocale } from "../i18n";
import { campaignSource } from "./campaign";
import { escapeHtml } from "./html";

const ENDPOINT = "/api/inquiry";
const TIMEOUT_MS = 12_000;

export type InquiryKind = "contact" | "property_request" | "consultation";

export interface InquiryPayload {
  kind: InquiryKind;
  name: string;
  email: string;
  phone: string;
  subject?: string;
  message?: string;
  /** Project slugs with their Arabic names (the team's alert is in Arabic). */
  projects?: { slug: string; nameAr: string }[];
  interests?: string[];
  interestsAr?: string[];
  /** The form's other answers as option keys, saved for the admin inbox. */
  details?: Record<string, string>;
  /** The same answers as [label, value] in Arabic, for the team's alert. */
  summaryAr?: [string, string][];
}

export type InquiryResult = { status: "sent"; reference: string } | { status: "limit" } | { status: "fallback" };

/** The hidden field bots fill in (label read by screen readers only if CSS fails). */
export function honeypotField(): string {
  return `<div class="tour-hp" aria-hidden="true"><label>${t("inquiry.honeypot")} <input type="text" name="website" tabindex="-1" autocomplete="off" data-inquiry-hp /></label></div>`;
}

export async function sendInquiry(form: HTMLFormElement, payload: InquiryPayload, openedAt: number): Promise<InquiryResult> {
  const body = {
    ...payload,
    locale: getLocale(),
    source: campaignSource() || null,
    page: window.location.pathname,
    website: form.querySelector<HTMLInputElement>("[data-inquiry-hp]")?.value ?? "",
    elapsedMs: Date.now() - openedAt
  };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const data = (await res.json().catch(() => ({}))) as { reference?: string };
    if (res.status === 200 && data.reference) return { status: "sent", reference: data.reference };
    if (res.status === 429) return { status: "limit" };
  } catch {
    // Offline, blocked or too slow: the email fallback below.
  }
  return { status: "fallback" };
}

/** Shows the "received" box with the request number. */
export function showSent(box: HTMLElement, reference: string): void {
  box.dataset.original ??= box.innerHTML;
  box.innerHTML = `<strong>${t("inquiry.sentTitle")}</strong>
    <p>${t("inquiry.sentText")}</p>
    <p class="contact-form__reference">${t("inquiry.reference", { ref: `<bdi dir="ltr">${escapeHtml(reference)}</bdi>` })}</p>`;
  box.hidden = false;
  box.classList.remove("contact-form__success--warn");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/** Too many messages from the same email / phone today. */
export function showLimit(box: HTMLElement): void {
  box.dataset.original ??= box.innerHTML;
  box.innerHTML = `<strong>${t("inquiry.limitTitle")}</strong><p>${t("inquiry.limitText")}</p>`;
  box.hidden = false;
  box.classList.add("contact-form__success--warn");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/** The form's own "your email app will open" box, for the mailto: fallback. */
export function showMailtoSent(box: HTMLElement): void {
  if (box.dataset.original) box.innerHTML = box.dataset.original;
  box.classList.remove("contact-form__success--warn");
  box.hidden = false;
}

/** Disables the submit button with "Sending…" while the request is on its way. */
export function setSending(button: HTMLButtonElement | null, sending: boolean): void {
  if (!button) return;
  if (sending) {
    button.dataset.label = button.textContent ?? "";
    button.textContent = t("inquiry.sending");
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.disabled = sending;
  button.setAttribute("aria-busy", String(sending));
}
