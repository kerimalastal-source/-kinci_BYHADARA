import { t, tRaw } from "../i18n";
import { getBlogPostBySlug, getSortedBlogPosts } from "../data/blog";
import { renderNotFound } from "./notFound";

interface BlogArticleContent {
  category: string;
  title: string;
  excerpt: string;
  body: string[];
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
    <section class="project-hero" style="background-image: linear-gradient(180deg, rgba(15,20,18,.35), rgba(15,20,18,.88)), url('${post.coverImage.src}')">
      <div class="container project-hero__inner">
        <a class="back-link" href="#/blog">
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
          ${content.body.map((paragraph) => `<p>${paragraph}</p>`).join("")}
        </div>
      </div>
    </section>

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
                <a class="blog-card__media" href="#/blog/${p.slug}" aria-label="${c.title}">
                  <img src="${p.coverImage.src}" alt="${c.title}" width="${p.coverImage.width}" height="${p.coverImage.height}" loading="lazy" />
                </a>
                <div class="blog-card__body">
                  <p class="blog-card__category">${c.category}</p>
                  <h3 class="blog-card__title"><a href="#/blog/${p.slug}">${c.title}</a></h3>
                  <p class="blog-card__excerpt">${c.excerpt}</p>
                  <a class="btn btn--outline btn--small" href="#/blog/${p.slug}">
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
