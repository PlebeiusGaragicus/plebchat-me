<script lang="ts">
	import { Ellipsis, Info, Trash2 } from '@lucide/svelte';
	import type { Book } from '$lib/db/types.js';
	import { library } from '$lib/read/stores/library.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';

	let { book }: { book: Book } = $props();

	let confirming = $state<'delete' | null>(null);
	let menuOpen = $state(false);

	const cover = $derived(library.coverUrls[book.sha256]);
	const pct = $derived(library.progressBySha[book.sha256]);
	const missing = $derived(library.missingFiles[book.sha256] ?? false);
</script>

<div class="group relative" data-testid="book-card" data-sha={book.sha256}>
	<button
		class="block w-full overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:shadow-md"
		onclick={() => void library.open(book.sha256)}
	>
		<div class="relative aspect-2/3 bg-muted">
			{#if cover}
				<img src={cover} alt="" class="h-full w-full object-cover" />
			{:else}
				<div class="flex h-full items-center justify-center p-3 text-center">
					<span class="text-sm font-medium text-muted-foreground">{book.title}</span>
				</div>
			{/if}
			{#if pct !== undefined && pct > 0}
				<span
					class="absolute right-1.5 bottom-1.5 rounded bg-zinc-950/70 px-1.5 py-0.5 text-xs font-medium text-white"
				>
					{Math.round(pct * 100)}%
				</span>
			{/if}
			{#if missing}
				<div
					class="absolute inset-0 flex items-center justify-center bg-zinc-950/60 text-xs font-medium text-white"
				>
					Not on this device
				</div>
			{/if}
		</div>
		<div class="p-2.5">
			<div class="truncate text-sm font-medium" title={book.title}>{book.title}</div>
			<div class="truncate text-xs text-muted-foreground">{book.creator}</div>
		</div>
	</button>

	<!-- One entry point for card actions, mouse and touch alike: always visible
	     on coarse pointers (no hover to reveal it), hover/focus-revealed on fine
	     pointers to keep the grid quiet. -->
	<!-- PORT NOTE (Phase 2): Blossom backup/restore menu entries return in Phase 5. -->
	<button
		class="absolute top-1.5 right-1.5 z-10 rounded bg-zinc-950/60 p-1.5 text-zinc-200 transition-opacity hover:text-white pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 {menuOpen
			? 'pointer-fine:opacity-100'
			: ''}"
		title="Book actions"
		onclick={(e) => {
			e.stopPropagation();
			menuOpen = !menuOpen;
		}}
	>
		<Ellipsis class="size-3.5" />
	</button>

	{#if menuOpen}
		<div
			class="fixed inset-0 z-20"
			role="presentation"
			onmousedown={() => (menuOpen = false)}
		></div>
		<div
			class="absolute top-8 right-1.5 z-30 w-40 overflow-hidden rounded-lg border border-border bg-popover py-1 text-sm shadow-lg"
			role="menu"
		>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
				role="menuitem"
				onclick={() => {
					menuOpen = false;
					ui.infoSha = book.sha256;
				}}
			>
				<Info class="size-3.5 text-muted-foreground" /> Info
			</button>
			<button
				class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-destructive hover:bg-accent"
				role="menuitem"
				onclick={() => {
					menuOpen = false;
					confirming = 'delete';
				}}
			>
				<Trash2 class="size-3.5" /> Delete
			</button>
		</div>
	{/if}

	{#if confirming === 'delete'}
		<div
			class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-zinc-950/85 p-3 text-center"
		>
			<p class="text-xs text-zinc-200">
				Delete “{book.title}” and all its annotations from this device?
			</p>
			<div class="flex gap-2">
				<button
					class="rounded bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
					onclick={() => void library.deleteBook(book.sha256).then(() => (confirming = null))}
				>
					Delete
				</button>
				<button
					class="rounded bg-zinc-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-600"
					onclick={() => (confirming = null)}
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>
