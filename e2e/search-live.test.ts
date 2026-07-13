// LIVE smoke for Search mode (proposal Phase 5): drives a real research
// question through the real BYO LLM endpoint, Firecrawl, and the NIP-50
// relay. Needs a filled .env (the settings forms prefill from it) and is
// skipped in CI: run with  LIVE=1 npx playwright test e2e/search-live.test.ts
//
// A local reasoning model can take minutes per turn — timeouts are generous.

import { test, expect } from '@playwright/test';
import { seedLogin } from './helpers.js';

test.skip(!process.env.LIVE, 'live smoke — set LIVE=1 (and fill .env) to run');

test('live research roundtrip: real LLM + real tools produce a cited, sourced answer', async ({
	page
}) => {
	test.setTimeout(420_000);

	await seedLogin(page);
	await page.goto('/search');

	// .env prefill makes the app configured out of the box (fresh profile).
	await expect(page.getByTestId('search-input')).toBeVisible();

	await page.fill(
		'[data-testid="search-input"]',
		'What is the Cashu ecash protocol and how does it relate to nostr? Use your tools and cite sources.'
	);
	await page.click('[data-testid="search-send"]');
	await expect(page.getByTestId('search-message-user')).toBeVisible();

	// The agent must actually use a tool (any of the three)…
	await expect(page.locator('[data-testid^="tool-call-"]').first()).toBeVisible({
		timeout: 240_000
	});
	// …which records at least one source…
	await expect(page.getByTestId('source-card').first()).toBeVisible({ timeout: 240_000 });
	// …and the run must end with a non-trivial assistant answer.
	await expect(page.getByTestId('search-message-assistant').last()).toBeVisible({
		timeout: 360_000
	});
	await expect(page.getByTestId('search-stop')).toHaveCount(0, { timeout: 360_000 });
	await expect(page.getByTestId('search-error')).toHaveCount(0);

	const answer = await page.getByTestId('search-message-assistant').last().innerText();
	expect(answer.length).toBeGreaterThan(100);

	const toolNames = await page
		.locator('[data-testid^="tool-call-"]')
		.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
	const sources = await page.getByTestId('source-card').count();
	const cited = /\[s\d+\]/.test(answer);
	console.log(
		`LIVE SMOKE — tools: ${toolNames.join(', ')} | sources: ${sources} | inline [sN] citations: ${cited}\n--- answer ---\n${answer.slice(0, 600)}`
	);
});
