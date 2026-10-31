// Animated tower crane beside the home hero text: it lifts stone blocks from a pile and
// lays them on a building under construction, one row at a time, then starts over.
// Pure SVG drawn once; a requestAnimationFrame loop moves the trolley, the hook and the
// load. Runs only while the scene is on screen; static with prefers-reduced-motion.

const GROUND = 350;
const BLOCK_H = 16;
const COLUMNS = [254, 284, 314, 344]; // left edge of each building block (28 wide)
const BUILT_ROWS = 5; // rows already standing
const NEW_ROWS = 3; // rows the crane adds each loop
const PILE_X = 150; // centre of the stone pile
const PILE_TOP = 302; // top of the block the crane picks up
const HOOK_REST = 118;
const SLING = 14; // hook top to load top

// One cycle (ms): to the pile, down, grab, up, across, down, release, up.
const STEPS = [1200, 800, 300, 800, 1400, 1000, 300, 700];
const CYCLE = STEPS.reduce((a, b) => a + b, 0);
const NEW_BLOCKS = NEW_ROWS * COLUMNS.length;
const HOLD = 2600;
const FADE = 700;
const LOOP = NEW_BLOCKS * CYCLE + HOLD + FADE;

const rowTop = (row: number) => GROUND - BLOCK_H * (row + 1);
const centre = (col: number) => COLUMNS[col] + 14;

function zigzag(x1: number, x2: number, y1: number, y2: number, step: number, vertical: boolean): string {
  const pts: string[] = [];
  if (vertical) {
    for (let y = y1, i = 0; y >= y2; y -= step, i++) pts.push(`${i % 2 ? x2 : x1},${y}`);
  } else {
    for (let x = x1, i = 0; x <= x2; x += step, i++) pts.push(`${x},${i % 2 ? y2 : y1}`);
  }
  return pts.join(" ");
}

function block(x: number, y: number, attrs = ""): string {
  return `<g ${attrs}><rect class="hero-crane__stone" x="${x}" y="${y}" width="28" height="15" rx="1.5"/>` +
    `<rect class="hero-crane__window" x="${x + 10}" y="${y + 4.5}" width="8" height="6"/></g>`;
}

export function renderHeroCrane(): string {
  // A few windows of the finished floors are lit, in a fixed pattern.
  const lit = new Set(["0-1", "1-3", "2-0", "3-2", "4-1", "4-3", "1-0"]);
  let built = "";
  for (let r = 0; r < BUILT_ROWS; r++) {
    for (let c = 0; c < COLUMNS.length; c++) {
      built += block(COLUMNS[c], rowTop(r), lit.has(`${r}-${c}`) ? `class="is-lit"` : "");
    }
  }
  let added = "";
  for (let i = 0; i < NEW_BLOCKS; i++) {
    const r = BUILT_ROWS + Math.floor(i / COLUMNS.length);
    added += block(COLUMNS[i % COLUMNS.length], rowTop(r), `data-crane-block="${i}" class="is-hidden"`);
  }
  // Scaffolding around the floors still to be built.
  const top = rowTop(BUILT_ROWS + NEW_ROWS - 1) - 6;
  let scaffold = `<line x1="250" y1="${GROUND}" x2="250" y2="${top}"/><line x1="376" y1="${GROUND}" x2="376" y2="${top}"/>`;
  for (let r = BUILT_ROWS; r <= BUILT_ROWS + NEW_ROWS; r++) {
    const y = r === BUILT_ROWS + NEW_ROWS ? top : rowTop(r - 1);
    scaffold += `<line x1="246" y1="${y}" x2="380" y2="${y}"/>`;
  }
  const pile = [
    [110, 334], [137, 334], [164, 334],
    [124, 318], [151, 318],
  ].map(([x, y]) => block(x, y)).join("");

  return `
    <div class="hero-crane" aria-hidden="true">
      <svg viewBox="0 0 420 370" focusable="false">
        <line class="hero-crane__ground" x1="0" y1="${GROUND + 0.5}" x2="420" y2="${GROUND + 0.5}"/>

        <g class="hero-crane__steel">
          <polyline points="64,${GROUND} 64,72 80,72 80,${GROUND}"/>
          <polyline class="hero-crane__lace" points="${zigzag(64, 80, GROUND, 86, 16, true)}"/>
          <polyline points="80,72 396,72 404,86 80,86"/>
          <polyline class="hero-crane__lace" points="${zigzag(80, 400, 86, 72, 18, false)}"/>
          <polyline points="64,76 14,76 14,86 64,86"/>
          <polyline class="hero-crane__lace" points="${zigzag(14, 64, 86, 76, 12.5, false)}"/>
          <polyline points="64,72 72,30 80,72"/>
          <line class="hero-crane__tie" x1="72" y1="30" x2="330" y2="72"/>
          <line class="hero-crane__tie" x1="72" y1="30" x2="16" y2="76"/>
          <rect class="hero-crane__weight" x="16" y="86" width="26" height="22" rx="1"/>
          <rect class="hero-crane__cab" x="80" y="86" width="17" height="17" rx="2"/>
          <rect class="hero-crane__glass" x="86" y="90" width="8" height="7" rx="1"/>
          <line x1="56" y1="${GROUND}" x2="88" y2="${GROUND}" stroke-width="4"/>
        </g>
        <circle class="hero-crane__beacon" cx="72" cy="27" r="2.6"/>

        <g class="hero-crane__pile">${pile}<g data-crane-pile-top>${block(137, PILE_TOP)}</g></g>
        <g class="hero-crane__scaffold">${scaffold}</g>
        <g class="hero-crane__building">${built}${added}</g>

        <g data-crane-trolley>
          <rect class="hero-crane__trolley" x="-9" y="86" width="18" height="6" rx="1"/>
        </g>
        <line class="hero-crane__cable" data-crane-cable x1="0" y1="92" x2="0" y2="${HOOK_REST}"/>
        <g data-crane-hook>
          <rect class="hero-crane__hook" x="-5" y="0" width="10" height="7" rx="1.5"/>
          <g data-crane-load>
            <polyline class="hero-crane__sling" points="-11,${SLING} 0,7 11,${SLING}"/>
            ${block(-14, SLING)}
          </g>
        </g>
      </svg>
    </div>`;
}

const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * ease(Math.min(1, Math.max(0, p)));

interface Frame {
  x: number;
  hook: number;
  carrying: boolean;
  swing: number;
  placed: number;
  pileTop: number; // opacity of the block waiting on the pile
  fade: number; // opacity of the added rows
}

function frameAt(t: number): Frame {
  const last = NEW_BLOCKS - 1;
  const lastX = centre(last % COLUMNS.length);
  if (t >= NEW_BLOCKS * CYCLE) {
    const after = t - NEW_BLOCKS * CYCLE;
    const fade = after < HOLD ? 1 : 1 - Math.min(1, (after - HOLD) / FADE);
    return { x: lastX, hook: HOOK_REST, carrying: false, swing: 0, placed: NEW_BLOCKS, pileTop: 1, fade };
  }
  const k = Math.floor(t / CYCLE);
  let u = t - k * CYCLE;
  const fromX = k === 0 ? lastX : centre((k - 1) % COLUMNS.length);
  const toX = centre(k % COLUMNS.length);
  const slot = rowTop(BUILT_ROWS + Math.floor(k / COLUMNS.length)) - SLING;
  const pick = PILE_TOP - SLING;
  const f: Frame = { x: fromX, hook: HOOK_REST, carrying: false, swing: 0, placed: k, pileTop: 1, fade: 1 };
  const step = (i: number) => {
    const d = STEPS[i];
    if (u < d) return u / d;
    u -= d;
    return -1;
  };
  let p: number;
  if ((p = step(0)) >= 0) { f.x = lerp(fromX, PILE_X, p); return f; }
  f.x = PILE_X;
  if ((p = step(1)) >= 0) { f.hook = lerp(HOOK_REST, pick, p); return f; }
  if ((p = step(2)) >= 0) { f.hook = pick; f.carrying = p > 0.5; return f; }
  f.carrying = true;
  f.pileTop = 0;
  if ((p = step(3)) >= 0) { f.hook = lerp(pick, HOOK_REST, p); return f; }
  const dir = Math.sign(toX - PILE_X) || 1;
  if ((p = step(4)) >= 0) {
    f.x = lerp(PILE_X, toX, p);
    f.swing = -dir * 5 * Math.sin(Math.PI * p);
    return f;
  }
  f.x = toX;
  if ((p = step(5)) >= 0) {
    f.hook = lerp(HOOK_REST, slot, p);
    f.swing = dir * 2.5 * Math.sin(p * Math.PI * 3) * Math.exp(-3 * p);
    return f;
  }
  f.hook = slot;
  if ((p = step(6)) >= 0) { f.placed = k + (p > 0.5 ? 1 : 0); f.carrying = p <= 0.5; return f; }
  f.carrying = false;
  f.placed = k + 1;
  p = step(7);
  f.hook = lerp(slot, HOOK_REST, p < 0 ? 1 : p);
  f.pileTop = p < 0 ? 1 : p;
  return f;
}

export function initHeroCrane(root: ParentNode): void {
  const scene = root.querySelector<HTMLElement>(".hero-crane");
  if (!scene) return;
  const q = <T extends Element>(sel: string) => scene.querySelector<T>(sel)!;
  const trolley = q<SVGGElement>("[data-crane-trolley]");
  const cable = q<SVGLineElement>("[data-crane-cable]");
  const hook = q<SVGGElement>("[data-crane-hook]");
  const load = q<SVGGElement>("[data-crane-load]");
  const pileTop = q<SVGGElement>("[data-crane-pile-top]");
  const blocks = [...scene.querySelectorAll<SVGGElement>("[data-crane-block]")];

  const draw = (f: Frame) => {
    trolley.setAttribute("transform", `translate(${f.x.toFixed(2)} 0)`);
    cable.setAttribute("x1", f.x.toFixed(2));
    cable.setAttribute("x2", f.x.toFixed(2));
    cable.setAttribute("y2", f.hook.toFixed(2));
    hook.setAttribute("transform", `translate(${f.x.toFixed(2)} ${f.hook.toFixed(2)}) rotate(${f.swing.toFixed(2)})`);
    load.style.opacity = f.carrying ? "1" : "0";
    pileTop.style.opacity = f.pileTop.toFixed(2);
    blocks.forEach((b, i) => {
      b.classList.toggle("is-hidden", i >= f.placed);
      b.style.opacity = f.fade < 1 ? f.fade.toFixed(2) : "";
      // A row's windows light up once the row is complete.
      const rowDone = f.placed >= (Math.floor(i / COLUMNS.length) + 1) * COLUMNS.length;
      b.classList.toggle("is-lit", rowDone && f.fade === 1 && i % 3 !== 1);
    });
  };

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof IntersectionObserver === "undefined") {
    draw({ ...frameAt(NEW_BLOCKS * CYCLE), x: PILE_X });
    return;
  }
  draw(frameAt(0));

  let elapsed = 0;
  let lastTs = 0;
  let raf = 0;
  let onScreen = false;
  const tick = (ts: number) => {
    if (!scene.isConnected) return stop(true);
    if (lastTs) elapsed = (elapsed + Math.min(ts - lastTs, 100)) % LOOP;
    lastTs = ts;
    draw(frameAt(elapsed));
    raf = requestAnimationFrame(tick);
  };
  const start = () => {
    if (raf || !onScreen || document.hidden) return;
    lastTs = 0;
    raf = requestAnimationFrame(tick);
  };
  const stop = (forever = false) => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (forever) {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
  const onVisibility = () => (document.hidden ? stop() : start());
  const observer = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) start();
    else stop();
  });
  observer.observe(scene);
  document.addEventListener("visibilitychange", onVisibility);
}
