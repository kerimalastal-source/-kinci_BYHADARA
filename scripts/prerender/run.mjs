/**
 * Puts each indexable page's real content into its HTML file (dist/ar/projects/index.html ...),
 * so search engines read the text without running JavaScript.
 *
 * Runs after `vite build` (which already wrote one file per page and locale with the <head> tags):
 * the app's own router renders every page inside happy-dom, and the markup goes into <div id="app">.
 * It is hidden ([data-prerendered] { visibility: hidden }) until the app starts and renders the page
 * again, so visitors see exactly what they saw before; crawlers that skip JavaScript get the text.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const dist = resolve(root, "dist");
const tmp = resolve(root, ".prerender");
const HIDE = "<style>[data-prerendered]{visibility:hidden}</style>";

await build({
  root,
  configFile: false,
  logLevel: "warn",
  // Never reach the real database while building; pages that load data render their empty state.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://127.0.0.1:9"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("prerender")
  },
  build: { ssr: resolve(here, "entry.ts"), outDir: tmp, emptyOutDir: true, minify: false }
});

// The real address, so links that carry the page URL (e.g. WhatsApp messages) are right.
// No network at all: no iframes (the contact map), scripts, styles or navigation are fetched,
// and fetch/sendBeacon are switched off below (visitor tracker, data requests).
const siteUrl = (process.env.VITE_SITE_URL || "https://www.hadararealestate.com").replace(/\/$/, "");
GlobalRegistrator.register({
  url: `${siteUrl}/`,
  width: 1280,
  height: 800,
  settings: {
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    disableIframePageLoading: true,
    handleDisabledFileLoadingAsSuccess: true,
    navigation: { disableChildFrameNavigation: true, disableChildPageNavigation: true, disableMainFrameNavigation: true }
  }
});
window.fetch = globalThis.fetch = () => Promise.reject(new Error("offline at build time"));
navigator.sendBeacon = () => false;
process.on("unhandledRejection", () => {}); // data requests that fail offline
const quiet = console.error;
console.error = () => {}; // e.g. "Supabase env vars missing" when built without them
const app = await import(pathToFileURL(resolve(tmp, "entry.js")).href);

const container = document.createElement("div");
container.id = "app";
document.body.appendChild(container);

let started = false;
let count = 0;
const empty = [];
for (const route of app.indexableRoutes()) {
  for (const locale of app.locales) {
    const path = app.localizePath(app.routePath(route), locale);
    history.replaceState(null, "", path);
    if (!started) {
      app.startRouter(container);
      started = true;
    } else {
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    const shell = container.querySelector(".site-shell");
    const main = container.querySelector("#main-content");
    if (!shell || !main || main.textContent.trim().length < 200) empty.push(path);
    shell.setAttribute("data-prerendered", "");
    const markup = container.innerHTML.trim();

    const file = resolve(dist, path === "/" ? "index.html" : `${path.slice(1)}/index.html`);
    if (!existsSync(file)) throw new Error(`prerender: missing ${file}`);
    const html = readFileSync(file, "utf8");
    if (!html.includes('<div id="app"></div>')) throw new Error(`prerender: no empty #app in ${file}`);
    writeFileSync(
      file,
      html.replace("</head>", `  ${HIDE}\n  </head>`).replace('<div id="app"></div>', () => `<div id="app">${markup}</div>`)
    );
    count++;
  }
}

console.error = quiet;
rmSync(tmp, { recursive: true, force: true });
if (empty.length) {
  console.error(`prerender: pages with almost no text: ${empty.join(", ")}`);
  process.exit(1);
}
console.log(`prerender: ${count} pages`);
process.exit(0);
