// Seed utility, NOT part of the test suite: gives each whitelisted test
// account (alice/bob/carol) a distinct public-domain book with shared
// annotations, a Blossom backup, and a public-shelf entry — so Browse
// libraries has real friend data to demo against.
//
// Run explicitly:   SEED=1 npx playwright test e2e/seed-friends.test.ts
// Companion script: scripts/seed-test-profiles.sh (kind 0 + kind 3).
//
// It drives the real app end-to-end (import → highlight → note → share →
// back up → sync) because annotations need real CFIs computed by the
// renderer — hand-built events would not resolve in a friend's reader.
// Relay writes are pinned to relay.abvstudio.net (not primal); it purges
// events after 60 days, so re-run when the demo data vanishes.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

test.skip(!process.env.SEED, 'seed utility — run with SEED=1');

const ACCOUNTS_FILE = path.resolve(import.meta.dirname, '../../my-projects/.test-accounts.json');
const CACHE_DIR = path.resolve(import.meta.dirname, 'seed-cache');
const RELAY = 'wss://relay.abvstudio.net';

const SEEDS = [
	{
		account: 'test-alice',
		gutenbergId: 1342,
		title: 'Pride and Prejudice',
		note: 'Opening line for the ages.'
	},
	{
		account: 'test-bob',
		gutenbergId: 84,
		title: 'Frankenstein',
		note: 'The framing letters set the whole tone.'
	},
	{
		account: 'test-carol',
		gutenbergId: 35,
		title: 'The Time Machine',
		note: 'Wells wastes no time getting started.'
	}
] as const;

async function privkeyOf(account: string): Promise<string> {
	const parsed = JSON.parse(await readFile(ACCOUNTS_FILE, 'utf8')) as {
		accounts: { name: string; privkey: string }[];
	};
	const found = parsed.accounts.find((a) => a.name === account);
	if (!found) throw new Error(`${account} not in ${ACCOUNTS_FILE}`);
	return found.privkey;
}

async function fetchBook(gutenbergId: number): Promise<Buffer> {
	await mkdir(CACHE_DIR, { recursive: true });
	const cached = path.join(CACHE_DIR, `${gutenbergId}.epub`);
	if (existsSync(cached)) return readFile(cached);
	const res = await fetch(`https://www.gutenberg.org/ebooks/${gutenbergId}.epub.images`);
	if (!res.ok) throw new Error(`Gutenberg ${gutenbergId}: HTTP ${res.status}`);
	const buffer = Buffer.from(await res.arrayBuffer());
	await writeFile(cached, buffer);
	return buffer;
}

// Same shadow-root walk as helpers.ts, but generic: select the Nth long
// paragraph in the currently VISIBLE section iframe (real books, unlike the
// fixture, open on cover/title pages with nothing selectable).
const SELECT_VISIBLE_PARAGRAPH = `((minLength, index) => {
	const iframes = [];
	const walk = (root) => {
		for (const el of root.querySelectorAll('*')) {
			if (el.tagName === 'IFRAME') iframes.push(el);
			if (el.shadowRoot) walk(el.shadowRoot);
		}
	};
	walk(document);
	const visible = iframes.filter((f) => {
		const r = f.getBoundingClientRect();
		return f.contentDocument?.body && r.width > 0 && r.right > 0 && r.left < innerWidth;
	});
	for (const frame of visible) {
		const doc = frame.contentDocument;
		const longOnes = [...doc.querySelectorAll('p')].filter(
			(p) => (p.textContent ?? '').trim().length >= minLength
		);
		const p = longOnes[index];
		if (!p) continue;
		const range = doc.createRange();
		range.selectNodeContents(p);
		const sel = doc.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
		p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		return true;
	}
	return false;
})`;

/** Paginate forward until a long paragraph can be selected (menu appears). */
async function selectProse(page: Page, index: number): Promise<void> {
	for (let pageTurns = 0; pageTurns < 40; pageTurns++) {
		const selected = await page.evaluate(
			({ fn, index }) => (eval(fn) as (m: number, i: number) => boolean)(120, index),
			{ fn: SELECT_VISIBLE_PARAGRAPH, index }
		);
		if (selected) {
			try {
				await page.waitForSelector('[data-testid="annotation-menu"]', {
					state: 'visible',
					timeout: 2000
				});
				return;
			} catch {
				/* menu didn't appear (e.g. preloaded section) — keep paginating */
			}
		}
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(250);
	}
	throw new Error('No selectable prose found within 40 page turns');
}

for (const seed of SEEDS) {
	test(`seed ${seed.account} with "${seed.title}"`, async ({ page }) => {
		test.setTimeout(300_000);
		const book = await fetchBook(seed.gutenbergId);

		// Login as the test account; pin sync/publish to our own relay.
		await page.addInitScript(
			({ key, relay }) => {
				localStorage.setItem('ncrypt', key);
				localStorage.setItem('plebchat-settings', JSON.stringify({ relays: [relay] }));
			},
			{ key: await privkeyOf(seed.account), relay: RELAY }
		);
		await page.goto('/read');
		await page.waitForSelector('[data-testid="import-epub"]');

		// Import (dedup toast means a previous run already did — still re-share/sync).
		await page.setInputFiles('input[type="file"]', {
			name: `${seed.title}.epub`,
			mimeType: 'application/epub+zip',
			buffer: book
		});
		await page.waitForSelector('[data-testid="book-card"]', { state: 'visible' });

		// Open and annotate: one yellow highlight, then a note further in.
		await page.click(`[data-testid="book-card"] > button`);
		await page.waitForSelector('[data-testid="epub-viewer"]', { state: 'visible' });
		await page.waitForTimeout(2000); // let the first section settle

		await selectProse(page, 0);
		await page.click('[data-testid="highlight-yellow"]');

		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(500);
		await selectProse(page, 1);
		await page.click('[data-testid="note-open"]');
		await page.fill('[data-testid="note-input"]', seed.note);
		await page.click('[data-testid="note-save"]');

		// Share both annotations publicly (plaintext 30104 + NIP-84 export).
		await page.click('[data-testid="annotations-toggle"]');
		const cards = page.getByTestId('annotation-card');
		await expect(cards).toHaveCount(2);
		for (let i = 0; i < 2; i++) {
			await cards.nth(i).hover();
			await cards.nth(i).getByTestId('annotation-share-toggle').click();
			await page.click('[data-testid="annotation-share-confirm"]');
		}

		// Back to the library; put the book on the public shelf.
		await page.click('[data-testid="reader-back"]');
		await page.hover('[data-testid="book-card"]');
		await page.click('[data-testid="book-card"] button[title="Book actions"]');
		await page.getByRole('menuitem', { name: 'Info' }).click();
		await page.click('[data-testid="book-share-toggle"]');
		await page.click('[data-testid="book-share-confirm"]');

		// Back up the file to Blossom so friends can actually download it.
		await page.getByRole('button', { name: /Back up file|Back up again/ }).click();
		await page.getByRole('button', { name: 'Back up', exact: true }).click();
		await expect(page.getByText(/Backed up to \d+ server/)).toBeVisible({ timeout: 120_000 });
		await page.locator('[role="dialog"][aria-label="Book info"] button[title="Close"]').click();

		// Publish everything.
		await page.click('[data-testid="sync-button"]');
		await page.click('[data-testid="sync-now"]');
		await expect(page.getByText(/Synced — pushed/)).toBeVisible({ timeout: 60_000 });
	});
}
