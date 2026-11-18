/* Sloptical service worker: badge, right-click checks, shortcut, media metadata, history, optional auto-scan. */
importScripts("media.js");
const FILES = ["detector.js", "media.js", "content.js"];
async function inject(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
  await chrome.scripting.executeScript({ target: { tabId }, files: FILES });
}
const DEF = { threshold: 50, phrases: true, watch: true, media: true, auto: false, skip: "" };
const settings = () => chrome.storage.sync.get(DEF);
const skipped = (url, s) => { try { const h = new URL(url).hostname; return s.skip.split(/[\s,]+/).filter(Boolean).some(d => h === d || h.endsWith("." + d)); } catch { return false; } };
async function scanTab(tab) {
  const s = await settings(); if (skipped(tab.url || "", s)) return { skipped: true };
  try { await inject(tab.id); return await chrome.tabs.sendMessage(tab.id, { type: "scan", settings: s }); } catch (e) { return { error: String(e) }; }
}
chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.create({ id: "sloptical-check", title: "Check selected text with Sloptical", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "sloptical-scan", title: "Scan this page with Sloptical", contexts: ["page", "image", "video"] });
  if (reason === "install") chrome.tabs.create({ url: "welcome.html" });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  try { await inject(tab.id); } catch { return; }
  if (info.menuItemId === "sloptical-check") chrome.tabs.sendMessage(tab.id, { type: "check", text: info.selectionText });
  else scanTab(tab);
});
chrome.commands.onCommand.addListener(async cmd => { if (cmd !== "scan-page") return; const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab?.id) scanTab(tab); });

async function inspect(url, video) {
  try {
    let buf;
    if (url.startsWith("data:")) { const b64 = url.split(",")[1] || ""; buf = Uint8Array.from(atob(b64.slice(0, 2_800_000)), c => c.charCodeAt(0)); }
    else if (url.startsWith("blob:")) return { bytes: null };
    else {
      const own = url.startsWith(chrome.runtime.getURL(""));
      if (!own && !(await chrome.permissions.contains({ origins: ["<all_urls>"] }))) return { needPermission: true };
      const res = await fetch(url, { credentials: "omit", headers: { Range: `bytes=0-${video ? 1048575 : 2097151}` } });
      if (!res.ok && res.status !== 206) return { bytes: null };
      const reader = res.body.getReader(), parts = []; let size = 0, max = video ? 1048576 : 2097152;
      while (size < max) { const { done, value } = await reader.read(); if (done) break; parts.push(value); size += value.length; }
      reader.cancel().catch(() => {}); buf = new Uint8Array(size); let o = 0; for (const p of parts) { buf.set(p.subarray(0, Math.min(p.length, size - o)), o); o += p.length; if (o >= size) break; }
    }
    return { bytes: SlopticalMedia.inspectBytes(new TextDecoder("latin1").decode(buf)) };
  } catch { return { bytes: null }; }
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "inspect") { inspect(msg.url, msg.video).then(reply); return true; }
  if (msg.type === "badge" && sender.tab?.id != null) {
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: msg.count ? String(msg.count) : "" });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: msg.count ? "#D6336C" : "#2F855A" });
    chrome.action.setTitle({ tabId: sender.tab.id, title: msg.count ? `Sloptical: ${msg.count} item${msg.count > 1 ? "s" : ""} flagged, page estimate ${msg.page ?? 0}%` : "Sloptical: nothing flagged" });
  }
  if (msg.type === "history") {
    chrome.storage.local.get({ history: [] }).then(({ history }) => {
      history.push({ t: Date.now(), host: msg.host, page: msg.page, flagged: msg.flagged }); chrome.storage.local.set({ history: history.slice(-400) });
    });
  }
});
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete" || !/^https?:/.test(tab.url || "")) return;
  const s = await settings(); if (!s.auto || !(await chrome.permissions.contains({ origins: ["<all_urls>"] }))) return;
  scanTab(tab);
});
