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

/** Site-wide navigation, no-JavaScript page links, JSON-LD and 404 robots, extracted from the approved route lab. Media CollectionPage and route-specific content checks remain in their owning route changes. */
import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test';
import { getTargetUrl } from '../fixtures/base';
import { readOnly } from '../fixtures/console-routes';

test.beforeEach(async ({ page }) => readOnly(page));

/** The shell's one `<main>` (src/components/animations/pages/page-transition.tsx). */
const MAIN = 'main#main-content';
/** The desktop rail replaces the bottom bar at Tailwind's lg breakpoint. */
const LG_BREAKPOINT_PX = 1024;

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

/**
 * Every destination the navigation offers (NavbarItems in src/constants/client.ts): Home on the
 * rail, the rest in its four flyouts.
 */
const NAV_DESTINATIONS = [
  '/',
  '/projects',
  '/experience',
  '/certifications',
  '/resume',
  '/media',
  '/stats',
  '/sponsor',
  '/places',
  '/spotify',
  '/guestbook',
  '/cookies',
  '/privacy',
  '/licenses',
] as const;

/** The rail's flyout panels, one per nav group (navFlyoutId in src/components/layout/nav.tsx). */
const NAV_FLYOUT = '[id^="nav-flyout-"]:not([id$="-label"])';

/**
 * The name of the list of every nav page that a visitor without JavaScript gets, in the shell's
 * footer zone (NOSCRIPT_NAV_TITLE in src/components/layout/noscript-nav.tsx).
 */
const PAGE_LIST_NAME = 'All pages';

/** JSON-LD types the site must not claim: it is one person's, and /media's rows live elsewhere. */
const UNWANTED_JSON_LD_TYPES = ['Organization', 'VideoObject', 'BlogPosting', 'ItemList'];

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
test.describe('404 indexing', () => {
  // Next writes noindex on every 404 itself; the 404 metadata asking again gave each a second tag.
  for (const path of [...MISSING_DETAILS, UNMATCHED_URL]) {
    test(`${path} carries one robots tag, noindex`, async ({ request }) => {
      const response = await request.get(urlOf(path));
      const tags = [
        ...markupOf(await response.text()).matchAll(/<meta name="robots" content="([^"]*)"/g),
      ].map(([, content = '']) => content);

      expect(response.status()).toBe(404);
      expect(tags).toEqual(['noindex']);
    });
  }
});

/**
 * A response's HTML without its script elements, whose payload repeats the page as text, and
 * without its noscript blocks: the page list in one (src/components/layout/noscript-nav.tsx) is
 * for a visitor without JavaScript, and a crawler that renders the page never sees it. Left in,
 * its links would pass the rail's check below on the rail's behalf.
 */
const markupOf = (html: string): string =>
  html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<noscript\b[\s\S]*?<\/noscript>/g, '');

/** The href of every `<a>` in an HTML string. */
const anchorHrefs = (html: string): string[] =>
  [...markupOf(html).matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map(([, href = '']) => href);

/** A JSON-LD node: its type and id, and whatever else it says. */
interface JsonLdNode {
  readonly '@type'?: string;
  readonly '@id'?: string;
  readonly [key: string]: unknown;
}

/** Every JSON-LD node in an HTML string's native script elements, `@graph`s flattened. */
const jsonLdNodes = (html: string): JsonLdNode[] =>
  [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, json = '']) => JSON.parse(json) as JsonLdNode & { '@graph'?: JsonLdNode[] })
    .flatMap((block) => block['@graph'] ?? [block]);

const nodeOfType = (nodes: readonly JsonLdNode[], type: string): JsonLdNode | undefined =>
  nodes.find((node) => node['@type'] === type);

test.describe('raw server HTML, as a crawler reads it', () => {
  for (const path of [...SERVER_PAGES, '/cookies', '/licenses', UNMATCHED_URL]) {
    test(`${path} links every nav destination with a plain <a href>`, async ({ request }) => {
      const response = await request.get(urlOf(path));
      const hrefs = anchorHrefs(await response.text());

      for (const destination of NAV_DESTINATIONS) {
        expect(hrefs, `${path} has no <a href="${destination}">`).toContain(destination);
      }
    });
  }

  // The rail marks a detail page's section for sight (the trigger's fill); assistive tech hears
  // it from aria-current="true", on the trigger and on the section's own flyout link.
  test("a detail page's server HTML marks its section in the rail for assistive tech", async ({
    request,
  }) => {
    const list = anchorHrefs(await (await request.get(urlOf('/projects'))).text());
    const detail = list.find((href) => /^\/projects\/[^/?#]+$/.test(href));
    test.skip(!detail, 'no project is listed to open');
    const html = markupOf(await (await request.get(urlOf(detail ?? ''))).text());
    const rail = /<nav\b[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1];
    const tag = (pattern: RegExp): string => pattern.exec(rail ?? '')?.[0] ?? '';

    expect(rail).toBeDefined();
    expect(tag(/<button\b[^>]*aria-label="Professional section"[^>]*>/)).toContain(
      'aria-current="true"',
    );
    expect(tag(/<a\b[^>]*href="\/projects"[^>]*>/)).toContain('aria-current="true"');
    expect(rail).not.toMatch(/aria-current="page"/);
  });

  for (const path of SERVER_PAGES) {
    test(`${path} carries the site's Person and WebSite JSON-LD`, async ({ request }) => {
      const response = await request.get(urlOf(path));
      const nodes = jsonLdNodes(await response.text());
      const person = nodeOfType(nodes, 'Person');
      const website = nodeOfType(nodes, 'WebSite');

      expect(person?.['@id']).toMatch(/\/#person$/);
      expect(website?.['@id']).toMatch(/\/#website$/);
      expect(website?.publisher).toEqual({ '@id': person?.['@id'] });
      expect(person?.name).toBe(website?.name);
      const sameAs = person?.sameAs;
      expect(Array.isArray(sameAs) && sameAs.length > 0).toBe(true);
      for (const url of sameAs as string[]) expect(url).toMatch(/^https:\/\//);
      for (const type of UNWANTED_JSON_LD_TYPES) expect(nodeOfType(nodes, type)).toBeUndefined();
    });
  }

  test('robots.txt closes list searches and leaves optimised images open', async ({ request }) => {
    const robots = await (await request.get(urlOf('/robots.txt'))).text();
    const disallowed = [...robots.matchAll(/^Disallow: (.*)$/gm)].map(([, rule = '']) => rule);

    // With and without a trailing slash: /media/?q=x answers 200 with the same page, no redirect.
    expect(disallowed).toEqual(
      expect.arrayContaining(['/media?q=', '/media?*&q=', '/media/?q=', '/media/?*&q=']),
    );
    // No rule may reach /_next/image?url=...&q=75: none starts with a wildcard or under /_next.
    expect(disallowed.filter((rule) => /^\/?\*|^\/_next/.test(rule))).toEqual([]);
  });
});

test.describe('the closed nav flyouts without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('keep their links in the document, out of sight and out of the tab order', async ({
    page,
  }) => {
    await page.goto(urlOf('/licenses'));
    const flyoutLinks = page.locator(`${NAV_FLYOUT} a[href]`);

    // Every destination but Home, which is the rail's own link.
    await expect(flyoutLinks).toHaveCount(NAV_DESTINATIONS.length - 1);
    await expect(flyoutLinks.filter({ visible: true })).toHaveCount(0);
    await expect(page.locator(`${NAV_FLYOUT}:not([inert])`)).toHaveCount(0);

    // Role queries read the accessibility tree: the rail offers Home and nothing a flyout holds.
    const isRail = (page.viewportSize()?.width ?? 0) >= LG_BREAKPOINT_PX;
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link'),
    ).toHaveCount(isRail ? 1 : 0);

    // Tab past the skip link, the rail and into the page: no stop is inside a flyout.
    for (let stop = 0; stop < NAV_DESTINATIONS.length + 8; stop++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(
        (selector) => document.activeElement?.closest(selector)?.id ?? null,
        NAV_FLYOUT,
      );
      expect(where, `Tab stop ${stop + 1} is inside a closed flyout`).toBeNull();
    }
  });
});

/** Where the page list is checked: a phone, a tablet and a desktop width, and the 404 page. */
const PAGE_LIST_CASES = [
  { path: '/', width: 390, height: 844 },
  { path: '/projects', width: 768, height: 1024 },
  { path: '/media', width: 1440, height: 900 },
  { path: UNMATCHED_URL, width: 1280, height: 720 },
] as const;

/** The list of every nav page, by its landmark name. */
const pageList = (page: Page): Locator => page.getByRole('navigation', { name: PAGE_LIST_NAME });

/**
 * Without JavaScript the rail's groups and the phone Menu cannot open, so the shell adds one
 * list of every nav page in a `<noscript>`, between main and the footer. It is the only way to
 * the section pages then, so every link must be shown and must work.
 */
test.describe('the page list without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const { path, width, height } of PAGE_LIST_CASES) {
    test(`${path} at ${width}px shows every nav destination as a link, under the page`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto(urlOf(path));
      const list = pageList(page);
      const links = list.getByRole('link');

      await expect(list).toHaveCount(1);
      await expect(links).toHaveCount(NAV_DESTINATIONS.length);
      const hrefs = await links.evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getAttribute('href') ?? ''),
      );
      expect([...hrefs].sort()).toEqual([...NAV_DESTINATIONS].sort());
      for (const link of await links.all()) {
        await link.scrollIntoViewIfNeeded();
        await expectShown(link, `the ${await link.textContent()} link`);
      }

      // In the footer zone: after main and outside it, before the footer, never above the h1,
      // and no wider than the window.
      const placement = await list.evaluate((nav, mainSelector) => {
        const main = document.querySelector(mainSelector);
        const footer = document.querySelector('footer');
        const heading = main?.querySelector('h1');
        const isBefore = (first: Element | null | undefined, second: Element | null): boolean =>
          Boolean(
            first &&
              second &&
              first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
          );
        const top = nav.getBoundingClientRect().top;
        return {
          afterMain: isBefore(main, nav) && main?.contains(nav) === false,
          beforeFooter: isBefore(nav, footer),
          underHeading: heading ? top >= heading.getBoundingClientRect().bottom : false,
          underMain: main ? top >= main.getBoundingClientRect().bottom - 1 : false,
          fitsWindow: document.documentElement.scrollWidth <= window.innerWidth,
        };
      }, MAIN);
      expect(placement).toEqual({
        afterMain: true,
        beforeFooter: true,
        underHeading: true,
        underMain: true,
        fitsWindow: true,
      });
    });
  }

  // "All pages" sat in the first column over a lone Home and read as a sixth group.
  test('titles the list on a row above its groups, with Home level with their first links', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('/licenses'));
    const layout = await pageList(page).evaluate((nav) => {
      const top = (selector: string): number =>
        nav.querySelector(selector)?.getBoundingClientRect().top ?? Number.NaN;
      const title = nav.querySelector('h2')?.getBoundingClientRect();
      const groups = nav.querySelector('ul')?.getBoundingClientRect();
      return {
        titleAboveGroups: Boolean(title && groups && title.bottom <= groups.top),
        titleInGroups: Boolean(nav.querySelector('ul h2')),
        homeOffset: Math.abs(top('a[href="/"]') - top('a[href="/projects"]')),
      };
    });

    expect(layout).toEqual({ titleAboveGroups: true, titleInGroups: false, homeOffset: 0 });
  });

  test("marks a detail page's section, not a page, in the list", async ({ page, request }) => {
    const list = anchorHrefs(await (await request.get(urlOf('/projects'))).text());
    const detail = list.find((href) => /^\/projects\/[^/?#]+$/.test(href));
    test.skip(!detail, 'no project is listed to open');
    await page.goto(urlOf(detail ?? ''));

    await expect(pageList(page).locator('a[aria-current="true"]')).toHaveText('Projects');
    await expect(pageList(page).locator('a[aria-current="page"]')).toHaveCount(0);
  });

  test('a link in the list can be followed, and the page it lands on is the one marked', async ({
    page,
    request,
  }) => {
    await warmLoaders(request, '/privacy');
    await page.goto(urlOf('/licenses'));
    await expect(pageList(page).locator('a[aria-current="page"]')).toHaveText('Licenses');

    await pageList(page).getByRole('link', { name: 'Privacy', exact: true }).click();
    await page.waitForURL(/\/privacy$/);

    await expect(await expectServerHeading(page)).toHaveText(/privacy/i);
    await expect(pageList(page).locator('a[aria-current="page"]')).toHaveText('Privacy');
  });
});

test.describe('the page list with JavaScript', () => {
  test('is not rendered: no landmark, no link, no box in the page', async ({ page }) => {
    await page.goto(urlOf('/projects'));
    await expect(shownHeading(page)).toBeVisible();

    await expect(pageList(page)).toHaveCount(0);
    await expect(page.locator('noscript a, noscript nav')).toHaveCount(0);
    const boxes = await page.locator('noscript').evaluateAll((nodes) =>
      nodes.map((node) => {
        const { width, height } = node.getBoundingClientRect();
        return width + height + node.childElementCount;
      }),
    );
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.filter((size) => size !== 0)).toEqual([]);
  });
});
