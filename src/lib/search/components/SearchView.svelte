<script lang="ts">
	import {
		MessageSquarePlus,
		PanelRightOpen,
		Send,
		Settings,
		Square,
		Trash2
	} from '@lucide/svelte';
	import { settingsStore } from '$lib/stores/settings.svelte.js';
	import { searchThreads } from '../stores/threads.svelte.js';
	import { searchUi } from '../stores/ui.svelte.js';
	import MessageList from './MessageList.svelte';
	import SourcesPanel from './SourcesPanel.svelte';

	let draft = $state('');

	const runner = $derived(searchThreads.activeRunner);
	const busy = $derived(runner?.isStreaming ?? false);

	function submit() {
		const text = draft.trim();
		if (!text || busy) return;
		draft = '';
		void searchThreads.send(text);
	}
</script>

<div class="flex h-full min-h-0">
	<!-- Thread list -->
	<aside class="flex w-64 shrink-0 flex-col border-r border-border" aria-label="Research threads">
		<div class="flex items-center justify-between border-b border-border p-2.5">
			<h2 class="text-sm font-semibold text-muted-foreground">Research</h2>
			<div class="flex items-center gap-0.5">
				<button
					class="rounded p-1.5 hover:bg-accent"
					title="Search settings"
					data-testid="search-open-settings"
					onclick={() => (searchUi.settingsOpen = true)}
				>
					<Settings class="size-4" />
				</button>
				<button
					data-testid="search-new-thread"
					class="flex items-center gap-1 rounded p-1.5 text-sm text-primary hover:bg-accent"
					title="New research thread"
					onclick={() => searchThreads.create()}
				>
					<MessageSquarePlus class="size-4" />
				</button>
			</div>
		</div>
		<div class="flex-1 overflow-y-auto p-2">
			{#if searchThreads.threads.length === 0}
				<p class="px-2 py-8 text-center text-sm text-muted-foreground">
					Ask a question below to start your first research thread.
				</p>
			{:else}
				{#each searchThreads.threads as thread (thread.id)}
					<div class="group flex items-start gap-1">
						<button
							data-testid="search-thread"
							class="min-w-0 flex-1 rounded-lg p-2 text-left hover:bg-accent {thread.id ===
							searchThreads.activeId
								? 'bg-accent'
								: ''}"
							onclick={() => (searchThreads.activeId = thread.id)}
						>
							<div class="truncate text-sm">{thread.title}</div>
							<div class="text-xs text-muted-foreground">
								{thread.sources.length} source{thread.sources.length === 1 ? '' : 's'}
							</div>
						</button>
						<button
							class="mt-2 hidden rounded p-1 text-muted-foreground group-hover:block hover:text-destructive"
							title="Delete thread"
							onclick={() => void searchThreads.remove(thread.id)}
						>
							<Trash2 class="size-3.5" />
						</button>
					</div>
				{/each}
			{/if}
		</div>
	</aside>

	<!-- Chat column -->
	<div class="flex min-w-0 flex-1 flex-col">
		{#if !settingsStore.isAiConfigured}
			<div class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
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
		{:else if runner && searchThreads.active}
			<div class="flex items-center gap-2 border-b border-border px-4 py-2">
				<div class="min-w-0 flex-1 truncate text-sm font-medium">
					{searchThreads.active.title}
				</div>
				{#if !searchUi.sourcesOpen}
					<button
						class="flex items-center gap-1 rounded p-1.5 text-xs text-muted-foreground hover:bg-accent"
						title="Show sources"
						onclick={() => (searchUi.sourcesOpen = true)}
					>
						<PanelRightOpen class="size-4" />
						{searchThreads.active.sources.length}
					</button>
				{/if}
			</div>
			<MessageList {runner} />
		{:else}
			<div class="flex flex-1 flex-col items-center justify-center p-6 text-center">
				<h1 class="text-2xl font-bold">Search</h1>
				<p class="mt-2 max-w-md text-sm text-muted-foreground">
					Ask a question and the agent will search the web{settingsStore.settings.search
						.firecrawlApiKey
						? ''
						: ' (add a Firecrawl key in settings)'} and nostr, read sources, and answer with citations.
				</p>
			</div>
		{/if}

		{#if settingsStore.isAiConfigured}
			<div class="flex items-end gap-2 border-t border-border p-3">
				<textarea
					data-testid="search-input"
					class="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:outline-none"
					rows="1"
					placeholder="Ask a research question…"
					bind:value={draft}
					onkeydown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							submit();
						}
					}}
				></textarea>
				{#if busy}
					<button
						class="rounded-lg bg-muted p-2.5 hover:bg-accent"
						title="Stop"
						data-testid="search-stop"
						onclick={() => runner?.stop()}
					>
						<Square class="size-4" />
					</button>
				{:else}
					<button
						data-testid="search-send"
						class="rounded-lg bg-primary p-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
						title="Send"
						disabled={!draft.trim()}
						onclick={submit}
					>
						<Send class="size-4" />
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Sources -->
	{#if searchUi.sourcesOpen && searchThreads.active}
		<SourcesPanel sources={searchThreads.active.sources} />
	{/if}
</div>
