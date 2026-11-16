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
 * @file Where the edge haze's under-bar animations live (src/styles/edge-haze.css): the top
 * band's layers rise with a pinned FilterBar only on a page that has one. Without a bar the
 * bar's view timeline is inactive, so the rise and the return would move nothing, yet every top
 * layer would list them as running, and home-bento.spec.ts counts every animation on home. So:
 * - home and a project page (no sticky filter bar) list neither;
 * - /places (a sticky bar) lists both on every top layer.
 * The band's position under the bar is measured in edge-haze.spec.ts.
 */

import { expect, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

const MAIN = 'main#main-content';
const STICKY_BAR = 'main [data-filter-part="bar"][data-sticky]';
const TOP_LAYERS = '.edge-haze > .t > i';
const LAPTOP = { width: 1280, height: 800 } as const;

/** Loads a page and waits for it to hydrate (a sticky bar writes its height on <html>). */
async function open(page: Page, path: string): Promise<void> {
  await page.setViewportSize(LAPTOP);
  await page.goto(`${getTargetUrl()}${path}`);
  await expect(page.locator(MAIN)).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(
          (bar) =>
            !document.querySelector(bar) ||
            document.documentElement.style.getPropertyValue('--filter-bar-pinned-h') !== '',
          STICKY_BAR,
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
}

/** The haze's under-bar animations the page lists, by name. */
function underBarAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .map((animation) => (animation as CSSAnimation).animationName ?? '')
      .filter((name) => /^edge-haze-(?:rise|return)$/.test(name)),
  );
}

for (const path of ['/', '/projects/proj-resq-viz'] as const) {
  test(`${path} has no sticky filter bar, so its top layers carry no rise or return`, async ({
    page,
  }) => {
    await open(page, path);
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: 'instant' }),
    );

    expect(await page.locator(STICKY_BAR).count()).toBe(0);
    expect(await underBarAnimations(page)).toEqual([]);
    // The scroll fade stays on every top layer.
    const fades = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => (animation as CSSAnimation).animationName === 'edge-haze-in')
          .length,
    );
    expect(fades).toBe(await page.locator(TOP_LAYERS).count());
  });
}

test('/places has a sticky filter bar, so each top layer carries the rise and the return', async ({
  page,
}) => {
  await open(page, '/places');

  const names = await underBarAnimations(page);
  const layers = await page.locator(TOP_LAYERS).count();
  expect(layers).toBeGreaterThan(0);
  expect(names.filter((name) => name === 'edge-haze-rise')).toHaveLength(layers);
  expect(names.filter((name) => name === 'edge-haze-return')).toHaveLength(layers);
});
