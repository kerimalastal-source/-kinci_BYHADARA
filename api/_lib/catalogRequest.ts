// "Send me the catalogue" on a project page (POST /api/inquiry with kind "catalog"): the visitor
// leaves a WhatsApp number (and, if they like, a name) and gets the PDF catalogue. The request is
// saved as a customer through save_catalog_request() (migration 0041, called with the cron secret),
// and the team gets a Telegram alert with a ready WhatsApp message to send the visitor.
//
// Answers: 200 {reference, url} · 429 {error:"limit"} · 400 {error:"invalid"} · 503 {error:"unavailable"}.
// On 503 (for example before 0041 has been run) the browser still hands over the catalogue and
// offers WhatsApp instead, so the visitor is never left empty-handed.
import { waitUntil } from "@vercel/functions";
import { escapeHtml, sendTelegram } from "./telegram.js";
import { hasSupabase, rpc, RpcError } from "./supabase.js";
import { SITE_LANGUAGE_AR, type SiteLocale } from "./bookingMessages.js";
import { PROJECT_NAMES } from "./projectNames.js";

const LOCALES: readonly SiteLocale[] = ["en", "ar", "fa", "fr", "ru", "de"];
const PHONE = /^\+?[0-9][0-9 ()-]{5,28}$/;
const BOT_AGENT = /bot|crawl|spider|slurp|headless|lighthouse/i;
/** Typing a phone number takes a person longer than this. */
const MIN_FILL_MS = 2000;
const SITE = "https://www.hadararealestate.com";

/** The PDFs in public/catalogs/ (web edition of scripts/catalog; Arabic and English only). */
export const CATALOGS: Record<string, { path: string; ar: string }> = {
  "catalogue-ar": { path: "/catalogs/hadara-catalogue-ar.pdf", ar: "كتالوج مشاريع حضارة (بالعربية)" },
  "catalogue-en": { path: "/catalogs/hadara-catalogue-en.pdf", ar: "كتالوج مشاريع حضارة (بالإنجليزية)" },
  "villa-ar": { path: "/catalogs/marmara-haven-villa-ar.pdf", ar: "كتالوج فيلا مرمرة هيفن (بالعربية)" },
  "villa-en": { path: "/catalogs/marmara-haven-villa-en.pdf", ar: "كتالوج فيلا مرمرة هيفن (بالإنجليزية)" }
};

/** The villa has its own brochure; every other project gets the catalogue of all projects. Keep in step with src/data/catalogs.ts. */
export function catalogKey(slug: string, locale: SiteLocale): string {
  return `${slug === "marmara-haven-villa" ? "villa" : "catalogue"}-${locale === "ar" ? "ar" : "en"}`;
}

interface CatalogRequest {
  name: string;
  phone: string;
  slug: string;
  locale: SiteLocale;
  source: string | null;
  page: string | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const text = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function parseCatalogRequest(body: unknown): CatalogRequest | null {
  if (!body || typeof body !== "object") return null;
  const d = body as Record<string, unknown>;
  // Honeypot (a hidden field people never see) and fill time: bots fail one or both.
  if (text(d.website, 200) || typeof d.elapsedMs !== "number" || d.elapsedMs < MIN_FILL_MS) return null;
  const locale = text(d.locale, 4) as SiteLocale;
  const phone = text(d.phone, 30);
  const slug = text(d.project, 60);
  if (!LOCALES.includes(locale) || !PHONE.test(phone) || phone.replace(/\D/g, "").length < 7 || !PROJECT_NAMES[slug]) return null;
  const page = text(d.page, 200);
  return { name: text(d.name, 100), phone, slug, locale, source: text(d.source, 300) || null, page: page.startsWith("/") ? page : null };
}

/** The message the team sends the visitor on WhatsApp, in the visitor's language. */
const REPLY: Record<SiteLocale, (name: string, url: string, project: string) => string> = {
  ar: (name, url, project) =>
    `مرحباً${name ? ` ${name}` : ""}، معك فريق حضارة العقارية. هذا الكتالوج الذي طلبته من موقعنا:\n${url}\n\nيسعدنا أن نرسل لك الأسعار والمخططات المتوفرة لمشروع ${project}. ما الذي تبحث عنه؟`,
  en: (name, url, project) =>
    `Hello${name ? ` ${name}` : ""}, this is the HADARA Real Estate team. Here is the catalogue you asked for on our website:\n${url}\n\nWe would be glad to send you the available prices and floor plans for ${project}. What are you looking for?`,
  fa: (name, url, project) =>
    `سلام${name ? ` ${name}` : ""}، تیم املاک حضارة هستیم. این کاتالوگی است که در سایت ما درخواست کردید:\n${url}\n\nخوشحال می‌شویم قیمت‌ها و پلان‌های موجود پروژه ${project} را برایتان بفرستیم. به دنبال چه ملکی هستید؟`,
  fr: (name, url, project) =>
    `Bonjour${name ? ` ${name}` : ""}, ici l'équipe HADARA Real Estate. Voici le catalogue que vous avez demandé sur notre site :\n${url}\n\nNous vous enverrons volontiers les prix et les plans disponibles pour ${project}. Que recherchez-vous ?`,
  ru: (name, url, project) =>
    `Здравствуйте${name ? `, ${name}` : ""}! Это команда HADARA Real Estate. Вот каталог, который вы запросили на нашем сайте:\n${url}\n\nБудем рады прислать актуальные цены и планировки по проекту ${project}. Что вы ищете?`,
  de: (name, url, project) =>
    `Guten Tag${name ? ` ${name}` : ""}, hier ist das Team von HADARA Real Estate. Hier ist der Katalog, den Sie auf unserer Website angefordert haben:\n${url}\n\nGerne senden wir Ihnen die aktuellen Preise und verfügbaren Grundrisse für ${project}. Wonach suchen Sie?`
};

export function catalogAlert(r: CatalogRequest, reference: string, key: string): string {
  const names = PROJECT_NAMES[r.slug];
  const url = `${SITE}${CATALOGS[key].path}`;
  const digits = r.phone.replace(/\D/g, "").replace(/^00/, "");
  const reply = `https://wa.me/${digits}?text=${encodeURIComponent(REPLY[r.locale](r.name.split(/\s+/)[0] ?? "", url, names[r.locale]))}`;
  const page = `${SITE}${r.page ?? `${r.locale === "en" ? "" : `/${r.locale}`}/projects/${r.slug}`}`;
  const lines = [
    "📄 <b>حضارة للعقار — طلب كتالوج</b>",
    "",
    `👤 الاسم: ${r.name ? escapeHtml(r.name) : "لم يكتب اسمه"}`,
    `📱 واتساب: <a href="https://wa.me/${digits}">‎${escapeHtml(r.phone)}</a>`,
    `🏠 المشروع: <a href="${escapeHtml(page)}">${escapeHtml(names.ar)}</a>`,
    `📕 الكتالوج: ${CATALOGS[key].ar}`,
    `🌐 لغة الموقع: ${SITE_LANGUAGE_AR[r.locale]}`
  ];
  if (r.source) lines.push(`📣 الإعلان: ${escapeHtml(r.source)}`);
  lines.push(
    "",
    `👉 <a href="${escapeHtml(reply)}">أرسل له الكتالوج على واتساب (رسالة جاهزة بلغته)</a>`,
    `🗂️ حُفظ في سجل الزبائن: <a href="${SITE}/ar/admin/customers?q=${encodeURIComponent(reference)}">${escapeHtml(reference)}</a>`
  );
  return lines.join("\n");
}

export async function handleCatalogRequest(request: Request, body: unknown): Promise<Response> {
  const r = parseCatalogRequest(body);
  if (!r || BOT_AGENT.test(request.headers.get("user-agent") ?? "")) return json({ error: "invalid" }, 400);
  const secret = process.env.CRON_SECRET;
  if (!hasSupabase() || !secret) {
    console.error("catalog: Supabase URL / anon key or CRON_SECRET are not set");
    return json({ error: "unavailable" }, 503);
  }

  const key = catalogKey(r.slug, r.locale);
  let result: { reference?: string; created?: boolean; error?: string };
  try {
    result = (await rpc("save_catalog_request", {
      p_secret: secret,
      p_name: r.name,
      p_phone: r.phone,
      p_project: r.slug,
      p_catalog: key,
      p_message: `طلب ${CATALOGS[key].ar} من صفحة مشروع ${PROJECT_NAMES[r.slug].ar}.`,
      p_locale: r.locale,
      p_source: r.source,
      p_page: r.page
    })) as typeof result;
  } catch (error) {
    // 404: migration 0041 hasn't been run — the browser hands over the catalogue and offers WhatsApp instead.
    if (error instanceof RpcError && error.status === 404) console.error("catalog: save_catalog_request is missing — run supabase/migrations/0041");
    else console.error(`catalog: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ error: "unavailable" }, 503);
  }

  if (result?.error || !result?.reference) {
    const error = result?.error ?? "unavailable";
    if (error === "forbidden") console.error("catalog: the database rejected CRON_SECRET");
    return json({ error: error === "limit" || error === "invalid" ? error : "unavailable" }, error === "limit" ? 429 : error === "invalid" ? 400 : 503);
  }

  // The same person asking again today gets the catalogue again, without a second alert.
  if (result.created) {
    const reference = result.reference;
    waitUntil(
      sendTelegram(catalogAlert(r, reference, key)).then(
        () => undefined,
        (e) => console.error(`catalog: Telegram alert failed: ${e instanceof Error ? e.message : "unknown"}`)
      )
    );
  }
  return json({ reference: result.reference, url: CATALOGS[key].path });
}
