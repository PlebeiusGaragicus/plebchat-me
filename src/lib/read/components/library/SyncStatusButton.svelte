<script lang="ts">
	// Cloud icon + status popover (SvelteReader style): the icon reads at a
	// glance (cloud / spinning / check / error, dot = unsynced changes), the
	// popover spells out what sync does, when it last ran, and what it moved.
	import { AlertCircle, Check, Cloud, RefreshCw } from '@lucide/svelte';
	import { sync } from '$lib/read/stores/sync.svelte.js';

	let open = $state(false);

	function formatTime(ms: number): string {
		const diff = Date.now() - ms;
		if (diff < 60_000) return 'Just now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<div class="relative">
	<button
		data-testid="sync-button"
		class="relative rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground {open
			? 'bg-accent text-foreground'
			: ''}"
		title="Nostr sync"
		onclick={() => (open = !open)}
	>
		{#if sync.status === 'syncing'}
			<RefreshCw class="size-4 animate-spin text-primary" />
		{:else if sync.status === 'success'}
			<Check class="size-4 text-emerald-500" />
		{:else if sync.status === 'error'}
			<AlertCircle class="size-4 text-destructive" />
		{:else}
			<Cloud class="size-4" />
		{/if}
		{#if sync.dirty && sync.status !== 'syncing'}
			<span
				data-testid="sync-dirty-dot"
				class="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
			></span>
		{/if}
	</button>

	{#if open}
		<div class="fixed inset-0 z-20" role="presentation" onmousedown={() => (open = false)}></div>
		<div
			data-testid="sync-popover"
			class="absolute top-full right-0 z-30 mt-2 w-72 rounded-lg border border-border bg-popover p-4 text-sm shadow-lg"
		>
			<div class="mb-2 flex items-center justify-between">
				<h4 class="font-semibold">Nostr sync</h4>
				<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
					{#if sync.status === 'syncing'}
						<span class="size-1.5 animate-pulse rounded-full bg-primary"></span> Syncing…
					{:else if sync.dirty}
						<span class="size-1.5 rounded-full bg-primary"></span> Unsynced changes
					{:else if sync.lastSynced}
						<span class="size-1.5 rounded-full bg-emerald-500"></span> Up to date
					{:else}
						<span class="size-1.5 rounded-full bg-muted-foreground"></span> Not synced yet
					{/if}
				</span>
			</div>

			<p class="mb-3 text-xs text-muted-foreground">
				Pushes your local changes (books, progress, annotations, settings) to your relays and
				pulls what you published from other devices. Runs only when you ask — never in the
				background.
			</p>

			<div class="mb-3 space-y-1 text-xs">
				<div class="flex justify-between">
					<span class="text-muted-foreground">Last sync</span>
					<span>{sync.lastSynced ? formatTime(sync.lastSynced) : 'Never (this session)'}</span>
				</div>
				{#if sync.lastSummary}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Pushed to relays</span>
						<span>{sync.lastSummary.pushed}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Pulled from relays</span>
						<span>{sync.lastSummary.pulled}</span>
					</div>
					{#if sync.lastSummary.deletedLocally}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Removed (deleted elsewhere)</span>
							<span>{sync.lastSummary.deletedLocally}</span>
						</div>
					{/if}
					{#if sync.lastSummary.restorableBooks.length}
						<div class="flex justify-between text-amber-500">
							<span>Books restorable from backup</span>
							<span>{sync.lastSummary.restorableBooks.length}</span>
						</div>
					{/if}
				{/if}
			</div>

			{#if sync.status === 'error' && sync.error}
				<p class="mb-3 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
					{sync.error}
				</p>
			{/if}

			<button
				data-testid="sync-now"
				class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				disabled={sync.status === 'syncing'}
				onclick={() => void sync.run()}
			>
				<RefreshCw class="size-3.5 {sync.status === 'syncing' ? 'animate-spin' : ''}" />
				{sync.status === 'syncing' ? 'Syncing…' : 'Sync now'}
			</button>
		</div>
	{/if}
</div>
