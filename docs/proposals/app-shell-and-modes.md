# Proposal: App Shell & Modes

**Status:** In progress · **Last updated:** 2026-07-12

## Summary

The shared chrome every mode lives inside: top bar (logo, mode selector, cyphertap login/wallet), theming, routing, mode state, and the deployment/testing skeleton (GitHub Pages, MkDocs, Playwright).

## Motivation

PlebChat is four mini-apps that share identity, wallet, theming, and navigation. Building the shell first — modeled on SvelteReader's proven layout — lets each mode be developed independently behind a stable frame.

## Design

- **Stack**: SvelteKit 2 + Svelte 5 runes, Tailwind v4, static adapter (`ssr=false`, prerendered shell, `404.html` SPA fallback), pnpm workspace with the cyphertap submodule. Mirrors vibereader's scaffold, including the inline SvelteKit config in `vite.config.ts` and the NDK version override.
- **Modes**: `src/lib/stores/mode.svelte.ts` — `AppMode = 'read' | 'search' | 'synthesize' | 'debate'`, persisted to localStorage; each mode owns a top-level route (`/read`, `/search`, `/synthesize`, `/debate`). `ModeSelector.svelte` (bits-ui popover in the top bar) and the home page's mode cards both switch modes.
- **Theming**: semantic shadcn-style tokens in `src/theme.css` (zinc neutrals, violet primary, dark-first via mode-watcher), mapped to Tailwind utilities with `@theme inline` in `src/app.css`. The `:root:root` specificity trick themes the cyphertap widget with the same palette (see cyphertap `docs/THEMING.md`). Palette is a placeholder decision — easy to revisit, it's ~40 lines of CSS variables.
- **Identity/wallet**: `<Cyphertap relays mints/>` in the top bar; defaults in `src/lib/relays.ts` (our whitelisted test relay + fake testnut mint).
- **Docs**: MkDocs Material built by CI into the same Pages artifact at `/docs/` (vibereader pattern).
- **Testing**: Playwright e2e (`e2e/`), chromium, dev-server based.

### Reference material

- SvelteReader `frontend/src/lib/stores/mode.svelte.ts`, `ModeSelector.svelte`, `TopBar.svelte`, `app.css` — the shell we modeled.
- vibereader — scaffold, CI/Pages/MkDocs workflows, cyphertap theming overrides.
- cyphertap `docs/CONSUMING.md` — submodule pattern, NDK override, styles import.

## Open questions

- **Branding/palette**: violet-on-zinc is a starting point, not a decision.
- **Custom domain**: `plebchat.me` is the custom domain of the *user* Pages site, so this project already serves at `https://plebchat.me/plebchat-me/` (with `BASE_PATH` kept). If PlebChat should own the domain root instead, the domain moves to this repo's Pages settings and `BASE_PATH` drops — a deliberate decision to make later, since it evicts whatever the user site serves at the root.
- **Mode-aware home**: should returning users land on their last mode instead of the welcome screen?

## Progress

- [x] Repo scaffold (SvelteKit + Tailwind v4 + static adapter, pnpm workspace)
- [x] cyphertap submodule + NDK override + styles import
- [x] Mode store + ModeSelector + TopBar + home mode cards
- [x] Theme tokens (light/dark) shared with cyphertap
- [x] Stub routes for all four modes
- [x] MkDocs site + proposals
- [x] CI (check/build/docs) + Pages deploy workflows
- [x] Playwright e2e for the shell
- [ ] Real relay/mint configuration UX beyond defaults (post-MVP)
- [ ] Custom domain
