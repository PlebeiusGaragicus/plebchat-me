# Proposal: Read Mode

**Status:** Draft · **Last updated:** 2026-07-12

## Summary

A local-first reader: import EPUBs, read with per-device display settings, highlight and annotate, and sync everything — encrypted to yourself — over nostr. A direct port of the **vibereader** proof of concept into PlebChat's shell.

## Motivation

Reading is the input side of PlebChat's knowledge loop: books and documents read here become sources for Search, Synthesize, and Debate. vibereader already proved the full stack (epub.js rendering, annotation model, nostr sync contract); Read mode brings it in rather than reinventing it.

## Design

Port vibereader's architecture wholesale, adapted to live under `/read`:

- **EPUB engine**: a single module wrapping epub.js (`Book`/`Rendition`/`EpubCFI`), kept as plain module state (not `$state` — epub.js proxies break under runes reactivity). Reading themes (light/dark/sepia) apply inside the epub iframe, independent of app chrome.
- **Storage**: per-npub IndexedDB; book files also pushed to Blossom for cross-device access.
- **Annotations**: one unified highlight+note primitive whose stored records mirror the nostr event content 1:1.
- **Nostr event model** (vibereader's `docs/nostr-event-model.md` is the binding contract):
    - `30101` book metadata · `30102` reading progress · `30103` reader settings · `30104` annotation — all NIP-44 self-encrypted addressable events
    - Sharing = republishing the same `30104` in plaintext; **NIP-84 kind `9802`** highlight exported at share time for interop (highlighter.com et al.)
    - NIP-73 ISBN tags for cross-edition identity; Blossom kinds `10063`/`24242` for blobs

### Reference material

- vibereader `src/lib/epub/service.ts` (engine), `src/lib/stores/annotations.svelte.ts`, `src/lib/nostr/{kinds,events}.ts`, `docs/nostr-event-model.md`
- SvelteReader `frontend/src/lib/components/reader/` — richer reader panel UI (ToC, annotations, settings panels)
- Spec: `nips/84.md` (highlights), `nips/73.md` (external content ids)

## Open questions

- **Scope creep vs. port**: vibereader is a working app — is Read mode v1 literally its code moved in, or a re-implementation trimmed to essentials? (Recommendation: move the code, trim after.)
- **PDF support**: SvelteReader had pdfjs; vibereader dropped it. Defer?
- **Namespace**: do we keep vibereader's kinds 30101–30104 verbatim (interop with existing events) or mint PlebChat kinds? Keeping them means a vibereader user's library appears in PlebChat automatically — probably desirable.

## Progress

- [ ] Decide port-vs-reimplement and kind namespace
- [ ] EPUB engine + import under `/read`
- [ ] Library grid + reader view + display settings
- [ ] Annotations (create, list, colors, notes)
- [ ] Nostr sync (30101–30104, NIP-44)
- [ ] Blossom book-file upload
- [ ] NIP-84 share flow
- [ ] Playwright e2e (import fixture EPUB, annotate, reload persistence)
