<script lang="ts">
	// Placeholder page for a mode that hasn't been built out yet — points at
	// its proposal document so the plan is one click away.
	import { base } from '$app/paths';

	let { name, summary, proposal }: { name: string; summary: string; proposal: string } = $props();
</script>

<div class="mx-auto max-w-2xl px-4 py-16 text-center">
	<h1 class="text-3xl font-bold tracking-tight">{name}</h1>
	<p class="mt-3 text-muted-foreground">{summary}</p>
	<p class="mt-8 text-sm text-muted-foreground">
		This mode is under construction — see its
		<a
			class="font-medium text-primary underline underline-offset-4"
			href="{base}/docs/proposals/{proposal}/"
		>
			proposal document
		</a>
		for the plan and progress.
	</p>
</div>
