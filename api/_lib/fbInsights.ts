// Reads the statistics of our Facebook page ("Hadara Real Estate") from Meta's Graph API:
// the page's numbers for each of the last 28 days and every post of the last 30 days. The
// morning job (api/daily.ts) saves them (save_fb_insights(), migration 0027) next to the
// Instagram ones. Only our own page's totals; nothing about any visitor.
//
// Meta keeps renaming page metrics (page_impressions_unique became page_total_media_view_unique
// and so on), so each number has a list of names tried in order and the first one Meta
// accepts is used. A number none of them gives is left out; the rest is still collected.
// Reach, views and page views need the read_insights permission; followers, reactions,
// comments and shares only pages_read_engagement.
import { graphDay, istanbulDay, lastDays, pool } from "./igInsights.js";

const GRAPH = "https://graph.facebook.com/v22.0";
const MEDIA_DAYS = 30;
const DAY = 86_400_000;
const PACIFIC_OFFSET = 7 * 3600_000;

/** Column → Graph metric names, newest first. */
const DAY_METRICS = {
  followers: ["page_follows", "page_fans"],
  new_follows: ["page_daily_follows_unique", "page_fan_adds_unique"],
  unfollows: ["page_daily_unfollows_unique", "page_fan_removes_unique"],
  reach: ["page_total_media_view_unique", "page_impressions_unique"],
  views: ["page_media_view", "page_impressions"],
  page_views: ["page_views_total"],
  engagements: ["page_post_engagements"]
} as const;

const POST_METRICS = {
  reach: ["post_total_media_view_unique", "post_impressions_unique"],
  views: ["post_media_view", "post_impressions"],
  clicks: ["post_clicks"]
} as const;

type DayColumn = keyof typeof DAY_METRICS;
type PostColumn = keyof typeof POST_METRICS;

export interface FbDeps {
  fetch: typeof fetch;
  token: string;
  pageId: string;
  now: () => number;
}

export type FbDay = { day: string } & Partial<Record<DayColumn, number>>;

export interface FbPost {
  post_id: string;
  posted_at: string | null;
  post_type: string | null;
  message: string | null;
  permalink: string | null;
  reach?: number;
  views?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
}

export interface FbCollection {
  days: FbDay[];
  posts: FbPost[];
  errors: string[];
}

class GraphError extends Error {}

async function getJson(deps: FbDeps, url: string): Promise<Record<string, unknown>> {
  const response = await deps.fetch(url, { signal: AbortSignal.timeout(15_000) });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || data.error) {
    const error = (data.error ?? {}) as { message?: string; code?: number };
    throw new GraphError(`${error.code ?? response.status}: ${(error.message ?? "request failed").slice(0, 200)}`);
  }
  return data;
}

function graph(deps: FbDeps, path: string, params: Record<string, string>, token: string): Promise<Record<string, unknown>> {
  return getJson(deps, `${GRAPH}/${path}?${new URLSearchParams({ ...params, access_token: token })}`);
}

const short = (error: unknown) => (error instanceof Error ? error.message : "unknown error").slice(0, 220);
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined);

type Series = { name?: string; values?: { value?: unknown; end_time?: string }[] }[];

/** The first metric name Meta accepts, with its answer; errors only when none does. */
async function firstAccepted(
  names: readonly string[],
  ask: (name: string) => Promise<Record<string, unknown>>
): Promise<{ name: string; data: Record<string, unknown> }> {
  let last: unknown;
  for (const name of names) {
    try {
      return { name, data: await ask(name) };
    } catch (error) {
      last = error;
    }
  }
  throw last ?? new GraphError("no metric");
}

async function collectDays(deps: FbDeps, token: string, errors: string[]): Promise<FbDay[]> {
  const days = lastDays(deps.now());
  const rows = new Map<string, FbDay>(days.map((day) => [day, { day }]));
  const since = (Date.parse(`${days[0]}T00:00:00Z`) + PACIFIC_OFFSET) / 1000;
  const until = since + days.length * 86_400;

  await pool(Object.keys(DAY_METRICS) as DayColumn[], 3, async (column) => {
    try {
      const { data } = await firstAccepted(DAY_METRICS[column], (metric) =>
        graph(deps, `${deps.pageId}/insights`, { metric, period: "day", since: String(since), until: String(until) }, token)
      );
      for (const series of (data.data as Series | undefined) ?? []) {
        for (const value of series.values ?? []) {
          const row = value.end_time ? rows.get(graphDay(value.end_time)) : undefined;
          const n = num(value.value);
          if (row && n !== undefined) row[column] = n;
        }
      }
    } catch (error) {
      errors.push(`${column}: ${short(error)}`);
    }
  });

  // Today's follower count from the page itself (needs no insights permission).
  try {
    const page = await graph(deps, deps.pageId, { fields: "followers_count,fan_count" }, token);
    const followers = num(page.followers_count) ?? num(page.fan_count);
    if (followers !== undefined) {
      const today = istanbulDay(deps.now());
      rows.set(today, { ...(rows.get(today) ?? { day: today }), followers });
    }
  } catch (error) {
    errors.push(`page: ${short(error)}`);
  }

  return [...rows.values()].filter((row) => Object.keys(row).length > 1);
}

interface PostItem {
  id?: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  status_type?: string;
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

async function collectPosts(deps: FbDeps, token: string, errors: string[]): Promise<FbPost[]> {
  const cutoff = deps.now() - MEDIA_DAYS * DAY;
  const items: PostItem[] = [];
  try {
    let page = await graph(
      deps,
      `${deps.pageId}/posts`,
      {
        fields: "id,message,created_time,permalink_url,status_type,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares",
        since: String(Math.floor(cutoff / 1000)),
        limit: "50"
      },
      token
    );
    for (let pages = 0; pages < 4; pages++) {
      items.push(...((page.data as PostItem[] | undefined) ?? []));
      const next = (page.paging as { next?: string } | undefined)?.next;
      if (!next || !next.startsWith(`${GRAPH}/`)) break;
      page = await getJson(deps, next);
    }
  } catch (error) {
    errors.push(`posts: ${short(error)}`);
  }

  const recent = items.filter((item) => item.id && item.created_time && Date.parse(item.created_time) >= cutoff);
  const posts: FbPost[] = recent.map((item) => ({
    post_id: item.id!,
    posted_at: new Date(Date.parse(item.created_time!)).toISOString(),
    post_type: item.status_type ?? null,
    message: item.message ? item.message.slice(0, 300) : null,
    permalink: item.permalink_url ?? null,
    reactions: num(item.reactions?.summary?.total_count),
    comments: num(item.comments?.summary?.total_count),
    shares: num(item.shares?.count) ?? 0
  }));
  if (!posts.length) return posts;

  // The first post decides which metric names Meta accepts; the others ask for them together.
  const chosen = new Map<PostColumn, string>();
  for (const column of Object.keys(POST_METRICS) as PostColumn[]) {
    try {
      const { name } = await firstAccepted(POST_METRICS[column], (metric) => graph(deps, `${posts[0].post_id}/insights`, { metric }, token));
      chosen.set(column, name);
    } catch (error) {
      errors.push(`post ${column}: ${short(error)}`);
    }
  }
  if (!chosen.size) return posts;

  const metric = [...chosen.values()].join(",");
  let failed = 0;
  await pool(posts, 5, async (post) => {
    try {
      const data = await graph(deps, `${post.post_id}/insights`, { metric }, token);
      for (const series of (data.data as Series | undefined) ?? []) {
        const column = [...chosen].find(([, name]) => name === series.name)?.[0];
        const n = num(series.values?.[0]?.value);
        if (column && n !== undefined) post[column] = n;
      }
    } catch (error) {
      if (failed++ === 0) errors.push(`post ${post.post_id}: ${short(error)}`);
    }
  });
  if (failed > 1) errors.push(`${failed} posts without insights`);
  return posts.sort((a, b) => (a.posted_at ?? "").localeCompare(b.posted_at ?? ""));
}

/** The page's last 28 days and the posts of the last 30 days. */
export async function collectFacebook(deps: FbDeps): Promise<FbCollection> {
  const errors: string[] = [];
  // Page insights are read with the page's own token, taken with the system user's one.
  let token = deps.token;
  try {
    const page = await graph(deps, deps.pageId, { fields: "access_token" }, deps.token);
    if (typeof page.access_token === "string" && page.access_token) token = page.access_token;
    else errors.push("page token: not returned");
  } catch (error) {
    errors.push(`page token: ${short(error)}`);
  }
  const [days, posts] = await Promise.all([collectDays(deps, token, errors), collectPosts(deps, token, errors)]);
  return { days, posts, errors };
}
