<script lang="ts">
	import { Check, CircleAlert, Globe, LoaderCircle, Search, Zap } from '@lucide/svelte';
	import type { ToolRun } from '$lib/ai/runner.svelte.js';

	let { run }: { run: ToolRun } = $props();

	const ICONS: Record<string, typeof Search> = {
		web_search: Search,
		fetch_page: Globe,
		nostr_search: Zap
	};
	const Icon = $derived(ICONS[run.name] ?? Search);

	function argSummary(args: unknown): string {
		if (!args || typeof args !== 'object') return '';
		const record = args as Record<string, unknown>;
		const value = record.query ?? record.url ?? '';
		return typeof value === 'string' ? value : '';
	}

	let expanded = $state(false);
</script>

<div
	data-testid="tool-call-{run.name}"
	class="mb-2 rounded-lg border border-border bg-muted/40 text-xs"
>
	<button
		class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-accent/50"
		onclick={() => (expanded = !expanded)}
	>
		<Icon class="size-3.5 shrink-0 text-muted-foreground" />
		<span class="font-medium">{run.name}</span>
		<span class="min-w-0 flex-1 truncate text-muted-foreground">{argSummary(run.args)}</span>
		{#if run.status === 'running'}
			<LoaderCircle class="size-3.5 shrink-0 animate-spin text-primary" />
		{:else if run.status === 'error'}
			<CircleAlert class="size-3.5 shrink-0 text-destructive" />
		{:else}
			<Check class="size-3.5 shrink-0 text-primary" />
		{/if}
	</button>
	{#if expanded && run.resultText}
		<div
			class="max-h-48 overflow-y-auto border-t border-border px-2.5 py-2 whitespace-pre-wrap text-muted-foreground"
		>
			{run.resultText}
		</div>
	{/if}
</div>
