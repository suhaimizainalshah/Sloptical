/* Mana Asli? (Malay: “Which is genuine?” or “Where’s the original?”), the classroom game. Saved rounds keep the file kind "spot-the-ai-rounds", so earlier files still open. Uses AI Asli’s own detector.js and media.js, so it always matches the extension. */
"use strict";
const $ = s => document.querySelector(s), esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const D = globalThis.SlopticalDetector || globalThis.AIAsliDetector, M = globalThis.SlopticalMedia || globalThis.AIAsliMedia;
/* Writing rounds: the human passages are public-domain classics; the AI passages were written by an AI (Claude) for this game
   and lean on common chatbot habits on purpose. Add your own modern examples for harder rounds. */
const WRITING = [
  { topic: "Living simply", human: "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.", src: "Henry David Thoreau, Walden (1854)", ai: "In today’s fast-paced world, it’s more important than ever to slow down. Embracing a simpler life isn’t just about owning less—it’s about unlocking a deeper connection with nature and ourselves. Ultimately, the journey to simplicity is a powerful one.", discuss: "Which words feel like they could fit any topic at all?" },
  { topic: "Marriage and money", human: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", src: "Jane Austen, Pride and Prejudice (1813)", ai: "Marriage and wealth have long been intertwined. Moreover, in many societies, financial stability plays a crucial role in shaping relationships. It’s important to note that these dynamics are complex and multifaceted, reflecting a rich tapestry of social expectations.", discuss: "One passage makes a joke. How can you tell?" },
  { topic: "A nation’s founding", human: "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.", src: "Abraham Lincoln, Gettysburg Address (1863)", ai: "The founding of a nation is a pivotal moment in history. It represents not just the birth of a country, but the beginning of a journey toward shared values. In conclusion, understanding these origins helps us navigate the complexities of the present.", discuss: "Why might “In conclusion” feel odd in a speech?" },
  { topic: "Christmas at home", human: "“Christmas won’t be Christmas without any presents,” grumbled Jo, lying on the rug.", src: "Louisa May Alcott, Little Women (1868)", ai: "Christmas is a magical time of year that brings families together. Whether it’s exchanging gifts or sharing a meal, the holiday season offers countless opportunities to create lasting memories. I hope this helps you capture the festive spirit!", discuss: "Which passage shows a real person, and which only describes an idea?" },
  { topic: "A bored child", human: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it.", src: "Lewis Carroll, Alice’s Adventures in Wonderland (1865)", ai: "Boredom is a common experience for children, and it can actually play a vital role in their development. Furthermore, moments of idleness can foster creativity and imagination. By embracing boredom, children can discover new ways to engage with the world around them.", discuss: "Look at the sentence openers. What do you notice?" },
  { topic: "A ghost story opening", human: "Marley was dead: to begin with. There is no doubt whatever about that.", src: "Charles Dickens, A Christmas Carol (1843)", ai: "Ghost stories have captivated readers for centuries, weaving together elements of mystery, suspense, and the supernatural. Delving into these tales allows us to explore our deepest fears in a safe and engaging way.", discuss: "Which one makes you want to read the next line?" },
];
/* Clue rounds: what can the evidence actually tell us? "Can't tell" is sometimes the best answer. */
const CLUE_OPTS = ["Made by AI", "Edited with AI help", "Camera photo", "Can’t tell"];
const CLUES = [
  { clue: "File metadata:\nDigitalSourceType = trainedAlgorithmicMedia", answer: 0, why: "This is the official IPTC label for media created by AI. It’s strong evidence, though labels can be added or removed by anyone who edits the file." },
  { clue: "Photo posted on a social media site.\nNo metadata at all.", answer: 3, why: "Most social media sites strip metadata when you upload. No evidence is not the same as evidence of a real photo." },
  { clue: "PNG file. Text inside the file:\nparameters: Steps: 30, Sampler: Euler a, CFG scale: 7, Seed: 1234", answer: 0, why: "These are Stable Diffusion generation settings. Image generators often leave them in the file." },
  { clue: "Saved with Little Light Lit.\nAI-assisted steps: background removal (on-device AI)\nDigitalSourceType = algorithmicallyEnhanced", answer: 1, why: "AI helped cut out the background, but it didn’t create the picture. Honest tools label the difference." },
  { clue: "Camera: Canon EOS R6\nLens: 24–70 mm, f/4, 1/250 s\nTaken: 14 March 2026, 10:42", answer: 2, why: "Camera details point to a real photo. But they can be copied into an AI image, so check other evidence too." },
  { clue: "Image exactly 1024 × 1024 pixels.\nCaption underneath: “made with an AI art tool”", answer: 0, why: "A typical generator size and a nearby AI label together make AI likely. Either one alone would be weak evidence." },
  { clue: "Content Credentials, signed by a news agency:\n“Captured with a camera. Edits: crop, brightness.”", answer: 2, why: "Signed Content Credentials record where an image came from. A valid signature from a trusted source is strong evidence." },
];
let S = { mode: "writing", custom: [], rounds: [], i: 0, score: 0, votes: [0, 0, 0, 0], revealed: false, timer: false, t: 0 };
let tick = 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildRounds() {
  if (S.mode === "writing") return shuffle(WRITING.map(w => { const aiFirst = Math.random() < .5; return { kind: "writing", w, aiSide: aiFirst ? 0 : 1, texts: aiFirst ? [w.ai, w.human] : [w.human, w.ai] }; }));
  if (S.mode === "clues") return shuffle(CLUES.map(c => ({ kind: "clue", c })));
  return shuffle(S.custom.map(x => ({ kind: x.type === "pair" ? "writing" : "picture", ...(x.type === "pair" ? (() => { const aiFirst = Math.random() < .5; return { w: { topic: x.topic || "Your round", human: x.human, ai: x.ai, src: x.src || "Added by the teacher", discuss: x.discuss || "" }, aiSide: aiFirst ? 0 : 1, texts: aiFirst ? [x.ai, x.human] : [x.human, x.ai] }; })() : { p: x }) })));
}
function render() { ({ start: renderStart, round: renderRound, final: renderFinal, build: renderBuilder })[S.screen || "start"](); $("#scorePill").textContent = `Class score ${S.score}`; }
function renderStart() {
  $("#progress").textContent = "Ready";
  $("#main").innerHTML = `<section class="start"><h2>Can you spot the AI?</h2><p>Look closely, vote as a class, then see what AI Asli noticed. Wrong answers are part of the lesson: these tools can be fooled, and so can we.</p>
    <div class="modes" role="group" aria-label="Choose a game">
      <button class="mode" data-m="writing" aria-pressed="${S.mode === "writing"}"><b>Writing rounds</b><small>Two passages. Which did AI write? AI Asli shows its clues.</small></button>
      <button class="mode" data-m="clues" aria-pressed="${S.mode === "clues"}"><b>Clue rounds</b><small>What does the evidence really tell us? Sometimes the answer is “Can’t tell”.</small></button>
      <button class="mode" data-m="custom" aria-pressed="${S.mode === "custom"}"><b>Your own rounds</b><small>${S.custom.length ? `${S.custom.length} round${S.custom.length > 1 ? "s" : ""} added` : "Add your own pictures or writing"}</small></button>
    </div>
    <div class="row" style="justify-content:center;flex:none"><button class="btn primary big" id="go">Start</button><button class="btn" id="build">Add your own rounds</button></div>
    <p class="small">Tip for the classroom: show this on a big screen. To use a Google Nest Hub or a TV with Google TV or Chromecast, open this page in Chrome and choose ⋮ → Cast → Cast tab.</p></section>`;
  $("#main").querySelectorAll("[data-m]").forEach(b => b.onclick = () => { S.mode = b.dataset.m; render(); });
  $("#go").onclick = startGame; $("#build").onclick = () => { S.screen = "build"; render(); };
}
function startGame() { S.rounds = buildRounds(); if (!S.rounds.length) { S.screen = "build"; return render(); } S.i = 0; S.score = 0; S.screen = "round"; newRound(); }
function newRound() { S.votes = [0, 0, 0, 0]; S.revealed = false; S.t = 30; clearInterval(tick); if (S.timer) tick = setInterval(() => { S.t--; const el = $("#timer"); if (el) { el.textContent = `${S.t}s`; el.classList.toggle("low", S.t <= 5); } if (S.t <= 0) { clearInterval(tick); reveal(); } }, 1000); render(); }
const optsFor = r => r.kind === "clue" ? CLUE_OPTS : r.kind === "picture" ? ["AI-made", "Real photo", "Can’t tell"] : ["Passage A", "Passage B"];
const answerOf = r => r.kind === "clue" ? r.c.answer : r.kind === "picture" ? ({ ai: 0, real: 1, unsure: 2 }[r.p.truth]) : r.aiSide;
function renderRound() {
  const r = S.rounds[S.i], opts = optsFor(r); $("#progress").textContent = `Round ${S.i + 1} of ${S.rounds.length}`;
  let body = "";
  if (r.kind === "writing") body = `<p class="q">Which passage did AI write?</p><p class="small" style="text-align:center;margin:0">Topic: ${esc(r.w.topic)}</p><div class="cards">${r.texts.map((t, k) => `<article class="card ${"AB"[k]}${S.revealed ? (k === r.aiSide ? " win" : " lose") : ""}"><span class="tag">${"AB"[k]}</span><p class="txt">${S.revealed ? markHits(t) : esc(t)}</p></article>`).join("")}</div>`;
  if (r.kind === "clue") body = `<p class="q">What does this evidence tell us?</p><div class="cards"><article class="card"><div class="clue">${esc(r.c.clue)}</div></article></div>`;
  if (r.kind === "picture") body = `<p class="q">Real photo or made by AI?</p><div class="cards"><article class="card"><img src="${r.p.src}" alt="Picture for this round"></article></div>`;
  const votes = `<div class="votes">${opts.map((o, k) => `<div class="vote"><span>${k + 1}. ${esc(o)}</span><span class="n" aria-live="polite">${S.votes[k]}</span><button data-v="${k}" aria-label="Add a vote for ${esc(o)}">+</button></div>`).join("")}</div>`;
  const ctl = `<div class="row" style="justify-content:center;flex:none">${S.timer && !S.revealed ? `<span class="pill timer" id="timer">${S.t}s</span>` : ""}${S.revealed ? `<button class="btn primary big" id="next">${S.i < S.rounds.length - 1 ? "Next round →" : "See the results"}</button>` : `<button class="btn primary big" id="rev">Reveal</button>`}</div>`;
  $("#main").innerHTML = body + votes + (S.revealed ? revealHtml(r) : "") + ctl;
  $("#main").querySelectorAll("[data-v]").forEach(b => b.onclick = () => { S.votes[+b.dataset.v]++; b.previousElementSibling.textContent = S.votes[+b.dataset.v]; });
  $("#rev")?.addEventListener("click", reveal); $("#next")?.addEventListener("click", next);
}
function markHits(t) { let h = esc(t); const a = D.analyse(t); [...new Set(a.hits || [])].sort((x, y) => y.length - x.length).forEach(w => { const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]")})`, "gi"); h = h.replace(re, "<mark>$1</mark>"); }); return h; }
function revealHtml(r) {
  const ans = answerOf(r), total = S.votes.reduce((a, b) => a + b, 0), top = total ? S.votes.indexOf(Math.max(...S.votes)) : -1, right = top === ans;
  const verdict = total ? `<h3 class="${right ? "right" : "wrong"}">${right ? "The class got it!" : "Not this time."}</h3>` : `<h3>Answer</h3>`;
  if (r.kind === "writing") {
    const sc = r.texts.map(t => D.analyse(t));
    return `<section class="reveal">${verdict}<p><b>Passage ${"AB"[r.aiSide]}</b> was written by AI. The other is from ${esc(r.w.src)}.</p>
      ${sc.map((a, k) => `<div><b>AI Asli’s estimate for ${"AB"[k]}: ${a.score}%</b><div class="meter"><i style="width:${a.score}%"></i></div>${a.reasons?.length ? `<p class="small">${esc(a.reasons.slice(0, 2).join(" · "))}</p>` : `<p class="small">No strong AI patterns found.</p>`}</div>`).join("")}
      ${r.w.discuss ? `<p class="discuss">Talk about it: ${esc(r.w.discuss)}</p>` : ""}</section>`;
  }
  if (r.kind === "clue") return `<section class="reveal">${verdict}<p><b>Best answer: ${esc(CLUE_OPTS[ans])}.</b> ${esc(r.c.why)}</p></section>`;
  const j = r.p.check; return `<section class="reveal">${verdict}<p><b>Answer: ${esc(["AI-made", "Real photo", "Can’t tell"][ans])}.</b> ${esc(r.p.note || "")}</p>${j ? `<p class="small">AI Asli checked the file: ${j.p}% likely AI. ${esc((j.why || []).slice(0, 3).join(" · ") || "No evidence found in the file.")}</p>` : ""}</section>`;
}
function reveal() { if (S.revealed) return; clearInterval(tick); const r = S.rounds[S.i], total = S.votes.reduce((a, b) => a + b, 0); if (total && S.votes.indexOf(Math.max(...S.votes)) === answerOf(r)) S.score++; S.revealed = true; render(); }
function next() { if (S.i < S.rounds.length - 1) { S.i++; newRound(); } else { S.screen = "final"; clearInterval(tick); render(); } }
function renderFinal() {
  $("#progress").textContent = "Finished";
  $("#main").innerHTML = `<section class="final"><p class="q">Class score</p><div class="score">${S.score} / ${S.rounds.length}</div>
    <div class="reveal" style="max-width:900px;text-align:left"><h3>What did we learn?</h3><ul><li>AI writing often uses vague, grand words that could fit any topic, and tidy signposts like “Moreover” or “In conclusion”.</li><li>Evidence in files can help, but missing evidence proves nothing, and labels can be faked or removed.</li><li>Detectors, and people, make mistakes. Formal writing and people writing in a second language get wrongly flagged more often.</li></ul><p class="discuss">Talk about it: when would it be unfair to use a detector’s score to decide something about a person?</p></div>
    <div class="row" style="justify-content:center;flex:none"><button class="btn primary big" id="again">Play again</button><button class="btn" id="home">Choose another game</button></div></section>`;
  $("#again").onclick = startGame; $("#home").onclick = () => { S.screen = "start"; render(); };
}
/* ---------- teacher’s own rounds ---------- */
function renderBuilder() {
  $("#progress").textContent = "Your rounds";
  $("#main").innerHTML = `<section class="builder"><h2 style="margin:0">Add your own rounds</h2><p class="small" style="margin:0">Rounds stay on this device. Use pictures you have the right to show, and never use students’ work without their permission.</p>
    <h3 style="margin:.4em 0 0">Pictures</h3><div class="row"><input type="file" id="pics" accept="image/*" multiple aria-label="Choose pictures"><select id="truth" aria-label="What are these pictures?"><option value="ai">These are AI-made</option><option value="real">These are real photos</option><option value="unsure">We can’t be sure</option></select></div>
    <input id="note" placeholder="Optional note for the reveal, such as where the picture came from">
    <h3 style="margin:.4em 0 0">Writing</h3><div class="row"><textarea id="hum" rows="3" placeholder="Human-written passage"></textarea><textarea id="aiw" rows="3" placeholder="AI-written passage"></textarea></div>
    <div class="row"><input id="src" placeholder="Where the human passage comes from"><button class="btn" id="addPair">Add writing round</button></div>
    <div class="list" id="list">${S.custom.map((x, i) => `<div>${x.type === "pic" ? `<img src="${x.src}" alt="">` : "✎"}<span style="flex:1">${x.type === "pic" ? `${{ ai: "AI-made", real: "Real photo", unsure: "Can’t tell" }[x.truth]}${x.check ? `, AI Asli: ${x.check.p}%` : ""}` : esc(x.human.slice(0, 60)) + "…"}</span><button class="btn" data-del="${i}" aria-label="Remove round ${i + 1}">Remove</button></div>`).join("") || `<p class="small">No rounds yet.</p>`}</div>
    <div class="row" style="flex:none"><button class="btn primary" id="play" ${S.custom.length ? "" : "disabled"}>Play these rounds</button><button class="btn" id="exp" ${S.custom.length ? "" : "disabled"}>Save rounds to a file</button><label class="btn" style="flex:none">Open rounds<input type="file" id="imp" accept=".json" hidden></label><button class="btn" id="back">Back</button></div></section>`;
  $("#pics").onchange = async e => { for (const f of e.target.files) { const src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }), buf = new Uint8Array(await f.arrayBuffer()); let check = null; try { const latin = new TextDecoder("latin1").decode(buf.slice(0, 4e6)), img = new Image(); img.src = src; await img.decode(); check = M.judge({ url: f.name, bytes: M.inspectBytes(latin), w: img.naturalWidth, h: img.naturalHeight }); check = { p: check.p ?? check.score, why: check.why || check.reasons || [] }; } catch {} S.custom.push({ type: "pic", src, truth: $("#truth").value, note: $("#note").value.trim(), check }); } renderBuilder(); };
  $("#addPair").onclick = () => { const h = $("#hum").value.trim(), a = $("#aiw").value.trim(); if (!h || !a) return alert("Add both passages first."); S.custom.push({ type: "pair", human: h, ai: a, src: $("#src").value.trim() }); renderBuilder(); };
  $("#list").onclick = e => { const b = e.target.closest("[data-del]"); if (b) { S.custom.splice(+b.dataset.del, 1); renderBuilder(); } };
  $("#play").onclick = () => { S.mode = "custom"; startGame(); }; $("#back").onclick = () => { S.screen = "start"; render(); };
  $("#exp").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ kind: "spot-the-ai-rounds", v: 1, rounds: S.custom })], { type: "application/json" })); a.download = "spot-the-ai-rounds.json"; a.click(); };
  $("#imp").onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (d.kind !== "spot-the-ai-rounds") throw 0; S.custom = d.rounds.filter(x => x && (x.type === "pic" ? /^data:image\//.test(x.src) : x.human && x.ai)); renderBuilder(); } catch { alert("That isn’t a Mana Asli? rounds file."); } };
}
/* ---------- controls ---------- */
$("#fsBtn").onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
if (!document.documentElement.requestFullscreen) $("#fsBtn").hidden = true;
$("#timerBtn").onclick = () => { S.timer = !S.timer; $("#timerBtn").setAttribute("aria-pressed", String(S.timer)); $("#timerBtn").textContent = S.timer ? "Timer on" : "Timer off"; };
addEventListener("keydown", e => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || S.screen !== "round") return; const r = S.rounds[S.i], n = optsFor(r).length;
  if (/^[1-4]$/.test(e.key) && +e.key <= n && !S.revealed) { S.votes[+e.key - 1]++; render(); }
  else if (e.key === " " || e.key === "Enter") { e.preventDefault(); S.revealed ? next() : reveal(); }
  else if (e.key === "ArrowRight" && S.revealed) next(); });
S.screen = "start"; render();
