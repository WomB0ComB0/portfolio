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
 * @file Server rendering as a visitor without JavaScript sees the final portfolio:
 * - Folio Projects (Stories, Index and Screens), Certifications, Experience Story and Guestbook
 *   Wall must render readable content inside the shell, not in hidden streamed segments;
 * - Media, Spotify, Sponsor and Stats must render their actual sections, figures or honest
 *   source-specific empty/error states, not just a page heading;
 * - every page answers 200 with its visible h1, one main and no full-screen wolf Loader;
 * - unknown URLs and detail IDs preserve real 404/noindex behavior;
 * - hard loads with JavaScript retain the same content, and client navigation keeps the shell.
 *
 * Empty lists assert their real empty label instead of skipping. Resume actions and the direct
 * PDF link must be visible without JavaScript too. Detail notFound() still sends an empty error
 * document without JavaScript so that its status remains 404; the JS case checks its shell UI.
 * All browser traffic is GET/HEAD only and service workers are blocked. A GET warm-up fills
 * bounded loader caches before each content check; it never signs in or posts a note.
 */

import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { readOnly } from '../fixtures/console-routes';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => readOnly(page));

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
  '/projects?view=index',
  '/projects?view=screens',
  '/experience',
  '/certifications',
  '/places',
  '/places/photos',
  '/resume',
  '/media',
  '/spotify',
  '/sponsor',
  '/stats',
  '/privacy',
  '/guestbook',
  '/bookshelf',
] as const;

/** What /resume shows when no resume is published: a state of the page, not an error. */
const NO_RESUME_TEXT = 'No resume is published right now';

/** A content view and the real rows or section it must render. */
interface ContentPage {
  readonly path: string;
  readonly item: (main: Locator) => Locator;
  /** The server's grid, where JavaScript may replace it with a virtual photo wall. */
  readonly serverItem?: (main: Locator) => Locator;
  readonly emptyText?: string | RegExp;
  readonly details?: (page: Page, main: Locator) => Promise<void>;
}

const detailLinks =
  (path: string) =>
  (main: Locator): Locator =>
    main.locator(`a[href^="${path}/"]`);

const projectGrid = (main: Locator): Locator =>
  detailLinks('/projects')(main.getByRole('list', { name: 'Images', exact: true }));
const placeGrid = (main: Locator): Locator =>
  detailLinks('/places')(main.getByRole('list', { name: 'Photos', exact: true }));

/** Selectors are shared with the route journeys: Folio entries, Story stops and Wall notes. */
const CONTENT_PAGES: readonly ContentPage[] = [
  {
    path: '/projects',
    item: (main) => main.locator('a[data-story-link]'),
    emptyText: 'No projects yet.',
  },
  {
    path: '/projects?view=index',
    item: (main) => main.locator('[data-project-entry] a[data-story-link]'),
    emptyText: 'No projects yet.',
  },
  {
    path: '/projects?view=screens',
    item: (main) =>
      projectGrid(main).or(main.locator('[aria-roledescription="image wall"] [data-cell]')),
    serverItem: projectGrid,
    emptyText: /^(No projects yet\.|No images match)$/,
  },
  {
    path: '/experience',
    item: (main) => main.locator('[data-role-row] a[data-role-page]'),
    emptyText: 'No roles listed yet',
  },
  {
    path: '/places',
    item: (main) => main.locator('li[data-place-card] a[href^="/places/"]'),
    emptyText: 'No places found',
  },
  {
    path: '/places/photos',
    item: (main) =>
      placeGrid(main).or(main.locator('[aria-roledescription="photo wall"] [data-cell]')),
    serverItem: placeGrid,
    emptyText: 'No photos yet',
  },
  {
    path: '/certifications',
    item: (main) => main.locator('[data-cert-item]'),
    emptyText: 'No certificates are listed yet.',
  },
  {
    path: '/guestbook',
    item: (main) => main.locator('li[data-message-row]'),
    emptyText: /^(No messages yet|Messages couldn't load)$/,
  },
  {
    path: '/resume',
    item: (main) =>
      main
        .locator('a[data-resume-direct-link]')
        .or(main.getByText(NO_RESUME_TEXT, { exact: true })),
  },
  {
    path: '/media',
    item: (main) => main.locator('[data-feed-row]'),
    emptyText: 'Nothing published yet',
    details: expectMediaContent,
  },
  {
    path: '/spotify',
    item: (main) => main.locator('[data-spotify-track]'),
    emptyText: /^(No top tracks yet|Couldn't load top tracks)$/,
    details: expectSpotifyContent,
  },
  {
    path: '/sponsor',
    item: (main) => main.locator('[data-sponsor-ways] li'),
    details: expectSponsorContent,
  },
  {
    path: '/stats',
    item: (main) => main.locator('[data-stats-tile]'),
    details: expectStatsContent,
  },
];

/** Unknown detail ids, well-formed so the loaders really look them up. */
const MISSING_DETAILS = ['/projects/__nope__', '/experience/__nope__', '/places/__nope__'] as const;

/** A URL no route matches: the root not-found renders in full on the server. */
const UNMATCHED_URL = '/no-such-page';

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

/** Every view must expose its real content inside main, visibly and opaquely. */
async function expectContent(
  page: Page,
  content: ContentPage,
  withoutScript: boolean,
): Promise<void> {
  const main = page.locator(MAIN);
  await expect(main).toHaveCount(1);
  await expectServerHeading(page);
  const items = (withoutScript ? (content.serverItem ?? content.item) : content.item)(main);
  // Hydration can replace the grid before the lazy wall has mounted its cells. Wait for real
  // content or an explicit source state before deciding which branch the page is showing.
  const empty = content.emptyText ? main.getByText(content.emptyText, { exact: true }) : undefined;
  await expect(firstShown(empty ? items.or(empty) : items)).toBeVisible();
  if (await items.count()) {
    await expectShown(firstShown(items), `${content.path}'s first content item`);
    if (withoutScript) {
      const hidden = await items.evaluateAll(
        (elements) =>
          elements.filter((element) => {
            if (!element.checkVisibility()) return true;
            for (let node: Element | null = element; node; node = node.parentElement) {
              if (getComputedStyle(node).opacity === '0') return true;
            }
            return false;
          }).length,
      );
      expect(hidden, `${content.path} has hidden server-rendered content`).toBe(0);
    }
  } else {
    expect(
      content.emptyText,
      `${content.path} must render its data, not only its header`,
    ).toBeDefined();
    await expectShown(
      main.getByText(content.emptyText as string | RegExp, { exact: true }),
      `${content.path}'s source state`,
    );
  }
  await content.details?.(page, main);
}

/** Media's rows are actual titled pieces; an empty feed must state that it has nothing published. */
async function expectMediaContent(_page: Page, main: Locator): Promise<void> {
  const rows = main.locator('[data-feed-row]');
  await expect(main.getByRole('tablist')).toHaveCount(0);
  if (await rows.count()) {
    const title = rows.first().locator('[data-feed-title]');
    await expectShown(title, 'the first media title');
    await expect(title).not.toBeEmpty();
    await expect(title).toHaveAttribute('href', /\S/);
  }
}

/** Spotify must expose both ranked lists and a readable first now-playing state. */
async function expectSpotifyContent(_page: Page, main: Locator): Promise<void> {
  const hero = main.locator('[data-spotify-hero]');
  await expectShown(hero, 'the Spotify hero');
  await expect(hero).toHaveAttribute(
    'data-state',
    /^(playing|playing-unknown|recent|nothing|unreachable)$/,
  );
  const tracks = main.locator('[data-spotify-track]');
  if (await tracks.count()) {
    const ranks = await tracks.locator('[data-rank]').allTextContents();
    expect(ranks.length).toBeLessThanOrEqual(20);
    expect(ranks.map((rank) => Number(rank.trim()))).toEqual(ranks.map((_, index) => index + 1));
    await expectShown(main.getByRole('table', { name: /Top tracks/ }), 'the ranked tracks');
  }
  const artists = main.locator('[data-spotify-artist]');
  if (await artists.count()) {
    expect(await artists.count()).toBeLessThanOrEqual(10);
    await expectShown(artists.first(), 'the first top artist');
  } else {
    await expectShown(
      main.getByRole('heading', { name: /^(No top artists yet|Couldn't load top artists)$/ }),
      'the artist source state',
    );
  }
}

/** Four real sponsor destinations and the thank-you section must render without a client fetch. */
async function expectSponsorContent(_page: Page, main: Locator): Promise<void> {
  await expect(main.locator('a').first()).toContainText('Sponsor on GitHub');
  const ways = main.locator('[data-sponsor-ways]');
  await expect(ways.locator('li')).toHaveCount(4);
  await expect(ways.getByRole('heading', { level: 3 })).toHaveText([
    /GitHub Sponsors/,
    /Open Collective/,
    /Ko-fi/,
    /Buy Me a Coffee/,
  ]);
  const thanks = main.locator('[data-sponsor-thanks-section]');
  await expectShown(
    thanks.getByRole('heading', { name: 'Thank you', exact: true }),
    'the sponsor thanks heading',
  );
  await expectShown(
    thanks
      .locator('[data-sponsor-thanks]')
      .or(thanks.getByRole('heading', { name: /^(No sponsors yet|Couldn't load sponsors)$/ })),
    'the sponsor data or source state',
  );
}

/** All five Stats sources must contain real figures or their named unavailable/empty states. */
async function expectStatsContent(_page: Page, main: Locator): Promise<void> {
  const names = ['github', 'discord', 'leetcode', 'typing', 'coding'];
  await expect(main.locator('[data-stats-tile]')).toHaveCount(names.length);
  for (const name of names) {
    const tile = main.locator(`[data-stats-tile="${name}"]`);
    await expectShown(tile, `the ${name} source`);
    await expect(tile.locator('h2')).toHaveCount(1);
    await expect(tile).toHaveAttribute('data-state', /^(ready|stale|partial|error|idle|empty)$/);
    const state = await tile.getAttribute('data-state');
    if (name === 'discord') {
      await expect(tile).toContainText(
        /Online|Idle|Do not disturb|Offline|Discord status unavailable|Discord didn.t answer in time/,
      );
    } else if (['ready', 'stale', 'partial'].includes(state ?? '')) {
      await expect(tile).toContainText(/\d/);
    } else {
      await expect(tile).toContainText(
        /unavailable|No solved problems yet|No 60 s test yet|No coding time yet/,
      );
    }
  }
  const repos = main.locator('[data-stats-repo]');
  if (await repos.count()) {
    expect(await repos.count()).toBeLessThanOrEqual(6);
    await expectShown(repos.first(), 'the first repository');
  } else {
    await expectShown(
      main.getByRole('heading', { name: /^(Repositories unavailable|No repositories yet)$/ }),
      'the repository source state',
    );
  }
  await expect(main.locator('[data-gauge]')).toHaveCount(0);
}

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

  for (const content of CONTENT_PAGES) {
    test(`${content.path} renders readable server content`, async ({ page, request }) => {
      await warmLoaders(request, content.path);
      const response = await page.goto(urlOf(content.path));
      expect(response?.status()).toBe(200);
      await expectContent(page, content, true);
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
  for (const content of CONTENT_PAGES) {
    test(`${content.path} shows its content on a hard load`, async ({ page, request }) => {
      await warmLoaders(request, content.path);
      const response = await page.goto(urlOf(content.path));
      expect(response?.status()).toBe(200);
      await expectContent(page, content, false);
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
