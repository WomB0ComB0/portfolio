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
 * @file What the /places browser checks share: the page's selectors, the phone, desktop and wide
 * viewports, opening the page at a viewport (settled as the Ledger's checks settle: no streamed
 * segment hidden, nothing busy, the fonts loaded), the island's hydration, the header's figure,
 * the category chips with their counts, each card's searchable text, and the map's markers
 * (clusters' "N places" plus single markers). Used by e2e/journeys/places-filters.spec.ts.
 */

import { expect, type Locator, type Page } from '@playwright/test';

import { getTargetUrl } from './base';
import { hydrated, settle, type Viewport } from './ledger';

export { hydrated, settle, type Viewport };

export const PATH = '/places';
export const MAIN = 'main#main-content';
export const BAR = '[data-filter-part="bar"]';
export const CARD = 'li[data-place-card]';
export const MAP = '[data-places-part="map"]';
export const CURRENT_CHIP = 'a[aria-current="true"]';
/** A streamed segment React has not revealed yet. */
export const STREAMED = 'div[hidden][id^="S:"]';
/** The category chips' list, found by CSS so it is read in the closed phone sheet too. */
export const CHIPS = 'ul[aria-label="Filter by category"]';

export const PHONE: Viewport = { width: 390, height: 844 };
/** The shortest lg screen: the top band is at its smallest (77px). */
export const DESKTOP: Viewport = { width: 1024, height: 640 };
export const WIDE: Viewport = { width: 1440, height: 900 };
/** A landscape phone: under 550px tall, where the bar stays in the page instead of sticking. */
export const LANDSCAPE: Viewport = { width: 844, height: 390 };

export interface ChipFit {
  /** The focused chip's ?category slug, or 'all'. */
  readonly slug: string;
  /** Its focus ring's left and right edges (the outline past its box). */
  readonly ringLeft: number;
  readonly ringRight: number;
  /** The row's clip: its padding box, less the fade over each end that still has chips past it. */
  readonly rowLeft: number;
  readonly rowRight: number;
}

/**
 * Where the focused chip's ring sits against what its row shows: the padding box (the scroller
 * clips there), less the 1.5rem fade over each end that has chips past it (data-overflow).
 */
export function focusedChipFit(page: Page): Promise<ChipFit> {
  return page.evaluate(() => {
    const chip = document.activeElement as HTMLElement;
    const row = chip.closest('ul') as HTMLElement;
    const box = row.getBoundingClientRect();
    const rect = chip.getBoundingClientRect();
    const style = getComputedStyle(chip);
    const ring =
      (Number.parseFloat(style.outlineWidth) || 0) + (Number.parseFloat(style.outlineOffset) || 0);
    const fade = 1.5 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const overflow = row.dataset.overflow ?? '';
    const left = box.left + row.clientLeft;
    return {
      slug: chip.getAttribute('data-chip') ?? '',
      ringLeft: rect.left - ring,
      ringRight: rect.right + ring,
      rowLeft: left + (overflow === 'start' || overflow === 'both' ? fade : 0),
      rowRight: left + row.clientWidth - (overflow === 'end' || overflow === 'both' ? fade : 0),
    };
  });
}

/** Opens /places with `query` ('' or '?category=…') at `viewport`, settled. */
export async function openAt(page: Page, query: string, viewport: Viewport): Promise<Locator> {
  await page.setViewportSize(viewport);
  await page.goto(`${getTargetUrl()}${PATH}${query}`);
  return settle(page);
}

/** The header's "N locations visited", as N. */
export async function headerFigure(main: Locator): Promise<number> {
  const text = (await main.locator('.page-header-description').textContent()) ?? '';
  const match = /^(\d+) locations? visited$/.exec(text.trim());
  if (!match) throw new Error(`unreadable header figure: ${text}`);
  return Number(match[1]);
}

export interface Chip {
  readonly label: string;
  readonly count: number;
  /** The chip's ?category slug, or 'all'. */
  readonly slug: string;
}

/** A chip's label and count from its text ("Tech Office 6 places"). */
export function readChip(text: string | null): Omit<Chip, 'slug'> {
  const match = /^(.*?) (\d+) places?$/.exec((text ?? '').replace(/\s+/g, ' ').trim());
  if (!match) throw new Error(`unreadable chip: ${text}`);
  return { label: match[1] ?? '', count: Number(match[2]) };
}

/** Every chip in order, All first. */
export async function chipCounts(root: Locator): Promise<Chip[]> {
  const raw = await root
    .locator(`${CHIPS} a[data-filter-part="chip"]`)
    .evaluateAll((links) =>
      links.map((link) => ({ text: link.textContent, slug: link.getAttribute('data-chip') ?? '' })),
    );
  return raw.map(({ text, slug }) => ({ ...readChip(text), slug }));
}

/** The chip that is current now. */
export async function currentChip(root: Locator): Promise<Omit<Chip, 'slug'>> {
  return readChip(await root.locator(`${CHIPS} ${CURRENT_CHIP}`).textContent());
}

/** A chip that narrows the list: some places, not all. */
export async function narrowingChip(main: Locator): Promise<Chip> {
  const chips = await chipCounts(main);
  const total = chips[0]?.count ?? 0;
  const chip = chips.find(({ slug, count }) => slug !== 'all' && count > 0 && count < total);
  if (!chip) throw new Error('no chip narrows the list');
  return chip;
}

export interface CardText {
  readonly id: string;
  /** The name and the description, as ?q searches them. */
  readonly haystack: string;
}

/**
 * Each card's id (from its place page link) and searchable text. The name is the card title's
 * clamped line and the description its two clamped lines (textContent reads past the clamp).
 */
export function cardTexts(main: Locator): Promise<CardText[]> {
  return main.locator(CARD).evaluateAll((cards) =>
    cards.map((card) => ({
      id: (card.querySelector('a[href^="/places/"]')?.getAttribute('href') ?? '').slice(8),
      haystack: [
        card.querySelector('a[target="_blank"] .line-clamp-1')?.textContent ?? '',
        card.querySelector('a[target="_blank"] .line-clamp-2')?.textContent ?? '',
      ].join(' '),
    })),
  );
}

/** The card ids the page shows now, in order. */
export function cardIds(main: Locator): Promise<string[]> {
  return main
    .locator(`${CARD} a[href^="/places/"]`)
    .evaluateAll((links) => links.map((link) => (link.getAttribute('href') ?? '').slice(8)));
}

/**
 * Waits for the lazily loaded Maps script to draw a marker; false when it never does (no key, a
 * refused referer, no network), so a check can skip with that reason.
 */
export async function mapDrawn(page: Page): Promise<boolean> {
  return page
    .locator(`${MAP} gmp-advanced-marker`)
    .first()
    .waitFor({ state: 'attached', timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
}

/**
 * Zooms the map out to the whole world with its own keyboard shortcut, so no place sits outside
 * the view (the clusterer draws only what is in view).
 */
export async function showWholeWorld(page: Page): Promise<void> {
  await page.locator(`${MAP} [aria-roledescription="map"]`).first().focus();
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('Minus');
}

/** The places the map's markers stand for: each cluster's "N places" plus each single marker. */
export function mapMarkerTotal(page: Page): Promise<number> {
  return page.locator(`${MAP} gmp-advanced-marker`).evaluateAll((markers) =>
    markers.reduce((sum, marker) => {
      const title = marker.getAttribute('title') ?? marker.getAttribute('aria-label') ?? '';
      const cluster = /^(\d+) places$/.exec(title);
      return sum + (cluster ? Number(cluster[1]) : 1);
    }, 0),
  );
}

/** Polls until the map's markers stand for `count` places. */
export async function expectMarkersFor(page: Page, count: number): Promise<void> {
  await expect
    .poll(() => mapMarkerTotal(page), { message: 'the map markers match the cards' })
    .toBe(count);
}
