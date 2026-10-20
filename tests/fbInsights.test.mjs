// Facebook page statistics (api/_lib/fbInsights.ts + supabase/migrations/0027). Run with
// `npm test`. No network: a fake fetch plays Meta's Graph API; save_fb_insights() on PGlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { collectFacebook } from "../.test-build/_lib/fbInsights.js";

const NOW = Date.parse("2026-10-20T06:00:00Z");
const PAGE = "1330927120105949";
// Metric names this fake Meta accepts (old names are refused, as after a rename).
const ACCEPTED = new Set(["page_follows", "page_daily_follows_unique", "page_total_media_view_unique", "page_media_view", "page_post_engagements", "post_total_media_view_unique", "post_media_view"]);

function fakeGraph({ noInsights = false, noPageToken = false } = {}) {
  const calls = [];
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const error = (message, code = 100) => reply({ error: { code, message } }, 400);
  const fetch = async (url) => {
    const u = new URL(url);
    calls.push(u);
    const token = u.searchParams.get("access_token");
    const metric = u.searchParams.get("metric") ?? "";
    if (u.pathname.endsWith(`/${PAGE}`) && u.searchParams.get("fields") === "access_token") {
      assert.equal(token, "SYSTEM");
      return noPageToken ? error("(#10) no access") : reply({ access_token: "PAGE_TOKEN", id: PAGE });
    }
    assert.equal(token, noPageToken ? "SYSTEM" : "PAGE_TOKEN");
    if (u.pathname.endsWith(`/${PAGE}`)) return reply({ followers_count: 41, fan_count: 38 });
    if (u.pathname.endsWith(`/${PAGE}/insights`)) {
      if (noInsights) return error("(#200) Requires read_insights permission", 200);
      if (!ACCEPTED.has(metric)) return error("(#100) The value must be a valid insights metric");
      return reply({ data: [{ name: metric, period: "day", values: [{ value: 5, end_time: "2026-10-19T07:00:00+0000" }, { value: 2, end_time: "2026-10-18T07:00:00+0000" }] }] });
    }
    if (u.pathname.endsWith(`/${PAGE}/posts`)) {
      return reply({
        data: [
          { id: `${PAGE}_1`, message: "Villa", created_time: "2026-10-19T18:00:00+0000", permalink_url: "https://facebook.com/1", status_type: "added_photos", reactions: { summary: { total_count: 3 } }, comments: { summary: { total_count: 1 } } },
          { id: `${PAGE}_2`, message: "Old", created_time: "2026-08-01T06:00:00+0000" }
        ]
      });
    }
    if (u.pathname.endsWith("/insights")) {
      if (noInsights) return error("(#200) Requires read_insights permission", 200);
      const names = metric.split(",");
      if (names.some((n) => !ACCEPTED.has(n))) return error("(#100) The value must be a valid insights metric");
      return reply({ data: names.map((name) => ({ name, period: "lifetime", values: [{ value: name.includes("unique") ? 90 : 150 }] })) });
    }
    return error(`unexpected ${u.pathname}`);
  };
  return { fetch, calls };
}

const deps = (graph) => ({ fetch: graph.fetch, token: "SYSTEM", pageId: PAGE, now: () => NOW });

test("collects the page's days with renamed metrics and the posts of the last 30 days", async () => {
  const r = await collectFacebook(deps(fakeGraph()));
  const day = r.days.find((d) => d.day === "2026-10-18");
  assert.deepEqual(
    { followers: day.followers, new_follows: day.new_follows, reach: day.reach, views: day.views, engagements: day.engagements },
    { followers: 5, new_follows: 5, reach: 5, views: 5, engagements: 5 }
  );
  assert.equal(r.days.find((d) => d.day === "2026-10-20").followers, 41);
  // Metrics no name gives (unfollows, page views, post clicks) are reported, the rest saved.
  assert.match(r.errors.join(" | "), /unfollows/);
  assert.match(r.errors.join(" | "), /page_views/);
  assert.match(r.errors.join(" | "), /post clicks/);
  assert.equal(r.posts.length, 1);
  assert.deepEqual(
    { reach: r.posts[0].reach, views: r.posts[0].views, reactions: r.posts[0].reactions, comments: r.posts[0].comments, shares: r.posts[0].shares },
    { reach: 90, views: 150, reactions: 3, comments: 1, shares: 0 }
  );
  assert.ok(!r.errors.join(" ").includes("TOKEN"));
});

test("without read_insights the followers, reactions and comments still come", async () => {
  const r = await collectFacebook(deps(fakeGraph({ noInsights: true })));
  assert.deepEqual(r.days, [{ day: "2026-10-20", followers: 41 }]);
  assert.equal(r.posts[0].reactions, 3);
  assert.equal(r.posts[0].reach, undefined);
  assert.match(r.errors.join(" | "), /read_insights/);
});

test("without a page token it goes on with the system user's", async () => {
  const r = await collectFacebook(deps(fakeGraph({ noPageToken: true })));
  assert.match(r.errors[0], /page token/);
  assert.equal(r.posts.length, 1);
});

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const SECRET = "s".repeat(40);

test("save_fb_insights: secret, upsert, a missing value keeps the saved one", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.listings (id int); create function public.is_admin() returns boolean language sql as 'select true';`);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f >= "0002").sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  await db.exec(readFileSync(new URL("0027_facebook_insights.sql", MIGRATIONS), "utf8"));
  await db.query("insert into public.internal_secrets (name, value) values ('cron', $1) on conflict (name) do update set value = excluded.value", [SECRET]);
  const save = async (secret, days, posts) =>
    (await db.query("select public.save_fb_insights($1, $2::jsonb, $3::jsonb) as r", [secret, JSON.stringify(days), JSON.stringify(posts)])).rows[0].r;

  assert.deepEqual(await save("wrong", [], []), { error: "forbidden" });
  const r = await collectFacebook(deps(fakeGraph()));
  assert.deepEqual(await save(SECRET, r.days, r.posts), { days: r.days.length, posts: 1 });
  assert.deepEqual(await save(SECRET, [{ day: "2026-10-18", reach: 9 }], [{ post_id: r.posts[0].post_id, reactions: 4 }]), { days: 1, posts: 1 });
  const day = (await db.query("select reach, new_follows from public.fb_page_daily where day = '2026-10-18'")).rows[0];
  assert.deepEqual(day, { reach: 9, new_follows: 5 });
  const post = (await db.query("select reach, reactions, message from public.fb_post_stats")).rows[0];
  assert.deepEqual(post, { reach: 90, reactions: 4, message: "Villa" });
  const grants = (await db.query(`select has_table_privilege('anon', 'public.fb_post_stats', 'select') as anon_read,
      has_function_privilege('anon', 'public.save_fb_insights(text, jsonb, jsonb)', 'execute') as anon_exec`)).rows[0];
  assert.deepEqual(grants, { anon_read: false, anon_exec: true });
});
