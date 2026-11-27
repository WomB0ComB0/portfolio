/**
 * Copyright 2025 Mike Odnis
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
 * @file The accessibility regression guard for the 2026-11-20 WCAG 2.2 AA audit, in a real
 * browser at a 1440 x 900 desktop and a 390 x 844 phone. Run it with its own config only:
 * `A11Y_BASE_URL=http://127.0.0.1:<port> bun run test:a11y` against a local production build
 * (playwright.a11y.config.ts starts no server and refuses to run without that variable).
 *
 * - axe 4.10 (WCAG 2.0, 2.1 and 2.2, Levels A and AA) on the audit's 20 routes, /bookshelf and a
 *   project made of several repositories ("How it fits together"; also at 375 x 812 with touch),
 *   expecting no failure. Best-practice violations are reported beside each test (an annotation
 *   and an attachment) and never fail it. The detail pages are found from the listing pages; a
 *   route no listed page has yet is skipped.
 * - Keyboard: the skip link; the command menu as a modal dialog that keeps Tab inside and hands
 *   focus back; the rail tooltip, hoverable and dismissed by Escape; a zoomed place photo panned
 *   with the arrow keys, and Previous keeping focus at the first photo; the /stats age's Pause
 *   and its stillness under reduced motion.
 *
 * Every context reads only: requests other than GET and HEAD, and any for the production site,
 * are aborted (fixtures/a11y.ts).
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  animationsDone,
  type DynamicRoutes,
  dynamicRoutes,
  expectNoAxeFailures,
  guardRequests,
  hydratedAt,
  nextFrame,
  openPage,
  readyForAxe,
} from '../fixtures/a11y';

/** One of the audit's routes: a fixed path, or one found from a listing page. */
interface AuditedRoute {
  readonly label: string;
  readonly path: string | ((routes: DynamicRoutes) => string | null);
  readonly status?: number;
}

const AUDITED_ROUTES: readonly AuditedRoute[] = [
  { label: 'home', path: '/' },
  { label: 'projects', path: '/projects' },
  { label: 'a project with screens', path: (routes) => routes.projectWithScreens },
  { label: 'a project with media and See also', path: (routes) => routes.projectWithSeeAlso },
  { label: 'a project with parts', path: (routes) => routes.projectWithParts },
  { label: 'experience', path: '/experience' },
  { label: 'an experience page', path: (routes) => routes.experience },
  { label: 'places', path: '/places' },
  { label: 'place photos', path: '/places/photos' },
  { label: 'a place page', path: (routes) => routes.place },
  { label: 'stats', path: '/stats' },
  { label: 'media', path: '/media' },
  { label: 'guestbook', path: '/guestbook' },
  { label: 'bookshelf', path: '/bookshelf' },
  { label: 'certifications', path: '/certifications' },
  { label: 'resume', path: '/resume' },
  { label: 'sponsor', path: '/sponsor' },
  { label: 'spotify', path: '/spotify' },
  { label: 'privacy', path: '/privacy' },
  { label: 'cookies', path: '/cookies' },
  { label: 'licenses', path: '/licenses' },
  { label: 'a missing page (404)', path: '/this-page-does-not-exist', status: 404 },
];

/** The route's path: fixed, or found from the listing pages (skipping the test when none is). */
async function pathOf(page: Page, route: AuditedRoute): Promise<string> {
  if (typeof route.path === 'string') return route.path;
  const path = route.path(await dynamicRoutes(page.request));
  test.skip(path === null, `no listed page has what "${route.label}" needs`);
  return path ?? '';
}

/**
 * Zoom in steps 20% from 100% to 300%: ten presses, eleven as floating point adds them up, and a
 * spare (a press at the limit does nothing).
 */
const MAX_ZOOM_PRESSES = 12;

/** A keyboard interaction first, so focus moved by script shows as keyboard focus. */
async function keyboardFocus(page: Page, target: Locator): Promise<void> {
  await page.keyboard.press('Shift');
  await target.focus();
}

test.beforeEach(async ({ context }) => guardRequests(context));

test.describe('axe on the audited routes (WCAG 2.2 A and AA)', () => {
  for (const route of AUDITED_ROUTES) {
    test(`${route.label} has no WCAG A or AA failures`, async ({ page }, testInfo) => {
      const path = await pathOf(page, route);
      await openPage(page, path, route.status);
      await readyForAxe(page);

      await expectNoAxeFailures(page, testInfo, `${path} (${testInfo.project.name})`);
    });
  }
});

test.describe('axe on a project with parts at 375 x 812, touch', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('has no WCAG A or AA failures', async ({ page }, testInfo) => {
    // The phone project runs every route at 390 already; this narrower pass is the desktop's.
    test.skip(testInfo.project.name !== 'desktop', 'runs once, in the desktop project');
    const path = await pathOf(page, {
      label: 'a project with parts',
      path: (routes) => routes.projectWithParts,
    });
    await openPage(page, path);
    await readyForAxe(page);

    await expectNoAxeFailures(page, testInfo, `${path} at 375 (${testInfo.project.name})`);
  });
});

test.describe('keyboard', () => {
  test('the skip link is the first Tab stop and moves focus to main', async ({ page }) => {
    await openPage(page, '/');

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();
  });

  test('the command menu opens with Control+K as a named modal dialog, keeps Tab inside and returns focus', async ({
    page,
  }) => {
    await openPage(page, '/');
    const opener = page.locator('main#main-content a[href]:visible').first();
    await keyboardFocus(page, opener);

    await page.keyboard.press('Control+K');
    const dialog = page.getByRole('dialog', { name: 'Command menu' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const search = dialog.getByRole('combobox', { name: 'Search pages and commands' });
    const results = dialog.getByRole('region', { name: 'Search results' });
    await expect(search).toBeFocused();

    /** Whether focus is inside the dialog (and not on the page behind it, or nowhere). */
    const focusInside = (): Promise<boolean> =>
      dialog.evaluate((element) => element.contains(document.activeElement));

    // Tab cycles between the search box and the results, and never leaves.
    for (const expected of [results, search, results, search]) {
      await page.keyboard.press('Tab');
      await expect(expected).toBeFocused();
      expect(await focusInside()).toBe(true);
    }
    // Shift+Tab as a keyboard sends it: Shift goes down first, then Tab.
    for (const expected of [results, search, results, search]) {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      await expect(expected).toBeFocused();
      expect(await focusInside()).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test.describe('the rail command-menu tooltip', () => {
    test.beforeEach(({ isMobile }) => {
      test.skip(isMobile, 'the rail shows from lg up; the phone has the bottom bar');
    });

    // The name is its tooltip's words: 'Command menu, Ctrl K' (⌘K on a Mac).
    const RAIL_BUTTON = 'button[aria-label^="Command menu, "]';
    const railButton = (page: Page): Locator =>
      page.getByRole('button', { name: /^Command menu, / });
    const tipOf = (button: Locator): Locator => button.locator('[data-palette-tip]');
    const opacityOf = (tip: Locator): Promise<string> =>
      tip.evaluate((element) => getComputedStyle(element).opacity);

    test('can be hovered: the pointer moves from the button onto it and it stays shown', async ({
      page,
    }) => {
      await openPage(page, '/');
      await hydratedAt(page, RAIL_BUTTON);
      const button = railButton(page);
      const tip = tipOf(button);
      const buttonBox = await button.boundingBox();
      if (!buttonBox) throw new Error('the rail button has no box');

      await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
      await expect.poll(() => opacityOf(tip)).toBe('1');

      const tipBox = await tip.boundingBox();
      if (!tipBox) throw new Error('the shown tooltip has no box');
      const onTip = { x: tipBox.x + tipBox.width / 2, y: tipBox.y + tipBox.height / 2 };
      // In small steps, across the gap between the button and the tooltip.
      await page.mouse.move(onTip.x, onTip.y, { steps: 12 });

      // The pointer is on the tooltip, which keeps the button hovered, so nothing fades it.
      expect(
        await page.evaluate(
          ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[data-palette-tip]')),
          onTip,
        ),
      ).toBe(true);
      expect(await button.evaluate((element) => element.matches(':hover'))).toBe(true);
      await animationsDone(page);
      expect(await opacityOf(tip)).toBe('1');

      // Escape hides it where it is, the pointer still on it.
      await page.keyboard.press('Escape');
      await expect.poll(() => opacityOf(tip)).toBe('0');
    });

    test('Escape hides it while the button has keyboard focus, and focus stays', async ({
      page,
    }) => {
      await openPage(page, '/');
      await hydratedAt(page, RAIL_BUTTON);
      const button = railButton(page);
      const tip = tipOf(button);
      // The pointer away from the rail, so only focus shows the tooltip.
      await page.mouse.move((page.viewportSize()?.width ?? 1440) - 1, 1);

      await keyboardFocus(page, button);
      expect(await button.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      await expect.poll(() => opacityOf(tip)).toBe('1');

      await page.keyboard.press('Escape');
      await expect.poll(() => opacityOf(tip)).toBe('0');
      await expect(button).toBeFocused();
    });
  });

  test('a zoomed place photo pans with the arrow keys, and Previous keeps focus at the first photo', async ({
    page,
  }) => {
    const path = await pathOf(page, { label: 'a place page', path: (routes) => routes.place });
    await openPage(page, path);
    await hydratedAt(page, '[data-place-photo-viewer] button[aria-label="Zoom in"]');
    const viewer = page.locator('[data-place-photo-viewer]');
    const position = viewer.getByText(/^Photo \d+ of \d+$/);

    // At the first photo Previous is unavailable, but pressing it leaves focus on it.
    const previous = viewer.getByRole('button', { name: 'Previous photo' });
    await expect(position).toHaveText(/^Photo 1 of /);
    await keyboardFocus(page, previous);
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Enter');
    await expect(previous).toBeFocused();
    await expect(position).toHaveText(/^Photo 1 of /);

    // Zoomed all the way in from the keyboard (so the photo overhangs the stage both ways, a
    // wide one too), the photo is a named surface the arrow keys pan.
    const zoomIn = viewer.getByRole('button', { name: 'Zoom in' });
    await keyboardFocus(page, zoomIn);
    for (let press = 0; press < MAX_ZOOM_PRESSES; press += 1) {
      if ((await zoomIn.getAttribute('aria-disabled')) === 'true') break;
      await page.keyboard.press('Enter');
    }
    await expect(zoomIn).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomIn).toBeFocused();
    const surface = viewer.getByRole('application', { name: /^Zoomed photo/ });
    await expect(surface).toBeVisible();

    /** The photo's pan along `axis`, from the transform motion writes (0 where it writes none). */
    const photo = surface.locator('img');
    const panOf = (axis: 'X' | 'Y'): Promise<number> =>
      photo.evaluate((element, which) => {
        const match = new RegExp(`translate${which}\\((-?[\\d.]+)px\\)`).exec(
          element.style.transform,
        );
        return Number(match?.[1] ?? 0);
      }, axis);

    await surface.focus();
    await expect(surface).toBeFocused();
    // Right shows more of the photo's right side, so the photo moves left; Down moves it up.
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => panOf('X'), { message: 'ArrowRight pans the photo' }).toBeLessThan(0);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => panOf('Y'), { message: 'ArrowDown pans the photo' }).toBeLessThan(0);
    await expect(surface).toBeFocused();
  });

  test.describe('the /stats age', () => {
    const digitsOf = (page: Page): Locator => page.locator('main [data-digits]').first();
    const PAUSE = 'button[aria-label="Pause age counter"]';
    const pauseOf = (page: Page): Locator =>
      page.getByRole('button', { name: 'Pause age counter' });

    /**
     * Opens /stats on a clock the test controls, once the strip has hydrated and run its first
     * effects (the age's first write after mount), then pauses that clock where it is.
     */
    async function openOnHeldClock(page: Page): Promise<void> {
      await page.clock.install();
      await openPage(page, '/stats');
      await hydratedAt(page, PAUSE);
      await nextFrame(page);
      await holdClock(page);
    }

    /** Pauses the page's clock where it is: from here time moves only when the test says so. */
    async function holdClock(page: Page): Promise<void> {
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    }

    test('ticks until Pause is pressed, then holds still', async ({ page }) => {
      await openOnHeldClock(page);
      const digits = digitsOf(page);

      // Running: a second moves the eighth decimal about three steps.
      const before = (await digits.textContent()) ?? '';
      await page.clock.runFor(1_000);
      await expect(digits).not.toHaveText(before);

      const pause = pauseOf(page);
      await pause.press('Enter');
      await expect(pause).toHaveAttribute('aria-pressed', 'true');
      // Whatever the press scheduled has run before the paused digits are read.
      await page.clock.runFor(100);
      const paused = (await digits.textContent()) ?? '';
      await page.clock.runFor(3_000);
      await expect(digits).toHaveText(paused);
    });

    test('holds still under reduced motion, with no Pause to offer', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openOnHeldClock(page);
      const digits = digitsOf(page);

      const shown = (await digits.textContent()) ?? '';
      await page.clock.runFor(3_000);
      await expect(digits).toHaveText(shown);
      await expect(pauseOf(page)).toBeHidden();
    });
  });
});
