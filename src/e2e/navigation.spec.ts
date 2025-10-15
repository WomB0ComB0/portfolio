import { expect, test } from '@playwright/test';

test('navigation links', async ({ page }) => {
  const targetUrl = process.env.ENVIRONMENT_URL || 'https://www.mikeodnis.dev';

  await page.goto(targetUrl);

  const links = [
    { name: 'About', path: '/about' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Projects', path: '/projects' },
    { name: 'Blog', path: '/blog' },
    { name: 'Guestbook', path: '/guestbook' },
    { name: 'Resume', path: '/resume' },
  ];

  for (const link of links) {
    await page.click(`text=${link.name}`);
    await page.waitForURL(`${targetUrl}${link.path}`);
    expect(page.url()).toBe(`${targetUrl}${link.path}`);
  }
});
