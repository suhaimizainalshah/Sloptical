# AI Asli

A Chrome extension that spots **AI slop**: it highlights writing, images, GIFs and videos that are likely AI-generated, explains why when you hover, and checks your own writing with tips to make it sound more like you. Everything runs in your browser: no AI Asli servers, no accounts, no tracking.

Made by [AI Benar Advisory](https://suhaimizainalshah.github.io/AI-Benar-Advisory/) — independent AI compliance and governance support for the EU, Vietnam, South Korea and ASEAN.

| Colour | Likelihood |
|---|---|
| Yellow | 51–64% (possibly AI) |
| Translucent orange | 65–79% (likely AI) |
| Pink | 80% and above (very likely AI) |

Only items scoring **above 50%** are highlighted; you can raise the threshold in Settings.

## How images were made: context labels
Besides evidence of AI generation, AI Asli reads the standard IPTC “digital source type” labels that explain how an image was made, and shows them as reasons without raising the AI score: **edited by a person**, **algorithmically enhanced** (such as background removal), and **captured with a camera** (which lowers the score). It also recognises images saved with **Little Light Lit**, which writes these labels honestly, lists any AI-assisted steps, and never removes an AI label that came with the original photo.

## Use it fairly
AI Asli gives an **estimate from patterns, not proof**. Research has found that style-based detectors flag people writing in a second language, and very formal or templated writing, more often than others (Liang et al., 2023, *GPT detectors are biased against non-native English writers*, Patterns 4(7)). So:
- **Never use a score as the sole basis** for academic, employment or disciplinary decisions.
- Treat a high score as a prompt for a conversation, not a verdict.
- Remember that people edit AI drafts and AI edits human drafts: most writing is a mix.
This notice appears with every writing check, in the welcome guide, and in the detector’s code.

## Features
- **This page:** scan with one click or **Alt+Shift+S**. You get an overall score ring, counts by colour, and a list of the most AI-like passages and media; click any item to jump to it on the page.
- **Hover explanations:** every highlight shows its likelihood and the top reasons, such as overused chatbot phrases, uniform sentence rhythm, "It's not just X, it's Y" templates, stacked "Moreover/Furthermore" openers, em-dash habits, or leftover chatbot text ("I hope this helps").
- **Giveaway phrases underlined** inside flagged passages.
- **Images, GIFs and videos:** flagged when there is evidence of AI generation: Content Credentials (C2PA) or IPTC "trained algorithmic media" labels, Stable Diffusion or ComfyUI settings, generator names in metadata (Midjourney, DALL·E, Firefly, Imagen, Flux and others), links to AI image services, typical generator image sizes, and "AI-generated" labels nearby. Camera details lower the score. Each flagged item gets a badge and hover reasons.
- **Right-click any image or video** and choose *Check this image or video with AI Asli* for a detailed result, including what was checked when no evidence is found.
- **Image services:** many sites (Substack, WordPress, Next.js sites, Cloudflare, Cloudinary and others) re-compress images, which removes hidden AI labels. Where the service keeps the original file's address, AI Asli checks the original too.
- **Check writing:** paste any text, including your own draft, to see how AI-like it reads, the share of AI-like sentences, a sentence-by-sentence colour view, giveaway words with plain alternatives, and tips to make it sound like you. "Swap stock words" makes safe one-for-one replacements, with undo.
- **Right-click** selected text to check just that passage.
- **Weekly summary** of your scans, stored only on your device.
- **Settings:** threshold, phrase underlining, media checks, keep checking as the page loads more, deeper image metadata checks, automatic scanning, and sites never to scan.
- **Welcome page** with a live demo on first install.

## Honest limits
- **Text:** the score is a style estimate, not proof. No detector can reliably prove text is AI-written, and style signals also appear in formal writing and in writing by people using a second language. Don't use it as the sole basis for judging anyone.
- **Media:** AI Asli only finds *evidence* AI media carries. Most AI images online have their metadata removed, and invisible watermarks such as SynthID can't be read by an extension, so "no evidence" doesn't mean human-made.

## Try it locally (2 minutes)
1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose this folder.
5. Pin AI Asli from the puzzle-piece menu and click it on any article.

Works in Chrome, Edge, Brave, Arc and other Chromium browsers.

## Files
```
manifest.json     extension settings (Manifest V3)
detector.js       text scoring, sentence analysis, giveaway phrases and word swaps
media.js          image, GIF and video evidence checks
content.js        page scanning, highlights, media badges and hover explanations
content.css       highlight colours, badges and tooltip styles
background.js     badge, right-click menu, shortcut, media metadata, history, auto-scan
popup.html/js     the toolbar panel: This page, Check writing, Settings
welcome.html/js   first-run page with a live demo (demo/ holds its sample images)
privacy.html      privacy policy
icons/            16, 32, 48 and 128 px icons
store/            Web Store screenshots, promo tile and listing text
```

## Publish on the Chrome Web Store
1. **Register as a developer** at the Chrome Web Store Developer Dashboard with your Google account and pay the one-time registration fee.
2. **Zip the extension**: select the extension files (everything except `store/`, `README.md` and `LICENSE`) and compress them so `manifest.json` sits at the top of the zip.
3. In the dashboard, click **New item** and upload the zip.
4. **Store listing**: copy the name, summary, description and permission reasons from `store/STORE_LISTING.md`, and upload the three 1280×800 screenshots and the 440×280 promo tile from `store/`.
5. **Privacy practices**: state the single purpose ("highlights likely AI-generated writing on web pages"), justify each permission (wording is in `privacy.html`), and declare that you collect no user data.
6. **Privacy policy URL**: https://github.com/suhaimizainalshah/ai-asli/blob/main/privacy.html
7. **Submit for review**. Reviews usually take a few days; narrow permissions like these help.
8. To update later, raise `version` in `manifest.json`, zip again and upload.

## Host the code on GitHub
1. Create a public repository called `ai-asli`.
2. Upload every file in this folder (keep the `icons` folder).
3. Optional: Releases → Draft a new release → attach the zip so people can install it with Load unpacked.

## Browsers and sites
- **Browsers:** works in Google Chrome 111 or later and other Chromium browsers. Brave, Opera, Vivaldi and Arc can install it from the Chrome Web Store; Microsoft Edge can too, or you can also publish it on Edge Add-ons. Firefox and Safari need separate versions.
- **Sites:** works on almost every website. Chrome doesn't let any extension run on its own pages (`chrome://`), the Chrome Web Store, other extensions' pages or its built-in PDF viewer. For files on your computer, turn on "Allow access to file URLs" in the extension's details.
- **Embedded content:** AI Asli scans the main page. Content inside embedded frames from other sites, such as some comment boxes and ads, isn't scanned.

## Licence
MIT. Contributions to the phrase list and scoring rules are welcome.
