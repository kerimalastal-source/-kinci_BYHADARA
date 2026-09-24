import { defineConfig, type Plugin } from "vite";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildMeta, indexableRoutes, renderHeadTags, isRtlLocale, DEFAULT_SITE_URL } from "./src/seo/meta";
import { localizePath, routePath } from "./src/seo/routes";
import { locales } from "./src/i18n/dictionaries";

/**
 * After the build, writes one HTML file per indexable page and locale (e.g. dist/ar/projects/index.html)
 * with that page's title, meta description, canonical, hreflang, Open Graph and JSON-LD already in <head>,
 * so crawlers and link previews see them without running JavaScript. Also writes sitemap.xml and robots.txt.
 */
function seoPrerender(): Plugin {
  let outDir = "dist";
  return {
    name: "hadara-seo-prerender",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const siteUrl = (process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
      const template = readFileSync(resolve(outDir, "index.html"), "utf8");
      const today = new Date().toISOString().slice(0, 10);
      const sitemapEntries: string[] = [];

      for (const route of indexableRoutes()) {
        for (const locale of locales) {
          const meta = buildMeta(route, locale, siteUrl);
          const html = template
            .replace(/<html[^>]*>/, `<html lang="${locale}" dir="${isRtlLocale(locale) ? "rtl" : "ltr"}">`)
            .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeXml(meta.title)}</title>\n    ${renderHeadTags(meta)}`);

          const path = localizePath(routePath(route), locale);
          const file = resolve(outDir, path === "/" ? "index.html" : `${path.slice(1)}/index.html`);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, html);

          sitemapEntries.push(
            [
              "  <url>",
              `    <loc>${escapeXml(meta.canonical)}</loc>`,
              `    <lastmod>${today}</lastmod>`,
              ...meta.alternates.map(
                (a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`
              ),
              "  </url>"
            ].join("\n")
          );
        }
      }

      writeFileSync(
        resolve(outDir, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemapEntries.join("\n")}\n</urlset>\n`
      );

      writeFileSync(
        resolve(outDir, "robots.txt"),
        [
          "User-agent: *",
          "Allow: /",
          "Disallow: /account",
          "Disallow: /admin",
          ...locales.filter((l) => l !== "en").flatMap((l) => [`Disallow: /${l}/account`, `Disallow: /${l}/admin`]),
          "",
          `Sitemap: ${siteUrl}/sitemap.xml`,
          ""
        ].join("\n")
      );
    }
  };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default defineConfig({
  // Absolute asset URLs so pages under nested paths (/ar/projects/...) load the same bundle.
  base: "/",
  plugins: [seoPrerender()],
  build: {
    outDir: "dist",
    assetsDir: "assets"
  }
});
