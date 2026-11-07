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
 * @file What the home bento's browser checks share: its selectors and areas, the wait for a
 * settled bento, one synchronous measure of the masonry grid and its slots (with the state each
 * slot's tile is in), and the hook that makes a ResizeObserver loop error visible to the console
 * check. Used by e2e/journeys/home-bento.spec.ts and e2e/visual/homepage.spec.ts. The areas and
 * rowsFor come from bento-layout.ts, plain data with a type-only import, which Playwright's process
 * can load (unlike the server-only home-page.tsx). What the spec compares between two measures is
 * in home-bento-estimates.ts, which has no Playwright import, so vitest tests it.
 */

import { expect, type Locator, type Page } from '@playwright/test';

import {
  BENTO_AREAS,
  type BentoArea,
  MEASURED_ROWS_PROPERTY,
  rowsFor,
} from '@/app/_components/home/bento-layout';

export { isNativeLanes, spansEveryLane } from './home-bento-estimates';
export { BENTO_AREAS, type BentoArea };

/** The shell's one `<main>` (src/components/animations/pages/page-transition.tsx). */
export const MAIN = 'main#main-content';

/** A bento slot. Found by attribute, because CSS module class names are hashed. */
export const SLOT = '[data-bento-slot]';

/**
 * Content that is still on its way: a Suspense segment React streamed into a hidden div and has
 * not revealed yet, or a skeleton that marks itself busy (shell-grid.spec.ts's PENDING_CONTENT).
 * React reveals streamed segments after the load event, so a page measured straight after goto can
 * still change.
 */
export const PENDING_CONTENT = 'div[hidden][id^="S:"], main [aria-busy="true"]';

/**
 * What a slot shows. By the tiles' state contract, a tile that is not showing its reference
 * content (the content, and so the height, the estimate table is measured for) marks its root or
 * a descendant: data-state 'loading' (a skeleton, which is aria-busy too), 'error', 'empty' or
 * 'stale', or data-stale where a stale line ('as of …', 'Last known') shows. A ready tile carries
 * data-state 'ready', another value of its own (a status, a now playing kind) or none.
 */
export type SlotState = 'reference' | 'error' | 'empty' | 'stale' | 'loading';

/**
 * Each state but 'reference' and the selector that finds it inside a slot, by precedence: a slot
 * that matches two (an error view inside a stale frame) takes the first.
 */
const STATE_MARKERS: ReadonlyArray<readonly [Exclude<SlotState, 'reference'>, string]> = [
  ['error', '[data-state="error"]'],
  ['empty', '[data-state="empty"]'],
  ['stale', '[data-state="stale"], [data-stale]'],
  ['loading', '[data-state="loading"], [aria-busy="true"]'],
];

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SlotMeasure {
  readonly area: string;
  readonly slot: Box;
  /** The slot's tile (its first rendered, in-flow child), or null when it has none. */
  readonly tile: Box | null;
  /** How much taller the tile is than its content needs: the empty space below its content. */
  readonly slack: number;
  /** The height the slot needs around its tile: the tile's, plus the slot's padding and border. */
  readonly natural: number;
  /** The rows the slot's grid-row span asks for, or null when it declares no span. */
  readonly rows: number | null;
  /**
   * The lanes its grid-column span asks for: its span, 1 when it is auto-placed without one, or
   * null when it is placed by line.
   */
  readonly columns: number | null;
  /** What its tile shows: its reference content, or a loading, error, empty or stale state. */
  readonly state: SlotState;
}

export interface GridMeasure {
  /** The computed display: 'grid' for span masonry, 'grid-lanes' where the browser packs lanes. */
  readonly display: string;
  /**
   * The content box's top and left edges, and its width, fractional as its container queries see
   * it (a 683 px phone's bento is 639.69 px: narrow, where a rounded 640 would be medium).
   */
  readonly top: number;
  readonly left: number;
  readonly width: number;
  /** The computed grid-auto-rows, and the fixed row its first length gives (null without one). */
  readonly autoRows: string;
  readonly rowUnit: number | null;
  readonly rowGap: number;
  /** The lanes' resolved widths, left to right. */
  readonly lanes: readonly number[];
  readonly columnGap: number;
}

export interface BentoMeasure {
  readonly grid: GridMeasure;
  readonly slots: readonly SlotMeasure[];
}

/** A slot's border-box height and the span the masonry wrote on it ('' before it has). */
interface WrittenSpan {
  readonly height: number;
  readonly rowsJs: string;
}

/**
 * Whether the masonry has nothing left to write on this slot: it wrote no span yet (no
 * JavaScript, native lanes, or not measured), the slot is hidden (the island keeps a hidden slot's
 * last span), or the span it wrote is the one the slot's height needs now.
 */
const isSpanCurrent = ({ height, rowsJs }: WrittenSpan): boolean =>
  rowsJs === '' || height === 0 || Number(rowsJs) === rowsFor(height);

/**
 * True when no slot moves across two animation frames, a task and a third frame, and every span
 * the masonry wrote matches its slot's height. The island collects sizes in a ResizeObserver,
 * which runs after the frame's animation callbacks, and writes them in the next frame: when a
 * slot resized in the task before the first read (a font or an image landing, a resize), this
 * check's second frame can run before the island's write, so two quiet frames prove nothing. The
 * task and the third frame let that write land and lay out. A span write that moves no slot
 * (align-items: start keeps a slot's box whatever its span) shows only in --rows-js, hence the
 * comparison.
 */
async function slotsStayPut(main: Locator): Promise<boolean> {
  const { moved, spans } = await main.evaluate(
    async (root, { selector, property }) => {
      const slots = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(selector)];
      const read = (): string =>
        slots()
          .map((slot) => {
            const { x, y, width, height } = slot.getBoundingClientRect();
            return `${x},${y},${width},${height}`;
          })
          .join(';');
      const nextFrame = (): Promise<void> =>
        new Promise((resolve) => requestAnimationFrame(() => resolve()));
      // A task, not a timer: a message posted to a channel is delivered as the next task.
      const nextTask = (): Promise<void> =>
        new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            channel.port1.close();
            resolve();
          };
          channel.port2.postMessage(null);
        });
      const before = read();
      await nextFrame();
      await nextFrame();
      await nextTask();
      await nextFrame();
      return {
        moved: read() !== before,
        spans: slots().map((slot) => ({
          height: slot.getBoundingClientRect().height,
          rowsJs: slot.style.getPropertyValue(property).trim(),
        })),
      };
    },
    { selector: SLOT, property: MEASURED_ROWS_PROPERTY },
  );
  return !moved && spans.every(isSpanCurrent);
}

/** Waits until the bento stops moving: after a load, a resize or a tile changing size. */
export async function expectSlotsStill(main: Locator): Promise<void> {
  await expect.poll(() => slotsStayPut(main), { message: 'the bento keeps moving' }).toBe(true);
}

/**
 * Waits for the bento to be final (JavaScript on): all ten slots, no streamed segment hidden and
 * no skeleton left, every image decoded (lazy ones too, so they load now rather than mid-measure)
 * and the fonts in, so no tile changes height after this; then the masonry settled. An image that
 * fails to load is left as it is.
 */
export async function settleBento(page: Page, main: Locator): Promise<void> {
  await expect(main.locator(SLOT)).toHaveCount(BENTO_AREAS.length);
  await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
  await page.evaluate(async () => {
    const images = [...document.images];
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    await document.fonts.ready;
  });
  await expectSlotsStill(main);
}

/**
 * Makes every window 'error' event that carries no error object a console error ('window error:
 * <message>'), in every document the page loads from now on, so call it before goto. Chromium
 * reports 'ResizeObserver loop completed with undelivered notifications' only that way: neither
 * Playwright's 'console' nor its 'pageerror' event sees it, and Next's dev overlay ignores it. An
 * error that has an object is a pageerror already, so it is not logged twice.
 */
export async function forwardWindowErrors(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.addEventListener('error', (event) => {
      if (event.error == null) console.error(`window error: ${event.message}`);
    });
  });
}

/**
 * Measures the bento grid (the slots' parent) and every slot, in DOM order, in one synchronous
 * pass. A tile's slack is its height less its height with nothing stretching it: for that moment
 * its own height, min-height and max-height are let go and it is aligned to the start (or, in a
 * column flexbox, not grown), then its inline style is put back before the browser paints or a
 * ResizeObserver could see it. Works with JavaScript off too (Playwright evaluates regardless).
 */
export function measureBento(main: Locator): Promise<BentoMeasure> {
  return main.evaluate(
    (root, { selector, markers }) => {
      const px = (value: string): number => Number.parseFloat(value) || 0;
      const boxOf = (element: Element): Box => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      };
      const blockFrame = (style: CSSStyleDeclaration): number =>
        px(style.paddingTop) +
        px(style.paddingBottom) +
        px(style.borderTopWidth) +
        px(style.borderBottomWidth);
      const tileOf = (slot: Element): HTMLElement | null =>
        [...slot.children].find(
          (child): child is HTMLElement =>
            child instanceof HTMLElement &&
            child.getClientRects().length > 0 &&
            !['absolute', 'fixed'].includes(getComputedStyle(child).position),
        ) ?? null;
      const slackOf = (slot: Element, tile: HTMLElement): number => {
        const height = tile.getBoundingClientRect().height;
        const inline = tile.getAttribute('style');
        const parent = getComputedStyle(slot);
        const isColumnFlex =
          parent.display.endsWith('flex') && parent.flexDirection.startsWith('column');
        tile.style.setProperty('height', 'auto', 'important');
        tile.style.setProperty('min-height', '0px', 'important');
        tile.style.setProperty('max-height', 'none', 'important');
        if (isColumnFlex) tile.style.setProperty('flex-grow', '0', 'important');
        else tile.style.setProperty('align-self', 'start', 'important');
        const natural = tile.getBoundingClientRect().height;
        if (inline === null) tile.removeAttribute('style');
        else tile.setAttribute('style', inline);
        return height - natural;
      };
      const spanOf = (style: CSSStyleDeclaration): number | null => {
        const match = /\bspan (\d+)/.exec(`${style.gridRowStart} ${style.gridRowEnd}`);
        return match ? Number(match[1]) : null;
      };
      const columnsOf = (style: CSSStyleDeclaration): number | null => {
        const { gridColumnStart: start, gridColumnEnd: end } = style;
        const match = /\bspan (\d+)/.exec(`${start} ${end}`);
        if (match) return Number(match[1]);
        return start === 'auto' && end === 'auto' ? 1 : null;
      };
      const stateOf = (slot: Element): SlotState =>
        markers.find(([, marker]) => slot.querySelector(marker) !== null)?.[0] ?? 'reference';

      const slots = [...root.querySelectorAll(selector)];
      const grid = slots[0]?.parentElement ?? root;
      const gridStyle = getComputedStyle(grid);
      const gridBox = grid.getBoundingClientRect();
      const rowUnit = /(\d+(?:\.\d+)?)px/.exec(gridStyle.gridAutoRows)?.[1];
      return {
        grid: {
          display: gridStyle.display,
          top: gridBox.top + px(gridStyle.borderTopWidth) + px(gridStyle.paddingTop),
          left: gridBox.left + px(gridStyle.borderLeftWidth) + px(gridStyle.paddingLeft),
          width:
            gridBox.width -
            px(gridStyle.borderLeftWidth) -
            px(gridStyle.borderRightWidth) -
            px(gridStyle.paddingLeft) -
            px(gridStyle.paddingRight),
          autoRows: gridStyle.gridAutoRows,
          rowUnit: rowUnit === undefined ? null : Number(rowUnit),
          rowGap: px(gridStyle.rowGap),
          lanes: gridStyle.gridTemplateColumns
            .split(' ')
            .map(px)
            .filter((width) => width > 0),
          columnGap: px(gridStyle.columnGap),
        },
        slots: slots.map((slot) => {
          const style = getComputedStyle(slot);
          const tile = tileOf(slot);
          const tileHeight = tile ? tile.getBoundingClientRect().height : 0;
          return {
            area: slot.getAttribute('data-bento-slot') ?? '',
            slot: boxOf(slot),
            tile: tile ? boxOf(tile) : null,
            slack: tile ? slackOf(slot, tile) : 0,
            natural: tileHeight + blockFrame(style),
            rows: spanOf(style),
            columns: columnsOf(style),
            state: stateOf(slot),
          };
        }),
      };
    },
    { selector: SLOT, markers: STATE_MARKERS },
  );
}
