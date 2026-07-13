// STUB (Phase 2) — the AI reading-companion chat (BYO endpoint, device-local
// threads, // PAYMENTS: seam) arrives in Phase 4 and replaces this file with
// vibereader's implementation. Interface kept so reader.open/close compile.

import type { Book } from '$lib/db/types.js';

async function load(_book: Book): Promise<void> {
	// No chat yet.
}

function reset(): void {}

export const chat = {
	load,
	reset
};
