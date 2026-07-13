# Development

## Getting started

cyphertap is consumed from source as a git submodule — a plain clone leaves `cyphertap/` empty and workspace resolution fails confusingly:

```sh
git clone --recurse-submodules https://github.com/PlebeiusGaragicus/plebchat-me
cd plebchat-me
pnpm install
pnpm dev
```

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server at `http://localhost:5173` |
| `pnpm build` | Static SPA build into `build/` |
| `pnpm preview` | Serve the production build |
| `pnpm check` | svelte-check type checking |
| `pnpm check:lib` | Type-check the cyphertap submodule |
| `pnpm test:e2e` | Playwright end-to-end tests (`e2e/`) |
| `mkdocs serve` | Preview this docs site (`pip install -r docs-requirements.txt` first) |

## Architecture in one paragraph

PlebChat is a SvelteKit 2 / Svelte 5 (runes) static SPA — `ssr = false`, prerendered shell, `404.html` SPA fallback for GitHub Pages. Styling is Tailwind CSS v4 with semantic design tokens (`src/theme.css`) shared with the cyphertap widget. Each **mode** (Read, Search, Synthesize, Debate) is a route-level mini-app behind the shared shell (`TopBar` + `ModeSelector`, mode state in `src/lib/stores/mode.svelte.ts`). Identity, wallet, and relay management come from the [cyphertap](https://github.com/PlebeiusGaragicus/cyphertap) submodule.

## Working conventions

- **Proposals before features**: every substantial feature gets a plan document in `docs/proposals/` that is reviewed and updated as it's built (they double as progress trackers across sessions).
- **Branching**: direct commits to `master` until the MVP; feature branches + PRs after.
- **Submodule discipline**: cyphertap changes land upstream first, then the submodule pointer is bumped here. Any bump that changes cyphertap's dependencies requires `pnpm install` and committing the updated `pnpm-lock.yaml` (CI's `--frozen-lockfile` catches drift by design). Keep the `@nostr-dev-kit/ndk` override in `pnpm-workspace.yaml` identical to cyphertap's.
- **Deploy**: pushes to `master` build the SPA and this docs site into one Pages artifact (docs served at `/docs/`).

## Test infrastructure caveats

- The default relay `wss://relay.abvstudio.net` is **write-whitelisted**: freshly generated keys can read but not publish. Use a whitelisted test account, or add a hex pubkey to `~/.strfry/whitelist.d/` on the homelab. It purges events older than 60 days.
- The default mint (`nofee.testnut.cashu.space`) issues **fake ecash** — no real funds.
- cyphertap currently stores keys as unencrypted hex in localStorage — treat wallets as pocket money.
