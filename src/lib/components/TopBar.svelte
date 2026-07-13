<script lang="ts">
	import { Cyphertap } from 'cyphertap';
	import { Zap } from '@lucide/svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import ModeSelector from './ModeSelector.svelte';
	import { RELAYS, MINTS } from '$lib/relays';
</script>

<header class="border-b border-border">
	<div class="flex h-14 items-center justify-between px-4">
		<div class="flex items-center gap-3">
			<a href={resolve('/')} class="flex items-center gap-2">
				<Zap class="h-6 w-6 text-primary" />
				<span class="text-xl font-bold">PlebChat</span>
			</a>
			<span class="text-muted-foreground/40">|</span>
			<ModeSelector />
		</div>

		<div class="flex items-center gap-2">
			{#if browser}
				<Cyphertap relays={RELAYS} mints={MINTS} />
			{:else}
				<div class="h-9 w-9"></div>
			{/if}
		</div>
	</div>
</header>
