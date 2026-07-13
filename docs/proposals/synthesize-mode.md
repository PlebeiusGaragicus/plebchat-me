# Proposal: Synthesize Mode

**Status:** Draft · **Last updated:** 2026-07-12

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

## Open questions

- **Synthesize vs. Debate overlap**: they share ~80% of machinery (workspace, artifacts, agent, editor). Build one shared workspace core in `$lib` that both modes configure? (Recommendation: yes — Debate = the shared core + the seminar template/persona.)
- **Tabs and panes on mobile**: WorkspaceLayout is desktop-shaped; decide the small-screen degradation (single pane + drawer?).
- **Embeddings**: SvelteReader used in-browser transformers for source search. Worth the bundle cost, or defer?

## Progress

- [ ] Shared workspace core decision (with Debate)
- [ ] WorkspaceLayout port (sidebar + tabbed panes)
- [ ] IndexedDB schema (projects/threads/artifacts/sources)
- [ ] CodeMirror editor with live preview + `[[links]]`
- [ ] Agent integration (file tools with approval gate)
- [ ] Playwright e2e (create project, edit artifact, version history)
