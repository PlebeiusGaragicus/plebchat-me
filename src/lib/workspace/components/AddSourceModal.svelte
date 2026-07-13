<script lang="ts">
	// Manual source entry: title + optional URL + pasted markdown. Agent-driven
	// scraping (Firecrawl) joins in Phase 4; this stays as the by-hand path.
	import { X } from '@lucide/svelte';
	import { sources } from '../stores/sources.svelte.js';

	interface Props {
		onClose: () => void;
		onAdded: (id: string) => void;
	}

	let { onClose, onAdded }: Props = $props();

	let title = $state('');
	let url = $state('');
	let content = $state('');

	async function add() {
		if (!title.trim()) return;
		const source = await sources.create({
			title: title.trim(),
			url: url.trim(),
			content: content.trim()
		});
		if (source) onAdded(source.id);
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
	<div class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-border bg-popover shadow-xl">
		<div class="flex items-center justify-between border-b border-border px-4 py-3">
			<h3 class="text-sm font-semibold">Add source</h3>
			<button
				onclick={onClose}
				aria-label="Close"
				class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
		<div class="flex flex-col gap-3 overflow-y-auto p-4">
			<input
				type="text"
				bind:value={title}
				placeholder="Title"
				class="rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
			/>
			<input
				type="url"
				bind:value={url}
				placeholder="URL (optional)"
				class="rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
			/>
			<textarea
				bind:value={content}
				placeholder="Paste the source content (markdown)…"
				rows="8"
				class="resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
			></textarea>
		</div>
		<div class="flex justify-end gap-2 border-t border-border px-4 py-3">
			<button
				onclick={onClose}
				class="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
			>
				Cancel
			</button>
			<button
				onclick={add}
				disabled={!title.trim()}
				class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
			>
				Add source
			</button>
		</div>
	</div>
</div>
