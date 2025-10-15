import { expect, test } from '@playwright/test';

test('guestbook page', async ({ page }) => {
  const targetUrl = process.env.ENVIRONMENT_URL || 'https://www.mikeodnis.dev';

  await page.goto(`${targetUrl}/guestbook`);

  const signInButton = page.locator('text=Sign in with Google');
  await expect(signInButton).toBeVisible();
});
