// Prints today's topics for the daily social posts (rotation from topics.json).
//
//   node scripts/social/topics.mjs [YYYY-MM-DD]   (default: today in Istanbul)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { start, perDay, topics } = JSON.parse(fs.readFileSync(path.join(here, "topics.json"), "utf8"));
const date = process.argv[2] || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
const day = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000);
const first = day * perDay;
const cycle = Math.floor(first / topics.length);

const picked = Array.from({ length: perDay }, (_, i) => {
  const t = topics[(first + i) % topics.length];
  return { ...t, cycle, photo: t.photos[cycle % t.photos.length] };
});
console.log(JSON.stringify({ date, day, cycle, topics: picked }, null, 2));
