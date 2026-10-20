// Reads the statistics of our Instagram account (@hadararealestate) from Meta's Graph API:
// the account's numbers for each of the last 28 days and every post of the last 30 days.
// Instagram keeps most of these for about 30 days only, so api/ig-insights.ts saves them
// every morning (save_ig_insights(), migration 0026) and the history builds up in Supabase.
// Only our own account's totals; nothing about any visitor.
//
// No network here: the caller passes fetch, so tests can play the Graph API. A metric Meta
// refuses (a renamed metric, too few followers for follower_count) is left out and the rest
// is still collected; errors come back as short messages, never with the token.

const GRAPH = "https://graph.facebook.com/v22.0";
const DAYS = 28;
const MEDIA_DAYS = 30;
const DAY = 86_400_000;

/** Meta's days run on Pacific time: 07:00 UTC is close enough for a daily total. */
const PACIFIC_OFFSET = 7 * 3600_000;

const DAY_METRICS = [
  "reach",
  "views",
  "profile_views",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "website_clicks",
  "profile_links_taps"
] as const;
const CORE_DAY_METRICS = ["reach", "views", "profile_views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves"];

const MEDIA_METRICS = ["reach", "views", "saved", "shares", "total_interactions", "likes", "comments"];

type DayMetric = (typeof DAY_METRICS)[number];

export interface IgDeps {
  fetch: typeof fetch;
  token: string;
  igUserId: string;
  now: () => number;
}

export type IgDay = { day: string; followers?: number; follows?: number; media_count?: number; new_followers?: number } & Partial<Record<DayMetric, number>>;

export interface IgMedia {
  media_id: string;
  posted_at: string | null;
  media_type: string | null;
  product_type: string | null;
  caption: string | null;
  permalink: string | null;
  reach?: number;
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  total_interactions?: number;
}

export interface IgCollection {
  days: IgDay[];
  media: IgMedia[];
  errors: string[];
}

class GraphError extends Error {}

async function getJson(deps: IgDeps, url: string): Promise<Record<string, unknown>> {
  const response = await deps.fetch(url, { signal: AbortSignal.timeout(15_000) });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || data.error) {
    const error = (data.error ?? {}) as { message?: string; code?: number };
    throw new GraphError(`${error.code ?? response.status}: ${(error.message ?? "request failed").slice(0, 200)}`);
  }
  return data;
}

function graph(deps: IgDeps, path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ ...params, access_token: deps.token });
  return getJson(deps, `${GRAPH}/${path}?${query}`);
}

const short = (error: unknown) => (error instanceof Error ? error.message : "unknown error").slice(0, 220);

const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined);

/** The calendar day (UTC date) a Graph value belongs to, from its end_time. */
export function graphDay(endTime: string): string {
  return new Date(Date.parse(endTime) - 12 * 3600_000).toISOString().slice(0, 10);
}

/** Today's date in Istanbul (UTC+3, no daylight saving). */
export function istanbulDay(now: number): string {
  return new Date(now + 3 * 3600_000).toISOString().slice(0, 10);
}

/** The last `count` finished Meta days, oldest first. */
export function lastDays(now: number, count = DAYS): string[] {
  const today = new Date(now - PACIFIC_OFFSET).toISOString().slice(0, 10);
  const start = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(start - (count - i) * DAY).toISOString().slice(0, 10));
}

/** Runs `task` over `items`, at most `limit` at a time. */
async function pool<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** {name: value} from an insights answer, whether Meta sent total_value or values[]. */
function insightValues(data: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of (data.data as { name?: string; total_value?: { value?: unknown }; values?: { value?: unknown }[] }[] | undefined) ?? []) {
    const value = num(row.total_value?.value) ?? num(row.values?.[0]?.value);
    if (row.name && value !== undefined) out[row.name] = value;
  }
  return out;
}

async function dayTotals(deps: IgDeps, day: string, metrics: string[]): Promise<Record<string, number>> {
  const since = (Date.parse(`${day}T00:00:00Z`) + PACIFIC_OFFSET) / 1000;
  return insightValues(
    await graph(deps, `${deps.igUserId}/insights`, {
      metric: metrics.join(","),
      period: "day",
      metric_type: "total_value",
      since: String(since),
      until: String(since + 86_400)
    })
  );
}

async function collectDays(deps: IgDeps, errors: string[]): Promise<IgDay[]> {
  const days = lastDays(deps.now());
  const rows = new Map<string, IgDay>(days.map((day) => [day, { day }]));
  let metrics: string[] = [...DAY_METRICS];

  // The first day decides the metric list: if Meta refuses the full one, the core one.
  try {
    Object.assign(rows.get(days[0])!, await dayTotals(deps, days[0], metrics));
  } catch (error) {
    errors.push(`day metrics: ${short(error)}`);
    metrics = CORE_DAY_METRICS;
    try {
      Object.assign(rows.get(days[0])!, await dayTotals(deps, days[0], metrics));
    } catch (again) {
      errors.push(`core day metrics: ${short(again)}`);
      metrics = [];
    }
  }
  if (metrics.length) {
    let failed = 0;
    await pool(days.slice(1), 5, async (day) => {
      try {
        Object.assign(rows.get(day)!, await dayTotals(deps, day, metrics));
      } catch (error) {
        if (failed++ === 0) errors.push(`day ${day}: ${short(error)}`);
      }
    });
    if (failed > 1) errors.push(`${failed} days failed in all`);
  }

  // New followers per day (Meta answers only for accounts with 100+ followers).
  try {
    const since = (Date.parse(`${days[0]}T00:00:00Z`) + PACIFIC_OFFSET) / 1000;
    const data = await graph(deps, `${deps.igUserId}/insights`, {
      metric: "follower_count",
      period: "day",
      since: String(since),
      until: String(since + days.length * 86_400)
    });
    for (const series of (data.data as { values?: { value?: unknown; end_time?: string }[] }[] | undefined) ?? []) {
      for (const value of series.values ?? []) {
        const row = value.end_time ? rows.get(graphDay(value.end_time)) : undefined;
        const n = num(value.value);
        if (row && n !== undefined) row.new_followers = n;
      }
    }
  } catch (error) {
    errors.push(`follower_count: ${short(error)}`);
  }

  // Today's snapshot of the account itself.
  try {
    const account = await graph(deps, deps.igUserId, { fields: "followers_count,follows_count,media_count" });
    const today = istanbulDay(deps.now());
    const row = rows.get(today) ?? { day: today };
    rows.set(today, Object.assign(row, { followers: num(account.followers_count), follows: num(account.follows_count), media_count: num(account.media_count) }));
  } catch (error) {
    errors.push(`account: ${short(error)}`);
  }

  return [...rows.values()].filter((row) => Object.keys(row).length > 1);
}

interface MediaItem {
  id?: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
}

async function collectMedia(deps: IgDeps, errors: string[]): Promise<IgMedia[]> {
  const cutoff = deps.now() - MEDIA_DAYS * DAY;
  const items: MediaItem[] = [];
  try {
    let page = await graph(deps, `${deps.igUserId}/media`, {
      fields: "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count",
      limit: "50"
    });
    for (let pages = 0; pages < 4; pages++) {
      const batch = (page.data as MediaItem[] | undefined) ?? [];
      items.push(...batch);
      const last = batch[batch.length - 1]?.timestamp;
      const next = (page.paging as { next?: string } | undefined)?.next;
      if (!next || !last || Date.parse(last) < cutoff) break;
      if (!next.startsWith(`${GRAPH}/`)) break;
      page = await getJson(deps, next);
    }
  } catch (error) {
    errors.push(`media list: ${short(error)}`);
  }

  const recent = items.filter((item) => item.id && item.timestamp && Date.parse(item.timestamp) >= cutoff);
  const media: IgMedia[] = [];
  let failed = 0;
  await pool(recent, 5, async (item) => {
    const row: IgMedia = {
      media_id: item.id!,
      posted_at: item.timestamp ? new Date(Date.parse(item.timestamp)).toISOString() : null,
      media_type: item.media_type ?? null,
      product_type: item.media_product_type ?? null,
      caption: item.caption ? item.caption.slice(0, 300) : null,
      permalink: item.permalink ?? null,
      likes: num(item.like_count),
      comments: num(item.comments_count)
    };
    let values: Record<string, number> | null = null;
    try {
      values = insightValues(await graph(deps, `${item.id}/insights`, { metric: MEDIA_METRICS.join(",") }));
    } catch {
      try {
        values = insightValues(await graph(deps, `${item.id}/insights`, { metric: MEDIA_METRICS.filter((m) => m !== "views").join(",") }));
      } catch (error) {
        if (failed++ === 0) errors.push(`post ${item.id}: ${short(error)}`);
      }
    }
    if (values) {
      row.reach = values.reach;
      row.views = values.views;
      row.saves = values.saved;
      row.shares = values.shares;
      row.total_interactions = values.total_interactions;
      row.likes = values.likes ?? row.likes;
      row.comments = values.comments ?? row.comments;
    }
    media.push(row);
  });
  if (failed > 1) errors.push(`${failed} posts without insights`);
  media.sort((a, b) => (a.posted_at ?? "").localeCompare(b.posted_at ?? ""));
  return media;
}

/** The account's last 28 days and the posts of the last 30 days. */
export async function collectInsights(deps: IgDeps): Promise<IgCollection> {
  const errors: string[] = [];
  const [days, media] = await Promise.all([collectDays(deps, errors), collectMedia(deps, errors)]);
  return { days, media, errors };
}
