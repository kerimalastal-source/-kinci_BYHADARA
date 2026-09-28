// /api/tour-reply — the visitor's answer to a new tour time, from the two buttons of the
// "new time" email (api/booking-admin.ts).
//
//   GET  ?t=<token>                  the new time with "Yes, this time suits me" (a form) and
//                                    "I need another time" (a link to the picker). Opening a
//                                    link records nothing: email scanners open links too.
//   GET  ?t=<token>&a=accepted       the same page, the visitor's email choice first
//   GET  ?t=<token>&a=declined       the picker: free half hours for the next two weeks, the
//                                    booked ones and the lunch break greyed out
//   POST t, a=accepted               confirms the new time (tour_booking_reply(), migration 0005)
//   POST t, a=propose, slot=<ISO>    moves the booking to the time the visitor picked
//                                    (tour_booking_propose(), migration 0006) — held right away,
//                                    marked "proposed" until the team confirms it
//   POST t, a=declined               "no time suits me": the team contacts the visitor
//
// Each answer tells the team on Telegram and by email. The token is a random UUID created
// for each new time the team sets, so a link stops working once the team changes the time
// again. Pages are in the language the visitor booked in.
import { sendTelegram, escapeHtml } from "./_lib/telegram.js";
import { sendEmail } from "./_lib/email.js";
import { hasSupabase, rpc, RpcError } from "./_lib/supabase.js";
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
/** What the team is told: an answer, or a time the visitor picked (held, or only suggested). */
type Outcome = Answer | "proposed" | "suggested";

/** Tours start every half hour 9:00–18:30 Istanbul time; 12:00–13:00 is the lunch break. */
const SLOT_MINUTES = Array.from({ length: 20 }, (_, i) => 9 * 60 + i * 30);
const LUNCH_MINUTES = [12 * 60, 12 * 60 + 30, 13 * 60];
const ISTANBUL_OFFSET_MIN = 180;
const PICK_DAYS = 15;
const LEAD_MS = 60 * 60_000;

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
  customer_reply: Answer | "proposed" | null;
  past: boolean;
  error?: string;
}

interface PageText {
  pickTitle: string;
  pickIntro: string;
  booked: string;
  send: string;
  noneFit: string;
  noTimes: string;
  proposedTitle: string;
  proposed: string;
  pending: string;
  chooseAnother: string;
  slotTaken: string;
  localNote: string;
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
    pickTitle: "Choose a time that suits you",
    pickIntro: "Pick a day, then a time (Istanbul time). Grey times are already booked. The time you choose is held for you right away, and our team will confirm it.",
    booked: "Booked",
    send: "Book this time",
    noneFit: "No time suits me — please contact me",
    noTimes: "There are no free times in the next two weeks. Our team will contact you to find one.",
    proposedTitle: "Your new time is booked",
    proposed: "We've held this time for you. Our team will confirm it shortly, and you'll get a confirmation email.",
    pending: "You chose this time; our team will confirm it shortly. You can still choose another time.",
    chooseAnother: "Choose another time",
    slotTaken: "Someone has just booked that time. Please choose another one.",
    localNote: "The small time under each slot is your local time.",
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
    pickTitle: "اختر الموعد الذي يناسبك",
    pickIntro: "اختر يوماً ثم وقتاً (بتوقيت إسطنبول). الأوقات الرمادية محجوزة. يُحجز لك الموعد الذي تختاره فوراً، وسيؤكده فريقنا.",
    booked: "محجوز",
    send: "احجز هذا الموعد",
    noneFit: "لا يناسبني أي موعد — تواصلوا معي",
    noTimes: "لا توجد مواعيد متاحة خلال الأسبوعين القادمين، وسيتواصل معك فريقنا لتحديد موعد.",
    proposedTitle: "تم حجز موعدك الجديد",
    proposed: "حجزنا لك هذا الموعد، وسيؤكده فريقنا قريباً ويصلك إيميل بالتأكيد.",
    pending: "اخترت هذا الموعد، وسيؤكده فريقنا قريباً. ما زال بإمكانك اختيار موعد آخر.",
    chooseAnother: "اختيار موعد آخر",
    slotTaken: "حُجز هذا الموعد للتو من زائر آخر. يُرجى اختيار موعد آخر.",
    localNote: "الوقت الصغير تحت كل موعد هو الوقت بتوقيتك المحلي.",
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
    pickTitle: "Choisissez un horaire qui vous convient",
    pickIntro: "Choisissez un jour, puis une heure (heure d'Istanbul). Les horaires grisés sont déjà réservés. L'horaire choisi vous est réservé tout de suite, et notre équipe le confirmera.",
    booked: "Réservé",
    send: "Réserver cet horaire",
    noneFit: "Aucun horaire ne me convient — contactez-moi",
    noTimes: "Il n'y a pas d'horaire libre dans les deux prochaines semaines. Notre équipe vous contactera pour en trouver un.",
    proposedTitle: "Votre nouvel horaire est réservé",
    proposed: "Nous vous avons réservé cet horaire. Notre équipe le confirmera rapidement et vous recevrez un e-mail de confirmation.",
    pending: "Vous avez choisi cet horaire ; notre équipe le confirmera rapidement. Vous pouvez encore en choisir un autre.",
    chooseAnother: "Choisir un autre horaire",
    slotTaken: "Quelqu'un vient de réserver cet horaire. Veuillez en choisir un autre.",
    localNote: "L'heure en petit sous chaque créneau est votre heure locale.",
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
    pickTitle: "Выберите удобное время",
    pickIntro: "Выберите день, затем время (по Стамбулу). Серые варианты уже заняты. Выбранное время сразу бронируется за вами, а наша команда его подтвердит.",
    booked: "Занято",
    send: "Забронировать это время",
    noneFit: "Мне не подходит ни одно время — свяжитесь со мной",
    noTimes: "В ближайшие две недели нет свободного времени. Наша команда свяжется с вами, чтобы подобрать его.",
    proposedTitle: "Новое время забронировано",
    proposed: "Мы забронировали для вас это время. Наша команда скоро его подтвердит, и вы получите письмо с подтверждением.",
    pending: "Вы выбрали это время; наша команда скоро его подтвердит. Вы ещё можете выбрать другое.",
    chooseAnother: "Выбрать другое время",
    slotTaken: "Это время только что забронировал другой посетитель. Пожалуйста, выберите другое.",
    localNote: "Мелким шрифтом под каждым временем — ваше местное время.",
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

function html(body: string, locale: SiteLocale, title: string, status = 200, style = ""): Response {
  const page = layout(body, locale === "ar", locale).replace(
    "<body",
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} — HADARA Real Estate</title>${style ? `<style>${style}</style>` : ""}</head><body`
  );
  return new Response(page, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

const heading = (text: string) => `<p style="margin:0 0 12px;font-size:19px;color:#0f2b21;font-weight:700">${escapeHtml(text)}</p>`;

const replyUrl = (token: string, answer?: Answer) => `/api/tour-reply?t=${encodeURIComponent(token)}${answer ? `&a=${answer}` : ""}`;

function contactLine(locale: SiteLocale): string {
  const site = locale === "en" ? "https://www.hadararealestate.com" : `https://www.hadararealestate.com/${locale}`;
  return `<p style="margin:14px 0 0">${ltrSpan(TEAM_PHONE)} · ${ltrSpan(TEAM_INBOX)}</p>
    <p style="margin:14px 0 0"><a href="${site}" style="color:#0f2b21">${escapeHtml(TEXT[locale].site)}</a></p>`;
}

/** "18:30" style times in the visitor's zone, or null when it shows Istanbul's clock. */
function ownClock(ms: number, locale: SiteLocale, zone: string | null, withDate: boolean): string | null {
  if (!zone) return null;
  try {
    const own = withDate ? `${formatDate(ms, locale, zone)} ${formatTime(ms, locale, zone)}` : formatTime(ms, locale, zone);
    const istanbul = withDate ? `${formatDate(ms, locale, ISTANBUL)} ${formatTime(ms, locale, ISTANBUL)}` : formatTime(ms, locale, ISTANBUL);
    return own === istanbul ? null : own;
  } catch {
    return null;
  }
}

/** The tour's time in Istanbul, plus the visitor's own clock when it differs. */
function timeBlock(reply: Reply, locale: SiteLocale): string {
  const ms = Date.parse(reply.slot_start);
  const t = TEXT[locale];
  const own = ownClock(ms, locale, reply.visitor_timezone, true);
  const local = own ? `<br><span style="color:#6f776f;font-size:14px">${escapeHtml(own)} — ${escapeHtml(t.yourTime)}</span>` : "";
  return `<p style="margin:0 0 18px;padding:14px 16px;border:1px solid #eee7d8;border-radius:10px;background:#fbf9f4">
      <strong style="color:#0f2b21;font-size:17px">${escapeHtml(formatDate(ms, locale, ISTANBUL))}</strong><br>
      <strong style="color:#0f2b21;font-size:22px"><bdi>${escapeHtml(formatTime(ms, locale, ISTANBUL))}</bdi></strong>
      <span style="color:#6f776f">${escapeHtml(t.istanbul)}</span>${local}</p>`;
}

const PRIMARY = "background:#0f2b21;color:#ffffff;border:1px solid #0f2b21";
const SECONDARY = "background:#ffffff;color:#0f2b21;border:1px solid #0f2b21";
const BUTTON = "display:inline-block;padding:13px 22px;border-radius:8px;font-weight:700;font-size:16px;font-family:inherit;cursor:pointer;text-decoration:none";

function hidden(token: string, answer: string): string {
  return `<input type="hidden" name="t" value="${escapeHtml(token)}"><input type="hidden" name="a" value="${answer}">`;
}

/** "Yes" confirms with a form; "I need another time" opens the picker. */
function askPage(reply: Reply, token: string, preferred: Answer | null): Response {
  const locale = localeOf(reply.site_locale);
  const t = TEXT[locale];
  const chosen =
    reply.customer_reply === "accepted" || reply.customer_reply === "declined"
      ? `<p style="margin:0 0 12px;color:#6f776f;font-size:14px;text-align:center">${escapeHtml(fill(t.chosen, { answer: reply.customer_reply === "accepted" ? t.accept : t.decline }))}</p>`
      : "";
  const yes = `<form method="post" action="/api/tour-reply" style="display:inline-block;margin:0 6px 10px">${hidden(token, "accepted")}<button type="submit" style="${BUTTON};${PRIMARY}">${escapeHtml(t.accept)}</button></form>`;
  const no = `<a href="${escapeHtml(replyUrl(token, "declined"))}" style="${BUTTON};${preferred === "declined" ? PRIMARY : SECONDARY};margin:0 6px 10px">${escapeHtml(t.decline)}</a>`;
  return html(
    `${heading(t.title)}
      <p style="margin:0 0 8px">${escapeHtml(fill(t.hello, { name: reply.name }))}</p>
      <p style="margin:0 0 12px">${fill(escapeHtml(t.intro), { ref: ltrSpan(escapeHtml(reply.reference)) })}</p>
      ${timeBlock(reply, locale)}
      <p style="margin:0 0 12px;font-weight:700;color:#0f2b21;text-align:center;font-size:16px">${escapeHtml(t.question)}</p>
      ${chosen}
      <div style="text-align:center">${preferred === "declined" ? no + yes : yes + no}</div>`,
    locale,
    t.title
  );
}

/* ---------- Picker: the visitor chooses another time ---------- */

const pad = (n: number) => String(n).padStart(2, "0");

function istanbulDate(ms: number): string {
  const x = new Date(ms + ISTANBUL_OFFSET_MIN * 60_000);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

function slotMs(date: string, minutes: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, minutes) - ISTANBUL_OFFSET_MIN * 60_000;
}

interface PickDay {
  date: string;
  slots: { ms: number; open: boolean }[];
}

/** The next two weeks of Istanbul days with at least one free half hour. */
function pickDays(taken: Set<number>): PickDay[] {
  const now = Date.now();
  const today = Date.parse(`${istanbulDate(now)}T00:00:00Z`);
  const days: PickDay[] = [];
  for (let i = 0; i < PICK_DAYS; i++) {
    const date = new Date(today + i * 86_400_000).toISOString().slice(0, 10);
    const slots = SLOT_MINUTES.map((minutes) => ({ ms: slotMs(date, minutes), minutes }))
      .filter((s) => s.ms >= now + LEAD_MS && s.ms <= now + PICK_DAYS * 86_400_000)
      .map((s) => ({ ms: s.ms, open: !LUNCH_MINUTES.includes(s.minutes) && !taken.has(s.ms) }));
    if (slots.some((s) => s.open)) days.push({ date, slots });
  }
  return days;
}

const PICKER_STYLE = `
.pick-days{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:6px;margin:0 0 14px}
.pick-day-input,.pick-slot input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.pick-day{display:block;padding:8px 6px;border:1px solid #e6e1d3;border-radius:8px;background:#fff;color:#0f2b21;font-size:13px;line-height:1.35;text-align:center;cursor:pointer}
.pick-day strong{display:block;font-size:15px}
.pick-day-input:checked+.pick-day{background:#0f2b21;border-color:#0f2b21;color:#fff}
.pick-day-input:focus-visible+.pick-day,.pick-slot input:focus-visible+span{outline:2px solid #c9a24b;outline-offset:2px}
.pick-panels{grid-column:1/-1;margin-top:8px}
.pick-panel{display:none;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pick-slot{position:relative;display:block;cursor:pointer}
.pick-slot span{display:block;padding:10px 4px;border:1px solid #e6e1d3;border-radius:8px;background:#fff;color:#0f2b21;text-align:center;font-weight:700;font-size:15px}
.pick-slot small{display:block;margin-top:2px;font-size:11px;font-weight:400;color:#6f776f}
.pick-slot input:checked+span{background:#0f2b21;border-color:#0f2b21;color:#fff}
.pick-slot input:checked+span small{color:#e9d9a8}
.pick-slot.is-off{cursor:not-allowed}
.pick-slot.is-off span{background:#ecebe8;border-color:#dedcd6;color:#9b9a95}
.pick-slot.is-off small{color:#9b9a95}
.pick-send{width:100%;margin-top:16px}
.pick-none{background:none;border:0;padding:0;color:#6f776f;font:inherit;font-size:14px;text-decoration:underline;cursor:pointer}
`;

function pickerPage(reply: Reply, token: string, taken: Set<number>, notice = "", status = 200): Response {
  const locale = localeOf(reply.site_locale);
  const t = TEXT[locale];
  const tag = `${locale}-u-nu-latn`;
  // The time the team set is the one being replaced: it isn't offered back.
  const held = new Set(taken);
  held.add(Date.parse(reply.slot_start));
  const days = pickDays(held);
  const noneFit = `<form method="post" action="/api/tour-reply" style="margin:18px 0 0;text-align:center">${hidden(token, "declined")}<button type="submit" class="pick-none">${escapeHtml(t.noneFit)}</button></form>`;
  const alert = notice ? `<p style="margin:0 0 14px;padding:10px 12px;border-radius:8px;background:#fbe9e7;color:#a1332a;font-weight:600">${escapeHtml(notice)}</p>` : "";

  if (!days.length) {
    return html(`${heading(t.pickTitle)}${alert}<p style="margin:0">${escapeHtml(t.noTimes)}</p>${noneFit}${contactLine(locale)}`, locale, t.pickTitle, status, PICKER_STYLE);
  }

  const dayStyle = days
    .map((_, i) => `#pd-${i}:checked~.pick-panels .pp-${i}{display:grid}`)
    .join("");
  const dayTabs = days
    .map((day, i) => {
      const noon = Date.parse(`${day.date}T12:00:00Z`);
      const week = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" }).format(noon);
      const date = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" }).format(noon);
      return `<input type="radio" name="day" id="pd-${i}" class="pick-day-input"${i === 0 ? " checked" : ""}><label for="pd-${i}" class="pick-day">${escapeHtml(week)}<strong>${escapeHtml(date)}</strong></label>`;
    })
    .join("");
  const panels = days
    .map(
      (day, i) => `<div class="pick-panel pp-${i}">${day.slots
        .map((slot) => {
          const time = escapeHtml(formatTime(slot.ms, locale, ISTANBUL));
          if (!slot.open) return `<div class="pick-slot is-off" aria-disabled="true"><span><bdi>${time}</bdi><small>${escapeHtml(t.booked)}</small></span></div>`;
          const own = ownClock(slot.ms, locale, reply.visitor_timezone, false);
          return `<label class="pick-slot"><input type="radio" name="slot" value="${new Date(slot.ms).toISOString()}" required><span><bdi>${time}</bdi>${own ? `<small><bdi>${escapeHtml(own)}</bdi></small>` : ""}</span></label>`;
        })
        .join("")}</div>`
    )
    .join("");

  return html(
    `${heading(t.pickTitle)}
      <p style="margin:0 0 8px">${escapeHtml(fill(t.hello, { name: reply.name }))}</p>
      <p style="margin:0 0 16px;color:#6f776f;font-size:14px">${escapeHtml(t.pickIntro)}</p>
      ${alert}
      ${ownClock(days[0].slots[0].ms, locale, reply.visitor_timezone, false) ? `<p style="margin:0 0 12px;color:#6f776f;font-size:13px">${escapeHtml(t.localNote)}</p>` : ""}
      <form method="post" action="/api/tour-reply">
        ${hidden(token, "propose")}
        <div class="pick-days">${dayTabs}<div class="pick-panels">${panels}</div></div>
        <button type="submit" class="pick-send" style="${BUTTON};${PRIMARY}">${escapeHtml(t.send)}</button>
      </form>
      ${noneFit}`,
    locale,
    t.pickTitle,
    status,
    PICKER_STYLE + dayStyle
  );
}

/** A time the visitor picked, waiting for the team: shown again with "Choose another time". */
function pendingPage(reply: Reply, token: string, title: string, message: string): Response {
  const locale = localeOf(reply.site_locale);
  const t = TEXT[locale];
  return messagePage(
    locale,
    title,
    escapeHtml(message),
    `${timeBlock(reply, locale).replace("margin:0 0 18px", "margin:16px 0 0")}
      <p style="margin:14px 0 0"><a href="${escapeHtml(replyUrl(token, "declined"))}" style="color:#0f2b21">${escapeHtml(t.chooseAnother)}</a></p>`
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

/** Start times other bookings hold (tour_taken_slots(), migration 0003). */
async function takenSlots(): Promise<Set<number>> {
  try {
    const data = (await rpc("tour_taken_slots", {})) as string[] | null;
    return new Set((Array.isArray(data) ? data : []).map((iso) => Date.parse(iso)));
  } catch (error) {
    console.error(`tour-reply: tour_taken_slots failed: ${error instanceof Error ? error.message : "unknown"}`);
    return new Set();
  }
}

const parseAnswer = (value: string | null): Answer | null => (value === "accepted" || value === "declined" ? value : null);

/** Where a request that can't be read gets its language from: the browser's own. */
function browserLocale(request: Request): SiteLocale {
  const header = (request.headers.get("accept-language") ?? "").slice(0, 2).toLowerCase();
  return localeOf(header);
}

const invalidPage = (locale: SiteLocale, status: number) => messagePage(locale, TEXT[locale].invalidTitle, escapeHtml(TEXT[locale].invalid), "", status);
const errorPage = (locale: SiteLocale) => messagePage(locale, TEXT[locale].errorTitle, escapeHtml(TEXT[locale].error), "", 503);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const fallback = browserLocale(request);
  if (!UUID.test(token) || !hasSupabase()) return invalidPage(fallback, 404);
  try {
    const reply = await lookup(token, null);
    if (!reply || reply.past) return invalidPage(reply ? localeOf(reply.site_locale) : fallback, 404);
    const answer = parseAnswer(url.searchParams.get("a"));
    if (answer === "declined") return pickerPage(reply, token, await takenSlots());
    const locale = localeOf(reply.site_locale);
    if (reply.customer_reply === "proposed") return pendingPage(reply, token, TEXT[locale].proposedTitle, TEXT[locale].pending);
    return askPage(reply, token, answer);
  } catch (error) {
    console.error(`tour-reply: ${error instanceof Error ? error.message : "unknown error"}`);
    return errorPage(fallback);
  }
}

export async function POST(request: Request): Promise<Response> {
  const fallback = browserLocale(request);
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("t") ?? "");
  const action = String(form?.get("a") ?? "");
  if (!UUID.test(token) || !hasSupabase() || !["accepted", "declined", "propose"].includes(action)) return invalidPage(fallback, 400);
  const origin = new URL(request.url).origin;

  let before: Reply | null;
  try {
    before = await lookup(token, null);
  } catch (error) {
    console.error(`tour-reply: ${error instanceof Error ? error.message : "unknown error"}`);
    return errorPage(fallback);
  }
  if (!before || before.past) return invalidPage(before ? localeOf(before.site_locale) : fallback, 404);
  const locale = localeOf(before.site_locale);
  const t = TEXT[locale];

  if (action === "propose") return propose(before, token, String(form?.get("slot") ?? ""), origin);

  const answer = action as Answer;
  let reply: Reply | null;
  try {
    reply = await lookup(token, answer);
  } catch (error) {
    console.error(`tour-reply: ${error instanceof Error ? error.message : "unknown error"}`);
    return errorPage(locale);
  }
  if (!reply) return errorPage(locale);

  // Pressing the same answer twice tells the team only once.
  if (before.customer_reply !== answer) await notifyTeam(reply, answer, origin);

  if (answer === "accepted") {
    return messagePage(locale, t.acceptedTitle, escapeHtml(fill(t.accepted, { app: APPS[locale][reply.app] })), timeBlock(reply, locale).replace("margin:0 0 18px", "margin:16px 0 0"));
  }
  return messagePage(locale, t.declinedTitle, escapeHtml(t.declined), whatsappButton(locale, reply.reference));
}

/** Holds the time the visitor picked (tour_booking_propose(), migration 0006). */
async function propose(before: Reply, token: string, slotValue: string, origin: string): Promise<Response> {
  const locale = localeOf(before.site_locale);
  const t = TEXT[locale];
  const slot = new Date(slotValue);
  if (Number.isNaN(slot.getTime())) return pickerPage(before, token, await takenSlots(), t.slotTaken, 400);

  let result: (Reply & { error?: string }) | null;
  try {
    result = (await rpc("tour_booking_propose", { p_token: token, p_slot: slot.toISOString() })) as (Reply & { error?: string }) | null;
  } catch (error) {
    // 404: migration 0006 hasn't been run. The visitor's choice still reaches the team,
    // as a suggestion they book by hand; nothing is held.
    if (error instanceof RpcError && error.status === 404) {
      console.error("tour-reply: tour_booking_propose is missing — run supabase/migrations/0006");
      const declined = (await lookup(token, "declined").catch(() => null)) ?? before;
      await notifyTeam(declined, "suggested", origin, slot);
      return messagePage(locale, t.declinedTitle, escapeHtml(t.declined), whatsappButton(locale, before.reference));
    }
    console.error(`tour-reply: ${error instanceof Error ? error.message : "unknown error"}`);
    return errorPage(locale);
  }

  if (!result || result.error) {
    const error = result?.error;
    if (error === "not_found" || error === "past") return invalidPage(locale, 404);
    // Taken a moment ago, or no longer a valid time: back to the picker with fresh times.
    return pickerPage(before, token, await takenSlots(), t.slotTaken, 409);
  }

  await notifyTeam(result, "proposed", origin);
  return pendingPage(result, token, t.proposedTitle, t.proposed);
}

async function notifyTeam(reply: Reply, outcome: Outcome, origin: string, suggested?: Date): Promise<void> {
  const ms = Date.parse(reply.slot_start);
  const when = (at: number) => `${formatDate(at, "ar", ISTANBUL)} — ${formatTime(at, "ar", ISTANBUL)} بتوقيت إسطنبول`;
  const titles: Record<Outcome, string> = {
    accepted: "✅ العميل وافق على الموعد الجديد",
    declined: "❌ العميل يحتاج إلى موعد آخر",
    proposed: "🔄 العميل اختار موعداً جديداً — أكّدوه",
    suggested: "🔄 العميل يقترح موعداً آخر"
  };
  const title = titles[outcome];
  const lines: [string, string][] = [
    ["رقم الحجز", reply.reference],
    ["الاسم", reply.name],
    [outcome === "proposed" ? "الموعد الذي اختاره" : outcome === "suggested" ? "الموعد الحالي" : "الموعد الجديد", when(ms)],
    ...(suggested ? ([["الموعد الذي يقترحه", when(suggested.getTime())]] as [string, string][]) : []),
    ["الهاتف", reply.phone],
    ["الإيميل", reply.email],
    ["يفضّل التواصل عبر", CONTACT_AR[reply.contact_method] ?? reply.contact_method]
  ];
  const nextSteps: Record<Outcome, string> = {
    accepted: "",
    declined: "تواصلوا معه لاختيار موعد آخر، وبعدها عدّلوا الموعد من صفحة الحجوزات.",
    proposed: "الموعد محجوز له بالنظام. اضغطوا «تأكيد» على الحجز من صفحة الحجوزات ليصله إيميل التأكيد.",
    suggested: "الموعد الذي يقترحه غير محجوز بعد: عدّلوا الموعد إليه من صفحة الحجوزات إذا كان متاحاً."
  };
  const next = nextSteps[outcome];

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
