/* AI Asli popup */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const D = globalThis.SlopticalDetector;
const DEF = { threshold: 50, phrases: true, watch: true, media: true, auto: false, deep: false, skip: "" };
const ALL = { origins: ["<all_urls>"] };
const band = s => (s >= 80 ? "p" : s >= 65 ? "o" : s > 50 ? "y" : "n");
const COL = { y: "var(--y)", o: "var(--o)", p: "var(--p)", n: "var(--ok)" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let tab = null;
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200); }
function ring(score) {
  const r = 36, c = 2 * Math.PI * r, v = Math.max(2, score) / 100 * c, col = COL[band(score)];
  return `<div class="ring" role="img" aria-label="${score} percent"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--line)" stroke-width="9"/><circle cx="42" cy="42" r="${r}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${v} ${c}"/></svg><b><span>${score}<small>%</small></span></b></div>`;
}

/* tabs */
$$(".tabs button").forEach(b => b.addEventListener("click", () => selectTab(b.id)));
$(".tabs").addEventListener("keydown", e => { const t = $$(".tabs button"), i = t.indexOf(document.activeElement); if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = t[(i + (e.key === "ArrowRight" ? 1 : t.length - 1)) % t.length]; n.focus(); selectTab(n.id); } });
function selectTab(id) { $$(".tabs button").forEach(b => b.setAttribute("aria-selected", b.id === id)); $$("main section").forEach(s => (s.hidden = s.id !== id.replace("t-", "s-"))); chrome.storage.local.set({ lastTab: id }); if (id === "t-text") $("#txt").focus(); }

/* page tab */
async function injectAndScan() {
  const s = await chrome.storage.sync.get(DEF);
  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["detector.js", "media.js", "content.js"] });
  return chrome.tabs.sendMessage(tab.id, { type: "scan", settings: s });
}
async function scan() {
  const btn = $("#scan"); btn.disabled = true; btn.textContent = "Scanning…";
  try { show(await injectAndScan()); } catch (e) { show({ error: String(e) }); }
  btn.disabled = false; btn.textContent = "Scan again"; week();
}
function show(st) {
  const r = $("#results"); r.hidden = false; $("#hero").hidden = true; $("#shortcut").hidden = true;
  if (!st || st.error) { r.innerHTML = `<div class="note">This page can’t be scanned. Chrome blocks extensions on its own pages and the Web Store.</div>`; return; }
  const verdict = st.page >= 65 ? "Much of this page reads like AI writing" : st.page > 50 ? "Parts of this page read like AI writing" : st.flagged ? "Mostly human-sounding, with some AI-like passages" : st.scanned ? "Reads as human-written" : "No passages long enough to judge";
  const m = st.media || { checked: 0, flagged: 0, items: [] };
  let h = `<div class="card score">${ring(st.page)}<div><div class="verdict">${verdict}</div><div class="chips">
    ${st.bands.p ? `<span class="chip"><i class="p"></i>${st.bands.p} very likely</span>` : ""}${st.bands.o ? `<span class="chip"><i class="o"></i>${st.bands.o} likely</span>` : ""}${st.bands.y ? `<span class="chip"><i class="y"></i>${st.bands.y} possibly</span>` : ""}
    ${!st.flagged ? `<span class="chip"><i class="n"></i>${st.scanned} passages checked</span>` : ""}</div>
    <p class="muted" style="margin-top:6px">${st.flagged} of ${st.scanned} passages${m.checked ? `, ${m.flagged} of ${m.checked} images and videos` : ""} flagged</p></div></div>`;
  if (st.passages?.length) h += `<h3>Most AI-like passages</h3><div class="list">${st.passages.map(p => `<button class="item" data-focus="text" data-i="${p.i}"><span class="pill" style="background:${COL[band(p.score)]}">${p.score}%</span><span class="txt">${esc(p.excerpt)}…</span></button>`).join("")}</div>`;
  if (m.items?.length) h += `<h3>Images and videos</h3><div class="list">${m.items.map(x => `<button class="item mediaRow" data-focus="media" data-i="${x.i}">${x.thumb && !/^blob:/.test(x.thumb) ? `<img class="thumb" src="${esc(x.thumb)}" alt="">` : `<span class="thumb"></span>`}<span class="txt">${esc(x.reason)}</span><span class="pill" style="background:${COL[band(x.score)]}">${x.score}%</span></button>`).join("")}</div>`;
  if (m.checked && !m.flagged) h += `<p class="muted">No AI evidence in ${m.checked} image${m.checked > 1 ? "s" : ""} or video${m.checked > 1 ? "s" : ""}${m.stripped ? `. ${m.stripped} came through an image service that removes hidden AI labels, so they could only be checked partly` : ""}. Right-click any image to check it in detail.</p>`;
  if (m.needPermission) h += `<div class="note"><span>For a deeper check of images, AI Asli can read their hidden details (like Content Credentials). <button class="ghost" id="grantDeep" style="margin-top:6px">Allow image details</button></span></div>`;
  if (st.flagged || m.flagged) h += `<p class="muted">Hover any highlight on the page to see why it was flagged.</p>`;
  h += `<div class="row"><button class="ghost" id="clearHere">Remove highlights</button><button class="ghost" id="rescan">Scan again</button></div>`;
  r.innerHTML = h; $("#scan").hidden = true;
  $("#clearHere").onclick = async () => { try { await chrome.tabs.sendMessage(tab.id, { type: "clear" }); } catch {} r.hidden = true; $("#hero").hidden = false; $("#shortcut").hidden = false; $("#scan").hidden = false; $("#scan").textContent = "Scan this page"; };
  $("#rescan").onclick = () => { $("#scan").hidden = false; scan(); };
  $("#grantDeep")?.addEventListener("click", async () => { if (await chrome.permissions.request(ALL)) { await chrome.storage.sync.set({ deep: true }); $("#deep").checked = true; scan(); } });
}
$("#results").addEventListener("click", e => { const b = e.target.closest("[data-focus]"); if (b) chrome.tabs.sendMessage(tab.id, { type: "focus", kind: b.dataset.focus, i: +b.dataset.i }); });
$("#scan").onclick = scan;
async function week() {
  const { history } = await chrome.storage.local.get({ history: [] }), since = Date.now() - 7 * 864e5, wk = history.filter(h => h.t > since);
  if (!wk.length) { $("#week").textContent = ""; return; }
  const heavy = wk.filter(h => h.page > 50).length, sites = new Set(wk.map(h => h.host)).size;
  $("#week").textContent = `This week: ${wk.length} scan${wk.length > 1 ? "s" : ""} on ${sites} site${sites > 1 ? "s" : ""}${heavy ? `, ${heavy} mostly AI-like` : ""}.`;
}

/* writing tab */
const wordsIn = t => (t.match(/\S+/g) || []).length;
let lastBefore = null;
$("#txt").addEventListener("input", () => { const n = wordsIn($("#txt").value); $("#wc").textContent = `${n} word${n === 1 ? "" : "s"}`; $("#checkTxt").disabled = n < 25; chrome.storage.local.set({ draft: $("#txt").value }); });
$("#checkTxt").onclick = () => checkWriting();
$("#txt").addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !$("#checkTxt").disabled) checkWriting(); });
function checkWriting() {
  const text = $("#txt").value, r = D.analyse(text), out = $("#tResults"); out.hidden = false;
  const b = band(r.score), verdict = r.score > 80 ? "Reads very much like AI writing" : r.score > 65 ? "Reads like AI writing" : r.score > 50 ? "Some AI-like patterns" : "Reads as human-written";
  let h = `<div class="card score">${ring(r.score)}<div><div class="verdict">${verdict}</div><p class="muted" style="margin:6px 0 4px">${r.proportion}% of sentences read as AI-like</p><div class="meter" aria-hidden="true"><i style="width:${r.proportion}%;background:${COL[b]}"></i></div></div></div>`;
  if (r.reasons.length) h += `<h3>What gives it away</h3><ul class="tips">${r.reasons.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  if (r.giveaways.length) h += `<h3>Giveaway words and phrases</h3><div class="give">${r.giveaways.map(g => `<div><q>${esc(g.phrase)}</q>${g.count > 1 ? `<span class="muted">×${g.count}</span>` : ""}<span class="muted">→</span><span class="alt">${g.alt ? esc(g.alt) : "cut it or rephrase"}</span></div>`).join("")}</div>`;
  if (r.tips.length) h += `<h3>How to make it sound like you</h3><ul class="tips">${r.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  h += `<h3>Sentence by sentence</h3><div class="preview">${r.sentences.map(s => `<span class="${s.s >= 80 ? "sp" : s.s >= 65 ? "so" : s.s >= 50 ? "sy" : ""}" title="${s.s}% AI-like">${esc(s.text)}</span>`).join(" ")}</div>
    <div class="row"><button class="ghost" id="swap">Swap stock words</button><button class="ghost" id="undoSwap" ${lastBefore == null ? "hidden" : ""}>Undo swap</button><button class="ghost" id="copyTxt">Copy text</button></div>
    <p class="muted">Word swaps help a little. Rewriting in your own voice, with specific details, helps most.</p>`;
    h += `<div class="card fair" role="note"><b>Use this fairly.</b> It’s an estimate from writing style, not proof. Tools like this flag people writing in a second language, and very formal writing, more often. Don’t use it as evidence of cheating or misconduct; talk to the writer instead.</div>`;
  out.innerHTML = h;
  $("#swap").onclick = () => { const s = D.swapWords($("#txt").value); if (!s.changes) return toast("No simple swaps found"); lastBefore = $("#txt").value; $("#txt").value = s.text; $("#txt").dispatchEvent(new Event("input")); checkWriting(); toast(`${s.changes} word${s.changes > 1 ? "s" : ""} swapped`); };
  $("#undoSwap").onclick = () => { if (lastBefore == null) return; $("#txt").value = lastBefore; lastBefore = null; $("#txt").dispatchEvent(new Event("input")); checkWriting(); };
  $("#copyTxt").onclick = async () => { try { await navigator.clipboard.writeText($("#txt").value); toast("Copied"); } catch { toast("Couldn’t copy"); } };
}

/* settings */
async function loadSettings() {
  const s = await chrome.storage.sync.get(DEF), has = await chrome.permissions.contains(ALL);
  $("#threshold").value = s.threshold; $("#thOut").textContent = s.threshold + "%"; ["phrases", "media", "watch"].forEach(k => ($("#" + k).checked = s[k]));
  $("#deep").checked = s.deep && has; $("#auto").checked = s.auto && has; $("#skip").value = s.skip;
  // If the permission was revoked outside the popup, the stored values
  // would otherwise stay true while the checkboxes show off.
  if (!has && (s.deep || s.auto)) chrome.storage.sync.set({ deep: false, auto: false });
}
$("#threshold").oninput = e => ($("#thOut").textContent = e.target.value + "%");
$("#threshold").onchange = e => chrome.storage.sync.set({ threshold: +e.target.value }).then(() => toast("Saved. Scan again to apply."));
["phrases", "media", "watch"].forEach(k => ($("#" + k).onchange = e => chrome.storage.sync.set({ [k]: e.target.checked })));
for (const k of ["deep", "auto"]) $("#" + k).onchange = async e => {
  if (e.target.checked) { const ok = await chrome.permissions.request(ALL); e.target.checked = ok; await chrome.storage.sync.set({ [k]: ok }); if (ok) toast("Allowed"); }
  else { await chrome.storage.sync.set({ [k]: false }); if (!$("#deep").checked && !$("#auto").checked) chrome.permissions.remove(ALL); }
};
$("#skip").onchange = e => chrome.storage.sync.set({ skip: e.target.value }).then(() => toast("Saved"));
$("#clear").onclick = async () => { try { await chrome.tabs.sendMessage(tab.id, { type: "clear" }); toast("Highlights removed"); } catch { toast("Nothing to remove"); } };
$("#resetStats").onclick = async () => { await chrome.storage.local.set({ history: [] }); week(); toast("Stats cleared"); };
$("#welcome").onclick = () => chrome.tabs.create({ url: "welcome.html" });

/* start */
(async () => {
  $("#ver").textContent = "v" + chrome.runtime.getManifest().version;
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { lastTab, draft } = await chrome.storage.local.get({ lastTab: "t-page", draft: "" });
  if (draft) { $("#txt").value = draft; $("#txt").dispatchEvent(new Event("input")); }
  loadSettings(); week(); selectTab(lastTab === "t-set" ? "t-page" : lastTab);
  if (!/^(https?|file):/.test(tab?.url || "")) { $("#scan").disabled = true; $("#scan").textContent = "This page can’t be scanned"; return; }
  const s = await chrome.storage.sync.get(DEF); try { if (s.skip && s.skip.split(/[\s,]+/).filter(Boolean).some(d => new URL(tab.url).hostname.endsWith(d))) { $("#scan").textContent = "Scan anyway (site is on your skip list)"; } } catch {}
  try { const st = await chrome.tabs.sendMessage(tab.id, { type: "stats" }); if (st) show(st); } catch {}
})();
