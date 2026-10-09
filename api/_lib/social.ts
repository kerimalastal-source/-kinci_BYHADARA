// Daily social posts, published automatically (owner's request 2026-09-29, the same way as
// HADARA Hospitality's PRs #135–#137, adapted to this Vite + Supabase site).
//
// Every morning (8:40 Istanbul) a scheduled Claude session writes two posts
// (scripts/social/README.md) and pushes them to the `social-posts` branch as
// public/social/<date>/: day.json (the order), post-<n>.json ({id, topic, image, fb, ig}) and
// post-<n>.jpg. Vercel builds that branch; its build sits behind Vercel's sign-in, so this reads
// it with the project's automation bypass (VERCEL_AUTOMATION_BYPASS_SECRET), copies each image to
// Vercel Blob for a public link, and publishes: the Facebook Page (fb caption, the Page's own
// token), Instagram (ig caption: container → FINISHED → media_publish) and always Telegram.
//
// Each post goes out once per platform: small marker files in Blob
// (social-state/<date>/<post>/<platform>.lock|.done) remember what was published, so the cron,
// the admin button or a second press never post twice, and a retry after "Facebook ok,
// Instagram failed" publishes Instagram only. No database table needed.
import { escapeHtml } from "./telegram.js";

export interface SocialPost {
  id: string;
  topic: string;
  /** File next to post-<n>.json, e.g. "post-1.jpg" (JPEG: Instagram takes nothing else). */
  image: string;
  fb: string;
  ig: string;
  /** Istanbul time "HH:MM" the post goes out at (the first run from then on); none = the day's first run. */
  at?: string;
  /**
   * A Reel: this MP4 (next to post-<n>.json, 9:16) goes out as a Facebook Reel and an Instagram
   * Reel; `image` is then its cover (Instagram grid, Telegram report).
   */
  video?: string;
  /** A Story (24 hours, no caption): `image` is a 9:16 picture posted as a Facebook Page story and an Instagram story. */
  story?: boolean;
  /**
   * A carousel (owner's request 2026-10-08): 2-10 JPEGs next to post-<n>.json
   * (post-<n>-<k>.jpg, in order) posted as one Facebook post with several photos and one
   * Instagram carousel; `image` is the cover (the Telegram report).
   */
  slides?: string[];
}

export interface MetaConfig {
  pageId: string;
  /** Optional: without it Instagram's caption goes to Telegram to post by hand. */
  igUserId: string | null;
  token: string;
}

/** Blob-like storage: public files plus markers that can be claimed only once. */
export interface SocialStore {
  /** Stores a public file (overwriting) and returns its URL. */
  put(path: string, body: ArrayBuffer | string, contentType: string): Promise<string>;
  /** Writes the file only if it doesn't exist yet: false when it already did. */
  claim(path: string, body: string): Promise<boolean>;
  /** Upload time of the file, or null when it doesn't exist. */
  stat(path: string): Promise<{ uploadedAt: Date } | null>;
  remove(path: string): Promise<void>;
  /** A small text file's content, or null when it doesn't exist. */
  read(path: string): Promise<string | null>;
}

export interface PublishDeps {
  /** Base URL serving public/social/ (the social-posts branch build). */
  sourceUrl: string;
  /** Vercel's automation bypass for that protected build, if any. */
  bypass?: string;
  store: SocialStore;
  meta: MetaConfig | null;
  fetch: typeof fetch;
  telegramPhoto: (url: string, caption: string) => Promise<boolean>;
  telegramText: (html: string) => Promise<boolean>;
  /** Milliseconds between Instagram status checks (tests pass 0). */
  pollMs?: number;
  now?: () => Date;
}

export type Platform = "facebook" | "instagram";

export interface PostResult {
  post: string;
  facebook: "published" | "already" | "failed" | "manual" | "busy" | "scheduled";
  instagram: "published" | "already" | "failed" | "manual" | "busy" | "scheduled";
  errors: string[];
}

export interface DayResult {
  date: string;
  found: boolean;
  results: PostResult[];
}

const env = (name: string): string | undefined => process.env[name] || undefined;

export function metaConfig(): MetaConfig | null {
  const pageId = env("META_PAGE_ID");
  const token = env("META_ACCESS_TOKEN");
  return pageId && token ? { pageId, igUserId: env("META_IG_USER_ID") ?? null, token } : null;
}

/** The social-posts branch build (Vercel's branch alias; SOCIAL_SOURCE_URL overrides it). */
export function socialSourceUrl(): string {
  return (env("SOCIAL_SOURCE_URL") ?? "https://kinci-byhadara-git-social-posts-hadara1.vercel.app").replace(/\/$/, "");
}

export function istanbulDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
}

/** Istanbul's time of day as "HH:MM" (24 h). */
export function istanbulTime(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}

const GRAPH = "https://graph.facebook.com/v21.0";
export const IG_MAX_CHARS = 2200;
export const IG_MAX_HASHTAGS = 30;
/** A claim older than this with no result is a run that died: it may be taken again. */
const STALE_LOCK_MS = 15 * 60_000;

export function hashtagCount(text: string): number {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

/** Why Instagram would refuse this caption, or null. It is never shortened for them. */
export function instagramCaptionProblem(caption: string): string | null {
  const chars = [...caption].length;
  const tags = hashtagCount(caption);
  if (chars > IG_MAX_CHARS) return `النص ${chars} حرفاً والحد ${IG_MAX_CHARS}`;
  if (tags > IG_MAX_HASHTAGS) return `${tags} هاشتاغ والحد ${IG_MAX_HASHTAGS}`;
  return null;
}

async function graph(deps: PublishDeps, path: string, params: Record<string, string>, method: "GET" | "POST", token: string) {
  const query = new URLSearchParams({ ...params, access_token: token });
  const response = await deps.fetch(method === "GET" ? `${GRAPH}/${path}?${query}` : `${GRAPH}/${path}`, {
    method,
    ...(method === "POST" ? { body: query, headers: { "content-type": "application/x-www-form-urlencoded" } } : {}),
    signal: AbortSignal.timeout(30_000)
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  // Meta's error messages never contain the token, and neither do ours.
  if (!response.ok || data.error) throw new Error(`${path.split("/").pop()}: ${data.error?.message ?? `HTTP ${response.status}`}`);
  return data;
}

/**
 * Page posts need the Page's own token: META_ACCESS_TOKEN is the system user's (Hadara Real
 * Poster), so ask for the Page token with it first; if that lookup gives nothing, the token
 * is used as it is (it may already be a Page token).
 */
async function pageToken(deps: PublishDeps, meta: MetaConfig): Promise<string> {
  const data = await graph(deps, meta.pageId, { fields: "access_token" }, "GET", meta.token).catch(() => ({}) as Record<string, unknown>);
  return typeof data.access_token === "string" && data.access_token ? data.access_token : meta.token;
}

async function publishFacebook(deps: PublishDeps, meta: MetaConfig, imageUrl: string, caption: string): Promise<string> {
  const data = await graph(deps, `${meta.pageId}/photos`, { url: imageUrl, message: caption }, "POST", await pageToken(deps, meta));
  return String(data.post_id ?? data.id);
}

async function publishInstagram(deps: PublishDeps, meta: MetaConfig, imageUrl: string, caption: string): Promise<string> {
  const container = await graph(deps, `${meta.igUserId}/media`, { image_url: imageUrl, caption }, "POST", meta.token);
  const id = String(container.id);
  // Instagram downloads and processes the image first; publishing before FINISHED fails.
  let finished = false;
  for (let attempt = 0; attempt < 20 && !finished; attempt++) {
    const status = await graph(deps, id, { fields: "status_code" }, "GET", meta.token);
    if (status.status_code === "FINISHED") finished = true;
    else if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`media: ${status.status_code}`);
    else await new Promise((resolve) => setTimeout(resolve, deps.pollMs ?? 2000));
  }
  if (!finished) throw new Error("media: not ready after 40 seconds");
  const published = await graph(deps, `${meta.igUserId}/media_publish`, { creation_id: id }, "POST", meta.token);
  return String(published.id);
}

/**
 * Facebook Reel: start an upload session on the Page, send the video bytes, then finish with
 * the caption (published right away; Facebook processes it after). The bytes go up directly:
 * Facebook refuses to fetch it from the Blob URL ("Restricted by robots.txt").
 */
async function publishFacebookReel(deps: PublishDeps, meta: MetaConfig, video: ArrayBuffer, caption: string): Promise<string> {
  const token = await pageToken(deps, meta);
  const start = await graph(deps, `${meta.pageId}/video_reels`, { upload_phase: "start" }, "POST", token);
  const videoId = String(start.video_id ?? "");
  if (!videoId) throw new Error("video_reels: no video_id");
  const upload = await deps.fetch(`https://rupload.facebook.com/video-upload/v21.0/${videoId}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(video.byteLength), "Content-Type": "application/octet-stream" },
    body: video,
    signal: AbortSignal.timeout(40_000)
  });
  const uploaded = (await upload.json().catch(() => ({}))) as { success?: boolean; debug_info?: { message?: string } };
  if (!upload.ok || !uploaded.success) throw new Error(`video upload: ${uploaded.debug_info?.message ?? `HTTP ${upload.status}`}`);
  await graph(deps, `${meta.pageId}/video_reels`, { upload_phase: "finish", video_id: videoId, video_state: "PUBLISHED", description: caption }, "POST", token);
  return videoId;
}

/**
 * Instagram Reel: the container's id is kept in `instagram.container`, so a run that stops
 * waiting for Instagram's video processing leaves it for the next run to publish instead of
 * uploading the video again.
 */
async function publishInstagramReel(
  deps: PublishDeps,
  meta: MetaConfig,
  videoUrl: string,
  coverUrl: string,
  caption: string,
  containerPath: string
): Promise<string> {
  let id = "";
  const kept = await deps.store.read(containerPath).catch(() => null);
  if (kept) {
    const status = await graph(deps, JSON.parse(kept).id, { fields: "status_code" }, "GET", meta.token).catch(() => null);
    if (status && status.status_code !== "ERROR" && status.status_code !== "EXPIRED") id = JSON.parse(kept).id;
  }
  if (!id) {
    const container = await graph(
      deps,
      `${meta.igUserId}/media`,
      { media_type: "REELS", video_url: videoUrl, cover_url: coverUrl, caption, share_to_feed: "true" },
      "POST",
      meta.token
    );
    id = String(container.id);
    await deps.store.put(containerPath, JSON.stringify({ id }), "application/json").catch(() => undefined);
  }
  let finished = false;
  // At most ~30 s here: the function has 60 s for the whole day; the next run carries on.
  for (let attempt = 0; attempt < 10 && !finished; attempt++) {
    const status = await graph(deps, id, { fields: "status_code" }, "GET", meta.token);
    if (status.status_code === "FINISHED") finished = true;
    else if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`media: ${status.status_code}`);
    else await new Promise((resolve) => setTimeout(resolve, deps.pollMs ?? 3000));
  }
  if (!finished) throw new Error("Instagram is still processing the video — the next run publishes it");
  const published = await graph(deps, `${meta.igUserId}/media_publish`, { creation_id: id }, "POST", meta.token);
  return String(published.id);
}

/** Facebook post with several photos: each is uploaded unpublished, then attached to one post. */
async function publishFacebookCarousel(deps: PublishDeps, meta: MetaConfig, imageUrls: string[], caption: string): Promise<string> {
  const token = await pageToken(deps, meta);
  const ids = await Promise.all(
    imageUrls.map(async (url) => String((await graph(deps, `${meta.pageId}/photos`, { url, published: "false" }, "POST", token)).id))
  );
  const attached = Object.fromEntries(ids.map((id, i) => [`attached_media[${i}]`, JSON.stringify({ media_fbid: id })]));
  const post = await graph(deps, `${meta.pageId}/feed`, { message: caption, ...attached }, "POST", token);
  return String(post.id);
}

/** Waits until an Instagram container is FINISHED (at most `attempts` checks). */
async function igReady(deps: PublishDeps, meta: MetaConfig, id: string, attempts: number): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = await graph(deps, id, { fields: "status_code" }, "GET", meta.token);
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`media: ${status.status_code}`);
    await new Promise((resolve) => setTimeout(resolve, deps.pollMs ?? 2000));
  }
  throw new Error(`media: not ready after ${attempts} checks`);
}

/** Instagram carousel: one item container per slide, then the carousel container, then publish. */
async function publishInstagramCarousel(deps: PublishDeps, meta: MetaConfig, imageUrls: string[], caption: string): Promise<string> {
  const children = await Promise.all(
    imageUrls.map(async (url) => {
      const item = await graph(deps, `${meta.igUserId}/media`, { image_url: url, is_carousel_item: "true" }, "POST", meta.token);
      const id = String(item.id);
      await igReady(deps, meta, id, 10);
      return id;
    })
  );
  const container = await graph(deps, `${meta.igUserId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }, "POST", meta.token);
  const id = String(container.id);
  await igReady(deps, meta, id, 10);
  const published = await graph(deps, `${meta.igUserId}/media_publish`, { creation_id: id }, "POST", meta.token);
  return String(published.id);
}

/** Facebook Page story: the photo is uploaded unpublished, then posted as a story. */
async function publishFacebookStory(deps: PublishDeps, meta: MetaConfig, imageUrl: string): Promise<string> {
  const token = await pageToken(deps, meta);
  const photo = await graph(deps, `${meta.pageId}/photos`, { url: imageUrl, published: "false" }, "POST", token);
  const story = await graph(deps, `${meta.pageId}/photo_stories`, { photo_id: String(photo.id) }, "POST", token);
  return String(story.post_id ?? photo.id);
}

async function publishInstagramStory(deps: PublishDeps, meta: MetaConfig, imageUrl: string): Promise<string> {
  const container = await graph(deps, `${meta.igUserId}/media`, { media_type: "STORIES", image_url: imageUrl }, "POST", meta.token);
  const id = String(container.id);
  let finished = false;
  for (let attempt = 0; attempt < 20 && !finished; attempt++) {
    const status = await graph(deps, id, { fields: "status_code" }, "GET", meta.token);
    if (status.status_code === "FINISHED") finished = true;
    else if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`media: ${status.status_code}`);
    else await new Promise((resolve) => setTimeout(resolve, deps.pollMs ?? 2000));
  }
  if (!finished) throw new Error("media: not ready after 40 seconds");
  const published = await graph(deps, `${meta.igUserId}/media_publish`, { creation_id: id }, "POST", meta.token);
  return String(published.id);
}

const markers = (date: string, post: string, what: string) => `social-state/${date}/${post}/${what}`;

/**
 * Publishes one platform once: claims `<platform>.lock`, publishes, then writes
 * `<platform>.done`. A failure removes the claim so the next run tries again; a claim left
 * by a run that died is taken over after 15 minutes.
 */
async function once(
  deps: PublishDeps,
  date: string,
  post: string,
  platform: Platform,
  publish: () => Promise<string>
): Promise<{ state: "published" | "already" | "failed" | "busy"; error?: string }> {
  const { store } = deps;
  const done = markers(date, post, `${platform}.done`);
  const lock = markers(date, post, `${platform}.lock`);
  if (await store.stat(done)) return { state: "already" };
  const stamp = JSON.stringify({ at: (deps.now?.() ?? new Date()).toISOString() });
  if (!(await store.claim(lock, stamp))) {
    const held = await store.stat(lock);
    const age = held ? (deps.now?.() ?? new Date()).getTime() - held.uploadedAt.getTime() : Infinity;
    if (age < STALE_LOCK_MS) return { state: "busy" };
    await store.remove(lock);
    if (!(await store.claim(lock, stamp))) return { state: "busy" };
  }
  if (await store.stat(done)) return { state: "already" }; // finished while we were claiming
  let id: string;
  try {
    id = await publish();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.remove(lock).catch(() => undefined);
    // The last error, for whoever checks the store (the report on Telegram says it too).
    await store.put(markers(date, post, `${platform}.error`), JSON.stringify({ error: message, at: new Date().toISOString() }), "application/json").catch(() => undefined);
    return { state: "failed", error: message };
  }
  // Published: record it (a failure here is retried a few times; the claim stays either way,
  // so nothing is posted twice).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await store.put(done, JSON.stringify({ id, at: (deps.now?.() ?? new Date()).toISOString() }), "application/json");
      break;
    } catch {
      /* try again */
    }
  }
  return { state: "published" };
}

const PLATFORM_AR: Record<Platform, string> = { facebook: "فيسبوك", instagram: "إنستغرام" };

function statusLines(result: PostResult, igProblem: string | null, hasMeta: boolean, hasInstagram: boolean): string {
  const ok = (s: PostResult["facebook"]) => s === "published" || s === "already";
  if (hasMeta && hasInstagram && ok(result.facebook) && ok(result.instagram)) return "✅ <b>نُشر على فيسبوك وإنستغرام</b>";
  if (!hasMeta) return "📸 <b>جاهز للنشر اليدوي</b>: النشر التلقائي غير مربوط بعد. النصوص في الرسائل التالية.";
  const line = (platform: Platform) => {
    const state = result[platform];
    if (ok(state)) return `✅ نُشر على ${PLATFORM_AR[platform]}`;
    if (state === "busy") return `⏳ ${PLATFORM_AR[platform]}: قيد النشر من محاولة أخرى`;
    if (state === "manual") {
      if (platform === "instagram" && igProblem) return `⚠️ إنستغرام: لم يُنشر لأن ${escapeHtml(igProblem)} — النص في الرسالة التالية للنشر يدوياً بعد تعديله`;
      return `📝 ${PLATFORM_AR[platform]} غير مربوط: النص في الرسالة التالية للنشر يدوياً`;
    }
    const reason = result.errors.find((e) => e.startsWith(`${PLATFORM_AR[platform]}:`)) ?? `${PLATFORM_AR[platform]}: خطأ غير معروف`;
    return `⚠️ ${escapeHtml(reason)} — ستُعاد المحاولة`;
  };
  return [line("facebook"), line("instagram")].join("\n");
}

async function readJson<T>(deps: PublishDeps, url: string, headers: Record<string, string>): Promise<T | null> {
  const response = await deps.fetch(url, { cache: "no-store", headers, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!response?.ok) return null;
  // A missing file on the branch build falls through the site's rewrite to index.html (200),
  // so only real JSON counts.
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Publishes the day's posts. Returns what happened to each; never throws for a single post. */
/**
 * Publishes the day's posts that are due: a post with `at` waits until Istanbul's `time`
 * reaches it (each cron run publishes what has come due, and catches up on anything an
 * earlier run missed). Without `time` every post is due.
 */
export async function publishDay(deps: PublishDeps, date: string, time?: string): Promise<DayResult> {
  const headers: Record<string, string> = deps.bypass ? { "x-vercel-protection-bypass": deps.bypass } : {};
  const base = `${deps.sourceUrl}/social/${date}`;
  const day = await readJson<{ date?: string; posts?: string[] }>(deps, `${base}/day.json`, headers);
  if (!day || !Array.isArray(day.posts) || !day.posts.length) {
    // One warning a day, however many times this runs.
    if (await deps.store.claim(`social-state/${date}/missing.warned`, JSON.stringify({ at: new Date().toISOString() })).catch(() => true)) {
      await deps.telegramText(
        `⚠️ <b>لم تُجهَّز منشورات اليوم</b> (${escapeHtml(date)})\nلم يُعثر على ملف المنشورات على فرع social-posts. راجع جلسة Claude المجدولة «منشورات حضارة اليومية».`
      );
    }
    return { date, found: false, results: [] };
  }

  const meta = deps.meta;
  type Outcome = { result: PostResult; report: (() => Promise<void>) | null };
  // The posts are published side by side (Instagram alone can take ~20 s a post, and the
  // function has 60 s for the whole day).
  const onePost = async (name: string): Promise<Outcome> => {
    const post = await readJson<SocialPost>(deps, `${base}/${name}.json`, headers);
    const result: PostResult = { post: name, facebook: "manual", instagram: "manual", errors: [] };
    if (!post || typeof post.fb !== "string" || typeof post.ig !== "string" || !/^post-\d+\.jpe?g$/.test(post.image ?? "")) {
      result.facebook = result.instagram = "failed";
      result.errors.push(`ملف ${name}.json غير صالح`);
      if (await deps.store.claim(markers(date, name, "invalid.warned"), "{}").catch(() => true)) {
        return { result, report: async () => void (await deps.telegramText(`⚠️ <b>تعذّر قراءة منشور اليوم</b> (${escapeHtml(date)} · ${escapeHtml(name)})`)) };
      }
      return { result, report: null };
    }

    if (time && typeof post.at === "string" && /^\d{2}:\d{2}$/.test(post.at) && post.at > time) {
      result.facebook = result.instagram = "scheduled";
      return { result, report: null };
    }

    const igProblem = post.story ? null : instagramCaptionProblem(post.ig);
    const telegramDone = await deps.store.stat(markers(date, name, "telegram.done"));
    const fbDone = meta ? await deps.store.stat(markers(date, name, "facebook.done")) : null;
    const igDone = meta?.igUserId ? await deps.store.stat(markers(date, name, "instagram.done")) : null;
    const igOpen = Boolean(meta?.igUserId) && !igProblem && !igDone;
    if (telegramDone && (!meta || (fbDone && !igOpen))) {
      // Everything that can go out already did.
      result.facebook = meta ? "already" : "manual";
      result.instagram = igDone ? "already" : "manual";
      return { result, report: null };
    }

    // Public copies of the image (and the Reel's video) for Meta and Telegram to fetch.
    let imageUrl: string;
    let videoUrl: string | null = null;
    let videoBytes: ArrayBuffer | null = null;
    let slideUrls: string[] | null = null;
    try {
      const image = await deps.fetch(`${base}/${post.image}`, { cache: "no-store", headers, signal: AbortSignal.timeout(20_000) });
      const bytes = image.ok ? await image.arrayBuffer() : null;
      const head = bytes ? new Uint8Array(bytes.slice(0, 3)) : null;
      if (!bytes || !head || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) throw new Error(`${post.image}: ليست صورة JPEG (HTTP ${image.status})`);
      imageUrl = await deps.store.put(`social/${date}/${post.image}`, bytes, "image/jpeg");
      if (post.video !== undefined) {
        if (!/^post-\d+\.mp4$/.test(post.video)) throw new Error(`${post.video}: اسم فيديو غير صالح`);
        const video = await deps.fetch(`${base}/${post.video}`, { cache: "no-store", headers, signal: AbortSignal.timeout(30_000) });
        const data = video.ok ? await video.arrayBuffer() : null;
        // An MP4 has "ftyp" at bytes 4-7 (a missing file comes back as the site's index.html).
        if (!data || new TextDecoder().decode(new Uint8Array(data.slice(4, 8))) !== "ftyp") throw new Error(`${post.video}: ليس فيديو MP4 (HTTP ${video.status})`);
        videoUrl = await deps.store.put(`social/${date}/${post.video}`, data, "video/mp4");
        videoBytes = data;
      }
      if (post.slides !== undefined) {
        const files = Array.isArray(post.slides) ? post.slides : [];
        if (files.length < 2 || files.length > 10 || files.some((f) => !/^post-\d+-\d+\.jpe?g$/.test(String(f)))) {
          throw new Error("الشرائح: من 2 إلى 10 صور post-<n>-<k>.jpg");
        }
        slideUrls = await Promise.all(
          files.map(async (file) => {
            const slide = await deps.fetch(`${base}/${file}`, { cache: "no-store", headers, signal: AbortSignal.timeout(20_000) });
            const data = slide.ok ? await slide.arrayBuffer() : null;
            const start = data ? new Uint8Array(data.slice(0, 3)) : null;
            if (!data || !start || start[0] !== 0xff || start[1] !== 0xd8 || start[2] !== 0xff) throw new Error(`${file}: ليست صورة JPEG (HTTP ${slide.status})`);
            return deps.store.put(`social/${date}/${file}`, data, "image/jpeg");
          })
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.facebook = result.instagram = "failed";
      result.errors.push(`الصورة: ${message}`);
      return { result, report: async () => void (await deps.telegramText(`⚠️ <b>تعذّر تجهيز صورة منشور اليوم</b> (${escapeHtml(post.topic)})\n${escapeHtml(message)}`)) };
    }

    if (meta) {
      const reel = videoUrl;
      const reelBytes = videoBytes;
      const album = slideUrls;
      const fb = await once(deps, date, name, "facebook", () =>
        post.story
          ? publishFacebookStory(deps, meta, imageUrl)
          : album
            ? publishFacebookCarousel(deps, meta, album, post.fb)
            : reelBytes
            ? publishFacebookReel(deps, meta, reelBytes, post.fb)
            : publishFacebook(deps, meta, imageUrl, post.fb)
      );
      result.facebook = fb.state;
      if (fb.error) result.errors.push(`فيسبوك: ${fb.error}`);
      if (meta.igUserId && !igProblem) {
        const ig = await once(deps, date, name, "instagram", () =>
          post.story
            ? publishInstagramStory(deps, meta, imageUrl)
            : album
              ? publishInstagramCarousel(deps, meta, album, post.ig)
              : reel
              ? publishInstagramReel(deps, meta, reel, imageUrl, post.ig, markers(date, name, "instagram.container"))
              : publishInstagram(deps, meta, imageUrl, post.ig)
        );
        result.instagram = ig.state;
        if (ig.error) result.errors.push(`إنستغرام: ${ig.error}`);
      }
    }

    // Tell the owner what happened. When nothing new happened (or another run is publishing
    // and will report), stay quiet.
    const attempted = [result.facebook, result.instagram].some((s) => s === "published" || s === "failed");
    const busy = result.facebook === "busy" || result.instagram === "busy";
    if (!attempted && (telegramDone || busy)) {
      return { result, report: null };
    }
    const firstReport = !telegramDone;
    const report = async () => {
      const caption = `${post.story ? "📱 ستوري · " : post.video ? "🎬 ريلز · " : slideUrls ? `🎠 شرائح (${slideUrls.length}) · ` : ""}🗓 ${escapeHtml(date)} · ${escapeHtml(post.topic)}\n\n${statusLines(result, igProblem, Boolean(meta), Boolean(meta?.igUserId))}`;
      const sent = await deps.telegramPhoto(imageUrl, caption);
      // The captions that weren't published automatically, to post by hand (once).
      if (firstReport && !post.story) {
        if (!meta) await deps.telegramText(`<b>نص فيسبوك</b>\n\n${escapeHtml(post.fb)}`.slice(0, 4096));
        if (!meta || !meta.igUserId || igProblem) await deps.telegramText(`<b>نص إنستغرام</b>\n\n${escapeHtml(post.ig)}`.slice(0, 4096));
      }
      if (sent && firstReport) await deps.store.put(markers(date, name, "telegram.done"), "{}", "application/json").catch(() => undefined);
    };
    return { result, report };
  };

  const names = day.posts.map((file) => String(file).replace(/\.json$/, "")).filter((name) => /^post-\d+$/.test(name));
  // Each post reports on Telegram as soon as it is done (a slow Instagram video must not
  // keep the others' reports waiting until the function runs out of time).
  // One report at a time, so a post's photo and texts stay together.
  let reports: Promise<void> = Promise.resolve();
  const outcomes = await Promise.all(
    names.map(async (name) => {
      const outcome = await onePost(name).catch((error): Outcome => {
        const message = error instanceof Error ? error.message : String(error);
        return { result: { post: name, facebook: "failed", instagram: "failed", errors: [message] }, report: null };
      });
      reports = reports.then(() => outcome.report?.()).catch(() => undefined);
      await reports;
      return outcome;
    })
  );
  const results = outcomes.map((outcome) => outcome.result);
  return { date, found: true, results };
}
