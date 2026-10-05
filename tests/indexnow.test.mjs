import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  INDEXNOW_ENDPOINT,
  builtFileFor,
  changedUrls,
  contentFingerprint,
  manifestToPublish,
  sitemapUrls,
  submitIndexNow,
} from "../scripts/indexnow/lib.mjs";

const SITE = "https://www.hadararealestate.com";
const page = (title, body, asset = "index-AAA.js") =>
  `<html><head><title>${title}</title><meta name="description" content="d"></head><body><div id="app" data-prerendered><main>${body}</main></div><script type="module" src="/assets/${asset}"></script></body></html>`;

test("fingerprint ignores bundle hashes but notices content and title changes", () => {
  const a = contentFingerprint(page("T", "hello", "index-AAA.js"));
  assert.equal(a, contentFingerprint(page("T", "hello", "index-BBB.js")));
  assert.notEqual(a, contentFingerprint(page("T", "hello again")));
  assert.notEqual(a, contentFingerprint(page("T2", "hello")));
});

test("changed urls: new and changed only, everything when there is no live manifest", () => {
  assert.deepEqual(changedUrls({ a: "1", b: "2" }, { a: "1", b: "3", c: "4" }), ["b", "c"]);
  assert.deepEqual(changedUrls(null, { a: "1", b: "2" }), ["a", "b"]);
});

test("sitemap urls and built file paths", () => {
  const xml = `<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/ar/projects</loc><xhtml:link href="${SITE}/x"/></url></urlset>`;
  assert.deepEqual(sitemapUrls(xml), [`${SITE}/`, `${SITE}/ar/projects`]);
  assert.equal(builtFileFor(`${SITE}/`, SITE), "index.html");
  assert.equal(builtFileFor(`${SITE}/ar`, SITE), "ar/index.html");
  assert.equal(builtFileFor(`${SITE}/fa/projects/lotus-sisli`, SITE), "fa/projects/lotus-sisli/index.html");
});

test("unsent urls are left out of the published manifest", () => {
  assert.deepEqual(manifestToPublish({ a: "1", b: "2", c: "3" }, ["b"]), { a: "1", c: "3" });
});

test("submit: counts accepted batches, never throws, reports refusals", async () => {
  const calls = [];
  const logs = [];
  const ok = async (url, init) => (calls.push({ url, body: JSON.parse(init.body) }), new Response("", { status: 202 }));
  const urls = [`${SITE}/a`, `${SITE}/b`];
  assert.equal(await submitIndexNow(urls, { siteUrl: SITE, key: "k" }, { fetch: ok, log: (m) => logs.push(m) }), 2);
  assert.equal(calls[0].url, INDEXNOW_ENDPOINT);
  assert.deepEqual(calls[0].body, { host: "www.hadararealestate.com", key: "k", keyLocation: `${SITE}/k.txt`, urlList: urls });
  const refused = async () => new Response("bad key", { status: 403 });
  assert.equal(await submitIndexNow(urls, { siteUrl: SITE, key: "k" }, { fetch: refused, log: (m) => logs.push(m) }), 0);
  const boom = async () => { throw new Error("offline"); };
  assert.equal(await submitIndexNow(urls, { siteUrl: SITE, key: "k" }, { fetch: boom, log: (m) => logs.push(m) }), 0);
  assert.equal(logs.length, 2);
});

test("the key in the build script matches the key file in public/", () => {
  const run = readFileSync(new URL("../scripts/indexnow/run.mjs", import.meta.url), "utf8");
  const key = run.match(/const INDEXNOW_KEY = "([0-9a-f]{32})"/)?.[1];
  assert.ok(key, "key constant found");
  const file = readdirSync(new URL("../public/", import.meta.url)).find((f) => f === `${key}.txt`);
  assert.ok(file, "public/<key>.txt exists");
  assert.equal(readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8").trim(), key);
});
