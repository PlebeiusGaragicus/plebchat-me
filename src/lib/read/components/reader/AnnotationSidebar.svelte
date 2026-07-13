<script lang="ts">
	// PORT NOTE (Phase 2): the per-annotation Share toggle returns in Phase 5;
	// the "Other readers" (foreign highlights) section returns in Phase 6.
	import { StickyNote } from '@lucide/svelte';
	import { HIGHLIGHT_COLORS } from '$lib/read/epub/service.js';
	import { annotations } from '$lib/read/stores/annotations.svelte.js';
	import { selection } from '$lib/read/stores/selection.svelte.js';
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
				</div>
			{/each}
		</div>
	{/if}
</aside>
