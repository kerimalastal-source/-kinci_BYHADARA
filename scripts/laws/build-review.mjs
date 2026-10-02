// Builds the owner's review page for the Property Laws page ("مسودات قوانين العقار").
//
//   node scripts/laws/build-review.mjs [previous drafts.json] [--add scripts/laws/out/<id>.json ...]
//
// The page lists (1) items already in src/data/laws.ts but not yet approved, and
// (2) new drafts from the weekly monitor, which live only on the review page
// (drafts.json + drafts/<id>.json), because routines cannot push to the repository.
// Drafts whose id is now in laws.ts are dropped. Writes scripts/laws/site/ and prints
// { file_path, files, pending } for the Artifact publish.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(here, "site");

async function loadLaws() {
  const ts = fs.readFileSync(path.join(root, "src/data/laws.ts"), "utf8");
  const { code } = transformSync(ts, { loader: "ts", format: "esm" });
  const tmp = path.join(outDir, "laws.tmp.mjs");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(tmp, code);
  const mod = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
  fs.rmSync(tmp);
  return mod;
}

const args = process.argv.slice(2);
const addFiles = [];
let previous = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--add") addFiles.push(args[++i]);
  else previous = args[i];
}

const laws = await loadLaws();
const dict = Object.fromEntries(["en", "ar", "fa", "fr", "ru"].map((l) => [l, JSON.parse(fs.readFileSync(path.join(root, `src/i18n/${l}.json`), "utf8"))]));
const notes = JSON.parse(fs.readFileSync(path.join(here, "review-notes.json"), "utf8"));
const knownIds = new Set([...laws.lawRules, ...laws.lawUpdates].map((i) => i.id));

// Items in the repo awaiting approval.
const repoItems = [
  ...laws.lawRules.filter((r) => !r.approved).map((r) => ({ kind: "rule", ...r })),
  ...laws.sortedLawUpdates(laws.lawUpdates.filter((u) => !u.approved)).map((u) => ({ kind: "update", ...u }))
].map((item) => ({
  ...item,
  verify: notes[item.id] ?? "",
  text: Object.fromEntries(
    Object.entries(dict).map(([l, d]) => [l, d.lawsData[item.kind === "rule" ? "rules" : "updates"][item.id]])
  ),
  inRepo: true
}));

// Monitor drafts (stored on the review page).
let drafts = [];
if (previous && fs.existsSync(previous)) {
  const list = JSON.parse(fs.readFileSync(previous, "utf8"));
  const dir = path.dirname(previous);
  for (const entry of list) {
    const file = path.join(dir, "drafts", `${entry.id}.json`);
    drafts.push(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : entry);
  }
}
for (const file of addFiles) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  drafts = drafts.filter((x) => x.id !== d.id).concat(d);
}
const removed = drafts.filter((d) => knownIds.has(d.id)).map((d) => d.id);
drafts = drafts.filter((d) => !knownIds.has(d.id));

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (iso) => (iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("ar-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
const ar = dict.ar.laws;

function card(item) {
  const t = item.text.ar ?? {};
  const en = item.text.en ?? {};
  const rows = item.kind === "rule"
    ? `<p>${esc(t.text)}</p>`
    : `<p>${esc(t.summary)}</p>
       ${t.before ? `<p><b>${ar.before}:</b> ${esc(t.before)}</p>` : ""}
       <p><b>${t.before ? ar.after : ar.whatChanged}:</b> ${esc(t.after)}</p>
       <p><b>${ar.affects}:</b> ${esc(t.affects)}</p>
       ${item.effective ? `<p><b>${ar.effective}:</b> ${fmt(item.effective)}</p>` : ""}
       <p><b>${ar.reference}:</b> <bdi dir="ltr">${esc(item.reference)}</bdi></p>
       <p><b>${ar.howWeHelp}</b> ${esc(t.help)}</p>`;
  const enRows = Object.entries(en).map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join("");
  return `
  <article class="card">
    <div class="meta">
      <span class="pill">${esc(ar.topics[item.topic])}</span>
      <span class="pill pill--kind">${item.kind === "rule" ? "قاعدة حالية" : "خبر قانوني"}</span>
      ${item.stage === "proposal" ? `<span class="pill pill--stage">${esc(ar.proposal)}</span>` : ""}
      ${item.decided ? `<span class="date">${fmt(item.decided)}</span>` : ""}
      <code dir="ltr">${esc(item.id)}</code>
    </div>
    <h3>${esc(t.title)}</h3>
    ${rows}
    <div class="sources"><b>${ar.officialSource}</b>
      ${(item.sources ?? []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(dict.ar.laws.sources[s.key])}</a><span class="url" dir="ltr">${esc(s.url)}</span>`).join("")}
    </div>
    ${item.verify ? `<div class="verify"><b>تحقّق قبل الموافقة:</b> ${esc(item.verify)}</div>` : ""}
    <details><summary>English</summary>${enRows}</details>
  </article>`;
}

const all = [...repoItems, ...drafts];
// The Artifact publish wraps the page in its own <html>/<head>/<body> skeleton.
const html = `<title>مسودات قوانين العقار</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root { --bg:#f7f5f0; --card:#fff; --ink:#14201b; --muted:#6f776f; --line:#e6e1d3; --green:#0f2b21; --gold:#a67f2e; --warn:#fff4d6; --warn-ink:#7a5a12; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme:dark; --bg:#0e1512; --card:#16201b; --ink:#eef2ef; --muted:#9aa59e; --line:#2a3630; --green:#9fd3b8; --gold:#e4c574; --warn:#3a2f12; --warn-ink:#f1d48a; } }
:root[data-theme="dark"] { color-scheme:dark; --bg:#0e1512; --card:#16201b; --ink:#eef2ef; --muted:#9aa59e; --line:#2a3630; --green:#9fd3b8; --gold:#e4c574; --warn:#3a2f12; --warn-ink:#f1d48a; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.7 "IBM Plex Sans Arabic", system-ui, sans-serif; }
main { max-width:900px; margin:0 auto; padding:24px 16px 64px; }
h1, h2, h3 { text-wrap:balance; }
a:focus-visible, summary:focus-visible { outline:2px solid var(--gold); outline-offset:2px; }
h1 { margin:0 0 4px; font-size:1.6rem; }
.lead { color:var(--muted); margin:0 0 20px; }
.box { background:var(--warn); color:var(--warn-ink); border-radius:12px; padding:12px 16px; margin-bottom:20px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px; margin-bottom:16px; }
.card h3 { margin:6px 0 8px; font-size:1.15rem; }
.card p { margin:6px 0; }
.meta { display:flex; flex-wrap:wrap; gap:6px; align-items:center; font-size:.85rem; }
.pill { background:rgba(127,127,127,.14); border-radius:999px; padding:2px 10px; font-weight:600; }
.pill--kind { background:transparent; border:1px solid var(--line); }
.pill--stage { color:var(--gold); border:1px solid var(--gold); background:transparent; }
.date { color:var(--gold); font-weight:700; }
code { font-size:.8rem; color:var(--muted); margin-inline-start:auto; }
.sources { margin-top:10px; display:flex; flex-direction:column; gap:2px; }
.sources a { color:var(--green); font-weight:600; }
.url { font-size:.75rem; color:var(--muted); overflow-wrap:anywhere; text-align:left; }
.verify { margin-top:10px; background:var(--warn); color:var(--warn-ink); border-radius:10px; padding:8px 12px; font-size:.92rem; }
details { margin-top:10px; font-size:.92rem; }
details[open] { direction:ltr; text-align:left; }
summary { cursor:pointer; color:var(--muted); direction:rtl; text-align:right; }
h2 { font-size:1.2rem; margin:28px 0 12px; }
</style>
<main lang="ar" dir="rtl">
  <h1>مسودات قوانين العقار</h1>
  <p class="lead">كل بند هنا من مصدر حكومي تركي رسمي مع رابطه. افتح الرابط وتأكد من المعلومة، وبعدين قلّي «موافق على …» (أو «احذف …» أو التعديل المطلوب). ما في شي بينزل عالموقع قبل موافقتك.</p>
  <div class="box">عدد البنود بانتظار موافقتك: <b>${all.length}</b> · آخر تحديث للصفحة: ${fmt(new Date().toISOString().slice(0, 10))}</div>
  ${repoItems.some((i) => i.kind === "rule") ? `<h2>القواعد الحالية باختصار</h2>${repoItems.filter((i) => i.kind === "rule").map(card).join("")}` : ""}
  ${repoItems.some((i) => i.kind === "update") || drafts.length ? `<h2>الأخبار القانونية</h2>${[...repoItems.filter((i) => i.kind === "update"), ...drafts].map(card).join("")}` : ""}
  ${all.length ? "" : `<p class="lead">ما في مسودات حالياً.</p>`}
</main>
`;

fs.rmSync(path.join(outDir, "drafts"), { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "drafts"), { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html);
fs.writeFileSync(path.join(outDir, "drafts.json"), JSON.stringify(drafts.map((d) => ({ id: d.id, kind: d.kind, topic: d.topic, decided: d.decided ?? null })), null, 2));
const files = { "drafts.json": "scripts/laws/site/drafts.json" };
for (const d of drafts) {
  fs.writeFileSync(path.join(outDir, "drafts", `${d.id}.json`), JSON.stringify(d, null, 2));
  files[`drafts/${d.id}.json`] = `scripts/laws/site/drafts/${d.id}.json`;
}
for (const id of removed) files[`drafts/${id}.json`] = null;
console.log(JSON.stringify({ file_path: "scripts/laws/site/index.html", files, pending: all.map((i) => i.id) }, null, 2));
