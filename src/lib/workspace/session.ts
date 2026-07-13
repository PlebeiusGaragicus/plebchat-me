// Workspace core session lifecycle registration. Imported (once) by any
// workspace-consuming mode page (Synthesize now, Debate later) — module
// evaluation is app-lifetime, so hooks never double-register; the registry
// fires `start` immediately if already logged in.

import { registerSessionHooks } from '$lib/session/index.svelte';
import { projects } from './stores/projects.svelte.js';

registerSessionHooks({
	start: async () => {
		await projects.init();
	},
	stop: () => {
		projects.reset();
	}
});
