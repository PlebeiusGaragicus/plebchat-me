// Read mode's session lifecycle registration. Imported (once) by the /read
// page — module evaluation is app-lifetime, so hooks never double-register.
// If the user is already logged in when this module first loads (navigated
// to /read after login), the registry fires `start` immediately.

import { registerSessionHooks } from '$lib/session/index.svelte';
import { offerVibereaderMigration } from './migrate.js';
import { library } from './stores/library.svelte.js';
import { reader } from './stores/reader.svelte.js';
import { sync } from './stores/sync.svelte.js';
import { ui } from './stores/ui.svelte.js';

registerSessionHooks({
	start: async (npub) => {
		await library.init();
		await sync.checkDirty();
		await offerVibereaderMigration(npub).catch(() => {});
	},
	stop: () => {
		if (reader.book) reader.close();
		library.reset();
		sync.reset();
		ui.reset();
	}
});
