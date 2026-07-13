<script lang="ts">
	import { Loader2, Plus } from '@lucide/svelte';
	import { library } from '$lib/read/stores/library.svelte.js';

	let input: HTMLInputElement | undefined = $state();
</script>

<input
	bind:this={input}
	type="file"
	accept=".epub,application/epub+zip"
	multiple
	class="hidden"
	onchange={(e) => {
		const files = e.currentTarget.files;
		if (files?.length) void library.importFiles(files);
		e.currentTarget.value = '';
	}}
/>

<button
	data-testid="import-epub"
	class="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
	disabled={library.importing}
	onclick={() => input?.click()}
>
	{#if library.importing}
		<Loader2 class="size-4 animate-spin" /> Importing…
	{:else}
		<Plus class="size-4" /> Import EPUB
	{/if}
</button>
