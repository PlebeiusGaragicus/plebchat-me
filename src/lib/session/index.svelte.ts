// Login/logout lifecycle: bridges the cyphertap identity to the per-npub
// database and per-user state. Mode-agnostic — the root layout's $effect
// drives start/stop; each mode registers its own hooks (e.g. Read registers
// library.init + sync.checkDirty) instead of this module importing mode stores.

import { closeUserDB, openUserDB, setCurrentUser } from '$lib/db/index.js';

export interface SessionHooks {
	/** Runs after the per-npub DB is opened (login, or registration while logged in). */
	start?: (npub: string) => Promise<void> | void;
	/** Runs on logout, before the DB closes. */
	stop?: () => void;
}

const hooks: SessionHooks[] = [];

/**
 * Register mode lifecycle hooks. Modes register at module-import time, which
 * can happen AFTER login (user navigates to the mode later) — in that case
 * the start hook fires immediately for the active session.
 */
export function registerSessionHooks(h: SessionHooks): void {
	hooks.push(h);
	if (activeNpub) void h.start?.(activeNpub);
}

let activeNpub = $state<string | null>(null);

async function start(npub: string): Promise<void> {
	if (activeNpub === npub) return;
	if (activeNpub) stop();
	activeNpub = npub;
	setCurrentUser(npub);
	await openUserDB();

	// Ask the browser not to evict our IndexedDB under storage pressure.
	// Chromium usually grants it silently; Safari ignores it for plain web
	// apps — Blossom backup is the durable answer there.
	try {
		await navigator.storage?.persist?.();
	} catch {
		// Not fatal — persistence is best-effort.
	}

	for (const h of hooks) {
		await h.start?.(npub);
	}
}

function stop(): void {
	for (const h of [...hooks].reverse()) {
		h.stop?.();
	}
	closeUserDB();
	activeNpub = null;
}

export const session = {
	get activeNpub() {
		return activeNpub;
	},
	start,
	stop
};
