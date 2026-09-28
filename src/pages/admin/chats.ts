import { t, link, intlTag } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { escapeHtml, isolateNumbers } from "../../utils/html";
import {
  fetchChatMessages,
  fetchLastMessages,
  fetchLiveChats,
  replyToChat,
  telegramReplies,
  type LiveChat,
  type LiveChatMessage
} from "../../data/liveChats";
import { adminHero, adminNav, queryParam } from "./nav";

/**
 * Live chats (/admin/chats): the visitors' conversations with the team from the site's
 * chat panel (supabase/migrations/0011). The team usually answers on Telegram (a reply to
 * the visitor's message); this page shows every conversation and can answer too. The top
 * box switches Telegram replies on (once) and shows whether they work.
 */

const ISTANBUL = "Europe/Istanbul";
const REFRESH_MS = 10_000;

const when = (iso: string) =>
  new Intl.DateTimeFormat(intlTag(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(Date.parse(iso));

function countryName(code: string | null): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([intlTag()], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Waiting for the team: the visitor wrote last. */
const waiting = (c: LiveChat) => !c.last_team_at || Date.parse(c.last_visitor_at) > Date.parse(c.last_team_at);

function rowHtml(c: LiveChat, last: LiveChatMessage | undefined, active: boolean): string {
  const who = c.name || c.contact || t("adminChats.visitor");
  const where = [c.city, countryName(c.country)].filter(Boolean).join(", ");
  return `<li><button type="button" class="chat-row${active ? " is-active" : ""}" data-chat-open="${escapeHtml(c.id)}">
    <span class="chat-row__top"><strong dir="auto">${escapeHtml(who)}</strong><span class="chat-row__time">${escapeHtml(when(c.updated_at))}</span></span>
    <span class="chat-row__meta"><span dir="ltr">${escapeHtml(c.reference)}</span>${c.locale ? ` · ${t(`lang.${c.locale}`)}` : ""}${where ? ` · ${escapeHtml(where)}` : ""}</span>
    ${last ? `<span class="chat-row__preview" dir="auto">${last.sender === "team" ? `${t("adminChats.you")}: ` : ""}${isolateNumbers(escapeHtml(last.body.slice(0, 90)))}</span>` : ""}
    ${waiting(c) ? `<span class="admin-tag admin-tag--late">${t("adminChats.waiting")}</span>` : ""}
  </button></li>`;
}

function threadHtml(c: LiveChat, messages: LiveChatMessage[]): string {
  const details = [
    c.contact ? `<span dir="ltr">${escapeHtml(c.contact)}</span>` : "",
    c.page ? `<a href="${escapeHtml(c.page)}" dir="ltr" target="_blank" rel="noopener">${escapeHtml(c.page)}</a>` : "",
    c.campaign ? `<span dir="ltr">${escapeHtml(c.campaign)}</span>` : ""
  ].filter(Boolean);
  const record = c.contact && /\d{6,}|@/.test(c.contact) ? `<a href="${link(`/admin/customers?q=${encodeURIComponent(c.contact)}`)}">${t("adminReplies.history")}</a>` : "";
  return `<header class="chat-thread__head">
      <h2 dir="auto">${escapeHtml(c.name || t("adminChats.visitor"))} <small dir="ltr">${escapeHtml(c.reference)}</small></h2>
      ${details.length ? `<p>${details.join(" · ")}</p>` : ""}${record ? `<p>${record}</p>` : ""}
    </header>
    <div class="chat-thread__log" data-thread-log>${messages
      .map(
        (m) => `<div class="chat-thread__msg chat-thread__msg--${m.sender}">
          <span class="chat-thread__who">${m.sender === "team" ? t("adminChats.team") : t("adminChats.visitor")} · ${escapeHtml(when(m.created_at))}</span>
          <p dir="auto">${isolateNumbers(escapeHtml(m.body))}</p>
        </div>`
      )
      .join("")}</div>
    <form class="chat-thread__reply" data-thread-reply>
      <textarea name="body" rows="2" dir="auto" maxlength="2000" placeholder="${t("adminChats.replyPlaceholder")}" aria-label="${t("adminChats.replyPlaceholder")}"></textarea>
      <button type="submit" class="btn btn--primary btn--small">${t("adminChats.send")}</button>
    </form>
    <p class="admin-panel__hint">${t("adminChats.replyHint")}</p>`;
}

export function renderAdminChats(main: HTMLElement): void {
  if (!requireAdmin(main)) return;

  main.innerHTML = `
    ${adminHero(t("adminChats.heroTitle"), t("adminChats.heroSubtitle"))}
    <section class="section admin-chats">
      <div class="container">
        ${adminNav("chats")}
        <div class="admin-panel chat-telegram" data-telegram><p>${t("common.loading")}</p></div>
        <div class="chat-admin" data-chat-admin><p>${t("common.loading")}</p></div>
      </div>
    </section>`;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;
  const live = () => main.dataset.requestId === requestId;
  const telegramEl = main.querySelector<HTMLElement>("[data-telegram]")!;
  const adminEl = main.querySelector<HTMLElement>("[data-chat-admin]")!;
  let chats: LiveChat[] = [];
  let lastById = new Map<string, LiveChatMessage>();
  let openId = queryParam("chat");
  let timer: number | undefined;

  const paintTelegram = (status: Awaited<ReturnType<typeof telegramReplies>>) => {
    if (!status) {
      telegramEl.innerHTML = `<p class="admin-panel__hint">${t("adminChats.telegramUnknown")}</p>`;
      return;
    }
    if (status.missing) {
      telegramEl.innerHTML = `<p class="admin-panel__hint">${t(status.missing === "secret" ? "adminChats.telegramNoSecret" : "adminChats.telegramNoBot")}</p>`;
      return;
    }
    telegramEl.innerHTML = status.active
      ? `<p class="chat-telegram__ok">✅ ${t("adminChats.telegramOn")}</p>${status.lastError ? `<p class="admin-panel__hint">${t("adminChats.telegramLastError")}: <span dir="ltr">${escapeHtml(status.lastError)}</span></p>` : ""}`
      : `<p>${t("adminChats.telegramOff")}</p><button type="button" class="btn btn--primary btn--small" data-telegram-on>${t("adminChats.telegramActivate")}</button>`;
  };

  const paint = async () => {
    const list = await fetchLiveChats();
    if (!live()) return;
    if (!list) {
      adminEl.innerHTML = `<p class="admin-bookings__empty">${t("adminChats.unavailable")}</p>`;
      return;
    }
    chats = list;
    lastById = await fetchLastMessages(chats.map((c) => c.id));
    if (!live()) return;
    if (!chats.length) {
      adminEl.innerHTML = `<p class="admin-bookings__empty">${t("adminChats.empty")}</p>`;
      return;
    }
    const current = chats.find((c) => c.id === openId);
    const messages = current ? await fetchChatMessages(current.id) : [];
    if (!live()) return;
    // Keep what the team is typing across refreshes.
    const draft = adminEl.querySelector<HTMLTextAreaElement>("[data-thread-reply] textarea")?.value ?? "";
    const hadFocus = document.activeElement?.closest("[data-thread-reply]") !== null && document.activeElement?.tagName === "TEXTAREA";
    adminEl.innerHTML = `<div class="chat-admin__grid">
      <ul class="chat-admin__list">${chats.map((c) => rowHtml(c, lastById.get(c.id), c.id === openId)).join("")}</ul>
      <section class="chat-thread admin-panel">${current ? threadHtml(current, messages) : `<p class="admin-stats__empty">${t("adminChats.pick")}</p>`}</section>
    </div>`;
    const textarea = adminEl.querySelector<HTMLTextAreaElement>("[data-thread-reply] textarea");
    if (textarea) {
      textarea.value = draft;
      if (hadFocus) textarea.focus();
    }
    const log = adminEl.querySelector<HTMLElement>("[data-thread-log]");
    if (log) log.scrollTop = log.scrollHeight;
  };

  const loop = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      if (!live()) return;
      if (!document.hidden) await paint();
      loop();
    }, REFRESH_MS);
  };

  void telegramReplies().then((s) => live() && paintTelegram(s));
  void paint().then(loop);

  telegramEl.addEventListener("click", async (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>("[data-telegram-on]");
    if (!button) return;
    button.disabled = true;
    const status = await telegramReplies(true);
    if (!live()) return;
    if (status?.active) paintTelegram(status);
    else {
      button.disabled = false;
      window.alert(t("adminChats.telegramFailed"));
    }
  });

  adminEl.addEventListener("click", (e) => {
    const row = (e.target as Element).closest<HTMLElement>("[data-chat-open]");
    if (!row) return;
    openId = row.dataset.chatOpen ?? "";
    history.replaceState(null, "", `${window.location.pathname}?chat=${openId}`);
    void paint();
  });

  adminEl.addEventListener("submit", async (e) => {
    const form = (e.target as Element).closest<HTMLFormElement>("[data-thread-reply]");
    if (!form) return;
    e.preventDefault();
    const textarea = form.querySelector("textarea")!;
    const body = textarea.value.trim();
    if (!body || !openId) return;
    const button = form.querySelector<HTMLButtonElement>("button")!;
    button.disabled = true;
    const ok = await replyToChat(openId, body);
    button.disabled = false;
    if (!ok) return window.alert(t("adminCrm.saveError"));
    textarea.value = "";
    await paint();
  });
}
