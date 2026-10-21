// HADARA "talk to us on WhatsApp" reel, 1080x1920, 40 s. render(t) draws the frame at t seconds;
// render.mjs steps t frame by frame, so every motion here is a pure function of time.
// Every claim is from the site: the 30/30 payment plan on Lotus Yasam, daily video tours,
// 14 projects, 3,100+ homes (home.stats), the WhatsApp number in floatingButtons.ts.
const W = 1080, H = 1920, CY = H * 0.44;
const app = document.getElementById("app");
const WA = document.getElementById("wa-svg").innerHTML;
const IMG = (p) => `../../../public/images/projects/${p}-320.webp`;
const ICON = {
  call: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/><circle cx="8.5" cy="12" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="15.5" cy="12" r=".9" fill="currentColor"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5z"/></svg>`
};

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const out3 = (x) => 1 - Math.pow(1 - x, 3);
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
// Fade in over [a, a+i], out over [b-o, b].
const vis = (t, a, b, i = 0.35, o = 0.35) => Math.min(prog(t, a, a + i), 1 - prog(t, b - o, b));
const el = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; };
const layer = (cls = "") => { const d = el(`<div class="layer ${cls}"></div>`); app.append(d); return d; };
const brand = () => `<div class="brand"><img src="../../../public/logo-dark.png"><div class="w"><b>HADARA</b><i>REAL ESTATE</i></div></div>`;

// Orb: a ball of blurred colour blobs in the brand palette, slowly swirling.
function orbHTML() {
  return `<div class="orb"><div class="s"></div></div>`;
}
function paintOrb(o, t, size, x = W / 2, y = CY, hue = 0) {
  o.style.width = o.style.height = size + "px";
  o.style.left = x + "px"; o.style.top = y + "px";
  const a = t * 0.9 + hue, r = 26;
  const p = (k, ph) => `${50 + r * Math.cos(a * k + ph)}% ${50 + r * Math.sin(a * k * 1.3 + ph)}%`;
  o.firstChild.style.background = [
    `radial-gradient(circle at ${p(1, 0)}, #f7ecd2 0 14%, transparent 34%)`,
    `radial-gradient(circle at ${p(0.8, 2.1)}, #c9a24b 0 18%, transparent 46%)`,
    `radial-gradient(circle at ${p(1.2, 4.2)}, #2f6b55 0 20%, transparent 50%)`,
    `radial-gradient(circle at ${p(0.6, 5.3)}, #0f2b21 0 22%, transparent 55%)`,
    `#7c8f6a`
  ].join(",");
}

// ---------- scenes ----------
const S = [];

// 1. Logo (0 - 2.0)
{
  const L = layer(); L.innerHTML = `<div class="c">${brand()}</div>`;
  const img = L.querySelector("img"), w = L.querySelector(".w");
  S.push((t) => {
    L.style.opacity = vis(t, 0, 2.0, 0.01, 0.25);
    const a = out3(prog(t, 0.1, 0.7));
    img.style.transform = `scale(${lerp(0.6, 1, a)})`; img.style.opacity = a;
    const b = inOut(prog(t, 0.55, 1.35));
    w.style.clipPath = `inset(0 ${100 - b * 100}% 0 0)`;
    w.style.transform = `translateX(${lerp(-30, 0, b)}px)`;
  });
}
// 2. WhatsApp wordmark (1.9 - 3.1) then lockup (3.0 - 4.2)
{
  const L = layer(); L.innerHTML = `<div class="c"><div class="wa">${WA}<span>WhatsApp</span></div></div>`;
  const wa = L.querySelector(".wa");
  S.push((t) => {
    L.style.opacity = vis(t, 1.9, 3.1, 0.2, 0.2);
    const a = out3(prog(t, 1.9, 2.5));
    wa.style.transform = `scale(${lerp(0.85, 1, a)})`;
    wa.querySelector("span").style.clipPath = `inset(0 ${100 - inOut(prog(t, 2.05, 2.6)) * 100}% 0 0)`;
  });
  const M = layer(); M.innerHTML = `<div class="c"><div class="lock">${brand()}<span class="x">×</span><div class="wa">${WA}<span>WhatsApp</span></div></div></div>`;
  const lk = M.querySelector(".lock");
  S.push((t) => {
    M.style.opacity = vis(t, 3.0, 4.3, 0.25, 0.3);
    lk.style.transform = `scale(${lerp(1.08, 1, out3(prog(t, 3.0, 3.7)))})`;
    lk.style.letterSpacing = "0";
  });
}
// 3. "Find my project" cards assemble (4.2 - 7.2)
{
  const L = layer();
  const cards = [
    ["Your goal", ["Live", "Invest"], 1, 0],
    ["Home size", ["2+1", "3+1", "4+1"], 1, 1],
    ["Lifestyle", ["Sea", "Nature", "City"], 0, 2],
    ["Delivery", ["Ready to move in", "Off-plan"], 0, 3]
  ];
  cards.forEach(([h, chips, on, i]) => {
    const c = el(`<div class="card"><h6>${h}</h6><div class="chips">${chips.map((x, k) => `<span class="chip" data-k="${k}">${x}</span>`).join("")}</div></div>`);
    c.dataset.on = on; c.dataset.i = i; L.append(c);
  });
  const cs = [...L.querySelectorAll(".card")];
  S.push((t) => {
    L.style.opacity = vis(t, 4.2, 7.3, 0.2, 0.35);
    const zoom = lerp(1, 0.86, inOut(prog(t, 6.4, 7.3)));
    cs.forEach((c, i) => {
      const s = 4.25 + i * 0.42, a = out3(prog(t, s, s + 0.5));
      const x = W / 2 + (i % 2 ? 40 : -40), y = 560 + i * 200;
      c.style.left = x + "px"; c.style.top = y + "px"; c.style.translate = "-50% 0";
      c.style.opacity = a;
      c.style.transform = `translateY(${lerp(60, 0, a)}px) scale(${zoom})`;
      c.style.transformOrigin = `${W / 2 - x}px ${CY - y}px`;
      const pick = t > s + 0.75;
      c.querySelectorAll(".chip").forEach((ch) => ch.classList.toggle("on", pick && ch.dataset.k == c.dataset.on));
    });
  });
}
// 4. WhatsApp glow (7.2 - 8.2) then the number typed (8.1 - 9.6)
{
  const L = layer(); L.innerHTML = `<div class="c glow">${WA}</div>`;
  const g = L.querySelector(".c");
  S.push((t) => {
    L.style.opacity = vis(t, 7.2, 8.25, 0.25, 0.25);
    const p = prog(t, 7.2, 8.2);
    g.style.transform = `translate(-50%,-50%) scale(${lerp(0.7, 1, out3(p)) + 0.04 * Math.sin(p * Math.PI * 2)})`;
  });
  const N = layer(); N.innerHTML = `<div class="c num"><small>${WA}<span>WhatsApp</span></small><div class="d"></div></div>`;
  const d = N.querySelector(".d"), digits = "+90 531 930 92 14";
  S.push((t) => {
    N.style.opacity = vis(t, 8.1, 9.7, 0.2, 0.3);
    const n = Math.round(lerp(0, digits.length, prog(t, 8.25, 9.15)));
    d.innerHTML = `<span dir="ltr">${digits.slice(0, n)}</span><span style="opacity:.25">${digits.slice(n).replace(/\d/g, "0")}</span>`;
  });
}
// 5. Orb (9.6 - 12.0), 6. chat (11.7 - 17.0)
{
  const L = layer(); L.innerHTML = orbHTML(); const o = L.firstChild;
  S.push((t) => {
    L.style.opacity = vis(t, 9.6, 12.2, 0.3, 0.01);
    const a = out3(prog(t, 9.6, 10.4)), b = inOut(prog(t, 10.6, 11.4)), c = inOut(prog(t, 11.4, 12.1));
    let size = lerp(120, 460, a); size = lerp(size, 300, b);
    const x = lerp(W / 2, 138, c), y = lerp(CY, 828, c);
    paintOrb(o, t, lerp(size, 56, c), x, y);
  });
  const C = layer(); C.innerHTML = `<div class="chat"></div>`;
  const chat = C.firstChild;
  const msgs = [
    ["me", "Hi! Is there a payment plan for Lotus Yaşam?", "10:14", 0, 11.9],
    ["us", "Yes: 30% down payment and the balance over 30 months.", "10:15", 120, 12.7],
    ["us", "Would you like a private video tour of the project?", "10:15", 312, 13.4],
    ["me", "Yes please!", "10:16", 450, 14.1],
    ["us", `<div class="top"><div class="ic">${ICON.video}</div><div class="t"><b>Private Video Tour</b><span>Every day · Istanbul time</span></div></div><span class="l">hadararealestate.com/video-tour</span>`, "10:16", 560, 14.8, "tour"],
    ["me", "Thanks!", "10:17", 880, 15.6]
  ];
  const nodes = msgs.map(([who, text, time, y, at, cls]) => {
    const m = el(`<div class="msg ${who} ${cls || ""}">${text}<time>${time}</time></div>`);
    m.style.top = y + "px"; chat.append(m);
    let av = null;
    if (who === "us") { av = el(`<div class="av"></div>`); av.style.top = y + "px"; chat.append(av); }
    return { m, av, at };
  });
  S.push((t) => {
    C.style.opacity = vis(t, 11.6, 17.1, 0.2, 0.4);
    const lift = lerp(0, -170, inOut(prog(t, 15.3, 16.0)));
    chat.style.transform = `translateY(${lift}px) scale(${lerp(1, 0.94, prog(t, 16.3, 17.1))})`;
    nodes.forEach(({ m, av, at }) => {
      const a = back(prog(t, at, at + 0.4));
      m.style.opacity = clamp(a * 1.5);
      m.style.transform = `translateY(${lerp(30, 0, clamp(a))}px) scale(${lerp(0.9, 1, a)})`;
      m.style.transformOrigin = m.classList.contains("me") ? "100% 100%" : "0 100%";
      if (av) av.style.opacity = t > 12.1 ? clamp(a * 1.5) : 0;
    });
  });
}
// 7. Projects tree (16.8 - 19.0)
{
  const L = layer();
  const kids = [
    ["Lotus Yaşam", "Beylikdüzü", "beylikduzu-living/aerial-main", 180, 760],
    ["Diamond Marin", "Beylikdüzü", "diamond-marin/aerial-sea-view", 540, 690],
    ["Lotus Şişli", "Şişli", "lotus-sisli/aerial-towers", 900, 760],
    ["Sea Pearl Ataköy", "Bakırköy", "sea-pearl-atakoy/aerial-coast", 240, 1000],
    ["Büyükyalı", "Zeytinburnu", "buyukyali/facade-sea", 840, 1000],
    ["CasaBlu Vadi", "Beylikdüzü", "casablu-vadi/aerial-valley-sea", 330, 1220],
    ["Lotus Yalı", "Büyükçekmece", "lotus-yali/sunset-aerial", 760, 1220],
    ["Marmara Haven Villa", "Büyükçekmece", "marmara-haven-villa/aerial-top", 540, 1420]
  ];
  const root = [540, 470];
  L.innerHTML = `<svg class="lines">${kids.map(([, , , x, y]) => `<path d="M${root[0]} ${root[1]} C ${root[0]} ${(root[1] + y) / 2}, ${x} ${(root[1] + y) / 2}, ${x} ${y}" fill="none" stroke="#c9b98f" stroke-width="2.5" pathLength="1"/>`).join("")}</svg>
    <div class="node root" style="left:${root[0]}px;top:${root[1]}px">HADARA</div>
    ${kids.map(([n, d, img, x, y]) => `<div class="node kid" style="left:${x}px;top:${y}px"><img src="${IMG(img)}"><div>${n}<small>${d}</small></div></div>`).join("")}`;
  const paths = [...L.querySelectorAll("path")], ks = [...L.querySelectorAll(".kid")];
  S.push((t) => {
    L.style.opacity = vis(t, 16.8, 19.2, 0.25, 0.5);
    L.style.transform = `scale(${lerp(1.06, 0.92, prog(t, 16.8, 19.2))})`;
    L.style.filter = `blur(${lerp(0, 18, prog(t, 18.6, 19.2))}px)`;
    paths.forEach((p, i) => {
      const a = inOut(prog(t, 17.0 + i * 0.08, 17.6 + i * 0.08));
      p.style.strokeDasharray = "1"; p.style.strokeDashoffset = 1 - a;
    });
    ks.forEach((k, i) => {
      const a = out3(prog(t, 17.35 + i * 0.09, 17.75 + i * 0.09));
      k.style.opacity = a; k.style.transform = `translate(-50%,-50%) scale(${lerp(0.8, 1, a)})`;
    });
  });
}
// 8. Colour wash (18.8 - 20.4), then the orb breathing (20.0 - 22.2)
{
  const L = layer("grad");
  S.push((t) => {
    L.style.opacity = vis(t, 18.8, 20.4, 0.5, 0.7) * 0.85;
    L.style.filter = `blur(60px)`;
    L.style.transform = `scale(2.2) rotate(${t * 6}deg)`;
  });
  const O = layer(); O.innerHTML = orbHTML(); const o = O.firstChild;
  S.push((t) => {
    O.style.opacity = vis(t, 20.0, 22.3, 0.4, 0.3);
    const p = prog(t, 20.0, 22.3);
    paintOrb(o, t * 1.6, 300 + 26 * Math.sin(p * Math.PI * 3), W / 2, CY, 1.5);
  });
}
// 9. Night: dot field over a faint Istanbul (22.2 - 25.0)
{
  const L = layer("dark"); L.innerHTML = `<div class="ph"></div>`;
  const dots = [];
  for (let c = 0; c < 15; c++) for (let r = 0; r < 26; r++) {
    const d = el(`<div class="dot"></div>`); L.append(d);
    dots.push({ d, c, r, s: ((c * 7 + r * 13) % 10) / 10 });
  }
  const glow = el(`<div style="position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(201,162,75,.45),rgba(47,107,85,.18) 45%,transparent 70%);left:190px;top:500px"></div>`);
  L.prepend(glow);
  S.push((t) => {
    L.style.opacity = vis(t, 22.2, 25.1, 0.15, 0.2);
    const p = prog(t, 22.2, 25.1);
    glow.style.transform = `translateY(${lerp(120, -80, p)}px) scale(${lerp(0.7, 1.15, p)})`;
    dots.forEach(({ d, c, r, s }) => {
      const x = 40 + c * 72 + Math.sin(r * 0.5 + t * 1.2 + c) * 14;
      const y = ((r * 76 + (t - 22.2) * (60 + s * 60)) % 1980) - 30;
      d.style.left = x + "px"; d.style.top = y + "px";
      const near = 1 - Math.min(1, Math.hypot(x - 540, y - 850 + p * 200) / 700);
      d.style.background = s > 0.6 ? "#e4c574" : "#f1ead8";
      d.style.opacity = 0.25 + 0.75 * near;
      d.style.transform = `scale(${0.6 + near})`;
    });
  });
}
// 10. Toggle: call / chat / video (25.0 - 27.4)
{
  const L = layer(); L.innerHTML = `<div class="c"><div class="tog"><span class="hl"></span><div>${ICON.call}</div><div>${ICON.chat}</div><div>${ICON.video}</div></div></div>`;
  const hl = L.querySelector(".hl"), items = [...L.querySelectorAll(".tog div")], box = L.querySelector(".c");
  S.push((t) => {
    L.style.opacity = vis(t, 25.0, 27.5, 0.25, 0.3);
    box.style.transform = `translate(-50%,-50%) scale(${lerp(0.85, 1, out3(prog(t, 25, 25.5)))})`;
    const pos = inOut(prog(t, 25.6, 26.0)) + inOut(prog(t, 26.4, 26.8));
    hl.style.transform = `translateX(${pos * 146}px)`;
    items.forEach((it, i) => (it.style.color = Math.abs(pos - i) < 0.5 ? "#0f2b21" : "#9aa09b"));
  });
}
// 11. Counters in rings: 14 projects, 3,100+ homes (27.4 - 31.6)
{
  const L = layer(); L.innerHTML = orbHTML() + `<div class="ring r1"></div><div class="ring r2"></div><div class="count"></div>`;
  const o = L.querySelector(".orb"), r1 = L.querySelector(".r1"), r2 = L.querySelector(".r2"), n = L.querySelector(".count");
  S.push((t) => {
    L.style.opacity = vis(t, 27.4, 31.7, 0.3, 0.35);
    const g = out3(prog(t, 27.4, 28.3));
    const size = lerp(160, 360, g) + lerp(0, 60, inOut(prog(t, 29.3, 30.0)));
    paintOrb(o, t, size, W / 2, CY, 3);
    r1.style.width = r1.style.height = size * 1.45 + "px";
    r2.style.width = r2.style.height = size * 2.1 + "px";
    r1.style.transform = `translate(-50%,-50%) rotate(${t * 20}deg)`;
    r2.style.transform = `translate(-50%,-50%) rotate(${-t * 12}deg)`;
    r1.style.opacity = g; r2.style.opacity = g * 0.7;
    let html;
    if (t < 29.4) {
      const v = Math.round(lerp(0, 14, out3(prog(t, 27.6, 28.5))));
      const lab = prog(t, 28.6, 29.0);
      html = `<span style="font-size:${lerp(150, 110, lab)}px">${v}</span><br><span style="font-size:52px;opacity:${lab}">Projects</span>`;
    } else {
      const v = Math.round(lerp(0, 3100, out3(prog(t, 29.3, 30.3))));
      const lab = prog(t, 30.5, 30.9);
      html = `<span style="font-size:${lerp(100, 84, lab)}px">${v.toLocaleString("en-US")}+</span><br><span style="font-size:52px;opacity:${lab}">Homes</span>`;
    }
    n.innerHTML = html;
    n.style.opacity = t < 29.4 ? vis(t, 27.6, 29.4, 0.2, 0.25) : vis(t, 29.4, 31.7, 0.2, 0.3);
  });
}
// 12. Welcome in many languages (31.5 - 34.6)
{
  const L = layer("grad");
  const words = [
    ["Welcome to HADARA", "", 540, 700, 56],
    ["مرحباً بكم في حضارة", "ar", 330, 880, 36],
    ["Добро пожаловать", "", 770, 1000, 32],
    ["Bienvenue chez HADARA", "", 340, 1120, 32],
    ["به حضارة خوش آمدید", "ar", 760, 1240, 34],
    ["Hoş geldiniz", "", 330, 1360, 32],
    ["Can I visit the site?", "", 260, 560, 26],
    ["هل يمكنني زيارة المشروع؟", "ar", 800, 520, 28],
    ["Какой срок сдачи?", "", 820, 820, 26],
    ["Quel est le prix ?", "", 780, 1440, 26]
  ];
  L.innerHTML = words.map(([w, cls, x, y, f]) => `<div class="bub ${cls}" style="left:${x}px;top:${y}px;font-size:${f}px">${w}</div>`).join("");
  const bs = [...L.querySelectorAll(".bub")];
  S.push((t) => {
    L.style.opacity = vis(t, 31.5, 34.7, 0.4, 0.4);
    bs.forEach((b, i) => {
      const s = 31.7 + i * 0.13, a = back(prog(t, s, s + 0.4));
      const drift = (t - 31.5) * (i % 2 ? -14 : 12);
      b.style.opacity = clamp(a * 1.4);
      b.style.transform = `translate(-50%,-50%) translateY(${drift}px) scale(${i === 0 ? lerp(0.7, 1.08, a) : lerp(0.6, 1, a)})`;
    });
  });
}
// 13. Discover / Tour / Own (34.5 - 37.2): each word arrives big, the earlier ones step up and shrink.
{
  const L = layer();
  const ws = [["Discover", 34.6], ["Tour", 35.4], ["Own", 36.2]];
  L.innerHTML = ws.map(([w]) => `<div class="pill">${w}</div>`).join("");
  const ps = [...L.querySelectorAll(".pill")];
  S.push((t) => {
    L.style.opacity = vis(t, 34.5, 37.3, 0.2, 0.3);
    ps.forEach((p, i) => {
      const a = back(prog(t, ws[i][1], ws[i][1] + 0.35));
      // age: how far later words have pushed this one (eased, 0..2)
      const age = ws.slice(i + 1).reduce((n, [, s]) => n + inOut(prog(t, s - 0.32, s)), 0);
      p.style.left = W / 2 + (i - 1) * 40 * Math.min(age, 1) + "px";
      p.style.top = CY - age * 120 + "px";
      p.style.fontSize = "64px";
      p.style.opacity = clamp(a * 1.4) * lerp(1, 0.45, clamp(age - 1));
      p.style.transform = `translate(-50%,-50%) scale(${lerp(0.6, 1, a) * lerp(1, 0.6, clamp(age))})`;
    });
  });
}
// 14. End card (37.1 - 40)
{
  const L = layer(); L.innerHTML = `<div class="c">${brand()}</div><div class="tag"><p>Your real estate partner in Istanbul</p><a>hadararealestate.com</a></div>`;
  const img = L.querySelector("img"), w = L.querySelector(".w"), tag = L.querySelector(".tag");
  S.push((t) => {
    L.style.opacity = vis(t, 37.1, 41, 0.2, 0.01);
    const a = out3(prog(t, 37.2, 37.8));
    img.style.transform = `scale(${lerp(0.6, 1, a)})`; img.style.opacity = a;
    const b = inOut(prog(t, 37.6, 38.4));
    w.style.clipPath = `inset(0 ${100 - b * 100}% 0 0)`;
    const c = out3(prog(t, 38.4, 39.0));
    tag.style.opacity = c; tag.style.transform = `translate(-50%, ${lerp(20, 0, c)}px)`;
  });
}

window.DURATION = 40;
window.render = (t) => { for (const f of S) f(t); };
window.render(0);
