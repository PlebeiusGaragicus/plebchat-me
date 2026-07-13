<script lang="ts">
	// PORT NOTE: the "Other readers" (foreign highlights) section returns in Phase 6.
	import { Globe, StickyNote } from '@lucide/svelte';
	import { HIGHLIGHT_COLORS } from '$lib/read/epub/service.js';
	import { annotations } from '$lib/read/stores/annotations.svelte.js';
	import { selection } from '$lib/read/stores/selection.svelte.js';

	let sharingId = $state<string | null>(null);
	let exportHighlight = $state(false);
</script>

<aside
	class="w-72 shrink-0 overflow-y-auto border-l border-border p-3"
	aria-label="Annotations"
	data-testid="annotation-sidebar"
>
	<h3 class="mb-2 text-sm font-semibold text-muted-foreground">
		Annotations ({annotations.all.length})
	</h3>

	{#if annotations.all.length === 0}
		<p class="py-8 text-center text-sm text-muted-foreground">
			Select text in the book to highlight it or attach a note.
		</p>
	{:else}
		<div class="flex flex-col gap-2">
			{#each annotations.all as anno (anno.id)}
				<div
					class="group rounded-lg border border-border p-2.5 hover:border-muted-foreground/40"
					data-testid="annotation-card"
				>
					<button
						class="w-full text-left"
						onclick={() => {
							void annotations.goTo(anno.id).then(() => selection.edit(anno.id, null));
						}}
					>
						<div class="flex items-start gap-2">
							{#if anno.color}
								<span
									class="mt-1 size-3 shrink-0 rounded-full"
									style="background: {HIGHLIGHT_COLORS[anno.color]}"
								></span>
							{:else}
								<StickyNote class="mt-0.5 size-3.5 shrink-0 text-destructive" />
							{/if}
							<div class="min-w-0">
								<p class="line-clamp-3 text-sm">“{anno.quote}”</p>
								{#if anno.note}
									<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{anno.note}</p>
								{/if}
							</div>
						</div>
					</button>

					{#if sharingId === anno.id}
						<div class="mt-2 rounded-lg bg-muted p-2 text-xs">
							<p class="mb-1.5">
								Publish this annotation <strong>in plaintext</strong> to your relays? It stays
								editable, and you can make it private again later.
							</p>
							<label class="mb-2 flex items-center gap-1.5">
								<input type="checkbox" class="accent-primary" bind:checked={exportHighlight} />
								Also publish as a NIP-84 highlight (Highlighter-compatible, immutable)
							</label>
							<div class="flex gap-2">
								<button
									data-testid="annotation-share-confirm"
									class="rounded bg-primary px-2 py-1 font-medium text-primary-foreground hover:bg-primary/90"
									onclick={() => {
										void annotations.setShared(anno.id, true, exportHighlight);
										sharingId = null;
									}}
								>
									Publish
								</button>
								<button class="rounded bg-accent px-2 py-1" onclick={() => (sharingId = null)}>
									Cancel
								</button>
							</div>
						</div>
					{:else}
						<div class="mt-1 flex justify-end">
							<button
								data-testid="annotation-share-toggle"
								class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs {anno.shared
									? 'text-emerald-500'
									: 'hidden text-muted-foreground group-hover:flex hover:text-foreground'}"
								title={anno.shared ? 'Public — click to make private' : 'Share publicly'}
								onclick={() => {
									if (anno.shared) void annotations.setShared(anno.id, false);
									else {
										exportHighlight = false;
										sharingId = anno.id;
									}
								}}
							>
								<Globe class="size-3" />
								{anno.shared ? 'Public' : 'Share'}
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</aside>
