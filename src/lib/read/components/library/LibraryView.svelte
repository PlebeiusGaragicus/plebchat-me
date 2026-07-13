<script lang="ts">
	import { BookOpen, Settings, Users } from '@lucide/svelte';
	import { browse } from '$lib/read/stores/browse.svelte.js';
	import { library } from '$lib/read/stores/library.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';
	import BookCard from './BookCard.svelte';
	import BookEditDialog from './BookEditDialog.svelte';
	import BookInfoDialog from './BookInfoDialog.svelte';
	import ImportButton from './ImportButton.svelte';
	import SyncStatusButton from './SyncStatusButton.svelte';

	let dragging = $state(false);

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const files = e.dataTransfer?.files;
		if (files?.length) void library.importFiles(files);
	}
</script>

<div
	class="h-full overflow-y-auto p-6 {dragging ? 'bg-primary/5 outline-2 outline-dashed outline-primary' : ''}"
	role="region"
	aria-label="Library"
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={onDrop}
>
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-xl font-semibold">Library</h2>
		<div class="flex items-center gap-2">
			<ImportButton />
			<button
				data-testid="browse-button"
				class="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
				title="Browse other libraries"
				onclick={() => {
					browse.open();
					ui.view = 'browse';
				}}
			>
				<Users class="size-4" />
			</button>
			<SyncStatusButton />
			<button
				data-testid="read-settings-toggle"
				class="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
				title="Read settings"
				onclick={() => (ui.settingsOpen = true)}
			>
				<Settings class="size-4" />
			</button>
		</div>
	</div>

	{#if library.books.length === 0}
		<div class="flex flex-col items-center justify-center gap-3 py-24 text-center">
			<BookOpen class="size-12 text-muted-foreground/40" />
			<h3 class="text-lg font-medium">Your library is empty</h3>
			<p class="max-w-md text-sm text-muted-foreground">
				Import an EPUB (or drop one anywhere on this page). Books are stored in this browser,
				under your nostr identity.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-5">
			{#each library.books as book (book.sha256)}
				<BookCard {book} />
			{/each}
		</div>
	{/if}
</div>

{#if ui.infoSha}
	<BookInfoDialog sha256={ui.infoSha} />
{/if}

{#if ui.editSha}
	<BookEditDialog sha256={ui.editSha} />
{/if}
