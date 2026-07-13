// Search mode's session lifecycle registration. Imported (once) by the
// /search page — module evaluation is app-lifetime, so hooks never
// double-register; the registry fires `start` immediately if already logged in.

import { registerSessionHooks } from '$lib/session/index.svelte';
import { searchThreads } from './stores/threads.svelte.js';

registerSessionHooks({
	start: async () => {
		await searchThreads.init();
	},
	stop: () => {
		searchThreads.reset();
	}
});
