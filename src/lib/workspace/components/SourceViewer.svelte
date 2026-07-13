<script lang="ts">
	// Read-only source pane: title/URL header + rendered markdown content.
	import { ExternalLink } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/search/markdown.js';
	import { sources } from '../stores/sources.svelte.js';

	interface Props {
		sourceId: string;
	}

	let { sourceId }: Props = $props();

	const source = $derived(sources.get(sourceId));
</script>

<div class="flex h-full flex-col">
	{#if !source}
		<div class="flex h-full items-center justify-center text-sm text-muted-foreground">
			Source not found
		</div>
	{:else}
		<div class="flex items-center justify-between border-b border-border px-4 py-3">
			<div class="min-w-0 flex-1">
				<h3 class="truncate text-sm font-medium">{source.title}</h3>
				{#if source.url}
					<a
						href={source.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
					>
						{source.url}
						<ExternalLink class="h-3 w-3 shrink-0" />
					</a>
				{/if}
			</div>
		</div>
		<div class="flex-1 overflow-y-auto p-4">
			{#if source.content}
				<div class="md max-w-none text-sm">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown sanitizes -->
					{@html renderMarkdown(source.content)}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">No content available</p>
			{/if}
		</div>
	{/if}
</div>
