# Content Credentials verifier

- `offscreen.html` and `verify.js`: a hidden extension page that runs the official C2PA library. Settings: verify trust against `trust/C2PA-TRUST-LIST.pem`; no remote manifest fetching; no OCSP lookups.
- `c2pa-web.js` and `c2pa-worker.js`: `@contentauth/c2pa-web` 0.16.0 (MIT, see `LICENSE-c2pa-web.txt`), bundled with esbuild because the package imports other packages by name. **One change from upstream:** the worker may load from the extension's own `chrome-extension://` files (upstream accepts only https), because Chrome extension pages may not start workers from `blob:` URLs.
- `c2pa_bg.wasm`: the library's WebAssembly engine.

## Updating
1. Pick a release of `@contentauth/c2pa-web` that is **at least two weeks old** (new releases can carry problems before anyone notices).
2. `npm i @contentauth/c2pa-web@VERSION esbuild`, then bundle `export { createC2pa, Reader, Context } from '@contentauth/c2pa-web'` and `dist/c2pa_worker.js` as ES modules, re-apply the one-line worker change, and copy `dist/resources/c2pa_bg.wasm`.
3. Refresh `trust/*.pem` from https://github.com/c2pa-org/conformance-public/tree/main/trust-list and update the date in `trust/README.md`.
4. Test with the official fixtures in `contentauth/c2pa-rs` (`sdk/tests/fixtures`): `C.jpg` (valid, test signer), `XCA.jpg` (does not match), `E-sig-CA.jpg` (bad signature), `video1.mp4` (video), `cloud.jpg` (credentials stored online) and `no_manifest.jpg`.
