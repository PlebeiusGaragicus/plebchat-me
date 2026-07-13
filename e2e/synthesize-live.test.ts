// LIVE smoke for Synthesize mode (proposal Phase 5): drives a real edit
// request through the real BYO LLM endpoint — file tools + the patch
// approval gate. Needs a filled .env (the settings prefill from it) and is
// skipped in CI: run with  LIVE=1 npx playwright test e2e/synthesize-live.test.ts
//
// A local reasoning model can take minutes per turn — timeouts are generous.

import { expect, test } from '@playwright/test';
import { seedLogin } from './helpers.js';

test.skip(!process.env.LIVE, 'live smoke — set LIVE=1 (and fill .env) to run');

test('live agent roundtrip: patch_file proposal → approval → edited file', async ({ page }) => {
	test.setTimeout(420_000);

	await seedLogin(page);
	await page.goto('/synthesize');
	await page.getByTestId('new-project').click();
	await page.getByPlaceholder('Project name…').fill('Live Smoke');
	await page.keyboard.press('Enter');

	// A file with a known sentence for the model to edit.
	await page.getByRole('button', { name: 'New file', exact: true }).click();
	await page.getByPlaceholder('filename.md').fill('draft');
	await page.keyboard.press('Enter');
	await page.locator('[data-testid="artifact-editor"] .cm-content').click();
	await page.keyboard.type('The banana is yellow.');
	await page.waitForTimeout(700);

	await page.getByRole('button', { name: 'New chat', exact: true }).click();
	await page
		.getByTestId('ws-chat-input')
		.fill(
			"In draft.md, use patch_file to change the word 'yellow' to 'green'. Make exactly that one edit; do not ask questions."
		);
	await page.keyboard.press('Enter');

	// The model reads the project, then the patch stops at the approval gate.
	await expect(page.getByTestId('approval-banner')).toBeVisible({ timeout: 300_000 });
	await page.getByTestId('approve-patch').click();

	// The patched content lands in the open editor (the approval hook already
	// opened draft.md in the left column).
	await expect(page.locator('[data-testid="artifact-editor"] .cm-content')).toContainText(
		'green',
		{ timeout: 120_000 }
	);
});
