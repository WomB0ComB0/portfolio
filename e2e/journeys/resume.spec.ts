/**
 * Copyright 2026 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** Native resume access remains available when application JavaScript is disabled. */
import { expect, test } from '@playwright/test';
import { getTargetUrl } from '../fixtures/base';

const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
] as const;

for (const profile of profiles) {
  test.describe(`resume without JavaScript: ${profile.name}`, () => {
    test.use({
      viewport: profile.viewport,
      isMobile: profile.mobile,
      hasTouch: profile.mobile,
      javaScriptEnabled: false,
      serviceWorkers: 'block',
    });
    test.beforeEach(async ({ page }) => {
      await page.route('**/*', (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (
          !['GET', 'HEAD'].includes(request.method()) ||
          /sentry|analytics|logtail|betterstack/.test(url.hostname) ||
          url.pathname === '/monitoring'
        )
          return route.abort();
        return route.continue();
      });
      const response = await page.goto(`${getTargetUrl()}/resume`, { waitUntil: 'load' });
      expect(response?.status()).toBe(200);
    });

    test('shows the full original URL above the preview, without truncation or a disclosure', async ({
      page,
    }) => {
      const main = page.locator('main#main-content');
      await expect(main.locator('h1')).toHaveCount(1);
      const direct = main.locator('a[data-resume-direct-link]');
      const open = main.getByRole('link', { name: 'Open PDF', exact: true });
      const url = await open.getAttribute('href');
      expect(url).toMatch(
        /^https:\/\/cdn\.sanity\.io\/files\/34jrnkds\/production\/[A-Za-z0-9]+\.pdf$/,
      );
      await expect(direct).toBeVisible();
      await expect(direct).toHaveAttribute('href', url ?? '');
      expect(await direct.textContent()).toBe(url);
      expect(
        await direct.evaluate((element) => element.closest('details, [hidden]') !== null),
      ).toBe(false);
      const viewer = main.locator('iframe[title="Resume PDF"]');
      await expect(viewer).toBeHidden();
      const previewToggle = main.locator('details[data-resume-preview] summary');
      await direct.focus();
      await page.keyboard.press('Tab');
      await expect(previewToggle).toBeFocused();
      const focusOutline = () =>
        previewToggle.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            width: Number.parseFloat(style.outlineWidth),
            offset: Number.parseFloat(style.outlineOffset),
          };
        });
      expect((await focusOutline()).width).toBeGreaterThan(0);
      expect((await focusOutline()).offset).toBeLessThanOrEqual(0);
      await page.keyboard.press('Enter');
      expect((await focusOutline()).offset).toBeLessThanOrEqual(0);
      await expect(viewer).toBeVisible();
      expect(
        await direct.evaluate((element) => {
          const preview = document.querySelector('iframe[title="Resume PDF"]');
          return (
            preview !== null &&
            Boolean(element.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING)
          );
        }),
      ).toBe(true);
      const directBox = await direct.boundingBox();
      const previewBox = await viewer.boundingBox();
      if (!directBox || !previewBox) throw new Error('missing direct link or preview');
      expect(directBox.y + directBox.height).toBeLessThan(previewBox.y);
      await direct.selectText();
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(url);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await open.click({ trial: true });
    });

    test('downloads through the CDN attachment response with no application script', async ({
      page,
    }) => {
      const button = page.getByRole('link', { name: 'Download PDF', exact: true });
      const href = await button.getAttribute('href');
      expect(new URL(href ?? '').searchParams.get('dl')).toBe('Mike-Odnis-Resume.pdf');
      const pending = page.waitForEvent('download', {
        predicate: (download) => new URL(download.url()).searchParams.has('dl'),
      });
      await button.click();
      const download = await pending;
      expect(download.suggestedFilename()).toBe('Mike-Odnis-Resume.pdf');
      expect(await download.failure()).toBeNull();
      await expect(page).toHaveURL(/\/resume$/);
    });
  });
}
