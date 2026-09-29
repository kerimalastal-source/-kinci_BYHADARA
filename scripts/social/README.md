# منشورات حضارة اليومية (Daily social posts)

Every morning a scheduled Claude session prepares **2 posts** (one image + one Facebook
caption + one Instagram caption each) for the HADARA Real Estate Facebook page and
Instagram account, and publishes them to the team's page on claude.ai:

**Artifact:** see `ARTIFACT_URL` in `scripts/social/config.json`.

Nothing is posted to Facebook/Instagram automatically — the owner reviews the page,
then posts or schedules them in Meta Business Suite.

## Steps for the daily session

Work from the repository root. Use Istanbul's date (`TZ=Europe/Istanbul date +%F`).

1. `node scripts/social/topics.mjs` → today's 2 topics from the monthly content plan
   (`plan.json`: one entry per day, a weekly theme, 2 posts with `label`, `brief`,
   `path` and suggested `photos`). Use each topic's `id` as the post `id` and its
   `label` as the post `topic`; let the week's theme colour the wording.
   **If it prints `"finished": true`, the month is over: make no posts, publish
   nothing, and end with the Arabic summary "انتهت خطة المحتوى لهذا الشهر — حان وقت
   مراجعة النتائج ووضع خطة جديدة مع Claude."** (`notStarted` → also make no posts.)
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
   It must print `ok` for every post — fix any PROBLEMS (shorter text, `arSize`
   44–48) and re-run. Then Read each `post-<n>.jpg` once to check it visually.
5. Read the published page's `days.json` with the Artifact tool
   (`action: "read"`, `url` = ARTIFACT_URL, `path: "days.json"`), then run
   `node scripts/social/build-page.mjs <date> <that local days.json>`.
   It prints `file_path` and `files`; publish them with the Artifact tool
   (`url` = ARTIFACT_URL, `file_path`, `files`) — read the page first
   (`action: "read"`, `url`) so the publish is accepted.
6. Do not commit or push anything (outputs are git-ignored).

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
  Already published before the plan (don't copy them): intro "شريكك العقاري في إسطنبول",
  Marmara Haven Villa overview, Diamond Marin overview, citizenship basics, video tour.
- No 4-byte emoji inside the image text. Emoji in captions are fine (like the examples).

## posts.json shape

```json
{ "posts": [ {
  "id": "lotus-yali",                     // used in utm_campaign=post-<id>
  "topic": "لوتس يالي",                    // short Arabic label shown on the page
  "image": {
    "photo": "/images/projects/lotus-yali/sunset-aerial.jpg",
    "position": "center 40%",             // CSS background-position (optional)
    "size": "cover",                      // optional, e.g. "auto 150%" to zoom
    "badge": { "ar": "جاهز للسكن", "en": "Ready to move in" },   // optional
    "place": "Lotus Yalı · Büyükçekmece, Istanbul",              // optional caption on the photo
    "headlineAr": "…", "headlineEn": "…", "arSize": 52,
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
