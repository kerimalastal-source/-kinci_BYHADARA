// Bundled by scripts/prerender/run.mjs (Vite SSR build) and run inside happy-dom at build time.
// Every language is registered up front, so the router renders each page synchronously.
import "../../src/i18n/all";
export { startRouter } from "../../src/router";
export { indexableRoutes } from "../../src/seo/meta";
export { localizePath, routePath } from "../../src/seo/routes";
export { locales } from "../../src/i18n/dictionaries";
