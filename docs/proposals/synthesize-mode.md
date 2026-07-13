# Proposal: Synthesize Mode

**Status:** In progress · **Last updated:** 2026-07-13

## Summary

An IDE-like workspace for turning sources into documents: collapsible sidebar of projects/files/sources, resizable tabbed panes holding chat threads, markdown editors, and source viewers side by side. The UI is SvelteReader's `WorkspaceLayout`; the data model and agent are socratic-seminar's.

## Motivation

Synthesize is where the other modes converge: sources from Search, annotations from Read, and (structurally) the same workspace Debate needs. SvelteReader's synthesize mode is the strongest layout reference in the reference set; socratic-seminar already implements the matching data model (projects → threads + versioned artifacts + sources) and the agent that edits files through approval-gated tools.

## Design

- **Layout**: port SvelteReader's `WorkspaceLayout.svelte` pattern — left sidebar (drag-resize 180–400px, collapsible) + two tabbed columns with draggable divider; tabs render chat / editor / source viewer via snippets.
- **Data model** (socratic-seminar `db/types.ts`, one IndexedDB per npub): `Project`, `Thread` (+ verbatim pi `TranscriptRecord`), `Artifact` + `ArtifactVersion` (versioned markdown snapshots), `Source`/`Bibliography`, `WorkspaceState`/`LayoutState`.
- **Editor**: CodeMirror 6 with Obsidian-style live preview (socratic-seminar's `codemirror/livePreview.ts`); `[[Title]]` wiki-links between artifacts and sources.
- **Agent**: pi runner with the file tools (`read_file`/`patch_file` with approval gate), sources, todos, clarify — socratic-seminar's `agent/` directory nearly verbatim. Reads see live editor content.
- **Nostr sync**: deferred to a shared decision with Debate mode (same entities). Local-first ships first; relays-as-filesystem follows the event-kind design in the Debate proposal.

### Reference material

- SvelteReader `frontend/src/lib/components/synthesize/` — `WorkspaceLayout`, `TabbedPanel`, `SynthSidebar`, `ProjectDashboard`
- socratic-seminar `src/lib/db/`, `src/lib/agent/`, `src/lib/codemirror/`, `src/lib/components/{Editor,ChatPanel,ToolCallDisplay}.svelte`

## Decisions (2026-07-13)

- **Shared workspace core now**: the workspace (layout, db entities, editor, agent wiring) is built mode-agnostic in `$lib/workspace/`; Synthesize is its first consumer, Debate later = the same core + the seminar template/persona. Synthesize-only bits (persona, dashboard copy) stay under `$lib/synthesize/` or the route.
- **Full mode, built in phases** (see plan below), committed to master phase by phase.
- **Mobile**: below a breakpoint the sidebar becomes an overlay drawer and the two tabbed columns collapse to one pane. No separate mobile design.
- **Embeddings deferred**: plain title/text search over sources; no in-browser transformer models in the bundle. The agent reads source content directly.
- **Data model**: socratic-seminar's shapes verbatim (they are SvelteReader's types with the LangGraph fields already stripped): `Project`, `Thread` + `TranscriptRecord` (verbatim pi `AgentMessage[]`), `Artifact` with embedded `ArtifactVersion[]`, `Source` (+ deferred file fields), `WorkspaceState` per project / `LayoutState` per npub. New stores land in the existing per-npub `plebchat::<npub>` DB via a version bump — no second database.

## Phase plan

1. **Data model + dashboard** — `$lib/workspace/` types + db stores (DB v3), projects store, `/synthesize` project dashboard (create/rename/tag/delete), `/synthesize/[id]` shell.
2. **WorkspaceLayout port** — sidebar (files/sources/threads, drag-resize 180–400px, collapsible) + two tabbed columns with draggable divider, snippet-rendered tabs, persisted `WorkspaceState`/`LayoutState`; mobile single-pane + drawer.
3. **Editor + versioning** — CodeMirror 6 markdown with live preview (socratic-seminar `codemirror/livePreview.ts`), `[[Title]]` links, version snapshots + history, read-only source viewer.
4. **Agent** — `$lib/ai` runner + workspace tools (`list_files`/`read_file` auto-approved, `patch_file`/`write_file` approval-gated), sources tools, chat panel with tool cards; reads see live editor content.
5. **e2e + docs** — Playwright (mocked SSE endpoint like `e2e/search.test.ts`): project CRUD, artifact editing + versions, agent patch approval. MkDocs page.

## Open questions

- **Nostr sync** (unchanged): deferred to the shared event-kind decision with Debate mode; local-first ships first.
- **Sources from Search mode**: importing a Search thread's sources into a project is a natural follow-up once both exist; not in this build-out.

## Progress

- [x] Shared workspace core decision (with Debate) — yes, `$lib/workspace/`
- [x] Phase 1: IndexedDB schema (DB v3) + projects store + dashboard + `?project=` deep links
- [x] Phase 2: WorkspaceLayout port (sidebar + tabbed panes, drag-to-split, persisted layout, mobile drawer). Interim panes: textarea file editor (CodeMirror is Phase 3), placeholder chat (agent is Phase 4), manual add-source modal. Dropped from the SvelteReader sidebar for now: file tags, thread status filters.
- [x] Phase 3: CodeMirror editor with live preview + `[[links]]` + versions. Live-content store layer (dirty tracking, debounced flush; versions only by explicit snapshot), version toolbar (prev/next/snapshot), theme-aware livePreview recolored to semantic tokens, Cmd/Ctrl+click wiki-links open-or-create artifacts.
- [ ] Phase 4: Agent integration (file tools with approval gate)
- [ ] Phase 5: Playwright e2e (create project, edit artifact, version history, patch approval) + docs
