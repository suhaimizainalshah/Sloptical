/* AI Asli media checks. Looks for evidence that an image, GIF or video was made with AI:
   Content Credentials (C2PA) and IPTC "digital source type" labels, generator metadata
   (Stable Diffusion, ComfyUI, Midjourney, DALL·E, Firefly and others), links to AI image
   services, and "AI-generated" labels near the media. It cannot see invisible watermarks,
   and most AI images online have their metadata removed, so "no evidence" is not "human-made". */
(() => {
  if (globalThis.AIAsliMedia) return;
  const HOSTS = [
    [/cdn\.midjourney\.com|mj-gallery/i, "Midjourney"], [/oaidalleapiprodscus|dalle|images\.openai\.com|sora\.(com|chatgpt)/i, "OpenAI (DALL·E or Sora)"],
    [/replicate\.delivery|replicate\.com/i, "Replicate (AI model host)"], [/image\.civitai\.com|civitai/i, "Civitai (AI art site)"],
    [/cdn\.leonardo\.ai|leonardo\.ai/i, "Leonardo AI"], [/ideogram\.ai/i, "Ideogram"], [/lexica\.art/i, "Lexica (AI art search)"],
    [/firefly|adobe\.io\/firefly/i, "Adobe Firefly"], [/runwayml|runway\.ml/i, "Runway"], [/pika\.art/i, "Pika"], [/lumalabs|dream-machine/i, "Luma Dream Machine"],
    [/stability\.ai|dreamstudio/i, "Stability AI"], [/playgroundai|playground\.com/i, "Playground AI"], [/nightcafe/i, "NightCafe"], [/krea\.ai/i, "Krea"],
    [/\b(ai[-_]?generated|aigenerated|midjourney|dall[-_]?e|stable[-_]?diffusion|sdxl|flux|imagen|ideogram|ai[-_]?art|ai[-_]?image|ai[-_]?video|generated[-_]?image|synthetic[-_ ]?(media|image))\b/i, "the file name"],
  ];
  const LABEL = /\b(ai[- ]generated|generated (with|by|using) (ai|midjourney|dall[- ·]?e|stable diffusion|firefly|chatgpt|gemini|imagen|sora|flux)|made with ai|ai info|ai art|ai image|ai video|created (with|using) (ai|midjourney|dall[- ·]?e|stable diffusion|firefly|sora|runway)|#aiart|#midjourney|#aigenerated|synthetic (content|image|media)|altered or synthetic|digitally (created|generated))\b/i;
  /* Words that show up in image-generation prompts. Tested against the alt
     attribute only, never the surrounding page text: "digital painting" in a
     caption is weak, but several of these together in an alt text is not how
     people usually describe a photo. */
  const PROMPT_TOKENS = /\b(photorealistic|ultra[- ]detailed|highly detailed|intricate details?|cinematic lighting|octane render|unreal engine|trending on artstation|hyper[- ]realistic|digital painting|concept art|8k resolution|--ar \d+:\d+|--v \d+|--chaos|--seed)\b/gi;
  const PROMPT_STRONG = /\b(photorealistic|ultra[- ]detailed|octane render|unreal engine|trending on artstation|hyper[- ]realistic|--ar \d+:\d+|--v \d+|--chaos|--seed)\b/i;
  const GEN_SIZES = new Set(["1792x1024", "1024x1792", "768x768", "1536x1536", "2048x2048", "1344x768", "768x1344", "1216x832", "832x1216", "1152x896", "896x1152", "1536x640", "640x1536", "1456x816", "816x1456", "2912x1632", "1232x928", "928x1232", "1664x928", "928x1664"]);
  const META = [
    [/trainedAlgorithmicMedia/, 97, "Content Credentials or IPTC metadata say it was created by AI"],
    [/compositeWithTrainedAlgorithmicMedia/, 82, "Metadata says it was edited with AI"],
    [/compositeSynthetic|algorithmicMedia/, 70, "Metadata describes it as computer-generated"],
    [/Steps: \d+, Sampler: /, 96, "Contains Stable Diffusion generation settings (steps, sampler, seed)"],
    [/"class_type"\s*:\s*"(KSampler|CheckpointLoader)/, 96, "Contains a ComfyUI image-generation workflow"],
    [/\bmidjourney\b/i, 92, "Metadata mentions Midjourney"],
    [/DALL[·-]?E|OpenAI|chatgpt/i, 90, "Metadata mentions OpenAI or DALL·E"],
    [/Adobe Firefly|Firefly/, 85, "Metadata mentions Adobe Firefly"],
    [/Google (Imagen|Gemini)|Imagen [0-9]|SynthID/i, 88, "Metadata mentions a Google image model"],
    [/NovelAI|Leonardo\.Ai|Ideogram|Stable Diffusion|stability\.ai|Flux\.?1|Black Forest Labs|Runway|Kling|Sora/i, 88, "Metadata names an AI image or video generator"],
    [/tEXtparameters/i, 88, "PNG metadata carries generation parameters"],
    [/tEXtprompt/i, 88, "PNG metadata carries an image-generation prompt"],
    [/Negative prompt:/i, 96, "Contains a Stable Diffusion negative prompt"],
    [/CreatorTool[^]{0,120}?\b(Midjourney|DALL|Stable Diffusion|Firefly|Imagen|Leonardo|Ideogram|Flux|Runway|Pika|Kling|NightCafe|Krea|Playground|Bing Image Creator|Microsoft Designer|Meta AI|Grok|Wombo|Craiyon|DeepAI|Artbreeder|Photoleap|Lensa|Hailuo|MiniMax|Vidu|Veo|Nano Banana|Seedream)\b/i, 88, "Image metadata names an AI generator as its creator"],
    [/(Software|Producer)[^]{0,120}?\b(Midjourney|DALL|Stable Diffusion|Firefly|Imagen|Leonardo|Ideogram|Flux|Runway|Pika|Kling|NightCafe|Krea|Playground|Bing Image Creator|Microsoft Designer|Meta AI|Grok|Wombo|Craiyon|DeepAI|Artbreeder|Photoleap|Lensa|Hailuo|MiniMax|Vidu|Veo|Nano Banana|Seedream)\b/i, 88, "Image metadata names an AI generator in its software field"],
    [/AIGenerated|AI[- ]Generated/i, 90, "Metadata says the image is AI-generated"],
    [/Bing Image Creator|Microsoft Designer|Meta AI|Grok|Nano Banana|Seedream|Hailuo|MiniMax|Vidu|Wombo|Craiyon|DeepAI|Artbreeder/i, 88, "Metadata names an AI image or video generator"],
    [/Created (with|by|using) (AI|Midjourney|DALL|Stable Diffusion|Firefly|Imagen|Leonardo|Ideogram|Flux|Runway)/i, 90, "Metadata says the image was created with AI"],
    [/<metadata>[^]{0,600}?(Midjourney|DALL|Stable Diffusion|Firefly|Imagen|ChatGPT|OpenAI)/i, 88, "SVG metadata names an AI generator"],
  ];
  const CAMERA = /(Canon|NIKON|SONY|FUJIFILM|OLYMPUS|Panasonic|Leica|Apple\x00|iPhone|SAMSUNG|Google Pixel|HUAWEI|Xiaomi|OnePlus|GoPro|DJI)/;
  /* Image services that resize or re-compress images. Many keep the original's address inside
     their own, so AI Asli can check the original file, which may still carry its AI labels. */
  function unwrap(url) {
    const out = [];
    try {
      const u = new URL(url, location.href), dec = s => { try { return decodeURIComponent(s); } catch { return s; } };
      const tail = u.href.match(/\/(https?(?:%3A|:)(?:%2F|\/){2}.+)$/i);
      if (/substackcdn\.com$|cloudinary\.com$|imagekit\.io$/.test(u.hostname) && tail) out.push(dec(tail[1]));
      if (u.pathname.includes("/cdn-cgi/image/")) { const rest = u.pathname.split("/cdn-cgi/image/")[1].split("/").slice(1).join("/"); out.push(/^https?:/.test(rest) ? dec(rest) : u.origin + "/" + rest); }
      if (u.pathname.startsWith("/_next/image") && u.searchParams.get("url")) out.push(new URL(u.searchParams.get("url"), u.origin).href);
      if (/^i[0-3]\.wp\.com$/.test(u.hostname)) out.push("https://" + u.pathname.slice(1));
      if (/images\.weserv\.nl$/.test(u.hostname) && u.searchParams.get("url")) { const v = u.searchParams.get("url"); out.push(/^https?:/.test(v) ? v : "https://" + v); }
      if (/(googleusercontent|ggpht)\.com$/.test(u.hostname)) out.push(u.href.replace(/=[^/=]*$/, "=s0"));
    } catch {}
    return [...new Set(out.filter(x => x && x !== url))];
  }
  const REENCODES = /substackcdn\.com|\/cdn-cgi\/image\/|\/_next\/image|i[0-3]\.wp\.com|miro\.medium\.com|pbs\.twimg\.com|scontent|fbcdn\.net|cdninstagram|i\.ytimg\.com|googleusercontent\.com|media\.licdn\.com|imgix\.net|cloudinary\.com|images\.weserv\.nl|redd\.it|imgur\.com/i;
  const reencoded = url => REENCODES.test(url);
  /* Context labels: they explain how an image was made without raising the AI score.
     IPTC digital source types (http://cv.iptc.org/newscodes/digitalsourcetype/) and files saved with Little Light Lit,
     which records any AI-assisted steps and never removes an AI label that came with the photo. */
  const CONTEXT = [
    [/digitalsourcetype\/algorithmicallyEnhanced/, "Metadata says an algorithm enhanced it (such as background removal or noise reduction) but did not create it"],
    [/digitalsourcetype\/(minorHumanEdits|humanEdits)/, "Metadata says it was edited by a person"],
    [/digitalsourcetype\/(digitalCapture|computationalCapture)/, "Metadata says it was captured with a camera"],
    [/digitalsourcetype\/compositeCapture\b/, "Metadata says it combines several camera photos"],
    [/digitalsourcetype\/composite"/, "Metadata says it combines several pictures whose origins aren’t recorded"],
    [/digitalsourcetype\/(digitalCreation|digitalArt)\b/, "Metadata says a person made it with non-generative digital tools"],
    [/CreatorTool="Little Light Lit"/, "Saved with Little Light Lit, which records any AI-assisted steps"],
    [/dcterms:provenance="https?:\/\/[^"]+"/, "Points to Content Credentials stored online, which AI Asli doesn’t fetch, to protect your privacy"],
  ];
  /* ---------- Content Credentials (C2PA): read the real manifest ----------
     The manifest lives in a JUMBF box tree (JPEG APP11 segment or PNG "jumb"
     chunk). This is a small, dependency-free reader for the two assertions
     that matter here: c2pa.actions (the digitalSourceType of each action)
     and c2pa.claim (the claim_generator, i.e. who signed it). It does not
     use the c2pa-js WASM SDK: this extension has no build step, and a classic
     content script cannot load a WASM module, so a focused parser fits the
     codebase better. It reads what the manifest CLAIMS. It does not verify
     the cryptographic signature, so a manifest is a claim about provenance,
     not proof — a forged manifest is possible. Reasons therefore say "says",
     never "proves", and the score stays an estimate. MP4 files store the
     manifest in "uuid" boxes instead of "jumb" boxes, so video manifests
     are not read yet; the regex fallback below still notices them. */
  function cborRead(buf, pos) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const ib = buf[pos], mt = ib >> 5, ai = ib & 31; pos += 1;
    let n;
    if (ai < 24) n = ai;
    else if (ai === 24) { n = buf[pos]; pos += 1; }
    else if (ai === 25) { n = dv.getUint16(pos); pos += 2; }
    else if (ai === 26) { n = dv.getUint32(pos); pos += 4; }
    else if (ai === 27) { n = Number(dv.getBigUint64(pos)); pos += 8; }
    else n = null; // 31 = indefinite length
    if (mt === 0) return [n, pos];
    if (mt === 1) return [-1 - n, pos];
    if (mt === 2 || mt === 3) {
      if (n === null) {
        let out = mt === 2 ? [] : "";
        while (buf[pos] !== 0xFF) { const [v, np] = cborRead(buf, pos); pos = np; out = mt === 2 ? out.concat([...v]) : out + v; }
        return [mt === 2 ? new Uint8Array(out) : out, pos + 1];
      }
      const s = buf.subarray(pos, pos + n); pos += n;
      return [mt === 2 ? s : new TextDecoder().decode(s), pos];
    }
    if (mt === 4) {
      const out = [];
      if (n === null) { while (buf[pos] !== 0xFF) { const [v, np] = cborRead(buf, pos); pos = np; out.push(v); } return [out, pos + 1]; }
      for (let i = 0; i < n; i++) { const [v, np] = cborRead(buf, pos); pos = np; out.push(v); }
      return [out, pos];
    }
    if (mt === 5) {
      const out = {};
      const pair = () => { const [k, p1] = cborRead(buf, pos); pos = p1; const [v, p2] = cborRead(buf, pos); pos = p2; out[typeof k === "string" ? k : String(k)] = v; };
      if (n === null) { while (buf[pos] !== 0xFF) pair(); return [out, pos + 1]; }
      for (let i = 0; i < n; i++) pair();
      return [out, pos];
    }
    if (mt === 6) { const [v, np] = cborRead(buf, pos); return [v, np]; } // tag: keep the value
    if (ai === 20) return [false, pos];
    if (ai === 21) return [true, pos];
    if (ai === 22 || ai === 23) return [null, pos];
    if (ai === 25) { // half-precision float
      const h = dv.getUint16(pos); pos += 2, s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1F, f = h & 0x3FF;
      return [e === 0 ? s * f / 1024 * Math.pow(2, -14) : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * Math.pow(2, e - 15), pos];
    }
    if (ai === 26) return [dv.getFloat32(pos), pos + 4];
    if (ai === 27) return [dv.getFloat64(pos), pos + 8];
    return [null, pos];
  }
  // A JUMBF box: 4-byte big-endian length (includes the 8-byte header),
  // 4-byte type, then the payload. Length 1 means an 8-byte "largesize"
  // follows the type (header is then 16 bytes); length 0 means the box
  // runs to the end of its parent. All reads are bounded by the bytes we
  // actually have, so a truncated download just stops the parse.
  function jumbfBox(buf, off, end) {
    if (off + 8 > end) return null;
    let len = buf[off] * 0x1000000 + buf[off + 1] * 0x10000 + buf[off + 2] * 0x100 + buf[off + 3], hdr = 8;
    if (len === 1) {
      if (off + 16 > end) return null;
      len = (buf[off + 8] * 0x1000000 + buf[off + 9] * 0x10000 + buf[off + 10] * 0x100 + buf[off + 11]) * 0x100000000
        + buf[off + 12] * 0x1000000 + buf[off + 13] * 0x10000 + buf[off + 14] * 0x100 + buf[off + 15]; hdr = 16;
    } else if (len === 0) len = end - off;
    if (len < hdr || off + len > end) return null;
    return { type: String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]), len, hdr, start: off, payload: off + hdr, end: off + len };
  }
  // The label of a "jumd" (description) box: 16-byte UUID, 1 toggle byte,
  // then a null-terminated UTF-8 label, e.g. "c2pa", "c2pa.actions".
  function jumdLabel(buf, box) {
    const p = box.payload + 17;
    if (p >= box.end) return "";
    let e = p; while (e < box.end && buf[e] !== 0) e++;
    try { return new TextDecoder().decode(buf.subarray(p, e)); } catch { return ""; }
  }
  function jumbfChildren(buf, box, fn) {
    let off = box.payload;
    while (off + 8 <= box.end) {
      const child = jumbfBox(buf, off, box.end);
      if (!child) {
        const next = resyncJumb(buf, off + 1, box.end);
        if (next < 0) break;
        off = next;
        continue;
      }
      fn(child);
      off = child.end;
    }
  }
  // Some real C2PA files (notably the c2pa-rs test fixtures) have box lengths
  // that run a few bytes short where a thumbnail's binary data is concerned,
  // so a strict walk stops before the actions and claim boxes. When a child
  // box cannot be read, resync by scanning forward for the next "jumb" box
  // whose length fits and whose first child is a description box with a
  // plausible label. Random image data will not satisfy all three checks.
  function resyncJumb(buf, from, end) {
    for (let i = from; i + 8 <= end; i++) {
      if (buf[i + 4] !== 0x6A || buf[i + 5] !== 0x75 || buf[i + 6] !== 0x6D || buf[i + 7] !== 0x62) continue;
      const box = jumbfBox(buf, i, end);
      if (!box || box.type !== "jumb") continue;
      const first = jumbfBox(buf, box.payload, box.end);
      if (!first || first.type !== "jumd") continue;
      const lab = jumdLabel(buf, first);
      if (lab && /^[A-Za-z0-9._:\-\/]+$/.test(lab)) return i;
    }
    return -1;
  }
  // Find the C2PA manifest store: a top-level "jumb" box whose first child
  // is a "jumd" labelled "c2pa". The box may sit in a JPEG APP11 segment or
  // a PNG "jumb" chunk, so scan the bytes for it rather than assuming a
  // container. A "jumb" string inside image or metadata data is filtered out
  // because the length has to fit and the first child has to be the "c2pa"
  // description box.
  function findC2PAStore(buf) {
    for (let i = 4; i + 4 <= buf.length; i++) {
      if (buf[i] !== 0x6A || buf[i + 1] !== 0x75 || buf[i + 2] !== 0x6D || buf[i + 3] !== 0x62) continue;
      const box = jumbfBox(buf, i - 4, buf.length);
      if (!box || box.type !== "jumb") continue;
      const first = jumbfBox(buf, box.payload, box.end);
      if (first && first.type === "jumd" && jumdLabel(buf, first) === "c2pa") return box;
    }
    return null;
  }
  // The payload of an assertion box: after its "jumd" description, a single
  // "cbor" or "json" box holds the assertion data.
  function assertionData(buf, box) {
    const desc = jumbfBox(buf, box.payload, box.end);
    if (!desc) return null;
    const payload = jumbfBox(buf, desc.end, box.end);
    if (!payload) return null;
    try {
      if (payload.type === "cbor") return cborRead(buf, payload.payload)[0];
      if (payload.type === "json") return JSON.parse(new TextDecoder().decode(buf.subarray(payload.payload, payload.end)));
    } catch { return null; }
    return null;
  }
  /* What a C2PA digital source type means, and the score it earns. The levels
     match the IPTC rules below, so a C2PA claim and an IPTC label for the same
     image give the same score — the C2PA one just also names the signer. */
  const C2PA_SOURCE = {
    trainedAlgorithmicMedia: { p: 97, text: "created by AI" },
    compositeWithTrainedAlgorithmicMedia: { p: 82, text: "edited with AI" },
    compositeSynthetic: { p: 70, text: "computer-generated" },
    algorithmicMedia: { p: 70, text: "computer-generated" },
    algorithmicallyEnhanced: { p: 0, text: "enhanced by an algorithm, not created by it" },
    digitalCapture: { p: 0, text: "captured with a camera" },
    computationalCapture: { p: 0, text: "captured with a camera" },
    compositeCapture: { p: 0, text: "combines several camera photos" },
    composite: { p: 0, text: "combines several pictures whose origins aren’t recorded" },
    digitalCreation: { p: 0, text: "made by a person with non-generative digital tools" },
    digitalArt: { p: 0, text: "made by a person with non-generative digital tools" },
    minorHumanEdits: { p: 0, text: "edited by a person" },
    humanEdits: { p: 0, text: "edited by a person" },
  };
  function shortSigner(full) {
    if (!full) return "";
    let s = String(full).split("/")[0].trim().replace(/\s+\d+(\.\d+)*$/, "");
    return s.slice(0, 40);
  }
  // Read the C2PA manifest. Returns { present, signer, signerFull,
  // sourceType, sourceTypes, softwareAgent }. "present" means a manifest
  // store was found and parsed; a file with no manifest returns
  // present: false. Nested ingredient manifests are not followed — this is
  // the asset's own claim.
  function parseC2PA(buf) {
    const out = { present: false, signer: "", signerFull: "", sourceType: "", sourceTypes: [], softwareAgent: "" };
    let store;
    try { store = findC2PAStore(buf); } catch { return out; }
    if (!store) return out;
    out.present = true;
    let done = false;
    jumbfChildren(buf, store, man => {
      if (done || man.type !== "jumb") return;
      let claim = null, assertions = null;
      jumbfChildren(buf, man, part => {
        if (part.type !== "jumb") return;
        const first = jumbfBox(buf, part.payload, part.end);
        if (!first || first.type !== "jumd") return;
        const lab = jumdLabel(buf, first);
        if (lab === "c2pa.claim") claim = part;
        else if (lab === "c2pa.assertions") assertions = part;
      });
      if (assertions) {
        jumbfChildren(buf, assertions, as => {
          if (as.type !== "jumb") return;
          const first = jumbfBox(buf, as.payload, as.end);
          if (!first || first.type !== "jumd") return;
          if (jumdLabel(buf, first) !== "c2pa.actions") return;
          const data = assertionData(buf, as);
          if (data && Array.isArray(data.actions)) {
            for (const a of data.actions) {
              if (a && typeof a.digitalSourceType === "string") {
                const st = a.digitalSourceType.split("/").pop().split("#").pop();
                if (st && !out.sourceTypes.includes(st)) out.sourceTypes.push(st);
              }
              if (a && typeof a.softwareAgent === "string" && !out.softwareAgent) out.softwareAgent = a.softwareAgent;
            }
          }
        });
      }
      if (claim) {
        const data = assertionData(buf, claim);
        if (data && typeof data.claim_generator === "string") out.signerFull = data.claim_generator;
        if (data && Array.isArray(data.claim_generator_info) && data.claim_generator_info.length) {
          const first = data.claim_generator_info[0];
          if (first && typeof first.name === "string") out.signer = first.name;
        }
      }
      if (claim || assertions) done = true;
    });
    if (!out.signer) out.signer = shortSigner(out.signerFull);
    // The strongest source type wins when several actions declare one.
    let best = null;
    for (const st of out.sourceTypes) {
      const info = C2PA_SOURCE[st];
      if (info && (!best || info.p > C2PA_SOURCE[best].p)) best = st;
    }
    out.sourceType = best || out.sourceTypes[0] || "";
    return out;
  }
  function inspectBytes(latin) {
    const bytes = new Uint8Array(latin.length);
    for (let i = 0; i < latin.length; i++) bytes[i] = latin.charCodeAt(i) & 0xFF;
    const c2paManifest = parseC2PA(bytes);
    const out = { hits: [], camera: false, c2pa: c2paManifest.present || /c2pa|jumbf/i.test(latin), c2paManifest, context: [], captured: /digitalsourcetype\/(digitalCapture|computationalCapture|compositeCapture)\b/.test(latin) };
    // Score on the image's own label. Little Light Lit also records the labels of the pictures it combined
    // (lll:SourceTypes, lll:OriginalSourceType): report those as an ingredient, without letting them override the image's own label.
    const ingredients = (latin.match(/lll:(?:SourceTypes|OriginalSourceType)="([^"]{0,800})"/g) || []).join(" "), own = latin.replace(/lll:(?:SourceTypes|OriginalSourceType)="[^"]{0,800}"/g, "");
    // A C2PA manifest states its own source type, so the three META rules
    // that match those same source-type strings would only repeat it — skip
    // them when the manifest already declared that source type. Other META
    // rules still run, so an IPTC label that disagrees with the manifest is
    // not lost.
    for (const [re, p, why] of META) if (re.test(own) && !(c2paManifest.sourceType && re.test(c2paManifest.sourceType))) out.hits.push({ p, why });
    for (const [re, why] of CONTEXT) if (re.test(own)) out.context.push(why);
    if (/trainedAlgorithmicMedia|compositeSynthetic|algorithmicMedia/.test(ingredients) && !/digitalsourcetype\/trainedAlgorithmicMedia/.test(own)) out.context.push("Includes a picture labelled as made or edited by AI");
    const steps = latin.match(/lll:AIAssistedSteps="([^"]{1,200})"/); if (steps && steps[1] !== "none") out.context.push(`AI-assisted steps recorded: ${steps[1].replace(/[<>&]/g, "")}`);
    out.camera = CAMERA.test(latin) && /Exif/.test(latin);
    // The C2PA manifest's own verdict, with the signer named. "says", not
    // "proves": the signature is not verified, so this is a claim.
    if (c2paManifest.sourceType) {
      const info = C2PA_SOURCE[c2paManifest.sourceType], who = c2paManifest.signer ? ` (signed by ${c2paManifest.signer})` : "";
      if (info && info.p > 0) out.hits.push({ p: info.p, why: `Content Credentials say it was ${info.text}${who}`, c2pa: true });
      else if (info) {
        if (/captur/.test(info.text)) { out.captured = true; out.context.push(`Content Credentials say it was ${info.text}${who}`); }
        else out.context.push(`Content Credentials say it was ${info.text}${who}`);
      } else out.context.push(`Content Credentials list its origin as “${c2paManifest.sourceType}”${who}`);
    } else if (c2paManifest.present && c2paManifest.softwareAgent) {
      out.context.push(`Content Credentials name ${c2paManifest.softwareAgent} as the tool used${c2paManifest.signer ? ` (signed by ${c2paManifest.signer})` : ""}`);
    }
    return out;
  }
  /* Verified Content Credentials (bytes.verified, from c2pa/verify.js) override what the quick parser read,
     because the official library checks the signature and that the file matches it. Wording always says
     "say" or "signed by", never "proves": a signature shows who signed and that nothing changed since,
     not that the content is true. A mismatch is treated as a warning, and its claims are not trusted.
     Research basis: Golaszewski et al. (2026), "Verifying Provenance of Digital Media: Security Analysis of C2PA
     and its Implementation", IACR ePrint 2026/804 (UMBC, Hacker Factor and NSA). */
  function applyVerified(v, p, why, notes) {
    if (!v?.ok || !v.present) return { p, used: false };
    const by = v.signer ? `, signed by ${v.signer}` : "";
    if (v.mismatch || v.badSignature) {
      why.unshift(v.mismatch ? "Content Credentials don’t match this file: it was changed after signing, or the credentials were copied from another file" : "Content Credentials are present, but their signature doesn’t check out");
      notes.push("Don’t rely on these credentials. Any AI or camera claims in them can’t be trusted.");
      return { p: Math.min(p, 60), used: true, broken: true };
    }
    if (v.aiCreated) { p = Math.max(p, 99); why.unshift(`Verified Content Credentials${by}, say it was created by AI`); }
    else if (v.aiEdited) { p = Math.max(p, 90); why.unshift(`Verified Content Credentials${by}, say it was edited with AI`); }
    else if (v.aiIngredient) { p = Math.max(p, 86); why.unshift(`Verified Content Credentials${by}, say it includes AI-generated material`); }
    else if (v.captured) { p = Math.min(p, 5); why.unshift(`Verified Content Credentials${by}, say it was captured with a camera`); }
    else why.unshift(`Verified Content Credentials${by}, with no AI declared`);
    if (v.untrusted) notes.push("The signer isn’t on the C2PA trust list, so be cautious about who signed it.");
    if (v.expired) notes.push("The signing certificate has expired. That alone doesn’t mean the file changed; signed files can stop verifying over time.");
    if (v.revoked) notes.push("The signing certificate has been revoked: treat these credentials with suspicion.");
    if (v.generator) notes.push(`Made or edited with: ${v.generator}.`);
    notes.push("A valid signature shows who signed it and that the file hasn’t changed since. It doesn’t prove the content is true.");
    return { p, used: true };
  }
  function judge({ url = "", label = "", alt = "", w = 0, h = 0, kind = "image", bytes = null, original = false, readable = true }) {
    let p = 12; const why = [], notes = [];
    if (bytes) {
      if (bytes.hits.length) { const top = bytes.hits.sort((a, b) => (b.p - a.p) || ((b.c2pa ? 1 : 0) - (a.c2pa ? 1 : 0)))[0]; p = Math.max(p, top.p); why.push(top.why); bytes.hits.slice(1, 2).forEach(x => why.push(x.why)); }
      else if (bytes.c2pa) {
        const m = bytes.c2paManifest;
        why.push(m?.present ? (m.signer ? `Has Content Credentials with no AI generation declared (signed by ${m.signer})` : "Has Content Credentials with no AI generation declared") : "Has Content Credentials, but the manifest could not be read in detail");
      }
      if (bytes.camera && !bytes.hits.length) { p = Math.min(p, 8); why.push("Contains camera details (make or model)"); }
      if (bytes.captured && !bytes.hits.length) p = Math.min(p, 8);
      (bytes.context || []).forEach(c => { if (!why.includes(c)) why.push(c); });
      if (bytes.verified?.ok && bytes.verified.present) {
        // the verified result replaces the quick parser's unverified "Has Content Credentials..." line
        const i = why.findIndex(w => /^Has Content Credentials|Content Credentials or IPTC metadata say/.test(w)); if (i >= 0 && !/IPTC/.test(why[i])) why.splice(i, 1);
        ({ p } = applyVerified(bytes.verified, p, why, notes));
        for (let i = why.length - 1; i > 0; i--) if (/^Content Credentials say/.test(why[i])) why.splice(i, 1); // the verified line replaces the quick parser's unverified reading
      }
    }
    for (const [re, name] of HOSTS) if (re.test(url)) { p = Math.max(p, name === "the file name" ? 72 : 86); why.push(name === "the file name" ? "The file name mentions AI generation" : `Comes from ${name}`); break; }
    if (LABEL.test(label)) { p = Math.max(p, 84); why.push("Labelled as AI-generated nearby"); }
    if (alt) {
      const toks = [...new Set((alt.match(PROMPT_TOKENS) || []).map(t => t.toLowerCase()))];
      if (toks.length >= 2) { p = Math.max(p, 72); why.push("Alt text reads like an image-generation prompt"); }
      else if (toks.length === 1 && PROMPT_STRONG.test(alt)) { p = Math.max(p, 64); why.push("Alt text reads like an image-generation prompt"); }
    }
    if (w && h && GEN_SIZES.has(`${w}x${h}`) && kind === "image") { p = why.length ? Math.min(99, p + 4) : Math.max(p, 32); why.push(`Exact size (${w}×${h}) common for AI generators`); }
    if (p <= 50) {
      if (reencoded(url) && !original) notes.push("This site re-compresses images, which removes hidden AI labels, so only links, labels and size could be checked.");
      else if (reencoded(url) && original) notes.push("The site re-compresses images, but AI Asli also checked the original file and found no AI labels.");
      if (!bytes && !readable) notes.push("The file’s hidden details couldn’t be read. Turn on “Read image details” in Settings for a deeper check.");
      if (bytes && !bytes.c2pa) notes.push("No Content Credentials found. That isn’t evidence either way: many sites strip them, and some tools exist to remove them.");
      notes.push(why.length ? "No strong evidence found. Many AI images carry no labels, so this doesn’t mean it was made by a person." : "No evidence found. Many AI images carry no labels, so this doesn’t mean it was made by a person.");
    }
    return { score: Math.min(99, p), reasons: why.slice(0, 3), evidence: p > 50, notes, verified: bytes?.verified || null };
  }
  globalThis.AIAsliMedia = { inspectBytes, judge, unwrap, reencoded, parseC2PA };
})();
