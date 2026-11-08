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
 * @file /guestbook against the live data, read-only. Nothing here hard-codes a count: each check
 * compares the page with its own header figure.
 * - Without JavaScript every message is a row in the server HTML, as many as the header states,
 *   and every row is shown (no pagination, no load-more, nothing waiting for a script).
 * - No visible text is a literal entity (&#039;, &amp;, &quot;, &lt;, &gt;).
 * - A visitor who does not sign in triggers no Firebase Auth or identity request and gets no
 *   auth iframe, on a phone (390, mobile user agent) or a desktop (1280); pressing Sign in loads
 *   Firebase then, and only then offers the providers.
 * - The page never scrolls sideways at 390 or 1280, has one h1, and its text is the refined type:
 *   nothing visible under 12px, nothing set in capitals.
 * - From a 64rem page the compose card sticks while the list scrolls, half a rem below the top
 *   edge haze (at 1280 x 800 and 1920 x 1080, where the band is 88 and 119 px), never under it.
 *
 * The real guestbook is public production data, so every context here aborts any request that is
 * not GET or HEAD, and every request to a Firebase Auth or identity host (recorded first, so the
 * checks see the attempt). No test signs in or posts.
 */

import {
  type Browser,
  type BrowserContext,
  devices,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

const PATH = '/guestbook';
const MAIN = 'main#main-content';
const ROW = 'li[data-message-row]';
const TOTALS = 'dl[aria-label="Guestbook totals"]';
/** A streamed segment not revealed yet, or a skeleton marked busy (shell-grid.spec.ts). */
const PENDING_CONTENT = 'div[hidden][id^="S:"], main [aria-busy="true"]';
const MIN_TEXT_PX = 12;
/** The hosts Firebase Auth and Google sign-in talk to, and the project's auth domain. */
const AUTH_HOSTS =
  /(^|\.)(identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|apis\.google\.com|accounts\.google\.com|firebaseapp\.com|firestore\.googleapis\.com)$/;
const ENTITY = /&(#0?39|amp|quot|lt|gt);/;

type Viewport = 'phone' | 'desktop';

const CONTEXTS: Record<Viewport, Parameters<Browser['newContext']>[0]> = {
  phone: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
  desktop: { viewport: { width: 1280, height: 800 } },
};

interface Guarded {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Requests to an auth or identity host, aborted. */
  readonly authRequests: string[];
  /** Requests that were not GET or HEAD, aborted. */
  readonly writes: string[];
}

/** A context that can only read: writes and auth hosts are aborted (and recorded). */
async function guardedContext(
  browser: Browser,
  viewport: Viewport,
  javaScriptEnabled = true,
  size?: { readonly width: number; readonly height: number },
): Promise<Guarded> {
  const options = { ...CONTEXTS[viewport], javaScriptEnabled };
  const context = await browser.newContext(size ? { ...options, viewport: size } : options);
  const authRequests: string[] = [];
  const writes: string[] = [];
  await context.route('**/*', (route) => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(`${request.method()} ${url}`);
      return route.abort();
    }
    if (/^https?:/.test(url) && AUTH_HOSTS.test(new URL(url).hostname)) {
      authRequests.push(url);
      return route.abort();
    }
    return route.continue();
  });
  return { context, page: await context.newPage(), authRequests, writes };
}

async function open(page: Page): Promise<Locator> {
  const response = await page.goto(`${getTargetUrl()}${PATH}`);
  expect(response?.status()).toBe(200);
  const main = page.locator(MAIN);
  await expect(main).toBeVisible();
  await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  return main;
}

/** The header's message count, as a number (fails when the list could not load). */
async function statedCount(main: Locator): Promise<number> {
  const item = main
    .locator(`${TOTALS} > div`)
    .filter({ has: main.page().locator('dt', { hasText: /^messages$/ }) });
  const text = ((await item.locator('dd').textContent()) ?? '').replaceAll(',', '').trim();
  expect(text, 'the header states a count (the list loaded)').toMatch(/^\d+$/);
  return Number(text);
}

/** Visible text in main under 12px, or set in capitals (sr-only text is skipped). */
function textOffenders(main: Locator): Promise<string[]> {
  return main.evaluate((root, minimum) => {
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      const element = node.parentElement;
      const shown = element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      if (text === '' || !element || !shown) continue;
      const box = element.getBoundingClientRect();
      if (box.width <= 1 && box.height <= 1) continue;
      const style = getComputedStyle(element);
      if (Number.parseFloat(style.fontSize) < minimum - 0.01) {
        found.push(`${text.slice(0, 40)}: ${style.fontSize}`);
      }
      if (style.textTransform === 'uppercase') found.push(`${text.slice(0, 40)}: uppercase`);
    }
    return found;
  }, MIN_TEXT_PX);
}

test.describe('/guestbook', () => {
  test('without JavaScript, every message is a shown row, as many as the header states', async ({
    browser,
  }) => {
    const { context, page, writes } = await guardedContext(browser, 'desktop', false);
    const main = await open(page);
    const count = await statedCount(main);
    const rows = main.locator(ROW);

    expect(count).toBeGreaterThan(0);
    await expect(rows).toHaveCount(count);
    expect(await rows.evaluateAll((all) => all.filter((row) => row.checkVisibility()).length)).toBe(
      count,
    );
    await expect(main.getByText(/load more/i)).toHaveCount(0);
    expect(writes).toEqual([]);
    await context.close();
  });

  for (const viewport of ['phone', 'desktop'] as const) {
    test(`${viewport}: no Firebase Auth request and no auth iframe on load`, async ({
      browser,
    }) => {
      const { context, page, authRequests, writes } = await guardedContext(browser, viewport);
      await open(page);
      await page.waitForLoadState('networkidle');

      const frames = page.frames().filter((frame) => frame !== page.mainFrame());
      expect(authRequests).toEqual([]);
      expect(frames.map((frame) => frame.url())).toEqual([]);
      expect(writes).toEqual([]);
      await context.close();
    });

    test(`${viewport}: no sideways scroll, one h1, refined type, no literal entities`, async ({
      browser,
    }) => {
      const { context, page } = await guardedContext(browser, viewport);
      const main = await open(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      expect(await page.locator('h1').count()).toBe(1);
      await expect(main.locator('h1')).toHaveText('Guestbook');
      expect(await textOffenders(main)).toEqual([]);
      // All of main's text, screen-reader-only words included: none of it may be an entity.
      expect(await main.textContent()).not.toMatch(ENTITY);
      await context.close();
    });
  }

  for (const size of [
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ] as const) {
    test(`${size.width}x${size.height}: the sticky compose card stays below the top edge haze`, async ({
      browser,
    }) => {
      const { context, page, writes } = await guardedContext(browser, 'desktop', true, size);
      await open(page);
      const range = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      await page.evaluate(
        (top) => window.scrollTo({ top, behavior: 'instant' }),
        Math.min(700, range),
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

      const edges = await page.evaluate(() => {
        const card = document.querySelector('section[aria-labelledby="guestbook-compose"]');
        const slot = card?.parentElement;
        const band = document.querySelector('.edge-haze > .t');
        return {
          sticky: slot ? getComputedStyle(slot).position : null,
          cardTop: card?.getBoundingClientRect().top ?? null,
          bandEnd: band?.getBoundingClientRect().bottom ?? null,
        };
      });
      if (edges.cardTop === null || edges.bandEnd === null) throw new Error('no card or band');
      expect(edges.sticky).toBe('sticky');
      expect(edges.bandEnd).toBeGreaterThan(0);
      // Stuck at its offset (so the check is not passing on a card that never reached the top),
      // which is the band's height plus half a rem.
      expect(Math.abs(edges.cardTop - (edges.bandEnd + 8))).toBeLessThanOrEqual(1.5);
      expect(writes).toEqual([]);
      await context.close();
    });
  }

  test('pressing Sign in loads Firebase then, and offers the providers', async ({ browser }) => {
    const { context, page, writes } = await guardedContext(browser, 'desktop');
    const main = await open(page);
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });

    await main.getByRole('button', { name: 'Sign in' }).click();

    await expect(main.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Continue as guest' })).toBeVisible();
    expect(scripts.length, 'the Firebase chunk loads on the press').toBeGreaterThan(0);
    expect(writes).toEqual([]);
    await context.close();
  });
});
