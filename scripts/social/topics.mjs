// Prints today's topics (2, or 3 in the intensive week) and the day's Story from the monthly content plan (plan.json).
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
console.log(JSON.stringify({
  date,
  plan: plan.name,
  week: day.week,
  topics: day.posts.map((p) => ({ ...p, photo: p.photos[0] })),
  // Every day also one Story, going out with the morning post (owner's request 2026-09-29).
  story: { basedOn: day.posts[0].id, id: `${day.posts[0].id}-story`, ...(day.posts[0].at ? { at: day.posts[0].at } : {}) },
}, null, 2));
