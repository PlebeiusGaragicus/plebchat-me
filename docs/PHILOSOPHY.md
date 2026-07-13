# Philosophy

PlebChat is a **nostr-ecosystem app**. These principles are binding — features that conflict with them lose. To change a principle, change this document first.

## 1. Web-first, no backend

The app is a static site: built by CI, served by GitHub Pages, runnable from any static host. There is no application server, no ops, no database to administer. Every external service the app talks to must be browser-reachable (CORS-enabled).

## 2. Relays are the file system

Nostr relays replace the platform-owned cloud. Sync, backup, and sharing are nostr events — private-by-default (NIP-44 encrypted to yourself), shared by choice (republished in plaintext, following standard NIPs so other clients like highlighter.com can read them). Blossom servers hold blobs too large for events.

## 3. The browser is the primary store

Local-first: IndexedDB (scoped per npub) is the source of truth for day-to-day use; relays are sync and backup. The app works offline and never blocks on the network for local reads.

## 4. Identity is a keypair

No accounts, no email, no KYC. A user *is* a nostr keypair, held and controlled by them via the [cyphertap](https://github.com/PlebeiusGaragicus/cyphertap) component — which also gives every user a Cashu ecash wallet and control over their relay list.

## 5. Payments are bitcoin

When money moves, it's Lightning or Cashu ecash. No fiat rails, no subscriptions, no custodial balances held by us. Pay-per-use metering (LLM inference, search, storage) is anticipated but not yet built — users bring their own API keys for now.

## 6. AI is integrated but sovereign

Agent features run **in the browser** (the pi agent loop — no LangGraph-style server orchestration). Bring-your-own endpoint and key is always a first-class path. The app, not the model, stays authoritative over user data: agent actions go through explicit tools, with approval gates on destructive ones.
