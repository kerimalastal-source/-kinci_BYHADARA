// Messages for video tour bookings: the visitor's emails in the site language they booked
// in (with a calendar file) — booked (api/book.ts), confirmed by the team and moved to a
// new time (api/booking-admin.ts) — and the team's copies by email and Telegram, in Arabic.
import { escapeHtml } from "./telegram.js";
import type { EmailAttachment } from "./email.js";

export type SiteLocale = "en" | "ar" | "fr" | "ru";
export type App = "whatsapp" | "facetime" | "zoom" | "meet";
export type TourLanguage = "ar" | "en" | "tr";
export type ContactMethod = "email" | "phone" | "whatsapp" | "telegram" | "viber";

export interface BookingDetails {
  reference: string;
  slot: Date;
  /** Names in the booking's site language and in Arabic, and the project page URL. */
  projects: { name: string; nameAr: string; url: string }[];
  focus: string[];
  focusAr: string[];
  app: App;
  tourLanguage: TourLanguage;
  name: string;
  email: string;
  phone: string;
  contact: ContactMethod;
  locale: SiteLocale;
  /** The visitor's IANA time zone, when the browser reported a valid one. */
  timeZone: string | null;
  source: string | null;
  origin: string;
}

export const ISTANBUL = "Europe/Istanbul";
const TOUR_MINUTES = 45;
export const TEAM_PHONE = "+90 531 930 92 14";
const TEAM_EMAIL = "info@byhadara.com";

export const APPS: Record<SiteLocale, Record<App, string>> = {
  en: { whatsapp: "WhatsApp video", facetime: "FaceTime", zoom: "Zoom", meet: "Google Meet" },
  ar: { whatsapp: "واتساب فيديو", facetime: "فيس تايم", zoom: "زوم", meet: "جوجل ميت" },
  fr: { whatsapp: "Vidéo WhatsApp", facetime: "FaceTime", zoom: "Zoom", meet: "Google Meet" },
  ru: { whatsapp: "Видео в WhatsApp", facetime: "FaceTime", zoom: "Zoom", meet: "Google Meet" }
};

export const TOUR_LANGUAGES: Record<SiteLocale, Record<TourLanguage, string>> = {
  en: { ar: "Arabic", en: "English", tr: "Turkish" },
  ar: { ar: "العربية", en: "الإنجليزية", tr: "التركية" },
  fr: { ar: "Arabe", en: "Anglais", tr: "Turc" },
  ru: { ar: "Арабский", en: "Английский", tr: "Турецкий" }
};

export const CONTACT_AR: Record<ContactMethod, string> = {
  email: "الإيميل",
  phone: "اتصال هاتفي",
  whatsapp: "واتساب",
  telegram: "تيليجرام",
  viber: "فايبر"
};

export const SITE_LANGUAGE_AR: Record<SiteLocale, string> = { en: "الإنجليزية", ar: "العربية", fr: "الفرنسية", ru: "الروسية" };

interface VisitorText {
  subject: string;
  hello: string;
  intro: string;
  reference: string;
  projects: string;
  date: string;
  time: string;
  istanbul: string;
  yourTime: string;
  app: string;
  language: string;
  nextTitle: string;
  next: string;
  linkNote: string;
  change: string;
  calendar: string;
  thanks: string;
  team: string;
  event: string;
  eventDetails: string;
}

const VISITOR: Record<SiteLocale, VisitorText> = {
  en: {
    subject: "Your private video tour is booked — {ref}",
    hello: "Hello {name},",
    intro: "Your private video tour with HADARA Real Estate is booked. Here are the details:",
    reference: "Booking number",
    projects: "Project",
    date: "Date",
    time: "Time",
    istanbul: "Istanbul time",
    yourTime: "your time",
    app: "Video call",
    language: "Tour language",
    nextTitle: "What happens next",
    next: "Your HADARA advisor will call you via {app} at the booked time.",
    linkNote: "We will send you the meeting link before the tour.",
    change: "Need to change the time? Just reply to this email, or contact us at {phone}.",
    calendar: "The attached calendar file adds the tour to your calendar.",
    thanks: "See you soon,",
    team: "The HADARA Real Estate team",
    event: "Private video tour — {projects}",
    eventDetails: "Your HADARA advisor will call you via {app}. Booking {ref}."
  },
  ar: {
    subject: "تم حجز جولتك الخاصة عبر الفيديو — {ref}",
    hello: "مرحباً {name}،",
    intro: "تم حجز جولتك الخاصة عبر الفيديو مع حضارة للتطوير العقاري. إليك التفاصيل:",
    reference: "رقم الحجز",
    projects: "المشروع",
    date: "التاريخ",
    time: "الوقت",
    istanbul: "بتوقيت إسطنبول",
    yourTime: "بتوقيتك",
    app: "مكالمة الفيديو",
    language: "لغة الجولة",
    nextTitle: "ماذا بعد؟",
    next: "سيتصل بك مستشار حضارة عبر {app} في الموعد المحدد.",
    linkNote: "سنرسل إليك رابط الاجتماع قبل موعد الجولة.",
    change: "هل تحتاج إلى تغيير الموعد؟ ما عليك إلا الرد على هذا البريد، أو التواصل معنا على {phone}.",
    calendar: "ملف التقويم المرفق يضيف الجولة إلى تقويمك.",
    thanks: "نراك قريباً،",
    team: "فريق حضارة للتطوير العقاري",
    event: "جولة خاصة عبر الفيديو — {projects}",
    eventDetails: "سيتصل بك مستشار حضارة عبر {app}. رقم الحجز {ref}."
  },
  fr: {
    subject: "Votre visite privée en vidéo est réservée — {ref}",
    hello: "Bonjour {name},",
    intro: "Votre visite privée en vidéo avec HADARA Real Estate est réservée. Voici les détails :",
    reference: "Numéro de réservation",
    projects: "Projet",
    date: "Date",
    time: "Heure",
    istanbul: "heure d'Istanbul",
    yourTime: "votre heure",
    app: "Appel vidéo",
    language: "Langue de la visite",
    nextTitle: "Et ensuite ?",
    next: "Votre conseiller HADARA vous appellera via {app} à l'heure réservée.",
    linkNote: "Nous vous enverrons le lien de la réunion avant la visite.",
    change: "Besoin de changer l'horaire ? Répondez simplement à cet e-mail ou contactez-nous au {phone}.",
    calendar: "Le fichier de calendrier joint ajoute la visite à votre agenda.",
    thanks: "À bientôt,",
    team: "L'équipe HADARA Real Estate",
    event: "Visite privée en vidéo — {projects}",
    eventDetails: "Votre conseiller HADARA vous appellera via {app}. Réservation {ref}."
  },
  ru: {
    subject: "Ваша частная видеоэкскурсия забронирована — {ref}",
    hello: "Здравствуйте, {name}!",
    intro: "Ваша частная видеоэкскурсия с HADARA Real Estate забронирована. Подробности:",
    reference: "Номер бронирования",
    projects: "Проект",
    date: "Дата",
    time: "Время",
    istanbul: "по Стамбулу",
    yourTime: "по вашему времени",
    app: "Видеозвонок",
    language: "Язык экскурсии",
    nextTitle: "Что дальше",
    next: "Ваш консультант HADARA позвонит вам через {app} в назначенное время.",
    linkNote: "Мы отправим вам ссылку на встречу перед экскурсией.",
    change: "Нужно изменить время? Просто ответьте на это письмо или свяжитесь с нами по номеру {phone}.",
    calendar: "Приложенный файл календаря добавит экскурсию в ваш календарь.",
    thanks: "До встречи,",
    team: "Команда HADARA Real Estate",
    event: "Частная видеоэкскурсия — {projects}",
    eventDetails: "Ваш консультант HADARA позвонит вам через {app}. Бронирование {ref}."
  }
};

export const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
export const list = (items: string[], locale: SiteLocale) => items.join(locale === "ar" ? "، " : ", ");
const tag = (locale: SiteLocale) => `${locale}-u-nu-latn`;

export function formatDate(ms: number, locale: SiteLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(tag(locale), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }).format(ms);
}

export function formatTime(ms: number, locale: SiteLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(tag(locale), { hour: "numeric", minute: "2-digit", timeZone }).format(ms);
}

/** The visitor's own date/time for the slot, or null when their zone matches Istanbul's clock. */
export function visitorClock(details: BookingDetails, locale: SiteLocale): string | null {
  const zone = details.timeZone;
  if (!zone) return null;
  const ms = details.slot.getTime();
  const same = formatDate(ms, "en", zone) + formatTime(ms, "en", zone) === formatDate(ms, "en", ISTANBUL) + formatTime(ms, "en", ISTANBUL);
  if (same) return null;
  return `${new Intl.DateTimeFormat(tag(locale), { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: zone }).format(ms)} (${zone.replace(/_/g, " ")})`;
}

/* ---------- Calendar file ---------- */

const icsStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** `sequence` must grow with each change of the same booking, so calendars replace the old event. */
function calendarFile(details: BookingDetails, sequence = 0): EmailAttachment {
  const text = VISITOR[details.locale];
  const start = details.slot.getTime();
  const app = APPS[details.locale][details.app];
  const title = fill(text.event, { projects: details.projects.map((p) => p.name).join(" · ") });
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HADARA Real Estate//Video Tour//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${details.reference}@hadararealestate.com`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(start + TOUR_MINUTES * 60_000)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(fill(text.eventDetails, { app, ref: details.reference }))}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  return { filename: "hadara-video-tour.ics", content: Buffer.from(ics, "utf8").toString("base64") };
}

/* ---------- HTML helpers ---------- */

export function rowsHtml(rows: [string, string][], rtl: boolean): string {
  const align = rtl ? "right" : "left";
  return rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee7d8;color:#6f776f;font-size:13px;width:38%;vertical-align:top;text-align:${align}">${label}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee7d8;color:#14201b;font-size:15px;font-weight:600;vertical-align:top;text-align:${align}">${value}</td>
        </tr>`
    )
    .join("");
}

export function layout(body: string, rtl: boolean, lang: string): string {
  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}">
<body style="margin:0;padding:0;background:#f7f5f0;font-family:Arial,'Segoe UI',Tahoma,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f5f0;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e1d3" dir="${rtl ? "rtl" : "ltr"}">
        <tr><td style="background:#0f2b21;padding:20px 24px;text-align:left" dir="ltr">
          <span style="color:#f7f4ec;font-size:20px;font-weight:700;letter-spacing:1px">HADARA</span>
          <span style="color:#c9a24b;font-size:11px;font-weight:700;letter-spacing:3px;display:block;margin-top:4px">REAL ESTATE</span>
        </td></tr>
        <tr><td style="padding:24px;color:#3c463f;font-size:15px;line-height:1.7;text-align:${rtl ? "right" : "left"}">${body}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const ltrSpan = (value: string) => `<span dir="ltr" style="white-space:nowrap">${value}</span>`;

/* ---------- Visitor emails ---------- */

/** What the email is about: the new booking, the team's confirmation, or a new time to answer. */
export type VisitorUpdate =
  | { kind: "booked" }
  | { kind: "confirmed"; sequence: number }
  | { kind: "rescheduled"; sequence: number; acceptUrl: string; declineUrl: string }
  | { kind: "reminder"; sequence: number };

interface UpdateText {
  subject: string;
  intro: string;
  calendar: string;
}

interface RescheduleText extends UpdateText {
  question: string;
  accept: string;
  decline: string;
  declineNote: string;
}

const CONFIRMED: Record<SiteLocale, UpdateText> = {
  en: {
    subject: "Your video tour is confirmed — {ref}",
    intro: "Good news: our team has confirmed your private video tour. Here are the details:",
    calendar: "The attached calendar file adds the tour to your calendar."
  },
  ar: {
    subject: "تم تأكيد جولتك عبر الفيديو — {ref}",
    intro: "يسعدنا إبلاغك بأن فريقنا أكّد جولتك الخاصة عبر الفيديو. إليك التفاصيل:",
    calendar: "ملف التقويم المرفق يضيف الجولة إلى تقويمك."
  },
  fr: {
    subject: "Votre visite vidéo est confirmée — {ref}",
    intro: "Bonne nouvelle : notre équipe a confirmé votre visite privée en vidéo. Voici les détails :",
    calendar: "Le fichier de calendrier joint ajoute la visite à votre agenda."
  },
  ru: {
    subject: "Ваша видеоэкскурсия подтверждена — {ref}",
    intro: "Хорошие новости: наша команда подтвердила вашу частную видеоэкскурсию. Подробности:",
    calendar: "Приложенный файл календаря добавит экскурсию в ваш календарь."
  }
};

/** The day-before reminder (api/daily.ts). */
const REMINDER: Record<SiteLocale, UpdateText> = {
  en: {
    subject: "Reminder: your video tour is tomorrow — {ref}",
    intro: "A friendly reminder: your private video tour with HADARA Real Estate is tomorrow. Here are the details:",
    calendar: "The attached calendar file keeps the tour in your calendar."
  },
  ar: {
    subject: "تذكير: جولتك عبر الفيديو غداً — {ref}",
    intro: "نذكّرك بأن موعد جولتك الخاصة عبر الفيديو مع حضارة للتطوير العقاري غداً. إليك التفاصيل:",
    calendar: "ملف التقويم المرفق يحفظ الجولة في تقويمك."
  },
  fr: {
    subject: "Rappel : votre visite vidéo a lieu demain — {ref}",
    intro: "Petit rappel : votre visite privée en vidéo avec HADARA Real Estate a lieu demain. Voici les détails :",
    calendar: "Le fichier de calendrier joint conserve la visite dans votre agenda."
  },
  ru: {
    subject: "Напоминание: ваша видеоэкскурсия завтра — {ref}",
    intro: "Напоминаем: ваша частная видеоэкскурсия с HADARA Real Estate состоится завтра. Подробности:",
    calendar: "Приложенный файл календаря сохранит экскурсию в вашем календаре."
  }
};

const RESCHEDULED: Record<SiteLocale, RescheduleText> = {
  en: {
    subject: "New time for your video tour — {ref}",
    intro: "Our team has updated the time of your private video tour. Here are the new details:",
    calendar: "The attached calendar file has the new time.",
    question: "Does this time suit you?",
    accept: "Yes, this time suits me",
    decline: "I need another time",
    declineNote: "If you need another time, our team will contact you to agree on one."
  },
  ar: {
    subject: "موعد جديد لجولتك عبر الفيديو — {ref}",
    intro: "قام فريقنا بتحديث موعد جولتك الخاصة عبر الفيديو. إليك التفاصيل الجديدة:",
    calendar: "ملف التقويم المرفق يتضمن الموعد الجديد.",
    question: "هل يناسبك هذا الموعد؟",
    accept: "نعم، الموعد مناسب",
    decline: "أحتاج إلى موعد آخر",
    declineNote: "إذا كنت تحتاج إلى موعد آخر، فسيتواصل معك فريقنا للاتفاق على موعد يناسبك."
  },
  fr: {
    subject: "Nouvel horaire pour votre visite vidéo — {ref}",
    intro: "Notre équipe a modifié l'horaire de votre visite privée en vidéo. Voici les nouveaux détails :",
    calendar: "Le fichier de calendrier joint contient le nouvel horaire.",
    question: "Cet horaire vous convient-il ?",
    accept: "Oui, cet horaire me convient",
    decline: "J'ai besoin d'un autre horaire",
    declineNote: "Si vous avez besoin d'un autre horaire, notre équipe vous contactera pour en convenir."
  },
  ru: {
    subject: "Новое время вашей видеоэкскурсии — {ref}",
    intro: "Наша команда изменила время вашей частной видеоэкскурсии. Новые подробности:",
    calendar: "В приложенном файле календаря — новое время.",
    question: "Вам подходит это время?",
    accept: "Да, это время мне подходит",
    decline: "Мне нужно другое время",
    declineNote: "Если вам нужно другое время, наша команда свяжется с вами, чтобы его согласовать."
  }
};

const button = (href: string, label: string, primary: boolean) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 6px 10px;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;${
    primary ? "background:#0f2b21;color:#ffffff" : "background:#ffffff;color:#0f2b21;border:1px solid #0f2b21"
  }">${escapeHtml(label)}</a>`;

export function visitorEmail(
  details: BookingDetails,
  update: VisitorUpdate = { kind: "booked" }
): { subject: string; html: string; text: string; attachment: EmailAttachment } {
  const locale = details.locale;
  const text = VISITOR[locale];
  const variant =
    update.kind === "confirmed"
      ? CONFIRMED[locale]
      : update.kind === "rescheduled"
        ? RESCHEDULED[locale]
        : update.kind === "reminder"
          ? REMINDER[locale]
          : null;
  const reschedule = update.kind === "rescheduled" ? RESCHEDULED[locale] : null;
  const intro = variant?.intro ?? text.intro;
  const rtl = locale === "ar";
  const ms = details.slot.getTime();
  const app = APPS[locale][details.app];
  const date = formatDate(ms, locale, ISTANBUL);
  const time = `${formatTime(ms, locale, ISTANBUL)} ${text.istanbul}`;
  const local = visitorClock(details, locale);
  const needsLink = details.app === "zoom" || details.app === "meet";
  const projectNames = list(details.projects.map((p) => p.name), locale);

  const rows: [string, string][] = [
    [text.reference, `<strong style="color:#0f2b21;font-size:17px" dir="ltr">${escapeHtml(details.reference)}</strong>`],
    [text.projects, details.projects.map((p) => `<a href="${escapeHtml(p.url)}" style="color:#0f2b21">${escapeHtml(p.name)}</a>`).join("<br>")],
    [text.date, escapeHtml(date)],
    [text.time, `${escapeHtml(time)}${local ? `<br><span style="color:#6f776f;font-weight:400;font-size:13px">${escapeHtml(local)} — ${text.yourTime}</span>` : ""}`],
    [text.app, escapeHtml(app)],
    [text.language, escapeHtml(TOUR_LANGUAGES[locale][details.tourLanguage])]
  ];

  // A new time asks the visitor to answer; the other emails explain what happens next.
  const answer =
    update.kind === "rescheduled" && reschedule
      ? `
      <p style="margin:22px 0 12px;font-weight:700;color:#0f2b21;font-size:16px;text-align:center">${reschedule.question}</p>
      <p style="margin:0 0 6px;text-align:center">${button(update.acceptUrl, reschedule.accept, true)}${button(update.declineUrl, reschedule.decline, false)}</p>
      <p style="margin:0 0 18px;color:#6f776f;font-size:13px;text-align:center">${reschedule.declineNote}</p>`
      : `
      <p style="margin:22px 0 6px;font-weight:700;color:#0f2b21">${text.nextTitle}</p>
      <p style="margin:0 0 8px">${escapeHtml(fill(text.next, { app }))}${needsLink ? ` ${text.linkNote}` : ""}</p>
      <p style="margin:0 0 8px">${fill(escapeHtml(text.change), { phone: ltrSpan(TEAM_PHONE) })}</p>`;

  const html = layout(
    `
      <p style="margin:0 0 12px;font-size:17px;color:#0f2b21;font-weight:700">${escapeHtml(fill(text.hello, { name: details.name }))}</p>
      <p style="margin:0 0 18px">${intro}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #eee7d8;border-radius:10px;border-collapse:separate;overflow:hidden">${rowsHtml(rows, rtl)}</table>${answer}
      <p style="margin:0 0 18px;color:#6f776f;font-size:13px">${variant?.calendar ?? text.calendar}</p>
      <p style="margin:0">${text.thanks}<br><strong style="color:#0f2b21">${text.team}</strong></p>
      <p style="margin:18px 0 0;color:#6f776f;font-size:12px">${ltrSpan(TEAM_PHONE)} · ${ltrSpan(TEAM_EMAIL)} · ${ltrSpan("www.hadararealestate.com")}</p>`,
    rtl,
    locale
  );

  const plain = [
    fill(text.hello, { name: details.name }),
    "",
    intro,
    "",
    `${text.reference}: ${details.reference}`,
    `${text.projects}: ${projectNames}`,
    `${text.date}: ${date}`,
    `${text.time}: ${time}${local ? ` (${local} — ${text.yourTime})` : ""}`,
    `${text.app}: ${app}`,
    `${text.language}: ${TOUR_LANGUAGES[locale][details.tourLanguage]}`,
    "",
    ...(update.kind === "rescheduled" && reschedule
      ? [reschedule.question, `${reschedule.accept}: ${update.acceptUrl}`, `${reschedule.decline}: ${update.declineUrl}`, reschedule.declineNote]
      : [`${fill(text.next, { app })}${needsLink ? ` ${text.linkNote}` : ""}`, fill(text.change, { phone: TEAM_PHONE })]),
    "",
    text.thanks,
    text.team
  ].join("\n");

  return {
    subject: fill(variant?.subject ?? text.subject, { ref: details.reference }),
    html,
    text: plain,
    attachment: calendarFile(details, update.kind === "booked" ? 0 : update.sequence)
  };
}

/* ---------- Team copy (Arabic) ---------- */

function teamRows(details: BookingDetails): [string, string][] {
  const ms = details.slot.getTime();
  const local = visitorClock(details, "ar");
  return [
    ["رقم الحجز", details.reference],
    ["الموعد", `${formatDate(ms, "ar", ISTANBUL)} — ${formatTime(ms, "ar", ISTANBUL)} بتوقيت إسطنبول`],
    ...(local ? ([["توقيت الزبون", local]] as [string, string][]) : []),
    ["المشاريع", list(details.projects.map((p) => p.nameAr), "ar")],
    ...(details.focusAr.length ? ([["التركيز", list(details.focusAr, "ar")]] as [string, string][]) : []),
    ["التطبيق", APPS.ar[details.app]],
    ["لغة الجولة", TOUR_LANGUAGES.ar[details.tourLanguage]],
    ["الاسم", details.name],
    ["الهاتف", details.phone],
    ["الإيميل", details.email],
    ["يفضّل التواصل عبر", CONTACT_AR[details.contact]],
    ["لغة الموقع", SITE_LANGUAGE_AR[details.locale]],
    ...(details.source ? ([["المصدر", details.source]] as [string, string][]) : [])
  ];
}

export const adminUrl = (origin: string) => `${origin}/ar/admin/bookings`;

export function teamEmail(details: BookingDetails): { subject: string; html: string; text: string } {
  const ms = details.slot.getTime();
  const rows = teamRows(details).map(([label, value]): [string, string] => {
    if (label === "الهاتف") return [label, `<a href="tel:${escapeHtml(details.phone.replace(/[^\d+]/g, ""))}" dir="ltr" style="color:#0f2b21">${escapeHtml(value)}</a>`];
    if (label === "الإيميل") return [label, `<a href="mailto:${escapeHtml(value)}" dir="ltr" style="color:#0f2b21">${escapeHtml(value)}</a>`];
    if (label === "رقم الحجز") return [label, ltrSpan(escapeHtml(value))];
    return [label, escapeHtml(value)];
  });
  const projectLinks = details.projects.map((p) => `<a href="${escapeHtml(p.url)}" style="color:#0f2b21">${escapeHtml(p.nameAr)}</a>`).join(" · ");

  const html = layout(
    `
      <p style="margin:0 0 14px;font-size:17px;color:#0f2b21;font-weight:700">📅 حجز جولة جديد</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #eee7d8;border-radius:10px;border-collapse:separate;overflow:hidden">${rowsHtml(rows, true)}</table>
      <p style="margin:16px 0 6px">صفحات المشاريع: ${projectLinks}</p>
      <p style="margin:0 0 6px">الرد على هذا الإيميل بيوصل مباشرة للزبون.</p>
      <p style="margin:12px 0 0"><a href="${escapeHtml(adminUrl(details.origin))}" style="display:inline-block;background:#c9a24b;color:#081a14;font-weight:700;padding:10px 18px;border-radius:6px;text-decoration:none">فتح صفحة الحجوزات</a></p>`,
    true,
    "ar"
  );

  const plain = ["حجز جولة جديد", "", ...teamRows(details).map(([l, v]) => `${l}: ${v}`), "", `صفحة الحجوزات: ${adminUrl(details.origin)}`].join("\n");
  return {
    subject: `حجز جولة جديد: ${formatDate(ms, "ar", ISTANBUL)} ${formatTime(ms, "ar", ISTANBUL)} — ${details.name} (${details.reference})`,
    html,
    text: plain
  };
}

export function teamTelegram(details: BookingDetails): string {
  const lines = ["<b>📅 حضارة للعقار — حجز جولة جديد</b>"];
  for (const [label, value] of teamRows(details)) {
    if (label === "المشاريع") {
      lines.push(`${label}: ${details.projects.map((p) => `<a href="${escapeHtml(p.url)}">${escapeHtml(p.nameAr)}</a>`).join("، ")}`);
    } else {
      lines.push(`${label}: ${escapeHtml(value)}`);
    }
  }
  lines.push(`<a href="${escapeHtml(adminUrl(details.origin))}">فتح صفحة الحجوزات</a>`);
  return lines.join("\n");
}

export const TEAM_INBOX = TEAM_EMAIL;
