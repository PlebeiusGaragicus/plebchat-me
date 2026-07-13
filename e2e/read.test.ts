// Read-mode acceptance suite. This is also the acceptance gate for the
// foliate-js renderer swap (Phase 7): it must pass unchanged afterwards.
// Each test seeds a fresh key = fresh per-npub IndexedDB, so tests are
// isolated without cleanup. Sync/Blossom/browse flows need the whitelisted
// relay and are verified manually (see docs/proposals/read-mode.md).
import { test, expect } from '@playwright/test';
import { CH1_TEXT, CH2_TEXT } from './fixtures/epub.js';
import { importFixture, openFirstBook, seedLogin, selectBookText, waitForBookText } from './helpers.js';

test('logged out, /read shows the pitch instead of a library', async ({ page }) => {
	await page.goto('/read');
	await expect(page.getByRole('heading', { name: 'Read' })).toBeVisible();
	await expect(page.getByTestId('import-epub')).not.toBeVisible();
});

test.describe('logged in', () => {
	test.beforeEach(async ({ page }) => {
		await seedLogin(page);
		await page.goto('/read');
		await page.waitForSelector('[data-testid="import-epub"]');
	});

	test('imports an EPUB and shows a library card', async ({ page }) => {
		await importFixture(page);
		await expect(page.getByTestId('book-card')).toHaveCount(1);
		await expect(page.getByTestId('book-card')).toContainText('Fixture Book');
	});

	test('re-importing the same file dedups by sha256', async ({ page }) => {
		await importFixture(page);
		await importFixture(page);
		await expect(page.getByTestId('book-card')).toHaveCount(1);
	});

	test('different files are different books', async ({ page }) => {
		await importFixture(page, { seed: '1' });
		await importFixture(page, { title: 'Second Book', seed: '2' });
		await expect(page.getByTestId('book-card')).toHaveCount(2);
	});

	test('opens a book, paginates forward, navigates via ToC', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);

		// Paginate: chapter 1 is a handful of pages; ArrowRight eventually
		// crosses into chapter 2.
		for (let i = 0; i < 30; i++) {
			await page.keyboard.press('ArrowRight');
			const found = await page.evaluate(
				(t) =>
					[...document.querySelectorAll('iframe')].some((f) =>
						(f as HTMLIFrameElement).contentDocument?.body?.innerText.includes(t)
					),
				CH2_TEXT
			);
			if (found) break;
			await page.waitForTimeout(150);
		}
		await waitForBookText(page, CH2_TEXT, 5000);

		// ToC back to chapter 1.
		await page.click('[data-testid="toc-toggle"]');
		await page.click('[data-testid="toc-sidebar"] button:nth-child(1)');
		await waitForBookText(page, CH1_TEXT);
	});

	test('reading theme applies inside the book iframe', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await page.click('[data-testid="display-settings-toggle"]');
		await page.click('[data-testid="reading-theme-dark"]');
		await expect
			.poll(() =>
				page.evaluate(() => {
					const frame = [...document.querySelectorAll('iframe')].find(
						(f) => (f as HTMLIFrameElement).contentDocument?.body
					) as HTMLIFrameElement;
					return getComputedStyle(frame.contentDocument!.body).backgroundColor;
				})
			)
			.toBe('rgb(24, 24, 27)'); // #18181b, the dark reading theme
	});

	test('progress resumes after a reload (deep-link mirror)', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await page.click('[data-testid="toc-toggle"]');
		await page.click('[data-testid="toc-sidebar"] button:nth-child(2)');
		await waitForBookText(page, CH2_TEXT);
		await expect(page).toHaveURL(/\?book=[0-9a-f]{64}/);

		await page.waitForTimeout(1500); // progress autosave debounce
		await page.reload();
		await waitForBookText(page, CH2_TEXT, 20000);
	});

	test('highlights in two chapters list spine-sorted in the sidebar', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);

		// Annotate chapter 2 FIRST, then chapter 1 — the sidebar must still
		// list chapter 1 first (CFI spine order, not creation order).
		await page.click('[data-testid="toc-toggle"]');
		await page.click('[data-testid="toc-sidebar"] button:nth-child(2)');
		await waitForBookText(page, CH2_TEXT);
		await selectBookText(page, CH2_TEXT);
		await page.click('[data-testid="highlight-green"]');

		await page.click('[data-testid="toc-sidebar"] button:nth-child(1)');
		await waitForBookText(page, CH1_TEXT);
		await selectBookText(page, CH1_TEXT);
		await page.click('[data-testid="highlight-yellow"]');

		await page.click('[data-testid="annotations-toggle"]');
		const cards = page.getByTestId('annotation-card');
		await expect(cards).toHaveCount(2);
		await expect(cards.nth(0)).toContainText('Alpha fixture');
		await expect(cards.nth(1)).toContainText('Bravo fixture');
	});

	test('adds and edits a note on an annotation', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await selectBookText(page, CH1_TEXT);
		await page.click('[data-testid="note-open"]');
		await page.fill('[data-testid="note-input"]', 'first thought');
		await page.click('[data-testid="note-save"]');

		// Reopen via the sidebar card → editor seeds the existing note.
		await page.click('[data-testid="annotations-toggle"]');
		await page.click('[data-testid="annotation-card"] > button');
		await expect(page.getByTestId('note-input')).toHaveValue('first thought');
		await page.fill('[data-testid="note-input"]', 'second thought');
		await page.click('[data-testid="note-save"]');
		await expect(page.getByTestId('annotation-card')).toContainText('second thought');
	});

	test('deletes an annotation', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await selectBookText(page, CH1_TEXT);
		await page.click('[data-testid="highlight-blue"]');
		await page.click('[data-testid="annotations-toggle"]');
		await page.click('[data-testid="annotation-card"] > button');
		await page.click('[data-testid="annotation-delete"]');
		await expect(page.getByTestId('annotation-card')).toHaveCount(0);
	});

	test('annotations survive a reload', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await selectBookText(page, CH1_TEXT);
		await page.click('[data-testid="highlight-pink"]');
		await page.waitForTimeout(1500);
		await page.reload();
		await waitForBookText(page, CH1_TEXT, 20000);
		await page.click('[data-testid="annotations-toggle"]');
		await expect(page.getByTestId('annotation-card')).toHaveCount(1);
	});

	test('deleting a book cascades', async ({ page }) => {
		await importFixture(page);
		await page.hover('[data-testid="book-card"]');
		await page.click('[data-testid="book-card"] button[title="Book actions"]');
		await page.getByRole('menuitem', { name: 'Delete' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(page.getByTestId('book-card')).toHaveCount(0);
	});

	test('read settings persist across reload', async ({ page }) => {
		await page.click('[data-testid="read-settings-toggle"]');
		await page.fill('[data-testid="ai-base-url"]', 'http://localhost:1234/v1');
		await page.click('[data-testid="settings-save"]');
		await page.reload();
		await page.waitForSelector('[data-testid="read-settings-toggle"]');
		await page.click('[data-testid="read-settings-toggle"]');
		await expect(page.getByTestId('ai-base-url')).toHaveValue('http://localhost:1234/v1');
	});

	test('reader hides the shell TopBar (immersive), library restores it', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await expect(page.locator('header')).toHaveCount(0);
		await page.click('[data-testid="reader-back"]');
		await expect(page.locator('header').first()).toBeVisible();
	});
});
