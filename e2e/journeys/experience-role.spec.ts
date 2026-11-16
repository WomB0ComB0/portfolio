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
 * @file A role's page, /experience/[id], in a real browser with JavaScript off and on.
 *
 * It is "this role on the clock, then what it was": its months among every other role's, the
 * roles that ran alongside, the description, duties, links and technologies, and the roles
 * before and after it in the list's order. Its figures are checked against the list, so
 * nothing here is a number written into the test. It fits every width with nothing cut, an
 * unknown id answers 404, and the keyboard reaches every link in reading order. (The way back
 * to the list is experience-history.spec.ts's; touch and enlarged text are
 * experience-phone.spec.ts's.)
 *
 * Read-only: every request is a GET (fixtures/console-routes.ts readOnly).
 */

import { expect, test } from '@playwright/test';
import { getTargetUrl } from '../fixtures/base';
import {
  expectExternalLinks,
  expectNoOverflow,
  expectReadable,
  readOnly,
} from '../fixtures/console-routes';
import { cutIn, listedRoles, openRole, PAGE_TEXT, skipUnless, WIDTHS } from './experience-helpers';

test.beforeEach(async ({ page }) => readOnly(page));

for (const javaScriptEnabled of [false, true]) {
  test.describe(`A role's page, JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled });

    test('shows the role on the clock, then what it was, with no loading skeleton', async ({
      page,
    }) => {
      const roles = await listedRoles(page);
      // An ended role when there is one: its months are not all the clock's last ones.
      const role = skipUnless(roles.at(-1), 'The list has no role: no page to open.');
      const main = await openRole(page, role);

      await expectReadable(main.locator('[data-role-facts]'));
      await expectReadable(main.locator('[data-role-on-clock]'));
      await expectReadable(main.locator('[data-role-description]'));
      await expect(main.locator('[data-role-facts] time').first()).toHaveAttribute(
        'datetime',
        /^\d{4}-\d{2}$/,
      );
      await expect(main).not.toContainText(/https?:\/\//);
    });

    test("draws the role's own months, as many as the list draws for it", async ({ page }) => {
      const roles = await listedRoles(page);
      skipUnless(roles.length > 0, 'The list has no role: no page to open.');
      for (const role of [roles[0], roles.at(-1)]) {
        if (!role) continue;
        const main = await openRole(page, role);
        const stack = main.locator('[data-month-stack]');

        await expect(stack).toHaveAttribute('data-focus', role.id);
        const drawn = await stack.evaluate((element, id) => {
          const cells = Array.from(element.querySelectorAll<HTMLElement>('i'));
          const own = cells.filter((cell) => cell.dataset.r === id);
          const columns = Array.from(element.querySelectorAll(':scope > div > span'));
          return {
            own: own.length,
            toned: cells.filter((cell) => cell.dataset.tone).length,
            // In each of its columns the role's cell is the first: the bottom row.
            bottom: columns.filter((column) => {
              const first = column.querySelector<HTMLElement>('i');
              return first?.dataset.r === id;
            }).length,
            band: element.querySelectorAll('[data-stack-band]').length,
          };
        }, role.id);

        expect(drawn.own).toBe(role.months);
        expect(drawn.toned).toBe(role.months);
        expect(drawn.bottom).toBe(role.months);
        expect(drawn.band).toBe(1);
      }
    });

    test('counts the roles alongside from the links it lists, each to a listed role', async ({
      page,
    }) => {
      const roles = await listedRoles(page);
      const role = skipUnless(roles[0], 'The list has no role: no page to open.');
      const main = await openRole(page, role);
      const companions = main.locator('[data-role-companion]');
      const count = await companions.count();

      await expect(main.locator('[data-role-beside] .figure-md')).toHaveText(String(count));
      const hrefs = await companions.evaluateAll((links) =>
        links.map((link) => link.getAttribute('href')),
      );
      const listed = new Set(roles.map((each) => each.href));
      expect(new Set(hrefs).size).toBe(count);
      for (const href of hrefs) expect(listed.has(href ?? '')).toBe(true);
      expect(hrefs).not.toContain(role.href);
      if (count > 0) {
        await expect(main.locator('[data-role-companions-note]')).toHaveText(
          new RegExp(`^${count} roles?, by months shared$`),
        );
        await expect(companions.first().locator('[data-role-length]')).toBeVisible();
      }
    });

    test('keeps its links links: new tabs for addresses, /projects for technologies', async ({
      page,
    }) => {
      const roles = await listedRoles(page);
      skipUnless(roles.length > 0, 'The list has no role: no page to open.');
      for (const role of roles.slice(0, 4)) {
        const main = await openRole(page, role);
        await expectExternalLinks(main);
        for (const token of await main.locator('[data-role-tech] a').all()) {
          expect(await token.getAttribute('href')).toMatch(/^\/projects\?tech=[^&]+$/);
          await expect(token).toContainText(/\d+ projects?$/);
        }
      }
    });

    test("steps through the roles in the list's order, and back to the list", async ({ page }) => {
      const roles = await listedRoles(page);
      const first = skipUnless(roles[0], 'The list has no role: no page to open.');
      const second = roles[1];
      const main = await openRole(page, first);

      await expect(main.locator('[data-role-step="previous"]')).toHaveCount(0);
      if (second) {
        const next = main.locator('[data-role-step="next"]');
        await expect(next).toHaveAttribute('href', second.href);
        await next.click();
        await expect(page).toHaveURL((url) => url.pathname === second.href);
        await expect(main.locator('h1')).toHaveText(second.title);
        await expect(main.locator('[data-role-step="previous"]')).toHaveAttribute(
          'href',
          first.href,
        );
      }

      await main.getByRole('link', { name: 'All experience' }).click();
      await expect(page).toHaveURL((url) => url.pathname === '/experience');
      await expect(main.getByRole('heading', { level: 1, name: 'Experience' })).toBeVisible();
    });

    for (const width of WIDTHS) {
      test(`fits at ${width}px with nothing cut`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const roles = await listedRoles(page);
        // The longest title is the hardest to fit.
        const role = skipUnless(
          [...roles].sort((a, b) => b.title.length - a.title.length)[0],
          'The list has no role: no page to fit.',
        );
        const main = await openRole(page, role);

        await expectNoOverflow(page);
        expect(await cutIn(main, PAGE_TEXT)).toEqual([]);
        // The title wraps when it must: never clipped, never on one cut line.
        const title = await main.locator('h1').evaluate((heading) => {
          const style = getComputedStyle(heading);
          const box = heading.getBoundingClientRect();
          return {
            overflow: style.overflow,
            ellipsis: style.textOverflow === 'ellipsis',
            nowrap: style.whiteSpace === 'nowrap',
            inside: box.left >= 0 && box.right <= window.innerWidth,
          };
        });
        expect(title).toEqual({
          overflow: 'visible',
          ellipsis: false,
          nowrap: false,
          inside: true,
        });
      });
    }
  });
}

test.describe("A role's page, every role", () => {
  test.use({ javaScriptEnabled: false });

  test("links each role to the ones before and after it in the list's order", async ({ page }) => {
    test.slow();
    const roles = await listedRoles(page);
    skipUnless(roles.length > 0, 'The list has no role: no page to open.');
    for (const [index, role] of roles.entries()) {
      const main = await openRole(page, role);
      const hrefOf = async (kind: 'previous' | 'next'): Promise<string | null> => {
        const step = main.locator(`[data-role-step="${kind}"]`);
        return (await step.count()) ? step.getAttribute('href') : null;
      };

      expect(await hrefOf('previous'), role.href).toBe(roles[index - 1]?.href ?? null);
      expect(await hrefOf('next'), role.href).toBe(roles[index + 1]?.href ?? null);
    }
  });

  test('answers 404 for an id no role has', async ({ page }) => {
    const response = await page.goto(`${getTargetUrl()}/experience/__nope__`);

    expect(response?.status()).toBe(404);
  });
});

test.describe("A role's page, keyboard only", () => {
  test('tabs through its links in reading order, each with a visible focus ring', async ({
    page,
  }) => {
    const roles = await listedRoles(page);
    const role = skipUnless(roles[0], 'The list has no role: no page to open.');
    const main = await openRole(page, role);
    const stops = main.locator('a[href], button, summary');
    const count = await stops.count();
    expect(count).toBeGreaterThan(0);

    await stops.first().focus();
    for (let index = 0; index < count; index += 1) {
      if (index > 0) await page.keyboard.press('Tab');
      const stop = stops.nth(index);
      expect(
        await stop.evaluate((element) => element === document.activeElement),
        `stop ${index} of ${count}`,
      ).toBe(true);
    }

    // The last stops are the steps: tiles that ring themselves when focused from the keyboard.
    const ring = await stops.last().evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(ring.style).not.toBe('none');
    expect(ring.width).toBeGreaterThanOrEqual(2);
  });
});
