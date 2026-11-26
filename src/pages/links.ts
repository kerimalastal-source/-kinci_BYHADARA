// The Instagram bio page (/links): Instagram does not make links in a post's caption clickable, so the bio
// link opens this page, where every post's topic is one tap away (owner's request 2026-11-25). Everything
// here comes from the site's own data, so it stays current without manual editing: the newest legal news,
// the newest articles and all projects with units for sale.
import { t, tRaw, link, getProjectContent, placeLine } from "../i18n";
import { lawPath, lawUpdates, sortedLawUpdates, visibleLawItems, LAWS_PAGE_LIVE } from "../data/laws";
import { blogPosts } from "../data/blog";
import { getSortedProjects } from "../data/projects";
import { WHATSAPP_NUMBER, WHATSAPP_ICON } from "../components/floatingButtons";
import { photoAttrs } from "../utils/responsiveImage";
import { formatDate, iso, type UpdateText } from "./laws";

const ARROW =
  '<svg class="links__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';

const LAWS_SHOWN = 3;
const ARTICLES_SHOWN = 4;

function mainButton(href: string, label: string, extra = ""): string {
  return `<a class="links__button${extra}" href="${href}"><span>${label}</span>${ARROW}</a>`;
}

export function renderLinks(el: HTMLElement): void {
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("links.whatsappMessage"))}`;
  const laws = LAWS_PAGE_LIVE ? sortedLawUpdates(visibleLawItems(lawUpdates, false)).slice(0, LAWS_SHOWN) : [];
  const articles = [...blogPosts].sort((a, b) => b.published.localeCompare(a.published)).slice(0, ARTICLES_SHOWN);
  const projects = getSortedProjects().filter((p) => !p.soldOut);

  el.innerHTML = `
    <section class="links-page">
      <div class="links">
        <header class="links__head">
          <img class="links__logo" src="/logo-dark.png" alt="" width="64" height="78" />
          <h1>${t("links.title")}</h1>
          <p>${t("links.subtitle")}</p>
        </header>

        <nav class="links__main" aria-label="${t("links.title")}">
          <a class="links__button links__button--whatsapp" href="${whatsapp}" target="_blank" rel="noopener">
            <span class="links__icon">${WHATSAPP_ICON}</span><span>${t("links.whatsapp")}</span>${ARROW}
          </a>
          ${mainButton(link("/projects"), t("links.projects"))}
          ${mainButton(link("/projects/marmara-haven-villa"), t("links.villa"))}
          ${mainButton(link("/citizenship"), t("links.citizenship"))}
          ${mainButton(link("/video-tour"), t("links.videoTour"))}
        </nav>

        ${
          laws.length
            ? `
        <section class="links__group">
          <h2>${t("links.latestLaws")}</h2>
          <ul class="links__list">
            ${laws
              .map((u) => {
                const text = tRaw<UpdateText>(`lawsData.updates.${u.id}`);
                return `
            <li><a class="links__item" href="${link(lawPath(u.id))}">
              <span class="links__text">
                <time datetime="${u.decided}">${formatDate(u.decided)}</time>
                <strong>${iso(text.title)}</strong>
              </span>${ARROW}
            </a></li>`;
              })
              .join("")}
          </ul>
          <a class="links__more" href="${link("/property-laws")}">${t("links.allLaws")}</a>
        </section>`
            : ""
        }

        <section class="links__group">
          <h2>${t("links.latestArticles")}</h2>
          <ul class="links__list">
            ${articles
              .map(
                (post) => `
            <li><a class="links__item links__item--thumb" href="${link(`/blog/${post.slug}`)}">
              <img ${photoAttrs(post.coverImage, "64px")} alt="" width="64" height="64" loading="lazy" />
              <span class="links__text"><strong>${tRaw<{ title: string }>(`blogData.${post.slug}`).title}</strong></span>${ARROW}
            </a></li>`
              )
              .join("")}
          </ul>
          <a class="links__more" href="${link("/blog")}">${t("links.allArticles")}</a>
        </section>

        <section class="links__group">
          <h2>${t("links.ourProjects")}</h2>
          <ul class="links__list">
            ${projects
              .map(
                (p) => `
            <li><a class="links__item links__item--thumb" href="${link(`/projects/${p.slug}`)}">
              <img ${photoAttrs(p.coverImage, "64px")} alt="" width="64" height="64" loading="lazy" />
              <span class="links__text">
                <strong>${getProjectContent(p.slug).name}</strong>
                <span>${placeLine(p.district, p.city)}</span>
              </span>${ARROW}
            </a></li>`
              )
              .join("")}
          </ul>
        </section>

        <a class="links__site" href="${link("/")}">www.hadararealestate.com</a>
      </div>
    </section>`;
}
