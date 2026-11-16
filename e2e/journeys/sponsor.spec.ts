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

import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  expectExternalLinks,
  expectNoOverflow,
  expectSettled,
  openConsolePage,
  readOnly,
} from '../fixtures/console-routes';

test.beforeEach(async ({ page }) => readOnly(page));

/** A 200% root font, set without waiting on a load event, so it works with JavaScript off too. */
async function enlargeText(page: Page): Promise<void> {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = 'html{font-size:200%}';
    document.head.append(style);
  });
}

/** Boxes in `main` that reach past the window's edges: content a reader cannot see. */
async function offScreen(main: Locator): Promise<string[]> {
  return main.evaluate((root) =>
    Array.from(root.querySelectorAll('*'))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || element.closest('.sr-only')) return false;
        return box.right > window.innerWidth + 0.5 || box.left < -0.5;
      })
      .map((element) => `${element.tagName} ${element.textContent?.trim().slice(0, 30)}`),
  );
}

for (const javaScriptEnabled of [false, true]) {
  test.describe(`Sponsor ways, JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled });

    test('puts the GitHub action first, with four ways and a real thank-you state', async ({
      page,
    }) => {
      const main = await openConsolePage(page, '/sponsor', 'Sponsor');
      await expectSettled(main);
      await expect(main.locator('a').first()).toContainText('Sponsor on GitHub');
      const ways = main.locator('[data-sponsor-ways]');
      await expect(ways.locator('li')).toHaveCount(4);
      await expect(ways.getByRole('heading', { level: 3 })).toHaveText([
        /GitHub Sponsors/,
        /Open Collective/,
        /Ko-fi/,
        /Buy Me a Coffee/,
      ]);
      // The thank-you column keeps its label in every state; under it are the people, or one of
      // the two worded empty states.
      const thanks = main.locator('[data-sponsor-thanks-section]');
      await expect(thanks.getByRole('heading', { level: 2, name: 'Thank you' })).toBeVisible();
      await expect(
        thanks.locator('[data-sponsor-thanks]').or(
          thanks.getByRole('heading', {
            level: 3,
            name: /^(No sponsors yet|Couldn't load sponsors)$/,
          }),
        ),
      ).toBeVisible();
      // No rates (the owner decided against them) and no benefits copy (shipped off). The
      // benefits element must be absent; its words are matched in any case ("Early access").
      await expect(main.locator('[data-example-amount]')).toHaveCount(0);
      await expect(main).not.toContainText(/\$\s?\d/);
      await expect(main.locator('[data-sponsor-benefits]')).toHaveCount(0);
      await expect(main).not.toContainText(/early access/i);
      const email = main.getByRole('link', { name: 'Email', exact: true });
      await expect(email).toHaveAttribute('href', /^mailto:/);
      await expect(email).not.toHaveAttribute('target', '_blank');
      await expectExternalLinks(main);
    });

    for (const width of [390, 1440]) {
      test(`keeps the sponsorship action and first way in the first screen at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        const main = await openConsolePage(page, '/sponsor', 'Sponsor');
        await expect(main.getByRole('link', { name: /Sponsor on GitHub/ })).toBeInViewport();
        await expect(main.locator('[data-sponsor-ways] li').first()).toBeInViewport();
        await expectNoOverflow(page);
      });
    }

    for (const width of [320, 390]) {
      test(`keeps every word on screen with text at 200% at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        const main = await openConsolePage(page, '/sponsor', 'Sponsor');
        await enlargeText(page);

        // "Sponsor on GitHub" on one line once widened the header past the screen.
        expect(await offScreen(main)).toEqual([]);
        await expectNoOverflow(page);
      });
    }

    test('lines the thank-you label up with the ways label on a wide page', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const main = await openConsolePage(page, '/sponsor', 'Sponsor');
      const label = (section: string) =>
        main.locator(`${section} > h2`).evaluate((heading) => {
          const box = heading.getBoundingClientRect();
          return { top: box.top, height: box.height, size: getComputedStyle(heading).fontSize };
        });

      expect(await label('[data-sponsor-thanks-section]')).toEqual(
        await label('[data-sponsor-ways]'),
      );
    });
  });
}

test.describe('Sponsor in forced colours', () => {
  test.use({ forcedColors: 'active' });

  test('draws both header actions as buttons, each with its own box', async ({ page }) => {
    const main = await openConsolePage(page, '/sponsor', 'Sponsor');
    for (const name of [/Sponsor on GitHub/, /^Email$/]) {
      const border = await main
        .locator('header')
        .getByRole('link', { name })
        .evaluate((link) => {
          const style = getComputedStyle(link);
          return `${style.borderTopStyle} ${style.borderTopWidth}`;
        });
      // Forced colours drop background colours; only a border still draws the button's box.
      expect(border, String(name)).toMatch(/^solid [1-9]/);
    }
  });
});
