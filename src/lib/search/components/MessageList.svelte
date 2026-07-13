<script lang="ts">
	import type { AgentRunner } from '$lib/ai/runner.svelte.js';
	import {
		assistantBlocks,
		citeSegments,
		isDisplayable,
		messageRole,
		userText
	} from '../render.js';
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

	function jumpToSource(id: string) {
		searchUi.sourcesOpen = true;
		searchUi.highlightSourceId = id;
	}
</script>

{#snippet assistantContent(message: import('@earendil-works/pi-agent-core').AgentMessage)}
	{#each assistantBlocks(message) as block, i (i)}
		{#if block.type === 'text'}
			<div
				data-testid="search-message-assistant"
				class="mb-3 max-w-[95%] rounded-xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
			>
				{#each citeSegments(block.text) as segment, j (j)}
					{#if segment.cite}
						<button
							class="font-medium text-primary hover:underline"
							title="Show source {segment.value}"
							onclick={() => jumpToSource(segment.value)}
						>
							[{segment.value}]
						</button>
					{:else}{segment.value}{/if}
				{/each}
			</div>
		{:else if runner.toolRuns[block.id]}
			<ToolCallCard run={runner.toolRuns[block.id]} />
		{/if}
	{/each}
{/snippet}

<div bind:this={scroller} class="flex-1 overflow-y-auto px-4 py-3">
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
