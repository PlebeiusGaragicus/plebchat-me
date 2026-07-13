<script lang="ts">
	// PORT NOTE (Phase 2): the "Chat about this" action returns in Phase 4.
	import { Copy, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { HighlightColor } from '$lib/db/types.js';
	import { HIGHLIGHT_COLORS, clearSelection } from '$lib/read/epub/service.js';
	import { annotations } from '$lib/read/stores/annotations.svelte.js';
	import { selection } from '$lib/read/stores/selection.svelte.js';

	const COLORS = Object.keys(HIGHLIGHT_COLORS) as HighlightColor[];

	let menu: HTMLElement | undefined = $state();
	let noteDraft = $state('');
	let noteOpen = $state(false);

	const editing = $derived(selection.editingId ? annotations.byId(selection.editingId) : undefined);
	const anchor = $derived(selection.active?.rect ?? selection.editingRect);

	// Seed the note editor when editing an existing annotation.
	$effect(() => {
		noteDraft = editing?.note ?? '';
		noteOpen = Boolean(editing?.note);
	});

	// Clamp the menu into the viewport, below (or above) the anchor.
	const style = $derived.by(() => {
		const width = 272;
		if (!anchor) return `left: 50%; top: 20%; transform: translateX(-50%); width: ${width}px;`;
		const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
		const below = anchor.bottom + 8;
		const top = below + 200 > window.innerHeight ? Math.max(8, anchor.top - 208) : below;
		return `left: ${left}px; top: ${top}px; width: ${width}px;`;
	});

	function close() {
		clearSelection();
		selection.clear();
	}

	async function pickColor(color: HighlightColor) {
		if (editing) {
			await annotations.update(editing.id, { color: editing.color === color ? undefined : color });
			close();
			return;
		}
		const sel = selection.active;
		if (!sel) return;
		await annotations.create({
			cfiRange: sel.cfiRange,
			quote: sel.text,
			color,
			note: noteDraft.trim() || undefined
		});
		close();
	}

	async function saveNote() {
		const note = noteDraft.trim() || undefined;
		if (editing) {
			await annotations.update(editing.id, { note });
		} else if (selection.active) {
			const sel = selection.active;
			await annotations.create({ cfiRange: sel.cfiRange, quote: sel.text, note });
		}
		close();
	}

	async function copyText() {
		const text = editing?.quote ?? selection.active?.text;
		if (text) {
			await navigator.clipboard.writeText(text);
			toast.success('Copied');
		}
		close();
	}
</script>

<!-- Backdrop: any click outside the menu dismisses it. -->
<div class="fixed inset-0 z-40" role="presentation" onmousedown={close}></div>

<div
	bind:this={menu}
	{style}
	class="fixed z-50 rounded-xl border border-border bg-popover p-3 shadow-xl"
	role="dialog"
	aria-label="Annotation menu"
	data-testid="annotation-menu"
>
	<div class="mb-2 flex items-center justify-between gap-2">
		<div class="flex gap-1.5">
			{#each COLORS as color (color)}
				<button
					data-testid="highlight-{color}"
					class="size-6 rounded-full border-2 transition hover:scale-110 {editing?.color === color
						? 'border-foreground'
						: 'border-transparent'}"
					style="background: {HIGHLIGHT_COLORS[color]}"
					title="Highlight {color}"
					aria-label="Highlight {color}"
					onclick={() => void pickColor(color)}
				></button>
			{/each}
		</div>
		<div class="flex gap-1">
			<button
				class="rounded p-1.5 text-muted-foreground hover:bg-accent"
				title="Copy text"
				onclick={() => void copyText()}
			>
				<Copy class="size-4" />
			</button>
			{#if editing}
				<button
					data-testid="annotation-delete"
					class="rounded p-1.5 text-destructive hover:bg-destructive/10"
					title="Delete annotation"
					onclick={() => {
						void annotations.remove(editing.id);
						close();
					}}
				>
					<Trash2 class="size-4" />
				</button>
			{/if}
		</div>
	</div>

	{#if noteOpen}
		<textarea
			data-testid="note-input"
			class="mb-2 w-full resize-none rounded-lg border border-border bg-transparent p-2 text-sm focus:outline-none"
			rows="3"
			placeholder="Write a note…"
			bind:value={noteDraft}
		></textarea>
		<button
			data-testid="note-save"
			class="w-full rounded-lg bg-primary py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			onclick={() => void saveNote()}
		>
			Save note
		</button>
	{:else}
		<button
			data-testid="note-open"
			class="w-full rounded-lg border border-border py-1.5 text-sm hover:bg-accent"
			onclick={() => (noteOpen = true)}
		>
			{editing ? 'Add a note' : 'Note only (no highlight)'}
		</button>
	{/if}
</div>
