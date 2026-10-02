# مراقب القوانين والسوق (weekly Property Laws monitor)

Once a week (Thursday morning, Istanbul) a scheduled Claude session looks for **new
Turkish legal decisions that matter to people buying, owning or renting property**, and
saves each one as a draft **on the owner's review page** (`REVIEW_URL` in
`scripts/laws/config.json`): `drafts.json` + `drafts/<id>.json`. The weekly session
**cannot push to the repository** (routines are read-only), so it never commits.
**Nothing goes live** until the owner approves; then the HADARA session adds it to the
site (see "After approval").

The page itself: `/property-laws` (`src/data/laws.ts` + `lawsData` in the dictionaries,
`src/pages/laws.ts`). Topics: `citizenship`, `residence`, `ownership` (buying & owning),
`taxes` (taxes & fees), `rent` (renting & tenant rights).

## Sources — the owner's strict rule

- **Only Turkish government or official sources**: Resmî Gazete, mevzuat.gov.tr, TKGM,
  GİB, Göç İdaresi, NVİ, ministries (Çevre Şehircilik, Ticaret, Hazine ve Maliye,
  Adalet), TBMM, TÜİK — `OFFICIAL_DOMAINS` in config.json. Every source link must be an
  `https://….gov.tr` address (`add-law.py --check` refuses anything else).
- **Never** a news site, social media, real estate agency, law firm or blog, not even as
  a helper source to find the official one.
- Every item carries the link to its official source. **No official link = no item.**
- Search with `WebSearch` and `allowed_domains` = OFFICIAL_DOMAINS. Opening the
  government sites directly is usually blocked in this environment, so the search
  summary may be all you have: write only what the official result clearly states, and
  put anything you could not confirm in `verify` (the owner opens the link and checks).

## Steps for the weekly session

Work from the repository root (clone kerimalastal-source/-kinci_BYHADARA if needed).

1. `git fetch origin main claude/stoic-cray-v5g7gv` and
   `git checkout -B laws-work origin/main` if `src/data/laws.ts` exists on main, otherwise
   `origin/claude/stoic-cray-v5g7gv`. Read-only: never commit or push.
   Then `npm ci` (build-review.mjs needs esbuild from node_modules).
2. Read the review page: Artifact `action: "read"`, `url` = REVIEW_URL, then
   `path: "drafts.json"` (saved locally) and, for each id in it, `path: "drafts/<id>.json"`
   into a `drafts/` folder next to it. Run
   `node scripts/laws/build-review.mjs <that drafts.json>` → `pending`.
   If **10 or more** items are pending, search nothing new: end with
   "١٠ بنود قانونية بانتظار موافقتك — لن أضيف جديداً قبل مراجعتها."
3. Know what is already covered: every `id`, `reference` and date in
   `src/data/laws.ts`, and the pending drafts. Never add the same decision twice.
4. Search the official domains for decisions published **since the newest `checked`
   date in laws.ts and the drafts** (first run: the last two years). Useful searches
   (Turkish works best), each with `allowed_domains`:
   - Resmî Gazete: "yabancı taşınmaz edinimi", "Türk vatandaşlığı yönetmelik değişiklik",
     "ikamet izni yönetmelik", "tapu harcı", "emlak vergisi", "değerli konut vergisi",
     "kira artışı Türk Borçlar Kanunu", "kat mülkiyeti", "taşınmaz ticareti yönetmeliği",
     "kentsel dönüşüm", "konut KDV".
   - TKGM duyurular (yabancı işler), GİB duyurular/rehberler, Göç İdaresi duyurular
     (mahalle kapatma, ikamet), NVİ vatandaşlık, TBMM kanun teklifleri (only bills that
     clearly affect housing; mark them `stage: "proposal"`).
   Keep only what affects a person who buys, owns, sells or rents a home in Turkey,
   especially foreigners. At most **5 new drafts** per run (most important first).
5. "Market" check: compare what you found with the figures the site already shows
   (`citizenship.*` in `src/i18n/en.json`: 400,000 USD, 3-year hold, 200,000/100,000 USD
   residence, 4% title deed fee, and the rules in laws.ts). If an official decision
   changes any of them, say so in that draft's `verify` and in the summary.
6. For each new item write `scripts/laws/out/<id>.json` (shape in
   `scripts/laws/add-law.py`): `kind` "update" (a dated decision) or "rule" (a change to
   "the current rules in short"), `topic`, `decided`, optional `effective`, `reference`
   (the official Turkish reference: law/regulation name or number, Resmî Gazete date and
   number), `sources`, `checked` = today, `verify` (Arabic, in the owner's simple
   Levantine style: exactly what to check on the official page), and `text` in **en, ar,
   fa, fr, ru** with the same keys (update: `title`, `summary`, optional `before`,
   `after`, `affects`, `help`; rule: `title`, `text`). Match the tone of the existing
   items in `lawsData`: short, factual, formal (Arabic = MSA, Persian = formal); `help` =
   one sentence on how HADARA's team helps, without promises (no legal representation, no
   remote purchase). Then `python3 scripts/laws/add-law.py scripts/laws/out/<id>.json --check`
   must print `check ok`.
7. `node scripts/laws/build-review.mjs <drafts.json from step 2> --add scripts/laws/out/<id>.json [--add …]`
   → publish with the Artifact tool: `url` = REVIEW_URL, `file_path` and `files` exactly as
   printed. Never create a new artifact.
8. Summary in Arabic (simple Levantine): how many new items, their titles and dates, or
   "ما في قرارات رسمية جديدة هالأسبوع". Nothing found → do not republish.

## After approval (HADARA session only)

The owner says "موافق على …" (or asks for an edit / deletion):
- Items already in `src/data/laws.ts` (the first batch): set `approved: true`.
- Monitor drafts: Artifact read `path: "drafts/<id>.json"` from REVIEW_URL →
  `python3 scripts/laws/add-law.py <file>` (adds it approved).
- First approval: set `LAWS_PAGE_LIVE = true` in `src/data/laws.ts` (menu link under
  Resources, sitemap, prerendered pages).
- `npm run build` + visual check (AR/EN, phone/desktop) → commit on the side branch →
  read `drafts.json` and republish the review page with
  `node scripts/laws/build-review.mjs <drafts.json>` (approved items drop off) → live with
  the next "انشر".
