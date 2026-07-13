# Proposal: Debate Mode

**Status:** Draft · **Last updated:** 2026-07-12

## Summary

Structured argumentation as a first-class document type: a **Socratic Seminar** is a versioned markdown artifact with a defined shape — *Thesis → Supporting Clauses (definitions + evidence, narrative) → Arguments → Refutations → Replies* — refined in dialogue with an agent interlocutor that probes, cites, and patches the document through approval-gated edits. This is socratic-seminar (the furthest-along reference app) becoming a mode.

## Motivation

Chat transcripts evaporate; positions should accumulate. The seminar format forces claims to be explicit, evidenced (`[[Title]]` citations into sources), and stress-tested by refutation — and produces a durable, shareable document rather than a scrollback. socratic-seminar proved the format and the agent flow; PlebChat gives it the shell, identity, and (eventually) the relay sync it lacks.

## Design

- **The seminar schema** is a markdown convention, defined identically in the file template and the agent persona (socratic-seminar keeps `templates.ts` and `agent/prompt.ts` in sync — preserve that discipline):
    - **Thesis / Abstract** — the claim, stated falsifiably
    - **Supporting Clauses** — definitions and evidence, with narrative
    - **Arguments** — the case for the thesis
    - **Refutations** — the strongest cases against, steel-manned
    - **Replies** — responses to refutations, or concessions
- **Machinery**: the shared workspace core from the Synthesize proposal (artifact versioning, transcript persistence, pi runner with `patch_file` behind an approval gate, `ask_user`/`ask_choices` interactions). Debate mode = that core + the seminar template + a Socratic persona whose job is to interrogate the thesis, demand definitions, and author refutations.
- **Nostr sync & sharing (the open design work)**: seminars are the most share-worthy artifact PlebChat produces — a published seminar invites counter-refutations from other keypairs. Sync of private work should follow vibereader's proven pattern (NIP-44 self-encrypted addressable events); public seminars are plaintext addressable events others can reference and reply to.

### Reference material

- socratic-seminar `src/lib/templates.ts` + `src/lib/agent/prompt.ts` (the schema, twice), `src/lib/agent/runner.svelte.ts` (approval-gated agent), `src/lib/db/types.ts` (entities), `docs/PHILOSOPHY.md` (binding principles)
- vibereader `docs/nostr-event-model.md` — the sync-contract pattern to replicate
- Specs: `nips/78.md` (app-specific data), `nips/44.md`, `nips/09.md`

## Open questions

- **Event-kind design** (inherited from socratic-seminar, still open): NIP-78 kind `30078` with app-scoped d-tags vs. custom addressable kinds for project/artifact/thread. Custom kinds (vibereader precedent: 3010x block) are cleaner for interop and filtering — needs its own short design doc before any sync code.
- **Multi-party debates**: v1 is you + agent. Human-vs-human seminars over nostr (each party signs their own refutations) are the exciting end-state — does the schema need author attribution per section from day one?
- **Publishing format**: publish the raw markdown artifact, or also emit NIP-23 long-form (`30023`) for readability in existing clients?

## Progress

- [ ] Shared workspace core (see Synthesize proposal)
- [ ] Seminar template + Socratic persona
- [ ] Event-kind design doc (blocks all sync work)
- [ ] Private sync (encrypted addressable events)
- [ ] Public publishing + NIP-23 consideration
- [ ] Playwright e2e (create seminar, agent refutation flow with mocked endpoint)
