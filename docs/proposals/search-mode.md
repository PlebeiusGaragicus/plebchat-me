# Proposal: Search Mode

**Status:** Draft · **Last updated:** 2026-07-12

## Summary

An in-browser research agent: ask a question, the agent searches and reads sources, and returns a cited answer in a chat UI. Successor to SvelteReader's "Deep Research" mode — but running the **pi agent loop client-side** instead of LangGraph on a server.

## Motivation

SvelteReader's deepresearch mode proved the product shape (research chat with citations) but its LangGraph backend violates the no-server principle. PiChessBrowser and socratic-seminar prove the replacement: pi's ReAct loop runs fine in the browser against a user-configured, CORS-enabled LLM endpoint.

## Design

- **Agent runtime**: `@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`, one agent per research thread. BYO endpoint/key/model (openai-completions or anthropic-messages flavors), settings in localStorage — exactly socratic-seminar's `agent/model.ts` + PiChessBrowser's `ai/settings.ts` pattern.
- **Tools** (the crux — search needs data sources reachable from a browser):
    - `web_search` — requires a CORS-friendly search API; the user supplies a key for one (see open questions)
    - `fetch_page` — fetch + readability-extract a URL to markdown (CORS constraints apply; may need permissive-proxy fallback)
    - `nostr_search` — search nostr itself via NIP-50 relays (e.g. relay.nostr.band) — no key needed, uniquely aligned with the ecosystem
    - `read_source` / `cite` — pull sources saved by other modes; citations recorded with URL + quote
- **UI**: chat thread with streaming responses, tool-call display (socratic-seminar's `ToolCallDisplay.svelte`), sources panel; threads persisted per-npub in IndexedDB.
- **App-stays-authoritative**: agent output lands as structured tool calls (save source, emit citation), verified by state diff, never by parsing prose (PiChessBrowser's lesson).

### Reference material

- SvelteReader `frontend/src/lib/components/deepresearch/` + `frontend/src/routes/deepresearch/` — target UX
- socratic-seminar `src/lib/agent/` — runner, model builder, tool patterns, persistence/pruning
- PiChessBrowser `src/ai/piPlayer.ts` — minimal loop, timeout/repair/verify-by-state-diff patterns
- Spec: `nips/50.md` (search capability)

## Open questions

- **Which web-search backend?** Candidates: Brave Search API, Tavily, SearXNG (self-hostable — could run on the homelab with CORS headers, a nice self-hosted-encouragement story). Needs a spike on CORS behavior from browsers.
- **CORS proxy policy**: many pages block cross-origin fetch. Do we ship with "no proxy, some pages unreadable," or document an optional self-hosted proxy?
- **Pay-per-use anticipation**: this mode is the natural first customer for metered inference/search (the `afterToolCall` seam). Design the settings UI so "bring your own key" and "pay per use" are sibling options later.

## Progress

- [ ] Spike: pi agent loop in this repo (settings UI + hello-world agent)
- [ ] Spike: CORS-viable web search + page fetch
- [ ] Thread/chat UI with tool-call display
- [ ] nostr_search tool (NIP-50)
- [ ] Citations + sources panel, persisted per-npub
- [ ] Playwright e2e (mocked LLM endpoint)
