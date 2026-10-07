// Builds the "مسودات مدونة حضارة" review page. The drafts live on the page itself
// (drafts.json + articles/<slug>.json + covers/<slug>.jpg), because the weekly session
// cannot push to the repository. The HADARA session adds an approved draft to the site.
//
//   node scripts/blog/build-review.mjs [previous-drafts.json] [--add scripts/blog/out/<slug>.json]
//
// previous-drafts.json = the page's published drafts.json (Artifact read, path "drafts.json").
// Drafts whose slug is already in src/data/blog.ts (published) are dropped.
// An --add file whose slug is already on the site is a rewrite of that article (add-article.py
// --replace): it stays on the page, marked as an expansion, until the site's text matches it.
// "pending" counts new articles only (the weekly writer stops at 4); "updates" lists the rewrites.
// Writes scripts/blog/site/{index.html,drafts.json} and prints the Artifact publish input.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const LOCALES = [["ar", "العربية"], ["en", "English"], ["fa", "فارسی"], ["fr", "Français"], ["ru", "Русский"]];

const args = process.argv.slice(2);
const adds = [];
let prevPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--add") adds.push(args[++i]);
  else prevPath = args[i];
}
const prev = prevPath && fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, "utf8")) : [];
const onSite = new Set([...fs.readFileSync(path.join(root, "src/data/blog.ts"), "utf8").matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

const rel = (p) => path.relative(process.cwd(), p);
const files = {};
const siteEn = JSON.parse(fs.readFileSync(path.join(root, "src/i18n/en.json"), "utf8")).blogData;
const isLive = (a) => JSON.stringify(siteEn[a.slug]?.body) === JSON.stringify(a.langs.en.body);
let articles = prev.filter((a) => {
  if (!onSite.has(a.slug) || (a.update && !isLive(a))) return true;
  files[a.cover] = null;
  files[a.article] = null;
  return false;
});
for (const file of adds) {
  const art = JSON.parse(fs.readFileSync(file, "utf8"));
  const cover = path.join(path.dirname(file), `${art.slug}.jpg`);
  if (!fs.existsSync(cover)) { console.error(`cover missing: run add-article.py ${file} --draft first`); process.exit(1); }
  const entry = {
    slug: art.slug,
    added: today,
    cover: `covers/${art.slug}.jpg`,
    article: `articles/${art.slug}.json`,
    words: art.en.body.join(" ").split(/\s+/).length,
    ...(onSite.has(art.slug) ? { update: true, oldWords: (siteEn[art.slug]?.body ?? []).join(" ").split(/\s+/).length } : {}),
    langs: Object.fromEntries(LOCALES.map(([l]) => [l, art[l]])),
  };
  articles = [entry, ...articles.filter((a) => a.slug !== art.slug)];
  files[entry.cover] = rel(cover);
  files[entry.article] = rel(file);
}

const siteDir = path.join(here, "site");
fs.mkdirSync(siteDir, { recursive: true });
fs.writeFileSync(path.join(siteDir, "drafts.json"), JSON.stringify(articles));
fs.writeFileSync(path.join(siteDir, "index.html"), page(articles));
files["drafts.json"] = rel(path.join(siteDir, "drafts.json"));
console.log(JSON.stringify({
  file_path: rel(path.join(siteDir, "index.html")),
  files,
  pending: articles.filter((a) => !a.update).map((a) => a.slug),
  updates: articles.filter((a) => a.update).map((a) => a.slug)
}, null, 2));

function page(list) {
  const data = JSON.stringify({ list, locales: LOCALES }).replace(/</g, "\\u003c");
  return `<title>مسودات مدونة حضارة</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@500;600;700&display=swap">
<style>
/* Layout: one reading column; each draft is a card with its cover, a language switch and the full text. */
:root{
  --bg:#f7f5f0; --surface:#ffffff; --ink:#18231e; --ink-soft:#5b6660; --line:#e4dfd3;
  --brand:#0f2b21; --gold:#b08a35; --gold-soft:#f3ead4;
  --ar:"IBM Plex Sans Arabic",Tahoma,sans-serif; --latin:Inter,"Helvetica Neue",Arial,sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1612;--surface:#15211b;--ink:#ece7da;--ink-soft:#a5ada7;--line:#26332c;--brand:#c9a24b;--gold:#d6b25e;--gold-soft:#2a261a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0d1612;--surface:#15211b;--ink:#ece7da;--ink-soft:#a5ada7;--line:#26332c;--brand:#c9a24b;--gold:#d6b25e;--gold-soft:#2a261a;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:16px/1.75 var(--ar);margin:0}
.wrap{max-width:820px;margin:0 auto;padding-inline:16px;padding-block:28px 64px;display:grid;gap:28px}
header{display:grid;gap:6px}
.eyebrow{font:600 12px/1 var(--latin);letter-spacing:.22em;color:var(--gold)}
h1{margin:0;font-weight:700;font-size:clamp(1.7rem,4vw,2.3rem);line-height:1.25;color:var(--brand);text-wrap:balance}
.lead{margin:0;color:var(--ink-soft);max-width:62ch}
.how{background:var(--gold-soft);border-radius:14px;padding:14px 18px;font-size:.95rem}
.how b{color:var(--brand)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;display:grid}
.card img{width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;display:block;background:var(--line)}
.inner{padding:18px 20px 22px;display:grid;gap:14px;min-width:0}
.meta{display:flex;flex-wrap:wrap;gap:8px;font-size:.8rem;color:var(--ink-soft)}
.meta span{border:1px solid var(--line);border-radius:999px;padding:2px 10px}
.meta .pending{background:var(--brand);border-color:var(--brand);color:var(--bg);font-weight:600}
.tabs{display:flex;gap:6px;flex-wrap:wrap}
.tabs button{font:600 .85rem/1 var(--ar);border-radius:999px;padding:8px 14px;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--ink)}
.tabs button[aria-selected="true"]{background:var(--brand);border-color:var(--brand);color:var(--bg)}
.tabs button:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
article{min-width:0;overflow-wrap:break-word}
article .cat{font-size:.8rem;font-weight:600;color:var(--gold)}
article h2{margin:.2em 0 .3em;font-size:1.45rem;line-height:1.35;text-wrap:balance}
article .ex{margin:0 0 1em;color:var(--ink-soft);font-weight:500}
article h3{margin:1.2em 0 .3em;font-size:1.1rem}
article p{margin:0 0 .9em}
.empty{background:var(--surface);border:1px dashed var(--line);border-radius:18px;padding:28px 20px;text-align:center;color:var(--ink-soft)}
</style>
<div class="wrap" dir="rtl" lang="ar">
  <header>
    <span class="eyebrow" dir="ltr">HADARA REAL ESTATE · BLOG</span>
    <h1>مسودات مدونة حضارة</h1>
    <p class="lead">كل أسبوع يكتب كاتب المدونة مقالاً جديداً بخمس لغات، وهنا أيضاً النسخ الموسّعة من المقالات القديمة. لم يُنشر شيء منها على الموقع بعد، وكلها تنتظر موافقتك.</p>
  </header>
  <div class="how"><b>للموافقة:</b> اكتب لـ Claude في جلسة موقع حضارة «انشر المقال» مع اسمه (أو «انشر المقالات الموسّعة»)، أو اطلب أي تعديل. لن يُنشر أي مقال قبل موافقتك.</div>
  <main id="list" style="display:grid;gap:28px"></main>
</div>
<script type="application/json" id="data">${data}</script>
<script>
(function(){
  var all=JSON.parse(document.getElementById("data").textContent), list=all.list, locales=all.locales;
  var root=document.getElementById("list");
  function el(t,c,x){var e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e;}
  if(!list.length){ root.appendChild(el("div","empty","لا توجد مسودات بانتظار الموافقة الآن. سيظهر هنا المقال القادم فور كتابته.")); return; }
  list.forEach(function(a){
    var card=el("section","card"); var img=el("img"); img.src=a.cover; img.alt=a.langs.ar.title; img.width=1536; img.height=1024; card.appendChild(img);
    var inner=el("div","inner");
    var meta=el("div","meta"); meta.appendChild(el("span","pending",a.update?"توسيع مقال منشور — بانتظار الموافقة":"بانتظار الموافقة"));
    if(a.added) meta.appendChild(el("span",null,"كُتب في "+a.added));
    meta.appendChild(el("span",null,a.update?("من "+a.oldWords+" إلى "+a.words+" كلمة بالإنجليزية"):(a.words+" كلمة بالإنجليزية")));
    var s=el("span",null,"/blog/"+a.slug); s.dir="ltr"; meta.appendChild(s);
    inner.appendChild(meta);
    var tabs=el("div","tabs"); tabs.setAttribute("role","tablist"); var art=el("article");
    function show(l){
      var c=a.langs[l]; art.textContent=""; art.lang=l; art.dir=(l==="ar"||l==="fa")?"rtl":"ltr";
      art.appendChild(el("div","cat",c.category)); art.appendChild(el("h2",null,c.title)); art.appendChild(el("p","ex",c.excerpt));
      c.body.forEach(function(p){ art.appendChild(p.indexOf("## ")===0 ? el("h3",null,p.slice(3)) : el("p",null,p)); });
    }
    locales.forEach(function(L,i){
      var b=el("button",null,L[1]); b.type="button"; b.setAttribute("role","tab"); b.setAttribute("aria-selected",i===0?"true":"false");
      b.addEventListener("click",function(){ tabs.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-selected","false");}); b.setAttribute("aria-selected","true"); show(L[0]); });
      tabs.appendChild(b);
    });
    show("ar"); inner.appendChild(tabs); inner.appendChild(art); card.appendChild(inner); root.appendChild(card);
  });
})();
</script>
`;
}
