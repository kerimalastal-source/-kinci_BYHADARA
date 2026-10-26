import { t, tRaw, link, placeName, getProjectContent, intlTag } from "../i18n";
import type { Project } from "../data/projects";
import { projectStatusLabel } from "./projectCard";
import { photoAttrs } from "../utils/responsiveImage";
import { BRIDGE_ICON, POI_ICONS, ROADS, icon, loadMap, overlaps, type Box, type MapData } from "./projectMap";

/**
 * The projects page map (owner's request 2026-10-23): every HADARA project on one map of
 * Istanbul, grouped by district — a gold pin with the number of projects on each district, which
 * opens the list of its projects. Around them the landmarks a buyer finds their way by: both
 * airports, the Bosphorus and its bridges, the E5 / TEM / Northern Marmara motorways, the big
 * malls and the major hospitals. Drawn on the dark hero, from the same data as a project's own map.
 */

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Phones get a closer slice around the projects (from Büyükçekmece to Pendik); wider screens see more of the city (`wideView`). */
const VIEW_PHONE: View = { x: 270, y: 190, w: 440, h: 330 };
const PHONE_QUERY = "(max-width: 640px)";
/** Below this canvas width the project list opens under the map instead of beside the pin. */
const PANEL_BELOW = 600;
/** The full-width map: a fixed band from Istanbul Airport down to Sabiha Gökçen, as wide as the screen allows (and never taller than ~600px). */
function wideView(width: number): View {
  const h = 272;
  const height = Math.min(600, Math.max(360, width * 0.45));
  const w = Math.min(1000, (h * width) / height);
  const x = Math.min(Math.max(0, 470 - w / 2), 1000 - w);
  return { x, y: 192, w, h };
}
const MARMARA_LABEL = { x: 404, y: 428 };
/** When two landmarks would sit on top of each other, the one earlier here stays. */
const KIND_ORDER: Record<string, number> = { airport: 0, hospital: 1, mall: 2, landmark: 3 };

interface Group {
  district: string;
  projects: Project[];
}

/** Projects by the district drawn on the map, the busiest first. */
function groupProjects(projects: Project[]): Group[] {
  const byDistrict = new Map<string, Project[]>();
  for (const p of projects) {
    const district = p.mapDistrict ?? p.district;
    byDistrict.set(district, [...(byDistrict.get(district) ?? []), p]);
  }
  return [...byDistrict.entries()].map(([district, list]) => ({ district, projects: list })).sort((a, b) => b.projects.length - a.projects.length);
}

/** "17 projects", "٧ مناطق": the plural form of the page language (`<key>.one|two|few|many|other`). */
function counted(key: string, count: number): string {
  const forms = tRaw<Record<string, string>>(key) ?? {};
  const form = new Intl.PluralRules(intlTag()).select(count);
  return (forms[form] ?? forms.other ?? "").replace("{count}", `<bdi dir="ltr">${count}</bdi>`);
}

const LEGEND_KINDS = ["airport", "mall", "hospital"] as const;

export function renderProjectsAtlas(projects: Project[]): string {
  const groups = groupProjects(projects);
  return `
      <figure class="atlas" data-atlas>
        <figcaption class="atlas__head">
          <span class="atlas__title">${t("projects.atlas.title")}</span>
          <span class="atlas__summary">${counted("projects.atlas.projects", projects.length)} · ${counted("projects.atlas.districts", groups.length)}</span>
        </figcaption>
        <div class="atlas__stage">
          <div class="atlas__canvas"></div>
          <div class="atlas__panel" data-atlas-panel hidden></div>
        </div>
        <div class="atlas__chips">
          ${groups
            .map(
              (g) =>
                `<button type="button" class="atlas__chip" data-atlas-district="${g.district}" aria-pressed="false">${placeName(g.district)}<span class="atlas__chip-count" dir="ltr">${g.projects.length}</span></button>`
            )
            .join("")}
        </div>
        <ul class="atlas__legend">
          <li><span class="atlas__legend-pin" aria-hidden="true"></span>${t("projects.atlas.legendProjects")}</li>
          ${LEGEND_KINDS.map((k) => `<li><span class="atlas__legend-icon atlas__legend-icon--${k}">${icon(POI_ICONS[k], 12)}</span>${t(`projects.atlas.legend.${k}`)}</li>`).join("")}
          <li>${BRIDGE_ICON}${t("projectDetail.map.bridges")}</li>
          ${ROADS.map((r) => `<li><span class="map-shield map-shield--${r.key}" translate="no">${r.shield}</span>${t(`projectDetail.map.roads.${r.key}`)}</li>`).join("")}
        </ul>
      </figure>`;
}

/** Draws the map, its pins and landmarks into `canvas` for the given slice. */
function drawAtlas(canvas: HTMLElement, map: MapData, view: View, groups: Group[], active: string | null): void {
  const { DISTRICT_PATHS, DISTRICT_CENTERS } = map;
  const scale = canvas.clientWidth / view.w;
  const frame = { width: canvas.clientWidth, height: view.h * scale };
  const px = (x: number, y: number) => ({ x: (x - view.x) * scale, y: (y - view.y) * scale });
  const pct = (x: number, y: number) => `left:${(((x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((y - view.y) / view.h) * 100).toFixed(2)}%`;
  const inView = (x: number, y: number, margin = 10) =>
    x > view.x + margin && x < view.x + view.w - margin && y > view.y + margin && y < view.y + view.h - margin;
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
  const taken: Box[] = [];
  const fits = (b: Box) => b.left >= 4 && b.right <= frame.width - 4 && b.top >= 4 && b.bottom <= frame.height - 4 && !taken.some((o) => overlaps(o, b));

  // Pins first (the busiest district first), then the landmarks at their real spots, then the
  // pins' names, the landmarks' names and the road shields wherever they still fit.
  const pins = groups
    .filter((g) => DISTRICT_CENTERS[g.district])
    .map((g) => {
      const [x, y] = DISTRICT_CENTERS[g.district];
      const p = px(x, y);
      taken.push({ left: p.x - 19, right: p.x + 19, top: p.y - 19, bottom: p.y + 19 });
      return { ...g, x, y, p };
    });
  const spots = map.LANDMARKS.filter((l) => inView(l.x, l.y))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
    .flatMap((l) => {
      const p = px(l.x, l.y);
      const r = l.kind === "landmark" ? 6 : 10;
      const dot: Box = { left: p.x - r, right: p.x + r, top: p.y - r, bottom: p.y + r };
      if (!fits(dot)) return [];
      taken.push(dot);
      return [{ ...l, p, dot }];
    });

  const pinHtml = pins
    .map(({ district, projects, x, y, p }) => {
      const name = placeName(district);
      const w = measure("atlas-pin__label", name);
      const options: Box[] = [
        { left: p.x - w / 2, right: p.x + w / 2, top: p.y - 46, bottom: p.y - 22 },
        { left: p.x - w / 2, right: p.x + w / 2, top: p.y + 22, bottom: p.y + 46 },
        { left: p.x + 22, right: p.x + 22 + w, top: p.y - 12, bottom: p.y + 12 },
        { left: p.x - 22 - w, right: p.x - 22, top: p.y - 12, bottom: p.y + 12 },
        { left: p.x + 8, right: p.x + 8 + w, top: p.y - 44, bottom: p.y - 20 },
        { left: p.x - 8 - w, right: p.x - 8, top: p.y - 44, bottom: p.y - 20 },
        { left: p.x + 8, right: p.x + 8 + w, top: p.y + 20, bottom: p.y + 44 },
        { left: p.x - 8 - w, right: p.x - 8, top: p.y + 20, bottom: p.y + 44 }
      ];
      // Slid back inside the map's edges if needed; with no free spot at all (a crowded phone map) the
      // name is left out rather than covering another pin, and the district buttons under the map name it.
      const shift = (b: Box) => {
        const dx = Math.max(4 - b.left, Math.min(0, frame.width - 4 - b.right));
        return { ...b, left: b.left + dx, right: b.right + dx };
      };
      const box = options.find(fits) ?? options.map(shift).find(fits);
      if (box) taken.push(box);
      const label = `${name}: ${projects.length}`;
      return `
      <button type="button" class="atlas-pin${district === active ? " is-active" : ""}" style="${pct(x, y)}" data-atlas-district="${district}" aria-expanded="${district === active}" aria-label="${label}">
        <span class="atlas-pin__dot" dir="ltr">${projects.length}</span>
        ${box ? `<span class="atlas-pin__label" style="left:${(box.left - p.x).toFixed(1)}px;top:${(box.top - p.y).toFixed(1)}px" aria-hidden="true">${name}</span>` : ""}
      </button>`;
    })
    .join("");

  const pois = spots
    .map(({ key, kind, x, y, p, dot }) => {
      const text = t(`projectDetail.map.${key}`);
      const w = measure("atlas-poi__label", text);
      const row = (left: number): Box => ({ left, right: left + w, top: p.y - 9, bottom: p.y + 9 });
      const col = (top: number): Box => ({ left: p.x - w / 2, right: p.x + w / 2, top, bottom: top + 18 });
      const box = [row(dot.right + 3), row(dot.left - 3 - w), col(dot.bottom + 2), col(dot.top - 20)].find(fits);
      if (box) taken.push(box);
      return `
      <span class="atlas-poi atlas-poi--${kind}" style="${pct(x, y)}">
        <span class="atlas-poi__icon">${icon(POI_ICONS[kind], kind === "hospital" ? 11 : 12)}</span>
        ${
          box
            ? `<span class="atlas-poi__label" style="left:${(box.left - p.x).toFixed(1)}px;top:${(box.top - p.y).toFixed(1)}px">${text}</span>`
            : `<span class="visually-hidden">${text}</span>`
        }
      </span>`;
    })
    .join("");

  const shields = ROADS.map((r) => {
    const spot = map.ROAD_SHIELDS[r.key]?.find(([x, y]) => {
      if (!inView(x, y, 18)) return false;
      const p = px(x, y);
      const box = { left: p.x - 16, right: p.x + 16, top: p.y - 10, bottom: p.y + 10 };
      if (!fits(box)) return false;
      taken.push(box);
      return true;
    });
    return spot ? `<span class="map-shield map-shield--${r.key} atlas__shield" style="${pct(spot[0], spot[1])}" translate="no">${r.shield}</span>` : "";
  }).join("");

  const projectDistricts = new Set(pins.map((p) => p.district));
  const land = Object.entries(DISTRICT_PATHS)
    .map(([name, d]) => `<path d="${d}"${projectDistricts.has(name) ? ` class="atlas__district${name === active ? " is-active" : ""}" data-district="${name}"` : ""}/>`)
    .join("");
  const roads = Object.values(map.ROAD_PATHS);
  const bridges = map.BRIDGES.map(([[ax, ay], [bx, by]]) => `M${ax},${ay}L${bx},${by}`).join("");
  const strait = map.BOSPHORUS_LABEL;
  const labels = [
    inView(strait.x, strait.y, 24)
      ? `<span class="atlas__strait" style="${pct(strait.x, strait.y)};--angle:${strait.angle}deg">${t("projectDetail.map.bosphorus")}</span>`
      : "",
    inView(MARMARA_LABEL.x, MARMARA_LABEL.y, 8) ? `<span class="atlas__sea" style="${pct(MARMARA_LABEL.x, MARMARA_LABEL.y)}">${t("projectDetail.map.marmara")}</span>` : ""
  ].join("");

  canvas.innerHTML = `
    <svg class="atlas__svg" viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <g class="atlas__land">${land}</g>
      <g class="atlas__roads">
        ${roads.map((d) => `<path class="atlas__road-casing" d="${d}"/>`).join("")}
        ${roads.map((d) => `<path class="atlas__road" d="${d}"/>`).join("")}
      </g>
      <path class="atlas__bridge" d="${bridges}"/>
    </svg>
    ${labels}
    ${shields}
    ${pois}
    ${pinHtml}`;
}

/** The selected district's projects: beside its pin on wide maps, under the map on phones. */
function panelHtml(group: Group): string {
  return `
    <div class="atlas-card__head">
      <div>
        <strong>${placeName(group.district)}</strong>
        <span>${counted("projects.atlas.projects", group.projects.length)}</span>
      </div>
      <button type="button" class="atlas-card__close" data-atlas-close aria-label="${t("projects.atlas.close")}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <ul class="atlas-card__list">
      ${group.projects
        .map((p) => {
          const name = getProjectContent(p.slug).name;
          const status = p.soldOut ? t("common.soldOut") : projectStatusLabel(p.status);
          return `<li>
            <a class="atlas-card__project" href="${link(`/projects/${p.slug}`)}">
              <img ${photoAttrs(p.coverImage, "64px")} alt="" width="64" height="48" loading="lazy" decoding="async" />
              <span><b>${name}</b><small>${placeName(p.district)} · ${status}</small></span>
            </a>
          </li>`;
        })
        .join("")}
    </ul>`;
}

export function initProjectsAtlas(root: ParentNode, projects: Project[]): void {
  const figure = root.querySelector<HTMLElement>("[data-atlas]");
  const canvas = figure?.querySelector<HTMLElement>(".atlas__canvas");
  const panel = figure?.querySelector<HTMLElement>("[data-atlas-panel]");
  if (!figure || !canvas || !panel) return;
  const groups = groupProjects(projects);
  let map: MapData | null = null;
  let active: string | null = null;
  let drawnWidth = 0;

  const view = () => (window.matchMedia(PHONE_QUERY).matches ? VIEW_PHONE : wideView(canvas.clientWidth));

  const placePanel = () => {
    const group = groups.find((g) => g.district === active);
    figure.querySelectorAll<HTMLElement>(".atlas__chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.atlasDistrict === active)));
    if (!group) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    panel.innerHTML = panelHtml(group);
    panel.hidden = false;
    const below = canvas.clientWidth < PANEL_BELOW;
    panel.classList.toggle("atlas__panel--below", below);
    if (below) {
      panel.style.left = panel.style.top = "";
      return;
    }
    // Beside the pin, on whichever side has room, kept inside the map.
    const pin = canvas.querySelector<HTMLElement>(`.atlas-pin[data-atlas-district="${CSS.escape(group.district)}"]`);
    if (!pin) return;
    const x = pin.offsetLeft;
    const y = pin.offsetTop;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const left = x + 26 + w <= canvas.clientWidth - 8 ? x + 26 : Math.max(8, x - 26 - w);
    const top = Math.min(Math.max(8, y - h / 2), Math.max(8, canvas.clientHeight - h - 8));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };

  const draw = () => {
    if (!map || canvas.clientWidth === 0) return;
    const v = view();
    canvas.style.aspectRatio = `${v.w} / ${v.h}`;
    drawAtlas(canvas, map, v, groups, active);
    drawnWidth = canvas.clientWidth;
    figure.classList.add("is-ready");
    placePanel();
  };

  const select = (district: string | null) => {
    active = district === active ? null : district;
    canvas.querySelectorAll<HTMLElement>(".atlas-pin").forEach((pin) => {
      const on = pin.dataset.atlasDistrict === active;
      pin.classList.toggle("is-active", on);
      pin.setAttribute("aria-expanded", String(on));
    });
    canvas.querySelectorAll<SVGPathElement>(".atlas__district").forEach((path) => path.classList.toggle("is-active", path.dataset.district === active));
    placePanel();
    if (active && canvas.clientWidth < PANEL_BELOW) panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  figure.addEventListener("click", (e) => {
    const target = e.target as Element;
    if (target.closest("[data-atlas-close]")) return select(null);
    const pick = target.closest<HTMLElement>("[data-atlas-district]");
    if (pick) return select(pick.dataset.atlasDistrict ?? null);
    // A click on the map itself (not a pin or the list) closes the list.
    if (active && target.closest(".atlas__canvas")) select(null);
  });
  figure.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active) {
      const district = active;
      select(null);
      figure.querySelector<HTMLElement>(`.atlas-pin[data-atlas-district="${CSS.escape(district)}"]`)?.focus();
    }
  });

  // Labels are placed in px, so the map is redrawn when its width changes.
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      if (canvas.clientWidth !== drawnWidth) draw();
    }).observe(canvas);
  }
  void loadMap().then((data) => {
    map = data;
    draw();
  });
}
