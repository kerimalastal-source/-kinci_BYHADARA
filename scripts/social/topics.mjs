// Prints today's single morning topic (owner 2026-10-25: one post a day, no Story) from the monthly content plan (plan.json).
//
//   node scripts/social/topics.mjs [YYYY-MM-DD]   (default: today in Istanbul)
//
// After the plan's last day it prints { "finished": true } — no posts are made
// until a new plan.json is written.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(fs.readFileSync(path.join(here, "plan.json"), "utf8"));
const date = process.argv[2] || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const day = plan.days.find((d) => d.date === date);

if (!day) {
  const finished = date > plan.end;
  console.log(JSON.stringify({ date, plan: plan.name, finished, notStarted: date < plan.start }, null, 2));
  process.exit(0);
}
// Owner's decision 2026-10-25: one post a day only, the morning post; no 14:00 or 21:00 post and no Story.
const morning = day.posts.find((p) => !p.at || p.at === "09:00") || day.posts[0];
console.log(JSON.stringify({
  date,
  plan: plan.name,
  week: day.week,
  note: "One post a day only (owner 2026-10-25): make this single 09:00 post, no Story.",
  topics: [{ ...morning, photo: morning.photos[0] }],
}, null, 2));
