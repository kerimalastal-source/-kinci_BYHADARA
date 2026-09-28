// /api/tour-reply — the visitor's answer to a new tour time, from the two buttons of the
// "new time" email (api/booking-admin.ts).
//
//   GET  ?t=<token>&a=accepted|declined  shows the new time and asks the visitor to confirm
//                                        their answer with a button (email scanners open links
//                                        on their own, so opening the link records nothing)
//   POST t=<token>&a=accepted|declined   records the answer (tour_booking_reply(),
//                                        migration 0005), tells the team on Telegram and by
//                                        email, and shows a thank-you page
//
// The token is a random UUID created for each new time, so a link stops working once the
// time changes again. Pages are in the language the visitor booked in.
import { sendTelegram, escapeHtml } from "./_lib/telegram.js";
import { sendEmail } from "./_lib/email.js";
import { hasSupabase, rpc } from "./_lib/supabase.js";
import {
  APPS,
  CONTACT_AR,
  ISTANBUL,
  TEAM_INBOX,
  TEAM_PHONE,
  adminUrl,
  fill,
  formatDate,
  formatTime,
  layout,
  ltrSpan,
  type App,
  type ContactMethod,
  type SiteLocale
} from "./_lib/bookingMessages.js";

const LOCALES: readonly SiteLocale[] = ["en", "ar", "fr", "ru"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WHATSAPP = "905319309214";

type Answer = "accepted" | "declined";

/** What tour_booking_reply() returns for a valid link. */
interface Reply {
  reference: string;
  slot_start: string;
  name: string;
  email: string;
  phone: string;
  contact_method: ContactMethod;
  app: App;
  site_locale: string | null;
  visitor_timezone: string | null;
  status: string;
  customer_reply: Answer | null;
  past: boolean;
  error?: string;
}

interface PageText {
  title: string;
  hello: string;
  intro: string;
  istanbul: string;
  yourTime: string;
  question: string;
  accept: string;
  decline: string;
  chosen: string;
  acceptedTitle: string;
  accepted: string;
  declinedTitle: string;
  declined: string;
  whatsapp: string;
  invalidTitle: string;
  invalid: string;
  errorTitle: string;
  error: string;
  site: string;
}

const TEXT: Record<SiteLocale, PageText> = {
  en: {
    title: "Your private video tour",
    hello: "Hello {name},",
    intro: "The new time for your video tour {ref} is:",
    istanbul: "Istanbul time",
    yourTime: "your time",
    question: "Does this time suit you?",
    accept: "Yes, this time suits me",
    decline: "I need another time",
    chosen: "You answered: {answer}. You can change your answer below.",
    acceptedTitle: "Thank you — your tour is confirmed",
    accepted: "We look forward to showing you around. Your HADARA advisor will call you via {app} at this time.",
    declinedTitle: "Thank you for letting us know",
    declined: "Our team will contact you shortly to agree on a time that suits you.",
    whatsapp: "Message us on WhatsApp",
    invalidTitle: "This link is no longer valid",
    invalid: "The time of your tour may have changed again, or the tour has already taken place. For any question, contact us:",
    errorTitle: "Something went wrong",
    error: "We couldn't save your answer. Please try again in a moment, or contact us:",
    site: "Visit our website"
  },
  ar: {
    title: "جولتك الخاصة عبر الفيديو",
    hello: "مرحباً {name}،",
    intro: "الموعد الجديد لجولتك عبر الفيديو {ref} هو:",
    istanbul: "بتوقيت إسطنبول",
    yourTime: "بتوقيتك",
    question: "هل يناسبك هذا الموعد؟",
    accept: "نعم، الموعد مناسب",
    decline: "أحتاج إلى موعد آخر",
    chosen: "إجابتك: {answer}. يمكنك تغييرها من الأسفل.",
    acceptedTitle: "شكراً لك، تم تأكيد جولتك",
    accepted: "يسعدنا أن نريك المشروع. سيتصل بك مستشار حضارة عبر {app} في هذا الموعد.",
    declinedTitle: "شكراً لإبلاغنا",
    declined: "سيتواصل معك فريقنا قريباً للاتفاق على موعد يناسبك.",
    whatsapp: "راسلنا عبر واتساب",
    invalidTitle: "هذا الرابط لم يعد صالحاً",
    invalid: "ربما تغيّر موعد جولتك مرة أخرى، أو انتهى موعد الجولة. لأي استفسار تواصل معنا:",
    errorTitle: "حدث خطأ ما",
    error: "تعذّر حفظ إجابتك. يُرجى المحاولة بعد قليل، أو التواصل معنا:",
    site: "زيارة موقعنا"
  },
  fr: {
    title: "Votre visite privée en vidéo",
    hello: "Bonjour {name},",
    intro: "Le nouvel horaire de votre visite vidéo {ref} est :",
    istanbul: "heure d'Istanbul",
    yourTime: "votre heure",
    question: "Cet horaire vous convient-il ?",
    accept: "Oui, cet horaire me convient",
    decline: "J'ai besoin d'un autre horaire",
    chosen: "Votre réponse : {answer}. Vous pouvez la modifier ci-dessous.",
    acceptedTitle: "Merci, votre visite est confirmée",
    accepted: "Nous avons hâte de vous faire découvrir le projet. Votre conseiller HADARA vous appellera via {app} à cet horaire.",
    declinedTitle: "Merci de nous avoir prévenus",
    declined: "Notre équipe vous contactera rapidement pour convenir d'un horaire qui vous convient.",
    whatsapp: "Écrivez-nous sur WhatsApp",
    invalidTitle: "Ce lien n'est plus valable",
    invalid: "L'horaire de votre visite a peut-être encore changé, ou la visite a déjà eu lieu. Pour toute question, contactez-nous :",
    errorTitle: "Une erreur s'est produite",
    error: "Nous n'avons pas pu enregistrer votre réponse. Réessayez dans un instant ou contactez-nous :",
    site: "Visiter notre site"
  },
  ru: {
    title: "Ваша частная видеоэкскурсия",
    hello: "Здравствуйте, {name}!",
    intro: "Новое время вашей видеоэкскурсии {ref}:",
    istanbul: "по Стамбулу",
    yourTime: "по вашему времени",
    question: "Вам подходит это время?",
    accept: "Да, это время мне подходит",
    decline: "Мне нужно другое время",
    chosen: "Ваш ответ: {answer}. Его можно изменить ниже.",
    acceptedTitle: "Спасибо, ваша экскурсия подтверждена",
    accepted: "Будем рады показать вам проект. Ваш консультант HADARA позвонит вам через {app} в это время.",
    declinedTitle: "Спасибо, что сообщили",
    declined: "Наша команда скоро свяжется с вами, чтобы согласовать удобное время.",
    whatsapp: "Написать нам в WhatsApp",
    invalidTitle: "Эта ссылка больше не действует",
    invalid: "Возможно, время экскурсии снова изменилось или экскурсия уже прошла. По любым вопросам свяжитесь с нами:",
    errorTitle: "Что-то пошло не так",
    error: "Не удалось сохранить ваш ответ. Попробуйте чуть позже или свяжитесь с нами:",
    site: "Перейти на сайт"
  }
};

const localeOf = (value: string | null | undefined): SiteLocale =>
  LOCALES.includes(value as SiteLocale) ? (value as SiteLocale) : "en";

function html(body: string, locale: SiteLocale, title: string, status = 200): Response {
  const page = layout(body, locale === "ar", locale).replace(
    "<body", `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} — HADARA Real Estate</title></head><body`
  );
  return new Response(page, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

const heading = (text: string) => `<p style="margin:0 0 12px;font-size:19px;color:#0f2b21;font-weight:700">${escapeHtml(text)}</p>`;

function contactLine(locale: SiteLocale): string {
  const site = locale === "en" ? "https://www.hadararealestate.com" : `https://www.hadararealestate.com/${locale}`;
  return `<p style="margin:14px 0 0">${ltrSpan(TEAM_PHONE)} · ${ltrSpan(TEAM_INBOX)}</p>
    <p style="margin:14px 0 0"><a href="${site}" style="color:#0f2b21">${escapeHtml(TEXT[locale].site)}</a></p>`;
}

/** The new time in Istanbul, plus the visitor's own clock when it differs. */
function timeBlock(reply: Reply, locale: SiteLocale): string {
  const ms = Date.parse(reply.slot_start);
  const t = TEXT[locale];
  let local = "";
  const zone = reply.visitor_timezone;
  if (zone) {
    try {
      const own = `${formatDate(ms, locale, zone)} ${formatTime(ms, locale, zone)}`;
      if (own !== `${formatDate(ms, locale, ISTANBUL)} ${formatTime(ms, locale, ISTANBUL)}`) {
        local = `<br><span style="color:#6f776f;font-size:14px">${escapeHtml(own)} — ${escapeHtml(t.yourTime)}</span>`;
      }
    } catch {
      local = "";
    }
  }
  return `<p style="margin:0 0 18px;padding:14px 16px;border:1px solid #eee7d8;border-radius:10px;background:#fbf9f4">
      <strong style="color:#0f2b21;font-size:17px">${escapeHtml(formatDate(ms, locale, ISTANBUL))}</strong><br>
      <strong style="color:#0f2b21;font-size:22px"><bdi>${escapeHtml(formatTime(ms, locale, ISTANBUL))}</bdi></strong>
      <span style="color:#6f776f">${escapeHtml(t.istanbul)}</span>${local}</p>`;
}

function answerForm(token: string, answer: Answer, label: string, primary: boolean): string {
  const style = primary
    ? "background:#0f2b21;color:#ffffff;border:1px solid #0f2b21"
    : "background:#ffffff;color:#0f2b21;border:1px solid #0f2b21";
  return `<form method="post" action="/api/tour-reply" style="display:inline-block;margin:0 6px 10px">
      <input type="hidden" name="t" value="${escapeHtml(token)}"><input type="hidden" name="a" value="${answer}">
      <button type="submit" style="${style};padding:13px 22px;border-radius:8px;font-weight:700;font-size:16px;font-family:inherit;cursor:pointer">${escapeHtml(label)}</button>
    </form>`;
}

function askPage(reply: Reply, token: string, preferred: Answer | null): Response {
  const locale = localeOf(reply.site_locale);
  const t = TEXT[locale];
  const current = reply.customer_reply;
  const chosen = current ? `<p style="margin:0 0 12px;color:#6f776f;font-size:14px;text-align:center">${escapeHtml(fill(t.chosen, { answer: current === "accepted" ? t.accept : t.decline }))}</p>` : "";
  // The button the visitor tapped in the email comes first and filled in.
  const first: Answer = preferred ?? "accepted";
  const second: Answer = first === "accepted" ? "declined" : "accepted";
  const label = (a: Answer) => (a === "accepted" ? t.accept : t.decline);
  return html(
    `${heading(t.title)}
      <p style="margin:0 0 8px">${escapeHtml(fill(t.hello, { name: reply.name }))}</p>
      <p style="margin:0 0 12px">${fill(escapeHtml(t.intro), { ref: ltrSpan(escapeHtml(reply.reference)) })}</p>
      ${timeBlock(reply, locale)}
      <p style="margin:0 0 12px;font-weight:700;color:#0f2b21;text-align:center;font-size:16px">${escapeHtml(t.question)}</p>
      ${chosen}
      <div style="text-align:center">${answerForm(token, first, label(first), true)}${answerForm(token, second, label(second), false)}</div>`,
    locale,
    t.title
  );
}

function messagePage(locale: SiteLocale, title: string, message: string, extra = "", status = 200): Response {
  return html(`${heading(title)}<p style="margin:0">${message}</p>${extra}${contactLine(locale)}`, locale, title, status);
}

function whatsappButton(locale: SiteLocale, reference: string): string {
  const text = encodeURIComponent(`${reference} — ${TEXT[locale].decline}`);
  return `<p style="margin:18px 0 0"><a href="https://wa.me/${WHATSAPP}?text=${text}" style="display:inline-block;background:#25d366;color:#ffffff;font-weight:700;padding:12px 20px;border-radius:8px;text-decoration:none">${escapeHtml(TEXT[locale].whatsapp)}</a></p>`;
}

async function lookup(token: string, answer: Answer | null): Promise<Reply | null> {
  const result = (await rpc("tour_booking_reply", { p_token: token, p_answer: answer })) as Reply | null;
  return result && !result.error ? result : null;
}

const parseAnswer = (value: string | null): Answer | null => (value === "accepted" || value === "declined" ? value : null);

/** Where a request that can't be read gets its language from: the browser's own. */
function browserLocale(request: Request): SiteLocale {
  const header = (request.headers.get("accept-language") ?? "").slice(0, 2).toLowerCase();
  return localeOf(header);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const fallback = browserLocale(request);
  if (!UUID.test(token) || !hasSupabase()) {
    return messagePage(fallback, TEXT[fallback].invalidTitle, escapeHtml(TEXT[fallback].invalid), "", 404);
  }
  try {
    const reply = await lookup(token, null);
    if (!reply || reply.past) {
      const locale = reply ? localeOf(reply.site_locale) : fallback;
      return messagePage(locale, TEXT[locale].invalidTitle, escapeHtml(TEXT[locale].invalid), "", 404);
    }
    return askPage(reply, token, parseAnswer(url.searchParams.get("a")));
  } catch (error) {
    console.error(`tour-reply: ${error instanceof Error ? error.message : "unknown error"}`);
    return messagePage(fallback, TEXT[fallback].errorTitle, escapeHtml(TEXT[fallback].error), "", 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  const fallback = browserLocale(request);
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("t") ?? "");
  const answer = parseAnswer(String(form?.get("a") ?? ""));
  if (!UUID.test(token) || !answer || !hasSupabase()) {
    return messagePage(fallback, TEXT[fallback].invalidTitle, escapeHtml(TEXT[fallback].invalid), "", 400);
  }

  let before: Reply | null;
  let reply: Reply | null;
  try {
    before = await lookup(token, null);
    if (!before || before.past) {
      const locale = before ? localeOf(before.site_locale) : fallback;
      return messagePage(locale, TEXT[locale].invalidTitle, escapeHtml(TEXT[locale].invalid), "", 404);
    }
    reply = await lookup(token, answer);
  } catch (error) {
    console.error(`tour-reply: ${error instanceof Error ? error.message : "unknown error"}`);
    return messagePage(fallback, TEXT[fallback].errorTitle, escapeHtml(TEXT[fallback].error), "", 503);
  }
  if (!reply) {
    const locale = localeOf(before.site_locale);
    return messagePage(locale, TEXT[locale].errorTitle, escapeHtml(TEXT[locale].error), "", 503);
  }

  // Pressing the same answer twice tells the team only once.
  if (before.customer_reply !== answer) await notifyTeam(reply, answer, new URL(request.url).origin);

  const locale = localeOf(reply.site_locale);
  const t = TEXT[locale];
  if (answer === "accepted") {
    return messagePage(locale, t.acceptedTitle, escapeHtml(fill(t.accepted, { app: APPS[locale][reply.app] })), timeBlock(reply, locale).replace("margin:0 0 18px", "margin:16px 0 0"));
  }
  return messagePage(locale, t.declinedTitle, escapeHtml(t.declined), whatsappButton(locale, reply.reference));
}

async function notifyTeam(reply: Reply, answer: Answer, origin: string): Promise<void> {
  const ms = Date.parse(reply.slot_start);
  const when = `${formatDate(ms, "ar", ISTANBUL)} — ${formatTime(ms, "ar", ISTANBUL)} بتوقيت إسطنبول`;
  const title = answer === "accepted" ? "✅ العميل وافق على الموعد الجديد" : "❌ العميل يحتاج إلى موعد آخر";
  const lines: [string, string][] = [
    ["رقم الحجز", reply.reference],
    ["الاسم", reply.name],
    ["الموعد الجديد", when],
    ["الهاتف", reply.phone],
    ["الإيميل", reply.email],
    ["يفضّل التواصل عبر", CONTACT_AR[reply.contact_method] ?? reply.contact_method]
  ];
  const next = answer === "declined" ? "تواصلوا معه لاختيار موعد آخر، وبعدها عدّلوا الموعد من صفحة الحجوزات." : "";

  const telegram = [
    `<b>${title}</b>`,
    ...lines.map(([label, value]) => `${label}: ${escapeHtml(value)}`),
    ...(next ? [next] : []),
    `<a href="${escapeHtml(adminUrl(origin))}">فتح صفحة الحجوزات</a>`
  ].join("\n");

  const email = layout(
    `<p style="margin:0 0 14px;font-size:17px;color:#0f2b21;font-weight:700">${title}</p>
      ${lines.map(([label, value]) => `<p style="margin:0 0 6px"><span style="color:#6f776f">${label}:</span> <strong>${escapeHtml(value)}</strong></p>`).join("")}
      ${next ? `<p style="margin:12px 0 0">${next}</p>` : ""}
      <p style="margin:14px 0 0"><a href="${escapeHtml(adminUrl(origin))}" style="display:inline-block;background:#c9a24b;color:#081a14;font-weight:700;padding:10px 18px;border-radius:6px;text-decoration:none">فتح صفحة الحجوزات</a></p>`,
    true,
    "ar"
  );

  const results = await Promise.allSettled([
    sendTelegram(telegram),
    sendEmail({
      to: [process.env.BOOKING_NOTIFY_EMAIL || TEAM_INBOX],
      subject: `${title} — ${reply.name} (${reply.reference})`,
      html: email,
      text: [title, ...lines.map(([l, v]) => `${l}: ${v}`), next, adminUrl(origin)].filter(Boolean).join("\n"),
      replyTo: reply.email
    })
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error(`tour-reply: notify failed: ${r.reason instanceof Error ? r.reason.message : "unknown"}`);
  }
}
