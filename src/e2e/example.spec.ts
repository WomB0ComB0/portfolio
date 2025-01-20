import { expect, test } from '@playwright/test';

test('visit page and take screenshot', async ({ page }) => {
  const targetUrl = process.env.ENVIRONMENT_URL || 'https://www.mikeodnis.dev';

  const response = await page.goto(targetUrl);

  expect(response?.status(), 'should respond with correct status code').toBeLessThan(400);

  await page.screenshot({ path: 'screenshot.jpg' });
});
