/* Sloptical media checks. Looks for evidence that an image, GIF or video was made with AI:
   Content Credentials (C2PA) and IPTC "digital source type" labels, generator metadata
   (Stable Diffusion, ComfyUI, Midjourney, DALL·E, Firefly and others), links to AI image
   services, and "AI-generated" labels near the media. It cannot see invisible watermarks,
   and most AI images online have their metadata removed, so "no evidence" is not "human-made". */
(() => {
  if (globalThis.SlopticalMedia) return;
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
     their own, so Sloptical can check the original file, which may still carry its AI labels. */
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
  function inspectBytes(latin) {
    const out = { hits: [], camera: false, c2pa: /c2pa|jumbf/i.test(latin) };
    for (const [re, p, why] of META) if (re.test(latin)) out.hits.push({ p, why });
    out.camera = CAMERA.test(latin) && /Exif/.test(latin);
    return out;
  }
  function judge({ url = "", label = "", alt = "", w = 0, h = 0, kind = "image", bytes = null, original = false, readable = true }) {
    let p = 12; const why = [];
    if (bytes) {
      if (bytes.hits.length) { const top = bytes.hits.sort((a, b) => b.p - a.p)[0]; p = Math.max(p, top.p); why.push(top.why); bytes.hits.slice(1, 2).forEach(x => why.push(x.why)); }
      else if (bytes.c2pa) why.push("Has Content Credentials with no AI generation declared");
      if (bytes.camera && !bytes.hits.length) { p = Math.min(p, 8); why.push("Contains camera details (make or model)"); }
    }
    for (const [re, name] of HOSTS) if (re.test(url)) { p = Math.max(p, name === "the file name" ? 72 : 86); why.push(name === "the file name" ? "The file name mentions AI generation" : `Comes from ${name}`); break; }
    if (LABEL.test(label)) { p = Math.max(p, 84); why.push("Labelled as AI-generated nearby"); }
    if (alt) {
      const toks = [...new Set((alt.match(PROMPT_TOKENS) || []).map(t => t.toLowerCase()))];
      if (toks.length >= 2) { p = Math.max(p, 72); why.push("Alt text reads like an image-generation prompt"); }
      else if (toks.length === 1 && PROMPT_STRONG.test(alt)) { p = Math.max(p, 64); why.push("Alt text reads like an image-generation prompt"); }
    }
    if (w && h && GEN_SIZES.has(`${w}x${h}`) && kind === "image") { p = why.length ? Math.min(99, p + 4) : Math.max(p, 32); why.push(`Exact size (${w}×${h}) common for AI generators`); }
    const notes = [];
    if (p <= 50) {
      if (reencoded(url) && !original) notes.push("This site re-compresses images, which removes hidden AI labels, so only links, labels and size could be checked.");
      else if (reencoded(url) && original) notes.push("The site re-compresses images, but Sloptical also checked the original file and found no AI labels.");
      if (!bytes && !readable) notes.push("The file’s hidden details couldn’t be read. Turn on “Read image details” in Settings for a deeper check.");
      notes.push(why.length ? "No strong evidence found. Many AI images carry no labels, so this doesn’t mean it was made by a person." : "No evidence found. Many AI images carry no labels, so this doesn’t mean it was made by a person.");
    }
    return { score: Math.min(99, p), reasons: why.slice(0, 3), evidence: p > 50, notes };
  }
  globalThis.SlopticalMedia = { inspectBytes, judge, unwrap, reencoded };
})();
