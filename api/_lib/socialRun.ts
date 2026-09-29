// Publishes today's social posts with the live services: Vercel Blob (public image copies and
// the "already published" markers), Meta's Graph API and Telegram. Used by /api/social-publish
// (the 10:00 cron and the admin button). Running it twice is safe: publishDay skips whatever
// already went out.
import { BlobNotFoundError, del, head, put } from "@vercel/blob";
import { istanbulDate, metaConfig, publishDay, socialSourceUrl, type DayResult, type SocialStore } from "./social.js";
import { sendTelegram, sendTelegramPhoto } from "./telegram.js";

/**
 * Whether a Blob store is connected to the project: BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID
 * (newer connections, where @vercel/blob signs in with the deployment's OIDC token).
 */
export const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const blobStore: SocialStore = {
  async put(path, body, contentType) {
    return (await put(path, body, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 })).url;
  },
  async claim(path, body) {
    try {
      await put(path, body, { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: false });
      return true;
    } catch (error) {
      // Writing an existing file without allowOverwrite is refused: someone claimed it first.
      if (await this.stat(path)) return false;
      throw error;
    }
  },
  async stat(path) {
    try {
      return { uploadedAt: (await head(path)).uploadedAt };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  },
  async remove(path) {
    await del(path);
  }
};

export function publishTodaysPosts(now = new Date()): Promise<DayResult> {
  return publishDay(
    {
      sourceUrl: socialSourceUrl(),
      bypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET || undefined,
      store: blobStore,
      meta: metaConfig(),
      fetch,
      telegramPhoto: sendTelegramPhoto,
      telegramText: async (html) => (await sendTelegram(html)) !== null
    },
    istanbulDate(now)
  );
}
