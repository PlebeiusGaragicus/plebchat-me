// Synthesize mode e2e: the workspace-core project dashboard (Phase 1).
// Later phases extend this file with pane layout, editor, and agent tests.
import { expect, test } from '@playwright/test';
import { seedLogin } from './helpers.js';

test('logged out: shows the login pitch', async ({ page }) => {
	await page.goto('/synthesize');
	await expect(page.getByRole('heading', { name: 'Synthesize' })).toBeVisible();
	await expect(page.getByText('Log in with the key button')).toBeVisible();
});

test('project lifecycle: create, deep-link, rename, delete', async ({ page }) => {
	await seedLogin(page);
	await page.goto('/synthesize');

	// Empty dashboard → create a project; it opens and mirrors into the URL.
	await expect(page.getByText('No projects yet')).toBeVisible();
	await page.getByTestId('new-project').click();
	await page.getByPlaceholder('Project name…').fill('Solar Punk Reader');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Solar Punk Reader' })).toBeVisible();
	await expect(page).toHaveURL(/\?project=proj-/);
	const url = page.url();

	// Deep link: a fresh load of the same URL reopens the project.
	await page.goto(url);
	await expect(page.getByRole('button', { name: 'Solar Punk Reader' })).toBeVisible();

	// Rename in place.
	await page.getByRole('button', { name: 'Solar Punk Reader' }).click();
	await page.locator('header input').fill('Lunar Punk Reader');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Lunar Punk Reader' })).toBeVisible();

	// Back to the dashboard: the card shows the new name, URL param cleared.
	await page.getByRole('button', { name: 'Back to projects' }).click();
	await expect(page.getByRole('heading', { name: 'Synthesize Projects' })).toBeVisible();
	await expect(page.getByText('Lunar Punk Reader')).toBeVisible();
	await expect(page.getByText('0 files')).toBeVisible();
	expect(new URL(page.url()).search).toBe('');

	// Delete with confirm.
	await page.getByText('Lunar Punk Reader').hover();
	await page.getByRole('button', { name: 'Delete project', exact: true }).click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByText('No projects yet')).toBeVisible();
});
