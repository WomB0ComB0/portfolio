import { expect, test } from '@playwright/test';

test('dark mode toggle', async ({ page }) => {
  const targetUrl = process.env.ENVIRONMENT_URL || 'https://www.mikeodnis.dev';

  await page.goto(targetUrl);

  const html = page.locator('html');
  const initialClass = await html.getAttribute('class');

  const darkModeButton = page.locator('button[aria-label="Toggle Dark Mode"]');
  await darkModeButton.click();

  const newClass = await html.getAttribute('class');
  expect(newClass).not.toBe(initialClass);
});
