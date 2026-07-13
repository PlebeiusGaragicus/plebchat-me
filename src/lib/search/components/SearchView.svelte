<script lang="ts">
	// SvelteReader deepresearch layout: collapsible thread rail on the left,
	// hero (tagline + input + Explore Recent Events) that adapts into the
	// chat view once a search starts, collapsible sources rail on the right,
	// and a source-detail modal.
	import { ArrowLeft } from '@lucide/svelte';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { searchThreads } from '../stores/threads.svelte.js';
	import { searchUi } from '../stores/ui.svelte.js';
	import DiscoverFeed from './DiscoverFeed.svelte';
	import MessageList from './MessageList.svelte';
	import SearchInputBar from './SearchInputBar.svelte';
	import SourceModal from './SourceModal.svelte';
	import SourcesSidebar from './SourcesSidebar.svelte';
	import ThreadSidebar from './ThreadSidebar.svelte';

	const runner = $derived(searchThreads.activeRunner);
	const busy = $derived(runner?.isStreaming ?? false);
	const hasChat = $derived(searchThreads.active !== null);

	function submit(query: string) {
		void searchThreads.send(query);
	}
</script>

<div class="flex h-full min-h-0">
	<ThreadSidebar />

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		{#if !settingsStore.isAiConfigured}
			<!-- Settings gate -->
			<div class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
				<h1 class="text-3xl font-light text-muted-foreground">
					Research deeply. <span class="text-foreground">Get answers.</span>
				</h1>
				<p class="max-w-md text-sm text-muted-foreground">
					No AI endpoint configured. The research agent runs entirely in your browser — bring
					your own endpoint: LM Studio or Ollama on localhost, OpenRouter, Anthropic, or any
					compatible server that allows browser requests.
				</p>
				<button
					data-testid="search-configure"
					class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					onclick={() => (searchUi.settingsOpen = true)}
				>
					Open Settings
				</button>
			</div>
		{:else if hasChat && runner}
			<!-- Chat view -->
			<div class="flex min-h-0 flex-1 flex-col">
				<div class="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-3 px-4 py-3">
					<button
						class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
						data-testid="search-back"
						onclick={() => (searchThreads.activeId = null)}
					>
						<ArrowLeft class="size-4" />
						New research
					</button>
					<div class="min-w-0 flex-1 truncate text-right text-sm font-medium text-muted-foreground">
						{searchThreads.active?.title}
					</div>
				</div>
				<div class="mx-auto w-full max-w-3xl border-b border-border/50"></div>

				<MessageList {runner} />

				<div class="shrink-0 px-4 py-4">
					<SearchInputBar
						onSubmit={submit}
						onStop={() => runner?.stop()}
						isLoading={busy}
						placeholder="Ask a follow-up question…"
					/>
				</div>
			</div>
		{:else}
			<!-- Hero + discovery -->
			<div class="flex-1 overflow-y-auto px-4">
				<div class="flex shrink-0 flex-col items-center justify-center py-12 lg:py-20">
					<h1 class="mb-8 text-center text-3xl font-light text-muted-foreground lg:text-4xl">
						Research deeply. <span class="text-foreground">Get answers.</span>
					</h1>
					<SearchInputBar onSubmit={submit} isLoading={busy} autofocus />
				</div>
				<div class="mx-auto mt-4 w-full max-w-screen-lg pb-8">
					<DiscoverFeed />
				</div>
			</div>
		{/if}
	</div>

	{#if hasChat}
		<SourcesSidebar sources={searchThreads.active?.sources ?? []} />
	{/if}
</div>

<SourceModal />
