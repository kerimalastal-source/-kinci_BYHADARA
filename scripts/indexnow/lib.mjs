// IndexNow helpers: after a production build, tell Bing, Yandex and the other
// IndexNow engines which pages are new or changed so they recrawl them within
// hours. Each build publishes /indexnow-manifest.json (URL -> content
// fingerprint); the next build fetches the live one and submits only the URLs
// whose fingerprint differs. Pure functions, tested in tests/indexnow.test.mjs.
import { createHash } from "node:crypto";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const MANIFEST_PATH = "/indexnow-manifest.json";
const BATCH = 10000; // IndexNow accepts up to 10,000 URLs per request

/** Fingerprint of what a search engine reads: title, description and the page
 * content inside #app. Scripts and hashed /assets/ names are dropped, so a
 * bundle rebuild alone doesn't mark every page as changed. */
export function contentFingerprint(html) {
  const pick = (re) => html.match(re)?.[1] ?? "";
  const title = pick(/<title>([\s\S]*?)<\/title>/i);
  const description = pick(/<meta name="description" content="([^"]*)"/i);
  const body = pick(/<div id="app"[^>]*>([\s\S]*?)<\/div>\s*<script/i) || pick(/<body[^>]*>([\s\S]*)<\/body>/i);
  const content = body.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/\/assets\/[^"'\s)]+/g, "");
  return createHash("sha256").update(`${title}\n${description}\n${content}`).digest("hex").slice(0, 16);
}

/** URLs that are new or whose fingerprint changed. Removed URLs are left out:
 * they redirect or 404, which the engines find on their own. */
export function changedUrls(previous, next) {
  return Object.keys(next).filter((url) => !previous || previous[url] !== next[url]);
}

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/** Maps a page URL to its built file under dist (pages build to <path>/index.html). */
export function builtFileFor(url, siteUrl) {
  const path = url.startsWith(siteUrl) ? url.slice(siteUrl.length) : new URL(url).pathname;
  const clean = path.replace(/\/+$/, "");
  return clean === "" ? "index.html" : `${clean.slice(1)}/index.html`;
}

/** Sends the URLs in batches. Never throws: a failed ping must not fail a build. */
export async function submitIndexNow(urls, { siteUrl, key }, deps) {
  const host = new URL(siteUrl).host;
  let sent = 0;
  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH);
    try {
      const res = await deps.fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key, keyLocation: `${siteUrl}/${key}.txt`, urlList }),
        signal: AbortSignal.timeout(15000),
      });
      // 200 OK and 202 Accepted (key validation pending) both mean received.
      if (res.status === 200 || res.status === 202) sent += urlList.length;
      else deps.log(`[indexnow] batch refused: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    } catch (err) {
      deps.log(`[indexnow] batch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return sent;
}

/** The manifest this build publishes. URLs that were not submitted are left
 * out, so the next production build sees them as new and sends them again. */
export function manifestToPublish(next, unsent) {
  const skip = new Set(unsent);
  return Object.fromEntries(Object.entries(next).filter(([url]) => !skip.has(url)));
}
