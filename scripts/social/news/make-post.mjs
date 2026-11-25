// Adds a scheduled news-design post (schedule.json) to a day already pushed by the daily
// session: renders it and writes post-<n>.jpg/.json (+ posts.json with this post only, for
// the log) into scripts/social/out/<date>/. Then run push-day.sh <date>. See README.md.
//   node scripts/social/news/make-post.mjs <YYYY-MM-DD>
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const date = process.argv[2];
const entry = JSON.parse(fs.readFileSync(path.join(here, "schedule.json"), "utf8")).posts.find((p) => p.date === date);
if (!entry) { console.error(`no news post scheduled for ${date}`); process.exit(1); }

// The caption builder is render.mjs's own (one source for the caption format and links).
const src = fs.readFileSync(path.join(root, "scripts/social/render.mjs"), "utf8");
const consts = src.slice(src.indexOf("const SITE"), src.indexOf("const LRM"));
const lrm = src.slice(src.indexOf("const LRM"), src.indexOf("\n", src.indexOf("const LRM")));
const fns = src.slice(src.indexOf("const url = (lang"), src.indexOf("const CAPTION_MAX"));
const caption = new Function(`${consts}${lrm}\n${fns}; return caption;`)();

const out = path.join(root, "scripts/social/out", date);
fs.mkdirSync(out, { recursive: true });
const taken = fs.readdirSync(out).filter((f) => /^post-\d+\.json$/.test(f)).map((f) => parseInt(f.slice(5)));
if (taken.length && fs.readFileSync(path.join(out, `post-${Math.max(...taken)}.json`), "utf8").includes(`"${entry.id}"`)) {
  console.error(`${entry.id} is already in ${out}`); process.exit(1);
}
const n = (taken.length ? Math.max(...taken) : 0) + 1;
const tmp = fs.mkdtempSync(path.join(out, ".news-"));
const res = JSON.parse(execFileSync("node", [path.join(here, "render-news.mjs"), path.join(here, entry.spec), tmp]).toString().trim().split("\n").pop());
fs.copyFileSync(res.jpg, path.join(out, `post-${n}.jpg`));
fs.rmSync(tmp, { recursive: true, force: true });
const p = { id: entry.id, caption: entry.caption };
const post = { id: entry.id, topic: entry.topic, image: `post-${n}.jpg`, fb: caption(p, "facebook"), ig: caption(p, "instagram"), at: entry.at };
fs.writeFileSync(path.join(out, `post-${n}.json`), JSON.stringify(post, null, 2) + "\n");
const spec = JSON.parse(fs.readFileSync(path.join(here, entry.spec), "utf8"));
fs.writeFileSync(path.join(out, "posts.json"), JSON.stringify({ posts: [{ id: entry.id, topic: entry.topic, image: { headlineAr: `${spec.line1} ${spec.line2.replace(/[{}]/g, "")}`, headlineEn: entry.caption.en.title, photo: `news/${spec.hero}` } }] }, null, 2) + "\n");
console.log(`post-${n}: ${entry.id} at ${entry.at} (ig ${post.ig.length} chars)`);
