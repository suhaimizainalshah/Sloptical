/* AI Asli: Content Credentials (C2PA) verification, on this device.
   Uses the official open-source C2PA library (@contentauth/c2pa-web 0.16.0, MIT) in this hidden extension page.
   Settings keep everything local: no remote manifest fetching and no certificate revocation (OCSP) lookups.
   Signers are checked against a bundled copy of the C2PA Conformance Program trust list (trust/), refreshed on each update.

   What a result means, and what it does not:
   - A valid signature shows who signed the credentials and that the file has not changed since it was signed.
     It does not prove the content is true.
   - A mismatch means the file changed after signing, or the credentials were copied from another file.
   - Credentials are easily removed (many platforms strip them, and some tools exist to remove them),
     so a file without credentials is not evidence either way.
   - Revocation is not checked (that would need a network lookup), and timestamps are not covered by the signature
     in the current specification (Golaszewski et al., 2026, IACR ePrint 2026/804), so treat signing dates as claims. */
import { createC2pa, Reader, Context } from "./c2pa-web.js";

const MAX_BYTES = 60 * 1024 * 1024;
const AI_CREATED = /trainedAlgorithmicMedia|compositeSynthetic|algorithmicMedia/;
const AI_EDITED = /compositeWithTrainedAlgorithmicMedia/;
const CAPTURED = /digitalCapture|computationalCapture|compositeCapture/;
let ready = null;

function init() {
  ready ||= (async () => {
    const anchors = await (await fetch(chrome.runtime.getURL("c2pa/trust/C2PA-TRUST-LIST.pem"))).text();
    const c2pa = await createC2pa({ wasmSrc: chrome.runtime.getURL("c2pa/c2pa_bg.wasm"), workerSrc: new URL(chrome.runtime.getURL("c2pa/c2pa-worker.js")) });
    const context = new Context({ verify: { verifyTrust: true, remoteManifestFetch: false, ocspFetch: false }, trust: { trustAnchors: anchors } });
    return { c2pa, context };
  })().catch(e => { ready = null; throw e; });
  return ready;
}

const actionsOf = m => (m?.assertions || []).filter(a => /^c2pa\.actions/.test(a.label || "")).flatMap(a => a.data?.actions || []);
const typeOf = a => String(a.digitalSourceType || a.parameters?.digitalSourceType || "");

function summarise(store) {
  const active = store.manifests?.[store.active_manifest] || null;
  const codes = [...(store.validation_results?.activeManifest?.failure || []), ...(store.validation_status || [])].map(s => s.code).filter(Boolean);
  const failed = new Set(codes);
  const has = re => [...failed].some(c => re.test(c));
  const acts = actionsOf(active), types = acts.map(typeOf).join(" ");
  const others = Object.entries(store.manifests || {}).filter(([k]) => k !== store.active_manifest).map(([, m]) => m);
  const ingredientTypes = others.flatMap(actionsOf).map(typeOf).join(" ");
  const sig = active?.signature_info || {};
  const gen = active?.claim_generator_info?.[0]?.name || active?.claim_generator || "";
  return {
    ok: true,
    state: store.validation_state || (failed.size ? "Invalid" : "Valid"), // Trusted, Valid or Invalid
    signer: (sig.common_name || sig.issuer || "").slice(0, 80), issuer: (sig.issuer || "").slice(0, 80), time: sig.time || "",
    generator: String(gen).replace(/\/v?\d[\w.+-]*.*$/, "").replace(/_/g, " ").trim().slice(0, 60),
    aiCreated: AI_CREATED.test(types) && !AI_EDITED.test(types),
    aiEdited: AI_EDITED.test(types),
    captured: CAPTURED.test(types),
    aiIngredient: AI_CREATED.test(ingredientTypes) || AI_EDITED.test(ingredientTypes),
    ingredients: (active?.ingredients || []).length,
    actions: [...new Set(acts.map(a => String(a.action || "").replace(/^c2pa\./, "")).filter(Boolean))].slice(0, 8),
    mismatch: has(/(dataHash|bmffHash|boxesHash|collectionHash)\.mismatch|hashedURI\.mismatch/),
    badSignature: has(/claimSignature\.(mismatch|missing)|signingCredential\.invalid/),
    untrusted: has(/signingCredential\.untrusted/) || store.validation_state === "Valid",
    expired: has(/signingCredential\.expired/),
    revoked: has(/signingCredential\.revoked/),
    codes: [...failed].slice(0, 12),
  };
}

async function verify(url, type) {
  const { c2pa, context } = await init();
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) return { ok: false, reason: "unreadable" };
  const len = +res.headers.get("content-length") || 0;
  if (len > MAX_BYTES) return { ok: false, reason: "too-large" };
  const blob = await res.blob();
  if (blob.size > MAX_BYTES) return { ok: false, reason: "too-large" };
  const reader = await Reader.fromBlob(c2pa, type || blob.type || undefined, blob, context);
  if (!reader) return { ok: true, present: false };
  try { return { present: true, ...summarise(await reader.manifestStore()) }; } finally { await reader.free?.(); }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.target !== "c2pa-offscreen" || msg.type !== "verify") return;
  const timeout = new Promise(r => setTimeout(() => r({ ok: false, reason: "timeout" }), 25000));
  Promise.race([verify(msg.url, msg.mime).catch(e => {
    const d = String(e?.message || e), remote = /RemoteManifestUrl\("([^"]+)"\)/.exec(d);
    // Credentials stored online: not fetched, because fetching would tell that server which file you are looking at.
    if (remote) { let host = ""; try { host = new URL(remote[1]).host; } catch {} return { ok: true, present: false, remote: true, remoteHost: host }; }
    return { ok: false, reason: "error", detail: d.slice(0, 160) };
  }), timeout]).then(reply);
  return true;
});
