// Vite plugin: serves each language's dictionary (src/i18n/<locale>.json) to the browser in parts,
// so a page downloads only what it shows. The JSON files stay whole on disk (the build-time SEO code,
// the prerender and the content scripts read them as they are).
//
//   virtual:i18n/core-<locale>         everything except the two heavy parts below
//   virtual:i18n/projects-<locale>     each project's long texts (PROJECT_DETAIL_KEYS), loaded on a project page and by the chat
//   virtual:i18n/blog-<locale>-<slug>  one article's body, loaded on that article's page
//   virtual:i18n/loaders               the map of dynamic imports used by src/i18n/load.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const LOCALES = ["en", "ar", "fa", "fr", "ru", "de"];
/** Fields of projectsData.<slug> that only the project page, its SEO tags and the chat's answers read. */
export const PROJECT_DETAIL_KEYS = ["longDescription", "highlights", "nearby", "floorPlan", "verified", "videoTitle", "videoText"];

const PREFIX = "virtual:i18n/";

/** After a build: "core-ar" | "projects-ar" | "blog-ar-<slug>" -> "/assets/<file>.js" (used for modulepreload links). */
export const i18nChunkFiles = {};

export function splitDictionary(dict) {
  const core = { ...dict, projectsData: {}, blogData: {} };
  const projects = {};
  const blog = {};
  for (const [slug, content] of Object.entries(dict.projectsData ?? {})) {
    core.projectsData[slug] = {};
    projects[slug] = {};
    for (const [key, value] of Object.entries(content)) {
      (PROJECT_DETAIL_KEYS.includes(key) ? projects[slug] : core.projectsData[slug])[key] = value;
    }
  }
  for (const [slug, content] of Object.entries(dict.blogData ?? {})) {
    const { body, ...rest } = content;
    core.blogData[slug] = rest;
    blog[slug] = { body };
  }
  return { core, projects, blog };
}

export function i18nSplit(root) {
  const dir = resolve(root, "src/i18n");
  const file = (locale) => resolve(dir, `${locale}.json`);
  const read = (locale) => splitDictionary(JSON.parse(readFileSync(file(locale), "utf8")));
  const asModule = (value) => `export default ${JSON.stringify(value)};`;

  return {
    name: "hadara-i18n-split",
    resolveId(id) {
      return id.startsWith(PREFIX) ? `\0${id}` : null;
    },
    load(id) {
      if (!id.startsWith(`\0${PREFIX}`)) return null;
      const key = id.slice(PREFIX.length + 1);
      for (const locale of LOCALES) this.addWatchFile(file(locale));

      if (key === "loaders") {
        const slugs = Object.keys(JSON.parse(readFileSync(file("en"), "utf8")).blogData ?? {});
        const map = (kind) => `{${LOCALES.map((l) => `${l}: () => import("${PREFIX}${kind}-${l}")`).join(", ")}}`;
        const blog = LOCALES.map(
          (l) => `${l}: {${slugs.map((s) => `${JSON.stringify(s)}: () => import("${PREFIX}blog-${l}-${s}")`).join(", ")}}`
        ).join(",\n  ");
        return `export const core = ${map("core")};\nexport const projects = ${map("projects")};\nexport const blog = {\n  ${blog}\n};\n`;
      }

      const m = key.match(/^(core|projects|blog)-(en|ar|fa|fr|ru|de)(?:-(.+))?$/);
      if (!m) return null;
      const parts = read(m[2]);
      if (m[1] === "core") return asModule(parts.core);
      if (m[1] === "projects") return asModule(parts.projects);
      return asModule(parts.blog[m[3]] ?? {});
    },
    handleHotUpdate({ file: changed, server }) {
      if (!LOCALES.some((l) => file(l) === changed)) return;
      for (const mod of server.moduleGraph.idToModuleMap.values()) {
        if (mod.id && mod.id.startsWith(`\0${PREFIX}`)) server.moduleGraph.invalidateModule(mod);
      }
      server.ws.send({ type: "full-reload" });
      return [];
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        const id = chunk.facadeModuleId ?? "";
        if (id.startsWith(`\0${PREFIX}`) && !id.endsWith("loaders")) {
          i18nChunkFiles[id.slice(PREFIX.length + 1)] = `/${chunk.fileName}`;
        }
      }
    }
  };
}
