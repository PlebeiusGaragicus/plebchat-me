<script lang="ts">
	// Metadata editor (SvelteReader style): cover + title/author up top, the
	// rest below. Saving bumps updatedAt so the next explicit sync publishes
	// the change; the cover is device-local (restores re-extract it from the
	// EPUB bytes, see import.ts).
	import { Cloud, Lock, Upload, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { db } from '$lib/db/index.js';
	import { library } from '$lib/read/stores/library.svelte.js';
	import { sync } from '$lib/read/stores/sync.svelte.js';
	import { ui } from '$lib/read/stores/ui.svelte.js';

	let { sha256 }: { sha256: string } = $props();

	const book = $derived(library.books.find((b) => b.sha256 === sha256));
	const currentCover = $derived(library.coverUrls[sha256]);

	let title = $state('');
	let creator = $state('');
	let publisher = $state('');
	let language = $state('');
	let isbn = $state('');
	let description = $state('');
	let localOnly = $state(false);
	let newCover = $state<{ blob: Blob; url: string } | null>(null);
	let saving = $state(false);
	let seededSha = '';

	$effect(() => {
		if (!book) {
			ui.editSha = null; // Deleted while open.
			return;
		}
		if (seededSha === book.sha256) return;
		seededSha = book.sha256;
		title = book.title;
		creator = book.creator;
		publisher = book.publisher ?? '';
		language = book.language ?? '';
		isbn = book.isbn ?? '';
		description = book.description ?? '';
		localOnly = book.localOnly ?? false;
	});

	$effect(() => () => {
		if (newCover) URL.revokeObjectURL(newCover.url);
	});

	/** Center-crop to the card's 2:3 ratio and bound the size — uploads can be
	 * arbitrarily large photos. */
	async function processCover(file: File): Promise<Blob> {
		const bitmap = await createImageBitmap(file);
		const ratio = 2 / 3;
		let cropW = bitmap.width;
		let cropH = cropW / ratio;
		if (cropH > bitmap.height) {
			cropH = bitmap.height;
			cropW = cropH * ratio;
		}
		const scale = Math.min(1, 512 / cropW);
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(cropW * scale);
		canvas.height = Math.round(cropH * scale);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas unavailable');
		ctx.drawImage(
			bitmap,
			(bitmap.width - cropW) / 2,
			(bitmap.height - cropH) / 2,
			cropW,
			cropH,
			0,
			0,
			canvas.width,
			canvas.height
		);
		bitmap.close();
		return new Promise((resolve, reject) =>
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('Could not encode cover'))),
				'image/jpeg',
				0.8
			)
		);
	}

	async function onCoverChange(e: Event): Promise<void> {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			const blob = await processCover(file);
			if (newCover) URL.revokeObjectURL(newCover.url);
			newCover = { blob, url: URL.createObjectURL(blob) };
		} catch (err) {
			console.error(err);
			toast.error('Could not read that image');
		}
	}

	async function save(): Promise<void> {
		if (!book || !title.trim() || saving) return;
		saving = true;
		try {
			await db.books.save({
				...book,
				title: title.trim(),
				creator: creator.trim() || 'Unknown',
				publisher: publisher.trim() || undefined,
				language: language.trim() || undefined,
				isbn: isbn.trim() || undefined,
				description: description.trim() || undefined,
				localOnly: localOnly || undefined,
				updatedAt: Date.now()
			});
			if (newCover) {
				await db.covers.save({ sha256, blob: newCover.blob, mimeType: 'image/jpeg' });
			}
			await library.refresh();
			await sync.checkDirty();
			toast.success(
				localOnly ? 'Saved — this book stays on this device' : 'Saved — sync to publish the change'
			);
			close();
		} catch (err) {
			console.error(err);
			toast.error('Could not save changes');
		} finally {
			saving = false;
		}
	}

	function close(): void {
		ui.editSha = null;
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
			class="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-border bg-popover p-5 shadow-xl"
			role="dialog"
			aria-label="Edit book metadata"
			data-testid="book-edit-dialog"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Edit metadata</h2>
				<button class="rounded p-1 hover:bg-accent" title="Close" onclick={close}>
					<X class="size-4" />
				</button>
			</div>

			<div class="mb-4 flex gap-4">
				<label class="group relative block h-36 w-24 shrink-0 cursor-pointer overflow-hidden rounded border border-border bg-muted">
					{#if newCover}
						<img src={newCover.url} alt="" class="h-full w-full object-cover" />
					{:else if currentCover}
						<img src={currentCover} alt="" class="h-full w-full object-cover" />
					{:else}
						<span class="flex h-full items-center justify-center text-muted-foreground">
							<Upload class="size-5" />
						</span>
					{/if}
					<span
						class="absolute inset-0 flex items-center justify-center bg-zinc-950/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
					>
						Replace cover
					</span>
					<input type="file" accept="image/*" class="hidden" onchange={onCoverChange} />
				</label>

				<div class="flex min-w-0 flex-1 flex-col gap-2">
					<label class="text-xs text-muted-foreground">
						Title
						<input
							data-testid="edit-title"
							class="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
							bind:value={title}
						/>
					</label>
					<label class="text-xs text-muted-foreground">
						Author
						<input
							data-testid="edit-creator"
							class="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
							bind:value={creator}
						/>
					</label>
				</div>
			</div>

			<div class="mb-2 grid grid-cols-2 gap-3">
				<label class="text-xs text-muted-foreground">
					Publisher
					<input
						class="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
						bind:value={publisher}
					/>
				</label>
				<label class="text-xs text-muted-foreground">
					Language
					<input
						class="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
						bind:value={language}
					/>
				</label>
			</div>
			<label class="mb-2 block text-xs text-muted-foreground">
				ISBN
				<input
					class="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
					bind:value={isbn}
				/>
			</label>
			<label class="mb-4 block text-xs text-muted-foreground">
				Description
				<textarea
					rows="3"
					class="mt-0.5 w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
					bind:value={description}
				></textarea>
			</label>

			<h3 class="mb-1.5 text-xs font-medium text-muted-foreground">Sync</h3>
			<div class="mb-4 flex flex-col gap-2">
				<label
					class="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 {!localOnly
						? 'border-primary bg-primary/5'
						: 'border-border hover:bg-accent/50'}"
				>
					<input
						type="radio"
						class="sr-only"
						name="book-sync-mode"
						checked={!localOnly}
						onchange={() => (localOnly = false)}
					/>
					<Cloud class="mt-0.5 size-4 shrink-0 {!localOnly ? 'text-primary' : 'text-muted-foreground'}" />
					<span class="text-xs">
						<span class="block font-medium text-foreground">Sync to your relays</span>
						<span class="text-muted-foreground">
							Metadata, progress, and annotations follow you across devices (encrypted, unless
							you share them).
						</span>
					</span>
				</label>
				<label
					data-testid="edit-local-only"
					class="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 {localOnly
						? 'border-primary bg-primary/5'
						: 'border-border hover:bg-accent/50'}"
				>
					<input
						type="radio"
						class="sr-only"
						name="book-sync-mode"
						checked={localOnly}
						onchange={() => (localOnly = true)}
					/>
					<Lock class="mt-0.5 size-4 shrink-0 {localOnly ? 'text-primary' : 'text-muted-foreground'}" />
					<span class="text-xs">
						<span class="block font-medium text-foreground">Local only</span>
						<span class="text-muted-foreground">
							This book, its progress, and its annotations never leave this device. Anything
							already synced stays on your relays until the book is deleted.
						</span>
					</span>
				</label>
			</div>

			<div class="flex justify-end gap-2">
				<button
					class="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/70"
					disabled={saving}
					onclick={close}
				>
					Cancel
				</button>
				<button
					data-testid="edit-save"
					class="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					disabled={saving || !title.trim()}
					onclick={() => void save()}
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
