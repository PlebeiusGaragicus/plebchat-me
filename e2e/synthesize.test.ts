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

/** Create a file via the sidebar and wait for its editor tab. */
async function createFile(page: Page, name: string): Promise<void> {
	await page.getByRole('button', { name: 'New file', exact: true }).click();
	await page.getByPlaceholder('filename.md').fill(name);
	await page.keyboard.press('Enter');
	await expect(page.getByRole('tab', { name: new RegExp(`${name}\\.md`) })).toBeVisible();
}

const editorContent = (page: Page) => page.locator('[data-testid="artifact-editor"] .cm-content');

test('workspace: files, tabs, editing, and persistence', async ({ page }) => {
	await seedLogin(page);
	await page.goto('/synthesize');
	await createProject(page, 'Essay');

	// Create a file from the sidebar; it opens as a left tab with the editor.
	await createFile(page, 'draft');
	await editorContent(page).click();
	await page.keyboard.type('# Hello synthesis');
	// Live preview renders the heading (the "# " marker text stays while the line is active).
	await expect(editorContent(page).locator('.cm-header-1')).toBeVisible();

	// Second file opens in the RIGHT column (left occupied → split).
	await createFile(page, 'notes');
	await expect(editorContent(page)).toHaveCount(2);

	// Close the right panel: tabs fold into the left column.
	await page.getByTitle('Close panel').click();
	await expect(editorContent(page)).toHaveCount(1);
	await expect(page.getByRole('tab', { name: /draft\.md/ })).toBeVisible();
	await expect(page.getByRole('tab', { name: /notes\.md/ })).toBeVisible();

	// Content + tab arrangement survive a reload (debounced save + kv state).
	await page.waitForTimeout(700);
	await page.reload();
	await expect(page.getByRole('tab', { name: /notes\.md/ })).toBeVisible();
	await page.getByRole('tab', { name: /draft\.md/ }).click();
	await expect(editorContent(page)).toContainText('Hello synthesis');

	// Footer counts.
	await expect(page.getByText('0 chats · 2 files · 0 sources')).toBeVisible();
});

test('editor: version snapshots and wiki-links', async ({ page }) => {
	await seedLogin(page);
	await page.goto('/synthesize');
	await createProject(page, 'Versioned');

	await createFile(page, 'main');
	await editorContent(page).click();
	await page.keyboard.type('First draft.');
	await expect(page.getByTestId('version-indicator')).toHaveText('v1/1');

	// Snapshot → v2 carries the content; further edits stay on v2.
	await page.getByRole('button', { name: 'Snapshot as new version' }).click();
	await expect(page.getByTestId('version-indicator')).toHaveText('v2/2');
	await editorContent(page).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' Second thoughts.');
	await page.waitForTimeout(700); // debounced flush

	// Navigate back: v1 shows the pre-snapshot content, v2 the edited one.
	await page.getByRole('button', { name: 'Previous version' }).click();
	await expect(page.getByTestId('version-indicator')).toHaveText('v1/2');
	await expect(editorContent(page)).not.toContainText('Second thoughts');
	await page.getByRole('button', { name: 'Next version' }).click();
	await expect(editorContent(page)).toContainText('Second thoughts.');

	// A [[wiki-link]] is decorated; Cmd/Ctrl+click creates and opens the target.
	await editorContent(page).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' See [[appendix.md]] for data.');
	await expect(editorContent(page).locator('.cm-wikilink').first()).toBeVisible();
	await editorContent(page)
		.locator('.cm-wikilink')
		.first()
		.click({ modifiers: ['ControlOrMeta'] });
	await expect(page.getByRole('tab', { name: /appendix\.md/ })).toBeVisible();
	await expect(page.getByText('2 files')).toBeVisible();
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
