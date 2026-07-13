<script lang="ts">
	import { modeStore, type AppMode } from '$lib/stores/mode.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	function enterMode(mode: AppMode) {
		modeStore.setMode(mode);
		goto(resolve(modeStore.getModeInfo(mode).route));
	}
</script>

<div class="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
	<h1 class="text-4xl font-bold tracking-tight">Welcome to PlebChat</h1>
	<p class="mt-3 max-w-xl text-muted-foreground">
		Read, research, write and debate — on nostr, with your own keys. No accounts, no platform
		cloud. Pick a mode to get started.
	</p>

	<div class="mt-12 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
		{#each modeStore.modes as mode (mode.id)}
			{@const ModeIcon = mode.icon}
			<button
				data-testid="mode-card-{mode.id}"
				onclick={() => enterMode(mode.id)}
				class="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
			>
				<div
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
				>
					<ModeIcon class="h-5 w-5" />
				</div>
				<div>
					<p class="font-semibold">{mode.name}</p>
					<p class="mt-1 text-sm text-muted-foreground">{mode.description}</p>
				</div>
			</button>
		{/each}
	</div>
</div>
