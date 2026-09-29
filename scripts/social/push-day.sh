#!/usr/bin/env bash
# Pushes one day's posts to the `social-posts` branch so the website publishes them
# (api/social-publish.ts reads public/social/<date>/ from that branch's Vercel build at
# 10:00 Istanbul). Run from the repository root after render.mjs printed "ok":
#
#   bash scripts/social/push-day.sh 2026-09-30
#
# It never touches main or the current checkout: it works in a separate worktree
# (../social-posts-worktree), merges main into social-posts first, copies post-<n>.jpg and
# post-<n>.json from scripts/social/out/<date>/, writes day.json (the order of the posts),
# appends the day to social/log.json (every post ever published, never pruned), deletes day
# folders older than 21 days, and commits as the owner (Vercel's free plan only
# builds commits by the account owner).
set -euo pipefail

DATE="${1:?usage: bash scripts/social/push-day.sh <YYYY-MM-DD>}"
[[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "bad date: $DATE" >&2; exit 1; }
ROOT="$(git rev-parse --show-toplevel)"
OUT="$ROOT/scripts/social/out/$DATE"
WT="$(dirname "$ROOT")/social-posts-worktree"
OWNER_NAME="kerimalastal-source"
OWNER_EMAIL="kerim.alastal@gmail.com"

shopt -s nullglob
images=("$OUT"/post-*.jpg)
posts=("$OUT"/post-*.json)
[ ${#images[@]} -gt 0 ] && [ ${#images[@]} -eq ${#posts[@]} ] || { echo "no rendered posts in $OUT (run render.mjs first)" >&2; exit 1; }

cd "$ROOT"
# Enough history for the merge (the clone may be shallow).
git fetch --depth=500 origin main
git fetch --depth=500 origin social-posts || true

git worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"
git worktree prune
if git rev-parse --verify -q origin/social-posts >/dev/null; then
  git worktree add -B social-posts "$WT" origin/social-posts
else
  git worktree add -B social-posts "$WT" origin/main
fi
cd "$WT"
export GIT_AUTHOR_NAME="$OWNER_NAME" GIT_AUTHOR_EMAIL="$OWNER_EMAIL" GIT_COMMITTER_NAME="$OWNER_NAME" GIT_COMMITTER_EMAIL="$OWNER_EMAIL"

# The branch build is the whole site: keep it on main's latest code.
git merge --no-edit origin/main

DEST="public/social/$DATE"
rm -rf "$DEST"
mkdir -p "$DEST"
cp "${images[@]}" "${posts[@]}" "$DEST/"
videos=("$OUT"/post-*.mp4)
[ ${#videos[@]} -gt 0 ] && cp "${videos[@]}" "$DEST/"
# day.json: the posts in order (post-1, post-2, …).
node -e '
  const fs = require("fs");
  const [dest, date] = process.argv.slice(1);
  const posts = fs.readdirSync(dest).filter((f) => /^post-\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
  for (const f of posts) {
    const p = JSON.parse(fs.readFileSync(`${dest}/${f}`, "utf8"));
    if (!p.fb || !p.ig || !fs.existsSync(`${dest}/${p.image}`)) throw new Error(`${f}: missing fb, ig or image`);
    if (p.video && !fs.existsSync(`${dest}/${p.video}`)) throw new Error(`${f}: missing video ${p.video}`);
  }
  fs.writeFileSync(`${dest}/day.json`, JSON.stringify({ date, posts }, null, 2) + "\n");
  console.log(`day.json: ${posts.join(", ")}`);
' "$DEST" "$DATE"

# The permanent log of everything published (never pruned), so no headline or angle is
# repeated: social/log.json on this branch, started from scripts/social/log-seed.json.
node -e '
  const fs = require("fs");
  const [log, seed, spec, date] = process.argv.slice(1);
  const entries = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8")) : JSON.parse(fs.readFileSync(seed, "utf8"));
  const posts = JSON.parse(fs.readFileSync(spec, "utf8"));
  const today = (Array.isArray(posts) ? posts : posts.posts).map((p) => ({
    date, id: p.id, topic: p.topic, headlineAr: p.image?.headlineAr ?? "", headlineEn: p.image?.headlineEn ?? "", photo: p.image?.photo ?? ""
  }));
  // Replace only the posts of this push (a day can be pushed twice, e.g. extra Reels later that day).
  const ids = new Set(today.map((e) => e.id));
  const kept = entries.filter((e) => !(e.date === date && ids.has(e.id)));
  fs.mkdirSync(require("path").dirname(log), { recursive: true });
  fs.writeFileSync(log, JSON.stringify([...kept, ...today], null, 2) + "\n");
  console.log(`social/log.json: ${kept.length + today.length} posts`);
' social/log.json "$ROOT/scripts/social/log-seed.json" "$OUT/posts.json" "$DATE"

# Keep three weeks of days.
CUTOFF="$(node -e 'const d = new Date(process.argv[1] + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 21); console.log(d.toISOString().slice(0, 10))' "$DATE")"
for dir in public/social/*/; do
  day="$(basename "$dir")"
  if [[ "$day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && [[ "$day" < "$CUTOFF" ]]; then
    git rm -rq "$dir" 2>/dev/null || rm -rf "$dir"
    echo "removed $day"
  fi
done

git add public/social social/log.json
if git diff --cached --quiet; then
  echo "nothing new to push for $DATE"
else
  git commit -q -m "Social posts for $DATE"
fi
git push origin social-posts
echo "pushed social-posts: public/social/$DATE"
