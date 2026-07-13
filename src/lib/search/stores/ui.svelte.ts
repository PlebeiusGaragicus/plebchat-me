// Search-mode view state (device-ephemeral). Sidebar defaults mirror
// SvelteReader's deepresearch page: both rails start collapsed.

import type { SearchSource } from '$lib/db/types.js';

let settingsOpen = $state(false);
let threadSidebarCollapsed = $state(true);
let sourcesCollapsed = $state(true);
/** Source id to flash/scroll to in the sources sidebar (set by [sN] clicks). */
let highlightSourceId = $state<string | null>(null);
/** Source shown in the detail modal. */
let modalSource = $state<SearchSource | null>(null);
/** Per-session tool toggles on the input bar (web also needs a Firecrawl key). */
let webEnabled = $state(true);
let nostrEnabled = $state(true);

export const searchUi = {
	get settingsOpen() {
		return settingsOpen;
	},
	set settingsOpen(v: boolean) {
		settingsOpen = v;
	},
	get threadSidebarCollapsed() {
		return threadSidebarCollapsed;
	},
	set threadSidebarCollapsed(v: boolean) {
		threadSidebarCollapsed = v;
	},
	get sourcesCollapsed() {
		return sourcesCollapsed;
	},
	set sourcesCollapsed(v: boolean) {
		sourcesCollapsed = v;
	},
	get highlightSourceId() {
		return highlightSourceId;
	},
	set highlightSourceId(id: string | null) {
		highlightSourceId = id;
	},
	get modalSource() {
		return modalSource;
	},
	set modalSource(s: SearchSource | null) {
		modalSource = s;
	},
	get webEnabled() {
		return webEnabled;
	},
	set webEnabled(v: boolean) {
		webEnabled = v;
	},
	get nostrEnabled() {
		return nostrEnabled;
	},
	set nostrEnabled(v: boolean) {
		nostrEnabled = v;
	}
};
