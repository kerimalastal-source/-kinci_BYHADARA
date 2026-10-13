// Checks Meta's lead forms with the live services (Graph API, Vercel Blob markers, Telegram).
// Called from api/track.ts (some page views, at most once a minute per server instance) and
// from the morning job (api/daily.ts). Does nothing until META_LEADS_TOKEN, a Blob store and
// the Telegram bot are configured.
import { BlobNotFoundError, del, head, put } from "@vercel/blob";
import { checkLeads, DEFAULT_FORMS, type LeadStore } from "./metaLeads.js";
import { sendTelegram } from "./telegram.js";
import { hasBlob } from "./socialRun.js";

const store: LeadStore = {
  async claim(path) {
    try {
      await put(path, "1", { access: "public", contentType: "text/plain", addRandomSuffix: false, allowOverwrite: false });
      return true;
    } catch (error) {
      // Writing an existing file without allowOverwrite is refused: it was claimed already.
      try {
        await head(path);
        return false;
      } catch (missing) {
        if (missing instanceof BlobNotFoundError) throw error;
        throw missing;
      }
    }
  },
  async remove(path) {
    await del(path);
  }
};

let lastRun = 0;

/** Runs a check unless this instance ran one less than `minGapMs` ago. */
export async function checkMetaLeads(minGapMs = 0): Promise<number> {
  const token = process.env.META_LEADS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!token || !pageId || !hasBlob() || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return 0;
  if (Date.now() - lastRun < minGapMs) return 0;
  lastRun = Date.now();
  const forms = (process.env.META_LEAD_FORM_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id));
  return checkLeads({
    fetch,
    token,
    pageId,
    forms: forms.length ? forms : DEFAULT_FORMS,
    store,
    telegram: async (html) => (await sendTelegram(html)) !== null,
    now: Date.now
  });
}
