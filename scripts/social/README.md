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
   In the intensive week the three times have three roles: **09:00 a project**, **14:00
   useful information** (article, citizenship, FAQ, a site tool), **21:00 something
   lighter** (an area of Istanbul, a question to followers, a service) — follow the brief.
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
   It must print `ok` for every post (2 or 3, plus the Story) — fix any PROBLEMS (shorter text, `arSize`
   44–48) and re-run. Then Read each `post-<n>.jpg` once to check it visually.
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

## Design (approved by the owner 2026-09-29 — locked)

Every post uses the **one approved template** that `render.mjs` draws ("design A"):
photo on top, dark green (`#0f2b21`) panel below, the HADARA logo top-left, a gold pill
badge top-right (Arabic · English), **the Arabic headline and the English headline at the
same weight, separated by a thin gold line** (Arabic right-aligned, English left-aligned,
each on one line), **exactly 4 stat tiles** (gold number, Arabic label, English label of
equal prominence), and the footer: www.hadararealestate.com + WhatsApp +90 531 930 92 14.
1080×1350 JPEG.

- **Always bilingual, both languages equal (owner's rule 2026-09-29)**: every image has the
  full message in Arabic and in English; every caption has a complete Arabic part, then
  the divider `━━━━━━━━  English  ━━━━━━━━`, then a complete English part (render.mjs does
  this). Never a post in one language only, never the English as a small afterthought.

- Never change the template, colours, fonts, layout or footer, and never make an image
  any other way. Only the content changes: photo, badge, headline, 4 stats, note.
- Headlines: short, factual, calm (no "best", "number one", no exclamation marks), at
  most one line in Arabic when possible (`arSize` 44–52), the English line the same idea.
- Badges come from a fixed set so the feed looks consistent: new launch «إطلاق جديد ·
  New launch», under construction «قيد الإنشاء · Under construction», ready «جاهز للسكن ·
  Ready to move in», villas «فلل · Villas», citizenship «الجنسية التركية · Citizenship»,
  guides «دليل المشتري · Buyer's guide» (articles), service «خدماتنا · Our services»,
  an area of Istanbul «من إسطنبول · Istanbul life», a question to followers «سؤال لكم ·
  Your pick» (the evening posts).
- Photos: sharp exterior/aerial/interior shots from `public/images/`; never a site plan,
  a bathroom or a blurry crop as the main photo.
- The first 9 grid posts made on 2026-09-29 in the older full-photo style were **not
  published** (owner's decision) — never reuse them or their style.

## Content rules (from the owner — do not break)

- **Never invent facts.** Every number, date, size, price, distance and amenity must
  come from the files above. No prices unless the project has `price` (and
  `"on-request"` = "السعر عند الطلب"). No delivery dates that are not in the data.
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
  "topic": "لوتس يالي",                    // short Arabic label shown on the page
  "image": {
    "photo": "/images/projects/lotus-yali/sunset-aerial.jpg",
    "position": "center 40%",             // CSS background-position (optional)
    "size": "cover",                      // optional, e.g. "auto 150%" to zoom
    "badge": { "ar": "جاهز للسكن", "en": "Ready to move in" },   // optional
    "place": "Lotus Yalı · Büyükçekmece, Istanbul",              // optional caption on the photo
    "headlineAr": "…", "headlineEn": "…", "arSize": 52,  // enSize optional (default arSize × 0.8)
    "stats": [ { "value": "48", "ar": "شقة", "en": "Apartments" } ],   // exactly 4
    "note": { "ar": "…", "en": "…" }     // optional small line under the stats
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
