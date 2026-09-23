interface ParsedStat {
  prefix: string;
  suffix: string;
  target: number;
  useComma: boolean;
  decimals: number;
}

function parseStat(raw: string): ParsedStat | null {
  const match = raw.match(/[\d]+(?:[.,]\d+)*/);
  if (!match) return null;
  const numStr = match[0];
  const prefix = raw.slice(0, match.index);
  const suffix = raw.slice((match.index ?? 0) + numStr.length);
  const useComma = numStr.includes(",");
  const normalized = numStr.replace(/,/g, "");
  const decimals = normalized.includes(".") ? normalized.split(".")[1].length : 0;
  const target = parseFloat(normalized);
  return { prefix, suffix, target, useComma, decimals };
}

function formatNumber(n: number, parsed: ParsedStat): string {
  const rounded = parsed.decimals > 0 ? n.toFixed(parsed.decimals) : String(Math.round(n));
  if (!parsed.useComma) return rounded;
  const [intPart, decPart] = rounded.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart ? `${withCommas}.${decPart}` : withCommas;
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
    el.textContent = `${parsed!.prefix}${formatNumber(current, parsed!)}${parsed!.suffix}`;
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
