// Synthesize mode e2e: workspace-core dashboard (Phase 1) and the pane
// layout — sidebar, tabbed columns, file/source panes (Phase 2). The editor
// and agent tests join in later phases.
import { expect, test, type Page } from '@playwright/test';
import { seedLogin } from './helpers.js';

test('logged out: shows the login pitch', async ({ page }) => {
	await page.goto('/synthesize');
	await expect(page.getByRole('heading', { name: 'Synthesize' })).toBeVisible();
	await expect(page.getByText('Log in with the key button')).toBeVisible();
});

/** Create a project from the dashboard and land in its workspace. */
async function createProject(page: Page, title: string): Promise<void> {
	await page.getByTestId('new-project').click();
	await page.getByPlaceholder('Project name…').fill(title);
	await page.keyboard.press('Enter');
	// The sidebar header shows the project title once the workspace is open.
	await expect(page.getByRole('button', { name: title })).toBeVisible();
}

test('project lifecycle: create, deep-link, rename, delete', async ({ page }) => {
	await seedLogin(page);
	await page.goto('/synthesize');

	await expect(page.getByText('No projects yet')).toBeVisible();
	await createProject(page, 'Solar Punk Reader');
	await expect(page).toHaveURL(/\?project=proj-/);
	const url = page.url();

	// Deep link: a fresh load of the same URL reopens the project.
	await page.goto(url);
	await expect(page.getByRole('button', { name: 'Solar Punk Reader' })).toBeVisible();

	// Back to the dashboard via the sidebar header; rename on the card.
	await page.getByRole('button', { name: 'Solar Punk Reader' }).click();
	await expect(page.getByRole('heading', { name: 'Synthesize Projects' })).toBeVisible();
	expect(new URL(page.url()).search).toBe('');
	await page.getByRole('heading', { name: 'Solar Punk Reader' }).hover();
	await page.getByRole('button', { name: 'Rename project', exact: true }).click();
	await page.locator('.group input[type="text"]').fill('Lunar Punk Reader');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('heading', { name: 'Lunar Punk Reader' })).toBeVisible();
	await expect(page.getByText('0 files')).toBeVisible();

	// Delete with confirm.
	await page.getByRole('heading', { name: 'Lunar Punk Reader' }).hover();
	await page.getByRole('button', { name: 'Delete project', exact: true }).click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByText('No projects yet')).toBeVisible();
});

test('workspace: files, tabs, editing, and persistence', async ({ page }) => {
	await seedLogin(page);
	await page.goto('/synthesize');
	await createProject(page, 'Essay');

	// Create a file from the sidebar; it opens as a left tab with a textarea.
	await page.getByRole('button', { name: 'New file', exact: true }).click();
	await page.getByPlaceholder('filename.md').fill('draft');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('tab', { name: /draft\.md/ })).toBeVisible();
	await page.getByPlaceholder('Start writing…').fill('# Hello synthesis');

	// Second file opens in the RIGHT column (left occupied → split).
	await page.getByRole('button', { name: 'New file', exact: true }).click();
	await page.getByPlaceholder('filename.md').fill('notes');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('tab', { name: /notes\.md/ })).toBeVisible();
	// Both panes visible: two textareas.
	await expect(page.getByPlaceholder('Start writing…')).toHaveCount(2);

	// Close the right panel: tabs fold into the left column.
	await page.getByTitle('Close panel').click();
	await expect(page.getByPlaceholder('Start writing…')).toHaveCount(1);
	await expect(page.getByRole('tab', { name: /draft\.md/ })).toBeVisible();
	await expect(page.getByRole('tab', { name: /notes\.md/ })).toBeVisible();

	// Content + tab arrangement survive a reload (debounced save + kv state).
	await page.waitForTimeout(700);
	await page.reload();
	await expect(page.getByRole('tab', { name: /notes\.md/ })).toBeVisible();
	await page.getByRole('tab', { name: /draft\.md/ }).click();
	await expect(page.getByPlaceholder('Start writing…')).toHaveValue('# Hello synthesis');

	// Footer counts.
	await expect(page.getByText('0 chats · 2 files · 0 sources')).toBeVisible();
});

test('workspace: sources and chats', async ({ page }) => {
	await seedLogin(page);
	await page.goto('/synthesize');
	await createProject(page, 'Research');

	// Add a manual source; it opens rendered as markdown.
	await page.getByRole('button', { name: 'Add source', exact: true }).click();
	await page.getByPlaceholder('Title').fill('Nostr NIPs');
	await page.getByPlaceholder('URL (optional)').fill('https://example.com/nips');
	await page.getByPlaceholder(/Paste the source content/).fill('## Relays\nEvents flow.');
	await page.getByRole('button', { name: 'Add source', exact: true }).nth(1).click();
	await expect(page.getByRole('tab', { name: 'Nostr NIPs' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Relays' })).toBeVisible();
	await expect(page.getByRole('link', { name: /example\.com\/nips/ })).toBeVisible();

	// New chat opens a thread tab (placeholder pane until Phase 4).
	await page.getByRole('button', { name: 'New chat', exact: true }).click();
	await expect(page.getByRole('tab', { name: 'New Chat' })).toBeVisible();

	await expect(page.getByText('1 chat · 0 files · 1 source')).toBeVisible();
});
