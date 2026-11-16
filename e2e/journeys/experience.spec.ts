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

/**
 * @file /experience in a real browser, with JavaScript off and on: the story (the owner's pick
 * on 2026-11-15).
 *
 * "The path so far" follows the page header (every role a capsule on one month axis, each a link
 * to its stop), then the chapters on "Jump to" as real links. Now opens the cards under a small
 * heading, then every year a role began, each a chapter on one rail, a one-role year an inline
 * heading. Each role hangs off the rail with its title linking
 * its page, a byline in words, its sentence with links named in place (never a raw address),
 * quiet technologies, and, on a compact role, a closed "What I did" that opens without
 * JavaScript. Nothing is cut and nothing scrolls sideways at any width, and the keyboard reaches
 * every title and disclosure with a visible ring.
 *
 * The other specs: experience-history (jumps, Back and Forward), experience-look (the path, the
 * logos, the light, forced colours), experience-phone (touch and enlarged text), experience-text
 * (enlarged text on every width) and experience-role (a role's own page). A check whose data is
 * missing (no roles) is reported as skipped, never as passed.
 *
 * Read-only: every request is a GET (fixtures/console-routes.ts readOnly).
 */

import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  expectExternalLinks,
  expectNoOverflow,
  expectReadable,
  readOnly,
} from '../fixtures/console-routes';
import { cutIn, indexRows, ROW_TEXT, skipUnless, WIDTHS } from './experience-helpers';

const mainOf = (page: Page): Locator => page.locator('main#main-content');

test.beforeEach(async ({ page }) => readOnly(page));

for (const javaScriptEnabled of [false, true]) {
  test.describe(`Experience story, JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled });

    test('orders the chapters Now, then each year a role began, with no loading skeleton', async ({
      page,
    }) => {
      const stops = await indexRows(page);
      const main = mainOf(page);
      const chapters = main.locator('section[data-chapter]');

      await expect(chapters.first()).toHaveAttribute('id', 'now');
      const ids = await chapters.evaluateAll((sections) => sections.map((section) => section.id));
      const years = ids.slice(1).map((id) => Number(id.slice(1)));
      expect(years).toEqual([...years].sort((a, b) => b - a));
      // Now is a small heading: the lead role's title, not a display word, leads the page.
      const sizes = await chapters.evaluateAll((sections) =>
        sections.map((section) => section.getAttribute('data-chapter')),
      );
      expect(sizes[0]).toBe('inline');
      const fontSize = (locator: Locator) =>
        locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
      const nowSize = await fontSize(chapters.first().locator('h2'));
      const leadSize = await fontSize(stops.first().locator('h3'));
      if ((await stops.first().getAttribute('data-weight')) === 'lead') {
        expect(leadSize).toBeGreaterThan(nowSize);
      }
      await expectReadable(stops.first());
      await expect(main.locator('[aria-busy="true"]')).toHaveCount(0);
    });

    test('lists every chapter on "Jump to", each a real link to its section', async ({ page }) => {
      await indexRows(page);
      const main = mainOf(page);
      const links = main.getByRole('navigation', { name: 'Jump to' }).getByRole('link');
      const ids = await main
        .locator('section[data-chapter]')
        .evaluateAll((sections) => sections.map((section) => `#${section.id}`));

      skipUnless(ids.length > 1, 'One chapter only: there is nothing to jump between.');
      expect(
        await links.evaluateAll((all) => all.map((link) => link.getAttribute('href'))),
      ).toEqual(ids);
      await links.last().click();
      await expect(page).toHaveURL((url) => url.hash === ids.at(-1));
      await expect(main.locator(ids.at(-1) ?? '')).toBeInViewport();
    });

    test('hangs every role off the rail once, its title linking its page', async ({ page }) => {
      const stops = await indexRows(page);
      const ids = await stops.evaluateAll((all) => all.map((stop) => stop.id));

      expect(new Set(ids).size).toBe(await stops.count());
      for (const stop of await stops.all()) {
        const id = (await stop.getAttribute('data-id')) ?? '';
        await expect(stop.locator('[data-role-page]')).toHaveAttribute(
          'href',
          `/experience/${encodeURIComponent(id)}`,
        );
      }
      // One lead at most, set large, and it opens the page.
      const leads = await stops.evaluateAll((all) =>
        all.flatMap((stop, index) => (stop.dataset.weight === 'lead' ? [index] : [])),
      );
      expect(leads.length).toBeLessThanOrEqual(1);
      if (leads.length === 1) expect(leads[0]).toBe(0);
    });

    test('prints no raw address: every link in the words is named and opens a new tab', async ({
      page,
    }) => {
      await indexRows(page);
      const story = mainOf(page).locator('[data-role-story]');

      expect(await story.evaluate((root) => root.textContent ?? '')).not.toMatch(/https?:\/\//);
      await expectExternalLinks(story);
    });

    test('keeps a compact role\'s duties behind a closed "What I did" that opens in place', async ({
      page,
    }) => {
      await indexRows(page);
      const more = mainOf(page).locator('li[data-role-row] details[data-role-more]').first();
      skipUnless((await more.count()) > 0, 'No compact role has more to tell.');

      await expect(more).not.toHaveAttribute('open', '');
      await more.locator('> summary').click();
      await expect(more).toHaveAttribute('open', '');
      await expectReadable(more.locator('li, p').first());
      await more.locator('> summary').click();
      await expect(more).not.toHaveAttribute('open', '');
    });

    test('sets "The path so far" below the header before jumps and cards, every capsule a link to its stop', async ({
      page,
    }) => {
      const stops = await indexRows(page);
      const main = mainOf(page);
      const figure = main.locator('figure[data-role-path]');
      skipUnless((await figure.count()) > 0, 'Fewer than two dated roles: no path.');

      await expect(figure.locator('figcaption')).toContainText('The path so far.');
      expect(
        await figure.evaluate((element) => element.parentElement?.firstElementChild === element),
      ).toBe(true);
      const jumps = main.getByRole('navigation', { name: 'Jump to' });
      const boxes = await Promise.all([
        main.locator('header').first().boundingBox(),
        figure.boundingBox(),
        jumps.boundingBox(),
        main.locator('section[data-chapter]').first().boundingBox(),
      ]);
      for (const box of boxes) expect(box).not.toBeNull();
      for (let index = 1; index < boxes.length; index++) {
        const before = boxes[index - 1];
        const after = boxes[index];
        if (before && after) expect(after.y).toBeGreaterThanOrEqual(before.y + before.height - 1);
      }
      const capsules = figure.getByRole('link');
      const targets = await capsules.evaluateAll((all) =>
        all.map((link) => link.getAttribute('href')?.slice(1) ?? ''),
      );
      const ids = await stops.evaluateAll((all) => all.map((stop) => stop.id));
      expect([...targets].sort()).toEqual([...ids].sort());
      // Each is named by its organization, its role and its months.
      await expect(capsules.first()).toHaveAccessibleName(/^.+, .+, (since )?[A-Z][a-z]{2} \d{4}/);

      const last = capsules.last();
      const target = (await last.getAttribute('href')) ?? '';
      await last.click();
      await expect(page).toHaveURL((url) => url.hash === target);
      await expect(main.locator(target)).toBeInViewport();
    });

    for (const width of WIDTHS) {
      test(`fits at ${width}px with nothing cut and nothing sideways`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await indexRows(page);

        await expectNoOverflow(page);
        expect(await cutIn(mainOf(page).locator('[data-role-story]'), ROW_TEXT)).toEqual([]);
      });
    }
  });
}

test.describe('Experience story, keyboard only', () => {
  test('reaches a title and a "What I did" with a visible ring, and opens it from the keyboard', async ({
    page,
  }) => {
    const stops = await indexRows(page);
    const title = stops.first().locator('[data-role-page]');
    for (let presses = 0; presses < 60; presses += 1) {
      await page.keyboard.press('Tab');
      if (await title.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(title).toBeFocused();
    const ring = await title.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(ring.style).not.toBe('none');
    expect(ring.width).toBeGreaterThanOrEqual(2);

    const more = mainOf(page).locator('details[data-role-more]').first();
    skipUnless((await more.count()) > 0, 'No compact role has more to tell.');
    await more.locator('> summary').focus();
    await page.keyboard.press('Enter');
    await expect(more).toHaveAttribute('open', '');
    await page.keyboard.press('Space');
    await expect(more).not.toHaveAttribute('open', '');
  });

  test('moves down the rail in reading order: each title before the next role', async ({
    page,
  }) => {
    const stops = await indexRows(page);
    const order: string[] = [];
    for (let presses = 0; presses < 160 && order.length < 4; presses += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => {
        const active = document.activeElement;
        return active?.matches('[data-role-page]')
          ? (active.closest<HTMLElement>('li[data-role-row]')?.dataset.id ?? null)
          : null;
      });
      if (id && !order.includes(id)) order.push(id);
    }
    const expected = await stops.evaluateAll((all) =>
      all.slice(0, 4).map((stop) => stop.dataset.id ?? ''),
    );
    expect(order.length).toBeGreaterThan(0);
    expect(order).toEqual(expected.slice(0, order.length));
  });
});
