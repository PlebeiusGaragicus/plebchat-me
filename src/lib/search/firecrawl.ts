// Firecrawl API client (api.firecrawl.dev serves access-control-allow-origin:*
// — verified 2026-07-13 — so the browser calls it directly with the user's
// key). Chosen as the first web search/fetch backend; more providers later
// slot in behind the same tool interface.

export class FirecrawlError extends Error {}

const BASE = 'https://api.firecrawl.dev/v2';

// PAYMENTS: per-request seam, mirroring $lib/ai/client.ts — metered search
// hooks in here when a payments backend exists.
async function post<T>(apiKey: string, path: string, body: unknown): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${BASE}${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify(body)
		});
	} catch {
		throw new FirecrawlError('Could not reach the Firecrawl API — check your network.');
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		if (response.status === 401) throw new FirecrawlError('Firecrawl rejected the API key.');
		if (response.status === 402)
			throw new FirecrawlError('Firecrawl credits exhausted (402 Payment Required).');
		if (response.status === 429)
			throw new FirecrawlError('Firecrawl rate limit hit — wait a moment and retry.');
		throw new FirecrawlError(`Firecrawl returned ${response.status}: ${detail.slice(0, 200)}`);
	}
	return (await response.json()) as T;
}

export interface WebSearchResult {
	title: string;
	url: string;
	description: string;
}

export async function firecrawlSearch(
	apiKey: string,
	query: string,
	limit: number
): Promise<WebSearchResult[]> {
	const data = await post<{
		success?: boolean;
		data?: { web?: { title?: string; url?: string; description?: string }[] };
	}>(apiKey, '/search', { query, limit, sources: [{ type: 'web' }] });
	return (data.data?.web ?? [])
		.filter((r) => r.url)
		.map((r) => ({ title: r.title ?? r.url!, url: r.url!, description: r.description ?? '' }));
}

export interface ScrapedPage {
	markdown: string;
	title: string;
	url: string;
}

export async function firecrawlScrape(apiKey: string, url: string): Promise<ScrapedPage> {
	const data = await post<{
		success?: boolean;
		data?: {
			markdown?: string;
			metadata?: { title?: string | string[]; sourceURL?: string; statusCode?: number };
		};
	}>(apiKey, '/scrape', { url, formats: ['markdown'], onlyMainContent: true });
	const markdown = data.data?.markdown;
	if (typeof markdown !== 'string' || !markdown.trim()) {
		throw new FirecrawlError('Firecrawl returned no readable content for that URL.');
	}
	const rawTitle = data.data?.metadata?.title;
	return {
		markdown,
		title: (Array.isArray(rawTitle) ? rawTitle[0] : rawTitle) ?? url,
		url: data.data?.metadata?.sourceURL ?? url
	};
}
