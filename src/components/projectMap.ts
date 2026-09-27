import { t, placeName, placeLine } from "../i18n";
import type { Project } from "../data/projects";

/**
 * Visible slice of the province map (viewBox units): wide enough to read as Istanbul, close enough to
 * find the district; phones get a closer, squarer slice. `.project-map__canvas` reserves the same
 * ratios (800 / 560 × MAP_HEIGHT) in CSS.
 */
const VIEW_WIDTH = 800;
const VIEW_WIDTH_PHONE = 560;
const PHONE_QUERY = "(max-width: 640px)";
/** Sea labels, in map units; each is drawn only when it falls inside the visible slice. */
const SEA_LABELS = [
  { key: "blackSea", x: 700, y: 140 },
  { key: "marmara", x: 330, y: 478 }
];

const MAPS_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>';

/** Google Maps search for the project (its address when known, otherwise its name and district). */
export function mapsHref(project: Project, name: string): string {
  const query = project.address ?? `${name}, ${project.district}, ${project.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Where the project sits on a map of Istanbul: its district in gold and a pulsing pin at the
 * district's centre. The map outline (~19 KB) loads only when the block comes near the screen.
 */
export function renderProjectMap(project: Project, name: string): string {
  const place = placeLine(project.district, project.city);
  return `
      <figure class="project-map" data-district="${project.district}">
        <div class="project-map__canvas" role="img" aria-label="${t("projectDetail.mapAlt", { name, place })}"></div>
        <figcaption class="project-map__caption">
          <span>${t("projectDetail.mapCaption", { place })}</span>
          <a class="project-map__link" href="${mapsHref(project, name)}" target="_blank" rel="noopener">${MAPS_ICON}${t("projectDetail.openInMaps")}</a>
        </figcaption>
      </figure>`;
}

export function initProjectMap(root: ParentNode): void {
  const figure = root.querySelector<HTMLElement>(".project-map");
  if (!figure) return;
  const draw = async () => {
    const { MAP_HEIGHT, MAP_WIDTH, DISTRICT_PATHS, DISTRICT_CENTERS } = await import("../data/istanbulMap");
    const district = figure.dataset.district ?? "";
    const center = DISTRICT_CENTERS[district];
    const canvas = figure.querySelector<HTMLElement>(".project-map__canvas");
    if (!center || !canvas) {
      figure.querySelector(".project-map__canvas")?.remove();
      return;
    }
    const width = window.matchMedia(PHONE_QUERY).matches ? VIEW_WIDTH_PHONE : VIEW_WIDTH;
    const x0 = Math.min(Math.max(center[0] - width / 2, 0), MAP_WIDTH - width);
    const pct = (x: number, y: number) => `left:${(((x - x0) / width) * 100).toFixed(2)}%;top:${((y / MAP_HEIGHT) * 100).toFixed(2)}%`;
    const others = Object.entries(DISTRICT_PATHS)
      .filter(([name]) => name !== district)
      .map(([, d]) => `<path d="${d}"/>`)
      .join("");
    const seas = SEA_LABELS.filter((s) => s.x > x0 + 70 && s.x < x0 + width - 70)
      .map((s) => `<span class="project-map__sea" style="${pct(s.x, s.y)}">${t(`projectDetail.map.${s.key}`)}</span>`)
      .join("");
    canvas.innerHTML = `
      <svg class="project-map__svg" viewBox="${x0} 0 ${width} ${MAP_HEIGHT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <g class="project-map__land">${others}</g>
        <path class="project-map__district" d="${DISTRICT_PATHS[district]}"/>
      </svg>
      ${seas}
      <span class="project-map__pin" style="${pct(center[0], center[1])}">
        <span class="project-map__pulse"></span>
        <span class="project-map__pulse project-map__pulse--late"></span>
        <svg class="project-map__marker" width="30" height="38" viewBox="0 0 30 38" aria-hidden="true"><path d="M15 37s13-11.6 13-22A13 13 0 0 0 2 15c0 10.4 13 22 13 22z"/><circle cx="15" cy="15" r="5"/></svg>
        <span class="project-map__label">${placeName(district)}</span>
      </span>`;
    figure.classList.add("is-ready");
  };

  if (!("IntersectionObserver" in window)) {
    void draw();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      void draw();
    },
    { rootMargin: "600px 0px" }
  );
  observer.observe(figure);
}
