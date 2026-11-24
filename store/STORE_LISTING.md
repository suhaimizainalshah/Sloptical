# Chrome Web Store listing for AI Asli

## Name
AI Asli: AI Text, Image and Video Checker

(This must match the name in manifest.json, which is what Chrome shows.)

## Summary (132 characters max)
Spots writing, images and videos likely made with AI, checks Content Credentials, explains why, and helps your writing. Private.

## Description
AI Asli helps you spot AI slop on the web, and keep it out of your own writing.

WHAT’S NEW IN 1.4
• Mana Asli?, a classroom game built in (open it from the popup). “Mana Asli?” is Malay for “Which is genuine?” or “Where’s the original?”: students guess which passage or picture is human-made and which is AI, then discuss the clues. Teachers can copy a link for students who don’t have the extension.

HIGHLIGHTS ON ANY PAGE
• Passages scoring above 50% are highlighted: yellow (possibly), orange (likely), pink (very likely).
• Hover any highlight to see the likelihood and exactly why: overused chatbot phrases, uniform sentence rhythm, template contrasts, leftover chatbot text.
• Giveaway phrases are underlined.

IMAGES, GIFS AND VIDEOS
• Flags media with evidence of AI generation: Content Credentials (C2PA) and IPTC labels, Stable Diffusion and ComfyUI settings, generator names in metadata, AI image services, and “AI-generated” labels nearby.
• Each flagged item gets a badge with its likelihood and reasons.
• Right-click any image or video to check it in detail. Where a site re-compresses images, AI Asli also checks the original file.

CHECK YOUR OWN WRITING
• Paste any text to see how AI-like it reads, what share of sentences give it away, and sentence-by-sentence colour coding.
• Get plain-word alternatives and tips to make it sound more like you.

PRIVATE BY DESIGN
• Everything runs in your browser. No accounts, no tracking, no AI Asli servers.
• By default it only reads a page when you click it.

Please note: AI Asli gives an estimate, not proof. People write like this too, especially formally or in a second language, and most AI images have their metadata removed.

Need AI compliance support? Reach out at AI Benar Advisory: https://suhaimizainalshah.github.io/AI-Benar-Advisory/

## Category
Productivity (or Tools)

## Single purpose
Highlights content on web pages that is likely AI-generated and explains why.

## Permission justifications
- activeTab, scripting: to scan the current page when the user clicks the extension, uses the shortcut or the right-click menu.
- storage: to save settings, a local scan history for the weekly summary, and the last writing-check draft.
- contextMenus: to add “Check selected text” and “Scan this page” to the right-click menu.
- Optional host access (<all_urls>): only if the user turns on image details or automatic scanning; used to read image metadata and to scan pages without a click. No data is transmitted.

- **offscreen:** runs the official open-source C2PA library (WebAssembly) in a hidden extension page to verify Content Credentials on the user’s device. No data is sent anywhere; credentials stored on remote servers are not fetched.

## Data usage disclosure
Does not collect or transmit any user data.

## Privacy policy URL
https://github.com/suhaimizainalshah/ai-asli/blob/main/privacy.html
