# Coathook — Egoist Ideathon Demo

## Sources of truth
- `build-spec.md` is authoritative for flow, architecture, data model, and honest labeling.
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
