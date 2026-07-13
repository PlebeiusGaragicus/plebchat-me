# PlebChat

PlebChat is a web app for working with knowledge — reading, researching, writing, and debating — built as a **nostr-ecosystem app**: no accounts, no platform cloud, no server.

## The four modes

| Mode | What it does |
|---|---|
| **Read** | Import and read books (EPUB), highlight and annotate, and privately sync your library over nostr. |
| **Search** | An in-browser research agent that searches, reads sources, and returns cited answers. |
| **Synthesize** | An IDE-like workspace — chat, markdown editing, and sources side by side — for turning research into documents. |
| **Debate** | Structured Socratic seminars: author a thesis, defend it against refutations, refine it with an agent interlocutor. |

## How your data works

- **Your identity is a keypair.** There is no sign-up. Log in with a nostr key (or generate one) via the wallet button in the top bar.
- **Your data lives in your browser first**, and syncs — encrypted to you — through nostr relays you choose.
- **Your money is your own.** The built-in wallet holds Cashu ecash and speaks Lightning; PlebChat never custodies funds.
- **AI is bring-your-own.** Agent features run entirely in your browser against an LLM endpoint and API key you configure. Keys never leave your machine except to call your chosen endpoint.

## Status

PlebChat is early in development. The [proposals](proposals/app-shell-and-modes.md) section documents what's planned and how far along each piece is.
