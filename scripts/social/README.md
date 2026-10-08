# منشورات حضارة اليومية (Daily social posts)

Every morning (07:30 Istanbul) a scheduled Claude session prepares **the day's posts** —
2 a day, or **3 a day during the intensive week 2026-09-30 → 2026-10-06** (one image + one
Facebook caption + one Instagram caption each) for the HADARA Real Estate Facebook page and
Instagram account, publishes them to the team's page on claude.ai, and pushes them to
the **`social-posts` branch**:

**Artifact:** see `ARTIFACT_URL` in `scripts/social/config.json`.

The website publishes them by itself (owner's request 2026-09-29): Vercel builds the
`social-posts` branch, and the site's cron (`api/social-publish.ts`, runs at 09:00, 14:00
and 21:00 Istanbul) reads `public/social/<date>/` from that build and posts each image with
its `fb` caption to the Facebook Page and its `ig` caption to Instagram **at the post's own
time** (`at`, Istanbul "HH:MM"; a post without `at` goes out with the 09:00 run), then
sends the result to the owner on Telegram. Each post goes out once per platform.
**Never push to `main`.** The push must be done **before 08:50** so the 09:00 post is on
the branch build in time.

## Steps for the daily session

> **Updated 2026-09-29 (owner's request):** where the routine's message still says "both
> posts", "two topics" or "at 10:00", this README wins: make **every** post topics.mjs gives
> for today (3 during the intensive week), each with its `at` time, **plus the day's Story**
> (below), and push before 08:50.

Work from the repository root. Use Istanbul's date (`TZ=Europe/Istanbul date +%F`).

1. `node scripts/social/topics.mjs` → today's topics from the monthly content plan
   (`plan.json`: one entry per day, a weekly theme, 2 or 3 posts with `label`, `brief`,
   `path`, suggested `photos` and, in the intensive week, `at`). Use each topic's `id` as
   the post `id`, its `label` as the post `topic`, and **copy its `at` unchanged** into the
   post (posts.json, in the same order); let the week's theme colour the wording.
   The three times have three roles (owner's decision 2026-10-03, every day to 2026-10-28):
   **09:00 a project** (design A), **14:00 useful real-estate information** (article,
   citizenship, FAQ, a site tool; design A), **21:00 an interactive "tweet"** (`kind:
   "evening"`, design `tweet`, or `choice` when the topic says so) — follow the brief and
   the topic's `design` (see "Evening designs" below). **One feed post per time**: never two
   posts with the same `at` (only the Story goes with the 09:00 post).
   **If it prints `"finished": true`, the month is over: make no posts, publish
   nothing, and end with the Arabic summary "انتهت خطة المحتوى لهذا الشهر — حان وقت
   مراجعة النتائج ووضع خطة جديدة مع Claude."** (`notStarted` → also make no posts.)
   **Before writing anything, read the log of everything already published**:
   `git fetch origin social-posts && git show origin/social-posts:social/log.json`
   (if the branch or file doesn't exist yet, use `scripts/social/log-seed.json`).
   Never reuse a post `id`, a headline (Arabic or English) or the same photo for the
   same project, and never repeat an angle already covered for that project. If today's
   topic from the plan was already published, keep the plan's topic but take a clearly
   different angle, headline and photo, and say so in the summary.
   **Plus one Story every day (owner's request 2026-09-29), going out with the morning post**:
   topics.mjs prints `story` (`basedOn` = the morning topic, its `id` and `at`). Add it as the
   **last** entry of posts.json with `"story": true`, that `id`, the same `at` (if any), `topic`
   «ستوري: <the morning label>», and **no `caption`** (stories have none). Same project/subject
   as the morning post, but a **different photo** and a short story headline of its own (Arabic
   and English at equal weight), 4 stats, optional note. The story is a 1080x1920 picture of the
   same approved design (render.mjs draws it); keep its text inside the design, nothing else.
2. Collect the facts for each topic **from the site only**:
   - projects: `src/data/projects.ts` (stats, residences, status, amenities, district)
     and `projectsData.<slug>` in `src/i18n/ar.json` + `en.json` (name, tagline,
     highlights, nearby);
   - articles: `blogData.<slug>` in `ar.json`/`en.json`;
   - pages: the dictionary keys named in the brief (`citizenship.*`, `videoTour.*` …).
3. Look at the suggested photo (Read the file). If it is weak for a headline
   (bathroom, plan, blurry), pick a better one from the topic's `photos`.
4. Write `scripts/social/out/<date>/posts.json` (shape below) and run
   `node scripts/social/render.mjs scripts/social/out/<date>/posts.json`.
   It must print `ok` for every post (2 or 3, plus the Story) — fix any PROBLEMS (shorter text, 3 stats, a shorter tip, `arSize`
   56–60) and re-run. Then Read each `post-<n>.jpg` once to check it visually.
5. Read the published page's `days.json` with the Artifact tool
   (`action: "read"`, `url` = ARTIFACT_URL, `path: "days.json"`), then run
   `node scripts/social/build-page.mjs <date> <that local days.json>`.
   It prints `file_path` and `files`; publish them with the Artifact tool
   (`url` = ARTIFACT_URL, `file_path`, `files`) — read the page first
   (`action: "read"`, `url`) so the publish is accepted.
6. Push the day to the `social-posts` branch (it also adds today's posts to `social/log.json`) (only this; never `main`):
   `bash scripts/social/push-day.sh <date>`
   It works in a separate worktree (`../social-posts-worktree`): merges `main` into
   `social-posts`, copies `post-<n>.jpg` + `post-<n>.json` from `scripts/social/out/<date>/`
   to `public/social/<date>/`, writes `day.json` (the posts in order), deletes day folders
   older than 21 days, commits as `kerimalastal-source <kerim.alastal@gmail.com>` (Vercel's
   free plan only builds the owner's commits) and pushes. It must end with
   `pushed social-posts: …`. If the push is refused, stop and say exactly why in the
   summary: at 10:00 the website then tells the owner on Telegram that today's posts
   weren't prepared. Commit nothing else (the outputs stay git-ignored).

## Evening designs (approved by the owner 2026-10-03 — locked)

The 21:00 post is a short interactive "tweet" in Arabic and English (equal weight, formal
Arabic), same colours, fonts, logo, gold badge and footer as design A, 1080×1350 JPEG.
Two designs, chosen by the plan topic's `design`:

- **`tweet` (the main one, v2 2026-10-07)**: a light card with the Arabic question big (70px,
  max 3 lines; render.mjs shrinks it) and the English under it, optional 2–4 `options`
  (`{icon?, ar, en}`, short) under a thin rule; then **a useful fact** so the post still
  teaches something: `fact` (`{ar, en}`, e.g. «هل تعلم؟ …») and optional 3 `facts` tiles
  (`{value, ar, en}`, same as design A), and the gold line `ask` (default «شاركونا رأيكم في
  التعليقات · Tell us in the comments»; set your own, e.g. «اكتبوا مدينتكم في التعليقات»).
  Types (the badge says which): «سؤال الليلة · Tonight's question», «صح أم خطأ؟ · True or
  false?» (statement only on the image; the caption gives the answer at the end after
  «الإجابة ⬇️ / Answer ⬇️»), «أكمل الجملة · Finish the sentence» (the sentence ends with «…»).
- **`choice` («لو خُيّرت · Your pick», 1–2 times a week)**: two project photos side by side
  (`a`, `b`: `{photo, position?, ar, en}`; sharp photos, never a plan or bathroom), "أم" in
  a gold circle in the middle, labels A/B, and the question (one line in each language) under
  them. Also set `image.photo` = `a.photo` (for the log).
- Both: no stats, no price, facts only from the site (true/false answers from the FAQ or the
  page the brief names), the citizenship note when it is about citizenship, no 4-byte emoji
  in the image except the small `icon` of an option. Caption as usual (title = the question,
  a short intro, the invitation to comment, cta + path). Feed posts only (never a Story/Reel).

## Design A v2 (approved by the owner 2026-10-07 — locked; trial week, then review)

The owner asked for bigger, clearer text and richer, more useful content ("the page must
inform a buyer, not fill the feed"). Every post except the 21:00 evening post uses the
**v2 template** that `render.mjs` draws: a thin gold frame, the photo on top fading into the
dark green (`#0f2b21`) panel, the HADARA logo top-left and an **outlined** gold badge
top-right (Arabic · English); in the panel: an eyebrow (`place` left, `placeAr` right, gold),
a **big Arabic headline** (`arSize` 68 by default, up to 2 lines; render.mjs shrinks it to
52 at most) and the English line under it (one line, shrinks to fit), a short gold rule,
then **3 large fact tiles** (gold number 58px, Arabic label, English label; 4 still work but
3 read better), and the gold **"معلومة" strip** (`tip`: one more useful fact, Arabic +
English; `tip.labelAr` can change the word, e.g. «للجنسية» or «نصيحة»). Footer:
www.hadararealestate.com + WhatsApp +90 531 930 92 14. 1080×1350 JPEG (stories 1080×1920).

- **Guides / articles / FAQ / citizenship** may use `design: "list"`: a shorter photo band
  and a numbered list of 3 `items` (`{ar, en}`, one line each in Arabic) instead of the
  tiles, plus the `tip` strip.
- The panel sits above the footer and grows upwards: if render.mjs says the panel reaches
  the top bar, shorten the text, use 3 stats, or a shorter tip.
- Content (owner, 2026-10-07): lead with a concrete, useful fact (a size, a distance, a
  step, a document, a rule); no filler tiles ("للجميع", "معك"); formal Arabic (فصحى) only.

- **Always bilingual, both languages equal (owner's rule 2026-09-29)**: every image has the
  full message in Arabic and in English; every caption has a complete Arabic part, then
  the divider `━━━━━━━━  English  ━━━━━━━━`, then a complete English part (render.mjs does
  this). Never a post in one language only, never the English as a small afterthought.

- Never change the template, colours, fonts, layout or footer, and never make an image
  any other way. Only the content changes: photo, badge, eyebrow, headline, 3 stats (or the
  3 list items), tip, note.
- Headlines: specific, factual, calm (no "best", "number one", no exclamation marks), one
  line in Arabic when possible (2 at most), the English line the same idea.
- Badges come from a fixed set so the feed looks consistent: new launch «إطلاق جديد ·
  New launch», under construction «قيد الإنشاء · Under construction», ready «جاهز للسكن ·
  Ready to move in», villas «فلل · Villas», citizenship «الجنسية التركية · Citizenship»,
  guides «دليل المشتري · Buyer's guide» (articles), service «خدماتنا · Our services»,
  an area of Istanbul «من إسطنبول · Istanbul life». (The 21:00 evening posts use their own
  badges, see "Evening designs".)
- Photos: sharp exterior/aerial/interior shots from `public/images/`; never a site plan,
  a bathroom or a blurry crop as the main photo.
- The first 9 grid posts made on 2026-09-29 in the older full-photo style were **not
  published** (owner's decision) — never reuse them or their style.

## Content rules (from the owner — do not break)

- **Nothing ever repeats (owner's rule 2026-10-03: «أهم شي المحتوى ما يتكرر»).** No topic,
  angle, question, true/false statement, headline or photo that was already published (see
  social/log.json) or that another post of the same day or of the plan covers. render.mjs
  checks it automatically against social/log.json: a reused `id` or headline (Arabic or
  English), a photo used by another post today or published in the last 2 days → PROBLEMS
  (fix and re-run); an older photo reuse prints a `note:` — then prefer an unused photo of
  the same project and mention the reuse in the summary. A plan topic that would repeat
  something already published → keep the plan's subject but a clearly new angle, or say so.

- **Never invent facts.** Every number, date, size, price, distance and amenity must
  come from the files above. No prices unless the project has `price` (and
  `"on-request"` = "السعر عند الطلب"); per-layout prices are in `residences[].price`.
  Any price in a post adds: VAT included, 4% title deed fee not included
  (projectDetail.priceNote). No delivery dates that are not in the data.
- **Wording:** HADARA is "your real estate partner in Istanbul" — general wording
  between development and marketing. Do **not** write "we build / we develop /
  developer" about HADARA. A project's own developer (e.g. Lotus Yapı) may be named
  as the project's developer.
- Arabic = formal MSA; English = natural and short. Same content in both.
- Citizenship / residence numbers: add the note "الشروط وفق القانون الحالي وقابلة
  للتغيير · Conditions per current law, subject to change".
- Sold-out projects (`soldOut: true`) are never promoted.
- Engineering/design service: images are illustrative concepts; never present them
  as built HADARA projects and never name another company.
- Several posts cover the same project from different angles during the month: keep to
  the post's angle (its `brief`) and never repeat an earlier headline for that project.
  The account opened on 2026-09-29 with 3 opening posts (in social/log.json): welcome
  "حضارة: شريكك العقاري في إسطنبول", projects overview "من بيليكدوزو إلى شيشلي" and
  services "معك من أول سؤال حتى سند الطابو" — never repeat their headlines. Nothing
  was published before them.
- No 4-byte emoji inside the image text. Emoji in captions are fine (like the examples).

## posts.json shape

```json
{ "posts": [ {
  "id": "lotus-yali",                     // used in utm_campaign=post-<id>
  "at": "09:00",                          // from topics.mjs when the plan has it (Istanbul time)
  // "story": true  -> the day's Story: 9:16 picture, no "caption" (see step 1)
  // "reel": true   -> a Reel: 9:16 design + an 8-second video (only when the owner asks)
  // evening post: "image": { "design": "tweet", "badge", "headlineAr", "headlineEn", "fact", "facts", "ask",
  //   "options": [ { "icon": "🌊", "ar": "إطلالة بحرية", "en": "Sea view" } ] }   (no photo, no stats)
  // or "image": { "design": "choice", "badge", "headlineAr", "headlineEn", "photo": <a.photo>,
  //   "a": { "photo", "position", "ar", "en" }, "b": { … } }
  "topic": "لوتس يالي",                    // short Arabic label shown on the page
  "image": {
    "photo": "/images/projects/lotus-yali/sunset-aerial.jpg",
    "position": "center 40%",             // CSS background-position (optional)
    "size": "cover",                      // optional, e.g. "auto 150%" to zoom
    "badge": { "ar": "جاهز للسكن", "en": "Ready to move in" },   // optional
    "place": "Lotus Yalı · Büyükçekmece",  "placeAr": "لوتس يالي · بيوكجكمجة",   // eyebrow (optional)
    "headlineAr": "…", "headlineEn": "…", "arSize": 68,  // optional; enSize optional (default arSize × 0.6)
    "stats": [ { "value": "48", "ar": "شقة", "en": "Apartments" } ],   // 3 (4 allowed)
    "tip": { "ar": "…", "en": "…", "labelAr": "معلومة" },  // gold info strip (recommended)
    "note": { "ar": "…", "en": "…" }     // optional small line under everything
    // guides: "design": "list", "items": [ { "ar": "…", "en": "…" } x3 ] instead of "stats"
  },
  "caption": {
    "ar": { "title": "… 🌊", "intro": "…", "bullets": ["🏡 …", "📍 …"],
            "closing": ["…"], "cta": "تفاصيل المشروع", "path": "/projects/lotus-yali" },
    "en": { "title": "…", "intro": "…", "bullets": ["🏡 …"], "closing": ["…"],
            "cta": "Project details", "path": "/projects/lotus-yali" },
    "hashtags": ["#LotusYali", "#Buyukcekmece"]
  }
} ] }
```

`render.mjs` builds both captions from this: blank lines between paragraphs, bullets
grouped, an invisible LTR mark on English lines (so Facebook shows English
left-aligned), the tracked site link (`utm_source=facebook|…&utm_campaign=post-<id>`)
and the WhatsApp link for Facebook; "link in bio" + the phone number for Instagram.
