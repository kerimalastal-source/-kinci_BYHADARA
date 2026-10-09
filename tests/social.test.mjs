// Daily social posts published automatically (api/_lib/social.ts). Run with `npm test`.
// No network: a fake fetch plays the social-posts branch build and Meta's Graph API, an
// in-memory store plays Vercel Blob, and Telegram calls are recorded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { istanbulDate, istanbulTime, instagramCaptionProblem, publishDay } from "../.test-build/_lib/social.js";

const DATE = "2026-09-30";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const POSTS = {
  "post-1": { id: "lotus-yali", topic: "لوتس يالي", image: "post-1.jpg", fb: "Facebook caption 1", ig: "Instagram caption 1 #HADARA" },
  "post-2": { id: "citizenship", topic: "الجنسية", image: "post-2.jpg", fb: "Facebook caption 2", ig: "Instagram caption 2 #HADARA" }
};

/** In-memory Vercel Blob with the claim semantics of put(..., { allowOverwrite: false }). */
function memoryStore() {
  const files = new Map();
  return {
    files,
    async put(path, body) {
      files.set(path, { body, uploadedAt: new Date() });
      return `https://blob.example/${path}`;
    },
    async claim(path, body) {
      if (files.has(path)) return false;
      files.set(path, { body, uploadedAt: new Date() });
      return true;
    },
    async stat(path) {
      const file = files.get(path);
      return file ? { uploadedAt: file.uploadedAt } : null;
    },
    async remove(path) {
      files.delete(path);
    },
    async read(path) {
      const file = files.get(path);
      return file ? String(file.body) : null;
    }
  };
}

function fakeFetch(opts = {}) {
  const calls = [];
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  let igCalls = 0;
  const fn = async (input, init) => {
    const url = String(input);
    const body = init?.body instanceof URLSearchParams ? Object.fromEntries(init.body) : {};
    const query = Object.fromEntries(new URL(url).searchParams);
    calls.push({ url, body, query, bypass: new Headers(init?.headers).get("x-vercel-protection-bypass") });
    if (url.startsWith("https://branch.example/")) {
      // A missing file falls through the site's rewrite to index.html with a 200.
      if (opts.missing) return new Response("<!doctype html><title>HADARA</title>", { status: 200, headers: { "content-type": "text/html" } });
      if (url.endsWith("/day.json")) return json({ date: DATE, posts: opts.day ?? ["post-1.json", "post-2.json"] });
      const name = url.split("/").pop();
      if (name.endsWith(".json")) return json(opts.posts?.[name.replace(".json", "")] ?? POSTS[name.replace(".json", "")]);
      if (name.endsWith(".mp4")) return new Response(MP4, { headers: { "content-type": "video/mp4" } });
      return new Response(JPEG, { headers: { "content-type": "image/jpeg" } });
    }
    if (url.startsWith("https://rupload.facebook.com/video-upload/v21.0/")) {
      const h = new Headers(init?.headers);
      calls[calls.length - 1].fileSize = h.get("file_size");
      calls[calls.length - 1].bodyBytes = init?.body ? new Uint8Array(init.body).length : 0;
      calls[calls.length - 1].auth = h.get("authorization");
      return json({ success: true });
    }
    if (url.startsWith("https://graph.facebook.com/v21.0/")) {
      const path = url.slice("https://graph.facebook.com/v21.0/".length).split("?")[0];
      if (path === "PAGE") return json({ access_token: "page-token", id: "PAGE" });
      if (path === "PAGE/video_reels") {
        if (body.upload_phase === "start") return json({ video_id: `reel${calls.filter((c) => c.body.upload_phase === "start").length}`, upload_url: "x" });
        if (body.upload_phase === "finish") return json({ success: true });
      }
      if (path === "PAGE/feed") return json({ id: `PAGE_feed_${Object.keys(body).filter((k) => k.startsWith("attached_media")).length}` });
      if (path === "PAGE/photo_stories") return json({ success: true, post_id: `story_${body.photo_id}` });
      if (path === "PAGE/photos") {
        if (opts.failFacebook) return json({ error: { message: "Invalid parameter" } }, 400);
        if (body.published === "false" && body.url?.includes("-")) return json({ id: `photo_${body.url.split("/").pop()}` });
        return json({ id: "photo", post_id: `PAGE_${calls.filter((c) => c.url.endsWith("/photos")).length}` });
      }
      if (path === "IGUSER/media") {
        igCalls++;
        if (opts.failInstagram) return json({ error: { message: "The image could not be downloaded" } }, 400);
        return json({ id: `container${igCalls}` });
      }
      if (path.startsWith("container")) {
        // IN_PROGRESS once, then FINISHED.
        const checks = calls.filter((c) => c.url.includes(`/${path}?`)).length;
        return json({ status_code: checks > 1 ? "FINISHED" : "IN_PROGRESS" });
      }
      if (path === "IGUSER/media_publish") return json({ id: `ig_${body.creation_id}` });
    }
    return json({ error: { message: `unexpected ${url}` } }, 500);
  };
  return { fn, calls };
}

const META = { pageId: "PAGE", igUserId: "IGUSER", token: "system-user-token" };

function setup(opts = {}) {
  const store = opts.store ?? memoryStore();
  const { fn, calls } = fakeFetch(opts);
  const photos = [];
  const texts = [];
  const deps = {
    sourceUrl: "https://branch.example",
    bypass: "bypass-secret",
    store,
    meta: "meta" in opts ? opts.meta : META,
    fetch: fn,
    telegramPhoto: async (url, caption) => (photos.push({ url, caption }), true),
    telegramText: async (text) => (texts.push(text), true),
    pollMs: 0
  };
  return { deps, store, calls, photos, texts };
}

const graphCalls = (calls, path) => calls.filter((c) => c.url.includes(`graph.facebook.com/v21.0/${path}`));

test("Facebook is published with the Page's own token, Instagram after FINISHED, then Telegram", async () => {
  const { deps, calls, photos, texts, store } = setup();
  const day = await publishDay(deps, DATE);
  assert.equal(day.found, true);
  assert.deepEqual(day.results.map((r) => [r.post, r.facebook, r.instagram]), [
    ["post-1", "published", "published"],
    ["post-2", "published", "published"]
  ]);
  // The Page token is asked for with the system user's token, and the photo posted with it.
  const pageLookups = graphCalls(calls, "PAGE?");
  assert.equal(pageLookups[0].query.fields, "access_token");
  assert.equal(pageLookups[0].query.access_token, "system-user-token");
  const fb = graphCalls(calls, "PAGE/photos");
  assert.equal(fb.length, 2);
  assert.equal(fb[0].body.access_token, "page-token");
  assert.equal(fb[0].body.message, "Facebook caption 1");
  assert.equal(fb[0].body.url, `https://blob.example/social/${DATE}/post-1.jpg`);
  // Instagram: container with the ig caption, status checked until FINISHED, then published.
  const media = graphCalls(calls, "IGUSER/media");
  assert.equal(media.filter((c) => c.url.endsWith("/media")).length, 2);
  assert.equal(media[0].body.caption, "Instagram caption 1 #HADARA");
  assert.equal(media[0].body.image_url, `https://blob.example/social/${DATE}/post-1.jpg`);
  assert.equal(media[0].body.access_token, "system-user-token");
  assert.equal(graphCalls(calls, "container1?").length, 2);
  const publishes = graphCalls(calls, "IGUSER/media_publish");
  assert.deepEqual(publishes.map((c) => c.body.creation_id), ["container1", "container2"]);
  // The branch build was read with the automation bypass.
  assert.ok(calls.filter((c) => c.url.startsWith("https://branch.example/")).every((c) => c.bypass === "bypass-secret"));
  // Telegram: a photo per post with the result, no caption texts (nothing to post by hand).
  assert.equal(photos.length, 2);
  assert.match(photos[0].caption, /✅ <b>نُشر على فيسبوك وإنستغرام<\/b>/);
  assert.match(photos[0].caption, /لوتس يالي/);
  assert.equal(photos[0].url, `https://blob.example/social/${DATE}/post-1.jpg`);
  assert.equal(texts.length, 0);
  assert.ok(store.files.has(`social-state/${DATE}/post-1/facebook.done`));
  assert.ok(store.files.has(`social-state/${DATE}/post-2/instagram.done`));
});

test("the posts go out side by side (a slow Instagram doesn't hold up the next post or its report)", async () => {
  const { deps, calls, photos } = setup();
  const fetch = deps.fetch;
  // Instagram takes a while with post-1's image.
  deps.fetch = async (input, init) => {
    if (init?.body instanceof URLSearchParams && init.body.get("caption") === POSTS["post-1"].ig) await new Promise((r) => setTimeout(r, 100));
    return fetch(input, init);
  };
  const day = await publishDay(deps, DATE);
  assert.deepEqual(day.results.map((r) => [r.post, r.facebook, r.instagram]), [
    ["post-1", "published", "published"],
    ["post-2", "published", "published"]
  ]);
  // post-2 was on Instagram before post-1's slow container was even created.
  const media = graphCalls(calls, "IGUSER/media").filter((c) => c.body.caption);
  assert.equal(media[0].body.caption, POSTS["post-2"].ig);
  // Each post is reported as soon as it is done: the quick one first.
  assert.deepEqual(photos.map((p) => p.url), [`https://blob.example/social/${DATE}/post-2.jpg`, `https://blob.example/social/${DATE}/post-1.jpg`]);
});

test("posts with a time wait for it; each run publishes what has come due and catches up", async () => {
  const posts = { "post-1": { ...POSTS["post-1"], at: "09:00" }, "post-2": { ...POSTS["post-2"], at: "14:00" } };
  const { deps, calls, photos } = setup({ posts });
  // 09:05: only the morning post.
  let day = await publishDay(deps, DATE, "09:05");
  assert.deepEqual(day.results.map((r) => [r.post, r.facebook, r.instagram]), [
    ["post-1", "published", "published"],
    ["post-2", "scheduled", "scheduled"]
  ]);
  assert.equal(graphCalls(calls, "PAGE/photos").length, 1);
  assert.equal(photos.length, 1);
  // 13:59 (the admin button before 14:00): nothing new, nothing said.
  day = await publishDay(deps, DATE, "13:59");
  assert.deepEqual(day.results.map((r) => r.facebook), ["already", "scheduled"]);
  assert.equal(photos.length, 1);
  // 14:40: the afternoon post, the morning one untouched.
  day = await publishDay(deps, DATE, "14:40");
  assert.deepEqual(day.results.map((r) => [r.facebook, r.instagram]), [["already", "already"], ["published", "published"]]);
  assert.equal(graphCalls(calls, "PAGE/photos").length, 2);
  assert.equal(photos.length, 2);
});

test("a run that missed earlier slots publishes everything due at once", async () => {
  const posts = { "post-1": { ...POSTS["post-1"], at: "09:00" }, "post-2": { ...POSTS["post-2"], at: "14:00" } };
  const { deps, photos } = setup({ posts });
  const day = await publishDay(deps, DATE, "21:10");
  assert.deepEqual(day.results.map((r) => r.facebook), ["published", "published"]);
  assert.equal(photos.length, 2);
});

test("a Reel: the video goes to Facebook Reels and Instagram Reels, with the image as cover", async () => {
  const posts = { "post-4": { id: "reel-villa", topic: "ريلز الفيلا", image: "post-4.jpg", video: "post-4.mp4", fb: "FB reel", ig: "IG reel #HADARA" } };
  const { deps, calls, photos, store } = setup({ posts, day: ["post-4.json"] });
  const day = await publishDay(deps, DATE);
  assert.deepEqual(day.results.map((r) => [r.post, r.facebook, r.instagram]), [["post-4", "published", "published"]]);
  // Facebook: start, upload the video with the Page token, finish with the caption.
  const upload = calls.find((c) => c.url.startsWith("https://rupload.facebook.com/"));
  // The bytes go up directly (Facebook won't fetch from the Blob URL: robots.txt).
  assert.equal(upload.fileSize, String(MP4.length));
  assert.equal(upload.bodyBytes, MP4.length);
  assert.equal(upload.auth, "OAuth page-token");
  const finish = graphCalls(calls, "PAGE/video_reels").find((c) => c.body.upload_phase === "finish");
  assert.equal(finish.body.description, "FB reel");
  assert.equal(finish.body.video_state, "PUBLISHED");
  assert.equal(graphCalls(calls, "PAGE/photos").length, 0);
  // Instagram: a REELS container from the video, the design as cover, shared to the grid.
  const media = graphCalls(calls, "IGUSER/media").find((c) => c.body.media_type);
  assert.equal(media.body.media_type, "REELS");
  assert.equal(media.body.video_url, `https://blob.example/social/${DATE}/post-4.mp4`);
  assert.equal(media.body.cover_url, `https://blob.example/social/${DATE}/post-4.jpg`);
  assert.equal(media.body.share_to_feed, "true");
  assert.ok(store.files.has(`social-state/${DATE}/post-4/instagram.done`));
  assert.match(photos[0].caption, /ريلز/);
});

test("a Reel whose video is missing is reported, nothing published", async () => {
  const posts = { "post-4": { id: "reel-x", topic: "ريلز", image: "post-4.jpg", video: "post-4.mp4", fb: "a", ig: "b" } };
  const { deps, calls, texts } = setup({ posts, day: ["post-4.json"] });
  const fetch = deps.fetch;
  deps.fetch = async (input, init) =>
    String(input).endsWith(".mp4") ? new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } }) : fetch(input, init);
  const day = await publishDay(deps, DATE);
  assert.deepEqual(day.results.map((r) => r.facebook), ["failed"]);
  assert.equal(graphCalls(calls, "PAGE/video_reels").length, 0);
  assert.match(texts[0], /MP4/);
});

test("a Story: an unpublished Page photo posted as a Facebook story, and an Instagram story; no captions", async () => {
  const posts = { "post-7": { id: "story-1", topic: "ستوري", image: "post-7.jpg", story: true, fb: "x", ig: "y" } };
  const { deps, calls, photos, texts, store } = setup({ posts, day: ["post-7.json"], meta: { ...META } });
  const day = await publishDay(deps, DATE);
  assert.deepEqual(day.results.map((r) => [r.facebook, r.instagram]), [["published", "published"]]);
  const photo = graphCalls(calls, "PAGE/photos")[0];
  assert.equal(photo.body.published, "false");
  assert.equal(photo.body.message, undefined);
  assert.ok(graphCalls(calls, "PAGE/photo_stories")[0].body.photo_id);
  const media = graphCalls(calls, "IGUSER/media").find((c) => c.body.media_type);
  assert.equal(media.body.media_type, "STORIES");
  assert.equal(media.body.caption, undefined);
  assert.ok(store.files.has(`social-state/${DATE}/post-7/instagram.done`));
  assert.match(photos[0].caption, /ستوري/);
  assert.equal(texts.length, 0);
});

test("a failure leaves its reason in <platform>.error", async () => {
  const { deps, store } = setup({ failFacebook: true });
  await publishDay(deps, DATE);
  assert.match(String(store.files.get(`social-state/${DATE}/post-1/facebook.error`).body), /Invalid parameter/);
});

test("nothing is published twice: a second run (cron or button) does nothing and says nothing", async () => {
  const first = setup();
  await publishDay(first.deps, DATE);
  const again = setup({ store: first.store });
  const day = await publishDay(again.deps, DATE);
  assert.deepEqual(day.results.map((r) => [r.facebook, r.instagram]), [["already", "already"], ["already", "already"]]);
  assert.equal(graphCalls(again.calls, "PAGE/photos").length, 0);
  assert.equal(graphCalls(again.calls, "IGUSER/media").length, 0);
  assert.equal(again.photos.length + again.texts.length, 0);
});

test("two runs at the same moment still publish each post once", async () => {
  const store = memoryStore();
  const a = setup({ store });
  const b = setup({ store });
  await Promise.all([publishDay(a.deps, DATE), publishDay(b.deps, DATE)]);
  const fb = [...graphCalls(a.calls, "PAGE/photos"), ...graphCalls(b.calls, "PAGE/photos")];
  const ig = [...graphCalls(a.calls, "IGUSER/media_publish"), ...graphCalls(b.calls, "IGUSER/media_publish")];
  assert.equal(fb.length, 2);
  assert.equal(ig.length, 2);
});

test("Facebook ok and Instagram failed: the next run retries Instagram only", async () => {
  const first = setup({ failInstagram: true });
  const day = await publishDay(first.deps, DATE);
  assert.deepEqual(day.results.map((r) => [r.facebook, r.instagram]), [["published", "failed"], ["published", "failed"]]);
  assert.match(first.photos[0].caption, /✅ نُشر على فيسبوك/);
  assert.match(first.photos[0].caption, /⚠️ إنستغرام: media: The image could not be downloaded — ستُعاد المحاولة/);

  const retry = setup({ store: first.store });
  const again = await publishDay(retry.deps, DATE);
  assert.deepEqual(again.results.map((r) => [r.facebook, r.instagram]), [["already", "published"], ["already", "published"]]);
  assert.equal(graphCalls(retry.calls, "PAGE/photos").length, 0, "Facebook isn't posted again");
  assert.equal(graphCalls(retry.calls, "IGUSER/media_publish").length, 2);
  assert.match(retry.photos[0].caption, /✅ <b>نُشر على فيسبوك وإنستغرام<\/b>/);
});

test("a Facebook error is reported per platform and retried later", async () => {
  const first = setup({ failFacebook: true });
  const day = await publishDay(first.deps, DATE);
  assert.deepEqual(day.results.map((r) => [r.facebook, r.instagram]), [["failed", "published"], ["failed", "published"]]);
  assert.match(first.photos[0].caption, /⚠️ فيسبوك: photos: Invalid parameter/);
  assert.match(first.photos[0].caption, /✅ نُشر على إنستغرام/);
  const retry = setup({ store: first.store });
  await publishDay(retry.deps, DATE);
  assert.equal(graphCalls(retry.calls, "PAGE/photos").length, 2);
  assert.equal(graphCalls(retry.calls, "IGUSER/media").length, 0);
});

test("no file for today: one Telegram warning, however many runs", async () => {
  const first = setup({ missing: true });
  const day = await publishDay(first.deps, DATE);
  assert.equal(day.found, false);
  assert.equal(first.texts.length, 1);
  assert.match(first.texts[0], /لم تُجهَّز منشورات اليوم/);
  const again = setup({ missing: true, store: first.store });
  await publishDay(again.deps, DATE);
  assert.equal(again.texts.length, 0);
  assert.equal(graphCalls(first.calls, "").length, 0, "nothing sent to Meta");
});

test("Telegram only (no Meta connection): photo plus both captions to post by hand, once", async () => {
  const first = setup({ meta: null });
  const day = await publishDay(first.deps, DATE);
  assert.deepEqual(day.results.map((r) => [r.facebook, r.instagram]), [["manual", "manual"], ["manual", "manual"]]);
  assert.equal(graphCalls(first.calls, "").length, 0);
  assert.equal(first.photos.length, 2);
  assert.match(first.photos[0].caption, /جاهز للنشر اليدوي/);
  assert.deepEqual(first.texts.map((t) => t.split("\n")[0]), ["<b>نص فيسبوك</b>", "<b>نص إنستغرام</b>", "<b>نص فيسبوك</b>", "<b>نص إنستغرام</b>"]);
  const again = setup({ meta: null, store: first.store });
  await publishDay(again.deps, DATE);
  assert.equal(again.photos.length + again.texts.length, 0);
});

test("without META_IG_USER_ID: Facebook only, Instagram's caption on Telegram", async () => {
  const first = setup({ meta: { ...META, igUserId: null } });
  const day = await publishDay(first.deps, DATE);
  assert.deepEqual(day.results.map((r) => [r.facebook, r.instagram]), [["published", "manual"], ["published", "manual"]]);
  assert.equal(graphCalls(first.calls, "IGUSER").length, 0);
  assert.match(first.photos[0].caption, /✅ نُشر على فيسبوك\n📝 إنستغرام غير مربوط/);
  assert.equal(first.texts.length, 2);
  assert.match(first.texts[0], /^<b>نص إنستغرام<\/b>\n\nInstagram caption 1/);
  const again = setup({ meta: { ...META, igUserId: null }, store: first.store });
  await publishDay(again.deps, DATE);
  assert.equal(again.photos.length + again.texts.length + graphCalls(again.calls, "PAGE/photos").length, 0);
});

test("an Instagram caption over 2,200 characters or 30 hashtags is reported, never shortened", async () => {
  const long = "ا".repeat(2201);
  const tags = `نص ${Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" ")}`;
  assert.match(instagramCaptionProblem(long), /2201 حرفاً والحد 2200/);
  assert.match(instagramCaptionProblem(tags), /31 هاشتاغ والحد 30/);
  assert.equal(instagramCaptionProblem("ا".repeat(2200)), null);

  const first = setup({ posts: { "post-1": { ...POSTS["post-1"], ig: long } } });
  const day = await publishDay(first.deps, DATE);
  assert.deepEqual(day.results.map((r) => [r.facebook, r.instagram]), [["published", "manual"], ["published", "published"]]);
  assert.equal(graphCalls(first.calls, "IGUSER/media_publish").length, 1, "only post-2 went to Instagram");
  assert.match(first.photos[0].caption, /⚠️ إنستغرام: لم يُنشر لأن النص 2201 حرفاً والحد 2200/);
  assert.equal(first.texts.length, 1);
  assert.equal(first.texts[0], `<b>نص إنستغرام</b>\n\n${long}`, "the caption is sent whole");
  // Reported once.
  const again = setup({ store: first.store, posts: { "post-1": { ...POSTS["post-1"], ig: long } } });
  await publishDay(again.deps, DATE);
  assert.equal(again.photos.length + again.texts.length, 0);
});

test("a run that died after claiming is taken over after 15 minutes", async () => {
  const store = memoryStore();
  store.files.set(`social-state/${DATE}/post-1/facebook.lock`, { body: "{}", uploadedAt: new Date(Date.now() - 5 * 60_000) });
  const busy = setup({ store });
  const day = await publishDay(busy.deps, DATE);
  assert.equal(day.results[0].facebook, "busy");
  assert.equal(graphCalls(busy.calls, "PAGE/photos").length, 1, "only post-2");
  store.files.get(`social-state/${DATE}/post-1/facebook.lock`).uploadedAt = new Date(Date.now() - 16 * 60_000);
  const later = setup({ store });
  const next = await publishDay(later.deps, DATE);
  assert.equal(next.results[0].facebook, "published");
});

test("the time of day is Istanbul's", () => {
  assert.equal(istanbulTime(new Date("2026-09-30T06:05:00Z")), "09:05");
  assert.equal(istanbulTime(new Date("2026-09-30T18:00:00Z")), "21:00");
  assert.equal(istanbulTime(new Date("2026-09-30T21:30:00Z")), "00:30");
});

test("the day is Istanbul's", () => {
  assert.equal(istanbulDate(new Date("2026-09-29T21:30:00Z")), "2026-09-30");
  assert.equal(istanbulDate(new Date("2026-09-30T20:59:00Z")), "2026-09-30");
});

test("a carousel goes out as one Facebook post with its photos and one Instagram carousel", async () => {
  const slides = ["post-3-1.jpg", "post-3-2.jpg", "post-3-3.jpg"];
  const posts = { "post-3": { id: "steps", topic: "خطوات", image: "post-3.jpg", slides, fb: "FB carousel", ig: "IG carousel #HADARA", at: "21:00" } };
  const { deps, calls, photos, store } = setup({ day: ["post-3.json"], posts });
  const day = await publishDay(deps, DATE, "21:05");
  assert.deepEqual(day.results.map((r) => [r.facebook, r.instagram]), [["published", "published"]]);
  // Facebook: every slide uploaded unpublished (in order), then one post with all of them attached.
  const uploads = graphCalls(calls, "PAGE/photos");
  assert.deepEqual(uploads.map((c) => [c.body.published, c.body.url]), slides.map((f) => ["false", `https://blob.example/social/${DATE}/${f}`]));
  const feed = graphCalls(calls, "PAGE/feed");
  assert.equal(feed.length, 1);
  assert.equal(feed[0].body.message, "FB carousel");
  assert.equal(feed[0].body.access_token, "page-token");
  assert.deepEqual([0, 1, 2].map((i) => JSON.parse(feed[0].body[`attached_media[${i}]`]).media_fbid), slides.map((f) => `photo_${f}`));
  // Instagram: an item container per slide, then the carousel container with the caption, then publish.
  const media = graphCalls(calls, "IGUSER/media").filter((c) => c.url.endsWith("/media"));
  assert.equal(media.length, 4);
  assert.deepEqual(media.slice(0, 3).map((c) => [c.body.is_carousel_item, c.body.image_url]), slides.map((f) => ["true", `https://blob.example/social/${DATE}/${f}`]));
  const parent = media[3].body;
  assert.equal(parent.media_type, "CAROUSEL");
  assert.equal(parent.caption, "IG carousel #HADARA");
  assert.equal(parent.children.split(",").length, 3);
  assert.equal(graphCalls(calls, "IGUSER/media_publish").length, 1);
  assert.match(photos[0].caption, /🎠 شرائح \(3\)/);
  // A second run publishes nothing again.
  const again = await publishDay(deps, DATE, "21:30");
  assert.deepEqual(again.results.map((r) => [r.facebook, r.instagram]), [["already", "already"]]);
  assert.equal(graphCalls(calls, "PAGE/feed").length, 1);
  assert.ok(store.files.has(`social-state/${DATE}/post-3/instagram.done`));
});

test("a carousel with a bad slide list or a missing slide is not published", async () => {
  const bad = { "post-3": { id: "x", topic: "x", image: "post-3.jpg", slides: ["post-3-1.jpg"], fb: "a", ig: "b" } };
  const one = setup({ day: ["post-3.json"], posts: bad });
  const r1 = await publishDay(one.deps, DATE);
  assert.deepEqual(r1.results.map((r) => [r.facebook, r.instagram]), [["failed", "failed"]]);
  assert.equal(graphCalls(one.calls, "PAGE/feed").length, 0);
  assert.match(one.texts.join("\n"), /الشرائح/);
});

test("/api/social-publish: the cron needs CRON_SECRET, the button needs an admin, and no Blob means no publishing", async () => {
  const { GET, POST } = await import("../.test-build/social-publish.js");
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    if (String(url).includes("/rpc/is_admin")) return new Response("false", { status: 200 });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
  };
  const request = (method, auth) => new Request("https://www.hadararealestate.com/api/social-publish", { method, headers: auth ? { authorization: auth } : {} });
  delete process.env.CRON_SECRET;
  assert.equal((await GET(request("GET", "Bearer "))).status, 401, "refused when CRON_SECRET isn't set");
  process.env.CRON_SECRET = "x".repeat(40);
  assert.equal((await GET(request("GET"))).status, 401);
  assert.equal((await GET(request("GET", "Bearer wrong"))).status, 401);
  process.env.VITE_SUPABASE_URL = "https://supabase.test";
  process.env.VITE_SUPABASE_ANON_KEY = "anon";
  assert.equal((await POST(request("POST"))).status, 403);
  assert.equal((await POST(request("POST", "Bearer not-an-admin"))).status, 403);
  // The right secret but no Blob store: nothing is published, and the owner is told.
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  process.env.TELEGRAM_BOT_TOKEN = "bot";
  process.env.TELEGRAM_CHAT_ID = "1";
  const response = await GET(request("GET", `Bearer ${"x".repeat(40)}`));
  assert.equal(response.status, 503);
  assert.match(sent.at(-1).body.text, /Vercel Blob غير مربوط/);
});
