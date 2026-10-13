import { t, tRaw, link } from "../i18n";
import { initScrollReveal } from "../components/scrollReveal";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "../components/floatingButtons";
import { heroBackground } from "../utils/responsiveImage";
import { blogPosts } from "../data/blog";

interface Step {
  title: string;
  text: string;
}
interface Stage {
  label: string;
  title: string;
  intro: string;
  steps: Step[];
}

/** Where each step's "learn more" link goes, in the order of `guide.stages[].steps` (null = no link). */
const STEP_LINKS: (string | null)[][] = [
  ["/blog/real-estate-in-turkey", "/blog/apartment-or-villa", "/blog/gross-vs-net-area", "/blog/off-plan-or-ready", "/video-tour", "/blog/buying-property-and-tapu"],
  [null, null, null, "/blog/real-estate-valuation", "/citizenship", "/blog/taxes-and-tapu-fees"],
  [null, null, null, null, "/citizenship", "/blog/life-in-turkey"]
];

/** Anchor ids of the three stages (also the targets of the stage bar). */
const STAGE_IDS = ["before", "purchase", "after"];

const HERO_PHOTO = { src: "/images/projects/marmara-haven-villa/sunset.jpg", width: 1500 };

const ARROW =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
const TOUR_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2"></rect></svg>';
const TIP_ICON =
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12.74V16h8v-1.26A7 7 0 0 0 12 2z"></path></svg>';

const pad = (n: number) => String(n).padStart(2, "0");

/** Name of a link target: the article's title, or the page's menu name. */
function targetName(path: string): string {
  if (path.startsWith("/blog/")) {
    const slug = path.slice(6);
    return blogPosts.some((p) => p.slug === slug) ? t(`blogData.${slug}.title`) : "";
  }
  if (path === "/video-tour") return t("videoTour.nav");
  if (path === "/citizenship") return t("nav.citizenship");
  return "";
}

function stepCard(step: Step, stage: number, index: number): string {
  const target = STEP_LINKS[stage]?.[index] ?? null;
  const name = target ? targetName(target) : "";
  return `
          <li class="guide-step" data-reveal data-reveal-index="${index % 2}">
            <span class="guide-step__num" dir="ltr">${pad(index + 1)}</span>
            <div class="guide-step__body">
              <h3>${step.title}</h3>
              <p>${step.text}</p>
              ${
                target && name
                  ? `<a class="guide-step__more" href="${link(target)}"><span class="guide-step__more-label">${t("guide.more")}</span><span class="guide-step__more-title">${name}${ARROW}</span></a>`
                  : ""
              }
            </div>
          </li>`;
}

function stageSection(stage: Stage, i: number): string {
  return `
    <section class="section guide-stage${i % 2 ? " guide-stage--alt" : ""}" id="${STAGE_IDS[i]}" aria-labelledby="${STAGE_IDS[i]}-title">
      <div class="container guide-stage__inner">
        <header class="guide-stage__head">
          <span class="guide-stage__num" dir="ltr" aria-hidden="true">${pad(i + 1)}</span>
          <p class="eyebrow">${stage.label}</p>
          <h2 class="section-title" id="${STAGE_IDS[i]}-title">${stage.title}</h2>
          <p class="guide-stage__intro">${stage.intro}</p>
        </header>
        <ol class="guide-steps">
          ${stage.steps.map((s, j) => stepCard(s, i, j)).join("")}
        </ol>
      </div>
    </section>`;
}

/** Highlights the stage the reader is in on the sticky stage bar. */
function initStageBar(el: HTMLElement): void {
  const links = [...el.querySelectorAll<HTMLAnchorElement>(".guide-bar__link")];
  const sections = STAGE_IDS.map((id) => el.querySelector<HTMLElement>(`#${id}`)).filter((s): s is HTMLElement => !!s);
  if (!links.length || !sections.length || !("IntersectionObserver" in window)) return;
  const setActive = (id: string) =>
    links.forEach((a) => {
      const on = a.dataset.stage === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive((visible[0].target as HTMLElement).id);
    },
    { rootMargin: "-35% 0px -55% 0px" }
  );
  sections.forEach((s) => observer.observe(s));
  links.forEach((a) =>
    a.addEventListener("click", (e) => {
      const target = el.querySelector<HTMLElement>(`#${a.dataset.stage}`);
      if (!target) return;
      e.preventDefault();
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      setActive(a.dataset.stage ?? "");
    })
  );
}

export function renderBuyersGuide(el: HTMLElement): void {
  const stages = tRaw<Stage[]>("guide.stages");
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("guide.whatsappMessage"))}`;

  el.innerHTML = `
    <section class="page-hero guide-hero" style="${heroBackground(HERO_PHOTO, "linear-gradient(180deg, rgba(15,43,33,.4), rgba(15,43,33,.82))")}">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("guide.heroEyebrow")}</p>
        <h1>${t("guide.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("guide.heroSubtitle")}</p>
        <ol class="guide-hero__stages">
          ${stages
            .map(
              (s, i) => `
          <li><a href="#${STAGE_IDS[i]}" class="guide-hero__stage"><span dir="ltr">${pad(i + 1)}</span>${s.label}<small>${t("guide.stepsCount", { count: s.steps.length })}</small></a></li>`
            )
            .join("")}
        </ol>
      </div>
    </section>

    <nav class="guide-bar" aria-label="${t("guide.stagesLabel")}">
      <div class="container guide-bar__inner">
        ${stages
          .map(
            (s, i) =>
              `<a class="guide-bar__link${i === 0 ? " is-active" : ""}" href="#${STAGE_IDS[i]}" data-stage="${STAGE_IDS[i]}"><span dir="ltr">${pad(i + 1)}</span>${s.label}</a>`
          )
          .join("")}
      </div>
    </nav>

    ${stages.map(stageSection).join("")}

    <section class="section guide-tip-section">
      <div class="container narrow">
        <aside class="guide-tip" data-reveal>
          <span class="guide-tip__icon">${TIP_ICON}</span>
          <div>
            <h2>${t("guide.tipTitle")}</h2>
            <p>${t("guide.tipText")}</p>
          </div>
        </aside>
        <p class="guide-note">${t("guide.note")}</p>
      </div>
    </section>

    <section class="section final-cta">
      <div class="container final-cta__inner">
        <div class="cz-cta__text">
          <h2 class="section-title">${t("guide.ctaTitle")}</h2>
          <p>${t("guide.ctaText")}</p>
        </div>
        <div class="cz-cta__actions guide-cta__actions">
          <a class="btn btn--primary" href="${whatsapp}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("guide.ctaWhatsapp")}</a>
          <a class="btn btn--ghost" href="${link("/video-tour")}">${TOUR_ICON}${t("guide.ctaTour")}</a>
        </div>
      </div>
    </section>
  `;

  initScrollReveal(el);
  initStageBar(el);
}
