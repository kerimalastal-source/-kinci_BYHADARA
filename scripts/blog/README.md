# كاتب المدونة (weekly blog writer)

Once a week a scheduled Claude session writes **one new blog article in the site's 5
languages** (en, ar, fa, fr, ru) with a cover photo, commits it to the branch
`claude/blog-drafts` and updates the owner's review page on claude.ai
(`REVIEW_URL` in `scripts/blog/config.json`). **Nothing goes live** until the owner
approves the article and it is merged into `main` from the HADARA session.

## Steps for the weekly session

Work from the repository root.

1. Branch:
   ```
   git fetch origin main claude/stoic-cray-v5g7gv claude/blog-drafts   # the last two may not exist
   git checkout -B claude/blog-drafts origin/claude/blog-drafts   # if it exists, otherwise:
   git checkout -B claude/blog-drafts origin/claude/stoic-cray-v5g7gv   # (or origin/main)
   git merge --no-edit origin/main
   git merge --no-edit origin/claude/stoic-cray-v5g7gv   # only if that branch exists
   ```
   On a merge conflict: `git merge --abort`, write nothing, and report it.
2. Count pending drafts: `node scripts/blog/build-review.mjs` → `pending`. If there are
   already **4 or more**, write nothing new: just publish the review page (step 7) and end
   with "٤ مقالات بانتظار موافقتك — لن أكتب مقالاً جديداً قبل مراجعتها."
3. Topic: the first entry of `scripts/blog/topics.json` whose `slug` is not in
   `src/data/blog.ts`. If none is left, write nothing and end with
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
6. `python3 scripts/blog/add-article.py scripts/blog/out/<slug>.json`, then
   `npm ci` (if `node_modules` is missing) and `npm run build` — it must pass. Look at
   `public/images/blog/<slug>.jpg` once. Commit only the article files:
   `git add src/data/blog.ts src/i18n/*.json public/images/blog/<slug>*` →
   commit "Blog draft: <English title>" → `git push -u origin claude/blog-drafts`.
7. `node scripts/blog/build-review.mjs` → publish with the Artifact tool:
   read `REVIEW_URL` first (`action: "read"`), then publish `file_path` + `files` with
   `url` = REVIEW_URL. Never create a new artifact.

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
- Do not touch `main`, do not deploy, do not change anything else on the site.
