# كاتب المدونة (weekly blog writer)

Twice a week (Monday and Friday) a scheduled Claude session writes **one new blog article in the site's 5
languages** (en, ar, fa, fr, ru) with a cover photo, and saves it as a draft **on the
owner's review page** on claude.ai (`REVIEW_URL` in `scripts/blog/config.json`):
`drafts.json` + `articles/<slug>.json` + `covers/<slug>.jpg` are published with the page.
The weekly session **cannot push to the repository** (routines have read-only access), so
it never commits. **Nothing goes live** until the owner approves; then the HADARA session
adds the article to the site (see "After approval").

## Steps for the weekly session

Work from the repository root (clone kerimalastal-source/-kinci_BYHADARA if needed).

1. `git fetch origin main claude/stoic-cray-v5g7gv` and
   `git checkout -B blog-work origin/claude/stoic-cray-v5g7gv` (or `origin/main` if that
   branch is gone). This checkout is only for reading; do not commit or push.
2. Read the page: Artifact `action: "read"`, `url` = REVIEW_URL, then
   `path: "drafts.json"` (saved locally; if it does not exist, there are no drafts).
   Run `node scripts/blog/build-review.mjs <that drafts.json>` → `pending` (new articles only;
   expansions of published articles are listed under `updates` and do not count).
   If there are **4 or more** pending drafts, write nothing: end with
   "٤ مقالات بانتظار موافقتك — لن أكتب مقالاً جديداً قبل مراجعتها."
3. Topic: the first entry of `scripts/blog/topics.json` whose `slug` is neither in
   `src/data/blog.ts` nor in `pending`. If none is left, write nothing and end with
   "انتهت قائمة مواضيع المدونة — اطلب من Claude قائمة جديدة."
4. Research **from the site's own data**: `src/data/projects.ts`, and in
   `src/i18n/en.json` / `ar.json`: `projectsData.*` (highlights, nearby, floorPlan,
   verified), `citizenship.*`, `videoTour.*`, `faq.*`, `blogData.*`. Read 2 existing
   articles in `blogData` to match the tone.
5. Write `scripts/blog/out/<slug>.json` (shape in `add-article.py`):
   - `en`, `ar`, `fa`, `fr`, `ru`, each `{category, title, excerpt, body[]}`.
   - **600–900 English words**; `body` = 7–12 entries; 2–4 of them are subheadings
     written as `"## Subheading"` (never the first entry). Every language has exactly the
     same entries in the same order (a real translation, natural in each language:
     Arabic = formal MSA, Persian = formal Persian).
   - `category`: reuse an existing category and its translations when one fits
     (see the other articles' `category` in each dictionary).
   - `title` ≤ 70 characters, `excerpt` one sentence (it is also the Google description).
   - End with a short paragraph inviting the reader to contact HADARA or book a private
     video tour (plain text, no links, no HTML, no emoji).
   - `cover.photo`: the topic's `photo` (or a better one from `public/images/projects/`),
     `cover.focus` 0–1 = which part of the height to keep (0 top, 0.5 middle, 1 bottom).
6. `python3 scripts/blog/add-article.py scripts/blog/out/<slug>.json --draft` must print
   `draft ok` (fix and re-run otherwise). Look at `scripts/blog/out/<slug>.jpg` once.
7. `node scripts/blog/build-review.mjs <drafts.json from step 2> --add scripts/blog/out/<slug>.json`
   → publish with the Artifact tool: `url` = REVIEW_URL, `file_path` and `files` exactly as
   printed. Never create a new artifact.

## After approval (HADARA session only)

Owner says "انشر المقال …": Artifact read `path: "articles/<slug>.json"` from REVIEW_URL →
`python3 scripts/blog/add-article.py <that file>` on the working branch → `npm run build`
+ visual check (AR/EN, phone/desktop) → commit → then read `drafts.json` and republish the
page with `node scripts/blog/build-review.mjs <drafts.json>` (published drafts drop off).
The article goes live with the next "انشر" to `main`.

## Expanding a published article (HADARA session)

The ten original articles were short; their longer versions keep the same slug and cover.
Write `scripts/blog/out/expand/<slug>.json` (same shape, no `cover`), check it with
`python3 scripts/blog/add-article.py <file> --replace --draft` (copies the current cover next to
it), and add it to the review page with `build-review.mjs <drafts.json> --add <file>` (shown as
"توسيع مقال منشور"). After approval: `add-article.py <file> --replace` replaces `blogData.<slug>`
in the five dictionaries; the draft leaves the page once the site's text matches it.

## Content rules (from the owner — do not break)

- **Never invent facts.** Numbers, sizes, distances, dates, prices and legal values
  only from the site's data. General, well-established knowledge is fine (what a title
  deed is, what 2+1 means) but **no figures that are not on the site** (no fees,
  percentages, yields, prices, deadlines, population numbers).
- Legal topics (citizenship, residence, tax): use the site's values and add
  "the conditions are per current law and may change" (in each language).
- HADARA is "your real estate partner in Istanbul": never "we build / we develop /
  developer". A project's own developer (e.g. Lotus Yapı) may be named as such.
- No sold-out projects (`soldOut: true`) as recommendations.
- No remote-purchase promises: the video tour helps choose; buying happens on a visit.
- No HTML, no links, no emoji inside the article text.
- Never commit, push, deploy or change the site from the weekly session.
