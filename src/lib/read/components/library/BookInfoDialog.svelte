<script lang="ts">
	// Per-book status/diagnostics: metadata, identity, on-device state.
	// PORT NOTE (Phase 2): the Sync status, Public shelf, and Blossom
	// availability-probe sections return with the sync engine (Phases 5–6).
	import { Copy, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { db } from '$lib/db/index.js';
	import { library } from '$lib/read/stores/library.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';
	import { formatBytes } from '$lib/utils.js';

	let { sha256 }: { sha256: string } = $props();

	const book = $derived(library.books.find((b) => b.sha256 === sha256));
	const missing = $derived(library.missingFiles[sha256] ?? false);
	const cover = $derived(library.coverUrls[sha256]);
	const pct = $derived(library.progressBySha[sha256]);

	let annotationCount = $state<number | null>(null);

	$effect(() => {
		if (!book) ui.infoSha = null; // Deleted while open.
	});

	$effect(() => {
		void db.annotations.getByBook(sha256).then((list) => (annotationCount = list.length));
	});

	function copySha(): void {
		void navigator.clipboard.writeText(sha256).then(() => toast.success('sha256 copied'));
	}

	function formatDate(ms: number | undefined): string {
		return ms
			? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
			: '—';
	}

	function close(): void {
		ui.infoSha = null;
	}
</script>

{#if book}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
		role="presentation"
		onmousedown={(e) => {
			if (e.target === e.currentTarget) close();
		}}
	>
		<div
			class="max-h-full w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-popover p-5 shadow-xl"
			role="dialog"
			aria-label="Book info"
		>
			<div class="mb-4 flex items-start justify-between gap-3">
				<div class="flex min-w-0 gap-3">
					{#if cover}
						<img src={cover} alt="" class="h-20 w-14 shrink-0 rounded object-cover" />
					{/if}
					<div class="min-w-0">
						<h2 class="text-lg leading-tight font-semibold">{book.title}</h2>
						<p class="truncate text-sm text-muted-foreground">{book.creator}</p>
						{#if book.publisher || book.language}
							<p class="truncate text-xs text-muted-foreground">
								{[book.publisher, book.language, book.isbn ? `ISBN ${book.isbn}` : '']
									.filter(Boolean)
									.join(' · ')}
							</p>
						{/if}
					</div>
				</div>
				<button class="rounded p-1 hover:bg-accent" title="Close" onclick={close}>
					<X class="size-4" />
				</button>
			</div>

			<h3 class="mb-1 text-sm font-medium">On this device</h3>
			<dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
				<dt class="text-muted-foreground">File</dt>
				<dd class={missing ? 'text-destructive' : ''}>
					{missing ? 'Missing — metadata only' : formatBytes(book.fileSize)}
				</dd>
				<dt class="text-muted-foreground">Progress</dt>
				<dd>{pct !== undefined ? `${Math.round(pct * 100)}%` : 'Not started'}</dd>
				<dt class="text-muted-foreground">Annotations</dt>
				<dd>{annotationCount ?? '…'}</dd>
				<dt class="text-muted-foreground">Added</dt>
				<dd>{formatDate(book.addedAt)}</dd>
				<dt class="text-muted-foreground">Last opened</dt>
				<dd>{formatDate(book.lastOpenedAt)}</dd>
			</dl>

			<h3 class="mb-1 text-sm font-medium">Identity</h3>
			<div class="flex items-center gap-1.5">
				<code class="min-w-0 truncate rounded bg-muted px-1.5 py-0.5 text-xs">
					{sha256}
				</code>
				<button
					class="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
					title="Copy sha256"
					onclick={copySha}
				>
					<Copy class="size-3.5" />
				</button>
			</div>
		</div>
	</div>
{/if}
