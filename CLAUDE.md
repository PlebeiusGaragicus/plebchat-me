# PlebChat (plebchat.me)

Greenfield build of **PlebChat** — a client-only, nostr-native web app with four **modes**: **Read**, **Search**, **Synthesize**, and **Debate**. Each mode is a mini-app behind one shared shell (top bar, mode switcher, cyphertap login/wallet). No backend: static SPA built and deployed via GitHub Pages.

This file is primarily a **map of the reference repos** that define what we're building. Read the relevant reference before designing or implementing a feature — don't work from memory.

Also relevant: `/Users/satoshi/Downloads/nostr-repos/CLAUDE.md` is the protocol reference library (NIPs, NUTs, Blossom specs, and best-in-class nostr/cashu implementations). Start there for any *protocol* question; start below for any *product/UI* question.

## Reference repo map

| Repo | Path | Why it's the reference |
|---|---|---|
| **SvelteReader** | `/Users/satoshi/Downloads/VIBE-CODE/SvelteReader` | **Main reference — UI layout, style, and the "modes" concept.** Old PoC; model PlebChat's look and feel from its `frontend/` app. Its backend/LangGraph services are what we deliberately drop. |
| **nostr-ecash-ecosystem** | `/Users/satoshi/Downloads/nostr-repos/my-projects` | Home of the **cyphertap** component (keys, ecash wallet, relays) and two demo apps showing how to embed it. |
| **PiChessBrowser** | `/Users/satoshi/Downloads/pi-web-apps/PiChessBrowser` | Proof that the **pi coding agent** can run in a client-only web app (ReAct-style loop, BYO endpoint/key). Possibly a poor example, but it demonstrates feasibility — the contrast to over-engineered pre-defined-graph frameworks like LangGraph. |
| **2026-project** (homelab) | `/Users/satoshi/Downloads/2026-project` | Hosts our strfry relay `wss://relay.abvstudio.net` — our test relay and the app's default relay. |
| **vibereader** | `/Users/satoshi/Downloads/nostr-repos/vibereader` | PoC for PlebChat's **Read** mode (EPUB reading, highlights, NIP-84, nostr event model). Also the pattern for our MkDocs docs site and Pages CI. |
| **socratic-seminar** | `/Users/satoshi/Downloads/nostr-repos/socratic-seminar` | Becomes the **Debate** mode. Defines the "Socratic Seminar" schema and the in-browser pi-agent flow. Its `docs/PHILOSOPHY.md` is the binding design contract for nostr-ecosystem apps. |

## Concept → code map

### UI shell, theming, and modes (SvelteReader — main reference)
The app to study is `SvelteReader/frontend/` (Svelte 5 runes + SvelteKit 2, Vite, Tailwind v4 via `@tailwindcss/vite`, bits-ui, Lucide icons, mode-watcher dark/light, svelte-sonner toasts).
- **Modes concept**: `frontend/src/lib/stores/mode.svelte.ts` (`AppMode`, localStorage-persisted, `{id,name,description,icon,route}` per mode) + `frontend/src/lib/components/ModeSelector.svelte` (bits-ui Popover in the TopBar). Design doc: `docs/core-design/modes.md` (slightly stale). PlebChat's modes are Read / Search / Synthesize / Debate — SvelteReader's `reader`/`deepresearch`/`synthesize` are the direct ancestors.
- **Shell**: `frontend/src/routes/+layout.svelte` (ModeWatcher `defaultMode="dark"`, Toaster, TopBar) + `frontend/src/lib/components/TopBar.svelte` (h-14: logo + ModeSelector left; `<Cyphertap>` login + sync status right).
- **Design tokens**: `frontend/src/app.css` — Tailwind v4 `@theme` block, shadcn-style OKLCH token set (`--background`, `--card`, `--primary`, … `--radius: 0.5rem`), `:root`/`.dark`, Inter font. Note it mixes semantic tokens with hardcoded zinc/violet in newer synthesize views — prefer the semantic tokens.
- **Multi-pane workspace (strongest layout reference)**: `frontend/src/lib/components/synthesize/WorkspaceLayout.svelte` — collapsible drag-resize left sidebar (180–400px) + two tabbed columns with draggable divider; tabs render chat / markdown editor / source viewer via snippets. Reader-mode panels: `frontend/src/lib/components/reader/` (TocPanel, AnnotationsPanel, SettingsPanel…).
- **Routing**: file-based under `frontend/src/routes/` — `/` mode-select welcome, `/reader`, `/book/[id]`, `/deepresearch`, `/synthesize/[id]`.

### Cyphertap embedding (nostr-ecash-ecosystem)
pnpm monorepo; `cyphertap/` is a git submodule (github.com/PlebeiusGaragicus/cyphertap, v0.0.36), consumed **from source** (`exports` → `src/lib/index.ts`, no build step) either as a workspace package or as a submodule in an external app repo — the submodule pattern is the canonical end-state and likely ours.
- **How to embed**: `cyphertap/docs/CONSUMING.md` (patterns A/B, Vite `server.fs.allow`, required styles import). Minimal example: `apps/demo/src/routes/+layout.svelte` (`import 'cyphertap/styles.css'`) + `+page.svelte` (`<Cyphertap relays={...} mints={...}/>`).
- **Programmatic API**: `cyphertap/src/lib/api/cyphertap-api.svelte.ts` — singleton `cyphertap`: reactive `isLoggedIn/balance/npub`; `signEvent`, `encrypt/decrypt` (NIP-44); Lightning + ecash send/receive; `publishEvent`, `subscribe/subscribeLatest`, `fetchEvents`, `getFollows`, `getRelayList` (NIP-65). Barrel: `cyphertap/src/lib/index.ts` (`Cyphertap`, `cyphertap`, `configure`, `getNDK`).
- **Realistic consumer**: `apps/fren-feed/src/` — app lifecycle driven off `cyphertap.isLoggedIn` in `$effect` (`routes/+layout.svelte`), nostr logic in `lib/nostr/`.
- **Invariants**: NDK pinned via `overrides` in `pnpm-workspace.yaml` (`@nostr-dev-kit/ndk 2.15.2`) — keep in sync with cyphertap's own. Contributor rules: root `CLAUDE.md` there.
- **Caveats**: HOT KEYS — cyphertap stores raw hex keys unencrypted in localStorage ("treat wallets as pocket money"; `cyphertap/docs/TECH-DEBT.md` #1). Default mint is fake testnut ecash. NIP-04 (not 44) in one legacy API path.

### In-browser pi agent (PiChessBrowser + socratic-seminar)
Two implementations of the same pattern: pi's ReAct loop (`@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`, both 0.80.6) running entirely in the browser against a user-configured, CORS-enabled LLM endpoint; key lives only in localStorage; app stays authoritative over state.
- **Minimal/instructive (PiChessBrowser)**: `src/ai/piPlayer.ts` — `buildModel()` (openai-completions or anthropic-messages flavors), `AgentTool`s with `Type.Object` schemas, fresh `Agent` per turn under an abort timeout, success verified by state diff (never prose parsing), bounded repair retries. Settings/keys: `src/ai/settings.ts`. Orchestration without a server: `src/localMatch.ts`.
- **Production-shaped (socratic-seminar — closer to what PlebChat needs)**: `src/lib/agent/runner.svelte.ts` (one Agent per thread, reactive `$state` mirror, `PendingInteraction` for ask_user/choices/approval, approval-gated `patch_file`), `agent/model.ts` (BYO endpoint), `agent/prompt.ts` (capability-gated persona), `agent/tools/` (files/sources/context/clarify/todos/think), `agent/persistence.ts` + `pruning.ts` (transcript save/sanitize/context management).

### Read mode (vibereader)
Same scaffold as ours (SvelteKit 2/Svelte 5/Tailwind 4, static adapter, cyphertap submodule, per-npub IndexedDB).
- **EPUB engine**: `src/lib/epub/service.ts` (sole epub.js wrapper — Book/Rendition/CFI, reading settings, highlight colors; deliberately plain module state, not `$state`, so epub.js proxies don't break) + `epub/import.ts`; UI in `src/lib/components/reader/` (`EpubViewer.svelte`, toolbar, ToC, annotation sidebar).
- **Annotations**: `src/lib/stores/annotations.svelte.ts` (records mirror kind-30104 content 1:1), `foreignAnnotations.svelte.ts`.
- **Nostr event model (the keeper)**: `docs/nostr-event-model.md` — binding sync contract. Kinds in `src/lib/nostr/kinds.ts`: 30101 book / 30102 progress / 30103 settings / 30104 annotation (NIP-44 self-encrypted; sharing = republishing plaintext), 9802 NIP-84 highlight export (`src/lib/nostr/events.ts`), NIP-73 ISBN tags, Blossom 10063/24242.

### Debate mode (socratic-seminar)
- **The "Socratic Seminar" schema** is a markdown convention kept in sync in two places: `src/lib/templates.ts` (`FILE_TEMPLATES` "Socratic Seminar": Thesis/Abstract → Supporting Clauses (definitions + evidence, narrative) → Argument → Refutation) and `src/lib/agent/prompt.ts` (`PERSONA`: Thesis → Supporting Clauses → Refutations → Replies, `[[Title]]` citations).
- **Data model**: `src/lib/db/types.ts` — per-npub IndexedDB (`socratic-seminar::<npub>`): `Project`, `Thread`, `Artifact`+`ArtifactVersion` (versioned markdown), `TranscriptRecord` (verbatim pi messages), `Source`/`Bibliography`. The seminar is a versioned Artifact; the debate is the agent Thread that edits it.
- **Status caveat**: local-first only — nostr is identity-only there today; no event kinds defined yet for projects/artifacts/threads (open question: NIP-78 kind 30078 vs custom addressable kinds).
- **Philosophy (binding)**: `docs/PHILOSOPHY.md` — the six-principle "nostr-ecosystem app" contract (web-first/no backend, relays as filesystem, browser as local-first primary store, keypair-only identity, bitcoin-only payments, sovereign in-browser AI). Principles win over features; edit the doc first to change one.

### Default relay (2026-project homelab)
`wss://relay.abvstudio.net` — strfry 1.0.4 in Docker on the Mac Mini, Caddy TLS on the VPS.
- Key files: `MAC_MINI/strfry/strfry.conf`, `docker-compose.yml`, `plugins/whitelist.sh`, `purge-old-events.sh`; `VPS_SERVER/Caddy/Caddyfile` (relay block ~line 171); authoritative docs: `docs/strfry.md`.
- **Constraints to design around**: writes are **pubkey-whitelisted** (runtime lists in host `~/.strfry/whitelist.d/*.txt`; hex pubkeys, effective immediately) — a freshly generated key will be rejected by design; use the pre-whitelisted test accounts (gitignored `.test-accounts.json` in nostr-ecash-ecosystem root). The test accounts carry demo data (kind 0 profiles, mutual kind 3 follows, one shared + Blossom-backed public-domain book with shared annotations each) — reseed with `scripts/seed-test-profiles.sh` + `SEED=1 npx playwright test e2e/seed-friends.test.ts` after the 60-day purge eats it. Kind 1059 gift wraps are always accepted. Reads are open; no NIP-42. Ingest rejects events older than 3 days; cron purges >60 days — **not durable storage**. No blossom server in the homelab yet (known gap).

### Project conventions borrowed from the references
- **MkDocs user docs**: copy vibereader's pattern — `mkdocs.yml` (material theme), `docs/`, `docs-requirements.txt`; `deploy.yml` builds the SPA then `mkdocs build --strict -d build/docs` so docs ship inside the same Pages artifact at `/docs/`.
- **CI/Pages**: vibereader `.github/workflows/ci.yml` (check + build + `mkdocs build --strict`) and `deploy.yml` (recursive submodule checkout for cyphertap, `BASE_PATH`, upload-pages-artifact).
- **Playwright e2e**: SvelteReader `frontend/playwright.config.ts` (chromium, dev-server webServer, trace/screenshot on failure) + `frontend/e2e/*.test.ts`; minimal variant in `vibereader/cyphertap/playwright.config.ts` (preview-server based).

## Read-mode gotchas (hard-won under epub.js and foliate — do not relearn)

- The renderer is **vendored foliate-js** (`src/lib/read/epub/vendor/foliate/`, pinned commit + local patches in `VENDORED.md`: open shadow roots for Playwright, pdf.js stub, paginator `goTo` waits out its navigation lock instead of dropping). Bump via fresh copy + re-apply patches.
- **foliate relocates for non-navigation reasons** (resize, style application, anchor scrolls). `service.ts` dedupes by CFI before forwarding — consumers treat relocate as "the page turned" (progress save, selection clearing), and un-deduped relocates detach the annotation context menu mid-interaction.
- **foliate parses XHTML strictly** (real XML). Malformed section markup renders only up to the first error — epub.js was lenient. Affects hand-built fixtures.
- **Never sort CFIs lexically**; use `epub.compareCfi` (`CFI.compare`). Annotation positions are standard EPUB CFI strings — epub.js-era data (relay events from vibereader) resolves under foliate; verified with real annotations.
- Live book/view objects are **plain module state in `src/lib/read/epub/service.ts`, never `$state`** — runes proxies break them. That file is the ONLY renderer contact; the exported contract survived a full renderer swap, keep it that way.
- `annotations.applyToRendition()` still gates on first render (contract kept from the epub.js era; harmless under foliate, and the marks map must be populated before `create-overlay` replays).
- ONE canonical camelCase data shape everywhere (`src/lib/db/types.ts` mirrors the nostr event content 1:1).
- Blob stores (`bookFiles`, `covers`) use **raw put** — the JSON `clone()` used for `$state`-stripping destroys Blobs.
- Reading theme (light/dark/sepia inside the book iframe, `rendition.themes`) is independent of app chrome theme (mode-watcher). Don't couple them.
- The `?book=` deep-link mirror in `/read/+page.svelte` must stay gated on `handledInitialUrl` — the mount-time mirror otherwise erases the param before it's read.
- **Blossom auth is STANDARD base64**, not the BUD-11 spec's base64url — deployed servers (nostr.download, nak) reject the url-safe form. `$lib/nostr/blossom.ts` follows the ecosystem.
- Most public Blossom servers are useless for EPUBs: primal/v0l block browser CORS on /upload; band/nostrcheck/f7z reject `application/epub+zip`. nostr.download is the only working public default (verified 2026-07); self-hosting is the recommended path.
- The BUD-06 upload preflight is advisory — only an explicit 413 blocks an upload (nostr.download 400s the HEAD but accepts the PUT).
- cyphertap's `publishEvent` can surface an async `NDKPublishError` ("0 published, 1 required") as an unhandled rejection when a pool relay rejects — benign: the event lands in cyphertap's unpublished-events cache and retries.
- All relay/Blossom use is behind **explicit user actions** — no background sync, no timers. LWW merges by content `updatedAt` (never relay `created_at`); tombstones prevent resurrection.
- Multi-tab is out of scope for v1: two tabs on one DB can clobber progress/annotations last-write-wins.
- Toasts live bottom-right: top-right stacks sit exactly over mode toolbars and intercept clicks while visible (found via the sync gate — sonner also pauses dismiss timers in backgrounded tabs).

## Working agreements

- **Feature proposals**: maintain thorough plan documents at `docs/proposals/<feature-plan-slug>.md` so features can be considered, designed, reviewed, and tweaked before implementation. Update each proposal as it's built out — they track progress across chat sessions.
- **Git**: commit and push directly to `master` until the MVP exists; then switch to feature branches + PRs. Claude owns commit messages, release tags, and CI.
- **Testing**: Playwright e2e like the reference repos — Claude uses it to verify its own changes actually work.
- **User docs**: maintain an MkDocs `docs/` dir hosted with the app (vibereader pattern) serving as about/help/docs for users.

## Nostr philosophy

- Relays and Blossom servers replace a platform-owned cloud with user accounts; users are anonymous keypairs in control of their keys, privacy settings, and data. Cyphertap is the reusable component enabling that user-empowerment.
- Follow NIPs and play nice with other clients (e.g. highlighter.com for NIP-84 highlights).
- The full contract is `socratic-seminar/docs/PHILOSOPHY.md`; the protocol specs live in the reference library (`/Users/satoshi/Downloads/nostr-repos/`: `nips/`, `nuts/`, `blossom/`).

## Self-hosted encouragement

- Client-side only, no server required — buildable and deployable via GitHub Pages.
- A payments backend (pay-per-use LLM inference, web search, storage) is imaginable but beyond the initial build-out. Users bring their own keys/endpoints for now, but architect with the pay-per-use case in mind (see socratic-seminar's metering seam at the agent's `afterToolCall`).
