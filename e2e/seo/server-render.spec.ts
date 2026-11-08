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
 * @file Server rendering, checked the way a crawler that runs no JavaScript sees the site:
 * - every page answers 200 with its h1 shown in the server HTML, inside the shell's one
 *   main#main-content, and never the full-screen wolf Loader;
 * - each Sanity page puts a real item in that HTML, not only its header: a link to a detail
 *   page, a certification, or the resume (its PDF frame, or the note that none is published);
 * - an unknown URL answers a real 404 inside the shell (nav plus "Page not found");
 * - an unknown detail id answers a real 404 with noindex.
 * With JavaScript, each Sanity page shows its items on a hard load, an unknown detail id shows
 * "Page not found" inside the shell, and a client navigation keeps the shell mounted with no
 * Loader.
 *
 * A page whose list is empty (a dataset with no documents) skips its content checks.
 *
 * Each check first requests its page once, so the page's loaders are cached (and, under
 * `next dev`, its route is compiled) before the browser loads it.
 *
 * Two limits are by design, so the no-JavaScript checks assert presence, not display:
 * - The list pages (/projects, /experience, /places, /resume) keep a loading.tsx, so a client
 *   navigation shows their skeleton (with the page's own h1) at once. React always flushes that
 *   skeleton first and streams the items into a hidden element that an inline script moves into
 *   place, even when the whole response is ready within milliseconds. Crawlers get every item in
 *   the HTML; a visitor without JavaScript sees the skeleton. /certifications and /guestbook have
 *   no loading.tsx (owner decision), so their rows show without JavaScript
 *   (e2e/journeys/certifications.spec.ts, e2e/journeys/guestbook.spec.ts).
 * - A detail page calls notFound() with no Suspense above it, which is what makes its status a
 *   real 404. Next answers that with an empty error document plus the payload, and the browser
 *   renders "Page not found" inside the shell from it.
 * /stats, /spotify, /media and /sponsor have no loading.tsx: they render their header at once and
 * stream each section behind its own Suspense, so for them the h1 is the check.
 */

import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

/** The shell's one `<main>` (src/components/animations/pages/page-transition.tsx). */
const MAIN = 'main#main-content';

/**
 * The full-screen wolf Loader (src/components/client/loader.tsx), found by its ring's title, and
 * the legacy `.loader` ring styled in globals.css.
 */
const LOADER = '#loader-ring-title, .loader';

/** Tailwind's `lg` breakpoint: the nav rail shows from here up, the bottom bar below it. */
const LG_BREAKPOINT_PX = 1024;

/** How long one try at opening the nav waits for its panel before clicking again. */
const NAV_PANEL_TIMEOUT_MS = 2_000;

/** Pages whose content must be in the server HTML. */
const SERVER_PAGES = [
  '/',
  '/projects',
  '/experience',
  '/certifications',
  '/places',
  '/resume',
  '/media',
  '/spotify',
  '/sponsor',
  '/stats',
  '/privacy',
  '/guestbook',
] as const;

/** What /resume shows when no resume is published: a state of the page, not an error. */
const NO_RESUME_TEXT = 'No resume is published right now';

/** A page with Sanity content and one real item of it that the loaded page shows. */
interface ContentPage {
  readonly path: string;
  /** The page's items, found inside the shell's main. */
  readonly item: (main: Locator) => Locator;
  /** What the page shows when Sanity has no documents; the check is skipped then. */
  readonly emptyText?: string;
}

/** Links to the list's detail pages, e.g. /projects/<id>. */
const detailLinks =
  (path: string) =>
  (main: Locator): Locator =>
    main.locator(`a[href^="${path}/"]`);

const CONTENT_PAGES: readonly ContentPage[] = [
  { path: '/projects', item: detailLinks('/projects'), emptyText: 'No projects yet' },
  {
    path: '/experience',
    item: detailLinks('/experience'),
    emptyText: 'No work experience listed at the moment.',
  },
  { path: '/places', item: detailLinks('/places'), emptyText: 'No places found' },
  {
    path: '/certifications',
    // A certificate's row in the Ledger. A CSS locator, because role queries skip a streamed
    // segment while it is still hidden.
    item: (main) => main.locator('tr[data-cert-row]'),
    emptyText: 'No certificates are listed yet.',
  },
  {
    path: '/guestbook',
    // A message's row: the page loads the guestbook on the server, every message, no pagination.
    item: (main) => main.locator('li[data-message-row]'),
    emptyText: 'No messages yet',
  },
  {
    path: '/resume',
    // The PDF's frame, or the note that none is published: either one is the page's content.
    item: (main) =>
      main
        .locator('iframe[title="Resume PDF"]')
        .or(main.getByText(NO_RESUME_TEXT, { exact: true })),
  },
];

/** Unknown detail ids, well-formed so the loaders really look them up. */
const MISSING_DETAILS = ['/projects/__nope__', '/experience/__nope__', '/places/__nope__'] as const;

/** A URL no route matches: the root not-found renders in full on the server. */
const UNMATCHED_URL = '/no-such-page';

/** Whether the page lists no items, so its content checks have nothing to find. */
async function isEmptyList(page: Page, emptyText: string | undefined): Promise<boolean> {
  return emptyText !== undefined && (await page.getByText(emptyText, { exact: true }).count()) > 0;
}

const urlOf = (path: string): string => `${getTargetUrl()}${path}`;

/**
 * Requests `path` once and reads the whole response. The HTML stream ends only after every loader
 * the page awaits has answered, so those loaders are cached when the browser loads the page next.
 */
async function warmLoaders(request: APIRequestContext, path: string): Promise<void> {
  const response = await request.get(urlOf(path));
  await response.body();
}

/**
 * The first of `locator`'s elements that is displayed. A streamed Suspense boundary that finished
 * after the first flush puts its content in a hidden element, which only JavaScript reveals, so
 * it never counts.
 */
const firstShown = (locator: Locator): Locator => locator.filter({ visible: true }).first();

/** The page's h1 that is displayed. */
const shownHeading = (page: Page): Locator => firstShown(page.locator(`${MAIN} h1`));

/**
 * Asserts that `locator` is displayed and opaque: no entrance animation left it, or an ancestor,
 * at opacity 0 in the server HTML (Playwright counts an opacity-0 element as visible). Server
 * HTML only; a client navigation fades in.
 */
async function expectShown(locator: Locator, what: string): Promise<void> {
  await expect(locator).toBeVisible();
  const isTransparent = await locator.evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (getComputedStyle(node).opacity === '0') return true;
    }
    return false;
  });
  expect(isTransparent, `${what} or an ancestor is at opacity 0 (an entrance animation)`).toBe(
    false,
  );
}

/** Asserts that the page's h1 is displayed and opaque in the server HTML, and returns it. */
async function expectServerHeading(page: Page): Promise<Locator> {
  const heading = shownHeading(page);
  await expectShown(heading, 'the h1');
  return heading;
}

/** The site nav shown at this viewport width: the rail, or the bottom bar on small screens. */
const shownNav = (page: Page): Locator =>
  page.getByRole('navigation', { name: /^(Main|Mobile) navigation$/ }).first();

test.describe('server HTML without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const path of SERVER_PAGES) {
    test(`${path} answers 200 with its h1, in the shell, without the Loader`, async ({
      page,
      request,
    }) => {
      await warmLoaders(request, path);
      const response = await page.goto(urlOf(path));

      expect(response?.status()).toBe(200);
      await expect(page.locator(MAIN)).toHaveCount(1);
      await expect(page.locator(LOADER)).toHaveCount(0);
      await expectServerHeading(page);
    });
  }

  for (const { path, item, emptyText } of CONTENT_PAGES) {
    test(`${path} puts its items in the server HTML`, async ({ page, request }) => {
      await warmLoaders(request, path);
      await page.goto(urlOf(path));
      test.skip(await isEmptyList(page, emptyText), `${path} lists no items here`);

      // Anywhere in the document: a streamed list sits in a hidden element after the shell's main.
      const firstItem = item(page.locator('body')).first();
      await expect(firstItem).toBeAttached();

      // Without JavaScript nothing can change an inline style, so this check can't race an
      // animation: no entrance may leave the item, or an ancestor, serialized at opacity 0.
      const isSerializedTransparent = await firstItem.evaluate((element) => {
        for (let node: Element | null = element; node; node = node.parentElement) {
          if (node instanceof HTMLElement && node.style.opacity === '0') return true;
        }
        return false;
      });
      expect(isSerializedTransparent, `${path}'s first item is serialized at opacity 0`).toBe(
        false,
      );
    });
  }

  test(`${UNMATCHED_URL} answers 404 inside the shell`, async ({ page }) => {
    const response = await page.goto(urlOf(UNMATCHED_URL));

    expect(response?.status()).toBe(404);
    await expect(shownNav(page)).toBeVisible();
    await expect(page.locator(MAIN)).toHaveCount(1);
    await expect(page.locator(LOADER)).toHaveCount(0);
    await expect(await expectServerHeading(page)).toHaveText('Page not found');
  });

  for (const path of MISSING_DETAILS) {
    test(`${path} answers 404 with noindex`, async ({ page }) => {
      const response = await page.goto(urlOf(path));

      expect(response?.status()).toBe(404);
      await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    });
  }
});

test.describe('server-rendered pages with JavaScript', () => {
  for (const { path, item, emptyText } of CONTENT_PAGES) {
    test(`${path} shows its items on a hard load`, async ({ page, request }) => {
      await warmLoaders(request, path);
      await page.goto(urlOf(path));
      test.skip(await isEmptyList(page, emptyText), `${path} lists no items here`);

      // The page fades in only on client navigations, so a hard load must be opaque at once.
      await expectShown(firstShown(item(page.locator(MAIN))), `${path}'s first item`);
    });
  }

  for (const path of MISSING_DETAILS) {
    test(`${path} shows "Page not found" inside the shell`, async ({ page }) => {
      const response = await page.goto(urlOf(path));

      expect(response?.status()).toBe(404);
      await expect(shownNav(page)).toBeVisible();
      await expect(page.locator(MAIN)).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    });
  }
});

/**
 * Opens the nav that holds the Experience link and returns that link. The trigger works only
 * once React has hydrated, so the click is retried until its panel shows, and never repeated
 * while the panel is already open.
 */
async function experienceNavLink(page: Page): Promise<Locator> {
  const isRail = (page.viewportSize()?.width ?? 0) >= LG_BREAKPOINT_PX;
  const trigger = page.getByRole('button', {
    name: isRail ? 'Professional section' : 'Open navigation menu',
  });
  const link = page
    .getByRole('navigation', { name: isRail ? 'Main navigation' : 'Site pages' })
    .getByRole('link', { name: 'Experience', exact: true });

  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
    await expect(link).toBeVisible({ timeout: NAV_PANEL_TIMEOUT_MS });
  }).toPass();
  return link;
}

/** Records, from now on, whether the Loader is ever added to the page, even for a moment. */
async function watchForLoader(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    const flags = window as unknown as { sawLoader?: boolean };
    flags.sawLoader = document.querySelector(selector) !== null;
    const isLoader = (node: Node): boolean =>
      node instanceof Element && (node.matches(selector) || node.querySelector(selector) !== null);
    new MutationObserver((records) => {
      if (records.some((record) => [...record.addedNodes].some(isLoader))) flags.sawLoader = true;
    }).observe(document.documentElement, { childList: true, subtree: true });
  }, LOADER);
}

const sawLoader = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { sawLoader?: boolean }).sawLoader === true);

test.describe('client navigation', () => {
  test('keeps the shell mounted from /projects to /experience, with no Loader', async ({
    page,
  }) => {
    await page.goto(urlOf('/projects'));
    await expect(shownHeading(page)).toHaveText(/projects/i);

    const nav = await shownNav(page).elementHandle();
    expect(nav).not.toBeNull();
    const link = await experienceNavLink(page);
    await watchForLoader(page);

    await link.click();
    await page.waitForURL(/\/experience$/);
    await expect(shownHeading(page)).toHaveText(/experience/i);

    expect(await nav?.evaluate((element) => element.isConnected)).toBe(true);
    expect(await sawLoader(page)).toBe(false);
  });
});
