import { t, tRaw, link, placeName } from "../i18n";
import { getBlogPostBySlug, getSortedBlogPosts, type BlogPost } from "../data/blog";
import { getProjectBySlug, getSortedProjects, type Project } from "../data/projects";
import { renderProjectCard } from "../components/projectCard";
import { renderNotFound } from "./notFound";
import { photoAttrs, heroBackground } from "../utils/responsiveImage";

interface BlogArticleContent {
  category: string;
  title: string;
  excerpt: string;
  body: string[];
}

// A body entry starting with "## " is a subheading; everything else is a paragraph.
function articleBlock(text: string): string {
  return text.startsWith("## ") ? `<h2 class="blog-detail__heading">${text.slice(3)}</h2>` : `<p>${text}</p>`;
}

// The article's chosen projects (sold-out ones skipped), topped up with the first available projects.
// A district guide shows every available project in its district instead, topped up to 3 with its
// chosen projects around it.
function relatedProjects(post: BlogPost): { projects: Project[]; inDistrict: number } {
  const chosen = (post.relatedProjects ?? [])
    .map((slug) => getProjectBySlug(slug))
    .filter((p): p is Project => !!p && !p.soldOut);
  if (post.district) {
    const here = getSortedProjects().filter((p) => !p.soldOut && p.district === post.district);
    if (here.length) {
      const picked = [...here];
      for (const p of chosen) {
        if (picked.length >= 3) break;
        if (!picked.includes(p)) picked.push(p);
      }
      return { projects: picked, inDistrict: here.length };
    }
  }
  const picked = [...chosen];
  for (const p of getSortedProjects()) {
    if (picked.length >= 3) break;
    if (!p.soldOut && !picked.includes(p)) picked.push(p);
  }
  return { projects: picked.slice(0, 3), inDistrict: 0 };
}

function renderRelatedProjects(post: BlogPost): string {
  const { projects, inDistrict } = relatedProjects(post);
  if (!projects.length) return "";
  const district = post.district && inDistrict ? placeName(post.district) : "";
  const nearby = inDistrict < projects.length;
  const title = !district
    ? t("blog.relatedProjectsTitle")
    : t(nearby ? "blog.relatedDistrictNearbyTitle" : "blog.relatedDistrictTitle").replace("{district}", district);
  const subtitle = district
    ? t(nearby ? "blog.relatedDistrictNearbySubtitle" : "blog.relatedDistrictSubtitle").replace("{district}", district)
    : t("blog.relatedProjectsSubtitle");
  const inquiry = link(`/contact?project=${projects.map((p) => p.slug).join(",")}`);
  return `
    <section class="section other-projects blog-related">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">${t("blog.relatedProjectsEyebrow")}</p>
            <h2 class="section-title">${title}</h2>
            <p class="section-subtitle">${subtitle}</p>
          </div>
          <a class="btn btn--primary" href="${inquiry}">${t("blog.relatedProjectsCta")}</a>
        </div>
        <div class="project-grid">
          ${projects.map((p) => renderProjectCard(p)).join("")}
        </div>
      </div>
    </section>`;
}

export function renderBlogDetail(el: HTMLElement, slug: string): void {
  const post = getBlogPostBySlug(slug);
  if (!post) {
    renderNotFound(el);
    return;
  }

  const content = tRaw<BlogArticleContent>(`blogData.${post.slug}`);
  const others = getSortedBlogPosts().filter((p) => p.slug !== post.slug).slice(0, 3);

  el.innerHTML = `
    <section class="project-hero" style="${heroBackground(post.coverImage, "linear-gradient(180deg, rgba(15,20,18,.35), rgba(15,20,18,.88))")}">
      <div class="container project-hero__inner">
        <a class="back-link" href="${link("/blog")}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          ${t("blog.backLabel")}
        </a>
        <span class="badge badge--ongoing">${content.category}</span>
        <h1>${content.title}</h1>
        <p class="project-hero__tagline">${content.excerpt}</p>
      </div>
    </section>

    <section class="section blog-detail">
      <div class="container narrow">
        <div class="blog-detail__article">
          ${content.body.map(articleBlock).join("")}
        </div>
      </div>
    </section>

    ${renderRelatedProjects(post)}

    ${
      others.length
        ? `
    <section class="section other-projects">
      <div class="container">
        <h2 class="section-title">${t("blog.otherArticlesTitle")}</h2>
        <div class="blog-grid">
          ${others
            .map((p) => {
              const c = tRaw<BlogArticleContent>(`blogData.${p.slug}`);
              return `
              <article class="blog-card">
                <a class="blog-card__media" href="${link(`/blog/${p.slug}`)}" aria-label="${c.title}">
                  <img ${photoAttrs(p.coverImage, "(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) 50vw, 400px")} alt="${c.title}" width="${p.coverImage.width}" height="${p.coverImage.height}" loading="lazy" />
                </a>
                <div class="blog-card__body">
                  <p class="blog-card__category">${c.category}</p>
                  <h3 class="blog-card__title"><a href="${link(`/blog/${p.slug}`)}">${c.title}</a></h3>
                  <p class="blog-card__excerpt">${c.excerpt}</p>
                  <a class="btn btn--outline btn--small" href="${link(`/blog/${p.slug}`)}">
                    ${t("blog.readMore")}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </a>
                </div>
              </article>`;
            })
            .join("")}
        </div>
      </div>
    </section>`
        : ""
    }
  `;
}
