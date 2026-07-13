// "Explore Recent Events" feed: recent nostr long-form articles (kind 30023)
// from the NIP-50 search relay — real content with zero backend, in the shape
// of SvelteReader's DiscoveryFeed (its news backend is what we deliberately
// drop). Selecting an article will become news-reading mode later; the feed
// itself is read-only discovery for now.

import { nip50Search, type Nip50Event } from '../nip50.js';

// A big general relay, deliberately NOT the NIP-50 search relay: the feed is
// a plain "recent kind 30023" REQ with #t topic filters, which search-only
// relays (relay.nostr.band) don't answer.
const FEED_RELAY = 'wss://relay.damus.io';

export interface DiscoverArticle {
	id: string;
	title: string;
	summary: string;
	image?: string;
	publishedAt: number; // unix seconds
	pubkey: string;
}

export const DISCOVER_TOPICS = [
	{ key: 'bitcoin', display: 'Bitcoin' },
	{ key: 'nostr', display: 'Nostr' },
	{ key: 'privacy', display: 'Privacy' },
	{ key: 'ai', display: 'AI' }
] as const;

export type DiscoverTopic = (typeof DISCOVER_TOPICS)[number]['key'];

let articles = $state<DiscoverArticle[]>([]);
let loading = $state(false);
let error = $state<string | null>(null);
let activeTopic = $state<DiscoverTopic | undefined>(undefined);
let loadedTopic = $state<DiscoverTopic | undefined | null>(null); // null = never loaded

function tag(event: Nip50Event, name: string): string | undefined {
	return event.tags.find((t) => t[0] === name)?.[1];
}

/** Markdown → plain-text-ish preview (images/links/urls dropped). */
function preview(text: string): string {
	return text
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/https?:\/\/\S+/g, ' ')
		.replace(/[#*>`_~[\]]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function toArticle(event: Nip50Event): DiscoverArticle | null {
	const title = tag(event, 'title')?.trim();
	if (!title) return null;
	const published = Number(tag(event, 'published_at')) || event.created_at;
	return {
		id: event.id,
		title,
		summary: preview(tag(event, 'summary') ?? event.content).slice(0, 200),
		image: tag(event, 'image'),
		publishedAt: published,
		pubkey: event.pubkey
	};
}

async function load(): Promise<void> {
	if (loading) return;
	loading = true;
	error = null;
	const topic = activeTopic;
	try {
		const events = await nip50Search({
			relay: FEED_RELAY,
			topics: topic ? [topic] : undefined,
			kinds: [30023],
			limit: 36,
			timeoutMs: 8_000
		});
		// Stale response guard: the user may have switched topics mid-flight.
		if (topic !== activeTopic) return;
		// Over-fetch, then cap one article per author — bulk publishers (spam
		// or newsletters) otherwise fill the whole "most recent" window.
		const seenTitle = new Set<string>();
		const seenAuthor = new Set<string>();
		articles = events
			.map(toArticle)
			.filter((a): a is DiscoverArticle => a !== null)
			.sort((a, b) => b.publishedAt - a.publishedAt)
			.filter((a) => {
				const title = a.title.toLowerCase();
				if (seenTitle.has(title) || seenAuthor.has(a.pubkey)) return false;
				seenTitle.add(title);
				seenAuthor.add(a.pubkey);
				return true;
			})
			.slice(0, 12);
		loadedTopic = topic;
	} catch (e) {
		if (topic !== activeTopic) return;
		articles = [];
		error = e instanceof Error ? e.message : 'Could not load recent articles.';
	} finally {
		if (topic === activeTopic) loading = false;
	}
}

function setTopic(topic: DiscoverTopic | undefined): void {
	activeTopic = topic;
	void load();
}

/** Load once per topic; the feed refreshes on explicit topic clicks only. */
function ensureLoaded(): void {
	if (loadedTopic === null && !loading) void load();
}

export const discover = {
	get articles() {
		return articles;
	},
	get loading() {
		return loading;
	},
	get error() {
		return error;
	},
	get activeTopic() {
		return activeTopic;
	},
	setTopic,
	ensureLoaded,
	reload: load
};
