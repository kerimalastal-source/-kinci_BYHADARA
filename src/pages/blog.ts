import { t, tRaw, link } from "../i18n";
import { getSortedBlogPosts } from "../data/blog";

interface BlogArticleContent {
  category: string;
  title: string;
  excerpt: string;
}

export function renderBlog(el: HTMLElement): void {
  const posts = getSortedBlogPosts();

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("blog.heroEyebrow")}</p>
        <h1>${t("blog.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("blog.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="blog-grid">
          ${posts
            .map((post) => {
              const content = tRaw<BlogArticleContent>(`blogData.${post.slug}`);
              return `
              <article class="blog-card">
                <a class="blog-card__media" href="${link(`/blog/${post.slug}`)}" aria-label="${content.title}">
                  <img
                    src="${post.coverImage.src}"
                    alt="${content.title}"
                    width="${post.coverImage.width}"
                    height="${post.coverImage.height}"
                    loading="lazy"
                  />
                </a>
                <div class="blog-card__body">
                  <p class="blog-card__category">${content.category}</p>
                  <h3 class="blog-card__title">
                    <a href="${link(`/blog/${post.slug}`)}">${content.title}</a>
                  </h3>
                  <p class="blog-card__excerpt">${content.excerpt}</p>
                  <a class="btn btn--outline btn--small" href="${link(`/blog/${post.slug}`)}">
                    ${t("blog.readMore")}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </a>
                </div>
              </article>`;
            })
            .join("")}
        </div>
      </div>
    </section>
  `;
}
