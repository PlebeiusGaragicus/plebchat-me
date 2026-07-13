// Search mode e2e: research agent against mocked LLM + Firecrawl endpoints.
// pi-ai drives the endpoint through the OpenAI SDK with stream:true, so the
// LLM mock must answer in SSE chat.completion.chunk frames.

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
 * (recognizable by the tool result in its messages) returns a cited answer.
 */
async function mockLlm(page: Page): Promise<void> {
	await page.route('**/chat/completions', async (route) => {
		const body = route.request().postDataJSON() as { messages: { role: string }[] };
		const hasToolResult = body.messages.some((m) => m.role === 'tool');
		const chunks = hasToolResult
			? [
					chunk({ role: 'assistant', content: 'Nostr is a relay-based protocol [s1].' }),
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

/** Fill and save Search settings (assumes the dialog is open). */
async function configureSettings(page: Page, options: { firecrawlKey?: string } = {}) {
	await page.fill('[data-testid="search-ai-base-url"]', 'https://mock.invalid/v1');
	await page.fill('[data-testid="search-ai-model"]', 'mock-model');
	await page.fill('[data-testid="search-settings"] input[placeholder^="sk-"]', 'test-key');
	if (options.firecrawlKey) {
		await page.fill('[data-testid="firecrawl-key"]', options.firecrawlKey);
	}
	await page.click('[data-testid="search-settings-save"]');
}

test('logged out, /search shows the mode pitch', async ({ page }) => {
	await page.goto('/search');
	await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
	await expect(page.getByText('Log in with the key button')).toBeVisible();
	await expect(page.getByTestId('search-input')).toHaveCount(0);
});

test('logged in but unconfigured: pitch points at settings, dialog opens', async ({ page }) => {
	await seedLogin(page);
	await page.goto('/search');
	await expect(page.getByText('No AI endpoint configured')).toBeVisible();
	await page.click('[data-testid="search-configure"]');
	await expect(page.getByTestId('search-settings')).toBeVisible();
	// No Firecrawl key yet — that's fine; nostr search stays available.
	await expect(page.getByTestId('firecrawl-key')).toHaveValue('');
});

test('research roundtrip: tool call card, sources, cited answer; thread survives reload', async ({
	page
}) => {
	await mockLlm(page);
	await mockFirecrawl(page);
	await seedLogin(page);
	await page.goto('/search');

	await page.click('[data-testid="search-configure"]');
	await configureSettings(page, { firecrawlKey: 'fc-test' });

	await page.fill('[data-testid="search-input"]', 'What is nostr?');
	await page.click('[data-testid="search-send"]');

	// User message renders; the agent calls web_search (card), sources land,
	// and the follow-up completion cites [s1].
	await expect(page.getByTestId('search-message-user')).toContainText('What is nostr?');
	await expect(page.getByTestId('tool-call-web_search')).toBeVisible();
	await expect(page.getByTestId('search-message-assistant')).toContainText(
		'relay-based protocol'
	);
	await expect(page.getByTestId('source-card')).toHaveCount(2);
	await expect(page.getByTestId('sources-panel')).toContainText('Nostr protocol');

	// Citation click highlights the source card.
	await page.getByRole('button', { name: '[s1]' }).click();
	await expect(
		page.locator('[data-testid="source-card"]', { hasText: 'Nostr protocol' })
	).toHaveClass(/border-primary/);

	// Thread title derives from the question and the transcript persists.
	await page.reload();
	await expect(page.getByTestId('search-thread')).toContainText('What is nostr?');
	await page.click('[data-testid="search-thread"]');
	await expect(page.getByTestId('search-message-assistant')).toContainText(
		'relay-based protocol'
	);
	await expect(page.getByTestId('tool-call-web_search')).toBeVisible();
	await expect(page.getByTestId('source-card')).toHaveCount(2);
});

test('deleting a thread removes it from the list and the database', async ({ page }) => {
	await mockLlm(page);
	await mockFirecrawl(page);
	await seedLogin(page);
	await page.goto('/search');

	await page.click('[data-testid="search-configure"]');
	await configureSettings(page, { firecrawlKey: 'fc-test' });

	await page.fill('[data-testid="search-input"]', 'What is nostr?');
	await page.click('[data-testid="search-send"]');
	await expect(page.getByTestId('search-message-assistant')).toBeVisible();

	await page.getByTestId('search-thread').hover();
	await page.getByTitle('Delete thread').click();
	await expect(page.getByTestId('search-thread')).toHaveCount(0);

	// The IndexedDB delete commits just after the UI updates — give it a beat
	// so the reload can't race it.
	await page.waitForTimeout(250);
	await page.reload();
	await expect(page.getByText('start your first research thread')).toBeVisible();
});
