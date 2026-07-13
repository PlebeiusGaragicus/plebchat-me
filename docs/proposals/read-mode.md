# Proposal: Read Mode

**Status:** Implemented (Phases 0–8; PDF support deferred to its own proposal) · **Last updated:** 2026-07-13

## Summary

A local-first reader: import EPUBs, read with per-book display settings, highlight and annotate, chat with an AI companion about passages, and sync everything — encrypted to yourself — over nostr, with Blossom file backup and social reading (public shelves, browsing friends' libraries, foreign-highlight overlays).

Built by **porting vibereader** (the complete, live, two-profile-verified app — not a rough PoC) into PlebChat's shell, then **swapping the renderer to foliate-js** (the library Readest uses; epub.js is abandonware), then adopting two SvelteReader features. PlebChat **supersedes** vibereader, which freezes as reference; this repo now owns the protocol contract ([Nostr Event Model](../nostr-event-model.md)).

## Decisions (2026-07-13)

1. **Port first, swap renderer second.** vibereader's code lands with its epub.js seam intact (proven, e2e-verifiable), then foliate-js replaces it as a contained step — the seam is two files (`epub/service.ts`, `epub/import.ts`) and the Phase 3 e2e suite is the swap's acceptance gate.
2. **SvelteReader adoptions**: chapter-segmented progress bar; chat-threads-linked-to-annotations. **Not adopted**: client-side embeddings (different strategy planned); its PDF/files subsystem (prototype-grade — PDF support is a deferred phase with its own design).
3. **Protocol continuity**: kinds 30101–30104 and the `vibereader` settings d-tag kept verbatim — both apps share the plebchat.me origin and relay data, so existing libraries appear on first sync. Accepted quirk: both live apps LWW the same 30103 settings event; a d-tag migration is documented as PlebChat's first owned protocol change (not built).
4. **AI chat ports as-is** (BYO endpoint, device-local threads, `// PAYMENTS:` seam intact).

### Architecture decisions

- **Routing**: vibereader's `ui.view` switching (`library | reader | ghost | browse`) stays inside `/read/+page.svelte` — no subroute split (stores/reader lifecycle were built for single-page switching). Deep links via query params (`/read?book=<sha>`, `/read?view=browse`) mirrored with `replaceState`. Vibereader's own header dissolves: Sync/Browse/Settings/Import become a mode toolbar under the shared TopBar; a new shell-level `immersive` flag hides the TopBar in reader/ghost views.
- **Session & storage**: mode-agnostic `$lib/session` (cyphertap login → per-npub DB) with a start/stop hook registry; **fresh DB `plebchat::<npub>`**, one DB for all modes. Not inheriting `vibereader::<npub>` — two live apps sharing a DB with divergent version counters is a corruption vector; relay sync repopulates everything except book-file Blobs, and a one-time **migration assistant** (same origin — the old DB is reachable) offers to copy `bookFiles`/`covers` Blobs across.
- **Theming translation** (mechanical, at port time): `amber-500/600` accents → `primary` · zinc borders → `border` · `zinc-500/400` text → `muted-foreground` · zinc hover fills → `accent` · `zinc-50/900` surfaces → `background`/`card`. Kept literal: the annotation highlight palette (user data, mirrors 30104 content) and reading themes inside the epub iframe (independent of app chrome theme by design).
- **Chat-on-annotations (Phase 8) inverts SvelteReader's design**: optional `annotationId` on the device-local `ChatThread` record — not thread ids on the annotation, because annotation records mirror 30104 content 1:1 and chats never sync; SvelteReader's shape would be a silent protocol change.

## Phases

- [x] Phase 0 — Contract & docs: event model moved here with ownership header; this proposal rewritten; mkdocs nav.
- [x] Phase 1 — Shared foundations: deps (`epubjs`, `idb`, `nanoid`; `jszip` dev), `$lib/db` (`plebchat::<npub>` v1, eager open at login), `$lib/session` + root-layout bridge, `$lib/stores/settings` (`plebchat-settings` key), shell `immersive` store + TopBar hide. Verified: headless `ncrypt` login smoke creates `plebchat::<npub>`.
- [x] Phase 2 — Reader core under `/read`: epub service/import, read stores (sync/chat/foreign as interface stubs), library + reader components (theme-translated), view switch + toolbar + `?book=` deep links + immersive, CLAUDE.md gotchas batch 1. Verified: 9-step headless flow (import → render → ToC → highlight → deep-link → reload resume → annotation persistence). The jszip fixture builder works against epub.js — Phase 3 risk retired.
- [x] Phase 3 — Playwright suite (permanent acceptance harness + foliate-swap gate): `e2e/fixtures/epub.ts` (jszip generated EPUB3, seed-parameterized), `e2e/helpers.ts` (`ncrypt` login = fresh identity/DB per test, iframe text selection), `e2e/read.test.ts` — 14 tests: logged-out gate · import→card · sha256 dedup · two distinct books · open/paginate/ToC · reading-theme in iframe · progress resume + deep-link mirror · spine-sorted highlights across chapters · note add/edit · annotation delete · annotations survive reload · cascade delete · settings persist · immersive TopBar. All green twice locally (zero flakes); chat-panel test lands with Phase 4.
- [x] Phase 4 — AI chat: `$lib/ai/client.ts` (verbatim from vibereader — SSE + single-shot fallback, `// PAYMENTS:` seam), reading-companion prompt, chat store, ChatPanel; chat toggle and "Chat about this" restored in toolbar/context menu. e2e: unconfigured-state pitch + full mocked-endpoint roundtrip (selection context → user message → assistant reply). Live SSE streaming not re-verified in the port — the client file is byte-identical to vibereader's battle-tested one; verify once against a real BYO endpoint at the Phase-5 manual gate.
- [x] Phase 5 — Sync + Blossom + sharing: nostr codecs/sync engine verbatim, Sync toolbar button + dirty dot, per-book Blossom backup/restore + availability probe, public-shelf toggle, annotation sharing (plaintext 30104 + optional NIP-84 9802), **vibereader→plebchat migration assistant** (full-DB copy, not just Blobs — covers never-synced vibereader users; offered via toast, e2e-tested), gotchas batch 2. **Live two-profile gate executed headlessly against relay.abvstudio.net + nostr.download (2026-07-13), all steps green**: alice imports/annotates/backs-up/syncs on profile 1 → clean profile 2 pulls library (ghost card), annotation count arrives, restores the file hash-verified from Blossom, opens with the annotation live, deletes + syncs → tombstone removes the book back on profile 1. **Decision-3 acceptance proven**: profile 2's first sync also pulled "Alice's Adventures in Wonderland" — a real vibereader-era book (with reading progress) appearing in PlebChat automatically.
- [x] Phase 6 — Social reading: browse store/view (npub input + follows picker + readers-of-book), GhostView (read-only annotations without the file, restore-and-open), foreign-highlight overlays (explicit fetch, per-reader toggle, dashed underlines), "Find readers" in the info dialog, `?view=browse` deep link. **Live two-identity gate executed (2026-07-13), all steps green**: alice imports → backs up → shares book + annotation → syncs; bob browses her npub, sees the shelf + public annotation, downloads the book from her Blossom pointer (hash-verified), and toggles her highlights as an overlay in his own reader.
- [x] Phase 7 — foliate-js swap: vendored at commit `78914ae` (`src/lib/read/epub/vendor/foliate/`, local patches in VENDORED.md — open shadow roots for Playwright, pdf.js stub in place of the 13 MB pdfjs, paginator `goTo` waits out its lock instead of dropping); `service.ts`/`import.ts` rewritten against the unchanged contract; `epubjs` dropped; import accepts `.epub/.mobi/.azw(3)/.fb2/.fbz/.cbz`; locations cache obsolete (foliate's relocate carries `fraction` natively — `ensureLocations` is now a no-op). Two behavioral fixes surfaced by the gate: paginator lock-dropping (patched) and non-navigation relocates clearing the selection (deduped by CFI in service.ts). **Gates green (2026-07-13)**: all 22 e2e tests pass with assertions unchanged (only the helpers' iframe lookup adapted to shadow DOM); live compat gate — the vibereader-era Wonderland book restored from Blossom, opened under foliate, **resumed at 3% from an epub.js-generated progress CFI, and rendered 5 annotations created under epub.js in vibereader**.
- [x] Phase 8 — Adoptions: chapter-segmented ProgressBar built directly on foliate's native `getSectionFractions()` (clickable per-section segments with ToC-label tooltips + current-position marker — no locations math needed); chat-on-annotations via optional `annotationId` on the device-local ChatThread (inverted from SvelteReader's design — no protocol change; no DB version bump either: an optional field needs no new store/index). Discuss affordance on annotation cards (reopens the same thread), linked-thread indicator in the chat list; empty threads stay ephemeral, a first message persists the link. e2e: 24 tests green (segments render + navigate; link survives reload; same thread reopens).
- [ ] Phase 9 (deferred) — PDF/files support: own proposal needed; SvelteReader's implementation is reference-only.

Each phase is one reviewable commit to master (Phase 2 may split into two), gated on `pnpm check` + `pnpm build` + full Playwright suite; `BASE_PATH=/plebchat-me pnpm build && pnpm preview` smoke before Phases 2, 5, 7.

## Manual verification checklist (not CI-testable)

Sync/Blossom/browse need the pubkey-whitelisted relay (`relay.abvstudio.net`) and a Blossom server — CI can't reach them, so these are verified manually per phase with the alice/bob test accounts (`../my-projects/.test-accounts.json`), matching vibereader's Phase D/E precedent:

1. **Phase 5**: alice imports + annotates + syncs → bob-as-alice on a second profile pulls the library; tombstone propagation; Blossom backup → wipe → restore. **Decision-3 acceptance**: an existing vibereader identity logs into PlebChat → first sync populates the library; migration assistant recovers file Blobs.
2. **Phase 6**: alice shares book + annotations → bob browses alice's shelf → downloads the book from her Blossom pointer (sha-verified) → foreign-highlight overlay toggles in bob's reader.
3. **Phase 7**: annotations created pre-swap (incl. relay-synced ones) render correctly under foliate.

## Reference material

- vibereader — the source of the port: `src/lib/{db,epub,stores,nostr,ai}/`, `src/routes/+page.svelte`; its `CLAUDE.md` gotcha list migrates here as phases land; `proposals.md` #2 is the accepted foliate-js plan (risks, vendoring, CFI compatibility).
- SvelteReader `frontend/src/lib/components/reader/ProgressBar.svelte` + `epubService.getChapterPositions` (Phase 8); its annotation/chat-thread linkage (inverted here).
- foliate-js: github.com/johnfactotum/foliate-js — read Readest as the reference consumer.
- Specs: `nips/84.md`, `nips/73.md`, `nips/44.md`, `nips/09.md`; Blossom BUD-01/02/03/06/11 (standard-base64 auth quirk documented in the event model).

## Open questions

- Settings d-tag migration (`vibereader` → `plebchat`) timing — after vibereader usage ends.
- Local ephemeral relay (e.g. `nak serve`) in CI to make sync testable — revisit after Phase 5.
- PDF/files design (Phase 9) — needs its own proposal before any code.
