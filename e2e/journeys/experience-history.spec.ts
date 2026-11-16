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
 * @file /experience (the story) and the history, in a real browser: jumps to a role's stop on
 * the rail and the way back. A "row" here is a stop (li[data-role-row]).
 *
 * A role's "All experience" leads back to its own stop, the lead's included, which wears a rim
 * while it is the page's target, with JavaScript and without. The page links its chapters, not
 * its roles, so a jump to a stop on the page is made through plain #links the test adds, as a
 * link in a description would be.
 *
 * With JavaScript, a Back or Forward to the list comes back to where the visitor was, never to
 * the stop the address names, and the "What I did" they had opened is open again: after a link
 * arrival at a stop, after a jump on the page, on a Back between two jumps on the page, after a
 * reload of a fragment address, and after a jump made before the page was ready, when the page's
 * first entry still has to be handed to the router (a later Back to it must show the list, not
 * leave a role page on screen, even two steps at once from a role page).
 *
 * A jump to the stop the address already names goes to that stop every time, by click and by
 * Enter, as it does without JavaScript. And a Back two steps at once onto an entry the router
 * skips shows the list where the visitor left it, loaded anew exactly once, from a role page and
 * from a role page the browser loaded anew after the visitor left the site.
 *
 * Read-only: every request is a GET (fixtures/console-routes.ts readOnly).
 */

import { expect, type Locator, type Page, type Route, test } from '@playwright/test';
import { getTargetUrl } from '../fixtures/base';
import { readOnly } from '../fixtures/console-routes';
import {
  clickKeepingScroll,
  expectLanded,
  hydrated,
  indexRows,
  listedRoles,
  openRole,
  skipUnless,
} from './experience-helpers';

/** How far a restored scroll may be from where the visitor left: subpixel rounding only. */
const SCROLL_SLACK = 2;

/** A stop's "What I did", the one part of a stop that opens; absent on a role with nothing more. */
const moreOf = (row: Locator): Locator => row.locator('details[data-role-more]');

/**
 * Plain #links to the second, third and fourth stops, pinned to the window's corner, as a link
 * in a description on screen would be: the page links its chapters ("Jump to"), not its roles, so a jump to a
 * role is made through these.
 */
async function jumpLinks(page: Page): Promise<Locator> {
  await page.locator('main#main-content li[data-role-row]').first().waitFor({ state: 'attached' });
  await page.evaluate(() => {
    if (document.querySelector('[data-test-jumps]')) return;
    const nav = document.createElement('nav');
    nav.dataset.testJumps = '';
    // Pinned on screen, as a link the visitor can see is: following it never scrolls first.
    nav.style.cssText =
      'position:fixed;top:0;right:0;z-index:2147483647;display:flex;gap:8px;background:#000;padding:4px';
    const stops = Array.from(
      document.querySelectorAll<HTMLElement>('main#main-content li[data-role-row]'),
    ).slice(1, 4);
    for (const [at, stop] of stops.entries()) {
      const link = document.createElement('a');
      link.href = `#${stop.id}`;
      // Short, so the pinned row fits a phone's width.
      link.textContent = `Stop ${at + 2}`;
      link.dataset.testJump = '';
      nav.append(link, document.createTextNode(' '));
    }
    // The body's last child: React's hydration skips a node it did not render there, so the
    // links may be added before the page hydrates.
    document.body.append(nav);
  });
  return page.locator('a[data-test-jump]');
}
const scrollOf = (page: Page): Promise<number> => page.evaluate(() => window.scrollY);

/**
 * From the list, scrolled to `row`: opens it, follows its "Role page", goes Back, and checks
 * the visitor is where they clicked, with the row open again and the list on screen.
 */
async function roundTripFrom(page: Page, row: Locator): Promise<void> {
  const main = page.locator('main#main-content');
  await row.evaluate((element) => {
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 160 });
  });
  const more = moreOf(row);
  const opens = (await more.count()) > 0;
  if (opens && (await more.getAttribute('open')) === null) await more.locator('> summary').click();
  if (opens) await expect(more).toHaveAttribute('open', '');
  const id = await row.getAttribute('data-id');
  const before = page.url();
  const atClick = await clickKeepingScroll(page, row.locator('[data-role-page]'));
  await expect(page).toHaveURL((url) => /^\/experience\/[^/]+$/.test(url.pathname));
  await expect(main.locator('[data-role-on-clock]')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(before);
  await expect(main.getByRole('heading', { level: 1, name: 'Experience' })).toBeVisible();
  await expect
    .poll(async () => Math.abs((await scrollOf(page)) - atClick))
    .toBeLessThanOrEqual(SCROLL_SLACK);
  if (opens) {
    await expect(moreOf(main.locator(`li[data-role-row][data-id="${id}"]`))).toHaveAttribute(
      'open',
      '',
    );
  }
}

/** A row far from the first screen: the second from last. */
const farRow = (page: Page): Locator => page.locator('main#main-content li[data-role-row]').nth(-2);

/** How a visitor follows a link: a click, or Enter on it from the keyboard. */
const FOLLOW = ['click', 'Enter'] as const;

/**
 * Scrolled away from the row the address names, follows `link` (a jump to that same row) each
 * way in FOLLOW, and checks the visitor lands on the row every time, inside its rim: the address
 * does not change, so it is the same entry each time, never a step back to it.
 */
async function followAgain(page: Page, link: Locator): Promise<void> {
  for (const how of FOLLOW) {
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect.poll(() => scrollOf(page)).toBe(0);
    const entries = await page.evaluate(() => window.history.length);
    if (how === 'click') {
      await link.click();
    } else {
      await link.focus();
      await page.keyboard.press('Enter');
    }
    await expectLanded(page);
    expect(await page.evaluate(() => window.history.length)).toBe(entries);
  }
}

/**
 * Loads the list with its scripts held, scrolls to `top`, makes a jump the browser alone handles
 * (`jump`: the address takes a row's fragment, a new entry without state), then lets the page
 * hydrate. Resolves to where the visitor was when they jumped (the list's first entry's scroll)
 * and the row's fragment; the test is skipped when the list has no row.
 */
async function jumpBeforeReady(
  page: Page,
  top: number,
  jump: (page: Page, hash: string) => Promise<void>,
): Promise<{ readonly left: number; readonly hash: string }> {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = (url: URL): boolean =>
    url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.js');
  const hold = async (route: Route): Promise<void> => {
    await gate;
    await route.fallback();
  };
  await page.route(held, hold);
  await page.goto(`${getTargetUrl()}/experience`, { waitUntil: 'commit' });
  const main = page.locator('main#main-content');
  await expect(main.locator('h1')).toBeVisible();
  const row = main.locator('li[data-role-row]').first();
  if ((await row.count()) === 0) release();
  skipUnless((await row.count()) > 0, 'The list shows its empty state: no row to jump to.');
  const hash = `#${await row.getAttribute('id')}`;
  await page.evaluate((y) => window.scrollTo({ top: y }), top);
  await expect.poll(() => scrollOf(page)).toBe(top);
  await jump(page, hash);
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(hash);
  release();
  await hydrated(page);
  await page.unroute(held, hold);
  return { left: top, hash };
}

/** The browser's own fragment jump, from wherever the page is scrolled (a plain #link). */
const hashJump = (page: Page, hash: string): Promise<void> =>
  page.evaluate((fragment) => {
    window.location.hash = fragment;
  }, hash);

/**
 * Resolves once the hydrated page has been drawn and its effects have run: the router's own
 * (it follows history writes made outside it only from then on) and a role page's guard.
 */
const effectsRun = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
      }),
  );

/** Counts the documents the page loads from now on: a reload is one. */
function documentLoads(page: Page): () => number {
  let loads = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) loads += 1;
  });
  return () => loads;
}

/** Follows `row`'s title, its role page's link, and waits for that page. */
async function toRolePage(page: Page, row: Locator): Promise<void> {
  await row.locator('[data-role-page]').click();
  await expect(page).toHaveURL((url) => /^\/experience\/[^/]+$/.test(url.pathname));
  await expect(page.locator('main#main-content [data-role-on-clock]')).toBeVisible();
}

test.beforeEach(async ({ page }) => readOnly(page));

for (const javaScriptEnabled of [false, true]) {
  test.describe(`A role's page, the way back, JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled });

    test('leads back to the row the visitor came from, which wears the rim', async ({ page }) => {
      const roles = await listedRoles(page);
      // The second stop: a role off the first screen.
      const role = skipUnless(roles[1], 'One role only: no stop off the first screen.');
      const main = await openRole(page, role);
      const back = main.getByRole('link', { name: 'All experience' });

      await expect(back).toHaveAttribute('href', `/experience#role-${role.id}`);
      await back.click();
      await expect(page).toHaveURL(
        (url) => url.pathname === '/experience' && url.hash === `#role-${role.id}`,
      );
      await expect(main.getByRole('heading', { level: 1, name: 'Experience' })).toBeVisible();
      await expect(main.locator(`li[data-role-row][data-id="${role.id}"]`)).toBeInViewport();
      await expectLanded(page);
    });

    test('leads the lead role back to its own stop too: the story hangs every role on the rail', async ({
      page,
    }) => {
      const roles = await listedRoles(page);
      const lead = skipUnless(roles[0], 'No role is listed.');
      const main = await openRole(page, lead);
      const back = main.getByRole('link', { name: 'All experience' });

      await expect(back).toHaveAttribute('href', `/experience#role-${lead.id}`);
      await back.click();
      await expect(page).toHaveURL((url) => url.hash === `#role-${lead.id}`);
      await expect(main.locator(`li[data-role-row][data-id="${lead.id}"]`)).toBeInViewport();
      await expectLanded(page);
    });
  });
}

test.describe('Experience, a jump to the row the address already names', () => {
  for (const width of [1080, 1024]) {
    test(`goes to the stop every time a plain link to it is followed, at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await indexRows(page);
      await hydrated(page);
      await effectsRun(page);
      const link = (await jumpLinks(page)).first();
      skipUnless((await link.count()) > 0, 'One role only: no stop to jump to.');

      await link.click();
      await expectLanded(page);
      await followAgain(page, link);
    });
  }

  for (const width of [1440, 1080, 1024, 390]) {
    test(`goes to the row every time after arriving through "All experience", at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width < 500 ? 780 : 900 });
      const roles = await listedRoles(page);
      // The second stop: one the plain jump links name (jumpLinks).
      const role = skipUnless(roles[1], 'One role only: no stop to arrive at.');
      const main = await openRole(page, role);
      await hydrated(page);
      await effectsRun(page);
      await main.getByRole('link', { name: 'All experience' }).click();
      await expect(page).toHaveURL((url) => url.hash === `#role-${role.id}`);
      await expectLanded(page);
      await effectsRun(page);
      await jumpLinks(page);
      await followAgain(page, page.locator(`a[data-test-jump][href="#role-${role.id}"]`));
    });
  }
});

test.describe('Experience, Back and Forward', () => {
  for (const width of [1440, 390]) {
    test(`comes back to where the visitor was, not to the row the address names, at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width < 500 ? 780 : 900 });
      const roles = await listedRoles(page);
      const role = skipUnless(roles[1], 'One role only: no stop to arrive at.');
      const main = await openRole(page, role);
      await hydrated(page);

      // Arrive at the role's row from its page, then go on from another row far below it.
      await main.getByRole('link', { name: 'All experience' }).click();
      await expect(page).toHaveURL((url) => url.hash === `#role-${role.id}`);
      await expectLanded(page);
      await hydrated(page);
      await roundTripFrom(page, farRow(page));
    });
  }

  test('comes back to where the visitor was after a jump on the page', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await indexRows(page);
    await hydrated(page);
    const link = (await jumpLinks(page)).first();
    skipUnless((await link.count()) > 0, 'One role only: no stop to jump to.');
    const hash = (await link.getAttribute('href')) ?? '';

    await link.click();
    await expectLanded(page);
    // The row jumped to, then one far below it.
    await roundTripFrom(page, page.locator(`main#main-content [id="${hash.slice(1)}"]`));
    await roundTripFrom(page, farRow(page));
  });

  test('comes back to where the visitor was on a Back between two jumps on the page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await indexRows(page);
    await hydrated(page);
    await effectsRun(page);
    const links = await jumpLinks(page);
    skipUnless((await links.count()) > 1, 'Fewer than three roles: no second jump.');

    await links.first().click();
    await expectLanded(page);
    // The router stamps the jump's entry a moment after the list hands it over. A jump before
    // its effects run, or a second jump before that stamp (within about 100ms), leaves the entry
    // without the router's state, and Next loads the page anew on a Back to it: a known race,
    // not what this test is about.
    await expect
      .poll(() => page.evaluate(() => (window.history.state as { __NA?: boolean } | null)?.__NA))
      .toBe(true);
    // Scrolled up from the row, the visitor jumps to the next one, then goes Back: the browser
    // alone would land on the first row again, not where they left the entry.
    await page.evaluate(() => window.scrollBy(0, -400));
    const left = await scrollOf(page);
    expect(left).toBeGreaterThan(0);
    await links.nth(1).click();
    await expect.poll(() => scrollOf(page)).not.toBe(left);

    await page.goBack();
    await expect
      .poll(async () => Math.abs((await scrollOf(page)) - left))
      .toBeLessThanOrEqual(SCROLL_SLACK);
  });

  test('keeps the scroll a reload restores on a fragment address, and after it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const roles = await listedRoles(page);
    const role = skipUnless(roles[2], 'Too few stops to arrive at one past the first two.');

    // A hard load of the fragment address (from another page) lands on the row.
    await openRole(page, role);
    await page.goto(`${getTargetUrl()}/experience#role-${role.id}`, { waitUntil: 'load' });
    await hydrated(page);
    await expectLanded(page);

    // Scrolled on and reloaded, the page stays where it was, the row still the target.
    await page.evaluate(() => window.scrollBy(0, 700));
    const before = await scrollOf(page);
    await page.reload({ waitUntil: 'load' });
    await hydrated(page);
    await expect
      .poll(async () => Math.abs((await scrollOf(page)) - before))
      .toBeLessThanOrEqual(SCROLL_SLACK);
    expect(await page.evaluate(() => document.querySelector(':target')?.id)).toBe(
      `role-${role.id}`,
    );

    await roundTripFrom(page, farRow(page));
  });

  test('comes back to it too when the jump was made before the page was ready', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1024, height: 900 });
    // Hold the scripts back until the jump is made: the HTML is on screen, and its plain links
    // work, before the page hydrates. (Released requests fall through to the read-only guard.)
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = (url: URL): boolean =>
      url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.js');
    const hold = async (route: Route): Promise<void> => {
      await gate;
      await route.fallback();
    };
    await page.route(held, hold);
    await page.goto(`${getTargetUrl()}/experience`, { waitUntil: 'commit' });
    const main = page.locator('main#main-content');
    const link = (await jumpLinks(page)).first();
    // The empty state, or no other current role: no line to jump from.
    await expect(main.locator('h1')).toBeVisible();
    if ((await link.count()) === 0) release();
    skipUnless((await link.count()) > 0, 'One role only: no stop to jump to.');
    const hash = (await link.getAttribute('href')) ?? '';

    await link.click();
    // Read from the page: the document is still loading (its scripts are held), so no URL
    // matcher that waits on navigation events would settle.
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(hash);
    await expectLanded(page);
    release();
    await hydrated(page);
    await page.unroute(held, hold);

    await roundTripFrom(page, main.locator(`[id="${hash.slice(1)}"]`));

    // Back once more reaches the page's first entry, which the router never stamped. Another
    // role's page, then Back, must show the list again, not leave that page on screen.
    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === '/experience' && url.hash === '');
    await expect(main.getByRole('heading', { level: 1, name: 'Experience' })).toBeVisible();
    const other = main.locator('li[data-role-row]').last();
    await other.locator('[data-role-page]').click();
    await expect(page).toHaveURL((url) => /^\/experience\/[^/]+$/.test(url.pathname));
    await expect(main.locator('[data-role-on-clock]')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === '/experience' && url.hash === '');
    await expect(main.getByRole('heading', { level: 1, name: 'Experience' })).toBeVisible();
    await expect(main.locator('[data-role-on-clock]')).toHaveCount(0);
  });

  test('shows the list on a Back two steps at once from a role page, after a jump made before the page was ready', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = (url: URL): boolean =>
      url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.js');
    const hold = async (route: Route): Promise<void> => {
      await gate;
      await route.fallback();
    };
    await page.route(held, hold);
    await page.goto(`${getTargetUrl()}/experience`, { waitUntil: 'commit' });
    const main = page.locator('main#main-content');
    const link = (await jumpLinks(page)).first();
    await expect(main.locator('h1')).toBeVisible();
    if ((await link.count()) === 0) release();
    skipUnless((await link.count()) > 0, 'One role only: no stop to jump to.');
    const hash = (await link.getAttribute('href')) ?? '';

    await link.click();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(hash);
    release();
    await hydrated(page);
    await page.unroute(held, hold);

    // The jump's row, its role page, then two steps back at once (the long-press Back menu): the
    // page's first entry, which the router never stamped.
    const row = main.locator(`[id="${hash.slice(1)}"]`);
    await row.locator('[data-role-page]').click();
    await expect(page).toHaveURL((url) => /^\/experience\/[^/]+$/.test(url.pathname));
    await expect(main.locator('[data-role-on-clock]')).toBeVisible();

    await page.evaluate(() => window.history.go(-2));
    await expect(page).toHaveURL((url) => url.pathname === '/experience' && url.hash === '');
    await expect(main.getByRole('heading', { level: 1, name: 'Experience' })).toBeVisible();
    await expect(main.locator('[data-role-on-clock]')).toHaveCount(0);
    await expect(main.locator('li[data-role-row]').first()).toBeVisible();
  });
});

test.describe('Experience, the entries the router skips, from another page', () => {
  /**
   * After the Back two steps at once: the list is on screen where the visitor left it, loaded
   * anew exactly once, and it stays loaded (no second load comes).
   */
  async function expectListBack(page: Page, left: number, loads: () => number): Promise<void> {
    const main = page.locator('main#main-content');
    await expect(page).toHaveURL((url) => url.pathname === '/experience' && url.hash === '');
    await expect(main.getByRole('heading', { level: 1, name: 'Experience' })).toBeVisible();
    await expect(main.locator('[data-role-on-clock]')).toHaveCount(0);
    await hydrated(page);
    await expect
      .poll(async () => Math.abs((await scrollOf(page)) - left))
      .toBeLessThanOrEqual(SCROLL_SLACK);
    // Absence can only be watched for: a second load would follow the first within moments.
    await page.waitForTimeout(1000);
    expect(loads()).toBe(1);
  }

  for (const top of [300, 1500]) {
    test(`comes back to where the visitor was, ${top}px down, from a role page`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1080, height: 900 });
      const { left, hash } = await jumpBeforeReady(page, top, hashJump);
      // Every role page here is shorter than the list: it cannot take a scroll of 1500px itself.
      await toRolePage(page, page.locator(`main#main-content [id="${hash.slice(1)}"]`));

      const loads = documentLoads(page);
      await page.evaluate(() => window.history.go(-2));
      await expectListBack(page, left, loads);
    });
  }

  test('shows the list where the visitor was after they left the site from a role page and came Back', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1080, height: 900 });
    const { left, hash } = await jumpBeforeReady(page, 300, hashJump);
    await toRolePage(page, page.locator(`main#main-content [id="${hash.slice(1)}"]`));
    // Another site, then Back: the browser loads the role page anew, in a document the list's
    // code never ran in, which still counts the list's earlier entries as its own.
    await page.goto('about:blank');
    await page.goBack({ waitUntil: 'load' });
    await expect(page.locator('main#main-content [data-role-on-clock]')).toBeVisible();
    await hydrated(page);
    await effectsRun(page);

    const loads = documentLoads(page);
    await page.evaluate(() => window.history.go(-2));
    await expectListBack(page, left, loads);
  });
});
