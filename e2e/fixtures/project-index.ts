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
 * @file What the /projects Index browser checks share: the page's selectors, the phone, desktop
 * and wide viewports, opening the page at a viewport (settled as the Ledger's checks settle:
 * no streamed segment hidden, nothing busy, the fonts loaded), the island's hydration, a header
 * figure, the kind chips and the hover preview's readiness. Used by e2e/journeys/projects-index.spec.ts and
 * e2e/journeys/projects-index-preview.spec.ts.
 */

import { expect, type Locator, type Page } from '@playwright/test';

import { getTargetUrl } from './base';
import { hydrated, settle, type Viewport } from './ledger';

export { hydrated, settle, type Viewport };

export const PATH = '/projects';
export const MAIN = 'main#main-content';
export const ROW = 'tr[data-project-row]';
export const TITLE = 'a[data-project-title]';
export const CARD = '[data-preview-card]';
export const BAR = '[data-filter-part="bar"]';
export const GROUP_HEADING = 'h2[id^="projects-"]';
export const CURRENT_CHIP = 'a[aria-current="true"]';

export const PHONE: Viewport = { width: 390, height: 844 };
/** The shortest lg screen: the top band is at its smallest (77px). */
export const DESKTOP: Viewport = { width: 1024, height: 640 };
export const WIDE: Viewport = { width: 1440, height: 900 };

/** Opens /projects with `query` ('' or '?category=…') at `viewport`, settled. */
export async function openAt(page: Page, query: string, viewport: Viewport): Promise<Locator> {
  await page.setViewportSize(viewport);
  await page.goto(`${getTargetUrl()}${PATH}${query}`);
  return settle(page);
}

/**
 * Hydrated, and the hover preview's lazily loaded half has mounted (a fine pointer only): its card
 * is in the body, so a hover or a keyboard focus from here is seen.
 */
export async function previewReady(page: Page): Promise<void> {
  await hydrated(page);
  await page.locator(CARD).waitFor({ state: 'attached' });
}

/** A header figure by its label ('projects'), as a number. */
export async function figure(main: Locator, label: string): Promise<number> {
  const item = main
    .locator('dl[aria-label="Totals"] > div')
    .filter({ has: main.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) });
  return Number(((await item.locator('dd').textContent()) ?? '').replaceAll(',', ''));
}

export const kindChips = (root: Locator): Locator =>
  root.getByRole('list', { name: 'Filter by kind' });

export interface Chip {
  readonly label: string;
  readonly count: number;
}

/** A chip's label and count, from its text ("Web Development 5 projects"). */
export function readChip(text: string | null): Chip {
  const match = /^(.*?) (\d+) projects?$/.exec((text ?? '').replace(/\s+/g, ' ').trim());
  if (!match) throw new Error(`unreadable chip: ${text}`);
  return { label: match[1] ?? '', count: Number(match[2]) };
}

/** The first kind chip after All (the most used kind), with its ?category slug. */
export async function firstKindChip(
  main: Locator,
): Promise<Chip & { link: Locator; slug: string }> {
  const link = kindChips(main).getByRole('link').nth(1);
  const chip = readChip(await link.textContent());
  const href = (await link.getAttribute('href')) ?? '';
  const slug = new URL(href, getTargetUrl()).searchParams.get('category') ?? '';
  expect(slug, 'the chip links to ?category=<slug>').not.toBe('');
  return { ...chip, link, slug };
}

/** The value a CSS custom property resolves to as a background colour. */
export function tokenColour(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  }, token);
}
