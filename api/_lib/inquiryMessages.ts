// Texts for the inquiries inbox (api/inquiry.ts): the team's Telegram alert and email
// (Arabic), and the "we received your message" email to the visitor in their language.
import { escapeHtml } from "./telegram.js";
import { SITE_LANGUAGE_AR, TEAM_INBOX, TEAM_PHONE, fill, layout, ltrSpan, rowsHtml, type SiteLocale } from "./bookingMessages.js";

export type InquiryKind = "contact" | "property_request" | "consultation";

export interface InquiryDetails {
  reference: string;
  kind: InquiryKind;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  projects: { nameAr: string; url: string }[];
  /** "Turkish citizenship" etc., in Arabic, for the team. */
  interestsAr: string[];
  /** The form's other answers as [label, value] in Arabic (property type, budget, service…). */
  summaryAr: [string, string][];
  locale: SiteLocale;
  source: string | null;
  origin: string;
}

const KIND_AR: Record<InquiryKind, string> = {
  contact: "رسالة من صفحة تواصل معنا",
  property_request: "طلب عقار مخصص",
  consultation: "طلب استشارة التصميم الهندسي"
};

/** Telegram allows 4096 characters; the full message is always in the inbox. */
const TELEGRAM_MESSAGE_MAX = 1200;

export const inboxUrl = (origin: string) => `${origin}/ar/admin/inquiries`;

function teamRows(d: InquiryDetails): [string, string][] {
  return [
    ["رقم الطلب", d.reference],
    ["الاسم", d.name],
    ["الهاتف", d.phone],
    ["الإيميل", d.email],
    ...(d.projects.length ? ([["المشاريع", d.projects.map((p) => p.nameAr).join("، ")]] as [string, string][]) : []),
    ...(d.interestsAr.length ? ([["الاهتمامات", d.interestsAr.join("، ")]] as [string, string][]) : []),
    ...d.summaryAr,
    ...(d.subject ? ([["الموضوع", d.subject]] as [string, string][]) : []),
    ["لغة الموقع", SITE_LANGUAGE_AR[d.locale]],
    ...(d.source ? ([["المصدر", d.source]] as [string, string][]) : [])
  ];
}

export function teamTelegram(d: InquiryDetails): string {
  const lines = [`<b>📩 حضارة للعقار — ${KIND_AR[d.kind]}</b>`];
  for (const [label, value] of teamRows(d)) {
    if (label === "المشاريع") {
      lines.push(`${label}: ${d.projects.map((p) => `<a href="${escapeHtml(p.url)}">${escapeHtml(p.nameAr)}</a>`).join("، ")}`);
    } else {
      lines.push(`${label}: ${escapeHtml(value)}`);
    }
  }
  if (d.message) {
    const message = d.message.length > TELEGRAM_MESSAGE_MAX ? `${d.message.slice(0, TELEGRAM_MESSAGE_MAX)}…` : d.message;
    lines.push("", `💬 ${escapeHtml(message)}`);
  }
  lines.push("", `<a href="${escapeHtml(inboxUrl(d.origin))}">فتح صندوق الاستفسارات</a>`);
  return lines.join("\n");
}

export function teamEmail(d: InquiryDetails): { subject: string; html: string; text: string } {
  const rows = teamRows(d).map(([label, value]): [string, string] => {
    if (label === "الهاتف") return [label, `<a href="tel:${escapeHtml(d.phone.replace(/[^\d+]/g, ""))}" dir="ltr" style="color:#0f2b21">${escapeHtml(value)}</a>`];
    if (label === "الإيميل") return [label, `<a href="mailto:${escapeHtml(value)}" dir="ltr" style="color:#0f2b21">${escapeHtml(value)}</a>`];
    if (label === "رقم الطلب") return [label, ltrSpan(escapeHtml(value))];
    if (label === "المشاريع") return [label, d.projects.map((p) => `<a href="${escapeHtml(p.url)}" style="color:#0f2b21">${escapeHtml(p.nameAr)}</a>`).join("، ")];
    return [label, escapeHtml(value)];
  });
  const message = d.message
    ? `<p style="margin:16px 0 6px;color:#6f776f;font-size:13px">الرسالة</p>
      <p style="margin:0;padding:12px 14px;border:1px solid #eee7d8;border-radius:10px;background:#fbf9f4;white-space:pre-wrap">${escapeHtml(d.message)}</p>`
    : "";

  const html = layout(
    `
      <p style="margin:0 0 14px;font-size:17px;color:#0f2b21;font-weight:700">📩 ${KIND_AR[d.kind]}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #eee7d8;border-radius:10px;border-collapse:separate;overflow:hidden">${rowsHtml(rows, true)}</table>
      ${message}
      <p style="margin:16px 0 6px">الرد على هذا الإيميل بيوصل مباشرة للزبون.</p>
      <p style="margin:12px 0 0"><a href="${escapeHtml(inboxUrl(d.origin))}" style="display:inline-block;background:#c9a24b;color:#081a14;font-weight:700;padding:10px 18px;border-radius:6px;text-decoration:none">فتح صندوق الاستفسارات</a></p>`,
    true,
    "ar"
  );

  const text = [KIND_AR[d.kind], "", ...teamRows(d).map(([l, v]) => `${l}: ${v}`), "", d.message, "", `صندوق الاستفسارات: ${inboxUrl(d.origin)}`]
    .filter((line, i, all) => line || all[i - 1])
    .join("\n");
  return { subject: `${KIND_AR[d.kind]}: ${d.name} (${d.reference})`, html, text };
}

interface VisitorText {
  subject: string;
  hello: string;
  intro: string;
  reference: string;
  next: string;
  yourMessage: string;
  contact: string;
  site: string;
}

const VISITOR: Record<SiteLocale, VisitorText> = {
  en: {
    subject: "We received your message — HADARA Real Estate ({ref})",
    hello: "Hello {name},",
    intro: "Thank you for contacting HADARA Real Estate. Your message has reached our team.",
    reference: "Your request number: {ref}",
    next: "One of our advisors will contact you shortly.",
    yourMessage: "Your message",
    contact: "For anything urgent, call or message us on WhatsApp:",
    site: "Visit our website"
  },
  ar: {
    subject: "وصلتنا رسالتك — حضارة للتطوير العقاري ({ref})",
    hello: "مرحباً {name}،",
    intro: "شكراً لتواصلك مع حضارة للتطوير العقاري. وصلت رسالتك إلى فريقنا.",
    reference: "رقم طلبك: {ref}",
    next: "سيتواصل معك أحد مستشارينا قريباً.",
    yourMessage: "رسالتك",
    contact: "للأمور العاجلة، اتصل بنا أو راسلنا عبر واتساب:",
    site: "زيارة موقعنا"
  },
  fr: {
    subject: "Nous avons bien reçu votre message — HADARA Real Estate ({ref})",
    hello: "Bonjour {name},",
    intro: "Merci d'avoir contacté HADARA Real Estate. Votre message est bien parvenu à notre équipe.",
    reference: "Votre numéro de demande : {ref}",
    next: "L'un de nos conseillers vous contactera très prochainement.",
    yourMessage: "Votre message",
    contact: "Pour toute urgence, appelez-nous ou écrivez-nous sur WhatsApp :",
    site: "Visiter notre site"
  },
  ru: {
    subject: "Мы получили ваше сообщение — HADARA Real Estate ({ref})",
    hello: "Здравствуйте, {name}!",
    intro: "Спасибо, что обратились в HADARA Real Estate. Ваше сообщение получено нашей командой.",
    reference: "Номер вашего запроса: {ref}",
    next: "Наш консультант свяжется с вами в ближайшее время.",
    yourMessage: "Ваше сообщение",
    contact: "По срочным вопросам звоните или пишите нам в WhatsApp:",
    site: "Перейти на сайт"
  }
};

export function visitorEmail(d: InquiryDetails): { subject: string; html: string; text: string } {
  const t = VISITOR[d.locale];
  const rtl = d.locale === "ar";
  const site = d.locale === "en" ? d.origin : `${d.origin}/${d.locale}`;
  const message = d.message
    ? `<p style="margin:18px 0 6px;color:#6f776f;font-size:13px">${escapeHtml(t.yourMessage)}</p>
      <p style="margin:0;padding:12px 14px;border:1px solid #eee7d8;border-radius:10px;background:#fbf9f4;white-space:pre-wrap">${escapeHtml(d.message)}</p>`
    : "";
  const html = layout(
    `
      <p style="margin:0 0 12px">${escapeHtml(fill(t.hello, { name: d.name }))}</p>
      <p style="margin:0 0 12px">${escapeHtml(t.intro)}</p>
      <p style="margin:0 0 12px;padding:12px 14px;border-radius:10px;background:#f3ecd9;color:#0f2b21;font-weight:700">${fill(escapeHtml(t.reference), { ref: ltrSpan(escapeHtml(d.reference)) })}</p>
      <p style="margin:0">${escapeHtml(t.next)}</p>
      ${message}
      <p style="margin:18px 0 0">${escapeHtml(t.contact)} ${ltrSpan(TEAM_PHONE)}</p>
      <p style="margin:14px 0 0"><a href="${escapeHtml(site)}" style="color:#0f2b21">${escapeHtml(t.site)}</a></p>`,
    rtl,
    d.locale
  );
  const text = [
    fill(t.hello, { name: d.name }),
    "",
    t.intro,
    fill(t.reference, { ref: d.reference }),
    t.next,
    ...(d.message ? ["", `${t.yourMessage}:`, d.message] : []),
    "",
    `${t.contact} ${TEAM_PHONE}`,
    `${TEAM_INBOX} · ${site}`
  ].join("\n");
  return { subject: fill(t.subject, { ref: d.reference }), html, text };
}
