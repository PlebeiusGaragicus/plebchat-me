<script lang="ts">
	// cyphertap's theme CSS must be imported explicitly — the library's own
	// side-effect CSS import gets tree-shaken out of consumer production builds.
	import 'cyphertap/styles.css';
	import '../app.css';
	import '../theme.css';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { Toaster } from 'svelte-sonner';
	import { cyphertap } from 'cyphertap';
	import TopBar from '$lib/components/TopBar.svelte';
	import { session } from '$lib/session/index.svelte';
	import { shell } from '$lib/stores/shell.svelte';

	let { children } = $props();

	// Bridge cyphertap's identity to the session (and per-npub DB) lifecycle —
	// here, not in a mode page, so the DB is open regardless of route.
	$effect(() => {
		const npub = cyphertap.npub;
		if (cyphertap.isLoggedIn && npub) void session.start(npub);
		else if (!cyphertap.isLoggedIn && session.activeNpub) void session.stop();
	});
</script>

<!-- App chrome follows system/user light-dark preference. mode-watcher is
     shared state with cyphertap's widget (same module instance under pnpm),
     so its Dark Mode toggle drives the whole app. -->
<ModeWatcher defaultMode="dark" />
<Toaster
	richColors
	position="top-right"
	offset={{ top: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
	mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
	theme={mode.current === 'dark' ? 'dark' : 'light'}
/>

<div class="flex h-full flex-col">
	{#if !shell.immersive}
		<TopBar />
	{/if}
	<main class="min-h-0 flex-1">
		{@render children()}
	</main>
</div>
