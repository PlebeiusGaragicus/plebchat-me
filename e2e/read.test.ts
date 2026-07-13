// Read-mode acceptance suite. This is also the acceptance gate for the
// foliate-js renderer swap (Phase 7): it must pass unchanged afterwards.
// Each test seeds a fresh key = fresh per-npub IndexedDB, so tests are
// isolated without cleanup. Sync/Blossom/browse flows need the whitelisted
// relay and are verified manually (see docs/proposals/read-mode.md).
import { test, expect } from '@playwright/test';
import { CH1_TEXT, CH2_TEXT } from './fixtures/epub.js';
import {
	bookBodyBackground,
	bookHasText,
	importFixture,
	openFirstBook,
	seedLogin,
	selectBookText,
	waitForBookText
} from './helpers.js';

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
			if (await bookHasText(page, CH2_TEXT)) break;
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
		await expect.poll(() => bookBodyBackground(page)).toBe('rgb(24, 24, 27)'); // #18181b, dark reading theme
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

	test('edits book metadata from the card menu', async ({ page }) => {
		await importFixture(page);
		await page.hover('[data-testid="book-card"]');
		await page.click('[data-testid="book-card"] button[title="Book actions"]');
		await page.getByRole('menuitem', { name: 'Edit metadata' }).click();
		await expect(page.getByTestId('book-edit-dialog')).toBeVisible();
		await page.fill('[data-testid="edit-title"]', 'Renamed Fixture');
		await page.fill('[data-testid="edit-creator"]', 'New Author');
		await page.click('[data-testid="edit-local-only"]');
		await page.click('[data-testid="edit-save"]');
		await expect(page.getByTestId('book-edit-dialog')).toHaveCount(0);
		await expect(page.getByTestId('book-card')).toContainText('Renamed Fixture');
		await expect(page.getByTestId('book-card')).toContainText('New Author');

		// The local-only choice persists and surfaces in the info dialog.
		await page.hover('[data-testid="book-card"]');
		await page.click('[data-testid="book-card"] button[title="Book actions"]');
		await page.getByRole('menuitem', { name: 'Edit metadata' }).click();
		await expect(
			page.locator('[data-testid="edit-local-only"] input[type="radio"]')
		).toBeChecked();
		await page.locator('[data-testid="book-edit-dialog"] button[title="Close"]').click();
		await page.hover('[data-testid="book-card"]');
		await page.click('[data-testid="book-card"] button[title="Book actions"]');
		await page.getByRole('menuitem', { name: 'Info' }).click();
		await expect(page.getByRole('dialog', { name: 'Book info' })).toContainText('Local only');
	});

	test('sync cloud button opens the status popover', async ({ page }) => {
		await importFixture(page);
		await page.click('[data-testid="sync-button"]');
		await expect(page.getByTestId('sync-popover')).toBeVisible();
		await expect(page.getByTestId('sync-popover')).toContainText('Nostr sync');
		// A fresh import means unsynced local changes.
		await expect(page.getByTestId('sync-popover')).toContainText('Unsynced changes');
		await expect(page.getByTestId('sync-now')).toBeEnabled();
		// Click-away closes it without syncing.
		await page.mouse.click(10, 300);
		await expect(page.getByTestId('sync-popover')).toHaveCount(0);
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

	test('chat panel opens; unconfigured state points at Settings', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await page.click('[data-testid="chat-toggle"]');
		await expect(page.getByTestId('chat-panel')).toBeVisible();
		await expect(page.getByTestId('chat-panel')).toContainText('No AI endpoint configured');
	});

	test('chat roundtrip against a mocked endpoint', async ({ page }) => {
		// Any OpenAI-compatible /chat/completions shape works; intercept it.
		await page.route('**/chat/completions', async (route) => {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					choices: [{ message: { content: 'A mocked reading companion reply.' } }]
				})
			});
		});

		// Configure the endpoint (non-streaming so the single-shot path runs).
		await page.click('[data-testid="read-settings-toggle"]');
		await page.fill('[data-testid="ai-base-url"]', 'https://mock.invalid/v1');
		await page.fill('[data-testid="read-settings"] input[placeholder^="e.g."]', 'mock-model');
		await page.getByText('Stream responses').click();
		await page.click('[data-testid="settings-save"]');

		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);

		// "Chat about this" from a selection carries the passage as context.
		await selectBookText(page, CH1_TEXT);
		await page.click('[data-testid="chat-about-this"]');
		await expect(page.getByTestId('chat-panel')).toBeVisible();
		await expect(page.getByTestId('chat-panel')).toContainText('Alpha fixture');

		await page.fill('[data-testid="chat-input"]', 'What does this passage mean?');
		await page.click('[data-testid="chat-send"]');
		await expect(page.getByTestId('chat-message-user')).toContainText('What does this passage mean?');
		await expect(page.getByTestId('chat-message-assistant')).toContainText(
			'A mocked reading companion reply.'
		);
	});

	test('reader hides the shell TopBar (immersive), library restores it', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await expect(page.locator('header')).toHaveCount(0);
		await page.click('[data-testid="reader-back"]');
		await expect(page.locator('header').first()).toBeVisible();
	});

	test('chapter-segmented progress bar renders and navigates', async ({ page }) => {
		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await expect(page.getByTestId('progress-segment')).toHaveCount(3); // 3 fixture chapters
		await expect(page.getByTestId('progress-marker')).toBeVisible();
		// Clicking the second segment jumps to chapter 2.
		await page.getByTestId('progress-segment').nth(1).click();
		await waitForBookText(page, CH2_TEXT);
	});

	test('a highlight carries a chat thread (link survives reload)', async ({ page }) => {
		await page.route('**/chat/completions', async (route) => {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({ choices: [{ message: { content: 'About that passage…' } }] })
			});
		});
		await page.click('[data-testid="read-settings-toggle"]');
		await page.fill('[data-testid="ai-base-url"]', 'https://mock.invalid/v1');
		await page.fill('[data-testid="read-settings"] input[placeholder^="e.g."]', 'mock-model');
		await page.getByText('Stream responses').click();
		await page.click('[data-testid="settings-save"]');

		await importFixture(page);
		await openFirstBook(page, CH1_TEXT);
		await selectBookText(page, CH1_TEXT);
		await page.click('[data-testid="highlight-yellow"]');

		// Discuss from the sidebar card → linked thread opens with the quote.
		await page.click('[data-testid="annotations-toggle"]');
		await page.hover('[data-testid="annotation-card"]');
		await page.click('[data-testid="annotation-discuss"]');
		await expect(page.getByTestId('chat-panel')).toBeVisible();
		await expect(page.getByTestId('chat-panel')).toContainText('Alpha fixture');

		// A message persists the thread (empty threads are ephemeral by design).
		await page.fill('[data-testid="chat-input"]', 'Thoughts?');
		await page.click('[data-testid="chat-send"]');
		await expect(page.getByTestId('chat-message-assistant')).toContainText('About that passage');

		// The thread list marks it as annotation-linked; the link survives reload.
		await page.waitForTimeout(1200);
		await page.reload();
		await waitForBookText(page, CH1_TEXT, 20000);
		await page.click('[data-testid="chat-toggle"]');
		await expect(page.getByTestId('thread-annotation-link')).toBeVisible();

		// Discussing the same annotation again reopens the SAME thread.
		await page.click('[data-testid="annotations-toggle"]');
		await page.hover('[data-testid="annotation-card"]');
		await page.click('[data-testid="annotation-discuss"]');
		await page.click('[data-testid="chat-panel"] button[title="All chats"]');
		await expect(page.getByTestId('chat-thread')).toHaveCount(1);
	});

	test('offers to migrate a vibereader library found on this origin', async ({ page }) => {
		// Seed a minimal vibereader::<npub> DB for the SAME identity, then
		// reload so the session-start hook discovers it.
		await page.evaluate(async () => {
			const dbs = await indexedDB.databases();
			const mine = dbs.find((d) => d.name?.startsWith('plebchat::'))!.name!;
			const oldName = mine.replace('plebchat::', 'vibereader::');
			await new Promise<void>((resolve, reject) => {
				const req = indexedDB.open(oldName, 2);
				req.onupgradeneeded = () => {
					const db = req.result;
					db.createObjectStore('books', { keyPath: 'sha256' });
					db.createObjectStore('bookFiles', { keyPath: 'sha256' });
					db.createObjectStore('covers', { keyPath: 'sha256' });
					db.createObjectStore('locations', { keyPath: 'sha256' });
					db.createObjectStore('progress', { keyPath: 'sha256' });
					db.createObjectStore('annotations', { keyPath: 'id' });
					db.createObjectStore('chats', { keyPath: 'id' });
					db.createObjectStore('kv', { keyPath: 'key' });
					db.createObjectStore('tombstones', { keyPath: 'key' });
				};
				req.onsuccess = () => {
					const db = req.result;
					const now = Date.now();
					const tx = db.transaction(['books', 'bookFiles'], 'readwrite');
					tx.objectStore('books').put({
						sha256: 'f'.repeat(64),
						title: 'Migrated Fixture',
						creator: 'Old App',
						fileSize: 3,
						addedAt: now,
						updatedAt: now
					});
					tx.objectStore('bookFiles').put({
						sha256: 'f'.repeat(64),
						blob: new Blob(['old'], { type: 'application/epub+zip' })
					});
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
				req.onerror = () => reject(req.error);
			});
		});

		await page.reload();
		await page.getByRole('button', { name: 'Copy' }).click();
		await expect(page.getByTestId('book-card')).toContainText('Migrated Fixture');

		// Flag set — no re-offer on the next load.
		await page.reload();
		await page.waitForSelector('[data-testid="import-epub"]');
		await expect(page.getByRole('button', { name: 'Copy' })).not.toBeVisible();
	});
});
