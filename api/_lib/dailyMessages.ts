// The morning summary sent to the team's Telegram by the daily job (api/daily.ts).
import { escapeHtml } from "./telegram.js";
import { ISTANBUL, formatDate } from "./bookingMessages.js";
import { PROJECT_NAMES } from "./projectNames.js";

/** What daily_digest() returns (supabase/migrations/0008). */
export interface Digest {
  today: string;
  tours_today: {
    reference: string;
    slot_start: string;
    name: string;
    phone: string;
    projects: string[];
    app: string;
    status: string;
    customer_reply: string | null;
  }[];
  reminders: {
    id: string;
    reference: string;
    slot_start: string;
    name: string;
    email: string;
    phone: string;
    projects: string[];
    app: string;
    tour_language: string;
    contact_method: string;
    site_locale: string | null;
    visitor_timezone: string | null;
    source: string | null;
  }[];
  bookings_waiting: number;
  bookings_yesterday: number;
  inquiries_new: number;
  inquiries_yesterday: number;
  inquiries_stale_count: number;
  inquiries_stale: { reference: string; name: string; kind: string; created_at: string }[];
  listings_pending: number;
  visitors_yesterday: number;
  sources_yesterday: { source: string; visitors: number }[];
}

const KIND_AR: Record<string, string> = {
  contact: "تواصل معنا",
  property_request: "طلب عقار مخصص",
  consultation: "استشارة التصميم الهندسي"
};

/** Where visitors came from, in Arabic ("instagram" → "إنستغرام"). */
export function sourceAr(source: string): string {
  const known: Record<string, string> = {
    direct: "مباشر",
    none: "بدون إعلان",
    "google-ads": "إعلانات جوجل",
    "google.com": "بحث جوجل",
    google: "جوجل",
    facebook: "فيسبوك",
    "facebook.com": "فيسبوك",
    instagram: "إنستغرام",
    "instagram.com": "إنستغرام",
    tiktok: "تيك توك",
    "tiktok.com": "تيك توك",
    "bing.com": "بحث Bing",
    whatsapp: "واتساب",
    youtube: "يوتيوب",
    "youtube.com": "يوتيوب"
  };
  return known[source] ?? source;
}

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ISTANBUL }).format(Date.parse(iso));

function age(iso: string): string {
  const hours = Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 48) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return days <= 10 ? `منذ ${days} أيام` : `منذ ${days} يوماً`;
}

const projectsAr = (slugs: string[]) => slugs.map((slug) => PROJECT_NAMES[slug]?.ar ?? slug).join("، ");

function tourState(tour: Digest["tours_today"][number]): string {
  if (tour.status === "confirmed") return "مؤكَّد ✅";
  if (tour.customer_reply === "proposed") return "اختار الزبون الموعد — بانتظار تأكيدكم";
  return "بانتظار التأكيد ⏳";
}

export function dailySummary(d: Digest, site: string, reminders: { sent: number; failed: string[] }): string {
  const link = (path: string, label: string) => `<a href="${escapeHtml(`${site}/ar${path}`)}">${label}</a>`;
  const lines = [`<b>☀️ حضارة للعقار — ملخص اليوم</b>`, escapeHtml(formatDate(Date.parse(`${d.today}T12:00:00Z`), "ar", "UTC")), ""];

  lines.push(`📅 <b>جولات اليوم (${d.tours_today.length})</b>`);
  if (d.tours_today.length) {
    for (const tour of d.tours_today) {
      lines.push(`• ${time(tour.slot_start)} — ${escapeHtml(tour.name)} (${escapeHtml(projectsAr(tour.projects))}) · ${tourState(tour)}`);
    }
  } else {
    lines.push("لا توجد جولات اليوم.");
  }
  if (d.bookings_waiting) lines.push(`⏳ حجوزات قادمة بانتظار التأكيد: ${d.bookings_waiting}`);
  if (reminders.sent) lines.push(`📧 أُرسل تذكير بالإيميل لـ ${reminders.sent} من زبائن جولات الغد.`);
  if (reminders.failed.length) lines.push(`⚠️ تعذّر إرسال التذكير إلى: ${escapeHtml(reminders.failed.join("، "))} — ذكّروهم بأنفسكم.`);

  lines.push("", `📩 <b>استفسارات جديدة بدون متابعة: ${d.inquiries_new}</b> (وصل أمس: ${d.inquiries_yesterday})`);
  if (d.inquiries_stale_count) {
    lines.push(`⚠️ بدون رد منذ أكثر من 24 ساعة (${d.inquiries_stale_count}):`);
    for (const item of d.inquiries_stale) {
      lines.push(`• ${escapeHtml(item.name)} — ${KIND_AR[item.kind] ?? item.kind} — ${age(item.created_at)}`);
    }
    if (d.inquiries_stale_count > d.inquiries_stale.length) lines.push(`… و${d.inquiries_stale_count - d.inquiries_stale.length} آخرون`);
  }
  if (d.listings_pending) lines.push(`🏠 إعلانات إعادة بيع بانتظار المراجعة: ${d.listings_pending}`);

  const sources = d.sources_yesterday.map((s) => `${escapeHtml(sourceAr(s.source))} (${s.visitors})`).join("، ");
  lines.push("", `👥 زوار أمس: ${d.visitors_yesterday}${sources ? ` — أهم المصادر: ${sources}` : ""}`);
  lines.push(`🗓️ حجوزات جولات جديدة أمس: ${d.bookings_yesterday}`);

  lines.push("", `${link("/admin", "لوحة التحكم")} · ${link("/admin/inquiries", "الاستفسارات")} · ${link("/admin/bookings", "الحجوزات")} · ${link("/admin/stats", "الإحصائيات")}`);
  return lines.join("\n");
}
