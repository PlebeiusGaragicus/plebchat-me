// Shared e2e helpers for Read-mode tests.
import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { buildEpub, type EpubFixtureOptions } from './fixtures/epub.js';

/**
 * Log in headlessly: cyphertap stores the raw hex key at localStorage['ncrypt']
 * and restores it on init, so seeding it before load IS a login. A fresh key
 * per test = a fresh per-npub IndexedDB (structural isolation, no cleanup).
 */
export async function seedLogin(page: Page): Promise<string> {
	const key = randomBytes(32).toString('hex');
	await page.addInitScript((k) => localStorage.setItem('ncrypt', k), key);
	return key;
}

/** Import a generated EPUB via the (hidden) file input on /read. */
export async function importFixture(page: Page, options: EpubFixtureOptions = {}): Promise<void> {
	const buffer = await buildEpub(options);
	await page.setInputFiles('input[type="file"]', {
		name: `${options.title ?? 'Fixture Book'}.epub`,
		mimeType: 'application/epub+zip',
		buffer
	});
	await page.waitForSelector('[data-testid="book-card"]', { state: 'visible' });
}

/** Wait until some epub iframe's body contains `text`. */
export async function waitForBookText(page: Page, text: string, timeout = 15000): Promise<void> {
	await page.waitForFunction(
		(t) =>
			[...document.querySelectorAll('iframe')].some((f) =>
				(f as HTMLIFrameElement).contentDocument?.body?.innerText.includes(t)
			),
		text,
		{ timeout }
	);
}

/**
 * Select a paragraph containing `text` inside the epub iframe and fire
 * mouseup so epub.js emits 'selected' (opens the annotation context menu).
 */
export async function selectBookText(page: Page, text: string): Promise<void> {
	await page.evaluate((t) => {
		const frame = [...document.querySelectorAll('iframe')].find((f) =>
			(f as HTMLIFrameElement).contentDocument?.body?.innerText.includes(t)
		) as HTMLIFrameElement | undefined;
		if (!frame?.contentDocument) throw new Error(`No iframe containing: ${t}`);
		const doc = frame.contentDocument;
		const p = [...doc.querySelectorAll('p')].find((el) => el.textContent?.includes(t));
		if (!p) throw new Error(`No paragraph containing: ${t}`);
		const range = doc.createRange();
		range.selectNodeContents(p);
		const sel = doc.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
		p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	}, text);
	await page.waitForSelector('[data-testid="annotation-menu"]', { state: 'visible' });
}

/** Open the (already imported) first book and wait for chapter text. */
export async function openFirstBook(page: Page, expectText: string): Promise<void> {
	await page.click('[data-testid="book-card"] > button');
	await page.waitForSelector('[data-testid="epub-viewer"]', { state: 'visible' });
	await waitForBookText(page, expectText);
}
