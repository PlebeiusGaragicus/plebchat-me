// Search mode e2e: research agent against mocked LLM + Firecrawl endpoints.
// pi-ai drives the endpoint through the OpenAI SDK with stream:true, so the
// LLM mock must answer in SSE chat.completion.chunk frames.
//
// The discover feed makes a read-only WS request to the search relay from
// the hero view; nothing here asserts on its content, so offline runs just
// see its error state.

import { test, expect, type Page } from '@playwright/test';
import { seedLogin } from './helpers.js';

function sse(chunks: unknown[]): string {
	return [...chunks.map((c) => `data: ${JSON.stringify(c)}`), 'data: [DONE]', ''].join('\n\n');
}

function chunk(delta: Record<string, unknown>, finish: string | null = null): unknown {
	return {
		id: 'mock-1',
		object: 'chat.completion.chunk',
		created: 1,
		model: 'mock-model',
		choices: [{ index: 0, delta, finish_reason: finish }]
	};
}

/**
 * Mock LLM: first call returns a web_search tool call; the follow-up call
 * (recognizable by the tool result in its messages) returns a markdown
 * answer with a citation.
 */
async function mockLlm(page: Page): Promise<void> {
	await page.route('**/chat/completions', async (route) => {
		const body = route.request().postDataJSON() as { messages: { role: string }[] };
		const hasToolResult = body.messages.some((m) => m.role === 'tool');
		const chunks = hasToolResult
			? [
					chunk({
						role: 'assistant',
						content: 'Nostr is a **relay-based** protocol [s1].\n\n- open\n- simple'
					}),
					chunk({}, 'stop')
				]
			: [
					chunk({
						role: 'assistant',
						tool_calls: [
							{
								index: 0,
								id: 'call_1',
								type: 'function',
								function: { name: 'web_search', arguments: '{"query":"what is nostr"}' }
							}
						]
					}),
					chunk({}, 'tool_calls')
				];
		await route.fulfill({
			contentType: 'text/event-stream',
			body: sse(chunks)
		});
	});
}

async function mockFirecrawl(page: Page): Promise<void> {
	await page.route('**/api.firecrawl.dev/v2/search', async (route) => {
		await route.fulfill({
			json: {
				success: true,
				data: {
					web: [
						{
							title: 'Nostr protocol',
							url: 'https://example.com/nostr',
							description: 'Notes and Other Stuff Transmitted by Relays.'
						},
						{
							title: 'NIPs repository',
							url: 'https://example.com/nips',
							description: 'Nostr Implementation Possibilities.'
						}
					]
				}
			}
		});
	});
}

/**
 * Seed app settings via localStorage BEFORE load. Saved settings override the
 * dev .env prefill, so tests are hermetic whether or not a .env is filled.
 */
async function seedSettings(
	page: Page,
	options: { configured: boolean; firecrawlKey?: string }
): Promise<void> {
	const settings = {
		ai: options.configured
			? {
					baseUrl: 'https://mock.invalid/v1',
					model: 'mock-model',
					apiKey: 'test-key',
					streaming: true,
					api: 'openai-completions'
				}
			: { baseUrl: '', model: '', apiKey: '' },
		search: { firecrawlApiKey: options.firecrawlKey ?? '' }
	};
	await page.addInitScript(
		(json) => localStorage.setItem('plebchat-settings', json),
		JSON.stringify(settings)
	);
}

/** Log in with mocked-endpoint settings and land on the hero view. */
async function setupConfigured(page: Page) {
	await seedSettings(page, { configured: true, firecrawlKey: 'fc-test' });
	await seedLogin(page);
	await page.goto('/search');
	await expect(page.getByText('Research deeply.')).toBeVisible();
}

test('logged out, /search shows the mode pitch', async ({ page }) => {
	await page.goto('/search');
	await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
	await expect(page.getByText('Log in with the key button')).toBeVisible();
	await expect(page.getByTestId('search-input')).toHaveCount(0);
});

test('logged in but unconfigured: gate points at settings, dialog opens', async ({ page }) => {
	await seedSettings(page, { configured: false });
	await seedLogin(page);
	await page.goto('/search');
	await expect(page.getByText('No AI endpoint configured')).toBeVisible();
	await page.click('[data-testid="search-configure"]');
	await expect(page.getByTestId('search-settings')).toBeVisible();
	// No Firecrawl key yet — that's fine; nostr search stays available.
	await expect(page.getByTestId('firecrawl-key')).toHaveValue('');
});

test('hero view: tagline, discover section, effort selector, tool toggles', async ({ page }) => {
	await setupConfigured(page);

	// SvelteReader hero: tagline + Explore Recent Events below the input.
	await expect(page.getByText('Explore Recent Events')).toBeVisible();

	// Thread rail starts collapsed and expands.
	await expect(page.getByTestId('thread-sidebar-collapsed')).toBeVisible();
	await page.click('[data-testid="thread-sidebar-expand"]');
	await expect(page.getByTestId('thread-sidebar')).toBeVisible();
	await expect(page.getByText('No research history')).toBeVisible();

	// Effort selector persists a new aggressiveness level.
	await expect(page.getByTestId('search-effort')).toContainText('Balanced');
	await page.click('[data-testid="search-effort"]');
	await page.click('[data-testid="search-effort-thorough"]');
	await expect(page.getByTestId('search-effort')).toContainText('Thorough');

	// Web toggle is active (key configured) and toggleable.
	const webToggle = page.getByRole('button', { name: 'Web' });
	await expect(webToggle).toBeEnabled();
});

test('research roundtrip: chat adapts, markdown + tool card + sources modal, survives reload', async ({
	page
}) => {
	await mockLlm(page);
	await mockFirecrawl(page);
	await setupConfigured(page);

	await page.fill('[data-testid="search-input"]', 'What is nostr?');
	await page.click('[data-testid="search-send"]');

	// Hero adapts into the chat view.
	await expect(page.getByTestId('search-message-user')).toContainText('What is nostr?');
	await expect(page.getByText('Explore Recent Events')).toHaveCount(0);
	await expect(page.getByTestId('tool-call-web_search')).toBeVisible();

	// Markdown renders (bold, list), citations are clickable spans.
	const assistant = page.getByTestId('search-message-assistant');
	await expect(assistant.locator('strong')).toContainText('relay-based');
	await expect(assistant.locator('li')).toHaveCount(2);

	// Sources rail: collapsed with a count badge; expands to cards.
	await expect(page.getByTestId('sources-count')).toContainText('2');
	await page.click('[data-testid="sources-expand"]');
	await expect(page.getByTestId('source-card')).toHaveCount(2);

	// Citation click flashes the source card.
	await assistant.locator('[data-cite="s1"]').click();
	await expect(
		page.locator('[data-testid="source-card"]', { hasText: 'Nostr protocol' })
	).toHaveClass(/border-primary/);

	// Source click opens the detail modal.
	await page.locator('[data-testid="source-card"]', { hasText: 'Nostr protocol' }).click();
	const modal = page.getByTestId('source-modal');
	await expect(modal).toBeVisible();
	await expect(modal).toContainText('Nostr protocol');
	await expect(modal).toContainText('Web page');
	await expect(modal).toContainText('example.com');
	await page.keyboard.press('Escape');
	await expect(modal).toHaveCount(0);

	// Thread + transcript survive a reload (rail starts collapsed again).
	await page.reload();
	await page.click('[data-testid="thread-sidebar-expand"]');
	await expect(page.getByTestId('search-thread')).toContainText('What is nostr?');
	await page.click('[data-testid="search-thread"]');
	await expect(page.getByTestId('search-message-assistant').locator('strong')).toContainText(
		'relay-based'
	);
	await expect(page.getByTestId('tool-call-web_search')).toBeVisible();
	await page.click('[data-testid="sources-expand"]');
	await expect(page.getByTestId('source-card')).toHaveCount(2);
});

test('deleting a thread (confirm pattern) removes it from list and database', async ({ page }) => {
	await mockLlm(page);
	await mockFirecrawl(page);
	await setupConfigured(page);

	await page.fill('[data-testid="search-input"]', 'What is nostr?');
	await page.click('[data-testid="search-send"]');
	await expect(page.getByTestId('search-message-assistant').first()).toBeVisible();

	await page.click('[data-testid="thread-sidebar-expand"]');
	await page.getByTestId('search-thread').hover();
	// SvelteReader confirm pattern: first click arms, second deletes.
	await page.getByTitle('Delete thread').click();
	await page.getByTitle('Click to confirm').click();
	await expect(page.getByTestId('search-thread')).toHaveCount(0);
	await expect(page.getByText('No research history')).toBeVisible();

	// The IndexedDB delete commits just after the UI updates — give it a beat
	// so the reload can't race it.
	await page.waitForTimeout(250);
	await page.reload();
	await page.click('[data-testid="thread-sidebar-expand"]');
	await expect(page.getByText('No research history')).toBeVisible();
});
