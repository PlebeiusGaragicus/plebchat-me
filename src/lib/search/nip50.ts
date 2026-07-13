// One-shot NIP-50 search: a raw-WebSocket REQ against a search-capable relay
// (default wss://relay.nostr.band). Deliberately not routed through
// cyphertap/NDK — its pool has no search relay, and a self-contained one-shot
// query avoids coupling to NDK internals (precedent: cyphertap's own raw-WS
// negentropy sync).

export interface Nip50Event {
	id: string;
	pubkey: string;
	kind: number;
	created_at: number;
	content: string;
	tags: string[][];
}

export function nip50Search(options: {
	relay: string;
	/** Omit for a plain REQ (e.g. "most recent events of kind X"). */
	query?: string;
	/** Hashtag filter (`#t`) — topic feeds on relays without NIP-50. */
	topics?: string[];
	kinds?: number[];
	limit?: number;
	timeoutMs?: number;
}): Promise<Nip50Event[]> {
	const { relay, query, topics, kinds = [1, 30023], limit = 10, timeoutMs = 10_000 } = options;
	return new Promise((resolve, reject) => {
		let ws: WebSocket;
		try {
			ws = new WebSocket(relay);
		} catch {
			reject(new Error(`Invalid search relay URL: ${relay}`));
			return;
		}
		const subId = `nip50-${Math.random().toString(36).slice(2, 10)}`;
		const events: Nip50Event[] = [];
		let settled = false;

		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try {
				ws.close();
			} catch {
				// Already closed.
			}
			if (error) reject(error);
			else resolve(events.sort((a, b) => b.created_at - a.created_at));
		};

		// A timeout resolves with whatever arrived — slow relays shouldn't
		// fail the tool call outright.
		const timer = setTimeout(() => finish(), timeoutMs);

		ws.onopen = () => {
			const filter: Record<string, unknown> = { kinds, limit };
			if (query) filter.search = query;
			if (topics?.length) filter['#t'] = topics;
			ws.send(JSON.stringify(['REQ', subId, filter]));
		};
		ws.onmessage = (msg) => {
			try {
				const data = JSON.parse(msg.data as string) as unknown[];
				if (data[0] === 'EVENT' && data[1] === subId) {
					events.push(data[2] as Nip50Event);
				} else if (data[0] === 'EOSE' && data[1] === subId) {
					finish();
				} else if (data[0] === 'CLOSED' && data[1] === subId) {
					finish(new Error(`Search relay closed the query: ${String(data[2] ?? '')}`));
				}
			} catch {
				// Ignore unparseable frames.
			}
		};
		ws.onerror = () => finish(new Error(`Could not reach search relay ${relay}.`));
		ws.onclose = () => finish();
	});
}
