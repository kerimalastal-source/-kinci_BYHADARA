import { escapeHtml } from "../../utils/html";

/**
 * Visitors per day on the admin statistics page: a smooth line with a soft fill, round
 * gridlines, gold marks on the days someone got in touch, and a card that follows the
 * pointer (or the arrow keys) with the day's numbers. The chart reads left to right in
 * every language; the card follows the page's direction. Since the statistics redesign
 * (phase 2) it can also draw the previous period as a grey dashed line on the same scale and
 * write the number of visits that got in touch under the axis.
 */

export interface ChartDay {
  /** "2026-10-14". */
  day: string;
  visitors: number;
  /** Null before migration 0021 (the old function gave no pages). */
  pages: number | null;
  contacted: number;
  /** The same day of the previous period, when that period was fully recorded. */
  prev?: number;
}

export interface ChartText {
  /** The full date in the card: "Wednesday, October 14". */
  date: (day: string) => string;
  /** The label under the axis, or "" for none. */
  axis: (day: string, i: number, n: number) => string;
  /** Labels hidden on a phone, where they would run into each other. */
  minor: (i: number, n: number) => boolean;
  num: (n: number) => string;
  visitors: string;
  pages: string;
  contacted: string;
  label: string;
  /** The card's row for the previous period. */
  previous?: string;
}

const W = 1000;
const H = 240;

/** 1, 2, 2.5 or 5 times a power of ten: about four gridlines up to the busiest day. */
function niceStep(max: number): number {
  const raw = Math.max(max, 4) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  return step < 1 ? 1 : step;
}

/** A smooth path through the points that never overshoots (monotone cubic, as d3's curveMonotoneX). */
function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (n < 2) return n ? `M${pts[0][0]},${pts[0][1]}` : "";
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const tangent = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    const a = slope[i - 1];
    const b = slope[i];
    return a * b <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a + (dx[i] + 2 * dx[i - 1]) / b);
  });
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f(pts[i][0] + h)},${f(pts[i][1] + h * tangent[i])} ${f(pts[i + 1][0] - h)},${f(pts[i + 1][1] - h * tangent[i + 1])} ${f(pts[i + 1][0])},${f(pts[i + 1][1])}`;
  }
  return d;
}

export function visitorsChart(days: ChartDay[], text: ChartText): string {
  const n = days.length;
  const hasPrev = days.some((d) => d.prev !== undefined);
  const busiest = Math.max(...days.map((d) => d.visitors), 0);
  const scaleMax = Math.max(busiest, ...days.map((d) => d.prev ?? 0));
  const step = niceStep(scaleMax);
  const top = Math.max(step, Math.ceil(scaleMax / step) * step);
  const xPct = (i: number) => ((i + 0.5) / n) * 100;
  const yPct = (v: number) => (v / top) * 100;
  const pts: [number, number][] = days.map((d, i) => [(xPct(i) / 100) * W, H - (yPct(d.visitors) / 100) * H]);
  const line = monotonePath(pts);
  const area = line ? `${line}L${pts[n - 1][0].toFixed(1)},${H}L${pts[0][0].toFixed(1)},${H}Z` : "";
  const prevLine = hasPrev ? monotonePath(days.map((d, i) => [(xPct(i) / 100) * W, H - (yPct(d.prev ?? 0) / 100) * H])) : "";
  const peak = days.reduce((best, d, i) => (d.visitors > days[best].visitors ? i : best), 0);

  const ticks = [];
  for (let v = 0; v <= top; v += step) {
    ticks.push(`<span class="vchart__tick${v === 0 ? " vchart__tick--base" : ""}" style="bottom:${yPct(v)}%"><b>${escapeHtml(text.num(v))}</b></span>`);
  }
  const marks = days
    .map((d, i) => (d.contacted ? `<span class="vchart__mark" style="left:${xPct(i)}%;bottom:${yPct(d.visitors)}%"></span>` : ""))
    .join("");
  const peakLabel = busiest
    ? `<span class="vchart__peak" style="left:${xPct(peak)}%;bottom:${yPct(busiest)}%">${escapeHtml(text.num(busiest))}</span>`
    : "";
  const axis = days
    .map((d, i) => `<span class="vchart__label${text.minor(i, n) ? " vchart__label--minor" : ""}">${text.axis(d.day, i, n)}</span>`)
    .join("");
  // How many visits got in touch, under the axis (only when the days are wide enough to read).
  const counts =
    n <= 31 && days.some((d) => d.contacted)
      ? `<div class="vchart__counts${n > 14 ? " vchart__counts--dense" : ""}" aria-hidden="true">${days.map((d) => `<span>${d.contacted ? escapeHtml(text.num(d.contacted)) : ""}</span>`).join("")}</div>`
      : "";
  // What the card shows for each day, ready-made so the script needs no dictionary.
  const card = days.map((d) => ({
    date: text.date(d.day),
    rows: [
      ["visitors", text.visitors, text.num(d.visitors)],
      ...(d.prev === undefined || !text.previous ? [] : [["previous", text.previous, text.num(d.prev)]]),
      ...(d.pages === null ? [] : [["pages", text.pages, text.num(d.pages)]]),
      ["contacted", text.contacted, text.num(d.contacted)]
    ],
    y: yPct(d.visitors)
  }));

  return `<div class="vchart" dir="ltr" data-chart="${escapeHtml(JSON.stringify(card))}" data-peak="${peak}">
    <div class="vchart__plot" tabindex="0" role="img" aria-label="${escapeHtml(text.label)}">
      <div class="vchart__grid" aria-hidden="true">${ticks.join("")}</div>
      <svg class="vchart__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="vchart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#13845c" stop-opacity="0.28"/>
            <stop offset="1" stop-color="#13845c" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <path class="vchart__area" d="${area}" fill="url(#vchart-fill)"/>
        ${prevLine ? `<path class="vchart__prev" d="${prevLine}" vector-effect="non-scaling-stroke"/>` : ""}
        <path class="vchart__line" d="${line}" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="vchart__marks" aria-hidden="true">${marks}${peakLabel}</div>
      <span class="vchart__cross" aria-hidden="true"></span>
      <span class="vchart__dot" aria-hidden="true"></span>
      <div class="vchart__tip" aria-hidden="true"></div>
    </div>
    <div class="vchart__axis" aria-hidden="true">${axis}</div>
    ${counts}
  </div>`;
}

/** The card that follows the pointer, the crosshair, and the arrow keys. */
export function initVisitorsChart(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".vchart").forEach((chart) => {
    const days = JSON.parse(chart.dataset.chart ?? "[]") as { date: string; rows: [string, string, string][]; y: number }[];
    if (!days.length) return;
    const plot = chart.querySelector<HTMLElement>(".vchart__plot")!;
    const cross = chart.querySelector<HTMLElement>(".vchart__cross")!;
    const dot = chart.querySelector<HTMLElement>(".vchart__dot")!;
    const tip = chart.querySelector<HTMLElement>(".vchart__tip")!;
    tip.dir = document.documentElement.dir || "ltr";
    let current = Number(chart.dataset.peak) || 0;

    const show = (i: number) => {
      current = Math.max(0, Math.min(days.length - 1, i));
      const d = days[current];
      const x = ((current + 0.5) / days.length) * 100;
      cross.style.left = `${x}%`;
      dot.style.left = `${x}%`;
      dot.style.bottom = `${d.y}%`;
      tip.innerHTML = `<p class="vchart__tip-date">${escapeHtml(d.date)}</p>${d.rows
        .map(([key, name, value]) => `<p class="vchart__tip-row vchart__tip-row--${key}"><span>${escapeHtml(name)}</span><b dir="ltr">${escapeHtml(value)}</b></p>`)
        .join("")}`;
      chart.classList.add("is-active");
      // Beside the point, on whichever side has room, and never outside the plot.
      const width = plot.clientWidth;
      const height = plot.clientHeight;
      const px = (x / 100) * width;
      const py = height - (d.y / 100) * height;
      const gap = 14;
      const left = px + gap + tip.offsetWidth <= width ? px + gap : Math.max(0, px - gap - tip.offsetWidth);
      const topPos = Math.min(Math.max(0, py - tip.offsetHeight / 2), Math.max(0, height - tip.offsetHeight));
      tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(topPos)}px)`;
    };
    const hide = () => chart.classList.remove("is-active");
    const fromPointer = (e: PointerEvent) => {
      const rect = plot.getBoundingClientRect();
      show(Math.floor(((e.clientX - rect.left) / rect.width) * days.length));
    };

    plot.addEventListener("pointermove", fromPointer);
    plot.addEventListener("pointerdown", fromPointer);
    plot.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") hide();
    });
    plot.addEventListener("focus", () => show(current));
    plot.addEventListener("blur", hide);
    plot.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      show(current + (e.key === "ArrowRight" ? 1 : -1));
    });
  });
}

/* ---------- Real visitors without paid ads (owner's request 2026-10-24) ---------- */

export const ORGANIC_SOURCES = ["search", "direct", "posts", "social", "referral"] as const;
export type OrganicSource = (typeof ORGANIC_SOURCES)[number];

export interface OrganicChartDay {
  day: string;
  counts: Record<OrganicSource, number>;
  contacted: number;
  /** Real visits from paid ads the same day, shown in the card for comparison. */
  paid: number;
}

export interface OrganicChartText {
  date: (day: string) => string;
  axis: (day: string, i: number, n: number) => string;
  minor: (i: number, n: number) => boolean;
  num: (n: number) => string;
  /** The average with one decimal. */
  avg: (n: number) => string;
  source: (s: OrganicSource) => string;
  total: string;
  average: string;
  contacted: string;
  paid: string;
  label: string;
}

const dayTotal = (d: OrganicChartDay) => ORGANIC_SOURCES.reduce((s, k) => s + d.counts[k], 0);

/** The 7-day moving average (fewer days at the start of the period). */
export function movingAverage(values: number[], span = 7): number[] {
  return values.map((_, i) => {
    const part = values.slice(Math.max(0, i - span + 1), i + 1);
    return part.reduce((s, v) => s + v, 0) / part.length;
  });
}

/** One stacked column per day, coloured by source, with the 7-day average as a dashed line.
 * Same frame, card and keyboard as visitorsChart (initVisitorsChart drives both). */
export function organicChart(days: OrganicChartDay[], text: OrganicChartText): string {
  const n = days.length;
  const totals = days.map(dayTotal);
  const avg = movingAverage(totals);
  const scaleMax = Math.max(...totals, ...avg, 0);
  const step = niceStep(scaleMax);
  const top = Math.max(step, Math.ceil(scaleMax / step) * step);
  const xPct = (i: number) => ((i + 0.5) / n) * 100;
  const yPct = (v: number) => (v / top) * 100;
  const avgLine = monotonePath(avg.map((v, i) => [(xPct(i) / 100) * W, H - (yPct(v) / 100) * H]));

  const ticks = [];
  for (let v = 0; v <= top; v += step) {
    ticks.push(`<span class="vchart__tick${v === 0 ? " vchart__tick--base" : ""}" style="bottom:${yPct(v)}%"><b>${escapeHtml(text.num(v))}</b></span>`);
  }
  const width = Math.min(80, Math.max(30, 100 - n));
  const bars = days
    .map((d, i) => {
      let base = 0;
      const parts = ORGANIC_SOURCES.filter((k) => d.counts[k])
        .map((k) => {
          const part = `<i class="ochart__part ochart__part--${k}" style="bottom:${yPct(base)}%;height:${yPct(d.counts[k])}%"></i>`;
          base += d.counts[k];
          return part;
        })
        .join("");
      return parts ? `<span class="ochart__bar" style="left:${xPct(i)}%;width:${width / n}%">${parts}</span>` : "";
    })
    .join("");
  const marks = days
    .map((d, i) => (d.contacted ? `<span class="vchart__mark ochart__mark" style="left:${xPct(i)}%;bottom:${yPct(totals[i])}%"></span>` : ""))
    .join("");
  const axis = days
    .map((d, i) => `<span class="vchart__label${text.minor(i, n) ? " vchart__label--minor" : ""}">${text.axis(d.day, i, n)}</span>`)
    .join("");
  const card = days.map((d, i) => ({
    date: text.date(d.day),
    rows: [
      ["total", text.total, text.num(totals[i])],
      ...ORGANIC_SOURCES.filter((k) => d.counts[k]).map((k) => [k, text.source(k), text.num(d.counts[k])]),
      ["average", text.average, text.avg(avg[i])],
      ...(d.contacted ? [["contacted", text.contacted, text.num(d.contacted)]] : []),
      ...(d.paid ? [["paid", text.paid, text.num(d.paid)]] : [])
    ],
    y: yPct(totals[i])
  }));
  const peak = totals.reduce((best, v, i) => (v > totals[best] ? i : best), 0);

  return `<div class="vchart ochart" dir="ltr" data-chart="${escapeHtml(JSON.stringify(card))}" data-peak="${peak}">
    <div class="vchart__plot" tabindex="0" role="img" aria-label="${escapeHtml(text.label)}">
      <div class="vchart__grid" aria-hidden="true">${ticks.join("")}</div>
      <div class="ochart__bars" aria-hidden="true">${bars}</div>
      <svg class="vchart__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path class="ochart__avg" d="${avgLine}" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="vchart__marks" aria-hidden="true">${marks}</div>
      <span class="vchart__cross" aria-hidden="true"></span>
      <span class="vchart__dot" aria-hidden="true"></span>
      <div class="vchart__tip" aria-hidden="true"></div>
    </div>
    <div class="vchart__axis" aria-hidden="true">${axis}</div>
  </div>`;
}
