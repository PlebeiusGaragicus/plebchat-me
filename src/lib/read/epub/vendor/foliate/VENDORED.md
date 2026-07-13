# Vendored: foliate-js

- Upstream: https://github.com/johnfactotum/foliate-js (MIT — see LICENSE)
- Pinned commit: `78914aef4466eb960965702401634c2cb348e9b1` (vendored 2026-07-13)
- Ships as source ESM (no npm package) — same pattern as cyphertap's vendored
  negentropy. To bump: fresh clone, re-copy the files below, re-apply the
  local patches, update this commit hash. Patches needed upstream should go
  upstream first.

## Files

`view.js`, `epubcfi.js`, `progress.js`, `overlayer.js`, `text-walker.js`,
`paginator.js`, `fixed-layout.js`, `epub.js`, `comic-book.js`, `fb2.js`,
`mobi.js`, `search.js`, `tts.js`, `vendor/zip.js`, `vendor/fflate.js`.

## Local patches (re-apply on bump)

1. **Open shadow roots** — `view.js`, `paginator.js`, `fixed-layout.js`:
   `attachShadow({ mode: 'closed' })` → `mode: 'open'`. Playwright cannot
   pierce closed shadow roots, and the e2e suite (the renderer-swap
   acceptance gate) must reach the section iframes.
2. **`pdf.js` replaced with a stub** — upstream's imports a ~13 MB pdfjs
   build; PDF support is deferred (read-mode proposal Phase 9).
3. **`paginator.js` `goTo` waits out `#locked`** (bounded, 3 s) instead of
   silently dropping the call — a navigation issued during a page-turn
   animation (e.g. a TOC click right after paginating) must still land.
   Candidate for an upstream PR.

## Type checking

These files are plain JS and are not type-checked (`checkJs: false` in
tsconfig.json — all first-party code is TS, so nothing else is affected).
The typed surface lives in `../service.ts`, the only importer.
