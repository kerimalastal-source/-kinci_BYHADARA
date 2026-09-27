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
/** Road number shields, and the order the legend lists the roads in. */
const ROADS = [
  { key: "e5", shield: "E5" },
  { key: "e80", shield: "E80" },
  { key: "o7", shield: "O-7" }
];

const MAPS_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>';
const POI_ICONS: Record<string, string> = {
  airport: '<path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2.5 1.8V21.5L11.5 20.5l4 1v-1.7L13 18v-5z" fill="currentColor" stroke="none"/>',
  mall: '<path d="M5.5 8h13l-1 13h-11z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  landmark: '<circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/>'
};
const BRIDGE_ICON =
  '<svg width="18" height="12" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M1 11h22M5 11V3M19 11V3M5 3c2.5 5 11.5 5 14 0M9 11V7.3M15 11V7.3"/></svg>';

const icon = (paths: string, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** Google Maps search for the project (its address when known, otherwise its name and district). */
export function mapsHref(project: Project, name: string): string {
  const query = project.address ?? `${name}, ${project.district}, ${project.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Where the project sits on a map of Istanbul: its district in gold with a pulsing pin, plus the
 * landmarks a buyer from abroad finds their way by — the airports, the Bosphorus and its bridges,
 * the E5 / E80 / Northern Marmara motorways, Mall of Istanbul, Taksim and Sultanahmet.
 * The map data (~21 KB) loads only when the block comes near the screen.
 */
export function renderProjectMap(project: Project, name: string): string {
  const place = placeLine(project.district, project.city);
  return `
      <figure class="project-map" data-district="${project.district}">
        <div class="project-map__canvas" role="img" aria-label="${t("projectDetail.mapAlt", { name, place })}"></div>
        <ul class="project-map__legend">
          <li>${BRIDGE_ICON}${t("projectDetail.map.bridges")}</li>
          ${ROADS.map(
            (r) => `<li><span class="map-shield map-shield--${r.key}" translate="no">${r.shield}</span>${t(`projectDetail.map.roads.${r.key}`)}</li>`
          ).join("")}
        </ul>
        <figcaption class="project-map__caption">
          <span>${t("projectDetail.mapCaption", { place })}</span>
          <a class="project-map__link" href="${mapsHref(project, name)}" target="_blank" rel="noopener">${MAPS_ICON}${t("projectDetail.openInMaps")}</a>
        </figcaption>
      </figure>`;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function initProjectMap(root: ParentNode): void {
  const figure = root.querySelector<HTMLElement>(".project-map");
  if (!figure) return;
  const draw = async () => {
    const map = await import("../data/istanbulMap");
    const { MAP_HEIGHT, MAP_WIDTH, DISTRICT_PATHS, DISTRICT_CENTERS } = map;
    const district = figure.dataset.district ?? "";
    const center = DISTRICT_CENTERS[district];
    const canvas = figure.querySelector<HTMLElement>(".project-map__canvas");
    if (!center || !canvas) {
      figure.remove();
      return;
    }
    const width = window.matchMedia(PHONE_QUERY).matches ? VIEW_WIDTH_PHONE : VIEW_WIDTH;
    const x0 = Math.min(Math.max(center[0] - width / 2, 0), MAP_WIDTH - width);
    const pct = (x: number, y: number) => `left:${(((x - x0) / width) * 100).toFixed(2)}%;top:${((y / MAP_HEIGHT) * 100).toFixed(2)}%`;
    const inView = (x: number, margin = 12) => x > x0 + margin && x < x0 + width - margin;

    // Overlays are placed in px, so labels can dodge the pin and each other at any screen size.
    const scale = canvas.clientWidth / width;
    const px = (x: number, y: number) => ({ x: (x - x0) * scale, y: y * scale });
    const pin = px(center[0], center[1]);
    const charWidth = scale < 0.7 ? 6 : 6.6;
    const labelWidth = (text: string, perChar: number) => text.length * perChar + 10;
    const pinLabel = (labelWidth(placeName(district), 7.4) + 14) / 2;
    // The pin's marker and pulse, and its name chip above it.
    const taken: Box[] = [
      { left: pin.x - 20, right: pin.x + 20, top: pin.y - 40, bottom: pin.y + 14 },
      { left: pin.x - pinLabel, right: pin.x + pinLabel, top: pin.y - 74, bottom: pin.y - 40 }
    ];
    const frame = { width: canvas.clientWidth, height: MAP_HEIGHT * scale };
    const fits = (b: Box) => b.left >= 4 && b.right <= frame.width - 4 && b.top >= 4 && b.bottom <= frame.height - 4 && !taken.some((o) => overlaps(o, b));

    // Landmark icons first (they matter most), then road shields, then the landmark names around both.
    const spots = map.LANDMARKS.filter((l) => inView(l.x)).flatMap((l) => {
      const p = px(l.x, l.y);
      const r = l.kind === "landmark" ? 7 : 11;
      const dot: Box = { left: p.x - r, right: p.x + r, top: p.y - r, bottom: p.y + r };
      if (!fits(dot)) return [];
      taken.push(dot);
      return [{ ...l, p, r }];
    });

    const shields = ROADS.map((r) => {
      const spot = map.ROAD_SHIELDS[r.key]?.find(([x, y]) => {
        if (!inView(x, 20)) return false;
        const p = px(x, y);
        const box = { left: p.x - 16, right: p.x + 16, top: p.y - 10, bottom: p.y + 10 };
        if (!fits(box)) return false;
        taken.push(box);
        return true;
      });
      return spot ? `<span class="map-shield map-shield--${r.key} project-map__shield" style="${pct(spot[0], spot[1])}" translate="no">${r.shield}</span>` : "";
    }).join("");

    const pois = spots
      .map(({ key, kind, x, y, p, r }) => {
        const text = t(`projectDetail.map.${key}`);
        const w = labelWidth(text, charWidth);
        const gap = r + 3;
        // Beside the icon first, then under or over it.
        const options: [string, Box][] = [
          ["right", { left: p.x + gap, right: p.x + gap + w, top: p.y - 9, bottom: p.y + 9 }],
          ["left", { left: p.x - gap - w, right: p.x - gap, top: p.y - 9, bottom: p.y + 9 }],
          ["below", { left: p.x - w / 2, right: p.x + w / 2, top: p.y + gap, bottom: p.y + gap + 18 }],
          ["above", { left: p.x - w / 2, right: p.x + w / 2, top: p.y - gap - 18, bottom: p.y - gap }]
        ];
        const [side, box] = options.find(([, b]) => fits(b)) ?? ["", null];
        if (box) taken.push(box);
        return `
        <span class="project-map__poi project-map__poi--${kind}" style="${pct(x, y)}">
          <span class="project-map__poi-icon">${icon(POI_ICONS[kind])}</span>
          ${side ? `<span class="project-map__poi-label project-map__poi-label--${side}">${text}</span>` : `<span class="visually-hidden">${text}</span>`}
        </span>`;
      })
      .join("");

    const others = Object.entries(DISTRICT_PATHS)
      .filter(([name]) => name !== district)
      .map(([, d]) => `<path d="${d}"/>`)
      .join("");
    const roads = Object.values(map.ROAD_PATHS);
    const bridges = map.BRIDGES.map(([[ax, ay], [bx, by]]) => `M${ax},${ay}L${bx},${by}`).join("");
    const seas = SEA_LABELS.filter((s) => s.x > x0 + 70 && s.x < x0 + width - 70)
      .map((s) => `<span class="project-map__sea" style="${pct(s.x, s.y)}">${t(`projectDetail.map.${s.key}`)}</span>`)
      .join("");
    const strait = map.BOSPHORUS_LABEL;
    const straitLabel = inView(strait.x, 30)
      ? `<span class="project-map__strait" style="${pct(strait.x, strait.y)};--angle:${strait.angle}deg">${t("projectDetail.map.bosphorus")}</span>`
      : "";

    canvas.innerHTML = `
      <svg class="project-map__svg" viewBox="${x0} 0 ${width} ${MAP_HEIGHT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <g class="project-map__land">${others}</g>
        <path class="project-map__district" d="${DISTRICT_PATHS[district]}"/>
        <g class="project-map__roads">
          ${roads.map((d) => `<path class="project-map__road-casing" d="${d}"/>`).join("")}
          ${roads.map((d) => `<path class="project-map__road" d="${d}"/>`).join("")}
        </g>
        <path class="project-map__bridge-casing" d="${bridges}"/>
        <path class="project-map__bridge" d="${bridges}"/>
      </svg>
      ${seas}
      ${straitLabel}
      ${shields}
      ${pois}
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
