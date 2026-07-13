<script lang="ts">
	import { ExternalLink, Globe, X, Zap } from '@lucide/svelte';
	import type { SearchSource } from '$lib/db/types.js';
	import { searchUi } from '../stores/ui.svelte.js';

	let { sources }: { sources: SearchSource[] } = $props();

	let cards = $state<Record<string, HTMLElement>>({});

	// Scroll to + flash the source a [sN] citation click pointed at.
	$effect(() => {
		const id = searchUi.highlightSourceId;
		if (!id) return;
		const el = cards[id];
		if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		const timer = setTimeout(() => (searchUi.highlightSourceId = null), 1600);
		return () => clearTimeout(timer);
	});
</script>

<aside
	class="flex w-72 shrink-0 flex-col border-l border-border"
	aria-label="Sources"
	data-testid="sources-panel"
>
	<div class="flex items-center justify-between border-b border-border p-2.5">
		<h3 class="text-sm font-semibold text-muted-foreground">Sources ({sources.length})</h3>
		<button
			class="rounded p-1 hover:bg-accent"
			title="Hide sources"
			onclick={() => (searchUi.sourcesOpen = false)}
		>
			<X class="size-4" />
		</button>
	</div>
	<div class="flex-1 overflow-y-auto p-2">
		{#if sources.length === 0}
			<p class="py-8 text-center text-sm text-muted-foreground">
				Sources the agent consults appear here, numbered for citations.
			</p>
		{:else}
			{#each sources as source (source.id)}
				<div
					bind:this={cards[source.id]}
					data-testid="source-card"
					class="mb-2 rounded-lg border p-2 text-xs transition-colors {searchUi.highlightSourceId ===
					source.id
						? 'border-primary bg-primary/10'
						: 'border-border'}"
				>
					<div class="flex items-center gap-1.5">
						<span class="shrink-0 font-mono font-semibold text-primary">[{source.id}]</span>
						{#if source.kind === 'nostr'}
							<Zap class="size-3 shrink-0 text-muted-foreground" />
						{:else}
							<Globe class="size-3 shrink-0 text-muted-foreground" />
						{/if}
						<span class="min-w-0 flex-1 truncate font-medium">{source.title}</span>
						{#if source.kind === 'web'}
							<a
								class="shrink-0 rounded p-0.5 text-muted-foreground hover:text-primary"
								href={source.url}
								target="_blank"
								rel="noopener noreferrer"
								title="Open {source.url}"
							>
								<ExternalLink class="size-3" />
							</a>
						{/if}
					</div>
					{#if source.kind === 'web'}
						<div class="mt-0.5 truncate text-muted-foreground">{source.url}</div>
					{/if}
					{#if source.description}
						<div class="mt-1 line-clamp-3 text-muted-foreground">{source.description}</div>
					{/if}
					{#if source.fetched}
						<div class="mt-1 text-[10px] font-medium tracking-wide text-primary uppercase">
							read in full
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</aside>
