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

const EXPAND_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
const CLOSE_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

const SWIPE_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8 3 12l4 4M17 8l4 4-4 4M3 12h18"/></svg>';

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
function legend(): string {
  return `
        <ul class="project-map__legend">
          <li>${BRIDGE_ICON}${t("projectDetail.map.bridges")}</li>
          ${ROADS.map(
            (r) => `<li><span class="map-shield map-shield--${r.key}" translate="no">${r.shield}</span>${t(`projectDetail.map.roads.${r.key}`)}</li>`
          ).join("")}
        </ul>`;
}

export function renderProjectMap(project: Project, name: string): string {
  const place = placeLine(project.district, project.city);
  return `
      <figure class="project-map" data-district="${project.district}" data-name="${name}" data-place="${place}" data-maps="${mapsHref(project, name)}">
        <div class="project-map__canvas" role="img" aria-label="${t("projectDetail.mapAlt", { name, place })}"></div>
        <button type="button" class="project-map__expand" aria-haspopup="dialog">${EXPAND_ICON}<span>${t("projectDetail.map.enlarge")}</span></button>
        ${legend()}
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
/** Boxes may touch by up to 1px: labels are padded, so a hair of overlap is invisible. */
const overlaps = (a: Box, b: Box) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

type MapData = typeof import("../data/istanbulMap");
let mapData: Promise<MapData> | null = null;
const loadMap = () => (mapData ??= import("../data/istanbulMap"));

/**
 * Draws the map into `canvas` (sized by CSS to `width` × MAP_HEIGHT map units): a `width`-wide
 * slice around the district, or the whole province when `width` is MAP_WIDTH.
 */
function drawMap(canvas: HTMLElement, map: MapData, district: string, width: number): void {
  const { MAP_HEIGHT, MAP_WIDTH, DISTRICT_PATHS, DISTRICT_CENTERS } = map;
  const center = DISTRICT_CENTERS[district];
  const x0 = Math.min(Math.max(center[0] - width / 2, 0), MAP_WIDTH - width);
  const pct = (x: number, y: number) => `left:${(((x - x0) / width) * 100).toFixed(2)}%;top:${((y / MAP_HEIGHT) * 100).toFixed(2)}%`;
  const inView = (x: number, margin = 12) => x > x0 + margin && x < x0 + width - margin;

  // Overlays are placed in px, so labels can dodge the pin and each other at any screen size.
  const scale = canvas.clientWidth / width;
  const px = (x: number, y: number) => ({ x: (x - x0) * scale, y: y * scale });
  const pin = px(center[0], center[1]);
  // Label widths are measured with the real font (a hidden label in the canvas).
  const measure = (className: string, text: string) => {
    const probe = document.createElement("span");
    probe.className = className;
    probe.style.visibility = "hidden";
    probe.textContent = text;
    canvas.appendChild(probe);
    const width = probe.offsetWidth;
    probe.remove();
    return width;
  };
  const pinLabel = measure("project-map__label", placeName(district)) / 2 + 4;
  // The pin's marker and pulse, and its name chip above it.
  const taken: Box[] = [
    { left: pin.x - 20, right: pin.x + 20, top: pin.y - 40, bottom: pin.y + 14 },
    { left: pin.x - pinLabel, right: pin.x + pinLabel, top: pin.y - 74, bottom: pin.y - 40 }
  ];
  const frame = { width: canvas.clientWidth, height: MAP_HEIGHT * scale };
  /** `from` skips the first boxes: landmark icons may sit under the pin (Marmara Park is in Beylikdüzü). */
  const fits = (b: Box, from = 0) =>
    b.left >= 4 && b.right <= frame.width - 4 && b.top >= 4 && b.bottom <= frame.height - 4 && !taken.slice(from).some((o) => overlaps(o, b));

  // Landmark icons first, then their names (in the data's order of importance), then road shields.
  const spots = map.LANDMARKS.filter((l) => inView(l.x)).flatMap((l) => {
    const p = px(l.x, l.y);
    const r = l.kind === "landmark" ? 7 : 11;
    const dot: Box = { left: p.x - r, right: p.x + r, top: p.y - r, bottom: p.y + r };
    if (!fits(dot, 2)) return [];
    taken.push(dot);
    return [{ ...l, p, r }];
  });

  const pois = spots
    .map(({ key, kind, x, y, p, r }) => {
      const text = t(`projectDetail.map.${key}`);
      const w = measure("project-map__poi-label", text);
      // Names go beside the icon (or beside the pin, when the icon sits under it), then under or
      // over it, then at its corners.
      const dot: Box = { left: p.x - r, right: p.x + r, top: p.y - r, bottom: p.y + r };
      const marker = taken[0];
      const hidden = p.x > marker.left && p.x < marker.right && p.y > marker.top && p.y < marker.bottom;
      const a = hidden ? marker : dot;
      const row = (left: number, dy = 0): Box => ({ left, right: left + w, top: p.y + dy - 9, bottom: p.y + dy + 9 });
      const col = (top: number): Box => ({ left: p.x - w / 2, right: p.x + w / 2, top, bottom: top + 18 });
      const options: Box[] = [
        row(a.right + 3),
        row(a.left - 3 - w),
        col(a.bottom + 3),
        col(a.top - 21),
        row(a.right - 1, 14),
        row(a.right - 1, -14),
        row(a.left + 1 - w, 14),
        row(a.left + 1 - w, -14)
      ];
      const box = options.find((b) => fits(b));
      if (box) taken.push(box);
      return `
      <span class="project-map__poi project-map__poi--${kind}" style="${pct(x, y)}">
        <span class="project-map__poi-icon">${icon(POI_ICONS[kind])}</span>
        ${
          box
            ? `<span class="project-map__poi-label" style="left:${(box.left - p.x).toFixed(1)}px;top:${(box.top - p.y).toFixed(1)}px">${text}</span>`
            : `<span class="visually-hidden">${text}</span>`
        }
      </span>`;
    })
    .join("");

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
}

/** The enlarged map: the whole province in a dialog (phones scroll it sideways, centred on the pin). */
function openViewer(figure: HTMLElement, map: MapData, opener: HTMLElement): void {
  const district = figure.dataset.district ?? "";
  const viewer = document.createElement("div");
  viewer.className = "map-viewer";
  viewer.innerHTML = `
    <div class="map-viewer__panel" role="dialog" aria-modal="true" aria-labelledby="map-viewer-title">
      <div class="map-viewer__head">
        <div class="map-viewer__title">
          <h2 id="map-viewer-title">${figure.dataset.name ?? ""}</h2>
          <span>${figure.dataset.place ?? ""}</span>
        </div>
        <a class="project-map__link" href="${figure.dataset.maps ?? "#"}" target="_blank" rel="noopener">${MAPS_ICON}<span>${t("projectDetail.openInMaps")}</span></a>
        <button type="button" class="map-viewer__close" aria-label="${t("projectDetail.map.close")}" title="${t("projectDetail.map.close")}">${CLOSE_ICON}</button>
      </div>
      <div class="map-viewer__body">
        <div class="map-viewer__scroll">
          <div class="project-map__canvas map-viewer__canvas" role="img" aria-label="${figure.querySelector(".project-map__canvas")?.getAttribute("aria-label") ?? ""}"></div>
        </div>
        <span class="map-viewer__hint" aria-hidden="true">${SWIPE_ICON}${t("projectDetail.map.swipe")}</span>
      </div>
      ${legend()}
    </div>`;
  document.body.appendChild(viewer);
  document.body.classList.add("map-open");

  const scroll = viewer.querySelector<HTMLElement>(".map-viewer__scroll")!;
  const canvas = viewer.querySelector<HTMLElement>(".map-viewer__canvas")!;
  const close = viewer.querySelector<HTMLButtonElement>(".map-viewer__close")!;
  const ratio = map.MAP_WIDTH / map.MAP_HEIGHT;
  // Portrait screens (phones, upright tablets): full screen, the map fills the height and scrolls
  // sideways. Landscape: the whole map fits in the window, between the title bar and the legend.
  const pan = window.innerHeight > window.innerWidth;
  viewer.classList.toggle("map-viewer--pan", pan);
  const panel = viewer.querySelector<HTMLElement>(".map-viewer__panel")!;
  const body = viewer.querySelector<HTMLElement>(".map-viewer__body")!;
  const chrome = panel.offsetHeight - body.offsetHeight;
  const width = pan
    ? Math.round(scroll.clientHeight * ratio)
    : Math.floor(Math.min(scroll.clientWidth, (window.innerHeight - 48 - chrome) * ratio));
  canvas.style.width = `${width}px`;
  drawMap(canvas, map, district, map.MAP_WIDTH);
  const center = map.DISTRICT_CENTERS[district];
  if (center) scroll.scrollLeft = (center[0] / map.MAP_WIDTH) * width - scroll.clientWidth / 2;
  // The swipe hint shows only where the map is wider than the screen, until the first swipe.
  if (width > scroll.clientWidth + 4) {
    viewer.classList.add("can-pan");
    const start = scroll.scrollLeft;
    const onPan = () => {
      if (Math.abs(scroll.scrollLeft - start) < 24) return;
      viewer.classList.remove("can-pan");
      scroll.removeEventListener("scroll", onPan);
    };
    scroll.addEventListener("scroll", onPan, { passive: true });
  }
  requestAnimationFrame(() => viewer.classList.add("is-open"));
  close.focus({ preventScroll: true });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") dismiss();
    if (e.key !== "Tab") return;
    // Keep focus inside the dialog.
    const focusable = [...viewer.querySelectorAll<HTMLElement>("a[href], button")];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  function dismiss(): void {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("popstate", dismiss);
    document.body.classList.remove("map-open");
    viewer.remove();
    if (opener.isConnected) opener.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", onKey);
  window.addEventListener("popstate", dismiss);
  close.addEventListener("click", dismiss);
  // A tap on the dimmed backdrop (outside the panel) closes it too.
  viewer.addEventListener("click", (e) => {
    if (e.target === viewer) dismiss();
  });
}

export function initProjectMap(root: ParentNode): void {
  const figure = root.querySelector<HTMLElement>(".project-map");
  if (!figure) return;
  const draw = async () => {
    const map = await loadMap();
    const district = figure.dataset.district ?? "";
    const canvas = figure.querySelector<HTMLElement>(".project-map__canvas");
    if (!map.DISTRICT_CENTERS[district] || !canvas) {
      figure.remove();
      return;
    }
    drawMap(canvas, map, district, window.matchMedia(PHONE_QUERY).matches ? VIEW_WIDTH_PHONE : VIEW_WIDTH);
    figure.classList.add("is-ready");
  };

  const expand = figure.querySelector<HTMLButtonElement>(".project-map__expand")!;
  const open = async (opener: HTMLElement) => openViewer(figure, await loadMap(), opener);
  expand.addEventListener("click", () => void open(expand));
  figure.querySelector(".project-map__canvas")!.addEventListener("click", () => void open(expand));

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
