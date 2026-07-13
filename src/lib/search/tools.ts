// Search-mode agent tools. Sources are recorded HERE, as a side effect of
// tool execution — the tool-built source list is the app-authoritative
// record; the model's [sN] prose citations are presentation only.

import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { jsonResult, withArgRepair } from '$lib/ai/tools.js';
import type { SearchSource } from '$lib/db/types.js';
import { settingsStore } from '$lib/stores/settings.svelte.js';
import { firecrawlSearch, firecrawlScrape } from './firecrawl.js';
import { nip50Search } from './nip50.js';
import type { SearchCapabilities } from './prompt.js';
import { searchUi } from './stores/ui.svelte.js';

/** Implemented by the thread store: dedupes by URL, assigns s1/s2/… ids. */
export interface SourceRecorder {
	record(source: Omit<SearchSource, 'id' | 'addedAt'>): SearchSource;
}

/** Keep fetched pages inside a sane share of the context window. */
const PAGE_CHAR_BUDGET = 20_000;

const webSearchTool = (recorder: SourceRecorder): AgentTool<never> =>
	({
		name: 'web_search',
		label: 'Web search',
		description:
			'Search the web. Returns result titles, URLs, and snippets, each with a source id you can cite. Use fetch_page on promising results before relying on them.',
		parameters: Type.Object({
			query: Type.String({ description: 'The search query' }),
			limit: Type.Optional(
				Type.Number({ description: 'Max results, 1–10 (default 5)', minimum: 1, maximum: 10 })
			)
		}),
		async execute(_id, params: { query: string; limit?: number }) {
			const key = settingsStore.settings.search.firecrawlApiKey;
			const results = await firecrawlSearch(
				key,
				params.query,
				Math.min(Math.max(Math.round(params.limit ?? 5), 1), 10)
			);
			if (results.length === 0) {
				return jsonResult(`No web results for "${params.query}". Try different terms.`);
			}
			const lines = results.map((r) => {
				const source = recorder.record({
					kind: 'web',
					title: r.title,
					url: r.url,
					description: r.description
				});
				return `[${source.id}] ${r.title}\n${r.url}\n${r.description}`;
			});
			return jsonResult(lines.join('\n\n'), { count: results.length });
		}
	}) as AgentTool<never>;

const fetchPageTool = (recorder: SourceRecorder): AgentTool<never> =>
	({
		name: 'fetch_page',
		label: 'Fetch page',
		description:
			'Fetch one web page and return its main content as markdown, with a citable source id. Long pages are truncated.',
		parameters: Type.Object({
			url: Type.String({ description: 'Absolute http(s) URL to fetch' })
		}),
		async execute(_id, params: { url: string }) {
			if (!/^https?:\/\//.test(params.url)) {
				throw new Error('fetch_page needs an absolute http(s) URL.');
			}
			const key = settingsStore.settings.search.firecrawlApiKey;
			const page = await firecrawlScrape(key, params.url);
			const source = recorder.record({
				kind: 'web',
				title: page.title,
				url: page.url,
				fetched: true
			});
			let body = page.markdown;
			if (body.length > PAGE_CHAR_BUDGET) {
				body = `${body.slice(0, PAGE_CHAR_BUDGET)}\n\n[…truncated — ${page.markdown.length - PAGE_CHAR_BUDGET} characters omitted]`;
			}
			return jsonResult(`[${source.id}] ${page.title}\n${page.url}\n\n${body}`, {
				url: page.url
			});
		}
	}) as AgentTool<never>;

const nostrSearchTool = (recorder: SourceRecorder): AgentTool<never> =>
	({
		name: 'nostr_search',
		label: 'Nostr search',
		description:
			'Full-text search over nostr events via a NIP-50 relay. Searches short notes (kind 1) and long-form articles (kind 30023). Good for what people are saying now, and for nostr/bitcoin topics.',
		parameters: Type.Object({
			query: Type.String({ description: 'The search query' }),
			limit: Type.Optional(
				Type.Number({ description: 'Max results, 1–20 (default 10)', minimum: 1, maximum: 20 })
			)
		}),
		async execute(_id, params: { query: string; limit?: number }) {
			const relay = settingsStore.settings.search.searchRelay;
			const events = await nip50Search({
				relay,
				query: params.query,
				limit: Math.min(Math.max(Math.round(params.limit ?? 10), 1), 20)
			});
			if (events.length === 0) {
				return jsonResult(`No nostr results for "${params.query}" on ${relay}.`);
			}
			const lines = events.map((event) => {
				const date = new Date(event.created_at * 1000).toISOString().slice(0, 10);
				const snippet = event.content.replace(/\s+/g, ' ').slice(0, 300);
				const source = recorder.record({
					kind: 'nostr',
					title: snippet.slice(0, 80) || `nostr event ${event.id.slice(0, 8)}`,
					url: `nostr:${event.id}`,
					description: `kind ${event.kind} · ${date} · by ${event.pubkey.slice(0, 8)}…`
				});
				return `[${source.id}] (kind ${event.kind}, ${date}, by ${event.pubkey.slice(0, 8)}…)\n${snippet}`;
			});
			return jsonResult(lines.join('\n\n'), { count: events.length });
		}
	}) as AgentTool<never>;

export function buildSearchTools(recorder: SourceRecorder): AgentTool<never>[] {
	const caps = searchCapabilities();
	const tools: AgentTool<never>[] = [];
	if (caps.web) tools.push(webSearchTool(recorder), fetchPageTool(recorder));
	if (caps.nostr) tools.push(nostrSearchTool(recorder));
	return tools.map(withArgRepair);
}

export function searchCapabilities(): SearchCapabilities {
	return {
		web: Boolean(settingsStore.settings.search.firecrawlApiKey) && searchUi.webEnabled,
		nostr: searchUi.nostrEnabled,
		effort: settingsStore.settings.search.effort
	};
}
