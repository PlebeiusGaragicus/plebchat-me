<script lang="ts">
	// Right rail, SvelteReader SourcesSidebar shape: collapsed to a count
	// badge by default; expanded rows open the source detail modal.
	import { ExternalLink, Globe, PanelRight, PanelRightClose, Zap } from '@lucide/svelte';
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

	function domain(url: string): string {
		try {
			return new URL(url).hostname.replace('www.', '');
		} catch {
			return url;
		}
	}
</script>

{#if searchUi.sourcesCollapsed}
	<div
		class="flex h-full w-12 shrink-0 flex-col items-center border-l border-border bg-muted/20 py-2"
		data-testid="sources-collapsed"
	>
		<button
			class="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
			title="Show sources"
			data-testid="sources-expand"
			onclick={() => (searchUi.sourcesCollapsed = false)}
		>
			<PanelRight class="size-5" />
		</button>
		{#if sources.length > 0}
			<span
				class="mt-4 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary"
				data-testid="sources-count"
			>
				{sources.length}
			</span>
		{/if}
	</div>
{:else}
	<aside
		class="flex h-full w-64 shrink-0 flex-col border-l border-border bg-muted/20"
		aria-label="Sources"
		data-testid="sources-panel"
	>
		<div class="flex items-center justify-between border-b border-border px-3 py-2.5">
			<span class="text-sm font-semibold text-muted-foreground">
				Sources ({sources.length})
			</span>
			<button
				class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
				title="Hide sources"
				onclick={() => (searchUi.sourcesCollapsed = true)}
			>
				<PanelRightClose class="size-4" />
			</button>
		</div>
		<div class="flex-1 overflow-y-auto p-2">
			{#if sources.length === 0}
				<div class="flex flex-col items-center px-4 py-12 text-center">
					<Globe class="mb-3 size-10 text-muted-foreground/40" />
					<p class="text-xs text-muted-foreground">
						Sources the agent consults appear here, numbered for citations.
					</p>
				</div>
			{:else}
				{#each sources as source (source.id)}
					<button
						bind:this={cards[source.id]}
						data-testid="source-card"
						class="group mb-1 flex w-full items-start gap-2 rounded-lg border px-2 py-2 text-left transition-colors hover:bg-accent {searchUi.highlightSourceId ===
						source.id
							? 'border-primary bg-primary/10'
							: 'border-transparent'}"
						onclick={() => (searchUi.modalSource = source)}
					>
						<span class="mt-0.5 shrink-0 font-mono text-xs font-semibold text-primary">
							[{source.id}]
						</span>
						<div class="min-w-0 flex-1">
							<p class="line-clamp-2 text-xs font-medium">{source.title}</p>
							<p class="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
								{#if source.kind === 'nostr'}
									<Zap class="size-2.5 shrink-0" /> nostr
								{:else}
									<Globe class="size-2.5 shrink-0" /> {domain(source.url)}
								{/if}
								{#if source.fetched}
									<span class="text-primary">· read</span>
								{/if}
							</p>
						</div>
						{#if source.kind === 'web'}
							<a
								href={source.url}
								target="_blank"
								rel="noopener noreferrer"
								class="shrink-0 p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-primary"
								title="Open {source.url}"
								onclick={(e) => e.stopPropagation()}
							>
								<ExternalLink class="size-3" />
							</a>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
		{#if sources.length > 0}
			<div class="border-t border-border px-3 py-2">
				<p class="text-[10px] text-muted-foreground">Click a source to view details</p>
			</div>
		{/if}
	</aside>
{/if}
