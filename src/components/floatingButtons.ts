import { t } from "../i18n";

/** Company WhatsApp / phone number in E.164 form without the plus. */
export const WHATSAPP_NUMBER = "905319309214";

export const WHATSAPP_ICON = `<svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.34.664 4.523 1.815 6.377L4 29l7.828-1.767A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm6.98 16.86c-.29.815-1.688 1.56-2.32 1.653-.593.088-1.33.124-2.148-.135-.495-.157-1.13-.367-1.945-.72-3.425-1.48-5.66-4.916-5.83-5.146-.17-.23-1.4-1.86-1.4-3.55 0-1.688.885-2.518 1.2-2.862.315-.345.687-.43.916-.43.23 0 .458.002.658.012.21.01.492-.08.77.586.29.7.984 2.42 1.07 2.595.086.174.144.38.028.61-.115.23-.174.373-.345.575-.172.202-.36.45-.516.606-.172.172-.35.36-.15.71.2.35.887 1.463 1.905 2.37 1.31 1.166 2.416 1.527 2.774 1.7.358.172.567.144.777-.086.21-.23.898-1.044 1.14-1.402.24-.358.483-.298.813-.18.33.115 2.09.985 2.448 1.165.358.18.596.27.685.42.086.15.086.87-.204 1.687Z"/></svg>`;

const CALL_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;

/* Round buttons on the right of the screen on desktop and tablet; on phones the
   same two links become a fixed bottom bar with text labels (see
   components.css), so they never sit on top of page content. */
export function renderFloatingButtons(el: HTMLElement): void {
  el.className = "floating-actions";
  el.innerHTML = `
    <a
      class="floating-actions__btn floating-actions__btn--whatsapp"
      href="https://wa.me/${WHATSAPP_NUMBER}"
      target="_blank"
      rel="noopener"
      aria-label="${t("floatingActions.whatsapp")}"
      title="${t("floatingActions.whatsapp")}"
    >
      ${WHATSAPP_ICON}
      <span class="floating-actions__label">${t("floatingActions.whatsappShort")}</span>
    </a>
    <a
      class="floating-actions__btn floating-actions__btn--call"
      href="tel:+${WHATSAPP_NUMBER}"
      aria-label="${t("floatingActions.call")}"
      title="${t("floatingActions.call")}"
    >
      ${CALL_ICON}
      <span class="floating-actions__label">${t("floatingActions.callShort")}</span>
    </a>
  `;
}
