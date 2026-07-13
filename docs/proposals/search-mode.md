# Proposal: Search Mode

**Status:** In progress · **Last updated:** 2026-07-13

## Summary

An in-browser research agent: ask a question, the agent searches and reads sources, and returns a cited answer in a chat UI. Successor to SvelteReader's "Deep Research" mode — but running the **pi agent loop client-side** instead of LangGraph on a server.

## Motivation

SvelteReader's deepresearch mode proved the product shape (research chat with citations) but its LangGraph backend violates the no-server principle. PiChessBrowser and socratic-seminar prove the replacement: pi's ReAct loop runs fine in the browser against a user-configured, CORS-enabled LLM endpoint.

Search is also the cheapest vehicle for the **shared agent runtime** that Synthesize and Debate need: a single chat surface, simple self-contained tools, no workspace layout or approval gates. The runtime lands mode-agnostic in `$lib/ai/` with Search as its first consumer.

## Decisions

- **Web search/fetch backend: Firecrawl** (decided 2026-07-13). `api.firecrawl.dev` serves `access-control-allow-origin: *` (verified by preflight), so browser calls work with a user-supplied key — no proxy needed. `/v2/search` covers `web_search`; `/v2/scrape` (markdown, `onlyMainContent`) covers `fetch_page`, including pages that block cross-origin fetch, since Firecrawl does the fetching. More providers (Brave, Tavily, self-hosted SearXNG) can slot in later behind the same tool interface — the settings UI keys the provider choice.
- **nostr_search transport**: one-shot raw-WebSocket REQ against a NIP-50 relay (default `wss://relay.nostr.band`). Cyphertap's pool doesn't include a search relay, and a ~40-line raw-WS client avoids coupling the app to NDK internals (precedent: cyphertap's own raw-WS negentropy sync). Works logged-out-of-Firecrawl — the mode is usable with zero third-party keys.
- **Sources are recorded by the tools, not the model**: every `web_search` result and every fetched/searched page lands in the thread's source list with a stable id (`s1`, `s2`, …) as a side effect of tool execution. The prompt instructs the agent to cite `[s1]`-style markers; the UI links markers to the sources panel. The app-authoritative record is the tool-built source list (PiChessBrowser's verify-by-state lesson) — prose citations are presentation only.
- **Threads are device-local** in the per-npub IndexedDB (DB v2 adds `searchThreads`), matching Read mode's chat-thread stance: transcripts stay outside the sync schema.
- **Agent runtime is mode-agnostic** (`$lib/ai/model.ts`, `$lib/ai/runner.svelte.ts`): model builder for `openai-completions` / `anthropic-messages` flavors, per-thread runner with a reactive `$state` mirror, tool helper types. Search-specific code (tools, prompt, stores, UI) lives in `$lib/search/`.
- **Settings**: `AiSettings` gains `api` (wire-protocol flavor, default `openai-completions`); a new `search.firecrawlApiKey` field gates the Firecrawl tools (absent key ⇒ agent runs with `nostr_search` only and says so). All localStorage, never synced, `.env`-prefillable in dev like the existing AI fields.

## Design

- **Agent runtime**: `@earendil-works/pi-agent-core` + `@earendil-works/pi-ai` (0.80.6, pinned like the references), one agent per research thread. BYO endpoint/key/model; settings in localStorage — socratic-seminar's `agent/model.ts` + PiChessBrowser's `ai/settings.ts` pattern.
- **Tools**:
    - `web_search(query, limit?)` — Firecrawl `/v2/search`, returns titles/urls/descriptions, records sources
    - `fetch_page(url)` — Firecrawl `/v2/scrape` → markdown (truncated to a token budget), records the source
    - `nostr_search(query, kinds?, limit?)` — NIP-50 REQ over raw WS, returns matching events (notes, long-form), records `nostr:` sources
- **UI**: `/search` — thread list + chat with streaming assistant text, inline tool-call cards (name, args, status, result summary), sources panel with citation anchors; settings gate mirroring Read's ChatPanel pitch.
- **Pay-per-use anticipation**: unchanged — the `// PAYMENTS:` seam. Firecrawl metering would hook the same place as inference metering when a payments backend exists.

### Reference material

- SvelteReader `frontend/src/lib/components/deepresearch/` + `frontend/src/routes/deepresearch/` — target UX
- socratic-seminar `src/lib/agent/` — runner, model builder, tool patterns, persistence/pruning
- PiChessBrowser `src/ai/piPlayer.ts` — minimal loop, timeout/repair/verify-by-state-diff patterns
- Firecrawl API: `POST /v2/search` (`{query, limit, sources}` → `data.web[{title,description,url}]`), `POST /v2/scrape` (`{url, formats:["markdown"], onlyMainContent}` → `data.markdown` + `data.metadata`)
- Spec: `nips/50.md` (search capability)

## Open questions

- **More search providers**: Brave / Tavily / self-hosted SearXNG behind a provider picker — deferred; the tool interface is provider-agnostic.
- **Cross-mode sources**: `read_source` pulling sources saved by other modes — deferred to the Synthesize shared-core work.
- **Nostr sync for threads/sources**: deferred with the same reasoning as Read-mode chats; revisit if research threads prove share-worthy.

## Phases

- [x] Phase 1 — Agent runtime: pi deps pinned at 0.80.6, `$lib/ai/` gains `model.ts`, `runner.svelte.ts` (reactive mirror, abort, error surface, toolRuns rebuilt from rehydrated transcripts), `tools.ts` (jsonResult + withArgRepair), `pruning.ts`, `transcript.ts` (sanitize + text extraction); settings extension (`ai.api` flavor, `search.firecrawlApiKey`, `search.searchRelay`).
- [x] Phase 2 — Tools: `$lib/search/firecrawl.ts` (+ `// PAYMENTS:` seam), `nip50.ts` (raw-WS one-shot REQ, timeout resolves with partial results), `tools.ts` (web_search / fetch_page / nostr_search, source recording with s1/s2 ids, 20k-char page budget), capability-gated `prompt.ts`.
- [x] Phase 3 — Search UI: DB v2 (`searchThreads` store), thread store (`$lib/search/stores/threads.svelte.ts`, one runner per thread kept across switches) + session hooks, SearchView (thread sidebar / chat / sources panel), ToolCallCard (expandable result), citation `[sN]` click → source flash, SearchSettingsDialog (AI endpoint + flavor, Firecrawl key, search relay).
- [x] Phase 4 — Playwright e2e (`e2e/search.test.ts`, 4 tests): logged-out gate, unconfigured pitch + dialog, full mocked roundtrip (SSE chat chunks + Firecrawl JSON: tool card, 2 sources, cited answer, citation highlight, thread + tool cards + sources survive reload), thread deletion persists. Full suite 30 green.
- [ ] Phase 5 — Live smoke: real BYO LLM endpoint + real Firecrawl key + relay.nostr.band, one real research question end-to-end (manual gate, not CI-able).

Each phase gated on `pnpm check` + `pnpm build` + full Playwright suite.
