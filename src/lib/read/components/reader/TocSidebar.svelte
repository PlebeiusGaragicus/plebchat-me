<script lang="ts">
	import { reader } from '$lib/read/stores/reader.svelte.js';

	const currentHref = $derived(reader.location?.sectionHref?.split('#')[0]);
</script>

<nav
	class="w-64 shrink-0 overflow-y-auto border-r border-border py-2"
	aria-label="Table of contents"
	data-testid="toc-sidebar"
>
	{#each reader.toc as entry (entry.href + entry.label)}
		<button
			class="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-accent {currentHref ===
			entry.href.split('#')[0]
				? 'font-medium text-primary'
				: 'text-muted-foreground'}"
			style="padding-left: {0.75 + entry.depth * 0.9}rem"
			onclick={() => void reader.display(entry.href)}
		>
			{entry.label}
		</button>
	{/each}
</nav>
