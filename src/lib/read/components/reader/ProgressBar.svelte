<script lang="ts">
	// Bottom progress footer (SvelteReader style, rebuilt on foliate's native
	// section fractions): a meta line (% read, current section) over a rounded
	// track of clickable chapter segments with a progress fill and a hover
	// tooltip naming the hovered chapter.
	import { getSectionSegments, goToFraction, type SectionSegment } from '$lib/read/epub/service.js';
	import { reader } from '$lib/read/stores/reader.svelte.js';

	let segments = $state<SectionSegment[]>([]);
	let hovered = $state<number | null>(null);

	// Section sizes exist once the view has opened the book — bookReady flips
	// before that (the viewer attaches afterwards), so key off the first
	// relocation instead and compute once per book.
	$effect(() => {
		if (!reader.bookReady) {
			segments = [];
			return;
		}
		void reader.location;
		if (segments.length === 0) segments = getSectionSegments();
	});

	const fraction = $derived(reader.percentage ?? 0);
	const hoveredSeg = $derived(hovered !== null ? segments[hovered] : undefined);
</script>

{#if segments.length > 1}
	<div
		class="shrink-0 border-t border-border px-4 py-1.5"
		data-testid="progress-bar"
		role="navigation"
		aria-label="Book progress"
	>
		<div class="flex items-center justify-between gap-4 text-xs text-muted-foreground">
			<span class="shrink-0 tabular-nums">{Math.round(fraction * 100)}%</span>
			{#if reader.location?.sectionLabel}
				<span class="min-w-0 truncate">{reader.location.sectionLabel}</span>
			{/if}
		</div>
		<div class="relative mt-1 h-2 w-full">
			<!-- Chapter segments track -->
			<div class="absolute inset-0 flex overflow-hidden rounded-full">
				{#each segments as seg, i (seg.start)}
					<button
						data-testid="progress-segment"
						class="h-full transition-colors {hovered === i ? 'bg-muted-foreground/40' : 'bg-muted'}"
						style="width: {(seg.end - seg.start) * 100}%; {i > 0
							? 'border-left: 1px solid var(--border);'
							: ''}"
						aria-label="Go to {seg.label ?? `section ${i + 1}`}"
						onmouseenter={() => (hovered = i)}
						onmouseleave={() => (hovered = null)}
						onclick={() => goToFraction(seg.start)}
					></button>
				{/each}
			</div>
			<!-- Progress fill overlay -->
			<div
				class="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-full"
				style="width: {Math.min(100, Math.max(0, fraction * 100))}%"
			>
				<div class="h-full w-full bg-primary/50"></div>
			</div>
			<!-- Current position marker -->
			<div
				data-testid="progress-marker"
				class="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
				style="left: {Math.min(100, Math.max(0, fraction * 100))}%"
			></div>
			<!-- Hovered chapter tooltip -->
			{#if hoveredSeg?.label}
				<div
					class="pointer-events-none absolute bottom-full z-10 mb-2 max-w-64 -translate-x-1/2 truncate rounded border border-border bg-popover px-2 py-1 text-xs shadow-md"
					style="left: {((hoveredSeg.start + hoveredSeg.end) / 2) * 100}%"
				>
					{hoveredSeg.label}
				</div>
			{/if}
		</div>
	</div>
{/if}
