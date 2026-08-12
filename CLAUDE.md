# Egoist VISA — Egoist Ideathon Demo

## Product name
The product is **Egoist VISA** (wordmark "EGOIST" + product name "VISA", lockup styled
the same way ego.ist pairs "EGOIST" with "AI Passport"). It was built and originally
named **"Coathook"** — `build-spec.md` and `coathook-demo.html` still use that working
title throughout, and their filenames are unchanged since they're historical reference
docs, not part of the deployed app. **Do not reintroduce "Coathook" anywhere user-facing**
(page title, headline, console messages, README) — that name is retired.

## Sources of truth
- `build-spec.md` is authoritative for flow, architecture, data model, and honest labeling
  (written under the "Coathook" working title — see Product name above).
- `coathook-demo.html` is a **flow and layout reference only** — lens structure, vault-rail
  composition, receipt-ledger pattern. **Do not take its palette.** Its warm-paper/ledger
  colors are superseded by the Egoist skin below.

## Visual skin — Egoist (ego.ist)
The demo wears Egoist's product identity. Tokens extracted from ego.ist's shipped CSS:

    --ink:#11100e;              --ink-muted:rgba(17,16,14,.62);
    --body:#55544f;             --ink-faint:rgba(17,16,14,.38);
    --paper:#fafaf7;            --surface:#ffffff;        --surface-2:#f6f6f4;
    --line:#e9e8e3;             --line-2:#e4e2db;
    --granted:#23c968;          --granted-deep:#22372f;
    --denied:#b3261e;           --denied-tint:#fbf3f2;
    --clay:#a86f5b;             --rust:#d85f4a;           --accent:#123dbb;

Radii: 22px cards · 999px pills · 6px chrome. Card: `1px solid var(--line)` on
`--surface`, shadow `0 1px 2px rgba(17,18,19,.04)`.
Type: **Geist** (400/500/600/700) for UI, **Geist Mono** for fingerprints, codes and
receipts, **Instrument Serif** for display accents. All OFL, self-hosted in
`assets/fonts/` — no CDN at demo time.
Egoist's own component idiom to follow: pill buttons (`border-radius:999px`), primary
`#111213` on `#fafaf7`, deny-styled text buttons hovering to `#b3261e` on `#fbf3f2`,
34px rounded step badges, `52ch` body measure, generous whitespace, tight display
tracking, no gradients-for-drama.
Reproduce the EGOIST wordmark **typographically** (Geist 700, tracking -.075em); draw our
own mark inline as SVG. Do not vendor or hotlink ego.ist's logo/passport assets.
Nomenclature to reuse: "AI Passport · Vault", "scoped request", "audit receipts",
"Private by default".

## Persona
The creator is **Robin Swift**, a fictional persona; they/them.
**Never use "Juno Kade"** — that is a real Egoist persona from ego.ist's landing page.

## Model rules
- **Platform connectors are visual/media platforms only.** Shutterstock, Getty, Behance,
  Dribbble, Pinterest — no Substack or other text/newsletter platforms. The product is
  scoped to creative-image licensing, not general content distribution.
- **Platform connectors are multi-select.** A creator can connect to several publishing
  platforms at once (e.g. Behance + Dribbble + Pinterest + Shutterstock simultaneously)
  and one upload registers the fingerprint for all of them in a single call. This is a
  deliberate illustration of the core claim: the fingerprint is content-derived and
  platform-agnostic, so one work publishing to N platforms still yields exactly ONE
  registry pointer (the existing Hamming de-dupe in `registerFingerprint` already
  guarantees this). Which platforms were involved is UI/API-log flavor only — it is
  never written into the registry entry itself.
- **Policy is fingerprint-bound, never per-platform.** Explained in-UI (the "why one
  policy, not one per platform" note box in the Platform lens): a verifier checking a
  stripped/reposted copy has no trustworthy way to know which platform it came from, so
  per-platform terms would depend on an unverifiable claim about origin. One fingerprint,
  one live policy, everywhere it's checked.
- **No territory.** Not in the policy, the form, the response scope, or the decision engine.
- **No `revoked` flag and no revoke button.** Revocation is performed by *changing the
  standing policy* — flipping AI training `allowed → denied`, or narrowing the use scope
  (e.g. dropping `print`/`commercial` to leave `web` only). Same dial, no kill switch.
- **The resolver stores `fingerprint → policyRef` and nothing else.** Never the policy,
  never the image, never the holder's name. Resolution is a live lookup through the
  pointer. Never snapshot a policy into a registry entry.
- **The perceptual hash must stay real** (DCT pHash in-browser). Never key a match on
  filename or any stored association.

## Constraint
Must be served over HTTP (`python3 -m http.server 8080`). Under `file://` Chrome taints
the canvas after drawing a `file://` image, so `getImageData` throws and pHash of the
bundled samples fails.
