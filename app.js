/* Docxzal — paste/AI → clean preview → .docx (native OMML) + PDF */
const $ = (s) => document.querySelector(s) || NULL_EL;
/* Null-object: a missing element degrades to a no-op instead of killing the script */
const NULL_EL = new Proxy(function () {}, {
  get(t, k) {
    if (k === "then") return undefined;
    if (k === "style" || k === "dataset") return {};
    if (k === "classList") return { add() {}, remove() {}, toggle() {}, contains: () => false };
    if (k === "children" || k === "childNodes") return [];
    if (k === "textContent" || k === "value" || k === "innerHTML") return "";
    if (k === "hidden" || k === "checked") return false;
    if (k === Symbol.toPrimitive) return () => "";
    return (...a) => NULL_EL;
  },
  set() { return true; },
  apply() { return NULL_EL; }
});
const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600); };
const CHECK_SVG = '<svg class="dd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';

/* ---------- Theme: Bone & Ink / Midnight Slate ---------- */
const THEMES = [{ value: "bone", label: "Bone & Ink" }, { value: "midnight", label: "Midnight Slate" }];
function currentTheme() {
  return document.documentElement.dataset.theme === "midnight" ? "midnight" : "bone";
}
function themeMode(t) {
  return (t || currentTheme()) === "bone" ? "day" : "night";
}
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = currentTheme() === "midnight" ? "#090c11" : "#f6f6f4";
}
function paintToggle() {
  const day = themeMode() === "day";
  const b = $("#themeToggle");
  b.setAttribute("aria-pressed", String(day));
  b.setAttribute("aria-label", day ? "Switch to midnight mode" : "Switch to bone mode");
  b.title = day ? "Midnight Slate" : "Bone & Ink";
}
(function initTheme() {
  let s = "";
  try { s = localStorage.getItem("bd_theme") || ""; } catch {}
  // Migrate the older multi-hue themes to the neutral pair.
  if (s === "light" || s.endsWith("-day")) s = "bone";
  else if (s === "dark" || s === "amoled" || s === "mono" || s === "forest") s = "midnight";
  if (s !== "midnight") s = "bone";
  document.documentElement.dataset.theme = s;
  try { localStorage.setItem("bd_theme", s); localStorage.setItem("bd_theme_v", "3"); } catch {}
  syncThemeColor();
  paintToggle();
})();
let revealing = false;
function setTheme(n, ev) {
  if (n === currentTheme() || !THEMES.some(x => x.value === n)) return;
  const apply = () => {
    document.documentElement.dataset.theme = n;
    try { localStorage.setItem("bd_theme", n); } catch {}
    syncThemeColor();
    paintToggle();
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const keyboard = ev && ev.detail === 0;
  if (!ev || keyboard || reduce || revealing || !document.startViewTransition) { apply(); return; }
  revealing = true;
  const done = () => { revealing = false; };
  const rect = $("#themeToggle").getBoundingClientRect();
  const x = ev.clientX || rect.left + rect.width / 2;
  const y = ev.clientY || rect.top + rect.height / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  try {
    const tr = document.startViewTransition(apply);
    tr.finished.then(done, done);
    tr.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "cubic-bezier(.22,1,.36,1)", pseudoElement: "::view-transition-new(root)" });
    }).catch(() => {});
  } catch { done(); apply(); }
}
$("#themeToggle").addEventListener("click", (e) => setTheme(themeMode() === "day" ? "midnight" : "bone", e));

/* ---------- Floating dock: shrink on scroll + reading progress ---------- */
(function initDock() {
  const header = document.getElementById("siteHeader");
  const bar = document.getElementById("dockProgress");
  if (!header) return;
  let frame = 0;
  function paint() {
    frame = 0;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    header.classList.toggle("is-scrolled", y > 12);
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, y / max)) : 0})`;
  }
  function queue() { if (!frame) frame = requestAnimationFrame(paint); }
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue, { passive: true });
  paint();
})();

/* ---------- Tabs ---------- */
const tabs = [...document.querySelectorAll(".tab")];
tabs.forEach((b) => b.onclick = () => {
  tabs.forEach(x => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
  b.classList.add("active"); b.setAttribute("aria-selected", "true");
  document.querySelectorAll(".tabpage").forEach(p => p.classList.remove("show"));
  $("#page-" + b.dataset.tab).classList.add("show");
});
function updatePageChip() {
  const chip = document.getElementById("pageChip"), paper = $("#paper");
  if (!chip || !paper) return;
  const scale = (typeof currentEff === "number" && currentEff > 0.05) ? currentEff : 1;
  const h = pageDims().h;
  const layoutH = (paper.getBoundingClientRect().height || h) / scale; // rect is zoom-scaled
  const pages = Math.max(1, Math.ceil(layoutH / h - 0.01));
  const parts = ["A4"];
  if (pageOrient === "landscape") parts.push("landscape");
  if (pageCols === 2) parts.push("2 col");
  parts.push(pages + " page" + (pages > 1 ? "s" : ""));
  chip.textContent = parts.join(" · ");
}

/* ---------- Author modal ---------- */
const modal = $("#authorModal"), modalCard = modal.querySelector(".modal");
function openAuthor() { modal.classList.add("show"); }
function closeAuthor() {
  modalCard.classList.add("closing");
  setTimeout(() => { modal.classList.remove("show"); modalCard.classList.remove("closing"); }, 220);
}
$("#btnAuthor").onclick = openAuthor;
$("#authorClose").onclick = closeAuthor;
modal.onclick = (e) => { if (e.target === modal) closeAuthor(); };
document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.classList.contains("show")) closeAuthor(); });

/* ---------- Author card: photo + live GitHub info + social icons ---------- */
const GH_USER = "Bipin223";
const GH_EXTRA = { linkedin: "", twitter: "", email: "" }; // fill these to reveal the extra icons
const SOC_ICONS = {
  github: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1.2 2h6.4l4.4 5.9L18.9 2zm-1.1 18.1h1.7L6.9 3.8H5.1l12.7 16.3z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>'
};
const attrEsc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
let ghProfile = null;
(async function loadAuthor() {
  const byId = id => document.getElementById(id);
  const img = byId("authorPhoto"), fb = byId("authorFallback");
  if (img) img.addEventListener("error", () => { // author.jpg → GitHub avatar → initials
    if (ghProfile && ghProfile.avatar_url && !img.dataset.ghTried) { img.dataset.ghTried = "1"; img.src = ghProfile.avatar_url; return; }
    img.style.display = "none";
    if (fb) { fb.textContent = (ghProfile && ghProfile.name ? ghProfile.name : "BR").split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase(); fb.style.display = "grid"; }
  });
  try {
    let cached = null;
    try { const c = JSON.parse(localStorage.getItem("bd_ghp") || "null"); cached = (c && Date.now() - c.t < 864e5) ? c.v : null; } catch {}
    if (!cached) {
      const r = await fetch("https://api.github.com/users/" + GH_USER);
      if (r.ok) { cached = await r.json(); try { localStorage.setItem("bd_ghp", JSON.stringify({ t: Date.now(), v: cached })); } catch {} }
    }
    ghProfile = cached;
  } catch {}
  const p = ghProfile || {};
  const set = (id, txt) => { const el = byId(id); if (el && txt) el.textContent = txt; };
  set("authorName", p.name || "Bipin Rizal");
  set("authorHandle", p.login ? "@" + p.login : "@" + GH_USER);
  set("authorBio", p.bio || "Author of Docxzal — turns messy AI text into clean Word question papers with native equations.");
  const chips = [];
  if (p.location) chips.push(p.location);
  if (typeof p.public_repos === "number") chips.push(p.public_repos + " public repos");
  if (typeof p.followers === "number" && p.followers > 0) chips.push(p.followers + " followers");
  const meta = byId("authorMeta");
  if (meta && chips.length) meta.innerHTML = chips.map(c => "<span>" + attrEsc(c) + "</span>").join("");
  const ghBtn = byId("authorGithub");
  if (ghBtn && p.html_url) ghBtn.href = p.html_url;
  const links = [{ href: p.html_url || ("https://github.com/" + GH_USER), title: "GitHub", svg: SOC_ICONS.github }];
  const blog = (p.blog || "").trim();
  if (blog) links.push({ href: /^https?:/i.test(blog) ? blog : "https://" + blog, title: blog, svg: SOC_ICONS.globe });
  const tw = (p.twitter_username || GH_EXTRA.twitter || "").trim();
  if (tw) links.push({ href: "https://x.com/" + tw.replace(/^@/, ""), title: "@" + tw.replace(/^@/, "") + " on X", svg: SOC_ICONS.x });
  const mail = (p.email || GH_EXTRA.email || "").trim();
  if (mail) links.push({ href: "mailto:" + mail, title: mail, svg: SOC_ICONS.mail });
  if (GH_EXTRA.linkedin) links.push({ href: "https://www.linkedin.com/in/" + GH_EXTRA.linkedin.replace(/^\/+/, ""), title: "LinkedIn", svg: SOC_ICONS.linkedin });
  const row = byId("socRow");
  if (row) row.innerHTML = links.map(l =>
    '<a class="soc" href="' + attrEsc(l.href) + '" title="' + attrEsc(l.title) + '" target="_blank" rel="noopener" aria-label="' + attrEsc(l.title) + '">' + l.svg + "</a>").join("");
})();

/* ---------- Sample (shows full coverage) ---------- */
const SAMPLE = `## Section A — Short Answers (2 marks each)

Q1. Solve $x^2 - 5x + 6 = 0$ by factorisation. [2]

Q2. If $\\sin A = \\frac{3}{5}$, find $\\cos A$. Also evaluate $\\sqrt{16} + \\sqrt[3]{27}$. [2]

Q3. Find $\\lim_{x \\to 0} \\frac{\\sin x}{x}$ and $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$. [3]

## Section B — Long Answers

Q4. Prove $$\\sin^2 \\theta + \\cos^2 \\theta = 1$$ and evaluate $\\int_0^{\\pi} \\sin x \\, dx$. [5]

Q5. Given $$A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$ find $\\det A$ and $A^{-1} = \\frac{1}{\\det A}\\begin{pmatrix} 4 & -2 \\\\ -3 & 1 \\end{pmatrix}$. [4]

Q6. Define $$f(x) = \\begin{cases} x^2, & \\text{if } x \\geq 0 \\\\ -x, & \\text{otherwise} \\end{cases}$$ Sketch it. If $\\hat{x} = 5$ and $\\vec{v} = \\binom{n}{k}$, state $\\overline{AB}$. [4]

> All questions are compulsory. Show all steps clearly.`;
$("#btnSample").onclick = () => { $("#rawInput").value = SAMPLE; syncCount(); render(); };
const EMPTY_PAPER = '<div class="empty"><div class="empty-icon">✦</div><p>Paste AI text → Clean & Preview — then click here to edit</p></div>';
$("#btnClearPaste").onclick = () => { $("#rawInput").value = ""; syncCount(); toast("Paste cleared"); };
$("#btnClearPaper").onclick = () => { $("#paperBody").innerHTML = EMPTY_PAPER; toast("Paper cleared"); };

/* ---------- Import .docx → clean Markdown (unzipped in the browser) ---------- */
const wLN = el => el.localName || String(el.tagName || "").split(":").pop();
const wEls = el => [...el.childNodes].filter(n => n.nodeType === 1);
const wChild = (el, name) => wEls(el).find(k => wLN(k) === name);
const wKids = (el, name) => wEls(el).filter(k => wLN(k) === name);
const wVal = el => { if (!el) return ""; for (const a of (el.attributes || [])) if (a.name.split(":").pop() === "val") return a.value; return ""; };

function mathPlain(el) { // leaf math text → LaTeX-safe; math-alphanumerics folded, accents kept
  let s = "";
  const walk = n => {
    if (n.nodeType === 3) { s += n.textContent; return; }
    if (n.nodeType !== 1) return;
    const l = wLN(n);
    if (l === "t") s += n.textContent;
    else if (l === "tab" || l === "br") s += " ";
    else [...n.childNodes].forEach(walk);
  };
  walk(el);
  let folded = "";
  for (const ch of s) { // only fold Unicode math letters (𝑥, 𝑎 …); keep real accents
    const cp = ch.codePointAt(0);
    const isMathAlnum = (cp >= 0x1D400 && cp <= 0x1D7FF) || (cp >= 0x2100 && cp <= 0x214F);
    folded += isMathAlnum ? ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "") : ch;
  }
  return folded.replace(/([&%#])/g, "\\$1").replace(/([_^])/g, "\\$1");
}
const COMB_FN = { "̂": "\\hat", "̃": "\\tilde", "̄": "\\bar", "̅": "\\bar",
  "̇": "\\dot", "̈": "\\ddot", "̄̄": "\\bar", "́": "\\acute", "̀": "\\grave",
  "̲": "\\underline", "̳": "\\underline", "̸": "\\not", "⃗": "\\vec", "⃖": "\\overleftarrow" };
function polishMath(s) {
  return s
    .replace(/\b(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|arcsin|arccos|arctan|log|ln|lg|lim|det|max|min|exp|gcd|deg)\b/g, "\\$1")
    .replace(/×/g, "\\times ").replace(/÷/g, "\\div ").replace(/≤/g, "\\le ").replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ").replace(/→/g, "\\to ").replace(/−/g, "-").replace(/∞/g, "\\infty ")
    .replace(/·/g, "\\cdot ")
    .replace(/([^\s\\{}])([\u0300-\u036f\u20d7\u20d6\u20d3\u0338])/g, (m, base, mk) => // x̂ → \hat{x}
      (COMB_FN[mk] ? `${COMB_FN[mk]}{${base}}` : base + mk))
    .replace(/\s+/g, " ").trim();
}
function ommlToLatex(node) { // native Word equations → LaTeX
  const kidsEl = wEls(node);
  if (!kidsEl.length) return mathPlain(node);
  const V = n => (n ? ommlToLatex(n) : "");
  let out = "";
  for (const el of kidsEl) {
    const l = wLN(el);
    if (l === "r" || l === "t") out += mathPlain(el);
    else if (l === "f") out += `\\frac{${V(wChild(el, "num"))}}{${V(wChild(el, "den"))}}`;
    else if (l === "sSup") out += `{${V(wChild(el, "e"))}}^{${V(wChild(el, "sup"))}}`;
    else if (l === "sSub") out += `{${V(wChild(el, "e"))}}_{${V(wChild(el, "sub"))}}`;
    else if (l === "sSubSup") out += `{${V(wChild(el, "e"))}}_{${V(wChild(el, "sub"))}}^{${V(wChild(el, "sup"))}}`;
    else if (l === "rad") {
      const d = V(wChild(el, "deg")).trim();
      out += d ? `\\sqrt[${d}]{${V(wChild(el, "e"))}}` : `\\sqrt{${V(wChild(el, "e"))}}`;
    } else if (l === "nary") {
      const pr = wChild(el, "naryPr"), chrEl = pr && wChild(pr, "chr");
      const chr = (chrEl && wVal(chrEl)) || "∫";
      const sym = ({ "∫": "\\int", "∑": "\\sum", "∏": "\\prod", "∬": "\\iint", "∯": "\\oiint",
        "⋀": "\\bigwedge", "⋁": "\\bigvee" })[chr] || chr;
      const sub = V(wChild(el, "sub")).trim(), sup = V(wChild(el, "sup")).trim();
      out += (sub || sup ? sym + (sub ? `_{${sub}}` : "") + (sup ? `^{${sup}}` : "") : sym)
        + `{${V(wChild(el, "e"))}}`;
    } else if (l === "d") {
      const pr = wChild(el, "dPr");
      const norm = v => (!v || v === "null" || !String(v).trim()) ? "" : v;
      const beg = norm(pr && wChild(pr, "begChr") ? wVal(wChild(pr, "begChr")) : "(");
      const end = norm(pr && wChild(pr, "endChr") ? wVal(wChild(pr, "endChr")) : ")");
      const es = wKids(el, "e");
      const arr = es.length === 1 && wChild(es[0], "eqArray");
      if (arr && (beg === "{" || beg === "")) { // Word's cases block
        const rows = wKids(arr, "e").map(V).join(" \\\\ ");
        out += `\\begin{cases}${rows}\\end{cases}`;
        continue;
      }
      const body = es.map(V).join("");
      out += (beg || end) ? `\\left${beg}${body}\\right${end}` : body;
    } else if (l === "func") out += `${V(wChild(el, "fName"))}\\left(${V(wChild(el, "e"))}\\right)`;
    else if (l === "bar") {
      const pos = wVal(wChild(wChild(el, "barPr"), "barPos"));
      out += (pos === "bot" ? "\\underline{" : "\\overline{") + V(wChild(el, "e")) + "}";
    } else if (l === "acc" || l === "groupChr") {
      const pr = wChild(el, l === "acc" ? "accPr" : "grpChrPr");
      const c = pr ? wVal(wChild(pr, "chr")) : "";
      const fn = ({ "̂": "\\hat", "̃": "\\tilde", "̄": "\\bar", "̇": "\\dot",
        "̈": "\\ddot", "⃗": "\\vec", "→": "\\overrightarrow", "←": "\\overleftarrow",
        "⏞": "\\overbrace", "⏟": "\\underbrace" })[c] || "\\hat";
      out += `${fn}{${V(wChild(el, "e"))}}`;
    } else if (l === "m") {
      const rows = wKids(el, "mr").map(r => wKids(r, "e").map(V).join(" & ")).join(" \\\\ ");
      out += `\\begin{pmatrix}${rows}\\end{pmatrix}`;
    } else if (l === "eqArray") out += `\\begin{aligned}${wKids(el, "e").map(V).join(" \\\\ ")}\\end{aligned}`;
    else out += ommlToLatex(el); // wrappers (m:e, m:num…) and anything unknown
  }
  return out;
}
const SUP_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ" };
const SUB_MAP = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", "a": "ₐ", "e": "ₑ", "o": "ₒ", "x": "ₓ" };
function scriptText(text, sup) {
  const map = sup ? SUP_MAP : SUB_MAP;
  const folded = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const uni = [...folded].map(c => map[c]).join("");
  return uni && uni.length === [...text].length ? uni : (sup ? `^{${folded}}` : `_{${folded}}`);
}
function docxRunMd(r) {
  let text = "", b = false, i = false, vert = "";
  const walk = n => {
    if (n.nodeType !== 1) return;
    const l = wLN(n);
    if (l === "rPr") { b = !!wChild(n, "b"); i = !!wChild(n, "i"); vert = wVal(wChild(n, "vertAlign")); }
    else if (l === "t") text += n.textContent;
    else if (l === "tab") text += " ";
    else if (l === "br") text += "\n";
    else if (l === "instrText" || l === "fldChar" || l === "noBreakHyphen" || l === "softHyphen") return;
    else if (l === "drawing" || l === "pict" || l === "object") return;
    else [...n.childNodes].forEach(walk);
  };
  [...r.childNodes].forEach(walk);
  if (!text) return "";
  if (vert === "superscript") text = scriptText(text, true);
  else if (vert === "subscript") text = scriptText(text, false);
  if (i && !text.includes("$")) text = `*${text}*`;
  if (b && !text.includes("$")) text = `**${text}**`;
  return text;
}
function docxParaMd(p) {
  const pr = wChild(p, "pPr");
  let style = "", outline = "", bullet = false, quote = false;
  if (pr) {
    style = wVal(wChild(pr, "pStyle"));
    outline = wVal(wChild(pr, "outlineLvl"));
    bullet = !!wChild(pr, "numPr");
    quote = /^(intense)?quote$/i.test(style);
  }
  const hm = /heading\s*([123])/i.exec(style) || /^([123])$/.exec(style);
  const heading = hm ? (+(hm[1] || 1)) : ((outline !== "" && +outline <= 2 && !bullet && !quote) ? +outline + 1 : 0);
  let prefix = "";
  if (/^title$/i.test(style) || heading === 1) prefix = "# ";
  else if (heading === 2) prefix = "## ";
  else if (heading === 3) prefix = "### ";
  else if (bullet) prefix = "- ";
  else if (quote) prefix = "> ";

  // a paragraph holding only one equation is Word's display equation
  const single = [...p.childNodes].filter(n => n.nodeType === 1 && wLN(n) !== "pPr");
  if (single.length === 1 && /^oMath(Para)?$/.test(wLN(single[0]))) {
    const latex = polishMath(ommlToLatex(single[0]));
    return latex ? `$$${latex}$$` : "";
  }

  let parts = "";
  const walk = n => {
    if (n.nodeType !== 1) return;
    const l = wLN(n);
    if (l === "pPr") return;
    if (l === "r") { parts += docxRunMd(n); return; }
    if (l === "oMathPara") { parts += `\n$$${polishMath(ommlToLatex(n))}$$\n`; return; }
    if (l === "oMath") { parts += `$${polishMath(ommlToLatex(n))}$`; return; }
    if (/^(drawing|pict|object|bookmarkStart|bookmarkEnd|proofErr|commentRangeStart|commentRangeEnd|permStart|permEnd|sectPr|tab)$/.test(l)) return;
    [...n.childNodes].forEach(walk);
  };
  [...p.childNodes].forEach(walk);

  const chunks = parts.replace(/[ \t]+/g, " ").split("\n").map(s => s.trim()).filter(Boolean);
  if (!chunks.length) return "";
  return chunks.map((c, k) => (k === 0 ? prefix + c : c)).join("\n\n");
}
function docxCellMd(tc) {
  return wKids(tc, "p").map(docxParaMd).filter(Boolean).join(" ")
    .replace(/\|/g, "\\|").replace(/\s+/g, " ").trim() || " ";
}
function docxTableMd(tbl) {
  const rows = wKids(tbl, "tr").map(tr => wKids(tr, "tc").map(docxCellMd).join(" | "));
  if (!rows.length) return "";
  const cols = Math.max(...rows.map(r => r.split(" | ").length));
  return [rows[0], Array(cols).fill("---").join(" | "), ...rows.slice(1)].join("\n");
}
function docxToMarkdown(doc) {
  const all = [...doc.getElementsByTagName("*")];
  const body = all.find(e => wLN(e) === "body") || doc.documentElement;
  const blocks = [];
  for (const node of [...body.childNodes]) {
    if (node.nodeType !== 1) continue;
    const l = wLN(node);
    if (l === "p") { const s = docxParaMd(node); if (s) blocks.push(s); }
    else if (l === "tbl") { const s = docxTableMd(node); if (s) blocks.push(s); }
  }
  let md = "";
  blocks.forEach((b, k) => {
    if (!k) { md = b; return; }
    const tight = /^[-*>]\s/.test(blocks[k - 1]) || /^[-*]\s/.test(b);
    md += (tight ? "\n" : "\n\n") + b;
  });
  return md.replace(/\n{3,}/g, "\n\n").trim();
}
async function importDocx(file) {
  if (!file) return;
  if (!/\.docx$/i.test(file.name)) { toast("Only .docx can be read — old .doc is a binary format"); return; }
  if (typeof JSZip === "undefined") { toast("Importer not loaded yet — reload the page once"); return; }
  toast("Reading " + file.name + "…");
  try {
    const zip = await JSZip.loadAsync(file);
    const part = zip.file("word/document.xml");
    if (!part) throw new Error("no word/document.xml — not a Word file");
    const xml = await part.async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("unreadable XML");
    const md = docxToMarkdown(doc);
    if (!md) throw new Error("no text found in the file");
    $("#rawInput").value = md;
    syncCount(); render();
    const eqs = (md.match(/\$\$?[^$]+\$\$?/g) || []).length;
    toast(`Imported ${file.name} · ${md.split(/\s+/).length} words${eqs ? ` · ${eqs} equation${eqs === 1 ? "" : "s"}` : ""}`);
  } catch (e) { console.error(e); toast("Import failed — " + e.message); }
}
$("#btnImport").onclick = () => $("#fileDocx").click();
$("#fileDocx").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) importDocx(f); });
$("#rawInput").addEventListener("input", syncCount);
function syncCount() {
  const v = $("#rawInput").value;
  $("#statWords").textContent = (v.trim() ? v.trim().split(/\s+/).length : 0) + " words";
}

/* ---------- Normalize ---------- */
function normalizeAIText(raw) {
  let t = (raw || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  t = t.replace(/(?:^|\n)\s*(?:Question|Q\.?|Ques\.?)\s*(\d+)\s*[:.)\-–—]?\s*/gi, "\nQ$1. ");
  t = t.replace(/(?:^|\n)\s*(\d{1,2})\s*[.)]\s+(?=[A-Z])/g, "\nQ$1. ");
  t = t.replace(/[\[\(]\s*(\d{1,3})\s*(?:marks?|m)?\s*[\]\)]\s*$/gim, " [$1 marks]");
  t = t.replace(/[ \t]+\[(\d{1,3}\s*marks?)\]/gi, " [$1]"); // exactly one space before [marks]
  t = t.replace(/\\\(\s*/g, "$").replace(/\s*\\\)/g, "$").replace(/\\\[\s*/g, "$$").replace(/\s*\\\]/g, "$$");
  t = t.split("\n").map(line => {
    const s = line.trim();
    if (/^section\s+[a-d]/i.test(s) && !s.startsWith("#")) return "## " + s;
    return line;
  }).join("\n");
  // one paragraph per question (fence-aware) so preview and Word match
  const qlines = t.split("\n");
  let inFence = false;
  const qout = [];
  qlines.forEach(line => {
    if (/^```/.test(line.trim())) inFence = !inFence;
    if (!inFence && /^Q\d+\./.test(line.trim()) && qout.length && qout[qout.length - 1].trim() !== "") qout.push("");
    qout.push(line);
  });
  return qout.join("\n").trim();
}

/* ---------- Header ---------- */
function syncHeader() {
  const showHead = $("#cHeader").checked;
  $("#pSchool").textContent = $("#sSchool").value || "School Name";
  $("#pTitle").textContent = $("#sTitle").value || "Examination";
  $("#pMeta").textContent = `${$("#sSub").value}  •  ${$("#sMeta").value}`;
  $("#pInstr").textContent = $("#sInstr").value || "";
  $("#paperHead").style.display = showHead ? "" : "none";
  $("#paper").classList.toggle("no-head", !showHead); // no stray 14px gap when the header is off
  $("#pMeta").style.display = $("#cMeta").checked ? "" : "none";
  $("#pInstr").style.display = $("#cInstrBox").checked ? "" : "none";
  const footL = ($("#fFoot").value || "").trim(), showPg = $("#cPageNum").checked;
  $("#pFootL").textContent = footL;
  $("#pFootR").textContent = showPg ? "Page 1" : "";
  $("#pFootR").style.marginLeft = (showPg && !footL) ? "auto" : "";
  $("#paperFoot").style.display = (!footL && !showPg) ? "none" : "";
  try {
    localStorage.setItem("bd_cfg", JSON.stringify({ v: 2, h: showHead, m: $("#cMeta").checked, i: $("#cInstrBox").checked, p: showPg, f: $("#fFoot").value }));
  } catch {}
}
["sSchool","sTitle","sSub","sMeta","sInstr","cHeader","cMeta","cInstrBox","fFoot","cPageNum"].forEach(id => $("#"+id).addEventListener("input", syncHeader));
(function initHeadFoot() {
  try {
    const c = JSON.parse(localStorage.getItem("bd_cfg") || "{}");
    // Header is off unless the user explicitly switched it on (new default).
    if (c.h === true) document.getElementById("cHeader").checked = true;
    if (c.m === false) document.getElementById("cMeta").checked = false;
    if (c.i === false) document.getElementById("cInstrBox").checked = false;
    if (c.p === false) document.getElementById("cPageNum").checked = false;
    // v1 profiles stored the old "Beepin Docx" footer text — treat it as the default, not a choice
    const legacyBrand = c.v !== 2 && c.f === "Beepin Docx";
    if (typeof c.f === "string" && !legacyBrand) document.getElementById("fFoot").value = c.f;
  } catch {}
})();

/* ---------- School logo for the header (preview + Word) ---------- */
let schoolLogo = null, logoAspect = 1;
try {
  schoolLogo = localStorage.getItem("bd_logo") || null;
  logoAspect = parseFloat(localStorage.getItem("bd_logo_ar")) || 1;
} catch {}
function syncLogo() {
  const img = document.getElementById("pLogo");
  if (img) { if (schoolLogo) { img.src = schoolLogo; img.hidden = false; } else img.hidden = true; }
  const b = document.getElementById("btnLogoClear");
  if (b) b.hidden = !schoolLogo;
}
$("#btnLogo").onclick = () => document.getElementById("fileLogo").click();
$("#btnLogoClear").onclick = () => { schoolLogo = null; try { localStorage.removeItem("bd_logo"); localStorage.removeItem("bd_logo_ar"); } catch {} syncLogo(); };
(function initLogoInput() {
  const inp = document.getElementById("fileLogo");
  if (!inp) return;
  inp.addEventListener("change", e => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 320 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      logoAspect = c.width / c.height;
      schoolLogo = c.toDataURL("image/jpeg", 0.85);
      try { localStorage.setItem("bd_logo", schoolLogo); localStorage.setItem("bd_logo_ar", String(logoAspect)); } catch {}
      syncLogo(); toast("Logo added to header");
    };
    img.onerror = () => toast("Couldn't read that image");
    img.src = url;
  });
})();
syncLogo();

/* ---------- Preview ---------- */
/* protect $…$ from Markdown (CommonMark turns \\ into \ and eats matrix rows) */
let mathStash = [];
function protectMath(text) {
  mathStash = [];
  const save = m => `\u0000${mathStash.push(m) - 1}\u0000`;
  return text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/)
    .map((seg, k) => (k % 2 ? seg : seg.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, save))).join("");
}
function restoreMath(html) {
  return html.replace(/\u0000(\d+)\u0000/g, (m, i) => (mathStash[+i] != null ? mathStash[+i] : m));
}
/* Long inline code (e.g. linear-gradient(...)) must wrap at spaces without
   breaking at its hyphens — otherwise its background paints as a huge block. */
function splitLongInlineCode(root) {
  root.querySelectorAll("code").forEach(code => {
    if (code.closest("pre")) return;
    const text = code.textContent;
    if (!/\S\s+\S/.test(text)) return; // only spans with word gaps can be split safely
    const block = code.closest("p,li,td,th,blockquote,div") || code.parentElement;
    const maxW = Math.max(140, (block ? block.clientWidth : root.clientWidth) - 10);
    const wide = code.getClientRects().length > 1 || code.getBoundingClientRect().width > maxW;
    if (!wide) return;
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) { // a single enormous token: at least keep it on the page
      code.style.whiteSpace = "normal";
      code.style.overflowWrap = "anywhere";
      return;
    }
    const frag = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i) frag.appendChild(document.createTextNode(" "));
      const c = document.createElement("code");
      c.textContent = part;
      frag.appendChild(c);
    });
    code.replaceWith(frag);
  });
}

function render() {
  syncHeader();
  const raw = $("#rawInput").value;
  if (!raw.trim()) return;
  const guarded = protectMath(normalizeAIText(raw));
  let html = "";
  try { html = marked.parse(guarded, { breaks: true }); }
  catch { html = "<p>" + guarded.replace(/\n/g, "<br>") + "</p>"; }
  const body = $("#paperBody");
  body.innerHTML = restoreMath(html.replace(/\[(\d{1,3}\s*marks?)\]/gi, '<span class="marks" contenteditable="false">[$1]</span>'));
  [...body.children].forEach(el => { if (/^Q\d+\./.test(el.textContent.trim())) el.classList.add("q"); });
  wrapMathSrc(body);
  try {
    renderMathInElement(body, { delimiters: [
      { left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false }, { left: "\\[", right: "\\]", display: true }
    ], throwOnError: false });
  } catch {}
  splitLongInlineCode(body);
  renderKey();
  histSnap(true);
  updatePageChip();
  toast("Preview updated — click the paper to edit it");
}
$("#btnClean").onclick = render;

/* keep original LaTeX on each formula so exports stay native + edits can't break math */
function wrapMathSrc(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || n.nodeValue.indexOf("$") < 0) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (p && (p.closest("pre,code") || p.closest(".math-src"))) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  nodes.forEach(n => {
    const txt = n.nodeValue;
    let last = 0, m, hit = false;
    const frag = document.createDocumentFragment();
    re.lastIndex = 0;
    while ((m = re.exec(txt))) {
      hit = true;
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      const tok = m[0];
      const sp = document.createElement("span");
      sp.className = "math-src";
      sp.dataset.latex = tok.startsWith("$$") ? tok.slice(2, -2) : tok.slice(1, -1);
      sp.dataset.display = tok.startsWith("$$") ? "1" : "";
      sp.setAttribute("contenteditable", "false");
      sp.textContent = tok;
      frag.appendChild(sp);
      last = m.index + tok.length;
    }
    if (hit) {
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      n.parentNode.replaceChild(frag, n);
    }
  });
}

/* edit-in-place: format bar + paste-as-plain-text */
document.querySelectorAll(".fmt [data-cmd]").forEach(b => {
  b.addEventListener("mousedown", e => e.preventDefault());
  b.addEventListener("click", () => { $("#paperBody").focus(); document.execCommand(b.dataset.cmd, false, null); });
});
$("#paperBody").addEventListener("paste", e => {
  e.preventDefault();
  const t = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, t);
});

/* ---------- Undo / redo for preview edits ---------- */
const HIST = { snaps: [], i: -1, lock: false, timer: 0 };
function histPaint() {
  const u = $("#btnUndo"), r = $("#btnRedo");
  if (u) u.disabled = HIST.i <= 0;
  if (r) r.disabled = HIST.i >= HIST.snaps.length - 1;
}
function histSnap(force) {
  if (HIST.lock) return;
  const html = $("#paperBody").innerHTML;
  if (!force && HIST.snaps[HIST.i] === html) return;
  HIST.snaps.splice(HIST.i + 1); // drop any redo tail
  HIST.snaps.push(html);
  if (HIST.snaps.length > 60) { HIST.snaps.shift(); }
  HIST.i = HIST.snaps.length - 1;
  histPaint();
}
function histRestore(k) {
  if (k < 0 || k >= HIST.snaps.length || k === HIST.i) return;
  HIST.lock = true;
  $("#paperBody").innerHTML = HIST.snaps[k];
  HIST.i = k;
  HIST.lock = false;
  histPaint();
}
$("#btnUndo").onclick = () => histRestore(HIST.i - 1);
$("#btnRedo").onclick = () => histRestore(HIST.i + 1);
$("#paperBody").addEventListener("input", () => {
  clearTimeout(HIST.timer);
  HIST.timer = setTimeout(() => histSnap(), 450);
});
document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k !== "z" && k !== "y") return;
  const pb = document.querySelector("#paperBody");
  if (!pb || (document.activeElement !== pb && !pb.contains(document.activeElement))) return;
  e.preventDefault();
  if (k === "z" && e.shiftKey) histRestore(HIST.i + 1);
  else if (k === "z") histRestore(HIST.i - 1);
  else histRestore(HIST.i + 1); // Ctrl+Y
});

/* ---------- Find & replace in the paper (math and marks stay intact) ---------- */
function paperTextNodes() {
  const out = [];
  const walk = n => {
    if (n.nodeType === 3) { out.push(n); return; }
    if (n.nodeType !== 1) return;
    if (n.classList && (n.classList.contains("math-src") || n.classList.contains("marks"))) return;
    [...n.childNodes].forEach(walk);
  };
  [...$("#paperBody").childNodes].forEach(walk);
  return out;
}
function countMatches(q) {
  if (!q) return 0;
  const needle = q.toLowerCase();
  let n = 0;
  paperTextNodes().forEach(t => {
    const s = t.data.toLowerCase();
    let i = s.indexOf(needle);
    while (i >= 0) { n++; i = s.indexOf(needle, i + needle.length); }
  });
  return n;
}
function findPaint() {
  const q = $("#findQ").value;
  const info = $("#findInfo");
  if (!info) return;
  if (!q) { info.textContent = ""; return; }
  const n = countMatches(q);
  info.textContent = n ? n + " match" + (n === 1 ? "" : "es") : "no matches";
}
let findFrom = { node: null, offset: 0 };
function findNext() {
  const q = ($("#findQ").value || "");
  if (!q) return false;
  const needle = q.toLowerCase(), nodes = paperTextNodes();
  if (!nodes.length) return false;
  let startIdx = findFrom.node ? nodes.indexOf(findFrom.node) : -1;
  if (startIdx < 0) startIdx = 0;
  for (let k = 0; k <= nodes.length; k++) {
    const idx = (startIdx + k) % nodes.length;
    const t = nodes[idx];
    const from = (idx === startIdx && findFrom.node === t) ? Math.min(findFrom.offset, t.data.length) : 0;
    let at = t.data.toLowerCase().indexOf(needle, from);
    if (at < 0 && from > 0) at = t.data.toLowerCase().indexOf(needle); // wrap inside the node
    if (at >= 0) {
      const r = document.createRange();
      r.setStart(t, at); r.setEnd(t, at + q.length);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(r);
      findFrom = { node: t, offset: at + q.length };
      try { const rc = r.getBoundingClientRect(); if (rc && rc.top < 90 && r.startContainer.parentElement.scrollIntoView) r.startContainer.parentElement.scrollIntoView({ block: "center" }); } catch {}
      return true;
    }
  }
  return false;
}
function replaceOne() {
  const q = $("#findQ").value, repl = $("#findR").value;
  if (!q) return;
  if (!findNext()) { findPaint(); return; }
  const sel = window.getSelection();
  const node = sel.anchorNode, at = sel.anchorOffset;
  if (node && node.nodeType === 3) {
    node.data = node.data.slice(0, at) + repl + node.data.slice(at + q.length);
    findFrom = { node, offset: at + repl.length };
    histSnap(true);
  }
  findPaint();
}
function replaceAllHere() {
  const q = $("#findQ").value, repl = $("#findR").value;
  if (!q) return;
  const needle = q.toLowerCase();
  let n = 0;
  paperTextNodes().forEach(t => {
    const s = t.data, low = s.toLowerCase();
    if (low.indexOf(needle) < 0) return;
    let out = "", i = 0;
    while (i < s.length) {
      const at = low.indexOf(needle, i);
      if (at < 0) { out += s.slice(i); break; }
      out += s.slice(i, at) + repl;
      i = at + needle.length;
      n++;
    }
    t.data = out;
  });
  findFrom = { node: null, offset: 0 };
  if (n) histSnap(true);
  findPaint();
  toast(n ? "Replaced " + n + " occurrence" + (n === 1 ? "" : "s") : "No matches");
}
$("#btnFind").addEventListener("click", () => {
  const bar = $("#findBar"), btn = $("#btnFind");
  const open = bar.hidden;
  bar.hidden = !open;
  btn.setAttribute("aria-pressed", String(open));
  if (open) { $("#findQ").focus(); findPaint(); }
});
$("#findClose").onclick = () => { $("#findBar").hidden = true; $("#btnFind").setAttribute("aria-pressed", "false"); };
$("#btnFindNext").onclick = () => { if (!findNext()) toast("No matches"); findPaint(); };
$("#btnReplaceOne").onclick = replaceOne;
$("#btnReplaceAll").onclick = replaceAllHere;
$("#findQ").addEventListener("input", () => { findFrom = { node: null, offset: 0 }; findPaint(); });
$("#findQ").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#btnFindNext").click(); } });
$("#findR").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); replaceOne(); } });
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && !$("#findBar").hidden) {
    e.preventDefault(); $("#findQ").focus();
  }
});

/* ---------- Answer key page (real page break in Word + PDF) ---------- */
function keyOn() { return $("#cKey").checked && ($("#sKey").value || "").trim().length > 0; }
function renderKey() {
  const el = $("#paperKey"), mk = $("#keyBreak");
  if (!el) return;
  const on = keyOn();
  if (mk) mk.hidden = !on;
  el.hidden = !on;
  if (!on) { el.innerHTML = ""; return; }
  const md = protectMath(($("#sKey").value || "").replace(/\r\n/g, "\n"));
  let html = "";
  try { html = marked.parse(md, { breaks: true }); } catch { html = "<p>" + md + "</p>"; }
  el.innerHTML = restoreMath(html);
  wrapMathSrc(el);
  try {
    renderMathInElement(el, { delimiters: [
      { left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false }, { left: "\\[", right: "\\]", display: true }
    ], throwOnError: false });
  } catch {}
  splitLongInlineCode(el);
}
$("#cKey").addEventListener("change", () => {
  const w = $("#keyWrap");
  if (w) w.hidden = !$("#cKey").checked;
  renderKey();
});
let keyTimer = 0;
$("#sKey").addEventListener("input", () => { clearTimeout(keyTimer); keyTimer = setTimeout(renderKey, 400); });
$("#btnKeyClear").onclick = () => { $("#sKey").value = ""; $("#keyStatus").textContent = ""; renderKey(); };
$("#btnKeyAI").onclick = async () => {
  const paper = chatPaperText();
  if (!paper) { toast("Add questions first"); return; }
  const st = $("#keyStatus");
  st.className = "status"; st.textContent = "Writing solutions…";
  try {
    const j = await askAI({ provider: "gemini", model: aiModel || undefined, messages: [
      { role: "system", content: "You are a teacher writing a concise answer key. Return clean Markdown only: 'Q1. …' lines with short final answers, math in $...$ LaTeX. No preamble, no code fences." },
      { role: "user", content: "Write the answer key for this paper:\n\n" + paper }
    ], maxTokens: 8192, timeout: 120000 });
    $("#sKey").value = stripPaperFences((j.text || "").trim());
    st.className = "status ok"; st.textContent = "Done.";
    renderKey();
  } catch (e) { st.className = "status err"; st.textContent = "Failed: " + e.message + (e.code ? ` [${e.code}]` : ""); }
};

/* ---------- Zoom ---------- */
let zoom = 90, fitZoom = 1, currentEff = 1;
var pageOrient = "portrait", pageCols = 1; // page setup (Word parity: orientation + columns)
function pageDims() {
  return pageOrient === "landscape"
    ? { w: 1123, h: 794, tw: 16838, th: 11906 }
    : { w: 794, h: 1123, tw: 11906, th: 16838 };
}
function computeFit() {
  const scroller = document.querySelector(".paper-scroll");
  let avail = pageDims().w;
  if (scroller) { // clientWidth includes the gutter, and .a4 padding is inside its width (border-box)
    const cs = getComputedStyle(scroller);
    avail = scroller.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 4;
  }
  fitZoom = Math.min(1, Math.max(0.1, avail / pageDims().w));
}
function applyZoom() {
  computeFit();
  const eff = Math.max(0.2, Math.min(1.6, (zoom / 100) * fitZoom));
  currentEff = eff;
  $("#zoomLbl").textContent = zoom + "%";
  const paper = $("#paper");
  if ("zoom" in paper.style) { paper.style.zoom = eff; paper.style.transform = ""; } // reflows layout
  else paper.style.transform = `scale(${eff})`; // fallback
  updatePageChip();
}
let resizeFrame = 0;
window.addEventListener("resize", () => { // coalesce bursts into one layout pass
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; applyZoom(); });
}, { passive: true });
$("#zoomIn").onclick = () => { zoom = Math.min(140, zoom + 10); applyZoom(); };
$("#zoomOut").onclick = () => { zoom = Math.max(60, zoom - 10); applyZoom(); };
applyZoom();

/* ---------- PDF: real A4 sheets, paginated with margins on every page ----------
   html2pdf used to screenshot the continuous preview and slice it. That put the
   preview's padding only at the top of page 1, let CSS page-break "pads" create
   whole blank pages, and rounded 794×1123px into an extra trailing page. Here we
   build one off-screen 210×297mm sheet per page first, so A4, margins and page
   breaks are correct before a single canvas is captured. */
function pdfPageDims() {
  const landscape = pageOrient === "landscape";
  const wmm = landscape ? 297 : 210;
  const hmm = landscape ? 210 : 297;
  return { wmm, hmm, w: wmm * 96 / 25.4, h: hmm * 96 / 25.4, m: marginPx() };
}
function pdfEmptyBlock(el) {
  if (!el || el.nodeType !== 1) return true;
  if (el.classList.contains("empty")) return true;
  if (/^(HR|IMG|TABLE|SVG|CANVAS|VIDEO|IFRAME)$/.test(el.tagName)) return false;
  if (el.querySelector("img,table,svg,canvas,hr,video,iframe")) return false;
  return !(el.textContent || "").replace(/\u00a0/g, " ").trim();
}
function pdfCloneBlock(node) {
  const el = node.cloneNode(true);
  el.removeAttribute("id");
  el.removeAttribute("contenteditable");
  el.removeAttribute("spellcheck");
  el.querySelectorAll("[contenteditable]").forEach(n => n.removeAttribute("contenteditable"));
  return el;
}
function buildPdfPages() {
  const paper = $("#paper"), dims = pdfPageDims(), twoCol = pageCols === 2;
  syncHeader();                 // header/footer fields may have changed without a re-render
  if (keyOn()) renderKey();     // flush the 400ms answer-key debounce before measuring
  const host = document.createElement("div");
  host.className = "pdf-doc";
  host.setAttribute("aria-hidden", "true");
  ["--doc-body", "--doc-head", "--hscale", "--bscale", "--doc-align"].forEach(k => {
    const v = paper.style.getPropertyValue(k);
    if (v) host.style.setProperty(k, v);
  });
  document.body.appendChild(host);

  const headSrc = $("#paperHead"), footSrc = $("#paperFoot");
  const showHead = headSrc && getComputedStyle(headSrc).display !== "none";
  const showFoot = footSrc && getComputedStyle(footSrc).display !== "none";
  const showPageNo = $("#cPageNum").checked;
  const footLeft = ($("#fFoot").value || "").trim();
  const pages = [];
  let current = null;

  function makePage(withHead, key) {
    const page = document.createElement("article");
    const hasHead = withHead && showHead;
    page.className = "a4 pdf-page" + (pageOrient === "landscape" ? " landscape" : "");
    page.style.width = dims.w + "px";
    page.style.height = dims.h + "px";
    page.style.minHeight = dims.h + "px";
    page.style.padding = dims.m + "px";
    if (hasHead) page.appendChild(headSrc.cloneNode(true));
    const flow = document.createElement("div");
    flow.className = "paper-body pdf-flow" + (twoCol ? " two-col" : "") + (key ? " paper-key" : "");
    flow.style.marginTop = hasHead ? "14px" : "0px"; // preview keeps a 14px gap under the header
    page.appendChild(flow);
    if (showFoot) {
      // Word keeps the footer in the bottom margin (0.5" from the edge), not in
      // the text area. Place it there so body height matches Word's defaults.
      const foot = footSrc.cloneNode(true);
      const fb = Math.min(48, Math.max(6, dims.m - 34));
      foot.style.position = "absolute";
      foot.style.left = dims.m + "px";
      foot.style.right = dims.m + "px";
      foot.style.bottom = fb + "px";
      foot.style.marginTop = "0";
      page.appendChild(foot);
    }
    host.appendChild(page);
    current = { page, flow, key: !!key };
    pages.push(current);
    return current;
  }

  function contentHeight(rec) {
    const f = rec.flow, last = f.lastElementChild;
    if (!last) return 0;
    const cs = getComputedStyle(last);
    return last.getBoundingClientRect().bottom - f.getBoundingClientRect().top + (parseFloat(cs.marginBottom) || 0);
  }
  function fits(rec) {
    const f = rec.flow;
    if (twoCol && f.scrollWidth > f.clientWidth + 1) return false;
    if (f.scrollHeight > f.clientHeight + 1) return false;
    return contentHeight(rec) <= f.clientHeight + 1;
  }
  function appendBlock(rec, block) {
    rec.flow.appendChild(block);
    if (fits(rec)) return true;
    rec.flow.removeChild(block);
    return false;
  }
  function nextPage() { return makePage(false, current.key); }
  function trailingHeading(rec) {
    const last = rec.flow.lastElementChild;
    return last && /^H[1-6]$/.test(last.tagName) ? last : null;
  }
  function freshFlowHeight() {
    if (twoCol) return current.flow.clientHeight;
    const prev = current, tmp = makePage(false, current.key), h = tmp.flow.clientHeight;
    pages.pop(); tmp.page.remove(); current = prev;
    return h;
  }
  function blockHeight(block) {
    const probe = document.createElement("div");
    probe.className = "paper-body pdf-flow";
    probe.style.cssText = "position:absolute;left:0;top:0;height:auto;min-height:0;max-height:none;overflow:visible;margin:0;padding:0;";
    probe.style.width = current.flow.clientWidth + "px";
    host.appendChild(probe);
    probe.appendChild(block);
    const cs = getComputedStyle(block);
    const h = block.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    probe.remove();
    return h;
  }

  /* A table taller than one page is split by rows; the header repeats. */
  function splitTable(table) {
    const headNodes = [];
    let bodyRows = [], footNode = null, tbodyClass = "";
    [...table.children].forEach(child => {
      const tag = child.tagName;
      if (tag === "THEAD" || tag === "CAPTION" || tag === "COLGROUP") headNodes.push(child.cloneNode(true));
      else if (tag === "TFOOT") footNode = child.cloneNode(true);
      else if (tag === "TBODY") {
        if (!tbodyClass) tbodyClass = child.className;
        bodyRows.push(...child.rows);
      } else if (tag === "TR") bodyRows.push(child);
    });
    if (!bodyRows.length) bodyRows = [...table.rows];
    const skeleton = () => {
      const t = table.cloneNode(false);
      headNodes.forEach(n => t.appendChild(n.cloneNode(true)));
      const tb = document.createElement("tbody");
      if (tbodyClass) tb.className = tbodyClass;
      t.appendChild(tb);
      return { table: t, tbody: tb };
    };
    let part = skeleton();
    current.flow.appendChild(part.table);
    bodyRows.forEach((row, i) => {
      const r = row.cloneNode(true);
      part.tbody.appendChild(r);
      if (fits(current)) return;
      part.tbody.removeChild(r);
      if (!part.tbody.children.length) { // a single row is taller than the sheet
        if (current.flow.children.length > 1) { // there is other content above the table
          // Keep a short bold label ("Dark — Midnight Slate") with its table.
          let kicker = null;
          const prior = part.table.previousElementSibling;
          if (prior && prior.tagName === "P" && prior.querySelector("strong") &&
              prior.textContent.trim().length < 90 && prior.getBoundingClientRect().height < 60) kicker = prior;
          if (kicker) current.flow.removeChild(kicker);
          part.table.remove();
          nextPage();
          if (kicker) current.flow.appendChild(kicker);
          part = skeleton();
          current.flow.appendChild(part.table);
        }
        part.tbody.appendChild(r);
        // Only force the next row onto a new page if this row still does not
        // fit a fresh sheet (a genuinely over-tall row). A row that merely
        // missed the previous page's tail should stay and share this page.
        if (!fits(current) && i < bodyRows.length - 1) {
          nextPage();
          part = skeleton();
          current.flow.appendChild(part.table);
        }
        return;
      }
      nextPage();
      part = skeleton();
      current.flow.appendChild(part.table);
      part.tbody.appendChild(r);
    });
    if (footNode && footNode.children.length && current.flow.lastElementChild) {
      current.flow.lastElementChild.appendChild(footNode.cloneNode(true));
    }
  }

  /* A code block taller than one page is split by lines. */
  function splitPre(pre) {
    const code = pre.firstElementChild && pre.firstElementChild.tagName === "CODE" ? pre.firstElementChild : null;
    const source = code || pre;
    if (source.children.length) { current.flow.appendChild(pre); return; } // syntax-highlighted markup: keep it whole
    const lines = (source.textContent || "").split("\n");
    const make = () => {
      const p = pre.cloneNode(false);
      p.textContent = "";
      let textRoot = p;
      if (code) {
        const c = code.cloneNode(false);
        c.textContent = "";
        p.appendChild(c);
        textRoot = c;
      }
      current.flow.appendChild(p);
      return textRoot;
    };
    let cur = make();
    lines.forEach(line => {
      const add = (cur.textContent ? "\n" : "") + line;
      cur.textContent += add;
      if (fits(current)) return;
      cur.textContent = cur.textContent.slice(0, -add.length);
      if (!cur.textContent) {
        if (current.flow.children.length > 1) { // the empty pre is not enough to fill the sheet
          const preEl = cur.closest("pre");
          if (preEl) preEl.remove();
          nextPage();
          cur = make();
        }
        cur.textContent = line;
        return;
      }
      nextPage();
      cur = make();
      cur.textContent = line;
    });
  }

  function addBlock(node) {
    if (pdfEmptyBlock(node)) return;
    const block = pdfCloneBlock(node);
    if (appendBlock(current, block)) return;

    // A table or code block that is taller than any sheet must be split where
    // it is. Moving it first would leave page 1 with nothing but the header.
    if ((block.tagName === "TABLE" || block.tagName === "PRE") && !twoCol) {
      const tooTall = blockHeight(block) > freshFlowHeight() + 1;
      const firstPageWouldEmpty = current === pages[0] && current.flow.children.length <= 1;
      if (tooTall || firstPageWouldEmpty) {
        if (block.tagName === "TABLE") splitTable(block);
        else splitPre(block);
        return;
      }
      // A table that misses the remaining space should fill this sheet and
      // continue on the next one (like Word) instead of jumping whole pages.
      if (block.tagName === "TABLE" && current.flow.children.length) {
        splitTable(block);
        return;
      }
    }

    const heading = trailingHeading(current);
    if (heading) current.flow.removeChild(heading);
    if (current.flow.children.length || heading) {
      nextPage();
      if (heading) current.flow.appendChild(heading);
    }
    if (appendBlock(current, block)) return;
    if (block.tagName === "TABLE") splitTable(block);
    else if (block.tagName === "PRE") splitPre(block);
    else current.flow.appendChild(block); // keep content rather than silently drop it
  }

  const bodyNodes = [...$("#paperBody").children];
  const keyNodes = [...$("#paperKey").children].filter(n => !pdfEmptyBlock(n));
  if (!bodyNodes.some(n => !pdfEmptyBlock(n))) { host.remove(); return null; }

  makePage(true, false);
  bodyNodes.forEach(addBlock);

  if (keyOn() && keyNodes.length) {
    if (current.flow.children.length) nextPage();
    current.key = true;
    current.flow.classList.add("paper-key");
    keyNodes.forEach(addBlock);
  }

  // never leave an empty trailing sheet (the old exporter's blank last page)
  while (pages.length > 1 && !pages[pages.length - 1].flow.children.length) {
    const dead = pages.pop();
    dead.page.remove();
  }

  /* A block that only just missed the previous sheet used to leave a page with
     one lonely paragraph. Move trailing blocks forward so the last page reads
     like a page, not a stray margin (never across the answer-key break). */
  if (!twoCol && pages.length > 1) {
    const last = pages[pages.length - 1], prev = pages[pages.length - 2];
    if (!last.key && !prev.key && last.flow.children.length) {
      const target = last.flow.clientHeight * 0.22;
      while (contentHeight(last) < target && prev.flow.children.length > 1) {
        const block = prev.flow.lastElementChild;
        last.flow.prepend(block);
        if (fits(last)) continue;
        last.flow.removeChild(block);
        prev.flow.appendChild(block);
        break;
      }
    }
  }

  const total = pages.length;
  pages.forEach((rec, i) => {
    const foot = rec.page.querySelector(".paper-foot");
    if (!foot) return;
    const spans = foot.querySelectorAll("span");
    if (spans[0]) spans[0].textContent = footLeft;
    if (spans[1]) {
      spans[1].textContent = showPageNo ? (total > 1 ? `Page ${i + 1} of ${total}` : "Page 1") : "";
      spans[1].style.marginLeft = (showPageNo && !footLeft) ? "auto" : "";
    }
  });
  return { host, pages, dims };
}

/* Native Android uses the system share sheet; desktop keeps a normal download. */
async function downloadBlob(blob, filename) {
  try {
    if (window.docxzalNative && await window.docxzalNative.saveBlob(blob, filename)) return;
  } catch (e) {
    console.error("Native save failed", e);
  }
  if (typeof saveAs === "function") { saveAs(blob, filename); return; }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

$("#btnPdf").onclick = async () => {
  const btn = $("#btnPdf"), paperBody = $("#paperBody");
  if (!paperBody.textContent.trim()) { toast("Nothing to export yet"); return; }
  if (typeof html2canvas === "undefined" || !(window.jspdf && window.jspdf.jsPDF)) {
    window.print(); return; // offline fallback
  }
  btn.disabled = true;
  toast("Building PDF…");
  let built = null;
  try {
    await document.fonts.ready;
    built = buildPdfPages();
    if (!built) { toast("Nothing to export yet"); return; }
    await Promise.all([...built.host.querySelectorAll("img")].map(img => img.decode ? img.decode().catch(() => {}) : null));

    const { jsPDF } = window.jspdf;
    const orient = pageOrient === "landscape" ? "landscape" : "portrait";
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: orient, compress: true });
    // Phones get a slightly smaller capture: still print-quality, much less memory.
    const captureScale = (window.docxzalNative && window.docxzalNative.isNative()) ? 1.75 : 2;
    for (let i = 0; i < built.pages.length; i++) {
      toast(`Building PDF… page ${i + 1} of ${built.pages.length}`);
      const canvas = await html2canvas(built.pages[i].page, {
        scale: captureScale, useCORS: true, backgroundColor: "#ffffff", logging: false
      });
      if (i) pdf.addPage("a4", orient);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG",
        0, 0, built.dims.wmm, built.dims.hmm, undefined, "FAST");
      canvas.width = canvas.height = 0; // release the page bitmap before the next one
    }
    await downloadBlob(pdf.output("blob"), "docxzal-paper.pdf");
    toast(`Downloaded docxzal-paper.pdf · ${built.pages.length} page${built.pages.length === 1 ? "" : "s"}`);
  } catch (e) {
    console.error(e);
    toast("PDF failed — use More → Print instead");
  } finally {
    if (built) built.host.remove();
    btn.disabled = false;
  }
};
/* ---------- More-formats menu ---------- */
const ddExport = $("#ddExport"), btnMore = $("#btnMore"), exportMenu = ddExport.querySelector(".dd-menu");
function closeExportMenu() { btnMore.setAttribute("aria-expanded", "false"); exportMenu.classList.remove("open"); exportMenu.hidden = true; }
btnMore.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = exportMenu.hidden;
  btnMore.setAttribute("aria-expanded", String(open));
  if (open) { exportMenu.hidden = false; exportMenu.classList.add("open"); }
  else closeExportMenu();
});
document.addEventListener("click", (e) => { if (!exportMenu.hidden && !ddExport.contains(e.target)) closeExportMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !exportMenu.hidden) { closeExportMenu(); btnMore.focus(); } });
exportMenu.querySelectorAll(".menu-item").forEach(b => b.addEventListener("click", () => {
  closeExportMenu();
  ({ print: () => { const t0 = document.title; document.title = "docxzal-paper"; window.print(); setTimeout(() => { document.title = t0; }, 600); },
     doc: exportDoc, pptx: exportPptx, md: exportMd, html: exportHtml })[b.dataset.fmt]();
}));

/* ---------- AI Generate ---------- */
/* custom dropdown: tonal trigger, soft-glass menu, selected fill + check */
function makeDropdown(rootId, opts) {
  let { options, value, onChange } = opts;
  const root = document.getElementById(rootId);
  if (!root || !root.querySelector) return { get value() { return value; }, setOptions() {}, setValue() {} };
  const btn = root.querySelector(".dd-btn"), val = root.querySelector(".dd-val"), menu = root.querySelector(".dd-menu");
  if (!btn || !menu) return { get value() { return value; }, setOptions() {}, setValue() {} };
  let open = false;
  function paint() { if (val) val.textContent = (options.find(o => o.value === value) || {}).label || value; }
  function render() {
    menu.innerHTML = "";
    options.forEach(opt => {
      const it = document.createElement("div");
      it.className = "dd-item";
      it.setAttribute("role", "option");
      it.setAttribute("aria-selected", opt.value === value ? "true" : "false");
      const lb = document.createElement("span");
      lb.className = "dd-label"; lb.textContent = opt.label;
      it.append(lb); it.insertAdjacentHTML("beforeend", CHECK_SVG);
      it.addEventListener("click", (e) => { setValue(opt.value, e); close(); btn.focus(); });
      menu.appendChild(it);
    });
  }
  function setValue(v, ev) {
    if (value === v) return;
    value = v; paint(); render(); onChange(v, ev);
  }
  function close() { open = false; btn.setAttribute("aria-expanded", "false"); menu.classList.remove("open"); menu.hidden = true; }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    open = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) { menu.hidden = false; menu.classList.add("open"); }
    else close();
  });
  document.addEventListener("click", (e) => { if (open && !root.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) { close(); btn.focus(); } });
  render(); paint();
  return {
    get value() { return value; },
    setOptions(list) {
      options = list;
      if (!options.some(o => o.value === value)) value = options[0].value;
      render(); paint();
    },
    setValue(v) { setValue(v); }
  };
}
/* The model is chosen and swapped by the server from the key's live catalogue:
   nothing to pick here, and nothing to keep stale in localStorage. */
let aiModel = "";   // last model the server reported using; "" = let it decide

/* ---------- document font: one picker drives preview + every export ---------- */
const DOC_FONTS = {
  "georgia-poppins": { label: "Georgia + Poppins", bodyWord: "Georgia", headWord: "Poppins",
    bodyCss: 'Georgia,"Times New Roman",serif', headCss: "Poppins,sans-serif" },
  "times": { label: "Times New Roman", bodyWord: "Times New Roman", headWord: "Times New Roman",
    bodyCss: '"Times New Roman",Georgia,serif', headCss: '"Times New Roman",Georgia,serif' },
  "poppins": { label: "Poppins", bodyWord: "Poppins", headWord: "Poppins",
    bodyCss: "Poppins,sans-serif", headCss: "Poppins,sans-serif" },
  "system": { label: "System", bodyWord: "Calibri", headWord: "Calibri",
    bodyCss: 'system-ui,"Segoe UI",Roboto,Arial,sans-serif', headCss: 'system-ui,"Segoe UI",Roboto,Arial,sans-serif' }
};
let docFontKey = "georgia-poppins";
try { docFontKey = localStorage.getItem("bd_font") || "georgia-poppins"; } catch {}
if (!DOC_FONTS[docFontKey]) docFontKey = "georgia-poppins";
const docFonts = () => DOC_FONTS[docFontKey] || DOC_FONTS["georgia-poppins"];
function applyDocFont() {
  const f = docFonts(), paper = $("#paper");
  if (paper) { paper.style.setProperty("--doc-body", f.bodyCss); paper.style.setProperty("--doc-head", f.headCss); }
  try { localStorage.setItem("bd_font", docFontKey); } catch {}
}
makeDropdown("ddFont", {
  options: Object.entries(DOC_FONTS).map(([value, f]) => ({ value, label: f.label })),
  value: docFontKey,
  onChange: (v) => { if (DOC_FONTS[v]) { docFontKey = v; applyDocFont(); } }
});
applyDocFont();

/* ---------- heading size scale: preview and Word share the same factor ---------- */
const H_SCALES = { small: { label: "Small", k: 0.85 }, normal: { label: "Normal", k: 1 }, large: { label: "Large", k: 1.15 }, xl: { label: "Extra large", k: 1.3 }, xxl: { label: "Huge", k: 1.45 }, xxxl: { label: "Max", k: 1.6 } };
let hScaleKey = "normal";
try { hScaleKey = localStorage.getItem("bd_hscale") || "normal"; } catch {}
if (!H_SCALES[hScaleKey]) hScaleKey = "normal";
const hScale = () => (H_SCALES[hScaleKey] || H_SCALES.normal).k;
function applyHeadScale() {
  const paper = $("#paper");
  if (paper && paper.style) paper.style.setProperty("--hscale", String(hScale()));
  try { localStorage.setItem("bd_hscale", hScaleKey); } catch {}
}
makeDropdown("ddHSize", {
  options: Object.entries(H_SCALES).map(([value, s]) => ({ value, label: s.label })),
  value: hScaleKey,
  onChange: (v) => { if (H_SCALES[v]) { hScaleKey = v; applyHeadScale(); } }
});
applyHeadScale();

/* ---------- body text size scale: preview and Word share the same factor ---------- */
const B_SCALES = { small: { label: "Small", k: 0.9 }, normal: { label: "Normal", k: 1 }, large: { label: "Large", k: 1.1 }, xl: { label: "Extra large", k: 1.2 }, xxl: { label: "Huge", k: 1.35 }, xxxl: { label: "Max", k: 1.5 } };
let bScaleKey = "normal";
try { bScaleKey = localStorage.getItem("bd_bscale") || "normal"; } catch {}
if (!B_SCALES[bScaleKey]) bScaleKey = "normal";
const bScale = () => (B_SCALES[bScaleKey] || B_SCALES.normal).k;
const BS = () => Math.round(23 * bScale()); // Word run size for body text (half-points)
const bsz = (half) => Math.round(half * bScale()); // small print (meta, instr, tables, marks, footer)
function applyBodyScale() {
  const paper = $("#paper");
  if (paper && paper.style) paper.style.setProperty("--bscale", String(bScale()));
  splitLongInlineCode($("#paperBody"));
  try { localStorage.setItem("bd_bscale", bScaleKey); } catch {}
}
makeDropdown("ddBSize", {
  options: Object.entries(B_SCALES).map(([value, s]) => ({ value, label: s.label })),
  value: bScaleKey,
  onChange: (v) => { if (B_SCALES[v]) { bScaleKey = v; applyBodyScale(); } }
});
applyBodyScale();

/* ---------- text alignment: document default + per-paragraph toolbar ---------- */
const ALIGNMENTS = {
  left: { label: "Left" }, center: { label: "Center" },
  right: { label: "Right" }, justify: { label: "Justify" }
};
let alignKey = "left";
try { alignKey = localStorage.getItem("bd_align") || "left"; } catch {}
if (!ALIGNMENTS[alignKey]) alignKey = "left";
function applyDocAlign() {
  const paper = $("#paper");
  if (paper && paper.style) paper.style.setProperty("--doc-align", alignKey);
  try { localStorage.setItem("bd_align", alignKey); } catch {}
}
makeDropdown("ddAlign", {
  options: Object.entries(ALIGNMENTS).map(([value, a]) => ({ value, label: a.label })),
  value: alignKey,
  onChange: (v) => { if (ALIGNMENTS[v]) { alignKey = v; applyDocAlign(); } }
});
applyDocAlign();

/* ---------- page margins: presets + custom, preview and Word stay identical ---------- */
const MARGIN_PRESETS = {
  narrow: { label: 'Narrow (0.5")', inch: 0.5 },
  normal: { label: 'Word default — 1" (2.54 cm)', inch: 1 },
  wide: { label: 'Wide (1.5")', inch: 1.5 },
  custom: { label: "Custom…", inch: null }
};
var marginKey = "normal", marginCustom = 1; // var: computeFit may run before this line
try {
  marginKey = localStorage.getItem("bd_margin") || "normal";
  marginCustom = parseFloat(localStorage.getItem("bd_margin_custom")) || 1;
} catch {}
if (!MARGIN_PRESETS[marginKey]) marginKey = "normal";
function marginInch() { // const-free: computeFit may run before MARGIN_PRESETS initializes
  if (marginKey === "narrow") return 0.5;
  if (marginKey === "wide") return 1.5;
  if (marginKey === "custom") {
    const v = parseFloat(marginCustom);
    return Math.min(2, Math.max(0.25, isFinite(v) ? v : 1));
  }
  return 1;
}
function marginPx() { return Math.round(marginInch() * 96); }      // 96 CSS px = 1 inch
function marginTwips() { return Math.round(marginInch() * 1440); }  // Word twips
function tabPosTwips() { return 11906 - marginTwips() * 2; }        // A4 usable width
function applyMargins() {
  const paper = $("#paper");
  if (paper && paper.style) paper.style.padding = marginPx() + "px";
  let st = document.getElementById("pgMargin");
  if (!st) { st = document.createElement("style"); st.id = "pgMargin"; document.head.append(st); }
  st.textContent = `@media print{@page{size:A4 ${pageOrient};margin:${(marginInch() * 25.4).toFixed(1)}mm}}`;
  splitLongInlineCode($("#paperBody"));
  try { localStorage.setItem("bd_margin", marginKey); localStorage.setItem("bd_margin_custom", String(marginCustom)); } catch {}
  applyZoom();
}
makeDropdown("ddMargin", {
  options: Object.entries(MARGIN_PRESETS).map(([value, m]) => ({ value, label: m.label })),
  value: marginKey,
  onChange: (v) => {
    marginKey = v;
    const w = document.getElementById("marginCustomWrap");
    if (w) w.hidden = (v !== "custom");
    applyMargins();
  }
});
(function initMarginInput() {
  const inp = document.getElementById("fMargin"), w = document.getElementById("marginCustomWrap");
  if (!inp) return;
  inp.value = marginCustom;
  if (w) w.hidden = (marginKey !== "custom");
  inp.addEventListener("input", () => { marginCustom = parseFloat(inp.value); applyMargins(); });
})();
applyMargins();

/* ---------- page orientation + columns: preview and Word stay identical ---------- */
try {
  pageOrient = localStorage.getItem("bd_orient") === "landscape" ? "landscape" : "portrait";
  pageCols = localStorage.getItem("bd_cols") === "2" ? 2 : 1;
} catch {}
function applyPageSetup() {
  const paper = $("#paper");
  if (paper && paper.classList) paper.classList.toggle("landscape", pageOrient === "landscape");
  const body = $("#paperBody");
  if (body && body.classList) body.classList.toggle("two-col", pageCols === 2);
  applyMargins();       // @page orientation lives in the print style tag
  applyZoom();          // refit the sheet width
  updatePageChip();
  try { localStorage.setItem("bd_orient", pageOrient); localStorage.setItem("bd_cols", String(pageCols)); } catch {}
}
makeDropdown("ddOrient", {
  options: [{ value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }],
  value: pageOrient,
  onChange: (v) => { pageOrient = (v === "landscape") ? "landscape" : "portrait"; applyPageSetup(); }
});
makeDropdown("ddCols", {
  options: [{ value: "one", label: "One column" }, { value: "two", label: "Two columns" }],
  value: pageCols === 2 ? "two" : "one",
  onChange: (v) => { pageCols = (v === "two") ? 2 : 1; applyPageSetup(); }
});
applyPageSetup();
try { localStorage.removeItem("bd_key_gemini"); } catch {}

/* ---------- transport: local proxy when present, direct Gemini when hosted static ----------
   GitHub Pages serves files only, so POST /api/* is a 405 there. Gemini's REST API allows
   browser calls (CORS + x-goog-api-key), so on a static host the page talks to Google
   itself with the key typed into this field. Nothing is stored on either path. */
const GEMINI_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const PREFERRED_MODELS = ["gemini-3.5-flash"];
const NON_TEXT_MODELS = ["image", "embedding", "embed", "tts", "audio", "live", "computer-use"];
let transportMode = null; // "proxy" | "direct"
async function transport() {
  if (transportMode) return transportMode;
  if (window.docxzalNative && window.docxzalNative.isNative()) {
    transportMode = "direct"; // packaged app: there is no Python proxy on the phone
    return transportMode;
  }
  try {
    const r = await fetch("/api/status", { headers: { Accept: "application/json" } });
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const j = ct.includes("json") ? await r.json().catch(() => null) : null;
    transportMode = (j && typeof j.gemini === "boolean") ? "proxy" : "direct";
  } catch { transportMode = "direct"; } // file:// or no backend at all
  return transportMode;
}
function isPreferredModel(m) {
  const s = String(m || "").toLowerCase().replace("models/", "").trim();
  return PREFERRED_MODELS.some(p => s === p || s.startsWith(p + "-"));
}
function modelRank(id) { // preference first, then newest stable general model
  const s = String(id || "").toLowerCase();
  const ver = /(\d+(?:\.\d+)?)/.exec(s);
  const version = ver ? parseFloat(ver[1]) : 0;
  const unstable = /preview|exp|experimental|thinking|vision/.test(s) ? 1 : 0;
  const lite = s.includes("lite") ? 1 : 0;
  const family = s.includes("flash") ? 0 : (s.includes("pro") ? 1 : 2);
  return [isPreferredModel(s) ? 0 : 1, unstable, lite, -version, family, s.length, s];
}
function textModels(ids) {
  const usable = (ids || []).filter(i => i && !NON_TEXT_MODELS.some(s => String(i).toLowerCase().includes(s)));
  return [...new Set(usable)].sort((a, b) => {
    const ra = modelRank(a), rb = modelRank(b);
    for (let k = 0; k < ra.length; k++) {
      if (ra[k] < rb[k]) return -1;
      if (ra[k] > rb[k]) return 1;
    }
    return 0;
  });
}
const MODEL_CACHE = { fp: "", ids: [], at: 0 };
async function directModels(key, signal, fresh) {
  const fp = key.slice(-8);
  if (!fresh && MODEL_CACHE.fp === fp && Date.now() - MODEL_CACHE.at < 300000) return MODEL_CACHE.ids;
  const r = await fetch(GEMINI_ROOT + "/models?pageSize=200",
    { headers: { "x-goog-api-key": key }, signal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(((j.error || {}).message) || ("Gemini error " + r.status));
    e.code = "UPSTREAM_" + r.status;
    throw e;
  }
  const ids = (j.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map(m => String(m.name || "").replace("models/", ""));
  MODEL_CACHE.fp = fp; MODEL_CACHE.ids = ids; MODEL_CACHE.at = Date.now();
  return ids;
}
function geminiBody(messages, maxTokens) {
  const system = [], contents = [];
  (messages || []).forEach(m => {
    const role = m.role || "user";
    if (role === "system") { system.push(m.content || ""); return; }
    const parts = [];
    if (m.content) parts.push({ text: m.content });
    if (m.image) parts.push({ inline_data: { mime_type: "image/jpeg", data: String(m.image).split(",").pop() } });
    contents.push({ role: role === "assistant" ? "model" : "user", parts: parts.length ? parts : [{ text: "" }] });
  });
  const body = { contents: contents.length ? contents : [{ role: "user", parts: [{ text: "hi" }] }],
    generationConfig: { maxOutputTokens: maxTokens || 4096, temperature: 0.7 } };
  if (system.length) body.systemInstruction = { parts: [{ text: system.join("\n") }] };
  return body;
}
async function directGenerate(key, model, messages, maxTokens, signal, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout || 110000);
  if (signal) signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  try {
    const r = await fetch(`${GEMINI_ROOT}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(geminiBody(messages, maxTokens)),
      signal: ctrl.signal
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(((j.error || {}).message) || ("Gemini error " + r.status));
      e.code = "UPSTREAM_" + r.status;
      throw e;
    }
    return j;
  } finally { clearTimeout(timer); }
}
function geminiTextOf(resp) { // thought parts are not the answer
  const cand = (resp.candidates || [])[0] || {};
  const parts = (cand.content || {}).parts || [];
  const text = parts.filter(p => p && !p.thought && typeof p.text === "string").map(p => p.text).join("");
  if (text) return text;
  const thinking = parts.some(p => p && p.thought);
  const e = new Error(`Gemini returned no text (${cand.finishReason || "no answer"})`);
  e.code = "BAD_RESPONSE";
  e.thinking = thinking;
  throw e;
}
async function directPing(key, model, signal) {
  const ask = [{ role: "user", content: "Reply with exactly: ok" }];
  try {
    return geminiTextOf(await directGenerate(key, model, ask, 256, signal, 12000));
  } catch (e) {
    if (!e.thinking) throw e;
    // a thinking model spends a small budget on its thoughts: give it room once
    return geminiTextOf(await directGenerate(key, model, ask, 2048, signal, 12000));
  }
}
function shortReason(e) {
  const code = (e && e.code) || "", msg = String((e && e.message) || "").toLowerCase();
  if (/no longer available|retired|not found|not supported/.test(msg) || code === "UPSTREAM_404") return "retired";
  if (code === "UPSTREAM_429" || /quota|rate limit|resource_exhausted|exhausted/.test(msg)) return "limit reached";
  if ((e && e.name === "AbortError") || code === "TIMEOUT") return "timed out";
  if (code === "BAD_RESPONSE") return "no usable answer";
  if (/^UPSTREAM_5\d\d$/.test(code)) return "overloaded";
  if (/^UPSTREAM_40[013]$/.test(code)) return "key rejected";
  return "didn't answer";
}
async function directTest(key, onEvent, signal) {
  const t0 = performance.now();
  const ids = textModels(await directModels(key, signal, true)); // ListModels also proves the key
  onEvent({ event: "catalogue", count: ids.length });
  const order = ids.length ? ids : PREFERRED_MODELS;
  const tried = [];
  for (const m of order.slice(0, 6)) {
    onEvent({ event: "try", model: m, first: tried.length === 0 });
    try {
      await directPing(key, m, signal);
      return { ok: true, provider: "gemini", model: m, models: ids, verified: true,
        tried, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      if (e.name === "AbortError") throw e;
      const reason = shortReason(e);
      tried.push({ model: m, reason });
      if (reason === "key rejected") throw e; // another model won't fix a bad key
      onEvent({ event: "busy", model: m, reason });
    }
  }
  return { ok: true, provider: "gemini", model: order[0], models: ids, verified: false,
    note: tried.length ? tried[tried.length - 1].reason : "no answer",
    tried, ms: Math.round(performance.now() - t0) };
}
let lastDirectGood = "";
async function directAskAI({ messages, maxTokens, signal, key, asked, timeout }) {
  const t0 = performance.now();
  const ids = textModels(await directModels(key, signal, false));
  const order = [];
  const push = m => {
    m = String(m || "").replace("models/", "").trim();
    if (m && !order.includes(m) && (!ids.length || ids.includes(m))) order.push(m);
  };
  ids.filter(isPreferredModel).forEach(push);
  push(asked); push(lastDirectGood);
  ids.forEach(push);
  if (!order.length) order.push("gemini-3.5-flash", "gemini-flash-latest");
  const tried = [];
  let lastErr = null;
  for (const m of order.slice(0, 3)) {
    try {
      const text = geminiTextOf(await directGenerate(key, m, messages, maxTokens, signal, timeout));
      lastDirectGood = m;
      return { text, provider: "gemini", model: m, requested: asked || "",
        // "switched" means a model failed first — not that the preference started here
        switched: tried.length > 0, tried, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      if (e.name === "AbortError") throw e;
      lastErr = e; tried.push(m);
      if (shortReason(e) === "key rejected") throw e;
    }
  }
  throw lastErr || Object.assign(new Error("No model answered"), { code: "NO_MODEL" });
}

/* ---------- one frontend entry: askAI({provider, model, messages, signal, key}) ---------- */
async function askAI({ provider = "gemini", model, messages, signal, timeout = 55000, maxTokens, vision, key } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  if (signal) signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  const t0 = performance.now();
  // A key typed into Settings works immediately without Save: it is sent with each
  // request and used for that call only. The server never stores it.
  const typed = ($("#key-gemini") && $("#key-gemini").value.trim()) || "";
  const useKey = key || typed;
  try {
    if (await transport() === "direct") {
      if (!useKey) throw Object.assign(new Error("Paste your Gemini API key first"), { code: "NO_KEY" });
      return await directAskAI({ messages, maxTokens, signal: ctrl.signal, key: useKey, asked: model, timeout });
    }
    const r = await fetch("/api/ai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, messages, maxTokens, vision: !!vision,
        ...(useKey ? { key: useKey } : {}) }),
      signal: ctrl.signal
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      const e = new Error(j.error || ("Server error " + r.status));
      e.code = j.code || "SERVER_" + r.status;
      throw e;
    }
    j.ms = Math.round(performance.now() - t0);
    return j; // {text, provider, model, ms}
  } catch (e) {
    if (e.name === "AbortError") { const a = new Error("Cancelled"); a.code = "CANCELLED"; throw a; }
    throw e;
  } finally { clearTimeout(t); }
}

/* ---------- provider settings: keys, discovery, bounded verification ---------- */
$("#setToggle").addEventListener("click", () => {
  const btn = $("#setToggle"), reg = $("#setRegion");
  setExpanded(reg, btn, reg.hidden);
});
async function refreshStatus() {
  if (await transport() === "direct") { $("#ks-gemini").textContent = "No key"; return; }
  try {
    const j = await (await fetch("/api/status")).json();
    $("#ks-gemini").textContent = j.gemini ? "Key saved" : "No key";
  } catch {}
}
function keyCard(p) {
  const st = (msg, cls) => { const el = $("#st-" + p); el.className = "status" + (cls ? " " + cls : ""); el.textContent = msg; };
  $("#show-" + p).onclick = () => { // explicit click only
    const inp = $("#key-" + p);
    const show = inp.type === "password";
    inp.type = show ? "text" : "password";
    $("#show-" + p).setAttribute("aria-label", (show ? "Hide " : "Show ") + p + " key");
  };
  $("#clear-" + p).onclick = async () => { // explicit click only
    $("#key-" + p).value = "";
    if (await transport() === "proxy") {
      try { await fetch("/api/keys?provider=" + p, { method: "DELETE" }); } catch {}
    }
    refreshStatus(); st("Cleared.");
  };
  let cancelFn = null;
  const failWithCode = (j) => { const e = new Error(j.error); e.code = j.code; return e; };
  $("#test-" + p).onclick = async () => {
    const cancelBtn = $("#cancel-" + p);
    if (cancelFn) cancelFn(); // supersede any in-flight run so statuses can't interleave
    st("Checking the key…");
    cancelBtn.hidden = false;
    const ctrl = new AbortController();
    cancelFn = () => ctrl.abort();
    const typed = $("#key-" + p).value.trim();
    const mode = await transport();
    // Hard stop: never leave the card stuck if the network or a model stalls.
    const watchdog = setTimeout(() => ctrl.abort(), 45000);
    const hops = [];
    const land = (j) => {
      aiModel = j.model || "";
      const secs = j.ms ? " · " + (j.ms / 1000).toFixed(1) + "s" : "";
      const avail = (j.models || []).length ? ` · ${j.models.length} available` : "";
      const skipped = hops.length
        ? ` · routed past ${hops.length} busy model${hops.length === 1 ? "" : "s"}` : "";
      if (j.verified === false) {
        st(`Key works${avail} · all models busy right now — Generate keeps routing automatically`, "ok");
      } else {
        st(`Verified · ${j.model}${secs}${avail}${skipped} · auto-switches if one is busy`, "ok");
      }
      // raw upstream detail stays on hover, never in the card
      const el = $("#st-" + p);
      el.title = hops.map(h => `${h.model}: ${h.reason}`).join("\n");
      $("#ks-gemini").textContent = typed ? "Key in use (not saved)" : "Key saved";
    };
    const onEvent = (ev) => {
      if (ev.event === "try") {
        const last = hops[hops.length - 1];
        st(ev.first ? `Checking the key with ${ev.model}…`
          : last ? `${last.model} is busy · routing to ${ev.model}…`
          : `Routing to ${ev.model}…`);
      } else if (ev.event === "busy") {
        hops.push({ model: ev.model, reason: ev.reason || "busy" });
        st(`${ev.model} is busy (${ev.reason || "no answer"}) — routing to another model…`);
      }
    };
    try {
      if (mode === "direct") {
        // static host (GitHub Pages): no proxy to call, so the page asks Google itself
        if (!typed) throw failWithCode({ error: "Paste a key first — Test doesn't save it", code: "NO_KEY" });
        land(await directTest(typed, onEvent, ctrl.signal));
        return;
      }
      // One call does everything: verify the key, route past busy / retired / silent
      // models until one answers, and list the catalogue. Nothing is saved; the key
      // is reused from this input for Generate while the page is open.
      const r = await fetch("/api/test", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p, key: typed || undefined, stream: true }), signal: ctrl.signal });
      if (!r.ok) {
        const bad = await r.json().catch(() => ({}));
        throw failWithCode(Object.assign({ error: "Server error " + r.status, code: "SERVER_" + r.status }, bad));
      }
      let final = null;
      if (!r.body || !r.body.getReader) { // no streaming support: plain JSON answer
        final = await r.json();
      } else {
        const reader = r.body.getReader(), dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev = null;
            try { ev = JSON.parse(line); } catch { continue; }
            if (ev.event === "done") final = ev; else onEvent(ev);
          }
        }
        const tail = buf.trim();
        if (tail) { // a plain JSON body has no trailing newline
          let ev = null;
          try { ev = JSON.parse(tail); } catch {}
          if (ev) final = ev;
        }
      }
      if (!final) throw new Error("Test lost the connection — try again");
      if (final.error) throw failWithCode(final);
      land(final);
    } catch (e) {
      if (e.name === "AbortError") st("Cancelled.", "");
      else {
        const code = e.code ? ` [${e.code}]` : "";
        st("Failed: " + e.message + code, "err");
        $("#st-" + p).title = "";
      }
    } finally { clearTimeout(watchdog); cancelBtn.hidden = true; cancelFn = null; }
  };
  $("#cancel-" + p).onclick = () => { if (cancelFn) cancelFn(); };
}
keyCard("gemini"); refreshStatus();
function servedLine(j) {
  const el = $("#servedBy");
  el.hidden = false;
  if (j.model) aiModel = j.model;
  const swap = (j.switched && j.requested && j.requested !== j.model)
    ? ` · auto-switched from ${j.requested}` : "";
  el.textContent = `Answered by ${j.provider} · ${j.model}${swap}${j.ms ? ` · ${(j.ms / 1000).toFixed(1)}s` : ""}`;
}
function buildPrompt() {
  return `Create a school question paper in clean Markdown. Subject: ${$("#fSubject").value}, ${$("#fClass").value}. ` +
    `Topics: ${$("#fTopics").value}. Total ~${$("#fMarks").value} marks, Time ${$("#fTime").value}. ` +
    `Rules: headings ## Section A/B, each question as "Q1. ... [N marks]". Math in $...$ / $$...$$ LaTeX. Tables in Markdown. Code in fences. No title block, no preamble, no instructions section — start directly with the first section heading.`;
}
/* AI loves its own title page — drop everything before the first real block.
   The app header already carries school/title/meta/instructions. */
function structurePaper(md) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  let start = 0, found = false;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (/^(Q\d+\.|#{1,3}\s+(Section|Part)\b|\d{1,2}[.)]\s+[A-Z\u00c0-\u024f]|```|\||\s*[-*]\s+\S)/.test(lines[i].trim())) { start = i; found = true; break; }
  }
  const out = (found ? lines.slice(start) : lines).join("\n").replace(/^#\s+/gm, "## ");
  return out.trim() || String(md || "").trim();
}
$("#btnGenerate").onclick = async () => {
  const st = $("#aiStatus");
  $("#genLabel").textContent = "Generating…"; st.className = "status"; st.textContent = "Calling Gemini…";
  try {
    const j = await askAI({ provider: "gemini", model: aiModel || undefined, messages: [
      { role: "system", content: "You write clean Markdown exam papers with LaTeX math." },
      { role: "user", content: buildPrompt() }
    ], maxTokens: 8192, timeout: 120000 }); // thinking models need a big budget + time
    if (!j.text.trim()) throw new Error("Empty response — try again.");
    $("#rawInput").value = structurePaper(j.text); syncCount(); render(); tabs[0].click();
    servedLine(j);
    st.className = "status ok"; st.textContent = `Done · ${j.model}.`;
  } catch (e) { st.className = "status err"; st.textContent = e.message + (e.code ? ` [${e.code}]` : ""); }
  finally { $("#genLabel").textContent = "Generate with AI"; }
};

/* ================= FULL CONVERSION ENGINE =================
   LaTeX → native docx OMML (verified against docx@8.5.0 UMD exports):
   Math, MathRun, MathFraction, MathRadical(+degree), MathSuperScript,
   MathSubScript, MathSubSuperScript, MathSum, MathIntegral, MathFunction,
   MathRound/Square/Curly/AngledBrackets. Tables via Table+TableBorders. */
const SYM = {
  alpha:"α",beta:"β",gamma:"γ",delta:"δ",epsilon:"ε",varepsilon:"ε",zeta:"ζ",eta:"η",
  theta:"θ",vartheta:"ϑ",iota:"ι",kappa:"κ",lambda:"λ",mu:"μ",nu:"ν",xi:"ξ",
  pi:"π",varpi:"ϖ",rho:"ρ",varrho:"ϱ",sigma:"σ",varsigma:"ς",tau:"τ",upsilon:"υ",
  phi:"φ",varphi:"ϕ",chi:"χ",psi:"ψ",omega:"ω",
  Gamma:"Γ",Delta:"Δ",Theta:"Θ",Lambda:"Λ",Xi:"Ξ",Pi:"Π",Sigma:"Σ",Phi:"Φ",Psi:"Ψ",Omega:"Ω",
  infty:"∞",times:"×",div:"÷",pm:"±",mp:"∓",cdot:"·",ast:"∗",star:"⋆",
  leq:"≤",geq:"≥",neq:"≠",approx:"≈",equiv:"≡",propto:"∝",sim:"∼",cong:"≈",
  ll:"≪",gg:"≫",subset:"⊂",supset:"⊃",subseteq:"⊆",supseteq:"⊇",in:"∈",ni:"∋",notin:"∉",
  cup:"∪",cap:"∩",setminus:"∖",emptyset:"∅",forall:"∀",exists:"∃",neg:"¬",
  land:"∧",lor:"∨",oplus:"⊕",otimes:"⊗",odot:"⊙",
  to:"→",rightarrow:"→",leftarrow:"←",leftrightarrow:"↔",Rightarrow:"⇒",Leftarrow:"⇐",
  Leftrightarrow:"⇔",mapsto:"↦",uparrow:"↑",downarrow:"↓",infty2:"∞",
  circ:"°",degree:"°",prime:"′",ldots:"…",vdots:"⋮",ddots:"⋱",cdots:"⋯",
  dots:"…",hellip:"…",partial:"∂",nabla:"∇",surd:"√",angle:"∠",perp:"⊥",
  parallel:"∥",mid:"∣",lvert:"|",rvert:"|",Vert:"‖",
  sum:"∑",prod:"∏",coprod:"∐",int:"∫",oint:"∮",iint:"∬",iiint:"∭",
  bigcup:"⋃",bigcap:"⋂",bigvee:"⋁",bigwedge:"⋀",bigoplus:"⨁",bigotimes:"⨂",
  sqrt2:"√",aleph:"ℵ",hbar:"ℏ",ell:"ℓ",Re:"ℜ",Im:"ℑ",wp:"℘",
  dotsb:"⋯",dotsc:"…",dotsi:"⋯",dotsm:"⋯",dotso:"…"
};
const FUNC_NAMES = ["sin","cos","tan","sec","csc","cot","sinh","cosh","tanh","log","ln","lg","exp","arg","deg","det","gcd","min","max","sup","inf","lim","limsup","liminf","Pr"];
const COMB = { hat:"\u0302",check:"\u030C",tilde:"\u0303",acute:"\u0301",grave:"\u0300",dot:"\u0307",ddot:"\u0308",dddot:"\u0307\u0307",breve:"\u0306",bar:"\u0304",ring:"\u030A",vec:"\u20D7",widevec:"\u20D7",widehat:"\u0302",widetilde:"\u0303",overline:"\u0305",underline:"\u0332" };
function mathReady() { return typeof docx !== "undefined" && docx.Math && docx.MathRun && docx.MathFraction; }
function MR(t) { return new docx.MathRun(String(t)); }

function splitTop(s, sep) { // split on sep ignoring {...}
  const parts = []; let d = 0, cur = "";
  for (let k = 0; k < s.length; k++) {
    if (s.startsWith(sep, k) && d === 0) { parts.push(cur); cur = ""; k += sep.length - 1; continue; }
    if (s[k] === "{") d++; if (s[k] === "}") d--;
    cur += s[k];
  }
  parts.push(cur); return parts;
}

function latexToMathKids(src) {
  let s = String(src);
  s = s.replace(/\\(left|right|middle|big|Big|bigg|Bigg)\s*/g, "");
  const kids = [];
  let i = 0, buf = "";
  const flush = () => { if (buf) { kids.push(MR(buf)); buf = ""; } };
  function readBrace() {
    if (s[i] !== "{") return null;
    let d = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") d++;
      if (s[j] === "}") { d--; if (d === 0) { const out = s.slice(i + 1, j); i = j + 1; return out; } }
    }
    return null;
  }
  function readBracket() {
    if (s[i] !== "[") return null;
    let d = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "[") d++;
      if (s[j] === "]") { d--; if (d === 0) { const out = s.slice(i + 1, j); i = j + 1; return out; } }
    }
    return null;
  }
  function readCmd() {
    const m = s.slice(i).match(/^\\([a-zA-Z]+|.)/);
    if (!m) return null;
    i += m[0].length; return m[1];
  }
  function kidsOf(str) { return latexToMathKids(str); }
  function scriptsAfter() {
    let sub = null, sup = null;
    for (let guard = 0; guard < 2; guard++) {
      while (s[i] === " ") i++;
      if (s[i] === "_" || s[i] === "^") {
        const isSub = s[i] === "_"; i++;
        while (s[i] === " ") i++;
        let v;
        if (s[i] === "{") v = readBrace();
        else if (s[i] === "\\") { const c = readCmd(); v = (c === null || c === " ") ? " " : "\\" + c; }
        else { v = s[i] || ""; i++; }
        if (isSub) sub = v; else sup = v;
      } else break;
    }
    return { sub, sup };
  }
  function attachScripts(baseKids, baseText, ss) {
    if (ss.sub != null && ss.sup != null && docx.MathSubSuperScript)
      return [new docx.MathSubSuperScript({ children: baseKids, subScript: kidsOf(ss.sub), superScript: kidsOf(ss.sup) })];
    if (ss.sub != null && docx.MathSubScript)
      return [new docx.MathSubScript({ children: baseKids, subScript: kidsOf(ss.sub) })];
    if (ss.sup != null && docx.MathSuperScript)
      return [new docx.MathSuperScript({ children: baseKids, superScript: kidsOf(ss.sup) })];
    return baseKids; // no scripts → plain base, never null
  }
  function applyCombining(str, comb) {
    return str.split("").map(c => /[{}]/.test(c) ? c : c + comb).join("");
  }
  while (i < s.length) {
    const ch = s[i];
    if (ch === "%") break; // LaTeX comment
    if (ch === "\\") {
      const cmd = readCmd();
      if (cmd === null) break;
      if (cmd === " " || cmd === ",") { buf += " "; continue; }
      if (";:!".includes(cmd)) { buf += cmd === "!" ? "" : " "; continue; }
      if (["quad", "qquad", "\\", "newline"].includes(cmd)) { buf += cmd === "\\" || cmd === "newline" ? " " : "  "; continue; }
      if (["text", "mathrm", "mathit", "mathbf", "boldsymbol", "mathsf", "mathtt", "mathcal", "mathscr", "mathsf"].includes(cmd)) {
        while (s[i] === " ") i++;
        const g = s[i] === "{" ? readBrace() : (s[i++] || "");
        flush(); kids.push(MR(g ?? "")); continue;
      }
      if (cmd === "mathbb") {
        while (s[i] === " ") i++;
        const g = (s[i] === "{" ? readBrace() : (s[i++] || "")) || "";
        const dbl = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" };
        flush(); kids.push(MR(dbl[g] || g)); continue;
      }
      if (["frac", "dfrac", "tfrac", "cfrac"].includes(cmd)) {
        flush();
        while (s[i] === " ") i++;
        const a = s[i] === "{" ? readBrace() : (s[i++] || "");
        while (s[i] === " ") i++;
        const b = s[i] === "{" ? readBrace() : (s[i++] || "");
        kids.push(new docx.MathFraction({ numerator: kidsOf(a ?? ""), denominator: kidsOf(b ?? "") }));
        continue;
      }
      if (cmd === "binom") {
        flush();
        while (s[i] === " ") i++;
        const a = s[i] === "{" ? readBrace() : (s[i++] || "");
        while (s[i] === " ") i++;
        const b = s[i] === "{" ? readBrace() : (s[i++] || "");
        kids.push(new docx.MathRoundBrackets({ children: [new docx.MathFraction({ numerator: kidsOf(a ?? ""), denominator: kidsOf(b ?? "") })] }));
        continue;
      }
      if (cmd === "sqrt") {
        flush();
        while (s[i] === " ") i++;
        const deg = s[i] === "[" ? readBracket() : null;
        while (s[i] === " ") i++;
        const a = s[i] === "{" ? readBrace() : (s[i++] || "");
        if (deg != null) kids.push(new docx.MathRadical({ children: kidsOf(a ?? ""), degree: kidsOf(deg) }));
        else kids.push(new docx.MathRadical({ children: kidsOf(a ?? "") }));
        continue;
      }
      if (["sum", "prod", "coprod"].includes(cmd)) {
        flush();
        const ss = scriptsAfter();
        const base = { sum: "∑", prod: "∏", coprod: "∐" }[cmd];
        if (cmd === "sum") kids.push(new docx.MathSum({ children: [MR(" ")], subScript: ss.sub != null ? kidsOf(ss.sub) : undefined, superScript: ss.sup != null ? kidsOf(ss.sup) : undefined }));
        else kids.push(...attachScripts([MR(base)], base, ss));
        continue;
      }
      if (["int", "oint", "iint", "iiint", "oiiint"].includes(cmd)) {
        flush();
        const ss = scriptsAfter();
        if (cmd === "int") kids.push(new docx.MathIntegral({ children: [MR(" ")], subScript: ss.sub != null ? kidsOf(ss.sub) : undefined, superScript: ss.sup != null ? kidsOf(ss.sup) : undefined }));
        else kids.push(...attachScripts([MR(SYM[cmd] || "∫")], "", ss));
        continue;
      }
      if (["bigcup", "bigcap", "bigvee", "bigwedge", "bigoplus", "bigotimes", "bigodot", "bigsqcup", "biguplus"].includes(cmd)) {
        flush();
        const ss = scriptsAfter();
        kids.push(...attachScripts([MR(SYM[cmd] || cmd)], "", ss));
        continue;
      }
      if (FUNC_NAMES.includes(cmd)) {
        flush();
        const ss = scriptsAfter();
        while (s[i] === " ") i++;
        let arg = null;
        if (s[i] === "{") arg = readBrace();
        else if (s[i] && /[a-zA-Z0-9(]/.test(s[i]) && (ss.sub == null && ss.sup == null)) { arg = s[i]; i++; }
        let fn;
        if (arg != null) fn = new docx.MathFunction({ name: [MR(cmd)], children: kidsOf(arg) });
        else fn = MR(cmd);
        if ((ss.sub != null || ss.sup != null) && typeof fn !== "string") {
          const w = attachScripts([fn], "", ss);
          if (w) { kids.push(...w); continue; }
        }
        kids.push(fn); continue;
      }
      if (COMB[cmd] !== undefined) {
        while (s[i] === " ") i++;
        let base = s[i] === "{" ? readBrace() : (s[i] ? s[i++] : "");
        base = base ?? "";
        if (buf) { buf = applyCombining(buf, COMB[cmd]); }
        else if (base) { flush(); kids.push(MR(applyCombining(base, COMB[cmd]))); }
        continue;
      }
      if (cmd === "overline" || cmd === "underline" || cmd === "overbrace" || cmd === "underbrace") {
        while (s[i] === " ") i++;
        const g = (s[i] === "{" ? readBrace() : (s[i++] || "")) || "";
        const comb = (cmd === "underline" || cmd === "underbrace") ? "\u0332" : "\u0305";
        flush(); kids.push(MR(applyCombining(g, comb))); continue;
      }
      if (cmd === "boxed") {
        while (s[i] === " ") i++;
        const g = s[i] === "{" ? readBrace() : (s[i++] || "");
        flush(); kids.push(new docx.MathSquareBrackets({ children: kidsOf(g ?? "") })); continue;
      }
      if (["cancel", "bcancel", "xcancel"].includes(cmd)) {
        while (s[i] === " ") i++;
        const g = (s[i] === "{" ? readBrace() : (s[i++] || "")) || "";
        flush(); kids.push(MR(applyCombining(g, "\u0338"))); continue;
      }
      if (cmd === "phantom" || cmd === "hphantom" || cmd === "vphantom") {
        while (s[i] === " ") i++;
        if (s[i] === "{") readBrace(); else if (s[i]) i++;
        buf += " "; continue;
      }
      if (["overset", "underset", "stackrel"].includes(cmd)) {
        while (s[i] === " ") i++;
        const a = s[i] === "{" ? readBrace() : (s[i++] || "");
        while (s[i] === " ") i++;
        const b = s[i] === "{" ? readBrace() : (s[i++] || "");
        flush(); kids.push(MR(`(${(cmd === "underset" ? b : a) ?? ""})`)); buf += (b ?? ""); continue;
      }
      if (["begin", "end"].includes(cmd)) {
        // environments handled at block level; inline: linearize matrix/cases content
        while (s[i] === " ") i++;
        const env = s[i] === "{" ? readBrace() : "";
        if (cmd === "begin" && env) {
          const rest = s.slice(i);
          const endTag = `\\end{${env}}`;
          const at = rest.indexOf(endTag);
          const body = at >= 0 ? rest.slice(0, at) : rest;
          if (at >= 0) i += at + endTag.length; else i = s.length;
          flush();
          kids.push(...linearEnv(env, body));
        }
        continue;
      }
      if (["hline", "hdashline", "tag", "label", "nonumber", "displaystyle", "limits", "nolimits"].includes(cmd)) {
        if (cmd === "tag") { while (s[i] === " ") i++; if (s[i] === "{") readBrace(); }
        continue;
      }
      if (SYM[cmd] !== undefined) { buf += SYM[cmd]; continue; }
      if (/^(rm|it|bf|sf|tt)$/.test(cmd)) continue;
      buf += cmd; continue; // unknown command → literal, never lost
    }
    else if (ch === "^" || ch === "_") {
      const isSup = ch === "^"; i++;
      while (s[i] === " ") i++;
      let scr;
      if (s[i] === "{") scr = readBrace();
      else if (s[i] === "\\") { const c = readCmd(); scr = (c === null || c === " ") ? " " : "\\" + c; }
      else { scr = s[i] || ""; i++; }
      const scrKids = kidsOf(scr ?? "");
      if (buf) { const base = buf; buf = ""; flush(); kids.push(...attachScripts([MR(base)], base, isSup ? { sup: scr, sub: null } : { sub: scr, sup: null }) || [MR(base)]); }
      else {
        const prev = kids.pop();
        if (prev) {
          const w = isSup
            ? (docx.MathSuperScript ? new docx.MathSuperScript({ children: [prev], superScript: scrKids }) : null)
            : (docx.MathSubScript ? new docx.MathSubScript({ children: [prev], subScript: scrKids }) : null);
          kids.push(w || prev);
          if (!w) scrKids.forEach(k => kids.push(k));
        } else scrKids.forEach(k => kids.push(k));
      }
      continue;
    }
    else if (ch === "{") { const g = readBrace(); if (g !== null) { const k = kidsOf(g); if (buf) { flush(); } k.forEach(x => kids.push(x)); continue; } }
    else if (ch === "}") { i++; continue; }
    else if (ch === "&") { buf += "  "; i++; continue; }
    else if (ch === "~") { buf += " "; i++; continue; }
    else if (ch === "$") { i++; continue; }
    else { buf += ch; i++; continue; }
  }
  flush();
  return kids.length ? kids : [MR("")];
}

function matrixBodyToTable(env, body) {
  const rows = splitTop(body, "\\\\").map(r => splitTop(r, "&").map(c => c.trim()));
  return rows.filter(r => r.join("").trim() !== "");
}
function xmlComponentToString(node) { // docx component tree → XML text (docx has no matrix class)
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") {
    return String(node).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  if (Array.isArray(node)) return node.map(xmlComponentToString).join("");
  const key = node.rootKey;
  if (!key) return "";
  if (key === "_attr") {
    return Object.entries(node.root || {}).map(([k, v]) => {
      const name = (node.xmlKeys && node.xmlKeys[k]) || k;
      return ` ${name}="${String(v).replace(/"/g, "&quot;")}"`;
    }).join("");
  }
  const kids = Array.isArray(node.root) ? node.root : [];
  const inner = kids.map(xmlComponentToString).join("");
  return inner ? `<${key}>${inner}</${key}>` : `<${key}/>`;
}
function ommlComponent(xml) { // OMML string → real docx component tree (docx's raw-XML class is buggy)
  const NS = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"' +
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  let src = xml;
  const head = xml.slice(0, xml.indexOf(">") + 1); // declare namespaces on the fragment root
  if (head && !/xmlns:m=/.test(head)) src = xml.replace(/^<([A-Za-z:_][\w:.-]*)/, (m, tag) => `<${tag} ${NS}`);
  const dom = new DOMParser().parseFromString(src, "application/xml");
  if (dom.getElementsByTagName("parsererror").length) throw new Error("bad omml");
  const build = el => {
    const c = new docx.XmlComponent(el.tagName);
    if (el.attributes && el.attributes.length) {
      const map = {};
      for (const a of el.attributes) if (!/^xmlns/.test(a.name)) map[a.name] = a.value;
      if (Object.keys(map).length) c.root.push(new docx.XmlAttributeComponent(map));
    }
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { if (n.textContent) c.root.push(n.textContent); continue; }
      c.root.push(build(n));
    }
    return c;
  };
  return build(dom.documentElement);
}
function xmlEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function kidsXml(latex) {
  try { return latexToMathKids(latex).map(xmlComponentToString).join(""); }
  catch { return `<m:r><m:t>${xmlEsc(latexFallbackText(latex))}</m:t></m:r>`; }
}
function envXml(env, body) { // matrix / cases / align → REAL OMML instead of flattened text
  const e = env.replace("*", "");
  if (/^(matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|array|smallmatrix)$/.test(e)) {
    const src = e === "array" ? body.replace(/^\s*\{[^}]*\}/, "") : body;
    const rows = matrixBodyToTable(e, src).filter(r => r.some(c => c.trim()));
    if (!rows.length) return "";
    const del = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"],
      vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"] }[e];
    const m = `<m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="${rows[0].length}"/>` +
      `<m:mcJc m:val="center"/></m:mcPr></m:mc></m:mcs></m:mPr>` +
      rows.map(r => `<m:mr>${r.map(c => `<m:e>${kidsXml(c)}</m:e>`).join("")}</m:mr>`).join("") +
      `</m:m>`;
    if (!del) return m;
    return `<m:d><m:dPr><m:begChr m:val="${del[0]}"/><m:endChr m:val="${del[1]}"/></m:dPr><m:e>${m}</m:e></m:d>`;
  }
  if (e === "cases" || e === "dcases" || e === "rcases") {
    const rows = matrixBodyToTable(e, body).filter(r => r.some(c => c.trim()));
    if (!rows.length) return "";
    const arr = `<m:eqArray>${rows.map(r => `<m:e>${kidsXml(r.join("  "))}</m:e>`).join("")}</m:eqArray>`;
    return `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=" "/></m:dPr><m:e>${arr}</m:e></m:d>`;
  }
  if (/^(align|aligned|gather|gathered|multline|equation|split)$/.test(e)) {
    const rows = splitTop(body, "\\\\").map(r => r.replace(/&/g, " ").trim()).filter(Boolean);
    if (!rows.length) return "";
    return `<m:eqArray>${rows.map(r => `<m:e>${kidsXml(r)}</m:e>`).join("")}</m:eqArray>`;
  }
  return "";
}
function linearEnv(env, body) {
  const xml = envXml(env, body);
  if (xml) return [ommlComponent(xml)];
  return latexToMathKids(body);
}

function latexFallbackText(src) {
  return String(src).replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\\([a-zA-Z]+)/g, (m, n) => (SYM[n] !== undefined ? SYM[n] : n))
    .replace(/[{}]/g, "");
}

/* ---------- Export from the EDITED paper (live DOM → docx) ---------- */
function mathKid(latex) {
  if ($("#cNativeMath").checked && mathReady()) {
    try { return new docx.Math({ children: latexToMathKids(latex) }); }
    catch { /* fall through to text */ }
  }
  return new docx.TextRun({ text: latexFallbackText(latex), size: BS() });
}
function runsFromNodes(nodes, st = {}) {
  const size = st.size || BS();
  const font = st.mono ? "Consolas" : (st.font || docFonts().bodyWord); // preview paper body — match it
  const color = st.mono ? "0f172a" : st.color;
  const out = [];
  nodes.forEach(ch => {
    if (ch.nodeType === 3) {
      if (!ch.textContent) return;
      out.push(new docx.TextRun({ text: ch.textContent, size,
        bold: st.b || undefined, italics: st.i || undefined,
        underline: st.u ? {} : undefined, strike: st.s || undefined,
        font, color }));
    } else if (ch.nodeType === 1) {
      const tag = ch.tagName.toLowerCase();
      if (ch.classList && ch.classList.contains("math-src")) {
        out.push(mathKid(ch.dataset.latex || ch.textContent));
      }
      else if (tag === "br") out.push(new docx.TextRun({ text: "", size, break: 1 }));
      else if (tag === "img" || tag === "hr" || tag === "button" || tag === "input") return;
      else if (tag === "span" && ch.classList.contains("marks")) {
        // preview floats marks to the right margin → right tab stop + small grey text
        const t = ch.textContent.replace(/[\[\]]/g, "").trim();
        if (t) {
          out.push(new docx.TextRun({ children: [new docx.Tab()], size: bsz(20), font: docFonts().bodyWord }));
          out.push(new docx.TextRun({ text: "[" + t + "]", size: bsz(20), font: docFonts().bodyWord, color: "4b5563" }));
        }
      }
      else {
        const s2 = { ...st };
        if (tag === "b" || tag === "strong") s2.b = true;
        if (tag === "i" || tag === "em") s2.i = true;
        if (tag === "u") s2.u = true;
        if (tag === "s" || tag === "strike" || tag === "del") s2.s = true;
        if (tag === "code") s2.mono = true;
        runsFromNodes([...ch.childNodes], s2).forEach(r => out.push(r));
      }
    }
  });
  return out;
}
function runsFromNode(node, st = {}) { return runsFromNodes([...node.childNodes], st); }
function wordAlign(el) {
  if (!el || el.nodeType !== 1) return undefined;
  const a = getComputedStyle(el).textAlign;
  if (a === "center") return docx.AlignmentType.CENTER;
  if (a === "right" || a === "end") return docx.AlignmentType.RIGHT;
  if (a === "justify") return docx.AlignmentType.JUSTIFIED;
  return undefined;
}
function blocksFromEl(el, wrap = {}) {
  const tag = el.tagName.toLowerCase();
  const LINE = { line: 420, lineRule: docx.LineRuleType.AUTO }; // preview: 15px Georgia, line-height 1.75
  const TABPOS = tabPosTwips(); // usable A4 width after margins
  const tabStops = (el.querySelector && el.querySelector(".marks"))
    ? [{ type: docx.TabStopType.RIGHT, position: TABPOS }] : undefined;

  if (tag === "hr") return [new docx.Paragraph({ border: { bottom: { style: docx.BorderStyle.SINGLE, size: 12, color: "6b7280" } }, spacing: { before: 180, after: 180 } })];
  if (/^h[1-3]$/.test(tag)) {
    const cfg = tag === "h1" ? { size: Math.round(52 * hScale()), center: true, color: "1f2937", lvl: docx.HeadingLevel.HEADING_1 }
      : tag === "h2" ? { size: Math.round(32 * hScale()), center: true, color: "4b5563", lvl: docx.HeadingLevel.HEADING_2 }
        : { size: Math.round(27 * hScale()), color: "4b5563", lvl: docx.HeadingLevel.HEADING_3 };
    return [new docx.Paragraph({
      children: runsFromNode(el, { size: cfg.size, b: true, font: docFonts().headWord, color: cfg.color }),
      heading: cfg.lvl, // real Word heading style → round-trips through Import too
      spacing: { before: 180, after: 180, ...LINE },
      alignment: cfg.center ? docx.AlignmentType.CENTER : wordAlign(el),
      keepNext: true,
      ...wrap
    })];
  }
  if (tag === "pre") {
    const kids = [];
    el.innerText.split("\n").forEach((ln, k) => {
      if (k) kids.push(new docx.TextRun({ text: "", size: 19, break: 1 }));
      kids.push(new docx.TextRun({ text: ln || " ", size: 19, font: "Consolas", color: "f8fafc" }));
    });
    return [new docx.Paragraph({ children: kids, shading: { fill: "111827" }, spacing: { before: 180, after: 180, line: 360, lineRule: docx.LineRuleType.AUTO }, ...wrap })];
  }
  if (tag === "table") {
    const bd = { style: docx.BorderStyle.SINGLE, size: 6, color: "9ca3af" };
    const rows = [...el.querySelectorAll("tr")].map((tr, ri) => new docx.TableRow({
      children: [...tr.querySelectorAll("th,td")].map(td => {
        const isHead = td.tagName === "TH" || (ri === 0 && tr.querySelectorAll("th").length > 0);
        return new docx.TableCell({
          children: [new docx.Paragraph({ children: runsFromNode(td, { size: bsz(20), font: docFonts().headWord }), alignment: wordAlign(td), spacing: { line: 300, lineRule: docx.LineRuleType.AUTO } })],
          ...(isHead ? { shading: { fill: "f4f4f1" } } : {})
        });
      })
    }));
    return rows.length ? [new docx.Table({
      rows, width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: { top: bd, bottom: bd, left: bd, right: bd, insideHorizontal: bd, insideVertical: bd }
    })] : [];
  }
  if (tag === "blockquote") {
    // preview: ink left bar on a neutral paper tint
    const bq = { shading: { fill: "f4f4f1" }, border: { left: { style: docx.BorderStyle.SINGLE, size: bsz(18), color: "111827", space: 8 } } };
    const inner = [...el.children].filter(c => /^(p|h\d|pre|ul|ol|div)$/i.test(c.tagName));
    const kids = [];
    (inner.length ? inner : [el]).forEach(b => blocksFromEl(b, { ...bq, ...wrap }).forEach(x => kids.push(x)));
    return kids;
  }
  if (tag === "ul" || tag === "ol") {
    const kids = [];
    [...el.children].forEach(li => { if (li.tagName === "LI") blocksFromEl(li, wrap).forEach(x => kids.push(x)); });
    return kids;
  }
  if (tag === "li") return [new docx.Paragraph({
    children: [new docx.TextRun({ text: "•  ", size: BS(), font: docFonts().bodyWord }), ...runsFromNode(el, { size: BS() })],
    alignment: wordAlign(el),
    spacing: { after: 150, ...LINE }, ...wrap
  })];

  /* ---- body paragraph (one Word paragraph per preview block) ---- */
  const q = el.classList && el.classList.contains("q");
  const para = (kids, spacing, over = {}) => new docx.Paragraph({
    children: kids.length ? kids : [new docx.TextRun({ text: "", size: BS(), font: docFonts().bodyWord })],
    spacing: { ...LINE, ...spacing },
    alignment: wordAlign(el),
    tabStops,
    keepLines: q || undefined,
    ...wrap,
    ...over
  });
  const nodes = [...el.childNodes];
  const isDisp = n => n.nodeType === 1 && n.classList && n.classList.contains("math-src") && n.dataset.display;

  if (!nodes.some(isDisp)) return [para(runsFromNodes(nodes, { size: BS() }), { after: q ? 180 : 225 })];

  // a $$…$$ block becomes its own centered line, exactly like the preview renders it
  const kids = [];
  let seg = [];
  const blank = s => !s.map(n => n.textContent || "").join("").trim();
  const flush = (spacing, over = {}) => {
    const src = seg; seg = [];
    if (blank(src)) return;
    let out = src;
    if (spacing.trimEdges) { // glued to an equation: drop the edge spaces the preview absorbs
      out = src.map(n => n.cloneNode(true));
      const texts = [];
      const walk = n => { if (n.nodeType === 3) texts.push(n); else [...n.childNodes].forEach(walk); };
      out.forEach(walk);
      if (texts.length) {
        texts[0].textContent = texts[0].textContent.replace(/^\s+/, "");
        texts[texts.length - 1].textContent = texts[texts.length - 1].textContent.replace(/\s+$/, "");
      }
    }
    const sp = { ...spacing }; delete sp.trimEdges;
    kids.push(para(runsFromNodes(out, { size: BS() }), sp, over));
  };
  nodes.forEach(ch => {
    if (isDisp(ch)) {
      flush({ after: 0, trimEdges: true }, { keepNext: true });
      kids.push(new docx.Paragraph({
        children: [mathKid(ch.dataset.latex || ch.textContent)],
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 90, after: 90, ...LINE },
        ...wrap
      }));
    } else seg.push(ch);
  });
  flush({ after: q ? 180 : 225, trimEdges: true });
  if (!kids.length) kids.push(para([], { after: q ? 180 : 225 }));
  return kids;
}

/* ---------- Export ---------- */
async function exportDocx() {
  const body = $("#paperBody");
  if (!body || !body.textContent.trim()) { toast("Nothing to export yet"); return; }
  if (typeof docx === "undefined") { exportDoc(); return; }
  toast("Building .docx from your edited paper…");
  try {
    const orient = pageOrient, cols = pageCols, dims = pageDims(); // snapshot: async export must not see mid-flight changes
    const kids = [];
    if ($("#cHeader").checked && $("#paperHead").style.display !== "none") {
      const H = id => (((document.getElementById(id) || {}).textContent) || "").trim();
      const C = docx.AlignmentType.CENTER;
      const L = { line: 300, lineRule: docx.LineRuleType.AUTO };
      if (schoolLogo) {
        try {
          const buf = await (await fetch(schoolLogo)).arrayBuffer();
          const w = Math.max(20, Math.round(70 * (logoAspect || 1)));
          kids.push(new docx.Paragraph({ alignment: C, spacing: { after: 60, ...L },
            children: [new docx.ImageRun({ data: buf, transformation: { width: w, height: 70 } })] }));
        } catch {}
      }
      kids.push(new docx.Paragraph({ children: [new docx.TextRun({ text: H("pSchool") || $("#sSchool").value, bold: true, size: Math.round(52 * hScale()), font: docFonts().headWord })], alignment: C, spacing: { after: 80, ...L } }));      // preview h1
      kids.push(new docx.Paragraph({ children: [new docx.TextRun({ text: H("pTitle") || $("#sTitle").value, bold: true, size: Math.round(32 * hScale()), color: "4b5563", font: docFonts().headWord })], alignment: C, spacing: { after: 60, ...L } })); // preview h2
      const meta = (H("pMeta") || `${$("#sSub").value}  •  ${$("#sMeta").value}`).replace(/\s+/g, " ");
      if ($("#cMeta").checked) kids.push(new docx.Paragraph({ children: [new docx.TextRun({ text: meta, size: bsz(20), color: "6b7280", font: docFonts().bodyWord })], alignment: C, spacing: { after: 0, ...L } })); // preview .pmeta: 13px
      kids.push(new docx.Paragraph({ children: [new docx.TextRun({ text: "", size: 2 })], border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: "b9b3a5" } }, spacing: { before: 180, after: 180 } })); // preview .prule
      const instr = (H("pInstr") || $("#sInstr").value || "").replace(/\s+$/, "");
      if ($("#cInstrBox").checked && instr) { // preview .pinstr: 13px warm box
        const lines = instr.split("\n");
        const runs = [];
        lines.forEach((ln, k) => {
          if (k) runs.push(new docx.TextRun({ text: "", size: bsz(20), break: 1 }));
          runs.push(new docx.TextRun({ text: ln, size: bsz(20), color: "4b5563", font: docFonts().bodyWord }));
        });
        const box = { style: docx.BorderStyle.SINGLE, size: 4, color: "f6f4ef", space: 100 };
        kids.push(new docx.Paragraph({ children: runs, shading: { fill: "f6f4ef" },
          border: { top: box, bottom: box, left: box, right: box }, spacing: { after: 180, ...L } }));
      }
    }
    const headerCount = kids.length; // everything above is the single-column header block
    [...body.children].forEach(ch => {
      if (ch.nodeType !== 1 || (ch.classList && ch.classList.contains("empty"))) return;
      blocksFromEl(ch).forEach(b => kids.push(b));
    });
    // answer key → starts on its own page
    const keyEl = $("#paperKey");
    if (keyEl && !keyEl.hidden && keyEl.textContent.trim()) {
      kids.push(new docx.Paragraph({
        pageBreakBefore: true,
        spacing: { before: 0, after: 0, line: 20, lineRule: docx.LineRuleType.AUTO },
        children: [new docx.TextRun({ text: "", size: 2 })]
      }));
      [...keyEl.children].forEach(ch => {
        if (ch.nodeType !== 1) return;
        blocksFromEl(ch).forEach(b => kids.push(b));
      });
    }
    // preview footer: thin rule, custom left text, optional page number right
    const footL = ($("#fFoot").value || "").trim(), showPg = $("#cPageNum").checked;
    const HF = { font: docFonts().headWord, size: bsz(18), color: "9ca3af" };
    const footKids = [];
    if (footL) footKids.push(new docx.TextRun({ text: footL, ...HF }));
    if (showPg && footL) footKids.push(new docx.TextRun({ children: [new docx.Tab()], ...HF }));
    if (showPg) {
      if (!footL) footKids.push(new docx.TextRun({ children: [new docx.Tab()], ...HF }));
      footKids.push(new docx.TextRun({ text: "Page ", ...HF }));
      footKids.push(new docx.TextRun({ children: [docx.PageNumber.CURRENT], ...HF }));
    }
    // No footer at all when both the left text and page number are off:
    // an empty footer still reserves space and draws its rule in Word.
    const hasFoot = !!(footL || showPg);
    let foot = null;
    if (hasFoot) {
      foot = new docx.Footer({ children: [new docx.Paragraph({
        tabStops: [{ type: docx.TabStopType.RIGHT, position: tabPosTwips() }],
        border: { top: { style: docx.BorderStyle.SINGLE, size: 4, color: "e5e0d4" } },
        spacing: { before: 80, line: 240, lineRule: docx.LineRuleType.AUTO },
        children: footKids
      })] });
    }
    const M = marginTwips(); // preview padding and Word margins are the same inches
    const HFDist = Math.round(0.5 * 1440); // Word's default header/footer distance (0.5")
    const pageProps = { margin: { top: M, bottom: M, left: M, right: M, header: HFDist, footer: HFDist }, size: { width: dims.tw, height: dims.th } };
    const footProps = foot ? { footers: { default: foot } } : {};
    const lastKids = kids.splice(headerCount); // body paragraphs (header kids stay single-column)
    const sections = [];
    if (cols === 2 && kids.length) {
      // Word parity: header on top in one column, questions flow in two (continuous section break)
      sections.push({ children: kids, properties: { page: pageProps, column: { count: 1 } }, ...footProps });
      sections.push({ children: lastKids, properties: { page: pageProps, column: { count: 2, space: 720 }, type: docx.SectionType.CONTINUOUS }, ...footProps });
    } else if (cols === 2) {
      // Header off: a single two-column section (an empty leading section makes a blank page)
      sections.push({ children: lastKids, properties: { page: pageProps, column: { count: 2, space: 720 } }, ...footProps });
    } else {
      sections.push({ children: kids.concat(lastKids), properties: { page: pageProps, column: { count: 1 } }, ...footProps });
    }
    const doc = new docx.Document({ sections });
    let blob = await docx.Packer.toBlob(doc);
    if (orient === "landscape") blob = await patchLandscape(blob);
    await downloadBlob(blob, "docxzal-paper.docx");
    toast("Downloaded docxzal-paper.docx");
  } catch (e) { console.error(e); toast("Export failed — trying .doc"); exportDoc(); }
}
async function patchLandscape(blob) { // docx emits correct w/h but keeps orient="portrait"
  try {
    const zip = await JSZip.loadAsync(blob);
    const f = zip.file("word/document.xml");
    if (!f) return blob;
    let xml = await f.async("string");
    xml = xml.replace(/<w:pgSz([^>]*?)w:orient="portrait"/g, '<w:pgSz$1w:orient="landscape"');
    zip.file("word/document.xml", xml);
    return await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  } catch { return blob; }
}
async function exportDoc() {
  const f = docFonts();
  const cols = pageCols === 2 ? "column-count:2;column-gap:48px" : "";
  let head = "";
  if ($("#cHeader").checked) {
    const meta = $("#cMeta").checked ? ` • ${$("#sMeta").value}` : "";
    const instr = ($("#cInstrBox").checked ? ($("#sInstr").value || "").trim() : "");
    head = `<h1>${$("#sSchool").value}</h1><p style="text-align:center">${$("#sTitle").value} — ${$("#sSub").value}${meta}</p>` +
      (instr ? `<p>${instr}</p>` : "") + `<hr/>`;
  }
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>
    @page{size:A4 ${pageOrient};margin:${marginInch()}in}
    body{font-family:${f.bodyCss};font-size:${(12 * bScale()).toFixed(1)}pt}h1,h2{font-family:${f.headCss};text-align:center}h1{font-size:${(20 * hScale()).toFixed(1)}pt}h2{font-size:${(14 * hScale()).toFixed(1)}pt}table{border-collapse:collapse;width:100%}th,td{border:1.5pt solid #000;padding:6px}th{background:#f4f4f1}pre{background:#111827;color:#f8fafc;padding:10px}.q-body{${cols};text-align:${alignKey}}</style></head><body>
    ${head}
    <div class="q-body">${$("#paperBody").innerHTML}</div>
    ${keyOn() ? '<div style="page-break-before:always"></div>' + $("#paperKey").innerHTML : ""}</body></html>`;
  await downloadBlob(new Blob(["\ufeff", html], { type: "application/msword" }), "docxzal-paper.doc");
  toast("Downloaded docxzal-paper.doc");
}
/* ---------- Focus mode: hide sidebar, full paper ---------- */
(function initFocus() {
  let on = "";
  try { on = localStorage.getItem("bd_focus") || ""; } catch {}
  if (on) { document.body.classList.add("focus-paper"); $("#btnFocus").setAttribute("aria-pressed", "true"); }
})();
$("#btnFocus").onclick = () => {
  const on = document.body.classList.toggle("focus-paper");
  $("#btnFocus").setAttribute("aria-pressed", String(on));
  try { localStorage.setItem("bd_focus", on ? "1" : ""); } catch {}
};

/* ---------- Fullscreen preview ---------- */
$("#btnFull").onclick = async () => {
  const wrap = $("#previewWrap");
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (wrap.requestFullscreen) await wrap.requestFullscreen();
    else wrap.classList.toggle("fs-max");
  } catch { wrap.classList.toggle("fs-max"); }
};
document.addEventListener("fullscreenchange", () => {
  const on = !!document.fullscreenElement;
  $("#btnFull").setAttribute("aria-pressed", String(on));
  if (!on) $("#previewWrap").classList.remove("fs-max");
});

/* ---------- Markdown / HTML download ---------- */
async function exportMd() {
  const src = $("#rawInput").value.trim() || $("#paperBody").innerText.trim();
  if (!src) { toast("Nothing to export yet"); return; }
  await downloadBlob(new Blob([src], { type: "text/markdown" }), "docxzal-paper.md");
  toast("Downloaded docxzal-paper.md");
}
async function exportHtml() {
  const body = $("#paperBody");
  if (!body || !body.textContent.trim()) { toast("Nothing to export yet"); return; }
  const H = id => (((document.getElementById(id) || {}).textContent) || "").trim();
  const f = docFonts();
  let head = "";
  if ($("#cHeader").checked) {
    head = `<h1>${H("pSchool")}</h1><h2 style="text-align:center">${H("pTitle")}</h2>` +
      ($("#cMeta").checked ? `<p style="text-align:center">${H("pMeta")}</p>` : "") + `<hr>` +
      ($("#cInstrBox").checked && H("pInstr") ? `<p style="white-space:pre-wrap">${H("pInstr")}</p>` : "");
  }
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>docxzal-paper</title>` +
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">` +
    `<style>@page{size:A4 ${pageOrient};margin:${marginInch()}in}` +
    `body{font-family:${f.bodyCss};font-size:${(16 * bScale()).toFixed(1)}px;max-width:800px;margin:40px auto;padding:0 20px;color:#111;line-height:1.7;text-align:${alignKey};${pageCols === 2 ? "column-count:2;column-gap:48px;" : ""}}` +
    `h1,h2{font-family:${f.headCss};text-align:center}` +
    `h1{font-size:${(26 * hScale()).toFixed(1)}px}h2{font-size:${(16 * hScale()).toFixed(1)}px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #666;padding:6px}` +
    `pre{background:#22201c;color:#f0e9db;padding:12px;border-radius:8px;overflow:auto}` +
    `blockquote{border-left:3px solid #b26a2b;background:#faf6ee;padding:6px 12px;margin:10px 0}` +
    `@media print{body{max-width:none;margin:0;padding:0}}</style></head><body>` +
    `${head}${body.innerHTML}` +
    (keyOn() ? `<hr style="page-break-before:always;border:0">${$("#paperKey").innerHTML}` : "") +
    `</body></html>`;
  await downloadBlob(new Blob([html], { type: "text/html" }), "docxzal-paper.html");
  toast("Downloaded docxzal-paper.html");
}

/* ---------- PowerPoint export (slides; math as readable Unicode) ---------- */
async function exportPptx() {
  if (typeof PptxGenJS === "undefined") { toast("PPTX engine still loading — try again"); return; }
  const body = $("#paperBody");
  if (!body || !body.textContent.trim()) { toast("Nothing to export yet"); return; }
  toast("Building .pptx…");
  try {
    const H = id => (((document.getElementById(id) || {}).textContent) || "").trim();
    const tx = (el) => ((el.innerText || el.textContent) || "").replace(/\s+/g, " ").trim();
    const f = docFonts(), BF = f.bodyWord, HF = f.headWord;
    const PAlign = alignKey;
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pptx.layout = "WIDE";
    const cover = pptx.addSlide();
    const showHead = $("#cHeader").checked;
    cover.background = { color: "1F2937" };
    cover.addText(showHead ? (H("pSchool") || "Question Paper") : "Question Paper", { x: 0.5, y: 1.4, w: 12.33, h: 1, fontSize: 32, bold: true, color: "FFFFFF", align: "center", fontFace: HF });
    cover.addText(showHead ? H("pTitle") : "", { x: 0.5, y: 2.5, w: 12.33, h: 0.7, fontSize: 22, color: "D9D9D9", align: "center", fontFace: HF });
    cover.addText(showHead && $("#cMeta").checked ? H("pMeta") : "", { x: 0.5, y: 3.2, w: 12.33, h: 0.6, fontSize: 14, color: "BFBFBF", align: "center", fontFace: BF });
    let slide = pptx.addSlide(), y = 0.4;
    const need = (h) => { if (y + h > 7.0) { slide = pptx.addSlide(); y = 0.4; } };
    [...body.children].forEach(ch => {
      if (ch.nodeType !== 1 || (ch.classList && ch.classList.contains("empty"))) return;
      const tag = ch.tagName.toLowerCase(), t = tx(ch);
      if (/^h[12]$/.test(tag)) {
        slide = pptx.addSlide(); y = 0.4;
        slide.addText(t, { x: 0.5, y, w: 12.33, h: 0.9, fontSize: tag === "h1" ? 28 : 24, bold: true, color: "1F2937", fontFace: HF, align: PAlign });
        y += 1.1;
      }
      else if (tag === "h3") { if (!t) return; need(0.7); slide.addText(t, { x: 0.6, y, w: 12.1, h: 0.6, fontSize: 18, bold: true, color: "111827", fontFace: HF, align: PAlign }); y += 0.75; }
      else if (tag === "hr") { need(0.4); slide.addShape(pptx.shapes.LINE, { x: 0.6, y: y + 0.15, w: 12.1, h: 0, line: { color: "808080", width: 1.5 } }); y += 0.4; }
      else if (tag === "table") {
        const rows = [...ch.querySelectorAll("tr")]
          .map(tr => [...tr.querySelectorAll("th,td")].map(td => tx(td)))
          .filter(r => r.join("").trim() !== "");
        if (!rows.length) return;
        const h = rows.length * 0.38 + 0.1;
        need(h);
        slide.addTable(rows.map((r, ri) => r.map(c => ({
          text: c, options: { fontSize: 12, color: "111111", fill: ri === 0 ? { color: "F4F4F1" } : undefined, bold: ri === 0, fontFace: HF, align: PAlign }
        }))), { x: 0.6, y, w: 12.1, border: { pt: 1, color: "666666" } });
        y += h + 0.15;
      }
      else if (tag === "pre") {
        if (!t) return;
        const h = Math.min(0.5 + t.length * 0.004, 4.5);
        need(h);
        slide.addText(t, { x: 0.6, y, w: 12.1, h, fontSize: 11, fontFace: "Consolas", fill: { color: "0F172A" }, color: "E2E8F0" });
        y += h + 0.15;
      }
      else if (tag === "blockquote") { if (!t) return; need(0.8); slide.addText(t, { x: 0.9, y, w: 11.8, h: 0.7, fontSize: 14, italic: true, color: "4B5563", fontFace: BF, align: PAlign }); y += 0.85; }
      else {
        if (!t) return;
        const prefix = tag === "li" ? "•  " : "";
        const h = Math.max(0.5, Math.ceil((prefix + t).length / 105) * 0.42);
        need(h);
        slide.addText(prefix + t, { x: 0.6, y, w: 12.1, h, fontSize: 15, color: "111111", fontFace: BF, align: PAlign });
        y += h + 0.1;
      }
    });
    const blob = await pptx.write({ outputType: "blob" });
    await downloadBlob(blob, "docxzal-paper.pptx");
    toast("Downloaded docxzal-paper.pptx");
  } catch (e) { console.error(e); toast("PPTX failed"); }
}

$("#btnDocx").onclick = exportDocx;
$("#btnDocxTop").onclick = exportDocx;

/* ---------- Expandable sections: measured 420ms, interrupt-safe ---------- */
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function setExpanded(region, btn, open) {
  if (region._anim) { region._anim.cancel(); region._anim = null; }
  if (btn) btn.setAttribute("aria-expanded", String(open));
  if (reduceMotion()) { region.hidden = !open; return; }
  const startH = region.hidden ? 0 : region.offsetHeight;
  region.hidden = false;
  region.style.overflow = "hidden";
  const endH = open ? region.scrollHeight : 0;
  const a = region.animate([
    { height: startH + "px", opacity: open ? 0 : 1 },
    { height: endH + "px", opacity: open ? 1 : 0 }
  ], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
  region._anim = a;
  a.onfinish = () => {
    if (region._anim !== a) return;
    region._anim = null;
    region.hidden = !open;
    region.style.height = "";
    region.style.overflow = "";
    region.style.opacity = "";
  };
  a.oncancel = () => { if (region._anim === a) region._anim = null; };
}
/* ---------- Photo → AI (camera / upload → chat + text extraction) ---------- */
$("#photoToggle").addEventListener("click", () => {
  const btn = $("#photoToggle"), reg = $("#photoRegion");
  setExpanded(reg, btn, reg.hidden);
});
let attachedImage = null; // dataURL jpeg
let camStream = null;
const camModal = $("#camModal"), camVideo = $("#camVideo");
async function openCam() {
  camModal.classList.add("show");
  $("#camHint").textContent = "Starting camera…";
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    camVideo.srcObject = camStream;
    $("#camHint").textContent = "Camera needs HTTPS or localhost — upload works everywhere.";
  } catch {
    $("#camHint").textContent = "Camera blocked or unavailable here (needs HTTPS/localhost + permission). Use Upload instead.";
  }
}
function closeCam() {
  camModal.querySelector(".modal").classList.add("closing");
  setTimeout(() => { camModal.classList.remove("show"); camModal.querySelector(".modal").classList.remove("closing"); }, 220);
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  camVideo.srcObject = null;
}
$("#btnCamera").onclick = openCam;
$("#camClose").onclick = closeCam;
camModal.onclick = (e) => { if (e.target === camModal) closeCam(); };
$("#btnUpload").onclick = () => $("#fileImg").click();
$("#btnUploadAlt").onclick = () => { closeCam(); setTimeout(() => $("#fileImg").click(), 250); };
$("#btnSnap").onclick = () => {
  if (!camStream) { toast("No camera — upload instead"); return; }
  const c = document.createElement("canvas");
  const w = camVideo.videoWidth || 1280, h = camVideo.videoHeight || 720;
  const k = Math.min(1, 1024 / Math.max(w, h));
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(camVideo, 0, 0, c.width, c.height);
  setPhoto(c.toDataURL("image/jpeg", 0.82));
  closeCam();
};
$("#fileImg").onchange = (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    setPhoto(c.toDataURL("image/jpeg", 0.82));
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(f);
  e.target.value = "";
};
function setPhoto(dataURL) {
  attachedImage = dataURL;
  $("#imgPrev").src = dataURL;
  $("#imgPrevWrap").hidden = false;
  if ($("#imgQ") && !$("#imgQ").value) $("#imgQ").value = "Extract all questions as clean Markdown with $LaTeX$ math, one per line as Q1. Q2. with [marks] where shown.";
  toast("Photo attached");
}
$("#imgClear").onclick = () => { attachedImage = null; $("#imgPrevWrap").hidden = true; setExpanded($("#imgAns"), null, false); };
$("#btnAskImg").onclick = async () => {
  const q = ($("#imgQ").value || "Describe this image and extract all text.").trim();
  const box = $("#imgAns");
  if (!attachedImage) { toast("Attach a photo first"); return; }
  box.innerHTML = "<p class='status'>Reading photo…</p>";
  setExpanded(box, null, true);
  try {
    const j = await askAI({ provider: "gemini",
      model: aiModel || undefined,
      messages: [
        { role: "system", content: "Extract text faithfully. Return math in $...$ / $$...$$ LaTeX." },
        { role: "user", content: q, image: attachedImage }
      ], vision: true, maxTokens: 4096 });
    const answer = j.text;
    if (!answer.trim()) throw new Error("Empty response — try again.");
    servedLine(j);
    box.innerHTML = "";
    const pre = document.createElement("div");
    pre.className = "ans-text";
    pre.textContent = answer;
    const row = document.createElement("div");
    row.className = "row";
    const use = document.createElement("button");
    use.className = "btn primary sm";
    use.textContent = "Send to editor";
    use.onclick = () => { $("#rawInput").value = answer; syncCount(); render(); tabs[0].click(); toast("Sent to editor — review, then export"); };
    row.appendChild(use);
    box.append(pre, row);
  } catch (e) { box.innerHTML = "<p class='status err'>" + e.message + (e.code ? ` [${e.code}]` : "") + "</p>"; }
};

/* ---------- Chat with AI (paper-aware) ---------- */
const chatHistory = [];
const chatLog = $("#chatLog");
$("#chatToggle").addEventListener("click", () => {
  const btn = $("#chatToggle"), reg = $("#chatRegion");
  setExpanded(reg, btn, reg.hidden);
});
function chatPaperText() {
  const raw = $("#rawInput").value.trim();
  if (raw) return raw;
  return ($("#paperBody").innerText || "").trim();
}
function chatBubble(role, text, opts = {}) {
  const b = document.createElement("div");
  b.className = "chat-msg " + role;
  b.textContent = text;
  if (opts.actions) {
    const row = document.createElement("div");
    row.className = "chat-actions";
    opts.actions.forEach(a => {
      const btn = document.createElement("button");
      btn.className = "btn " + (a.primary ? "primary " : "ghost ") + "sm";
      btn.textContent = a.label;
      btn.onclick = a.fn;
      row.appendChild(btn);
    });
    b.appendChild(row);
  }
  chatLog.appendChild(b);
  chatLog.scrollTop = chatLog.scrollHeight;
  return b;
}
function chatSystemPrompt() {
  const paper = chatPaperText();
  return "You are helping improve a school question paper inside the Docxzal app. " +
    "Answer the user's request directly and concisely. When the user asks you to rewrite, fix, add, or regenerate paper content, " +
    "reply with the COMPLETE updated paper in clean Markdown only (headings, questions as Q1. ... [N marks], math in $...$ / $$...$$ LaTeX) " +
    "and no commentary, so it can be dropped straight into the editor. Clean markdown only — no preamble, no code fences around the whole paper." +
    (paper ? "\n\nCurrent paper:\n" + paper : "\n\nThe paper is currently empty.");
}
function stripPaperFences(s) {
  const t = s.trim();
  const m = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/.exec(t);
  return m ? m[1].trim() : t;
}
function sendChat() {
  const inp = $("#chatInput"), send = $("#btnChatSend");
  const q = (inp.value || "").trim();
  if (!q) return;
  inp.value = "";
  chatBubble("user", q);
  chatHistory.push({ role: "user", content: q });
  send.disabled = true;
  const thinking = chatBubble("sys", "Thinking…");
  askAI({
    provider: "gemini", model: aiModel || undefined,
    messages: [{ role: "system", content: chatSystemPrompt() }, ...chatHistory.slice(-8)],
    maxTokens: 8192, timeout: 120000
  }).then(j => {
    thinking.remove();
    const answer = (j.text || "").trim();
    if (!answer) { chatBubble("sys", "Empty response — try again."); return; }
    servedLine(j);
    chatHistory.push({ role: "assistant", content: answer });
    chatBubble("assistant", answer, {
      actions: [
        { label: "Apply to paper", primary: true, fn: () => {
            $("#rawInput").value = stripPaperFences(answer); syncCount(); render(); tabs[0].click();
            toast("Applied to the paper — review, then export");
          } },
        { label: "Insert as question", fn: () => {
            const add = "\n\n" + stripPaperFences(answer);
            const cur = $("#rawInput").value.replace(/\s+$/, "");
            $("#rawInput").value = (cur ? cur + add : add.trim()); syncCount(); render(); tabs[0].click();
            toast("Appended to the paper");
          } },
        { label: "Copy", fn: () => { navigator.clipboard.writeText(answer).then(() => toast("Copied"), () => toast("Copy failed")); } }
      ]
    });
  }).catch(e => {
    thinking.remove();
    chatBubble("sys", "Failed: " + e.message + (e.code ? ` [${e.code}]` : ""));
  }).finally(() => { send.disabled = false; inp.focus(); });
}
$("#btnChatSend").onclick = sendChat;
$("#chatInput").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
$("#btnChatClear").onclick = () => { chatHistory.length = 0; chatLog.innerHTML = ""; toast("Chat cleared"); };

syncHeader(); syncCount();
