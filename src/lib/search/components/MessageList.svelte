<script lang="ts">
	import type { AgentRunner } from '$lib/ai/runner.svelte.js';
	import { renderMarkdown } from '../markdown.js';
	import { assistantBlocks, isDisplayable, messageRole, userText } from '../render.js';
	import { searchUi } from '../stores/ui.svelte.js';
	import ToolCallCard from './ToolCallCard.svelte';

	let { runner }: { runner: AgentRunner } = $props();

	let scroller: HTMLElement | undefined = $state();

	// Keep the newest content in view while streaming.
	$effect(() => {
		void runner.messages.length;
		void runner.streamingMessage;
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	});

	// [sN] markers render as <span data-cite> inside {@html} — handle their
	// clicks by delegation: expand the sources rail and flash the source.
	function onCiteClick(event: MouseEvent | KeyboardEvent) {
		const target = (event.target as HTMLElement).closest('[data-cite]');
		if (!target) return;
		if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
		searchUi.sourcesCollapsed = false;
		searchUi.highlightSourceId = target.getAttribute('data-cite');
	}
</script>

{#snippet assistantContent(message: import('@earendil-works/pi-agent-core').AgentMessage)}
	{#each assistantBlocks(message) as block, i (i)}
		{#if block.type === 'text'}
			<div
				data-testid="search-message-assistant"
				class="md mb-3 max-w-[95%] rounded-xl bg-muted px-4 py-2.5 text-sm"
				role="presentation"
				onclick={onCiteClick}
				onkeydown={onCiteClick}
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized by renderMarkdown -->
				{@html renderMarkdown(block.text)}
			</div>
		{:else if runner.toolRuns[block.id]}
			<ToolCallCard run={runner.toolRuns[block.id]} />
		{/if}
	{/each}
{/snippet}

<div bind:this={scroller} class="flex-1 overflow-y-auto px-4 py-3">
	<div class="mx-auto w-full max-w-3xl">
		{#each runner.messages.filter(isDisplayable) as message, i (i)}
			{#if messageRole(message) === 'user'}
				<div class="mb-3 text-right">
					<div
						data-testid="search-message-user"
						class="inline-block max-w-[85%] rounded-xl bg-primary/10 px-3 py-2 text-left text-sm whitespace-pre-wrap"
					>
						{userText(message)}
					</div>
				</div>
			{:else}
				{@render assistantContent(message)}
			{/if}
		{/each}

		{#if runner.streamingMessage}
			{@render assistantContent(runner.streamingMessage)}
		{/if}
		{#if runner.isStreaming && !runner.streamingMessage}
			<div class="mb-3 inline-block rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
				…
			</div>
		{/if}

		{#if runner.error}
			<div
				data-testid="search-error"
				class="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			>
				{runner.error}
			</div>
		{/if}
	</div>
</div>

<style>
	/* Minimal markdown typography for assistant bubbles (no prose plugin). */
	.md :global(p) {
		margin: 0.5rem 0;
	}
	.md :global(p:first-child) {
		margin-top: 0;
	}
	.md :global(p:last-child) {
		margin-bottom: 0;
	}
	.md :global(h1),
	.md :global(h2),
	.md :global(h3),
	.md :global(h4) {
		font-weight: 600;
		margin: 0.9rem 0 0.4rem;
		line-height: 1.3;
	}
	.md :global(h1) {
		font-size: 1.15rem;
	}
	.md :global(h2) {
		font-size: 1.05rem;
	}
	.md :global(h3),
	.md :global(h4) {
		font-size: 1rem;
	}
	.md :global(ul),
	.md :global(ol) {
		margin: 0.5rem 0;
		padding-left: 1.4rem;
	}
	.md :global(ul) {
		list-style: disc;
	}
	.md :global(ol) {
		list-style: decimal;
	}
	.md :global(li) {
		margin: 0.2rem 0;
	}
	.md :global(code) {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 0.25rem;
		padding: 0.1rem 0.3rem;
		font-size: 0.85em;
	}
	.md :global(pre) {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 0.6rem 0.8rem;
		overflow-x: auto;
		margin: 0.5rem 0;
	}
	.md :global(pre code) {
		background: none;
		border: none;
		padding: 0;
	}
	.md :global(blockquote) {
		border-left: 3px solid var(--color-border);
		padding-left: 0.8rem;
		margin: 0.5rem 0;
		color: var(--color-muted-foreground);
	}
	.md :global(a) {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.md :global(table) {
		border-collapse: collapse;
		margin: 0.5rem 0;
		font-size: 0.85em;
	}
	.md :global(th),
	.md :global(td) {
		border: 1px solid var(--color-border);
		padding: 0.3rem 0.6rem;
		text-align: left;
	}
	.md :global(hr) {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 0.8rem 0;
	}
	.md :global(.cite) {
		color: var(--color-primary);
		font-weight: 500;
		cursor: pointer;
	}
	.md :global(.cite:hover) {
		text-decoration: underline;
	}
</style>
