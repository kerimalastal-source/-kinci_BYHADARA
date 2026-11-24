// One legal update on its own page (/property-laws/<id>), so search engines can list each
// official decision by itself (owner's rule 2026-11-25: our legal news comes from official
// government sources, so people searching for it should find it on our site).
import { t, tRaw, link } from "../i18n";
import { lawPath, lawUpdates, sortedLawUpdates, visibleLawItems, LAWS_PAGE_LIVE } from "../data/laws";
import { getBlogPostBySlug } from "../data/blog";
import { getSortedProjects } from "../data/projects";
import { renderProjectCard } from "../components/projectCard";
import { WHATSAPP_NUMBER, WHATSAPP_ICON } from "../components/floatingButtons";
import { initScrollReveal } from "../components/scrollReveal";
import { renderNotFound } from "./notFound";
import { draftBadge, formatDate, iso, topicBadge, updateDetails, type UpdateText } from "./laws";

const BACK =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';

export function renderLawDetail(el: HTMLElement, id: string): void {
  const preview = new URLSearchParams(location.search).has("preview");
  const all = sortedLawUpdates(visibleLawItems(lawUpdates, preview));
  const update = all.find((u) => u.id === id);
  if (!update || (!LAWS_PAGE_LIVE && !preview)) {
    renderNotFound(el);
    return;
  }

  const text = tRaw<UpdateText>(`lawsData.updates.${update.id}`);
  const post = update.article ? getBlogPostBySlug(update.article) : undefined;
  const postTitle = post ? tRaw<{ title: string }>(`blogData.${post.slug}`).title : "";
  const others = all.filter((u) => u.id !== update.id).slice(0, 3);
  const projects = getSortedProjects()
    .filter((p) => !p.soldOut)
    .slice(0, 3);
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("laws.whatsappMessage"))}`;

  el.innerHTML = `
    <section class="page-hero law-hero">
      <div class="container">
        <a class="back-link" href="${link("/property-laws")}">${BACK} ${t("laws.backLabel")}</a>
        <div class="law-update__badges">
          ${topicBadge(update.topic)}
          ${update.stage === "proposal" ? `<span class="law-stage">${t("laws.proposal")}</span>` : ""}
          ${draftBadge(update.approved)}
        </div>
        <h1>${iso(text.title)}</h1>
        <p class="page-hero__subtitle">${t("laws.decidedOn", { date: `<time datetime="${update.decided}">${formatDate(update.decided)}</time>` })}</p>
      </div>
    </section>

    <section class="section law-detail">
      <div class="container narrow">
        <article class="law-update__card law-detail__card">
          ${updateDetails(update, text)}
        </article>
        ${
          post
            ? `<p class="law-detail__article">${t("laws.relatedArticle")} <a href="${link(`/blog/${post.slug}`)}">${postTitle}</a></p>`
            : ""
        }
        <p class="law-detail__disclaimer">${t("laws.disclaimer")}</p>
      </div>
    </section>

    ${
      others.length
        ? `
    <section class="section law-others">
      <div class="container">
        <h2 class="section-title section-title--center">${t("laws.otherTitle")}</h2>
        <ul class="cz-laws__list">
          ${others
            .map((u, i) => {
              const other = tRaw<UpdateText>(`lawsData.updates.${u.id}`);
              return `
          <li class="cz-law" data-reveal data-reveal-index="${i}">
            <div class="cz-law__top">
              <time datetime="${u.decided}">${formatDate(u.decided)}</time>
              ${topicBadge(u.topic)}
            </div>
            <h3><a class="law-update__link" href="${link(lawPath(u.id))}${u.approved ? "" : "?preview"}">${iso(other.title)}</a></h3>
            <p class="cz-law__summary">${iso(other.summary)}</p>
          </li>`;
            })
            .join("")}
        </ul>
        <div class="cz-laws__foot">
          <a class="btn btn--outline" href="${link("/property-laws")}">${t("laws.backLabel")}</a>
        </div>
      </div>
    </section>`
        : ""
    }

    ${
      projects.length
        ? `
    <section class="section other-projects blog-related">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">${t("blog.relatedProjectsEyebrow")}</p>
            <h2 class="section-title">${t("blog.relatedProjectsTitle")}</h2>
            <p class="section-subtitle">${t("laws.projectsSubtitle")}</p>
          </div>
        </div>
        <div class="project-grid">
          ${projects.map((p) => renderProjectCard(p)).join("")}
        </div>
      </div>
    </section>`
        : ""
    }

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <div class="cz-cta__text">
          <h2 class="section-title">${t("laws.ctaTitle")}</h2>
          <p>${t("laws.ctaText")}</p>
        </div>
        <div class="cz-cta__actions">
          <a class="btn btn--primary" href="${link("/contact")}">${t("laws.ctaButton")}</a>
          <a class="btn btn--ghost" href="${whatsapp}" target="_blank" rel="noopener noreferrer">${WHATSAPP_ICON} ${t("laws.ctaWhatsapp")}</a>
        </div>
      </div>
    </section>
  `;

  initScrollReveal(el);
}
