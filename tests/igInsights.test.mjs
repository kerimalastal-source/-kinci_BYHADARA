// Instagram statistics (api/_lib/igInsights.ts + supabase/migrations/0026). Run with `npm test`.
// No network: a fake fetch plays Meta's Graph API; save_ig_insights() runs on PGlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { clip, collectInsights, graphDay, istanbulDay, lastDays } from "../.test-build/_lib/igInsights.js";
import { insightsWarning } from "../.test-build/_lib/igInsightsRun.js";

const NOW = Date.parse("2026-10-20T06:00:00Z");
const IG = "17841418931390002";

function fakeGraph({ refuseFull = false, refuseFollowers = false, refuseViews = false } = {}) {
  const calls = [];
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const error = (message) => reply({ error: { code: 100, message } }, 400);
  const fetch = async (url) => {
    const u = new URL(url);
    calls.push(u);
    assert.equal(u.searchParams.get("access_token"), "TOKEN");
    const metric = u.searchParams.get("metric") ?? "";
    if (u.pathname.endsWith(`/${IG}/insights`)) {
      if (metric === "follower_count") {
        if (refuseFollowers) return error("(#100) follower_count needs 100 followers");
        return reply({ data: [{ name: "follower_count", values: [{ value: 3, end_time: "2026-10-19T07:00:00+0000" }, { value: 1, end_time: "2026-10-18T07:00:00+0000" }] }] });
      }
      if (refuseFull && metric.includes("website_clicks")) return error("(#100) metric[9] must be one of the following values");
      return reply({ data: metric.split(",").map((name, i) => ({ name, period: "day", total_value: { value: i + 1 } })) });
    }
    if (u.pathname.endsWith(`/${IG}`)) return reply({ followers_count: 87, follows_count: 12, media_count: 140, id: IG });
    if (u.pathname.endsWith(`/${IG}/media`)) {
      return reply({
        data: [
          { id: "M1", caption: "Villa", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", timestamp: "2026-10-19T18:00:00+0000", permalink: "https://instagram.com/p/1", like_count: 4, comments_count: 1 },
          { id: "M2", caption: "Reel", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-10-10T06:00:00+0000", permalink: "https://instagram.com/p/2", like_count: 9, comments_count: 0 },
          { id: "M3", caption: "Old", media_type: "IMAGE", media_product_type: "FEED", timestamp: "2026-08-01T06:00:00+0000", like_count: 2, comments_count: 0 }
        ],
        paging: { next: `https://graph.facebook.com/v22.0/${IG}/media?after=X&access_token=TOKEN` }
      });
    }
    if (u.pathname.endsWith("/insights")) {
      if (refuseViews && metric.includes("views")) return error("(#100) views is not supported");
      return reply({ data: metric.split(",").map((name) => ({ name, period: "lifetime", values: [{ value: { reach: 120, views: 300, saved: 5, shares: 2, total_interactions: 15, likes: 7, comments: 1 }[name] }] })) });
    }
    return error(`unexpected ${u.pathname}`);
  };
  return { fetch, calls };
}

const deps = (graph) => ({ fetch: graph.fetch, token: "TOKEN", igUserId: IG, now: () => NOW });

test("days and dates", () => {
  assert.equal(graphDay("2026-10-19T07:00:00+0000"), "2026-10-18");
  assert.equal(istanbulDay(Date.parse("2026-10-19T22:30:00Z")), "2026-10-20");
  const days = lastDays(NOW);
  assert.equal(days.length, 28);
  assert.equal(days[27], "2026-10-18");
  assert.equal(days[0], "2026-09-21");
});

test("collects the 28 days, today's snapshot and the posts of the last 30 days", async () => {
  const graph = fakeGraph();
  const r = await collectInsights(deps(graph));
  assert.deepEqual(r.errors, []);
  assert.equal(r.days.length, 29);
  const day = r.days.find((d) => d.day === "2026-10-18");
  assert.equal(day.reach, 1);
  assert.equal(day.profile_links_taps, 11);
  assert.equal(day.new_followers, 3);
  assert.equal(r.days.find((d) => d.day === "2026-10-17").new_followers, 1);
  const today = r.days.find((d) => d.day === "2026-10-20");
  assert.deepEqual([today.followers, today.follows, today.media_count], [87, 12, 140]);
  // The old post is left out, and the next page isn't read (the last post is older than 30 days).
  assert.deepEqual(r.media.map((m) => m.media_id), ["M2", "M1"]);
  assert.deepEqual(
    { reach: r.media[1].reach, views: r.media[1].views, saves: r.media[1].saves, likes: r.media[1].likes },
    { reach: 120, views: 300, saves: 5, likes: 7 }
  );
  assert.ok(!graph.calls.some((u) => u.searchParams.get("after")));
  // Days are asked on Meta's (Pacific) day boundaries.
  const asked = graph.calls.find((u) => u.searchParams.get("metric")?.startsWith("reach,"));
  assert.equal(Number(asked.searchParams.get("until")) - Number(asked.searchParams.get("since")), 86_400);
  assert.equal(new Date(Number(asked.searchParams.get("since")) * 1000).getUTCHours(), 7);
});

test("falls back to the core metrics and goes on without followers or views", async () => {
  const r = await collectInsights(deps(fakeGraph({ refuseFull: true, refuseFollowers: true, refuseViews: true })));
  assert.equal(r.errors.length, 2);
  assert.match(r.errors.join(" "), /day metrics: 100/);
  assert.match(r.errors.join(" "), /follower_count/);
  const day = r.days.find((d) => d.day === "2026-10-01");
  assert.equal(day.saves, 9);
  assert.equal(day.website_clicks, undefined);
  assert.equal(r.media[0].views, undefined);
  assert.equal(r.media[0].reach, 120);
  // The token never appears in an error.
  assert.ok(!r.errors.join(" ").includes("TOKEN"));
});

test("a refused account still gives the posts, and the reverse", async () => {
  const graph = fakeGraph();
  const broken = async (url) => (new URL(url).pathname.endsWith("/media") ? new Response("{}", { status: 500 }) : graph.fetch(url));
  const r = await collectInsights({ ...deps(graph), fetch: broken });
  assert.equal(r.media.length, 0);
  assert.equal(r.days.length, 29);
  assert.match(r.errors[0], /media list/);
});

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const SECRET = "s".repeat(40);

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int); create function public.is_admin() returns boolean language sql as 'select true';`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f >= "0002").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  await db.exec(readFileSync(new URL("0026_instagram_insights.sql", MIGRATIONS), "utf8"));
  await db.query("insert into public.internal_secrets (name, value) values ('cron', $1) on conflict (name) do update set value = excluded.value", [SECRET]);
  return db;
}

const save = async (db, secret, days, media) =>
  (await db.query("select public.save_ig_insights($1, $2::jsonb, $3::jsonb) as r", [secret, JSON.stringify(days), JSON.stringify(media)])).rows[0].r;

test("past the time limit no new request starts; what was read is kept", async () => {
  const graph = fakeGraph();
  let clock = NOW;
  const slow = { ...deps(graph), now: () => clock, deadline: NOW + 1000, fetch: async (url) => ((clock += 300), graph.fetch(url)) };
  const r = await collectInsights(slow);
  assert.ok(r.errors.some((e) => e.startsWith("time limit:")), r.errors.join(" | "));
  assert.ok(graph.calls.length < 20);
  // The posts are still listed, with or without their numbers.
  assert.deepEqual(r.media.map((m) => m.media_id), ["M2", "M1"]);
});

test("insightsWarning: only when something went wrong, escaped", () => {
  assert.equal(insightsWarning("instagram", "28 days, 40 posts", []), null);
  const empty = insightsWarning("instagram", "0 days, 0 posts", []);
  assert.match(empty, /إنستغرام/);
  const refused = insightsWarning("facebook", "28 days, 0 posts", ["posts: 10: (#10) needs <pages_read_user_content>"]);
  assert.match(refused, /فيسبوك/);
  assert.match(refused, /&lt;pages_read_user_content&gt;/);
  assert.ok(!refused.includes("TOKEN"));
});

test("save_ig_insights: secret, upsert, a missing value keeps the saved one", async () => {
  const db = await database();
  assert.deepEqual(await save(db, "wrong", [], []), { error: "forbidden" });

  const r = await collectInsights(deps(fakeGraph()));
  assert.deepEqual(await save(db, SECRET, r.days, r.media), { days: 29, media: 2 });

  // Tomorrow Meta no longer gives follower_count for the 18th: it stays.
  assert.deepEqual(await save(db, SECRET, [{ day: "2026-10-18", reach: 50 }], [{ media_id: "M1", posted_at: null, reach: 200, caption: "x".repeat(500) }]), { days: 1, media: 1 });
  const day = (await db.query("select reach, new_followers, saves from public.ig_account_daily where day = '2026-10-18'")).rows[0];
  assert.deepEqual(day, { reach: 50, new_followers: 3, saves: 9 });
  const post = (await db.query("select reach, views, posted_at, length(caption) as len from public.ig_media_stats where media_id = 'M1'")).rows[0];
  assert.equal(post.reach, 200);
  assert.equal(post.views, 300);
  assert.ok(post.posted_at);
  assert.equal(post.len, 300);

  // anon can only call the function; nobody but admins reads the tables.
  const grants = (await db.query(`select has_table_privilege('anon', 'public.ig_account_daily', 'select') as anon_read,
      has_function_privilege('anon', 'public.save_ig_insights(text, jsonb, jsonb)', 'execute') as anon_exec,
      has_function_privilege('authenticated', 'public.save_ig_insights(text, jsonb, jsonb)', 'execute') as auth_exec`)).rows[0];
  assert.deepEqual(grants, { anon_read: false, anon_exec: true, auth_exec: false });
});

test("clip never leaves half an emoji, so the saved JSON stays valid (2026-10-21)", async () => {
  const caption = "a".repeat(299) + "📲 link";
  assert.equal(caption.slice(0, 300).isWellFormed(), false); // the old cut
  const cut = clip(caption, 300);
  assert.equal(cut.isWellFormed(), true);
  assert.equal(cut, "a".repeat(299) + "📲");
  assert.equal(clip("ok 📲 🏠", 10), "ok 📲 🏠");
  assert.equal(clip("bad \ud83d end", 50), "bad � end");
  const db = new PGlite();
  const row = await db.query("select $1::jsonb as j", [JSON.stringify({ caption: cut })]);
  assert.equal(row.rows[0].j.caption, cut);
});
