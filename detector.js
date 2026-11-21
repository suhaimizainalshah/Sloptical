/* Sloptical detector: runs entirely in the browser. No text leaves the page.
   It scores writing for patterns common in AI-generated text. It is a likelihood
   estimate based on style, not proof: people write like this too. */
(() => {
  if (globalThis.SlopticalDetector) return;

  // Phrases that chat models overuse. Weight 1 = common tell, 2 = strong tell.
  const PHRASES = [
    ["delve", 2], ["delves", 2], ["delving", 2], ["tapestry", 2], ["testament to", 2], ["in today's fast-paced", 2], ["in today’s fast-paced", 2],
    ["ever-evolving", 2], ["ever-changing landscape", 2], ["navigate the complexities", 2], ["navigating the complexities", 2], ["unlock the power", 2],
    ["unleash the power", 2], ["harness the power", 2], ["it's important to note", 2], ["it’s important to note", 2], ["it is important to note", 2],
    ["it's worth noting", 1], ["it’s worth noting", 1], ["a myriad of", 2], ["plethora of", 1], ["in the realm of", 2], ["the realm of", 1],
    ["embark on a journey", 2], ["embark on", 1], ["game-changer", 1], ["game changer", 1], ["seamlessly", 1], ["seamless", 1], ["robust", 1],
    ["leverage", 1], ["leveraging", 1], ["elevate your", 2], ["elevate", 1], ["foster", 1], ["fostering", 1], ["pivotal", 1], ["paramount", 1],
    ["multifaceted", 2], ["nuanced", 1], ["intricate", 1], ["intricacies", 1], ["underscores", 1], ["underscore the", 1], ["showcasing", 1],
    ["boasts", 1], ["vibrant", 1], ["bustling", 1], ["meticulous", 1], ["meticulously", 1], ["comprehensive guide", 2], ["ultimate guide", 1],
    ["whether you're a", 2], ["whether you’re a", 2], ["look no further", 2], ["let's dive in", 2], ["let’s dive in", 2], ["dive into", 1],
    ["deep dive", 1], ["in conclusion", 1], ["in summary", 1], ["to sum up", 1], ["at the end of the day", 1], ["stands as", 1], ["serves as a", 1],
    ["plays a crucial role", 2], ["plays a vital role", 2], ["plays a pivotal role", 2], ["crucial role", 1], ["key role", 1], ["a crucial", 1],
    ["cutting-edge", 1], ["state-of-the-art", 1], ["revolutionize", 1], ["revolutionise", 1], ["transformative", 1], ["empower", 1], ["empowering", 1],
    ["holistic", 1], ["synergy", 1], ["streamline", 1], ["unparalleled", 1], ["resonate with", 1], ["resonates with", 1], ["navigate", 1],
    ["landscape", 1], ["journey", 1], ["realm", 1], ["beacon of", 2], ["symphony of", 2], ["treasure trove", 2], ["rich tapestry", 2],
    ["not only", 1], ["moreover", 1], ["furthermore", 1], ["additionally", 1], ["notably", 1], ["ultimately", 1],
    ["in essence", 1], ["essentially", 1], ["arguably", 1], ["indelible", 2], ["profound", 1], ["commendable", 1], ["noteworthy", 1],
    ["ever-evolving landscape", 2], ["at its core", 1], ["nestled", 1], ["unlock", 1], ["unleash", 1], ["in a world where", 1],
    ["in today's digital age", 2], ["in today’s digital age", 2], ["when it comes to", 1], ["sheds light on", 1], ["a wide range of", 1],
    ["it goes without saying", 1], ["at the forefront of", 2], ["paving the way", 1], ["cutting edge", 1], ["state of the art", 1],
    ["dive in", 1], ["embarking on", 1],
  ];
  // Things that usually mean text was pasted from a chatbot.
  const ARTIFACTS = [
    [/\bas an ai( language model)?\b/i, "Mentions being an AI language model"],
    [/\b(i hope this helps|hope this helps!?)\b/i, "Chatbot sign-off (“I hope this helps”)"],
    [/\b(certainly|absolutely|of course)! (here('|’)s|here is|below is)\b/i, "Chatbot opener (“Certainly! Here’s…”)"],
    [/\bgreat question\b/i, "Chatbot opener (“Great question”)"],
    [/\bi (can('|’)t|cannot) (browse|access) the internet\b/i, "Mentions a chatbot limitation"],
    [/\b(my|as of my) (last )?knowledge cut-?off\b/i, "Mentions a knowledge cutoff"],
    [/\[(insert|your|add) [^\]]{2,30}\]/i, "Unfilled template placeholder, like “[insert name]”"],
    [/\bregenerate (response|answer)\b/i, "Interface text from a chatbot"],
    [/\*\*[^*]{2,40}\*\*:/, "Leftover markdown bold labels (**Label**:)"],
    [/\bfeel free to (ask|reach out|let me know)\b/i, "Chatbot-style offer (“Feel free to ask”)"],
    [/(^|\n)\s*(certainly|of course|absolutely)!\s/i, "Chatbot opener (“Certainly!”)"],
    [/\blet me know if (you('|’)d like|there('|’)s anything else)\b/i, "Chatbot sign-off (“Let me know if you’d like…”)"],
    [/\b(happy|glad) to help\b/i, "Chatbot sign-off (“Happy to help”)"],
  ];
  const STARTERS = /^(moreover|furthermore|additionally|in addition|overall|ultimately|importantly|notably|in conclusion|in summary|consequently|thus|however),?\s/i;

  const words = t => t.match(/[A-Za-zÀ-ÿ'’-]+/g) || [];
  const sentences = t => t.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/).map(s => s.trim()).filter(s => s.split(" ").length >= 3);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const PH_RE = PHRASES.map(([p, w]) => [new RegExp(`\\b${esc(p)}\\b`, "gi"), w, p]);

  // Match every stock phrase with its character span, then keep the longest
  // match when spans overlap, so "in the realm of" is not also counted as
  // "the realm of" and "realm".
  function phraseHits(lower) {
    const spans = [];
    for (const [re, w, p] of PH_RE) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(lower)) !== null) {
        spans.push({ start: m.index, end: m.index + m[0].length, w, p });
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    spans.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const kept = [];
    for (const s of spans) {
      if (kept.some(t => s.start < t.end && t.start < s.end)) continue;
      kept.push(s);
    }
    return kept;
  }

  function score(text) {
    const W = words(text), n = W.length, reasons = [], hits = [];
    if (n < 25) return { score: 0, words: n, reasons: [], hits: [], tooShort: true };
    const lower = text.toLowerCase(); let z = -2.6;

    // 1. Chatbot artefacts: nearly decisive.
    let art = 0; for (const [re, why] of ARTIFACTS) if (re.test(text)) { art++; reasons.push({ w: 3, text: why }); }
    z += Math.min(art, 2) * 3.2;

    // 2. Stock phrase density (overlapping spans counted once — see phraseHits).
    // Density is phrases per 100 words, and the denominator never drops
    // below 100: a single stock phrase in a 30-word passage is not the
    // same evidence as the same rate sustained across a long text.
    let pw = 0; const found = new Map();
    for (const s of phraseHits(lower)) { pw += s.w; found.set(s.p, (found.get(s.p) || 0) + 1); hits.push(s.p); }
    const density = pw / Math.max(n, 100) * 100;
    if (density > 0) {
      z += Math.min(density, 6) * .55;
      const list = [...found.keys()].slice(0, 5).map(p => `“${p}”`).join(", ");
      if (density >= 1.2) reasons.push({ w: Math.min(density, 6) * .55, text: `Many phrases chatbots overuse: ${list}` });
    }

    // 3. Uniform sentence lengths (low "burstiness").
    const S = sentences(text);
    if (S.length >= 4) {
      const L = S.map(s => s.split(/\s+/).length), mean = L.reduce((a, b) => a + b, 0) / L.length, sd = Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / L.length), cv = sd / mean;
      if (cv < .32 && mean > 12) { const v = (.32 - cv) * 7; z += v; reasons.push({ w: v, text: "Sentences are all a similar length, a common sign of generated text" }); }
      if (cv > .65) z -= .6;
      const st = S.filter(s => STARTERS.test(s)).length / S.length;
      if (st >= .25) { const v = st * 2.4; z += v; reasons.push({ w: v, text: "Many sentences start with “Moreover”, “Furthermore” or similar" }); }
      const tri = S.filter(s => /\b\w+(?:\s\w+)?, \w+(?:\s\w+)?,? and \w+/i.test(s)).length / S.length;
      if (tri >= .4) { const v = tri * 1.6; z += v; reasons.push({ w: v, text: "Frequent lists of three (“X, Y and Z”)" }); }
    }

    // 4. Contrast templates and rhetorical set-ups.
    const tmpl = (text.match(/\b(it('|’)s|this is|that('|’)s) not (just |only |merely )?(about )?[^.,;]{2,40}[,;—–-]+\s*(it('|’)s|but)\b/gi) || []).length
      + (text.match(/\bnot (just|only|merely) [^.]{2,50}, but (also )?/gi) || []).length
      + (text.match(/(^|\. )(the result|the answer|the catch|the twist|the best part)\?\s/gi) || []).length;
    if (tmpl) { const v = Math.min(tmpl, 3) * .8; z += v; reasons.push({ w: v, text: "Template contrasts like “It’s not just X, it’s Y”" }); }

    // 5. Em dash density.
    const dashes = (text.match(/—/g) || []).length / n * 100;
    if (dashes > 1.2) { const v = Math.min(dashes, 4) * .35; z += v; reasons.push({ w: v, text: "Heavy use of em dashes (—)" }); }

    // 6. Hedged, balanced framing.
    const hedge = (lower.match(/\b(on the other hand|on one hand|it depends on|there are several|there are many|various factors|a variety of)\b/g) || []).length;
    if (hedge >= 2) { z += .6; reasons.push({ w: .6, text: "Evenly balanced, hedged framing (“On the other hand…”)" }); }

    // 7. Repetition: the same wordings and sentence openings come up again.
    // Quoted passages are stripped first, so a line quoted twice (common in
    // journalism) does not count as the writer repeating themselves. Straight
    // single quotes are NOT stripped: they are usually possessives. Only
    // mid-sentence 4-grams count, so names and titles that journalism
    // repeats ("Press Gazette", "the Supply Chainer") do not trigger it, and
    // it fires on the repetition *rate*: a long article naturally restates
    // its topic, so the signal needs several distinct repeats in a short span.
    const unquoted = text.replace(/"[^"]{2,200}"/g, " ").replace(/“[^”]{2,200}”/g, " ").replace(/‘[^’]{2,200}’/g, " ");
    const uwords = unquoted.match(/[A-Za-zÀ-ÿ'’-]+/g) || [];
    const seen4 = new Map();
    for (let i = 0; i + 4 <= uwords.length; i++) {
      const g = uwords.slice(i, i + 4);
      if (g.some(w => /^[A-ZÀ-Þ]/.test(w))) continue;
      const key = g.join(" ").toLowerCase();
      seen4.set(key, (seen4.get(key) || 0) + 1);
    }
    const repeats = [...seen4.values()].filter(c => c >= 2).length;
    if (repeats >= 3 && repeats / Math.max(n, 100) * 100 >= 1.5) { z += .5; reasons.push({ w: .5, text: "Repeated phrases — the same wordings come up again and again" }); }
    if (S.length >= 5) {
      const firsts = S.map(s => (s.replace(/^[^A-Za-z]+/, "").split(/\s+/)[0] || "").toLowerCase());
      const fc = new Map(); for (const f of firsts) fc.set(f, (fc.get(f) || 0) + 1);
      if (Math.max(...fc.values()) / S.length >= .4) { z += .5; reasons.push({ w: .5, text: "Most sentences start with the same word" }); }
    }

    // 8. Hedging density: modal hedges pile up in generated drafts.
    const hedges = (lower.match(/\b(may|might|could|possibly|perhaps|potentially)\b/g) || []).length + (lower.match(/\bin some cases\b/g) || []).length;
    if (hedges / Math.max(n, 100) * 100 >= 1.2) { z += .6; reasons.push({ w: .6, text: "Heavy hedging (“may”, “might”, “could”, “potentially”)" }); }

    // 9. Almost no contractions in a long text. Formal AI drafts rarely use
    // them — but journalism and academic writing often don't either, so this
    // is deliberately small.
    if (n >= 300) {
      const contr = (text.match(/\w+n't\b|\w+('re|'ve|'ll|'d|'m)\b|\b(it's|that's|there's|here's|what's|let's)\b/gi) || []).length;
      if (contr / n * 100 < .1) { z += .3; reasons.push({ w: .3, text: "Almost no contractions in a long text" }); }
    }

    // 10. Guide-style structural tells: headings that read like content-farm furniture.
    const struct = (text.match(/^(key takeaways|the bottom line|tl;dr|in summary|the ultimate guide to|everything you need to know about|what this means for you)\b/gim) || []).length;
    if (struct) { const v = Math.min(struct, 2) * .5; z += v; reasons.push({ w: v, text: "“Key takeaways” / guide-style headings" }); }

    // 11. Paragraph-length uniformity: the same burstiness idea as sentences.
    // The threshold is tight (CV under 0.20): edited journalism also runs to
    // fairly even paragraphs, so only near-identical lengths count.
    const paras = text.split(/\n\s*\n/).map(p => words(p).length).filter(l => l >= 5);
    if (paras.length >= 4) {
      const pm = paras.reduce((a, b) => a + b, 0) / paras.length, psd = Math.sqrt(paras.reduce((a, b) => a + (b - pm) ** 2, 0) / paras.length), pcv = psd / pm;
      if (pcv < .2 && pm > 40) { z += .5; reasons.push({ w: .5, text: "Paragraphs are all a similar length" }); }
    }

    // 12. Signs of a human: personal detail, typos, informal punctuation.
    const human = (text.match(/\b(i|my|we|our)\b/gi) || []).length / n * 100;
    if (human > 3 && !art) z -= .5;
    if (/(\?\?|!!|\.\.\.\s*[a-z]|\blol\b|\bimo\b|\btbh\b)/i.test(text)) z -= .8;
    if (/\b(teh|recieve|definately|seperate|alot)\b/i.test(text)) z -= .6;

    const p = Math.round(100 / (1 + Math.exp(-z)));
    reasons.sort((a, b) => b.w - a.w);
    return { score: Math.max(0, Math.min(99, p)), words: n, reasons: reasons.slice(0, 4).map(r => r.text), hits };
  }
  /* ---------- Writing check: sentence-level analysis and suggestions ---------- */
  const SWAPS = {
    "delve": "look at", "delves": "looks at", "delving": "looking at", "dive into": "look at", "deep dive": "close look", "let's dive in": "", "let’s dive in": "",
    "leverage": "use", "leveraging": "using", "utilize": "use", "utilise": "use", "facilitate": "help", "elevate your": "improve your", "elevate": "improve",
    "foster": "build", "fostering": "building", "pivotal": "key", "paramount": "essential", "crucial role": "big part", "plays a crucial role": "matters",
    "plays a vital role": "matters", "plays a pivotal role": "matters", "seamlessly": "smoothly", "seamless": "smooth", "robust": "strong",
    "multifaceted": "complex", "intricate": "detailed", "a myriad of": "many", "plethora of": "lots of", "in the realm of": "in", "the realm of": "",
    "embark on": "start", "embark on a journey": "start", "journey": "process", "landscape": "field", "navigate": "handle", "navigate the complexities": "deal with",
    "navigating the complexities": "dealing with", "unlock the power": "use", "harness the power": "use", "unleash the power": "use", "game-changer": "big change",
    "cutting-edge": "new", "state-of-the-art": "modern", "transformative": "major", "revolutionize": "change", "revolutionise": "change", "empower": "help",
    "empowering": "helping", "holistic": "whole", "synergy": "teamwork", "streamline": "simplify", "unparalleled": "unmatched", "showcasing": "showing",
    "underscores": "shows", "testament to": "sign of", "tapestry": "mix", "rich tapestry": "mix", "beacon of": "example of", "treasure trove": "collection",
    "vibrant": "lively", "bustling": "busy", "meticulous": "careful", "meticulously": "carefully", "moreover": "also", "furthermore": "also",
    "additionally": "also", "in conclusion": "", "in summary": "", "it's important to note": "", "it’s important to note": "", "it is important to note": "",
    "it's worth noting": "", "it’s worth noting": "", "in today's fast-paced": "in today’s", "in today’s fast-paced": "in today’s", "ever-evolving": "changing",
    "nuanced": "subtle", "notably": "", "ultimately": "in the end", "essentially": "", "in essence": "", "profound": "deep", "noteworthy": "notable",
    "at its core": "at heart", "nestled": "tucked away", "unlock": "open", "unleash": "release", "ever-evolving landscape": "changing field",
    "in a world where": "", "when it comes to": "for", "sheds light on": "explains", "a wide range of": "many", "it goes without saying": "",
    "at the forefront of": "leading", "paving the way": "leading to", "cutting edge": "new", "state of the art": "modern", "dive in": "start",
    "embarking on": "starting", "in today's digital age": "today", "in today’s digital age": "today",
  };
  function sentenceScore(s) {
    const n = words(s).length || 1, low = s.toLowerCase(); let z = -2.2; const hit = [];
    for (const s of phraseHits(low)) { z += s.w * 1.1; hit.push(s.p); }
    for (const [re] of ARTIFACTS) if (re.test(s)) z += 3.5;
    if (STARTERS.test(s)) z += 1.1;
    if (/\b(it('|’)s|this is) not (just |only )?[^.,;]{2,40}[,;—–-]+\s*(it('|’)s|but)\b/i.test(s) || /\bnot (just|only) [^.]{2,50}, but\b/i.test(s)) z += 1.3;
    if ((s.match(/—/g) || []).length) z += .5;
    if (/\b\w+, \w+,? and \w+\b/i.test(s) && n > 12) z += .4;
    return { s: Math.round(100 / (1 + Math.exp(-z))), hits: hit };
  }
  function analyse(text) {
    const overall = score(text), S = text.trim() ? (sentences(text).length ? sentences(text) : [text.trim()]) : [];
    const rows = S.map(t => ({ text: t, ...sentenceScore(t) }));
    const flagged = rows.filter(r => r.s >= 50).length, proportion = rows.length ? Math.round(flagged / rows.length * 100) : 0;
    const counts = new Map(); rows.forEach(r => r.hits.forEach(h => counts.set(h, (counts.get(h) || 0) + 1)));
    const giveaways = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([phrase, count]) => ({ phrase, count, alt: SWAPS[phrase] }));
    const tips = [];
    const L = S.map(t => words(t).length), mean = L.reduce((a, b) => a + b, 0) / (L.length || 1), sd = Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / (L.length || 1));
    if (L.length >= 4 && sd / mean < .35) tips.push("Mix short and long sentences. Real writing has rhythm; evenly sized sentences sound generated.");
    if (giveaways.length) tips.push("Swap stock phrases for plain words, or cut them. Most of them add length, not meaning.");
    if (rows.filter(r => STARTERS.test(r.text)).length >= 2) tips.push("Drop “Moreover”, “Furthermore” and “Additionally”. Let ideas follow on, or start a new paragraph.");
    if (/not (just|only)[^.]+, (but|it('|’)s)/i.test(text)) tips.push("Replace “It’s not just X, it’s Y” with a direct claim: say what it is.");
    if ((text.match(/—/g) || []).length >= 2) tips.push("Use fewer em dashes. Full stops, commas or brackets often read more naturally.");
    if (!/\b\d/.test(text) && words(text).length > 60) tips.push("Add something specific: a number, a name, a date or an example only you would know.");
    if (!/\b(i|my|we|our)\b/i.test(text) && words(text).length > 60) tips.push("Where it fits, add your own view or experience (“I found…”, “In our school…”).");
    if (/\b(in conclusion|in summary|to sum up)\b/i.test(text)) tips.push("End on your strongest point instead of “In conclusion”.");
    return { ...overall, proportion, sentences: rows, giveaways, tips: tips.slice(0, 5) };
  }
  // Only one-for-one swaps that keep grammar intact are applied automatically.
  const SAFE = { delve: "dig", delves: "digs", delving: "digging", leverage: "use", leverages: "uses", leveraging: "using", utilize: "use", utilise: "use",
    utilizes: "uses", utilises: "uses", robust: "strong", seamless: "smooth", seamlessly: "smoothly", "a myriad of": "many", "plethora of": "lot of",
    "cutting-edge": "new", "ever-evolving": "changing", multifaceted: "complex", pivotal: "key", paramount: "essential", showcasing: "showing",
    meticulous: "careful", meticulously: "carefully", bustling: "busy", vibrant: "lively", foster: "build", fosters: "builds", fostering: "building",
    empower: "help", empowers: "helps", empowering: "helping", streamline: "simplify", unparalleled: "unmatched", moreover: "also", furthermore: "also",
    additionally: "also", "game-changer": "big change", "state-of-the-art": "modern", transformative: "major", intricate: "detailed",
    "nestled": "tucked away", "unlock": "open", "unleash": "release", "at its core": "at heart" };
  // Words spelled with a vowel letter but pronounced with a consonant /j/ sound,
  // so "a use", not "an use".
  const AN_EXCEPT = new Set(["use", "uses", "using"]);
  function swapWords(text) {
    let out = text, n = 0;
    for (const k of Object.keys(SAFE).sort((a, b) => b.length - a.length)) {
      out = out.replace(new RegExp(`\\b${esc(k)}\\b`, "gi"), m => { n++; const r = SAFE[k]; if (m === m.toUpperCase() && m.length > 1) return r.toUpperCase(); return m[0] === m[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r; });
    }
    const vals = [...new Set(Object.values(SAFE))].map(v => esc(v.split(" ")[0])).join("|");
    out = out.replace(new RegExp(`\\b(a|an)\\s+(${vals})\\b`, "gi"), (m, art, w) => { const an = /^[aeiou]/i.test(w) && !AN_EXCEPT.has(w.toLowerCase()); const fixed = an ? "an" : "a"; return (art[0] === art[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed) + " " + w; });
    return { text: out, changes: n };
  }
  globalThis.SlopticalDetector = { score, analyse, swapWords, PHRASES: PHRASES.map(p => p[0]) };
})();
