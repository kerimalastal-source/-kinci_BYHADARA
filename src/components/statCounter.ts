import { statIcon } from "./statIcons";

interface ParsedStat {
  prefix: string;
  suffix: string;
  target: number;
  /** Thousands separator as written ("," or a French/Russian space), "" if none. */
  separator: string;
  decimals: number;
}

function parseStat(raw: string): ParsedStat | null {
  // "60,000", "60 000" (plain, no-break or narrow space) or "576.63".
  const match = raw.match(/\d{1,3}(?:([, \u00a0\u202f])\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/);
  if (!match) return null;
  const numStr = match[0];
  const prefix = raw.slice(0, match.index);
  const suffix = raw.slice((match.index ?? 0) + numStr.length);
  const separator = match[1] ?? "";
  const normalized = separator ? numStr.split(separator).join("") : numStr;
  const decimals = normalized.includes(".") ? normalized.split(".")[1].length : 0;
  const target = parseFloat(normalized);
  return { prefix, suffix, target, separator, decimals };
}

function formatNumber(n: number, parsed: ParsedStat): string {
  const rounded = parsed.decimals > 0 ? n.toFixed(parsed.decimals) : String(Math.round(n));
  if (!parsed.separator) return rounded;
  const [intPart, decPart] = rounded.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, parsed.separator);
  return decPart ? `${grouped}.${decPart}` : grouped;
}

/** "60,000+ m²": the unit after the number and its symbols is set smaller so the figure stays on one line. */
function render(el: HTMLElement, parsed: ParsedStat, value: number): void {
  const [, symbols, unit] = parsed.suffix.match(/^([^\s\p{L}]*)(.*)$/u) ?? ["", parsed.suffix, ""];
  el.innerHTML = `${parsed.prefix}${formatNumber(value, parsed)}${symbols}${unit.trim() ? `<span class="stat-unit">${unit}</span>` : ""}`;
}

function animateElement(el: HTMLElement, raw: string): void {
  const parsed = parseStat(raw);
  if (!parsed) {
    el.textContent = raw;
    return;
  }
  const duration = 1400;
  const start = performance.now();

  function tick(now: number): void {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = parsed!.target * eased;
    render(el, parsed!, current);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/** Observes all [data-stat-value] elements inside container and animates them into view once. */
export function initStatCounters(container: ParentNode): void {
  const elements = container.querySelectorAll<HTMLElement>("[data-stat-value]");
  if (elements.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const raw = el.dataset.statValue ?? "";
          animateElement(el, raw);
          observer.unobserve(el);
        }
      }
    },
    { threshold: 0.4 }
  );

  elements.forEach((el) => observer.observe(el));
}

export interface StatTile {
  value: string;
  label: string;
  /** A `statIcon()` key; omitted → no icon. */
  icon?: string;
}

/** The counted number tiles of the home and About pages ("HADARA in Numbers"). */
export function renderStatTiles(stats: StatTile[]): string {
  return `
        <div class="stats-grid stats-grid--${stats.length}">
          ${stats
            .map(
              (s) => `
            <div class="stat-tile">
              ${s.icon ? `<span class="stat-tile__icon">${statIcon(s.icon)}</span>` : ""}
              <span class="stat-tile__value" data-stat-value="${s.value}">0</span>
              <span class="stat-tile__label">${s.label}</span>
            </div>`
            )
            .join("")}
        </div>`;
}
