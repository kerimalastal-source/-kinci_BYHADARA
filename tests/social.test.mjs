// Daily social posts published automatically (api/_lib/social.ts). Run with `npm test`.
// No network: a fake fetch plays the social-posts branch build and Meta's Graph API, an
// in-memory store plays Vercel Blob, and Telegram calls are recorded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { istanbulDate, instagramCaptionProblem, publishDay } from "../.test-build/_lib/social.js";

const DATE = "2026-09-30";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
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
      if (url.endsWith("/day.json")) return json({ date: DATE, posts: ["post-1.json", "post-2.json"] });
      const name = url.split("/").pop();
      if (name.endsWith(".json")) return json(opts.posts?.[name.replace(".json", "")] ?? POSTS[name.replace(".json", "")]);
      return new Response(JPEG, { headers: { "content-type": "image/jpeg" } });
    }
    if (url.startsWith("https://graph.facebook.com/v21.0/")) {
      const path = url.slice("https://graph.facebook.com/v21.0/".length).split("?")[0];
      if (path === "PAGE") return json({ access_token: "page-token", id: "PAGE" });
      if (path === "PAGE/photos") {
        if (opts.failFacebook) return json({ error: { message: "Invalid parameter" } }, 400);
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

test("the day is Istanbul's", () => {
  assert.equal(istanbulDate(new Date("2026-09-29T21:30:00Z")), "2026-09-30");
  assert.equal(istanbulDate(new Date("2026-09-30T20:59:00Z")), "2026-09-30");
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
