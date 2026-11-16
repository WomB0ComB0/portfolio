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

import { expect, type Locator, type Page } from '@playwright/test';
import { getTargetUrl } from './base';

/** Route QA only reads pages; analytics and all mutations are blocked in the browser. */
export async function readOnly(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const request = route.request();
    if (
      !['GET', 'HEAD'].includes(request.method()) ||
      new URL(request.url()).pathname === '/monitoring'
    ) {
      return route.abort();
    }
    return route.continue();
  });
}

/** Loads a real default route and verifies its one heading inside the persistent shell. */
export async function openConsolePage(page: Page, path: string, title: string): Promise<Locator> {
  const response = await page.goto(`${getTargetUrl()}${path}`, { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  const main = page.locator('main#main-content');
  await expect(main).toHaveCount(1);
  await expect(main.locator('h1')).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  return main;
}

/** Visible includes opacity: an entrance animation must not hide the first server render. */
export async function expectReadable(item: Locator): Promise<void> {
  await expect(item).toBeVisible();
  expect(
    await item.evaluate((element) => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        if (getComputedStyle(node).opacity === '0') return false;
      }
      return true;
    }),
  ).toBe(true);
}

/** A loaded list is visible; an empty or unavailable upstream must show its explicit state. */
export async function expectRowsOrState(rows: Locator, fallback: Locator): Promise<boolean> {
  if (await rows.count()) {
    await expectReadable(rows.first());
    return true;
  }
  await expectReadable(fallback);
  return false;
}

/** These routes await their content; no skeleton or hidden streamed segment may hold it. */
export async function expectSettled(main: Locator): Promise<void> {
  await expect(main.locator('[aria-busy="true"], div[hidden][id^="S:"]')).toHaveCount(0);
}

/** The entire page fits its viewport, including on a phone with a scrolling inner strip. */
export async function expectNoOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    width: window.innerWidth,
    scroll: document.body.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
}

/** Every new-tab link has a safe HTTP destination and the standard opener protections. */
export async function expectExternalLinks(scope: Locator): Promise<void> {
  for (const link of await scope.locator('a[target="_blank"]').all()) {
    expect(await link.getAttribute('href')).toMatch(/^https?:\/\//);
    expect(await link.getAttribute('rel')).toMatch(/\bnoopener\b/);
    expect(await link.getAttribute('rel')).toMatch(/\bnoreferrer\b/);
  }
}
