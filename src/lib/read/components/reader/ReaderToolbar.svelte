<script lang="ts">
	import { ArrowLeft, Highlighter, List, MessageSquare, Type } from '@lucide/svelte';
	import { reader } from '$lib/read/stores/reader.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';
	import DisplaySettings from './DisplaySettings.svelte';

	let displayOpen = $state(false);
</script>

<div class="flex items-center gap-2 border-b border-border px-3 py-1.5">
	<button
		data-testid="reader-back"
		class="rounded p-1.5 hover:bg-accent"
		title="Back to library"
		onclick={() => reader.close()}
	>
		<ArrowLeft class="size-4" />
	</button>
	<button
		data-testid="toc-toggle"
		class="rounded p-1.5 hover:bg-accent {ui.tocOpen ? 'text-primary' : ''}"
		title="Table of contents"
		onclick={() => (ui.tocOpen = !ui.tocOpen)}
	>
		<List class="size-4" />
	</button>

	<!-- Section label + % live in the bottom ProgressBar footer. -->
	<div class="min-w-0 flex-1 text-center">
		<span class="truncate text-sm font-medium">{reader.book?.title}</span>
	</div>

	<div class="relative">
		<button
			data-testid="display-settings-toggle"
			class="rounded p-1.5 hover:bg-accent {displayOpen ? 'text-primary' : ''}"
			title="Display settings"
			onclick={() => (displayOpen = !displayOpen)}
		>
			<Type class="size-4" />
		</button>
		{#if displayOpen}
			<DisplaySettings onclose={() => (displayOpen = false)} />
		{/if}
	</div>
	<button
		data-testid="annotations-toggle"
		class="rounded p-1.5 hover:bg-accent {ui.annotationsOpen ? 'text-primary' : ''}"
		title="Annotations"
		onclick={() => (ui.annotationsOpen = !ui.annotationsOpen)}
	>
		<Highlighter class="size-4" />
	</button>
	<button
		data-testid="chat-toggle"
		class="rounded p-1.5 hover:bg-accent {ui.chatOpen ? 'text-primary' : ''}"
		title="Chat"
		onclick={() => (ui.chatOpen = !ui.chatOpen)}
	>
		<MessageSquare class="size-4" />
	</button>
</div>
