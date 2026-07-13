<script lang="ts">
	// Search mode: an in-browser research agent (pi ReAct loop) with
	// Firecrawl web search/fetch and NIP-50 nostr search, cited answers,
	// and device-local threads. See docs/proposals/search-mode.md.
	import '$lib/search/session.js';
	import { Search } from '@lucide/svelte';
	import { cyphertap } from 'cyphertap';
	import SearchSettingsDialog from '$lib/search/components/SearchSettingsDialog.svelte';
	import SearchView from '$lib/search/components/SearchView.svelte';
	import { searchThreads } from '$lib/search/stores/threads.svelte.js';
	import { searchUi } from '$lib/search/stores/ui.svelte.js';
</script>

{#if !cyphertap.isLoggedIn}
	<div class="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
		<Search class="mb-4 size-12 text-muted-foreground/40" />
		<h1 class="text-2xl font-bold">Search</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			Agentic research that runs entirely in your browser: the agent searches the web and
			nostr, reads sources, and answers with citations. Log in with the key button in the top
			bar to start.
		</p>
	</div>
{:else if searchThreads.ready}
	<SearchView />
{/if}

{#if searchUi.settingsOpen}
	<SearchSettingsDialog />
{/if}
