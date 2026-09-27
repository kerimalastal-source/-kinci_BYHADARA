import { t, link, getProjectContent, placeLine } from "../i18n";
import { getSortedProjects, type Lifestyle, type Project } from "../data/projects";
import { projectStatusLabel } from "./projectCard";
import { favoriteButton } from "./favorites";
import { WHATSAPP_ICON, WHATSAPP_NUMBER } from "./floatingButtons";
import { videoTourHref, VIDEO_TOUR_ICON } from "./videoTourInvite";

/**
 * "Find My Project": four quick questions on the home page, then the projects that fit,
 * each with honest reasons (and what doesn't fit) taken only from the project data.
 */

type Goal = "living" | "investment" | "citizenship" | "holiday";
type Size = "small" | "family" | "large";
type Timing = "ready" | "offplan" | "any";

interface Answers {
  goal?: Goal;
  size?: Size;
  lifestyle?: Lifestyle;
  timing?: Timing;
}

type StepKey = keyof Answers;

const STEPS: { key: StepKey; options: string[] }[] = [
  { key: "goal", options: ["living", "investment", "citizenship", "holiday"] },
  { key: "size", options: ["small", "family", "large"] },
  { key: "lifestyle", options: ["sea", "nature", "city"] },
  { key: "timing", options: ["ready", "offplan", "any"] }
];

const STORE_KEY = "hadara-match";

const svg = (body: string) =>
  `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS: Record<string, string> = {
  living: svg('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  investment: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  citizenship: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>'),
  holiday: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  small: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'),
  family: svg('<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M2.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6"/><path d="M13.5 20c.2-2.6 1.4-4.5 3-4.5 1.9 0 3.5 2 3.5 4.5"/>'),
  large: svg('<path d="M2 12 12 4l10 8"/><path d="M4 11v9h16v-9"/><rect x="8" y="13" width="3" height="3"/><rect x="13" y="13" width="3" height="3"/>'),
  sea: svg('<path d="M2 15c2 0 2-1.5 4-1.5S8 15 10 15s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M2 19c2 0 2-1.5 4-1.5S8 19 10 19s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><circle cx="16" cy="7" r="3"/>'),
  nature: svg('<path d="M12 21v-6"/><path d="M12 3 6 12h3l-3 4h12l-3-4h3z"/>'),
  city: svg('<path d="M3 21h18"/><path d="M5 21V9l5-3v15"/><path d="M10 21V4h9v17"/><path d="M13 8h3M13 12h3M13 16h3"/>'),
  ready: svg('<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>'),
  offplan: svg('<path d="M4 21V9"/><path d="M4 9h14l-3-4H4"/><path d="M18 9v4"/><path d="M15 13h6v8h-6z"/>'),
  any: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>')
};

const CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>`;
const INFO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5"/></svg>`;

function loadAnswers(): Answers {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "{}") as Answers;
  } catch {
    return {};
  }
}

function saveAnswers(answers: Answers): void {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(answers));
  } catch {
    // storage unavailable: the answers just won't survive a reload
  }
}

const currentStep = (a: Answers) => STEPS.findIndex((s) => !a[s.key]);

/* ---------- Matching (only facts already in the project data) ---------- */

/** Home layouts sold in the project ("2+1", "3+1"...), offices excluded. */
const homeLayouts = (p: Project) => (p.residences ?? []).filter((r) => r.kind !== "office").map((r) => r.layout);

function sizeOf(layout: string): Size {
  const rooms = parseInt(layout, 10);
  return rooms <= 1 ? "small" : rooms <= 3 ? "family" : "large";
}

const isVilla = (p: Project) => p.slug.includes("villa") || !!p.residences?.some((r) => r.kind === "villa");

/** Layouts of the project that fit the chosen size; null when the project publishes none. */
function fittingLayouts(p: Project, size: Size): string[] | null {
  if (isVilla(p)) return size === "large" ? homeLayouts(p) : [];
  const layouts = homeLayouts(p);
  if (!layouts.length) return null;
  return layouts.filter((l) => sizeOf(l) === size);
}

const deliveryYear = (p: Project) => p.stats.find((s) => s.labelKey === "delivery")?.value;
const ltr = (text: string) => `<bdi dir="ltr">${text}</bdi>`;

interface Match {
  project: Project;
  score: number;
  /** 2 = has the home size asked for, 1 = sizes not published, 0 = only other sizes. */
  sizeRank: number;
  perfect: boolean;
  reasons: string[];
  notes: string[];
}

function evaluate(p: Project, a: Answers): Match {
  const reasons: string[] = [];
  const notes: string[] = [];
  let score = 0;
  let perfect = true;

  // Home size
  const fits = fittingLayouts(p, a.size!);
  const sizeRank = fits === null ? 1 : fits.length ? 2 : 0;
  if (fits === null) {
    perfect = false;
    notes.push(t("match.notes.sizeUnknown"));
  } else if (fits.length) {
    score += 3;
    reasons.push(isVilla(p) ? t("match.reasons.villa") : t("match.reasons.size", { layouts: ltr(fits.join(" · ")) }));
  } else {
    perfect = false;
    notes.push(isVilla(p) ? t("match.notes.villa") : t("match.notes.size", { layouts: ltr(homeLayouts(p).join(" · ")) }));
  }

  // Setting
  const settings = p.lifestyle ?? [];
  if (settings.includes(a.lifestyle!)) {
    score += 3;
    reasons.push(t(`match.reasons.${a.lifestyle}`));
  } else {
    perfect = false;
    if (settings.length) notes.push(t("match.notes.setting", { setting: settings.map((s) => t(`match.options.lifestyle.${s}`)).join(" · ") }));
  }

  // Timing
  const ready = p.status === "delivered";
  const year = deliveryYear(p);
  if (a.timing === "ready") {
    if (ready) {
      score += 2;
      reasons.push(t("match.reasons.ready"));
    } else {
      perfect = false;
      notes.push(year ? t("match.notes.offplanYear", { year: ltr(year) }) : t("match.notes.offplan"));
    }
  } else if (a.timing === "offplan") {
    if (!ready) {
      score += 2;
      reasons.push(year ? t("match.reasons.offplanYear", { year: ltr(year) }) : t("match.reasons.offplan"));
    } else {
      perfect = false;
      notes.push(t("match.notes.ready"));
    }
  } else {
    reasons.push(ready ? t("match.reasons.ready") : year ? t("match.reasons.offplanYear", { year: ltr(year) }) : t("match.reasons.offplan"));
  }

  // A holiday home leans towards the sea and nature.
  if (a.goal === "holiday" && settings.some((s) => s === "sea" || s === "nature")) score += 1;

  return { project: p, score, sizeRank, perfect, reasons, notes };
}

function findMatches(a: Answers): { matches: Match[]; perfect: boolean } {
  const all = getSortedProjects()
    .filter((p) => !p.soldOut)
    .map((p) => evaluate(p, a))
    .sort((x, y) => Number(y.perfect) - Number(x.perfect) || y.score - x.score || x.project.priority - y.project.priority);
  const perfect = all.filter((m) => m.perfect);
  if (perfect.length) return { matches: perfect.slice(0, 3), perfect: true };
  // Closest options: a home of the wrong size is the hardest mismatch, so those come last (and only if nothing else fits).
  const bestSize = Math.max(...all.map((m) => m.sizeRank));
  const closest = all
    .filter((m) => m.score > 0 && m.sizeRank >= Math.min(bestSize, 1))
    .sort((x, y) => y.sizeRank - x.sizeRank || y.score - x.score || x.project.priority - y.project.priority);
  return { matches: closest.slice(0, 2), perfect: false };
}

/* ---------- Rendering ---------- */

function renderStep(a: Answers, index: number): string {
  const step = STEPS[index];
  return `
    <div class="match__progress">
      <span>${t("match.progress", { current: index + 1, total: STEPS.length })}</span>
      <span class="match__bar" aria-hidden="true"><span style="width:${((index + 1) / STEPS.length) * 100}%"></span></span>
    </div>
    <fieldset class="match__step">
      <legend class="match__question">${t(`match.questions.${step.key}`)}</legend>
      <div class="match__options match__options--${step.options.length}">
        ${step.options
          .map(
            (value) => `
          <button type="button" class="match-option" data-match-answer="${step.key}" data-value="${value}" aria-pressed="${a[step.key] === value}">
            <span class="match-option__icon">${ICONS[value]}</span>
            <span class="match-option__label">${t(`match.options.${step.key}.${value}`)}</span>
            <span class="match-option__hint">${t(`match.hints.${step.key}.${value}`)}</span>
          </button>`
          )
          .join("")}
      </div>
    </fieldset>
    ${index > 0 ? `<button type="button" class="match__back" data-match-back>${t("match.back")}</button>` : ""}`;
}

function renderResultCard(m: Match): string {
  const p = m.project;
  const content = getProjectContent(p.slug);
  const href = link(`/projects/${p.slug}`);
  return `
    <article class="match-card">
      <a class="match-card__media" href="${href}" tabindex="-1" aria-hidden="true">
        <img src="${p.coverImage.src}" alt="" width="${p.coverImage.width}" height="${p.coverImage.height}" loading="lazy" />
        <span class="match-card__status">
          <span class="badge badge--${p.status}">${projectStatusLabel(p.status)}</span>
          ${p.unitsAvailable ? `<span class="badge badge--available">${t("common.unitsAvailable")}</span>` : ""}
        </span>
      </a>
      ${favoriteButton(p.slug, "card")}
      <div class="match-card__body">
        <h3 class="match-card__title"><a href="${href}">${content.name}</a></h3>
        <p class="match-card__place">${placeLine(p.district, p.city)}</p>
        <ul class="match-card__reasons">
          ${m.reasons.map((r) => `<li class="is-yes"><span class="match-card__mark">${CHECK}</span><span>${r}</span></li>`).join("")}
          ${m.notes.map((n) => `<li class="is-note"><span class="match-card__mark">${INFO}</span><span>${n}</span></li>`).join("")}
        </ul>
        <a class="btn btn--outline match-card__cta" href="${href}">${t("match.viewProject")}</a>
      </div>
    </article>`;
}

function whatsappBrief(a: Answers, matches: Match[]): string {
  const lines = [
    t("match.wa.intro"),
    `${t("match.wa.goal")}: ${t(`match.options.goal.${a.goal}`)}`,
    `${t("match.wa.size")}: ${t(`match.options.size.${a.size}`)}`,
    `${t("match.wa.lifestyle")}: ${t(`match.options.lifestyle.${a.lifestyle}`)}`,
    `${t("match.wa.timing")}: ${t(`match.options.timing.${a.timing}`)}`
  ];
  if (matches.length) {
    lines.push("", `${t("match.wa.projects")}:`);
    for (const m of matches) {
      lines.push(`• ${getProjectContent(m.project.slug).name} — ${window.location.origin}${link(`/projects/${m.project.slug}`)}`);
    }
  }
  lines.push("", t("match.wa.outro"));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function renderResults(a: Answers): string {
  const { matches, perfect } = findMatches(a);
  const title = !matches.length
    ? t("match.resultsNone")
    : perfect
      ? t(matches.length === 1 ? "match.resultsOne" : matches.length === 2 ? "match.resultsTwo" : "match.resultsMany", { count: matches.length })
      : t("match.resultsClosest");
  return `
    <div class="match__results">
      <div class="match__results-head">
        <h3 class="match__results-title">${title}</h3>
        <p class="match__goal-note">${t(`match.goalNotes.${a.goal}`)}</p>
      </div>
      ${matches.length ? `<div class="match__grid match__grid--${matches.length}">${matches.map(renderResultCard).join("")}</div>` : ""}
      <div class="match__actions">
        <a class="btn btn--whatsapp" href="${whatsappBrief(a, matches)}" target="_blank" rel="noopener">${WHATSAPP_ICON}${t("match.sendResults")}</a>
        ${matches.length ? `<a class="btn btn--tour" href="${videoTourHref(matches.map((m) => m.project.slug))}">${VIDEO_TOUR_ICON}${t("videoTour.matchButton")}</a>` : ""}
        <a class="btn btn--outline" href="${link("/property-request")}">${t("match.customRequest")}</a>
      </div>
      <button type="button" class="match__restart" data-match-restart>${t("match.restart")}</button>
    </div>`;
}

function renderBody(a: Answers): string {
  const index = currentStep(a);
  return index === -1 ? renderResults(a) : renderStep(a, index);
}

export function renderProjectMatch(): string {
  return `
    <section class="section match-section" id="find-my-project" aria-labelledby="match-title">
      <div class="container">
        <div class="match">
          <div class="match__head">
            <p class="eyebrow eyebrow--center">${t("match.eyebrow")}</p>
            <h2 class="section-title section-title--center" id="match-title">${t("match.title")}</h2>
            <p class="section-subtitle section-subtitle--center">${t("match.subtitle")}</p>
          </div>
          <div class="match__body" data-match-body aria-live="polite">${renderBody(loadAnswers())}</div>
        </div>
      </div>
    </section>`;
}

export function initProjectMatch(root: HTMLElement): void {
  const body = root.querySelector<HTMLElement>("[data-match-body]");
  if (!body) return;
  let answers = loadAnswers();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const update = (next: Answers) => {
    answers = next;
    saveAnswers(answers);
    body.innerHTML = renderBody(answers);
    body.classList.remove("is-changing");
    void body.offsetWidth;
    body.classList.add("is-changing");
    // Keep the question in view on phones, where the options fill the screen.
    const top = body.getBoundingClientRect().top;
    const headerH = parseFloat(getComputedStyle(document.querySelector(".site-header") ?? document.documentElement).getPropertyValue("--header-h")) || 80;
    if (top < headerH || top > window.innerHeight * 0.6) {
      window.scrollTo({ top: window.scrollY + top - headerH - 16, behavior: reduced ? "auto" : "smooth" });
    }
  };

  body.addEventListener("click", (e) => {
    const target = e.target as Element;
    const option = target.closest<HTMLButtonElement>("[data-match-answer]");
    if (option) {
      const key = option.dataset.matchAnswer as StepKey;
      body.querySelectorAll("[data-match-answer]").forEach((b) => b.setAttribute("aria-pressed", String(b === option)));
      // A short beat so the choice registers before the next question.
      window.setTimeout(() => update({ ...answers, [key]: option.dataset.value }), reduced ? 0 : 220);
      return;
    }
    if (target.closest("[data-match-back]")) {
      const index = currentStep(answers);
      const previous = STEPS[(index === -1 ? STEPS.length : index) - 1];
      if (!previous) return;
      const next = { ...answers };
      delete next[previous.key];
      update(next);
      return;
    }
    if (target.closest("[data-match-restart]")) update({});
  });
}
