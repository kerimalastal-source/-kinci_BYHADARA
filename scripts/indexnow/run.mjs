// Last step of `npm run build`. Writes /indexnow-manifest.json into dist and,
// on Vercel production builds only, submits the pages that are new or changed
// since the live manifest to IndexNow. Never fails the build.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MANIFEST_PATH,
  builtFileFor,
  changedUrls,
  contentFingerprint,
  manifestToPublish,
  sitemapUrls,
  submitIndexNow,
} from "./lib.mjs";

// Public by design: the engines fetch it from the site to verify ownership.
// Must match public/38e07ce3aff74081da4b33a00cde9d1b.txt; never change one without the other.
const INDEXNOW_KEY = "38e07ce3aff74081da4b33a00cde9d1b";
const SITE_URL = (process.env.VITE_SITE_URL || "https://www.hadararealestate.com").replace(/\/$/, "");
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist");

async function main() {
  const sitemap = resolve(OUT, "sitemap.xml");
  if (!existsSync(sitemap)) return console.log("[indexnow] no sitemap.xml, skipping");

  const manifest = {};
  for (const url of sitemapUrls(readFileSync(sitemap, "utf8"))) {
    const file = resolve(OUT, builtFileFor(url, SITE_URL));
    if (existsSync(file)) manifest[url] = contentFingerprint(readFileSync(file, "utf8"));
  }
  const total = Object.keys(manifest).length;
  const publish = (unsent, note) => {
    writeFileSync(resolve(OUT, MANIFEST_PATH.slice(1)), JSON.stringify(manifestToPublish(manifest, unsent)));
    console.log(`[indexnow] ${note} (manifest: ${total - unsent.length} of ${total} pages)`);
  };

  if (process.env.VERCEL_ENV !== "production") return publish([], "not a production build, nothing submitted");

  let previous = null;
  try {
    const res = await fetch(`${SITE_URL}${MANIFEST_PATH}`, { signal: AbortSignal.timeout(10000) });
    if (res.ok) previous = await res.json();
    else console.log(`[indexnow] no live manifest (HTTP ${res.status}), every page counts as new`);
  } catch (err) {
    // Without the live manifest we can't tell what changed: publish an empty
    // one so the next production build sends every page.
    return publish(Object.keys(manifest), `live manifest unreachable (${err instanceof Error ? err.message : err}), retry next build`);
  }

  const urls = changedUrls(previous, manifest);
  if (!urls.length) return publish([], "no changed pages");

  // The engines verify the key by fetching it from the live site. On the very
  // first deploy it isn't live yet, so hold the pages for the next build.
  const keyLive = await fetch(`${SITE_URL}/${INDEXNOW_KEY}.txt`, { signal: AbortSignal.timeout(10000) })
    .then(async (r) => r.ok && (await r.text()).trim() === INDEXNOW_KEY)
    .catch(() => false);
  if (!keyLive) return publish(urls, `key file not live yet, ${urls.length} pages held for the next build`);

  const sent = await submitIndexNow(urls, { siteUrl: SITE_URL, key: INDEXNOW_KEY }, { fetch, log: console.log });
  publish(sent ? [] : urls, `submitted ${sent} of ${urls.length} changed pages`);
}

main().catch((err) => console.log(`[indexnow] skipped: ${err instanceof Error ? err.message : err}`));
