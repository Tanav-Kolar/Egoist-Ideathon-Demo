# Egoist VISA

**A portable, revocable licensing & training-consent layer for creative work, resolved by content fingerprint and held in the creator's AI Passport.**

> Set a licence once. It's fingerprinted into your work and travels with it. Strip the file, rename it, re-upload it anywhere — the fingerprint still carries your current terms home. Consent that travels with the work, not the file.

Built for the Egoist AI Passport Ideathon. See [`build-spec.md`](build-spec.md) for the full product spec (written under the working title "Coathook," since renamed to Egoist VISA — see [`CLAUDE.md`](CLAUDE.md) for that and the rest of the build's steering rules: visual skin, persona, model constraints).

## Running it

This is a static site with **no build step and no server-side code** — but it must be served over HTTP, not opened as a `file://` path:

```bash
python3 -m http.server 8080
```

Then open **http://localhost:8080**.

Why not `file://`: Chrome taints a `<canvas>` after drawing a `file://`-sourced image, so `getImageData()` throws and the bundled sample images can't be fingerprinted. Files you drag in yourself (blob URLs) aren't affected — only the one-click bundled samples need HTTP.

## What's real vs. illustrative

- **The perceptual hash (DCT-based pHash) and Hamming-distance matching are real** and run entirely in your browser — nothing is uploaded anywhere. Verify it yourself: `tools/phash-check.html` (also served over HTTP) prints the full distance matrix across every bundled sample, its recompressed copy, and a decoy.
- **Platform connectors** (Shutterstock, Getty, Behance, Dribbble, Pinterest — visual/media platforms only) are an illustrative integration model, not live production integrations.
- **The resolver is client-side** (`localStorage`) in this build. In production it would be a hardened, optionally federated service, with identity protected via unlinkable references.
- **The permission is evidentiary/checkable, not DRM** — it enables compliant checking and portable proof; it does not physically prevent misuse.

## The core property this demo proves

The registry never stores a policy — only a pointer: `fingerprint → policyRef`. Resolving a check is always a live two-step lookup (registry → vault), so editing the standing policy (narrowing the use scope, turning off AI training, letting it expire) changes the answer for every already-registered fingerprint on its very next check. Open devtools → Application → Local Storage → `egoist_visa_v1` and inspect a registry entry yourself — it will never contain a policy, an image, or a name.

## Project layout

```
index.html                  the app: three lenses + persistent AI Passport vault rail
assets/
  css/visa.css              Egoist visual skin (tokens, components)
  fonts/                    self-hosted Geist, Geist Mono, Instrument Serif (OFL)
  js/
    phash.js                real DCT pHash + Hamming + fingerprint glyph rendering
    resolver.js              vault / registry / ledger + the 4 API-shaped calls
    policy.js                the decision engine
    lenses.js                render helpers (vault rail, API log, scoped response)
    app.js                   interactive wiring
  samples/                  bundled sample images + their modified copies + a decoy
tools/
  make-copies.sh             derives each sample's recompressed/renamed copy
  phash-check.html           the pHash risk-gate: distance matrix, run before trusting any of this
```

## Credits

Sample images are sourced from Wikimedia Commons — see [`assets/samples/CREDITS.md`](assets/samples/CREDITS.md) for licenses and attribution. Fonts are self-hosted under the SIL Open Font License — see [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt).
