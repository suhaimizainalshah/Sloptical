document.getElementById("try").onclick = async e => {
  e.target.textContent = "Scanning…";
  const st = await window.__sloptical.scan({ threshold: 50, phrases: true, watch: false, media: true });
  e.target.textContent = `Found ${st.flagged + st.media.flagged} item${st.flagged + st.media.flagged === 1 ? "" : "s"}. Hover a highlight to see why.`;
};
