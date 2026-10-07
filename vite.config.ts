import { defineConfig, type Plugin } from "vite";
import "./src/i18n/all";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildMeta, indexableRoutes, renderHeadTags, isRtlLocale, DEFAULT_SITE_URL } from "./src/seo/meta";
import { localizePath, routePath, type Route } from "./src/seo/routes";
import { projects } from "./src/data/projects";
import { blogPosts } from "./src/data/blog";
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

      // Each language's dictionary is its own chunk (src/i18n/load.ts); every page asks for its own
      // one right away instead of after the main script has run.
      const dictChunks = Object.fromEntries(
        readdirSync(resolve(outDir, "assets"))
          .map((file) => file.match(/^(en|ar|fa|fr|ru)-[\w-]+\.js$/))
          .filter((m): m is RegExpMatchArray => Boolean(m))
          .map((m) => [m[1], `/assets/${m[0]}`])
      );
      const preload = (locale: string) =>
        dictChunks[locale] ? `<link rel="modulepreload" crossorigin href="${dictChunks[locale]}">\n    ` : "";

      for (const route of indexableRoutes()) {
        for (const locale of locales) {
          const meta = buildMeta(route, locale, siteUrl);
          const html = template
            .replace(/<html[^>]*>/, `<html lang="${locale}" dir="${isRtlLocale(locale) ? "rtl" : "ltr"}">`)
            .replace(
              /<title>[\s\S]*?<\/title>/,
              () => `${preload(locale)}<title>${escapeXml(meta.title)}</title>\n    ${renderHeadTags(meta)}`
            );

          const path = localizePath(routePath(route), locale);
          const file = resolve(outDir, path === "/" ? "index.html" : `${path.slice(1)}/index.html`);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, html);

          sitemapEntries.push(
            [
              "  <url>",
              `    <loc>${escapeXml(meta.canonical)}</loc>`,
              `    <lastmod>${lastModified(route) ?? today}</lastmod>`,
              ...meta.alternates.map(
                (a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`
              ),
              ...pageImages(route).map((src) => `    <image:image><image:loc>${escapeXml(siteUrl + src)}</image:loc></image:image>`),
              "  </url>"
            ].join("\n")
          );
        }
      }

      writeFileSync(
        resolve(outDir, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${sitemapEntries.join("\n")}\n</urlset>\n`
      );

      // Unknown addresses get a real 404 (vercel.json only sends app-only pages such as /login or /admin to the app);
      // the app still renders its "page not found" view from the URL.
      const notFound = buildMeta({ name: "not-found" }, "en", siteUrl);
      writeFileSync(
        resolve(outDir, "404.html"),
        template.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeXml(notFound.title)}</title>\n    ${renderHeadTags(notFound)}`)
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

/** An article's own date (last rewrite, else first publication) for the sitemap; other pages use the build date. */
function lastModified(route: Route): string | undefined {
  if (route.name !== "blog-post") return undefined;
  const post = blogPosts.find((p) => p.slug === route.slug);
  return post ? (post.updated ?? post.published) : undefined;
}

/** The photos shown on a page, listed in the sitemap so they can appear in Google Images. */
function pageImages(route: Route): string[] {
  const local = (src: string) => src.startsWith("/");
  if (route.name === "project") {
    const project = projects.find((p) => p.slug === route.slug);
    return project ? [project.coverImage, ...project.gallery].map((g) => g.src).filter(local) : [];
  }
  if (route.name === "blog-post") {
    const post = blogPosts.find((p) => p.slug === route.slug);
    return post && local(post.coverImage.src) ? [post.coverImage.src] : [];
  }
  return [];
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
