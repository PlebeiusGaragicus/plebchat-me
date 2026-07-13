// STUB (Phase 2) — the explicit sync engine (LWW + tombstones + Blossom)
// arrives in Phase 5 and replaces this file with vibereader's implementation.
// The interface is kept so library/reader can call it unmodified.

async function checkDirty(): Promise<void> {
	// No relay engine yet — nothing to compare against.
}

function reset(): void {}

export const sync = {
	get isDirty() {
		return false;
	},
	checkDirty,
	reset
};
