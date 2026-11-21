/* Sloptical content script: scans text and media on the page you ask it to, highlights
   likely AI-made content and explains why on hover. Nothing leaves your device except
   media files the extension downloads itself, if you allow it, to read their metadata. */
(() => {
  if (window.__sloptical) return;
  const D = globalThis.SlopticalDetector, MD = globalThis.SlopticalMedia;
  const SKIP = "script,style,noscript,textarea,input,select,code,pre,svg,math,[contenteditable=''],[contenteditable='true'],.sloptical-ui";
  const BLOCK = "p,li,blockquote,dd,td,th,figcaption,h1,h2,h3,h4,h5,h6,div,article,section,span";
  const state = { flagged: [], marks: [], media: [], observer: null, settings: { threshold: 50, phrases: true, watch: true, media: true }, lastStats: null, scanning: false };
  const band = s => (s >= 80 ? "p" : s >= 65 ? "o" : "y");
  const COLORS = { y: "rgba(230,190,0,.95)", o: "rgba(255,130,20,.95)", p: "rgba(235,70,150,.95)" };
  const label = s => (s >= 80 ? "Very likely AI" : s >= 65 ? "Likely AI" : "Possibly AI");
  const say = m => { try { chrome.runtime.sendMessage(m); } catch {} };
  const ask = m => new Promise(res => { try { chrome.runtime.sendMessage(m, x => { void chrome.runtime.lastError; res(x); }); } catch { res(null); } });

  function visible(el) { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity !== 0; }
  const wordCount = el => (el.innerText || "").split(/\s+/).filter(Boolean).length;
  function collectBlocks() {
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.nodeValue.trim().length > 20 && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const set = new Set(); let n;
    while ((n = tw.nextNode())) { let el = n.parentElement.closest(BLOCK); while (el && el.tagName === "SPAN" && el.parentElement) { const up = el.parentElement.closest(BLOCK); if (!up) break; el = up; if (el.tagName !== "SPAN") break; } if (el) set.add(el); }
    const blocks = [...set].filter(visible);
    // Count words once per block: the nesting filter below would otherwise
    // re-read innerText (a forced layout) for every containing pair.
    const counts = new Map(blocks.map(el => [el, wordCount(el)]));
    return blocks.filter(el => !blocks.some(o => o !== el && el.contains(o) && counts.get(o) >= 25));
  }
  function clear() {
    state.marks.forEach(m => m.parentNode && m.replaceWith(document.createTextNode(m.textContent))); state.marks = [];
    document.querySelectorAll("[data-sloptical]").forEach(el => { el.classList.remove("sloptical-y", "sloptical-o", "sloptical-p", "sloptical-flash"); delete el.dataset.sloptical; delete el.dataset.slopticalWhy; delete el.dataset.slopticalKind; });
    state.media.forEach(m => { m.el.style.outline = m.prevOutline; m.el.style.outlineOffset = m.prevOffset; m.badge?.remove(); }); state.media = [];
    state.flagged = []; state.lastStats = null; hideTip(); document.body?.normalize?.();
  }
  function markPhrases(el, hits) {
    if (!hits.length) return;
    const re = new RegExp(`\\b(${hits.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement.closest(SKIP + ",mark.sloptical-phrase") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = []; let n; while ((n = tw.nextNode())) nodes.push(n);
    for (const node of nodes) {
      const t = node.nodeValue; re.lastIndex = 0; if (!re.test(t)) continue; re.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = re.exec(t))) { frag.append(t.slice(last, m.index)); const mk = document.createElement("mark"); mk.className = "sloptical-phrase"; mk.textContent = m[0]; frag.append(mk); state.marks.push(mk); last = m.index + m[0].length; }
      frag.append(t.slice(last)); node.replaceWith(frag);
    }
  }

  /* ---------- media ---------- */
  function nearbyLabel(el) {
    const bits = [el.alt, el.title, el.getAttribute("aria-label"), el.getAttribute("data-alt")];
    const fig = el.closest("figure"); if (fig) bits.push(fig.querySelector("figcaption")?.innerText);
    let p = el.parentElement; for (let i = 0; i < 3 && p; i++, p = p.parentElement) { const t = (p.innerText || "").slice(0, 400); if (t.trim()) { bits.push(t); break; } }
    return bits.filter(Boolean).join(" ").slice(0, 900);
  }
  function mediaItems() {
    const out = [];
    document.querySelectorAll("img, video").forEach(el => {
      if (el.closest(".sloptical-ui") || !visible(el)) return; const r = el.getBoundingClientRect(); if (r.width < 110 || r.height < 110) return;
      const url = el.currentSrc || el.src || el.poster || el.querySelector?.("source")?.src || ""; if (!url || url.startsWith("data:image/svg")) return;
      const kind = el.tagName === "VIDEO" ? "video" : /\.gif(\?|#|$)/i.test(url) ? "gif" : "image";
      out.push({ el, kind, url, w: el.naturalWidth || el.videoWidth || 0, h: el.naturalHeight || el.videoHeight || 0 });
    });
    return out.slice(0, 60);
  }
  /* Read the start of a media file: first directly (works when the site allows it), then through
     the extension if you've allowed "Read image details". Originals behind image services are tried too. */
  async function readDirect(url, video) {
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit", headers: { Range: `bytes=0-${video ? 1048575 : 2097151}` } });
      if (!res.ok && res.status !== 206) return null;
      const r = res.body.getReader(), parts = []; let size = 0, max = video ? 1048576 : 2097152;
      while (size < max) { const { done, value } = await r.read(); if (done) break; parts.push(value); size += value.length; }
      r.cancel().catch(() => {}); const buf = new Uint8Array(Math.min(size, max)); let o = 0; for (const p of parts) { const n = Math.min(p.length, buf.length - o); buf.set(p.subarray(0, n), o); o += n; if (o >= buf.length) break; }
      return MD.inspectBytes(new TextDecoder("latin1").decode(buf));
    } catch { return null; }
  }
  async function readBytes(url, video) {
    const tries = [...MD.unwrap(url), url]; let merged = null, needPermission = false, original = false, readable = false;
    for (const u of tries) {
      if (!/^(https?|blob|data|chrome-extension):/.test(u)) continue;
      let b = await readDirect(u, video);
      if (!b) { const r = await ask({ type: "inspect", url: u, video }); if (r?.needPermission) needPermission = true; b = r?.bytes || null; }
      if (b) { readable = true; if (u !== url) original = true; if (!merged) merged = b; else { merged.hits.push(...b.hits); merged.c2pa ||= b.c2pa; merged.camera ||= b.camera; } if (b.hits.length) break; }
    }
    return { bytes: merged, needPermission: needPermission && !readable, original, readable };
  }
  function flagMedia(it, j) {
    const b = band(j.score), el = it.el;
    el.dataset.sloptical = j.score; el.dataset.slopticalWhy = JSON.stringify(j.reasons); el.dataset.slopticalKind = it.kind;
    const m = { el, score: j.score, kind: it.kind, reasons: j.reasons, url: it.url, prevOutline: el.style.outline, prevOffset: el.style.outlineOffset };
    el.style.outline = `4px solid ${COLORS[b]}`; el.style.outlineOffset = "-4px"; state.media.push(m); addBadge(m);
  }
  async function judgeItem(it) {
    const rb = await readBytes(it.url, it.kind === "video");
    return { rb, j: MD.judge({ url: it.url, label: nearbyLabel(it.el), w: it.w, h: it.h, kind: it.kind, bytes: rb.bytes, original: rb.original, readable: rb.readable }) };
  }
  async function scanMedia() {
    const items = mediaItems(); let checked = 0, flagged = 0, needPermission = false, stripped = 0;
    const run = async it => {
      const { rb, j } = await judgeItem(it); checked++; if (rb.needPermission) needPermission = true; if (MD.reencoded(it.url) && !j.evidence) stripped++;
      if (j.score > state.settings.threshold) { flagged++; flagMedia(it, j); }
    };
    const queue = [...items]; await Promise.all([...Array(4)].map(async () => { while (queue.length) await run(queue.shift()); }));
    return { checked, flagged, needPermission, stripped };
  }
  /* right-click "Check this image or video" */
  async function checkMedia(url) {
    const el = [...document.querySelectorAll("img, video")].find(e => [e.currentSrc, e.src, e.poster].includes(url)) || null;
    const kind = el?.tagName === "VIDEO" ? "video" : /\.gif(\?|#|$)/i.test(url) ? "gif" : "image";
    toast(`<div class="sloptical-head"><span class="sloptical-chip sloptical-chip-n"></span><strong>Checking…</strong><span>reading the ${kind}’s details</span></div>`);
    const it = { el: el || document.body, kind, url, w: el?.naturalWidth || el?.videoWidth || 0, h: el?.naturalHeight || el?.videoHeight || 0 };
    const { j } = await judgeItem(it);
    if (el && j.score > state.settings.threshold && !el.dataset.sloptical) flagMedia(it, j);
    const flagged = j.score > state.settings.threshold, list = flagged ? j.reasons : [...j.reasons.map(r => `Weak sign only: ${r}`), ...j.notes];
    toast(`<div class="sloptical-head"><span class="sloptical-chip sloptical-chip-${flagged ? band(j.score) : "n"}"></span><strong>${flagged ? j.score + "%" : j.reasons.length ? "No strong AI evidence" : "No AI evidence"}</strong><span>${flagged ? label(j.score) : "found in this " + kind}</span></div>${list.length ? `<ul>${list.map(w => `<li>${String(w).replace(/[<>&]/g, "")}</li>`).join("")}</ul>` : ""}<p class="sloptical-foot">${flagged ? "Based on the evidence found. Check the original source before sharing." : "Sloptical only reports evidence it can find. Click to close."}</p>`);
    return j;
  }
  function addBadge(m) {
    const b = document.createElement("div"); b.className = `sloptical-ui sloptical-badge sloptical-badge-${band(m.score)}`;
    b.textContent = `AI ${m.score}%`; b.setAttribute("aria-hidden", "true"); document.documentElement.appendChild(b); m.badge = b; placeBadges();
  }
  function placeBadges() { state.media.forEach(m => { if (!m.badge) return; const r = m.el.getBoundingClientRect(); m.badge.style.left = (r.left + scrollX + 8) + "px"; m.badge.style.top = (r.top + scrollY + 8) + "px"; m.badge.style.display = r.width ? "" : "none"; }); }
  let placeT; addEventListener("resize", () => { clearTimeout(placeT); placeT = setTimeout(placeBadges, 100); });

  /* ---------- scan ---------- */
  async function scan(settings) {
    if (state.scanning) return state.lastStats; state.scanning = true;
    try {
      if (settings) Object.assign(state.settings, settings);
      stopWatch(); clear();
      let scanned = 0, words = 0, weighted = 0;
      for (const el of collectBlocks()) {
        const text = el.innerText || "";
        const r = D.score(text.slice(0, 6000)); if (r.tooShort) continue;
        scanned++; words += r.words; weighted += r.score * r.words;
        if (r.score > state.settings.threshold) {
          el.dataset.sloptical = r.score; el.dataset.slopticalWhy = JSON.stringify(r.reasons); el.dataset.slopticalKind = "text"; el.classList.add("sloptical-" + band(r.score));
          state.flagged.push({ el, score: r.score, excerpt: text.replace(/\s+/g, " ").trim().slice(0, 110) }); if (state.settings.phrases) markPhrases(el, r.hits);
        }
      }
      const media = state.settings.media ? await scanMedia() : { checked: 0, flagged: 0, needPermission: false };
      const page = words ? Math.round(weighted / words) : 0, count = state.flagged.length + state.media.length;
      state.lastStats = {
        scanned, flagged: state.flagged.length, page, host: location.hostname,
        bands: ["y", "o", "p"].reduce((o, k) => ((o[k] = state.flagged.filter(f => band(f.score) === k).length), o), {}),
        passages: state.flagged.map((f, i) => ({ i, score: f.score, excerpt: f.excerpt })).sort((a, b) => b.score - a.score).slice(0, 8),
        media: { ...media, items: state.media.map((m, i) => ({ i, score: m.score, kind: m.kind, reason: m.reasons[0] || "", thumb: m.kind === "video" ? (m.el.poster || "") : m.url })).sort((a, b) => b.score - a.score).slice(0, 8) },
      };
      say({ type: "badge", count, page }); say({ type: "history", host: location.hostname, page, flagged: count, scanned });
      if (state.settings.watch) startWatch();
      return state.lastStats;
    } finally { state.scanning = false; }
  }
  function focusItem(kind, i) {
    const it = kind === "media" ? state.media[i] : state.flagged[i]; if (!it) return;
    it.el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    it.el.classList.remove("sloptical-flash"); void it.el.offsetWidth; it.el.classList.add("sloptical-flash"); setTimeout(placeBadges, 700);
  }

  /* ---------- hover explanation ---------- */
  let tip = null, tipFor = null;
  function showTip(el, x, y) {
    if (!tip) { tip = document.createElement("div"); tip.id = "sloptical-tip"; tip.className = "sloptical-ui sloptical-tip"; tip.setAttribute("role", "tooltip"); document.documentElement.appendChild(tip); }
    if (tipFor !== el) {
      el.setAttribute("aria-describedby", "sloptical-tip");
      const s = +el.dataset.sloptical, why = JSON.parse(el.dataset.slopticalWhy || "[]"), kind = el.dataset.slopticalKind || "text";
      const what = kind === "text" ? "this passage was written by AI" : `this ${kind === "gif" ? "GIF" : kind} was made with AI`;
      tip.innerHTML = `<div class="sloptical-head"><span class="sloptical-chip sloptical-chip-${band(s)}"></span><strong>${s}%</strong><span>${label(s)}</span></div><div class="sloptical-sub">Likelihood ${what}</div>${why.length ? `<ul>${why.map(w => `<li>${String(w).replace(/[<>&]/g, "")}</li>`).join("")}</ul>` : ""}<p class="sloptical-foot">${kind === "text" ? "A style estimate, not proof. Careful writers and people writing in a second language can trigger these signals too." : "Based on the evidence found. Check the original source before sharing."}</p>`;
      tipFor = el;
    }
    const pad = 14; tip.classList.add("sloptical-show"); const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + pad)) + "px"; tip.style.top = (y + pad + h > innerHeight ? Math.max(8, y - h - pad) : y + pad) + "px";
  }
  function hideTip() { tipFor?.removeAttribute("aria-describedby"); tip?.classList.remove("sloptical-show"); tipFor = null; }
  document.addEventListener("mousemove", e => { const el = e.target.closest?.("[data-sloptical]"); if (el) showTip(el, e.clientX, e.clientY); else if (tipFor) hideTip(); }, { passive: true });
  document.addEventListener("focusin", e => { const el = e.target.closest?.("[data-sloptical]"); if (el) { const r = el.getBoundingClientRect(); showTip(el, r.left, r.bottom); } });
  addEventListener("scroll", hideTip, { passive: true });

  /* ---------- keep up with new content ---------- */
  let watchT;
  function startWatch() { state.observer = new MutationObserver(muts => { if (muts.every(m => [...m.addedNodes].every(n => n.nodeType !== 1 || n.closest?.(".sloptical-ui") || n.matches?.("mark.sloptical-phrase")))) return; clearTimeout(watchT); watchT = setTimeout(() => scan(), 1800); }); state.observer.observe(document.body, { childList: true, subtree: true }); }
  function stopWatch() { state.observer?.disconnect(); state.observer = null; }

  /* ---------- check selected text ---------- */
  function toast(html) { let t = document.querySelector(".sloptical-toast"); if (!t) { t = document.createElement("div"); t.className = "sloptical-ui sloptical-toast"; t.setAttribute("role", "status"); document.documentElement.appendChild(t); t.addEventListener("click", () => t.classList.remove("sloptical-show")); } t.innerHTML = html; t.classList.add("sloptical-show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("sloptical-show"), 10000); }
  function checkText(text) {
    const r = D.analyse(text || "");
    if (r.tooShort) { toast(`<strong>Sloptical</strong> needs at least 25 words to judge. Select a longer passage.`); return r; }
    const ok = r.score <= 50;
    toast(`<div class="sloptical-head"><span class="sloptical-chip sloptical-chip-${ok ? "n" : band(r.score)}"></span><strong>${r.score}%</strong><span>${ok ? "Reads as human-written" : label(r.score)}</span></div><div class="sloptical-sub">${r.proportion}% of sentences read as AI-like</div>${r.reasons.length ? `<ul>${r.reasons.map(w => `<li>${w}</li>`).join("")}</ul>` : ""}<p class="sloptical-foot">A style estimate, not proof. Click to close.</p>`);
    return r;
  }

  window.__sloptical = { checkMedia, scan, clear: () => { stopWatch(); clear(); say({ type: "badge", count: 0 }); }, checkText, stats: () => state.lastStats, focus: focusItem };
  try {
    chrome.runtime.onMessage.addListener((msg, _s, reply) => {
      if (msg.type === "scan") { scan(msg.settings).then(reply); return true; }
      if (msg.type === "clear") { window.__sloptical.clear(); reply({ ok: true }); }
      else if (msg.type === "check") reply(checkText(msg.text || String(getSelection())));
      else if (msg.type === "checkMedia") { checkMedia(msg.url).then(reply); return true; }
      else if (msg.type === "stats") reply(state.lastStats);
      else if (msg.type === "focus") { focusItem(msg.kind, msg.i); reply({ ok: true }); }
    });
  } catch {}
})();
