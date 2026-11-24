/* Opened from the AI Asli extension, the game offers the online address, so students without the extension can play. */
(() => {
  if (location.protocol !== "chrome-extension:") return;
  const URL_ONLINE = "https://suhaimizainalshah.github.io/ai-asli/classroom/";
  const b = document.createElement("button"); b.type = "button"; b.textContent = "Copy a link for students"; b.title = URL_ONLINE;
  b.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:50;font:600 14px system-ui,sans-serif;padding:9px 14px;border-radius:999px;border:1px solid rgba(127,127,127,.4);background:Canvas;color:CanvasText;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.15)";
  b.onclick = async () => { try { await navigator.clipboard.writeText(URL_ONLINE); b.textContent = "Link copied: students don’t need the extension"; } catch { prompt("Copy this link for students:", URL_ONLINE); } setTimeout(() => b.textContent = "Copy a link for students", 3500); };
  document.body.append(b);
})();
