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
 * @file What the /certifications browser checks share: the page's selectors, the phone and
 * desktop viewports, the wait for a settled page (no streamed segment hidden, nothing in main
 * aria-busy, as shell-grid.spec.ts does, and the fonts loaded), opening the page at a viewport,
 * and the wait for the filter island's hydration. Used by e2e/journeys/certifications.spec.ts and
 * e2e/journeys/certifications-sticky.spec.ts.
 */

import { expect, type Locator, type Page } from '@playwright/test';

import { getTargetUrl } from './base';

export const PATH = '/certifications';
export const MAIN = 'main#main-content';
export const ROW = 'tr[data-cert-row]';
export const YEAR_HEADING = 'h2[id^="certificates-"]';
export const CURRENT_CHIP = 'a[aria-current="true"]';
/** A streamed segment not revealed yet, or a skeleton marked busy (shell-grid.spec.ts). */
const PENDING_CONTENT = 'div[hidden][id^="S:"], main [aria-busy="true"]';

export type Viewport = { readonly width: number; readonly height: number };

export const PHONE: Viewport = { width: 390, height: 844 };
export const DESKTOP: Viewport = { width: 1280, height: 800 };
/** A wide desktop, where the table's columns are at their widest. */
export const WIDE: Viewport = { width: 1440, height: 900 };

/** Waits for the page to settle and returns main. */
export async function settle(page: Page): Promise<Locator> {
  const main = page.locator(MAIN);
  await expect(main).toBeVisible();
  await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  return main;
}

/** Opens /certifications with `query` ('' or '?issuer=…') at `viewport`, settled. */
export async function openAt(page: Page, query: string, viewport: Viewport): Promise<Locator> {
  await page.setViewportSize(viewport);
  await page.goto(`${getTargetUrl()}${PATH}${query}`);
  return settle(page);
}

/** Hydrated: the island's search field carries React's props. */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const input = document.querySelector('main input[type="search"]');
    return input !== null && Object.keys(input).some((key) => key.startsWith('__reactProps'));
  });
}
