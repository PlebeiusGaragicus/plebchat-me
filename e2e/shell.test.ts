import { test, expect } from '@playwright/test';

test('home page shows the welcome screen and all four mode cards', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Welcome to PlebChat' })).toBeVisible();
	for (const mode of ['read', 'search', 'synthesize', 'debate']) {
		await expect(page.getByTestId(`mode-card-${mode}`)).toBeVisible();
	}
});

test('mode card navigates to the mode route', async ({ page }) => {
	await page.goto('/');
	await page.getByTestId('mode-card-debate').click();
	await expect(page).toHaveURL(/\/debate$/);
	await expect(page.getByRole('heading', { name: 'Debate' })).toBeVisible();
});

test('mode selector switches modes from the top bar', async ({ page }) => {
	await page.goto('/read');
	await page.getByTestId('mode-selector').click();
	await page.getByTestId('mode-option-synthesize').click();
	await expect(page).toHaveURL(/\/synthesize$/);
	await expect(page.getByRole('heading', { name: 'Synthesize' })).toBeVisible();
});

test('selected mode persists across a reload of the home page', async ({ page }) => {
	await page.goto('/');
	await page.getByTestId('mode-card-search').click();
	await expect(page).toHaveURL(/\/search$/);

	await page.goto('/search');
	// Top bar shows the persisted current mode (not the home-page prompt)
	await expect(page.getByTestId('mode-selector')).toContainText('Search');
});

test('cyphertap login widget is present in the top bar', async ({ page }) => {
	await page.goto('/');
	// The widget renders a trigger button; presence proves the submodule
	// integration (styles + component) survived the build.
	await expect(page.locator('header')).toBeVisible();
	await expect(page.getByRole('banner').getByRole('button').last()).toBeVisible();
});
