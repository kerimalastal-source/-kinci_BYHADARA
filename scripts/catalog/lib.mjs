// Shared pieces of the print catalogues (build.mjs = all projects, villa.mjs = Marmara Haven Villa):
// loading the site's data, photos resized to JPEG, QR codes, the brand block and the PDF render.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, "../..");
export const out = path.join(here, "out");
const imgDir = path.join(out, "img");
fs.mkdirSync(imgDir, { recursive: true });

export const SITE = "https://www.hadararealestate.com";
export const YEAR = "2026";
export const PHONE = "+90 531 930 92 14";
export const EMAIL = "info@byhadara.com";
export const WHATSAPP = "https://wa.me/905319309214";
const PYTHON = process.env.PYTHON || "python3";

/** Imports a TypeScript module of the site that has no runtime imports (e.g. src/data/projects.ts). */
export async function loadTs(rel) {
  const { code } = transformSync(fs.readFileSync(path.join(root, rel), "utf8"), { loader: "ts", format: "esm" });
  const tmp = path.join(out, `${path.basename(rel, ".ts")}.tmp.mjs`);
  fs.writeFileSync(tmp, code);
  const mod = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
  fs.rmSync(tmp);
  return mod;
}

export const loadDict = (lang) => JSON.parse(fs.readFileSync(path.join(root, `src/i18n/${lang}.json`), "utf8"));
export const lookup = (dict) => (key) => key.split(".").reduce((o, k) => (o == null ? o : o[k]), dict);

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const ltr = (s) => `<bdi dir="ltr">${esc(s)}</bdi>`;
export const placeKey = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").toLowerCase();
export const num = (i) => String(i).padStart(2, "0");

const photos = new Map();
/** A site photo resized to `width` px as JPEG (WebP would be stored losslessly in the PDF). */
export function photo(webPath, width) {
  const base = webPath.replace(/^\//, "").replace(/\.[a-z]+$/i, "").replace(/[\/]/g, "_");
  const key = `${webPath}@${width}`;
  if (!photos.has(key)) photos.set(key, { src: path.join(root, "public", webPath), out: path.join(imgDir, `${base}-${width}.jpg`), width });
  return pathToFileURL(photos.get(key).out).href;
}

export function qrSvg(url, size) {
  const svg = execFileSync(PYTHON, ["-c", "import segno,sys;print(segno.make(sys.argv[1],error='m').svg_inline(scale=1,border=0,dark='#0f2b21',light=None))", url], { encoding: "utf8" });
  return svg.replace(/<svg width="(\d+)" height="(\d+)"/, (_, w, h) => `<svg viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" shape-rendering="crispEdges"`);
}

const LOGO_LIGHT = pathToFileURL(path.join(root, "public/logo-light.png")).href;
const LOGO_DARK = pathToFileURL(path.join(root, "public/logo-dark.png")).href;
export const brand = (variant) => `
  <div class="brand brand--${variant}" lang="en" dir="ltr" translate="no">
    <img src="${variant === "light" ? LOGO_LIGHT : LOGO_DARK}" alt="">
    <span><b>HADARA</b><i>REAL ESTATE</i></span>
  </div>`;

export function pageHtml(lang, title, body, cssFiles) {
  const css = cssFiles.map((f) => fs.readFileSync(path.join(here, f), "utf8")).join("\n");
  return `<!doctype html>
<html lang="${lang}" dir="${lang === "ar" || lang === "fa" ? "rtl" : "ltr"}"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Inter:wght@200;300;400;500;600;700&display=swap">
<style>${css}</style>
</head><body>${body}</body></html>`;
}

/** Resizes the photos used so far, then prints each [htmlFile, pdfFile] pair as A4 landscape. */
export async function renderPdfs(pairs) {
  const jobs = [...photos.values()].filter((p) => !fs.existsSync(p.out));
  if (jobs.length) {
    fs.writeFileSync(path.join(out, "photos.json"), JSON.stringify(jobs));
    execFileSync(PYTHON, [path.join(here, "photos.py"), path.join(out, "photos.json")], { stdio: "inherit" });
  }
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.mjs").catch(() => import("playwright"));
  const browser = await chromium.launch();
  for (const [file, pdf] of pairs) {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: pdf, width: "297mm", height: "210mm", printBackground: true, preferCSSPageSize: true });
    console.log(`${pdf} (${(fs.statSync(pdf).size / 1e6).toFixed(1)} MB)`);
    await page.close();
  }
  await browser.close();
}
