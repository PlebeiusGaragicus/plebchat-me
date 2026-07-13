<script lang="ts">
	// Chapter-segmented progress bar (adopted from SvelteReader, rebuilt on
	// foliate's native section fractions): one clickable segment per spine
	// section with its ToC label as tooltip, and a marker at the current spot.
	import { getSectionSegments, goToFraction, type SectionSegment } from '$lib/read/epub/service.js';
	import { reader } from '$lib/read/stores/reader.svelte.js';

	let segments = $state<SectionSegment[]>([]);

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
</script>

{#if segments.length > 1}
	<div
		class="relative flex h-2 shrink-0 gap-px border-b border-border bg-background px-0"
		data-testid="progress-bar"
		role="navigation"
		aria-label="Book progress"
	>
		{#each segments as seg, i (seg.start)}
			<button
				data-testid="progress-segment"
				class="group relative h-full {fraction >= seg.end
					? 'bg-primary/40'
					: fraction > seg.start
						? 'bg-primary/20'
						: 'bg-muted'} transition-colors hover:bg-primary/60"
				style="width: {(seg.end - seg.start) * 100}%"
				title={seg.label ?? `Section ${i + 1}`}
				aria-label={seg.label ?? `Section ${i + 1}`}
				onclick={() => goToFraction(seg.start)}
			></button>
		{/each}
		<!-- Current position marker -->
		<div
			data-testid="progress-marker"
			class="pointer-events-none absolute top-0 h-full w-0.5 bg-primary"
			style="left: {Math.min(100, Math.max(0, fraction * 100))}%"
		></div>
	</div>
{/if}
