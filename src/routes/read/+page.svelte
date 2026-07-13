<script lang="ts">
	// Read mode. vibereader's single-view architecture is kept: this page
	// switches on ui.view (library | reader | ghost | browse) rather than
	// subroutes — the stores/reader lifecycle were built for it. Deep links
	// use query params (?book=<sha256>) mirrored with replaceState.
	import '$lib/read/session.js';
	import { BookOpen } from '@lucide/svelte';
	import { cyphertap } from 'cyphertap';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import SettingsPanel from '$lib/read/components/SettingsPanel.svelte';
	import LibraryView from '$lib/read/components/library/LibraryView.svelte';
	import ReaderView from '$lib/read/components/reader/ReaderView.svelte';
	import { library } from '$lib/read/stores/library.svelte.js';
	import { reader } from '$lib/read/stores/reader.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';
	import { session } from '$lib/session/index.svelte';
	import { shell } from '$lib/stores/shell.svelte';

	// Immersive reading: hide the shared TopBar while a book view is open.
	$effect(() => {
		shell.setImmersive(ui.view === 'reader' || ui.view === 'ghost');
		return () => shell.setImmersive(false);
	});

	// Deep link in: /read?book=<sha256> opens that book once the shelf has
	// loaded. $state so the mirror effect below stays quiet until this ran —
	// otherwise the mount-time mirror (view still 'library') erases the param
	// before it can be read.
	let handledInitialUrl = $state(false);
	$effect(() => {
		if (!library.ready || handledInitialUrl) return;
		handledInitialUrl = true;
		const sha = page.url.searchParams.get('book');
		if (sha) void library.open(sha);
	});

	// Mirror the open book back into the URL (reload-safe, shareable).
	$effect(() => {
		if (!handledInitialUrl) return;
		const sha = ui.view === 'reader' ? reader.book?.sha256 : undefined;
		const target = sha ? `?book=${sha}` : '';
		if (window.location.search !== target) {
			replaceState(`${resolve('/read')}${target}`, {});
		}
	});
</script>

{#if !cyphertap.isLoggedIn}
	<div class="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
		<BookOpen class="mb-4 size-12 text-muted-foreground/40" />
		<h1 class="text-2xl font-bold">Read</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			A local-first reader: import EPUBs, highlight and annotate, and sync your library —
			encrypted to you — over nostr. Log in with the key button in the top bar to open your
			library.
		</p>
	</div>
{:else if ui.view === 'reader'}
	<ReaderView />
{:else if ui.view === 'ghost' && ui.ghostSha}
	<!-- PORT NOTE (Phase 2): the full read-only GhostView arrives in Phase 6;
	     file restore arrives with sync in Phase 5. -->
	<div class="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
		<h2 class="text-lg font-semibold">Not on this device</h2>
		<p class="mt-2 text-sm text-muted-foreground">
			This book's metadata is here, but its file isn't. Restoring from a Blossom backup arrives
			with sync.
		</p>
		<button
			class="mt-6 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			onclick={() => {
				ui.ghostSha = null;
				ui.view = 'library';
			}}
		>
			Back to library
		</button>
	</div>
{:else}
	<LibraryView />
{/if}

{#if ui.settingsOpen}
	<SettingsPanel />
{/if}
