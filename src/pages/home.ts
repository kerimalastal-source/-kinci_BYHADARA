import { t, tRaw, link } from "../i18n";
import { getSortedProjects } from "../data/projects";
import { partners } from "../data/partners";
import { renderProjectCard } from "../components/projectCard";
import { initStatCounters } from "../components/statCounter";
import { initScrollReveal } from "../components/scrollReveal";
import { wixImg } from "../utils/image";

const HERO_IMAGE = "/hero-istanbul.jpg";

interface StatItem {
  value: string;
  label: string;
}
interface ServiceItem {
  title: string;
  desc: string;
}

export function renderHome(el: HTMLElement): void {
  const stats = tRaw<StatItem[]>("home.stats");
  const services = tRaw<ServiceItem[]>("home.services");
  const why = tRaw<ServiceItem[]>("home.why");
  const featured = getSortedProjects().slice(0, 3);

  el.innerHTML = `
    <section class="hero" style="background-image: linear-gradient(180deg, rgba(15,20,18,.55), rgba(15,20,18,.82)), url('${HERO_IMAGE}')">
      <div class="container hero__inner">
        <p class="eyebrow eyebrow--on-dark">${t("home.heroEyebrow")}</p>
        <h1 class="hero__title">${t("home.heroTitle")}</h1>
        <p class="hero__subtitle">${t("home.heroSubtitle")}</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="${link("/projects")}">${t("home.heroCtaPrimary")}</a>
          <a class="btn btn--ghost" href="${link("/contact")}">${t("home.heroCtaSecondary")}</a>
        </div>
      </div>
    </section>

    <section class="section stats-section">
      <div class="container">
        <h2 class="section-title section-title--center">${t("home.statsTitle")}</h2>
        <div class="stats-grid">
          ${stats
            .map(
              (s) => `
            <div class="stat-tile">
              <span class="stat-tile__value" data-stat-value="${s.value}">0</span>
              <span class="stat-tile__label">${s.label}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section partners-section">
      <div class="container">
        <p class="eyebrow eyebrow--center">${t("home.partnersEyebrow")}</p>
        <h2 class="section-title section-title--center">${t("home.partnersTitle")}</h2>
        <p class="section-subtitle section-subtitle--center">${t("home.partnersSubtitle")}</p>
        <div class="partners-grid">
          ${partners
            .map(
              (p, i) => `
            <div class="partner-logo" data-reveal data-reveal-index="${i}">
              <img src="${p.logo}" alt="${p.name}" loading="lazy" />
            </div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section about-teaser">
      <div class="container about-teaser__grid">
        <div class="about-teaser__media">
          <img src="${wixImg("3510f9_d33ff747ef4d4e1f8bdd85a35fa6d2f5~mv2.jpg")}" alt="HADARA residential development in Beylikdüzü" loading="lazy" />
        </div>
        <div class="about-teaser__content">
          <p class="eyebrow">${t("home.aboutEyebrow")}</p>
          <h2 class="section-title">${t("home.aboutTitle")}</h2>
          <p>${t("home.aboutText1")}</p>
          <p>${t("home.aboutText2")}</p>
          <a class="btn btn--outline" href="${link("/about")}">${t("home.aboutCta")}</a>
        </div>
      </div>
    </section>

    <section class="section projects-section">
      <div class="container">
        <div class="section-head">
          <div>
            <p class="eyebrow">${t("home.projectsEyebrow")}</p>
            <h2 class="section-title">${t("home.projectsTitle")}</h2>
            <p class="section-subtitle">${t("home.projectsSubtitle")}</p>
          </div>
          <a class="btn btn--outline" href="${link("/projects")}">${t("common.viewAllProjects")}</a>
        </div>
        <div class="project-grid">
          ${featured.map((p) => renderProjectCard(p)).join("")}
        </div>
      </div>
    </section>

    <section class="section services-section">
      <div class="container">
        <p class="eyebrow eyebrow--center">${t("home.servicesEyebrow")}</p>
        <h2 class="section-title section-title--center">${t("home.servicesTitle")}</h2>
        <div class="services-grid">
          ${services
            .map(
              (s, i) => `
            <div class="service-card">
              <span class="service-card__index">0${i + 1}</span>
              <h3>${s.title}</h3>
              <p>${s.desc}</p>
            </div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section why-section">
      <div class="container">
        <p class="eyebrow eyebrow--center">${t("home.whyEyebrow")}</p>
        <h2 class="section-title section-title--center">${t("home.whyTitle")}</h2>
        <div class="why-grid">
          ${why
            .map(
              (w) => `
            <div class="why-card">
              <h3>${w.title}</h3>
              <p>${w.desc}</p>
            </div>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section citizenship-teaser">
      <div class="container citizenship-teaser__inner">
        <div>
          <h2 class="section-title">${t("home.citizenshipTitle")}</h2>
          <p>${t("home.citizenshipText")}</p>
        </div>
        <a class="btn btn--primary" href="${link("/citizenship")}">${t("home.citizenshipCta")}</a>
      </div>
    </section>

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <h2 class="section-title">${t("home.ctaTitle")}</h2>
        <p>${t("home.ctaText")}</p>
        <a class="btn btn--primary" href="${link("/contact")}">${t("home.ctaButton")}</a>
      </div>
    </section>
  `;

  initStatCounters(el);
  initScrollReveal(el);
}
