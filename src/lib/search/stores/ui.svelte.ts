// Search-mode view state (device-ephemeral).

let settingsOpen = $state(false);
let sourcesOpen = $state(true);
/** Source id to flash/scroll to in the sources panel (set by [sN] clicks). */
let highlightSourceId = $state<string | null>(null);

export const searchUi = {
	get settingsOpen() {
		return settingsOpen;
	},
	set settingsOpen(v: boolean) {
		settingsOpen = v;
	},
	get sourcesOpen() {
		return sourcesOpen;
	},
	set sourcesOpen(v: boolean) {
		sourcesOpen = v;
	},
	get highlightSourceId() {
		return highlightSourceId;
	},
	set highlightSourceId(id: string | null) {
		highlightSourceId = id;
	}
};
