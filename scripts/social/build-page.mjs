// Builds the "منشورات حضارة" page (the claude.ai artifact the team opens every morning).
//
//   node scripts/social/build-page.mjs <date> [previous-days.json]
//
// Reads scripts/social/out/<date>/post-*.json, adds them on top of the previous
// days (read back from the published artifact), keeps the last KEEP_DAYS days and
// writes scripts/social/site/{index.html,days.json}. Prints the `files` map for
// the Artifact publish: new images to add, images of dropped days to remove (null).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const KEEP_DAYS = 7;
const [date, prevPath] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
  console.error("usage: node scripts/social/build-page.mjs <YYYY-MM-DD> [previous-days.json]");
  process.exit(1);
}
const outDir = path.join(here, "out", date);
const siteDir = path.join(here, "site");
fs.mkdirSync(siteDir, { recursive: true });

const today = fs.readdirSync(outDir).filter((f) => /^post-\d+\.json$/.test(f)).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")))
  .map((p) => ({ ...p, image: `days/${date}/${p.image}`, ...(p.slides ? { slides: p.slides.map((f) => `days/${date}/${f}`) } : {}) }));
if (!today.length) { console.error("no post-*.json in " + outDir); process.exit(1); }

const prev = prevPath && fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, "utf8")) : [];
const all = [{ date, posts: today }, ...prev.filter((d) => d.date !== date)].sort((a, b) => (a.date < b.date ? 1 : -1));
const kept = all.slice(0, KEEP_DAYS);
const dropped = all.slice(KEEP_DAYS);

fs.writeFileSync(path.join(siteDir, "days.json"), JSON.stringify(kept));
const planFile = path.join(here, "plan.json");
const plan = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, "utf8")) : null;
const planSummary = plan ? { name: plan.name, days: plan.days.map((d) => ({ date: d.date, week: d.week, labels: d.posts.map((p) => p.label) })) } : null;
fs.writeFileSync(path.join(siteDir, "index.html"), page(kept, planSummary));

const rel = (p) => path.relative(process.cwd(), p);
const files = { "days.json": rel(path.join(siteDir, "days.json")) };
for (const p of today) for (const f of [p.image, ...(p.slides || [])]) files[f] = rel(path.join(outDir, path.basename(f)));
for (const d of dropped) for (const p of d.posts) for (const f of [p.image, ...(p.slides || [])]) files[f] = null;
console.log(JSON.stringify({ file_path: rel(path.join(siteDir, "index.html")), files }, null, 2));

function page(days, plan) {
  const data = JSON.stringify({ days, plan }).replace(/</g, "\\u003c");
  return `<title>منشورات حضارة</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@500;600;700&display=swap">
<style>
/* Layout: a single reading column of days; each day holds post cards (image left of caption on wide screens, stacked on phones). */
:root{
  --bg:#f7f5f0; --surface:#ffffff; --ink:#18231e; --ink-soft:#5b6660; --line:#e4dfd3;
  --brand:#0f2b21; --gold:#b08a35; --gold-soft:#f3ead4; --ok:#2f7a4f;
  --ar:"IBM Plex Sans Arabic",Tahoma,sans-serif; --latin:Inter,"Helvetica Neue",Arial,sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1612;--surface:#15211b;--ink:#ece7da;--ink-soft:#a5ada7;--line:#26332c;--brand:#c9a24b;--gold:#d6b25e;--gold-soft:#2a261a;--ok:#6fc293;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0d1612;--surface:#15211b;--ink:#ece7da;--ink-soft:#a5ada7;--line:#26332c;--brand:#c9a24b;--gold:#d6b25e;--gold-soft:#2a261a;--ok:#6fc293;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:16px/1.7 var(--ar);margin:0}
.wrap{max-width:1040px;margin:0 auto;padding-inline:16px;padding-block:28px 64px;display:grid;gap:36px}
header{display:grid;gap:6px}
.eyebrow{font:600 12px/1 var(--latin);letter-spacing:.22em;color:var(--gold)}
h1{margin:0;font-weight:700;font-size:clamp(1.7rem,4vw,2.3rem);line-height:1.25;color:var(--brand);text-wrap:balance}
.lead{margin:0;color:var(--ink-soft);max-width:60ch}
details.help{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:4px 18px}
details.help summary{cursor:pointer;font-weight:600;padding:12px 0;color:var(--brand)}
details.help ol{margin:0 0 14px;padding-inline-start:1.3em;color:var(--ink-soft)}
details.help li{margin-block:4px}
.day{display:grid;gap:18px}
.day h2{margin:0;font-size:1.2rem;font-weight:700;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.day h2 .tag{font-size:.8rem;font-weight:600;background:var(--gold-soft);color:var(--gold);border-radius:999px;padding:2px 10px}
.post{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:20px;align-items:start}
.shot{display:grid;gap:8px}
.shot img{width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;border-radius:10px;display:block;background:var(--line)}
.shot a{font-size:.85rem;color:var(--gold);text-decoration:none;font-weight:600}
.shot a:hover,.shot a:focus-visible{text-decoration:underline}
.hint{font-size:.8rem;color:var(--ink-soft);margin:0}
.slides{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.slides button{padding:0;border:2px solid transparent;border-radius:6px;background:none;cursor:pointer;overflow:hidden}.slides button[aria-current]{border-color:var(--gold)}.slides img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover}
.body{display:grid;gap:12px;min-width:0}
.meta{font-size:.85rem;color:var(--ink-soft)}
.tabs{display:flex;gap:6px;flex-wrap:wrap}
.tabs button,.copy{font:600 .9rem/1 var(--ar);border-radius:999px;padding:9px 16px;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--ink)}
.tabs button[aria-selected="true"]{background:var(--brand);border-color:var(--brand);color:var(--bg)}
.copy{background:var(--gold);border-color:var(--gold);color:#fff;justify-self:start}
.copy.done{background:var(--ok);border-color:var(--ok)}
button:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.caption{border:1px solid var(--line);border-radius:12px;padding:14px 16px;max-height:420px;overflow:auto;font-size:.95rem;line-height:1.75;background:var(--bg)}
.caption p{margin:0;min-height:1em;white-space:pre-wrap;overflow-wrap:anywhere}
.empty{color:var(--ink-soft)}
.plan-week{margin:6px 0 4px;font-weight:700;color:var(--gold);font-size:.95rem}
.plan-row{display:grid;grid-template-columns:7.5rem minmax(0,1fr) auto;gap:10px;align-items:start;padding:8px 0;border-top:1px solid var(--line);font-size:.9rem}
.plan-row .d{color:var(--ink-soft);font-variant-numeric:tabular-nums}
.plan-row ul{margin:0;padding:0;list-style:none;display:grid;gap:2px}
.plan-row .s{font-size:.75rem;font-weight:600;border-radius:999px;padding:2px 9px;white-space:nowrap}
.s.done{background:var(--gold-soft);color:var(--gold)}.s.today{background:var(--brand);color:var(--bg)}.s.next{color:var(--ink-soft);border:1px solid var(--line)}
#plan-body{padding-bottom:12px}
@media (max-width:520px){.plan-row{grid-template-columns:minmax(0,1fr) auto}.plan-row .d{grid-column:1/-1}}
@media (max-width:700px){.post{grid-template-columns:minmax(0,1fr)}.shot img{max-width:360px}}
@media (prefers-reduced-motion:no-preference){.copy{transition:background .2s}}
</style>
<div class="wrap" dir="rtl" lang="ar">
  <header>
    <span class="eyebrow" dir="ltr">HADARA REAL ESTATE</span>
    <h1>منشورات حضارة</h1>
    <p class="lead">منشوران جديدان كل صباح لصفحة فيسبوك وحساب إنستغرام: الصورة جاهزة، والنص جاهز للنسخ بالعربي والإنجليزي. تُحفظ هنا منشورات آخر ${KEEP_DAYS} أيام.</p>
  </header>
  <details class="help">
    <summary>طريقة النشر</summary>
    <ol>
      <li>احفظ الصورة: اضغط مطوّلاً عليها على الموبايل، أو افتحها بالحجم الكامل من الرابط تحتها.</li>
      <li>افتح Meta Business Suite ← Gönderi oluştur (إنشاء منشور)، واختر صفحة فيسبوك وحساب إنستغرام معاً.</li>
      <li>ارفع الصورة، والصق نص «فيسبوك». ثم من Metni özelleştir (تخصيص النص) الصق نص «إنستغرام» لإنستغرام.</li>
      <li>انشر الآن، أو اختر Planla (جدولة) لوقت لاحق من اليوم.</li>
    </ol>
  </details>
  <details class="help plan" id="plan"><summary>خطة المحتوى لهذا الشهر</summary><div id="plan-body"></div></details>
  <main id="days"></main>
</div>
<script type="application/json" id="data">${data}</script>
<script>
(function(){
  var all = JSON.parse(document.getElementById("data").textContent);
  var days = all.days, plan = all.plan;
  var root = document.getElementById("days");
  root.style.display = "grid"; root.style.gap = "36px";
  var todayIso; try { todayIso = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date()); } catch(e){ todayIso = new Date().toISOString().slice(0,10); }
  function fmt(iso){
    try { return new Intl.DateTimeFormat("ar-u-nu-latn-ca-gregory",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(iso+"T00:00:00Z")); }
    catch(e){ return iso; }
  }
  function el(tag, cls, text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
  function renderCaption(box, text){
    box.textContent="";
    text.replace(/\\n$/,"").split("\\n").forEach(function(line){ var p=el("p"); p.dir="auto"; p.textContent=line; box.appendChild(p); });
  }
  if(plan){
    var pb=document.getElementById("plan-body"); var lastWeek=null;
    var published={}; days.forEach(function(d){published[d.date]=true;});
    var sum=document.querySelector("#plan summary"); sum.textContent="خطة المحتوى: "+plan.name.replace(/^.*?—\\s*/,"")+" ("+plan.days.length+" يوماً)";
    plan.days.forEach(function(d){
      if(d.week!==lastWeek){ pb.appendChild(el("div","plan-week",d.week)); lastWeek=d.week; }
      var row=el("div","plan-row"); row.appendChild(el("span","d",fmt(d.date).replace(/،?\\s*\\d{4}$/,"")));
      var ul=el("ul"); d.labels.forEach(function(l){ ul.appendChild(el("li",null,l)); }); row.appendChild(ul);
      var st = d.date===todayIso ? ["today","اليوم"] : (published[d.date]||d.date<todayIso) ? ["done","تم"] : ["next","قادم"];
      row.appendChild(el("span","s "+st[0],st[1])); pb.appendChild(row);
    });
  }
  if(!days.length){ root.appendChild(el("p","empty","ستظهر هنا منشورات الصباح فور تجهيزها.")); return; }
  days.forEach(function(day){
    var sec=el("section","day"); var h=el("h2"); h.appendChild(el("span",null,fmt(day.date)));
    if(day.date===todayIso) h.appendChild(el("span","tag","اليوم"));
    sec.appendChild(h);
    day.posts.forEach(function(p, i){
      var art=el("article","post");
      var shot=el("div","shot"); var img=el("img"); img.src=p.image; img.alt=p.topic||""; img.loading=i>1?"lazy":"eager"; img.width=1080; img.height=1350;
      var a=el("a",null,"فتح الصورة بالحجم الكامل"); a.href=p.image; a.target="_blank"; a.rel="noopener";
      shot.appendChild(img); shot.appendChild(a);
      if(p.slides&&p.slides.length){ var strip=el("div","slides"); p.slides.forEach(function(src,k){ var b=el("button"); b.type="button"; b.setAttribute("aria-label","الشريحة "+(k+1)); if(k===0) b.setAttribute("aria-current","true"); var t=el("img"); t.src=src; t.alt=""; t.loading="lazy"; b.appendChild(t); b.addEventListener("click",function(){ img.src=src; a.href=src; strip.querySelectorAll("button").forEach(function(x){x.removeAttribute("aria-current");}); b.setAttribute("aria-current","true"); }); strip.appendChild(b); }); shot.appendChild(el("p","hint","منشور شرائح: "+p.slides.length+" صور — اضغط على أي شريحة لعرضها.")); shot.appendChild(strip); } shot.appendChild(el("p","hint","على الموبايل: اضغط مطوّلاً على الصورة واختر حفظ."));
      var body=el("div","body");
      body.appendChild(el("div","meta","المنشور "+(i+1)+(p.at?" · الساعة "+p.at:"")+(p.topic?" · "+p.topic:"")));
      var tabs=el("div","tabs"); tabs.setAttribute("role","tablist");
      var box=el("div","caption"); var copy=el("button","copy","نسخ النص"); copy.type="button";
      var current="fb";
      [["fb","فيسبوك"],["ig","إنستغرام"]].forEach(function(t){
        var b=el("button",null,t[1]); b.type="button"; b.setAttribute("role","tab"); b.setAttribute("aria-selected", t[0]===current?"true":"false");
        b.addEventListener("click",function(){ current=t[0]; tabs.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-selected","false");}); b.setAttribute("aria-selected","true"); renderCaption(box,p[current]); copy.textContent="نسخ النص"; copy.classList.remove("done"); });
        tabs.appendChild(b);
      });
      renderCaption(box,p.fb);
      copy.addEventListener("click",function(){
        var text=p[current];
        function done(){ copy.textContent="تم النسخ ✓"; copy.classList.add("done"); }
        function fallback(){ var r=document.createRange(); r.selectNodeContents(box); var s=getSelection(); s.removeAllRanges(); s.addRange(r); copy.textContent="النص محدد، انسخه يدوياً"; }
        if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done,fallback); } else fallback();
      });
      body.appendChild(tabs); body.appendChild(box); body.appendChild(copy);
      art.appendChild(shot); art.appendChild(body); sec.appendChild(art);
    });
    root.appendChild(sec);
  });
})();
</script>
`;
}
