import { t, tRaw } from "../i18n";
import { initStatCounters } from "../components/statCounter";
import { wixImg } from "../utils/image";

interface ValueItem {
  title: string;
  desc: string;
}
interface TimelineItem {
  year: string;
  text: string;
}
interface StatItem {
  value: string;
  label: string;
}

export function renderAbout(el: HTMLElement): void {
  const values = tRaw<ValueItem[]>("about.values");
  const timeline = tRaw<TimelineItem[]>("about.timeline");
  const stats = tRaw<StatItem[]>("about.stats");

  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("about.heroEyebrow")}</p>
        <h1>${t("about.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("about.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section about-teaser">
      <div class="container about-teaser__grid">
        <div class="about-teaser__media">
          <img src="${wixImg("3510f9_9700bfeff9a74a0fb54aee54a8091089~mv2.jpg")}" alt="HADARA Real Estate headquarters area in Beylikdüzü" loading="lazy" />
        </div>
        <div class="about-teaser__content">
          <p class="eyebrow">${t("about.storyEyebrow")}</p>
          <h2 class="section-title">${t("about.storyTitle")}</h2>
          <p>${t("about.storyText1")}</p>
          <p>${t("about.storyText2")}</p>
        </div>
      </div>
    </section>

    <section class="section mission-vision">
      <div class="container mission-vision__grid">
        <div class="mission-vision__card">
          <h3>${t("about.missionTitle")}</h3>
          <p>${t("about.missionText")}</p>
        </div>
        <div class="mission-vision__card">
          <h3>${t("about.visionTitle")}</h3>
          <p>${t("about.visionText")}</p>
        </div>
      </div>
    </section>

    <section class="section why-section">
      <div class="container">
        <h2 class="section-title section-title--center">${t("about.valuesTitle")}</h2>
        <div class="why-grid">
          ${values.map((v) => `<div class="why-card"><h3>${v.title}</h3><p>${v.desc}</p></div>`).join("")}
        </div>
      </div>
    </section>

    <section class="section timeline-section">
      <div class="container">
        <h2 class="section-title section-title--center">${t("about.timelineTitle")}</h2>
        <ol class="timeline">
          ${timeline
            .map(
              (item) => `
            <li class="timeline__item">
              <span class="timeline__year">${item.year}</span>
              <p class="timeline__text">${item.text}</p>
            </li>`
            )
            .join("")}
        </ol>
      </div>
    </section>

    <section class="section stats-section">
      <div class="container">
        <h2 class="section-title section-title--center">${t("about.statsTitle")}</h2>
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
  `;

  initStatCounters(el);
}
