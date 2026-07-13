# PlebChat

Read, search, synthesize and debate — a client-only, nostr-native web app. No accounts, no server: your identity is a keypair, your data syncs encrypted through relays you choose, and agent features run in your browser against your own LLM endpoint.

**Docs:** https://plebeiusgaragicus.github.io/plebchat-me/docs/

## Getting started

cyphertap is a git submodule consumed from source — a plain clone leaves it empty:

```sh
git clone --recurse-submodules https://github.com/PlebeiusGaragicus/plebchat-me
cd plebchat-me
pnpm install
pnpm dev
```

`pnpm build` produces the static site, `pnpm check` type-checks, `pnpm test:e2e` runs the Playwright suite. See [docs/development.md](docs/development.md) for conventions, and [docs/proposals/](docs/proposals/) for feature plans and progress.

## The modes

- **Read** — import and annotate EPUBs, library synced privately over nostr
- **Search** — in-browser research agent with cited answers
- **Synthesize** — IDE-like workspace: chat, markdown, and sources side by side
- **Debate** — structured Socratic seminars refined with an agent interlocutor
