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
 * @file The home bento (the Waterfall masonry) in a real browser. No check knows a tile's height:
 * each compares the page with itself, or with the same page loaded without JavaScript. None needs
 * API keys. Without them the tiles that need one show their designed error states, and a run
 * checks less: the estimate and first paint checks compare only tiles in their reference state
 * (and say which they left out), and the equaliser check skips unless something plays.
 * - Layout, at 320, 375, 600, 700, 768, 1024, 1280 and 1440 px: the page's one h1 is 'Mike Odnis',
 *   inside main#main-content; nothing scrolls sideways or runs past its slot; the ten slots are in
 *   priority order in the DOM, and no slot's top is more than 32 px above the previous slot's, so
 *   reading and Tab run down the page across the lanes; no two slots, or tiles, overlap; each tile
 *   hugs its content, with at most 24 px of empty space below it; the hero is the largest tile, and
 *   from a 40rem bento it spans two lanes; no visible text is under 12 px.
 * - Masonry, at the same widths: each slot's grid-row span matches its height within one row, so
 *   the script that measures the slots works. With it broken, or not run, the server's estimates
 *   stay (only near each tile's height), and every check that waits for the bento to settle times
 *   out there first, naming each shown slot whose span the masonry has not written.
 * - Estimates, at 375, 390, 412, 500, 600, 700, 720, 768, 820, 900, 1024 and 1440 px: a fresh
 *   page without JavaScript reserves each slot the height it has with JavaScript. A slot in one
 *   lane reserves within 16 px of it. A slot across every lane reserves at most 16 px more, and
 *   may reserve less: no other slot shares its rows, so an underestimate grows them and moves
 *   nothing. Only slots whose tile shows its reference content with JavaScript are compared. One
 *   in a loading, error, empty or stale state (data-state, data-stale or aria-busy, the tiles'
 *   state contract) has a height the table is not for, so an annotation names it instead, and so
 *   does a lane slot that such a slot, or one in an error, empty or stale state without
 *   JavaScript, sent to a lane of another width. One slot is held to a range instead: the project
 *   at md and md-wide (bento-layout.ts's BENTO_ESTIMATE_GAPS), whose 2:1 cover grows with its
 *   lane, 271.2 to 310.9 px across md and 311.1 to 380.8 px across md-wide, so no estimate is
 *   within 16 px everywhere. Its tile, and the tile its rows reserve, must be inside that range,
 *   within 2 px (and a row, for what it reserves), or the check fails naming it; inside it, a miss
 *   of more than 16 px is an annotation, not a failure (at 700 px, a 646 or 656 px bento, it
 *   reserves about 20 px too much on every run).
 * - First paint, at the same widths: each slot's top without JavaScript is within 16 px of its top
 *   with it, so the first paint is the final layout. It runs only when every slot shows its
 *   reference content with JavaScript and none is in an error, empty or stale state without it (a
 *   streamed tile keeps its skeleton there, which has its tile's footprint, so a skeleton taller
 *   than its tile fails it: from 640 to 649 px LeetCode's once did). Otherwise an annotation names
 *   the slots that kept it from running, as on any run where a tile shows an error. At md and
 *   md-wide (about 683 to 1217 px windows) the slots after the project in the DOM (place, roles,
 *   the site index) may move by its miss plus GitHub's, even where the project is within 16 px:
 *   up to 41 px (FIRST_PAINT_GAP_MOVE_MAX_PX; the worst measured is 34 px, roles at an 800 px
 *   bento), each listed in an annotation, and a larger move fails. Roles and the site index can
 *   swap lanes there (about 1086 to 1210 px windows). The slots up to and including the project
 *   are held to 16 px.
 * - Every link in main has a name, none goes to '#' or nowhere, and each one that opens a new tab
 *   says so and drops the opener. The skip link, then Tab, focuses 'Email me', the hero's first
 *   link.
 * - Motion: under reduced motion nothing on the page animates. Without it, only the now playing
 *   equaliser may, by transform alone, and it does while something plays (skipped otherwise);
 *   behind the page, the shell's light rays fade and swing by opacity and rotate alone.
 * - Loading the page, then resizing it across the three tiers, logs no console error, page error
 *   or hydration warning, up to the moment the palette's shortcut opens it, which proves React has
 *   hydrated. Chromium reports a ResizeObserver loop error only as a window error event with no
 *   error object, which neither Playwright's console nor its pageerror event sees, so an init
 *   script logs those as console errors and they count too. The browser's own line for a failed
 *   request is not counted: a data source that fails has its tile's error state for that.
 * - Without JavaScript the hero's h1 and links show at once, and the HTML holds every tile's
 *   content. A tile that resolves after the first flush is streamed into a hidden element that
 *   only JavaScript moves into its slot (React does this even when the tile is ready within
 *   milliseconds), so without JavaScript its skeleton stays on screen; its content is still in
 *   the document, which is what a crawler reads. So those checks assert presence, not display,
 *   comparing each slot's headings with the ones the hydrated page shows.
 *
 * Waits are deterministic: a check starts once no streamed segment is left hidden and nothing in
 * main is aria-busy (as e2e/visual/shell-grid.spec.ts waits), the fonts and images are in, and the
 * slots stay put across two animation frames, a task and a third frame, with every shown slot
 * carrying the span the masonry wrote for its height (it writes them the frame after a slot
 * resizes, and only once React has hydrated, so a slot with none yet means it has not run; where
 * the browser packs grid lanes itself it writes none). A page without JavaScript is measured once
 * its slots are in and its fonts have loaded. The selectors, the waits, the measuring and the
 * slots' states live in e2e/fixtures/home-bento.ts, shared with the visual spec; what the estimate
 * and first paint checks compare, and the settle wait's span test, in
 * e2e/fixtures/home-bento-estimates.ts, which tests/unit/home/bento-estimate-checks.test.ts tests.
 */

import {
  type APIRequestContext,
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import {
  BENTO_AREAS,
  type BentoArea,
  type BentoMeasure,
  type Box,
  expectSlotsStill,
  forwardWindowErrors,
  type GridMeasure,
  isNativeLanes,
  MAIN,
  measureBento,
  SLOT,
  type SlotMeasure,
  settleBento,
} from '../fixtures/home-bento';
import {
  compareEstimates,
  compareFirstPaint,
  ESTIMATE_TOLERANCE_PX,
  FIRST_PAINT_GAP_MOVE_MAX_PX,
} from '../fixtures/home-bento-estimates';

/**
 * Phone to wide desktop. 600 px is a 560 px bento (550 px in a desktop browser): still narrow, but
 * past 30rem, where the project turns cover-left and GitHub's sparkline moves beside its figure.
 * 700 px is a 646 px bento in a desktop browser (656 px on a phone): just inside medium.
 */
const LAYOUT_WIDTHS = [320, 375, 600, 700, 768, 1024, 1280, 1440] as const;

/**
 * The estimate and first paint checks' viewports, with their bentos on a phone and in a desktop
 * browser, which is 10 px narrower until the shell's 75rem cap (globals.css keeps a thin
 * scrollbar's gutter):
 * - narrow: 375 px (343, 333), 390 px (358, 348), 412 px (380, 370) and 500 px (464, 454; 464 px
 *   is 29rem, where GitHub's sparkline used to move beside its figure);
 * - narrow from 30rem: 600 px (560, 550);
 * - medium: 700 px (656, 646; from 640 to 649 px a skeleton once wrapped where its tile did not),
 *   720 px (675, 665), 768 px (721, 711) and 820 px (771, 761): md's two bands where the slots
 *   after the project moved, about 683 to 742 and 800 to 860 px windows;
 * - the rest of medium, from 50rem: 900 px (848, 838) and 1024 px (903, 893);
 * - wide: 1440 px (1136).
 * A tile across every lane reserves at most its smallest height in the tier, and a one-lane tile's
 * estimate holds within 16 px across its tier, except the project's at md and md-wide (its cover
 * grows with its lane: BENTO_ESTIMATE_GAPS in bento-layout.ts). That one is held to its measured
 * range, and the slots after it to 41 px of movement, where the checks report what they excuse.
 * These are common phones and the widths near the tiers' edges; 700 px keeps the 640 to 650 px
 * bento band in the first paint check.
 */
const REFERENCE_WIDTHS = [375, 390, 412, 500, 600, 700, 720, 768, 820, 900, 1024, 1440] as const;

/** The three tiers, widest first, for the resize check: a lane change re-measures every slot. */
const TIER_WIDTHS = [1440, 768, 375] as const;

const VIEWPORT_HEIGHT_PX = 900;

/** Sub-pixel rounding allowed in each measured edge. */
const TOLERANCE_PX = 1;

/** A tile may be at most this much taller than its content needs. */
const HUG_SLACK_PX = 24;

/** A slot's top may sit at most this far above the previous slot's (the grid's 2rem tolerance). */
const ORDER_TOLERANCE_PX = 32;

/** No visible text is smaller. */
const MIN_TEXT_PX = 12;

/** How far a slot's height may differ from the rows its grid-row span gives it. */
const SPAN_TOLERANCE_ROWS = 1;

/** The bento width (40rem) from which the hero spans two lanes. */
const HERO_TWO_LANES_FROM_PX = 640;
const HERO_LANES = 2;

/** A tile still loading (its skeleton) marks itself busy. */
const BUSY = '[aria-busy="true"]';

const HERO_NAME = 'Mike Odnis';
const FIRST_HERO_LINK = 'Email me';
const SKIP_LINK = 'Skip to content';

/** kbar's `$mod+k`: Meta on Apple platforms, Control elsewhere, as Playwright's ControlOrMeta. */
const PALETTE_KEYS = 'ControlOrMeta+k';
/** The palette's search field (PALETTE_SEARCH_LABEL in src/components/cmd.tsx). */
const PALETTE_SEARCH = 'Search pages and commands';
/** How long one try at opening the palette waits for it before pressing the shortcut again. */
const PALETTE_TIMEOUT_MS = 2_000;

/** What a link that opens a new tab says to screen readers (NEW_TAB_LABEL in tile-link.tsx). */
const NEW_TAB_NAME = /\(opens in a new tab\)/;

/** The now playing tile's h2 while something plays ('Playing now on Spotify'). */
const PLAYING_HEADING = /^playing now\b/i;

/** The slot whose equaliser is the page's only moving element, and what it may animate. */
const EQUALISER_AREA: BentoArea = 'now';
const EQUALISER_PROPERTIES: ReadonlySet<string> = new Set(['transform', 'scale']);
/** The shell's light rays (src/styles/light-rays.css), behind every page: what they may animate. */
const LIGHT_RAY_PROPERTIES: ReadonlySet<string> = new Set(['opacity', 'rotate']);

/**
 * The browser's own line for a failed request. Upstream failures are the data sources' business:
 * each tile shows its error state for them, and this spec must pass without API keys.
 */
const NETWORK_FAILURE = /^Failed to load resource\b/;
/**
 * Vercel serves /_vercel/insights and /_vercel/speed-insights only on its own platform. A local
 * production build (next start, standalone) answers them with a text 404, which the browser refuses
 * to run as a script. That is the host, not the page.
 */
const VERCEL_ONLY_SCRIPT = /Refused to execute script from '[^']*\/_vercel\//;
const HYDRATION = /hydrat/i;

interface LabelledBox {
  readonly area: string;
  readonly box: Box;
}

interface SlotHeadings {
  readonly area: string;
  readonly headings: readonly string[];
}

interface RunningAnimation {
  /** The bento slot the target sits in, or '' outside the bento. */
  readonly area: string;
  /**
   * The data-equaliser of the equaliser the target sits in ('live' while it plays, 'still'
   * otherwise), or null outside one.
   */
  readonly equaliser: string | null;
  /** Whether the target is one of the shell's light rays, outside the bento. */
  readonly lightRay: boolean;
  /** The target, as `tag.classes` plus its pseudo-element, for the failure message. */
  readonly target: string;
  /** The CSS properties its keyframes set. */
  readonly properties: readonly string[];
}

const urlOf = (path = '/'): string => `${getTargetUrl()}${path}`;

const slotOf = (main: Locator, area: BentoArea): Locator =>
  main.locator(`[data-bento-slot="${area}"]`);

const round = (value: number): number => Math.round(value * 10) / 10;

/** Adds a test annotation of this type, when there is anything for it to name. */
function annotate(type: string, description: string, items: readonly string[]): void {
  if (items.length > 0) test.info().annotations.push({ type, description });
}

/**
 * Requests '/' once and reads the whole response. The HTML stream ends only after every tile's
 * loader has answered or hit its deadline, so the browser's load next finds them cached (and,
 * under `next dev`, the route compiled).
 */
async function warmLoaders(request: APIRequestContext): Promise<void> {
  const response = await request.get(urlOf());
  await response.body();
}

/** Loads '/' (at `width`, when given) and waits for the shell's main to show. */
async function openHome(page: Page, width?: number): Promise<Locator> {
  if (width !== undefined) await page.setViewportSize({ width, height: VIEWPORT_HEIGHT_PX });
  await page.goto(urlOf());
  const main = page.locator(MAIN);
  await expect(main).toBeVisible();
  return main;
}

/** The message for a grid that has no fixed row for spans to count in. */
const noRowUnit = (grid: GridMeasure): string =>
  `the bento has no fixed row to span (grid-auto-rows: ${grid.autoRows})`;

/**
 * Every slot whose grid-row span is more than a row away from the rows its height needs. Native
 * grid lanes place by height, with no spans, so there is nothing to compare.
 */
function spanMismatches({ grid, slots }: BentoMeasure): string[] {
  if (isNativeLanes(grid)) return [];
  const { rowUnit } = grid;
  if (rowUnit === null) return [noRowUnit(grid)];
  return slots.flatMap(({ area, rows, natural }) => {
    if (rows === null) return [`${area}: declares no grid-row span`];
    const needed = (natural + grid.rowGap) / (rowUnit + grid.rowGap);
    return Math.abs(rows - needed) > SPAN_TOLERANCE_ROWS
      ? [`${area}: spans ${rows} rows, its ${round(natural)} px need ${round(needed)}`]
      : [];
  });
}

/** Every slot whose top is more than the tolerance above the previous slot's. */
const orderBreaks = (slots: readonly SlotMeasure[]): string[] =>
  slots.slice(1).flatMap((current, index) => {
    const previous = slots[index];
    if (!previous || current.slot.y >= previous.slot.y - ORDER_TOLERANCE_PX) return [];
    const tops = `${round(current.slot.y)} < ${round(previous.slot.y)}`;
    return [`${current.area} is above ${previous.area} (${tops})`];
  });

const overlaps = (a: Box, b: Box): boolean =>
  a.x + a.width - TOLERANCE_PX > b.x &&
  b.x + b.width - TOLERANCE_PX > a.x &&
  a.y + a.height - TOLERANCE_PX > b.y &&
  b.y + b.height - TOLERANCE_PX > a.y;

/** Every pair of boxes that overlap, as 'a/b'. */
const overlappingPairs = (boxes: readonly LabelledBox[]): string[] =>
  boxes.flatMap((a, index) =>
    boxes
      .slice(index + 1)
      .filter((b) => overlaps(a.box, b.box))
      .map((b) => `${a.area}/${b.area}`),
  );

const slotBoxes = (slots: readonly SlotMeasure[]): LabelledBox[] =>
  slots.map(({ area, slot }) => ({ area, box: slot }));

const tileBoxes = (slots: readonly SlotMeasure[]): LabelledBox[] =>
  slots.flatMap(({ area, tile }) => (tile ? [{ area, box: tile }] : []));

/** Every slot with no tile, or whose tile is more than the slack taller than its content. */
const looseTiles = (slots: readonly SlotMeasure[]): string[] =>
  slots.flatMap(({ area, tile, slack }) => {
    if (!tile) return [`${area}: no tile`];
    return slack > HUG_SLACK_PX ? [`${area}: ${round(slack)} px of empty space`] : [];
  });

/** The tile with the largest area. */
const largestTile = (slots: readonly SlotMeasure[]): string | undefined =>
  tileBoxes(slots).sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)[0]?.area;

/** How many of the grid's lanes the box covers from edge to edge. */
function lanesCovered(grid: GridMeasure, box: Box): number {
  let start = grid.left;
  let covered = 0;
  for (const lane of grid.lanes) {
    const end = start + lane;
    if (start >= box.x - TOLERANCE_PX && end <= box.x + box.width + TOLERANCE_PX) covered += 1;
    start = end + grid.columnGap;
  }
  return covered;
}

/** The page's h1s in the document (not in a dev tool's shadow root), and main's one h1. */
async function expectOneHeroHeading(page: Page, main: Locator): Promise<void> {
  expect(await page.evaluate(() => document.querySelectorAll('h1').length)).toBe(1);
  await expect(main.locator('h1')).toHaveText(HERO_NAME);
}

/**
 * Nothing scrolls sideways: not the page (its scrollWidth against the body's width, as
 * shell-grid.spec.ts measures it), not main (the shell root's overflow-x-clip would hide main's
 * overflow from the page), and no slot's content past the slot's own edge (a long CMS string that
 * does not wrap or clamp).
 */
async function expectNoSidewaysOverflow(page: Page, main: Locator): Promise<void> {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.body.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(clientWidth);
  expect(
    await main.evaluate((element) => element.scrollWidth - element.clientWidth),
    "main's content runs past its right edge",
  ).toBeLessThanOrEqual(TOLERANCE_PX);
  const overflowing = await main
    .locator(SLOT)
    .evaluateAll(
      (slots, slack) =>
        slots
          .filter((slot) => slot.scrollWidth - slot.clientWidth > slack)
          .map(
            (slot) =>
              `${slot.getAttribute('data-bento-slot')}: ${slot.scrollWidth - slot.clientWidth} px`,
          ),
      TOLERANCE_PX,
    );
  expect(overflowing, 'content runs past its slot').toEqual([]);
}

/**
 * Visible text in main set under the minimum, as 'text: size'. Text only a screen reader reads
 * (sr-only: an absolutely placed box of 1 px or less that hides its overflow) is skipped, and so is
 * text nothing displays.
 */
function textUnderMinimum(main: Locator): Promise<string[]> {
  return main.evaluate((root, minimum) => {
    const shown: CheckVisibilityOptions = {
      checkOpacity: true,
      checkVisibilityCSS: true,
      opacityProperty: true,
      visibilityProperty: true,
    };
    const isScreenReaderOnly = (element: Element): boolean => {
      for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
        const style = getComputedStyle(node);
        const { width, height } = node.getBoundingClientRect();
        const hides = style.overflow !== 'visible' || style.clipPath !== 'none';
        if (style.position === 'absolute' && width <= 1 && height <= 1 && hides) return true;
      }
      return false;
    };
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      const element = node.parentElement;
      if (text === '' || !element?.checkVisibility(shown)) continue;
      if (isScreenReaderOnly(element)) continue;
      const size = Number.parseFloat(getComputedStyle(element).fontSize);
      if (size < minimum - 0.01) found.push(`${text.slice(0, 40)}: ${size} px`);
    }
    return found;
  }, MIN_TEXT_PX);
}

/** Every anchor in main whose href is missing, empty or '#', as a short piece of its markup. */
function anchorsWithoutDestination(main: Locator): Promise<string[]> {
  return main.locator('a').evaluateAll((anchors) =>
    anchors
      .filter((anchor) => {
        const href = anchor.getAttribute('href')?.trim() ?? '';
        return href === '' || href === '#';
      })
      .map((anchor) => anchor.outerHTML.slice(0, 160)),
  );
}

/**
 * Under reduced motion, globals.css cuts every animation and transition to 1 ms (one iteration):
 * a colour that changes then (the footer badge's dot when the status arrives) still runs a 1 ms
 * transition, which moves nothing. Only longer ones count as motion.
 */
const INSTANT_MS = 1;

/**
 * Every animation or transition running on the page now, outside dev tools' shadow roots, with the
 * bento slot it runs in and the properties its keyframes set. Instant ones (INSTANT_MS) are left
 * out: they are the reduced-motion rule at work, and catching one is a matter of timing. So are
 * scroll-driven ones (the shell's edge haze fading with the scroll): they move only when the
 * reader scrolls, never on their own.
 */
function runningAnimations(page: Page): Promise<RunningAnimation[]> {
  return page.evaluate(
    ({ selector, instantMs }) => {
      const bookkeeping = new Set(['offset', 'computedOffset', 'easing', 'composite']);
      const followsScroll = (animation: Animation) =>
        typeof ScrollTimeline !== 'undefined' && animation.timeline instanceof ScrollTimeline;
      return document.getAnimations().flatMap((animation) => {
        const effect = animation.effect;
        if (animation.playState !== 'running' || !(effect instanceof KeyframeEffect)) return [];
        if (followsScroll(animation)) return [];
        const { activeDuration } = effect.getComputedTiming();
        if (typeof activeDuration === 'number' && activeDuration <= instantMs) return [];
        const target = effect.target;
        if (!target || target.getRootNode() !== document) return [];
        const classes = [...target.classList].slice(0, 3).join('.');
        const properties = new Set(
          effect.getKeyframes().flatMap((keyframe) => Object.keys(keyframe)),
        );
        return [
          {
            area: target.closest(selector)?.getAttribute('data-bento-slot') ?? '',
            equaliser: target.closest('[data-equaliser]')?.getAttribute('data-equaliser') ?? null,
            lightRay: target.closest('.light-rays') !== null,
            target: `${target.tagName.toLowerCase()}.${classes}${effect.pseudoElement ?? ''}`,
            properties: [...properties].filter((property) => !bookkeeping.has(property)),
          },
        ];
      });
    },
    { selector: SLOT, instantMs: INSTANT_MS },
  );
}

const describeAnimation = ({ area, target, properties }: RunningAnimation): string =>
  `${area || 'page'} ${target}: ${properties.join(', ')}`;

/** Whether every property in `properties` is in `allowed`. */
const movesOnly = (properties: readonly string[], allowed: ReadonlySet<string>): boolean =>
  properties.every((property) => allowed.has(property));

/**
 * Running animations that are neither the playing equaliser's nor the shell's light rays':
 * anything outside a live equaliser (elsewhere in its tile, or in one at rest) and outside the
 * rays, or either moving more than it may.
 */
const motionBesidesEqualiser = (animations: readonly RunningAnimation[]): string[] =>
  animations
    .filter(
      ({ equaliser, lightRay, properties }) =>
        !(equaliser === 'live' && movesOnly(properties, EQUALISER_PROPERTIES)) &&
        !(lightRay && movesOnly(properties, LIGHT_RAY_PROPERTIES)),
    )
    .map(describeAnimation);

/**
 * Opens the palette with its shortcut, which works only once React has hydrated the shell. The
 * shortcut is pressed again until the palette's search shows, and never while it is open (a
 * second press would close it).
 */
async function openPaletteWithShortcut(page: Page): Promise<void> {
  const search = page.getByRole('combobox', { name: PALETTE_SEARCH });
  await expect(async () => {
    if (!(await search.isVisible())) await page.keyboard.press(PALETTE_KEYS);
    await expect(search).toBeVisible({ timeout: PALETTE_TIMEOUT_MS });
  }).toPass();
}

/**
 * Asserts that `locator` is displayed and that no entrance animation left it, or an ancestor, at
 * opacity 0 (Playwright counts an opacity-0 element as visible).
 */
async function expectOpaque(locator: Locator, what: string): Promise<void> {
  await expect(locator).toBeVisible();
  const isTransparent = await locator.evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (getComputedStyle(node).opacity === '0') return true;
    }
    return false;
  });
  expect(isTransparent, `${what} or an ancestor is at opacity 0`).toBe(false);
}

/**
 * Opens '/' (at `width`, when given) in a browser context of its own, with JavaScript on or off by
 * name: a bare newContext() takes the test's options, so inside a describe that turns JavaScript
 * off it would be off here too. Runs `read` on the page and its main, then closes the context.
 */
async function inFreshContext<T>(
  browser: Browser,
  javaScriptEnabled: boolean,
  width: number | undefined,
  read: (page: Page, main: Locator) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({ javaScriptEnabled });
  try {
    const page = await context.newPage();
    return await read(page, await openHome(page, width));
  } finally {
    await context.close();
  }
}

/**
 * Each slot's headings (h1 to h3, whitespace collapsed) as a JavaScript visitor sees them once
 * every tile has loaded. The palette opening from its shortcut proves React hydrated, so this can
 * never quietly be a second no-JavaScript read.
 */
function hydratedHeadings(browser: Browser): Promise<SlotHeadings[]> {
  return inFreshContext(browser, true, undefined, async (page, main) => {
    await settleBento(page, main);
    await openPaletteWithShortcut(page);
    return main.locator(SLOT).evaluateAll((slots) =>
      slots.map((slot) => ({
        area: slot.getAttribute('data-bento-slot') ?? '',
        headings: [...slot.querySelectorAll('h1, h2, h3')].map((heading) =>
          (heading.textContent ?? '').replace(/\s+/g, ' ').trim(),
        ),
      })),
    );
  });
}

/**
 * The expected headings the document lacks, as 'area: heading'. A heading counts when it is in
 * main or in a streamed chunk (a hidden element React fills after the first flush), and not in a
 * skeleton, since a skeleton shows its tile's label too.
 */
function missingHeadings(page: Page, expected: readonly SlotHeadings[]): Promise<string[]> {
  return page.evaluate(
    ({ slots, busy }) => {
      const present = new Set(
        [...document.querySelectorAll('h1, h2, h3')]
          .filter((heading) => heading.closest('main, [hidden]') && !heading.closest(busy))
          .map((heading) => (heading.textContent ?? '').replace(/\s+/g, ' ').trim()),
      );
      return slots.flatMap(({ area, headings }) =>
        headings.filter((heading) => !present.has(heading)).map((heading) => `${area}: ${heading}`),
      );
    },
    { slots: expected, busy: BUSY },
  );
}

test.beforeEach(async ({ request }) => {
  await warmLoaders(request);
});

test.describe('home bento layout', () => {
  for (const width of LAYOUT_WIDTHS) {
    test(`${width} px: one h1, ten slots in reading order, hugging tiles, no overlap, overflow or small text`, async ({
      page,
    }) => {
      const main = await openHome(page, width);
      await settleBento(page, main);

      await expectOneHeroHeading(page, main);
      for (const area of BENTO_AREAS) await expect(slotOf(main, area)).toBeVisible();

      const { grid, slots } = await measureBento(main);
      expect(slots.map((slot) => slot.area)).toEqual([...BENTO_AREAS]);
      expect(orderBreaks(slots), 'a slot sits above the one before it').toEqual([]);
      expect(overlappingPairs(slotBoxes(slots)), 'slots overlap').toEqual([]);
      expect(overlappingPairs(tileBoxes(slots)), 'tiles overlap').toEqual([]);
      expect(looseTiles(slots), 'a tile is taller than its content').toEqual([]);
      expect(largestTile(slots), 'the hero is not the largest tile').toBe('hero');
      const [hero] = slots;
      if (hero && grid.width >= HERO_TWO_LANES_FROM_PX) {
        expect(lanesCovered(grid, hero.slot), 'the lanes the hero spans').toBe(HERO_LANES);
      }
      await expectNoSidewaysOverflow(page, main);
      expect(await textUnderMinimum(main), `text under ${MIN_TEXT_PX} px`).toEqual([]);
    });
  }
});

test.describe('home bento masonry', () => {
  for (const width of LAYOUT_WIDTHS) {
    test(`${width} px: each slot's grid-row span matches its height within a row`, async ({
      page,
    }) => {
      const main = await openHome(page, width);
      await settleBento(page, main);

      const measure = await measureBento(main);
      test.skip(isNativeLanes(measure.grid), 'the browser packs grid lanes itself: no spans');
      expect(spanMismatches(measure), 'the masonry script left a span stale').toEqual([]);
    });
  }

  for (const width of REFERENCE_WIDTHS) {
    test(`${width} px: without JavaScript each slot reserves its height with JavaScript and sits at its top, within ${ESTIMATE_TOLERANCE_PX} px`, async ({
      browser,
    }) => {
      const withScript = await inFreshContext(browser, true, width, async (page, main) => {
        await settleBento(page, main);
        return measureBento(main);
      });
      const withoutScript = await inFreshContext(browser, false, width, async (page, main) => {
        await expect(main.locator(SLOT)).toHaveCount(BENTO_AREAS.length);
        // Playwright evaluates with JavaScript off too. A font swap can change a tile's height.
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        return measureBento(main);
      });

      test.skip(isNativeLanes(withoutScript.grid), 'the browser packs grid lanes itself');

      const { stale, skipped, accepted } = compareEstimates(withScript, withoutScript);
      annotate(
        'estimates not compared',
        `not showing their reference content with JavaScript, or sent by one to a lane of another width: ${skipped.join(', ')}`,
        skipped,
      );
      annotate(
        'accepted estimate gap',
        `off here, inside the range BENTO_ESTIMATE_GAPS in bento-layout.ts accepts: ${accepted.join(', ')}`,
        accepted,
      );
      expect.soft(stale, "the server's estimate table is stale").toEqual([]);

      const { blockers, moved, excused } = compareFirstPaint(withScript, withoutScript);
      annotate(
        'first paint not compared',
        `it needs every slot showing its reference content: ${blockers.join(', ')}`,
        blockers,
      );
      annotate(
        'first paint after an accepted gap',
        `moved once JavaScript ran, after a gap in this tier, by no more than ${FIRST_PAINT_GAP_MOVE_MAX_PX} px: ${excused.join(', ')}`,
        excused,
      );
      expect(moved, 'a slot moves when JavaScript runs').toEqual([]);
    });
  }
});

test.describe('home bento links and keyboard', () => {
  test('every link in main has a name and a destination, and says when it opens a new tab', async ({
    page,
  }) => {
    const main = await openHome(page);
    await settleBento(page, main);

    const links = await main.getByRole('link').all();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) await expect(link).toHaveAccessibleName(/\S/);
    expect(await anchorsWithoutDestination(main), "links to '#' or nowhere").toEqual([]);

    const newTabLinks = await main.locator('a[target="_blank"]').filter({ visible: true }).all();
    for (const link of newTabLinks) {
      await expect(link).toHaveAccessibleName(NEW_TAB_NAME);
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    }
  });

  test(`the skip link, then Tab, focuses '${FIRST_HERO_LINK}'`, async ({ page }) => {
    const main = await openHome(page);
    const firstLink = main.getByRole('link', { name: FIRST_HERO_LINK, exact: true });
    await expect(firstLink).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: SKIP_LINK })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(main).toBeFocused();
    await page.keyboard.press('Tab');

    await expect(firstLink).toBeFocused();
  });
});

test.describe('home bento motion', () => {
  test('nothing on the page animates under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const main = await openHome(page);
    await settleBento(page, main);

    const moving = (await runningAnimations(page)).map(describeAnimation);
    expect(moving, 'running under reduced motion').toEqual([]);
  });

  test('only the now playing equaliser animates, by transform alone, and the light rays behind the page', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const main = await openHome(page);
    await settleBento(page, main);

    expect(motionBesidesEqualiser(await runningAnimations(page))).toEqual([]);
  });

  test('the equaliser animates while something plays', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const main = await openHome(page);
    await settleBento(page, main);

    const playing = slotOf(main, EQUALISER_AREA).getByRole('heading', { name: PLAYING_HEADING });
    test.skip((await playing.count()) === 0, 'nothing is playing now, so the equaliser rests');
    // Under a band of the edge haze the bars pause (data-under-edge): look at them mid-screen.
    const live = main.locator('[data-equaliser="live"]').first();
    await live.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(main.locator('[data-equaliser="live"] [data-under-edge]')).toHaveCount(0);
    const equaliser = (await runningAnimations(page)).filter(
      (animation) => animation.equaliser === 'live',
    );
    expect(equaliser.length, 'running animations in the live equaliser').toBeGreaterThan(0);
  });
});

test.describe('home bento console', () => {
  test('loads and resizes across the tiers without console errors, page errors or hydration warnings', async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      const isError =
        message.type() === 'error' && !NETWORK_FAILURE.test(text) && !VERCEL_ONLY_SCRIPT.test(text);
      const isHydrationWarning = message.type() === 'warning' && HYDRATION.test(text);
      if (isError || isHydrationWarning) problems.push(`${message.type()}: ${text}`);
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    // A ResizeObserver loop error reaches neither listener on its own.
    await forwardWindowErrors(page);

    const main = await openHome(page);
    await settleBento(page, main);
    await openPaletteWithShortcut(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox', { name: PALETTE_SEARCH })).toBeHidden();

    // A lane change resizes every slot; writing spans inside the ResizeObserver's callback would
    // raise its loop error here, which forwardWindowErrors logs as a console error.
    for (const width of TIER_WIDTHS) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT_PX });
      await expectSlotsStill(main);
    }

    expect(problems).toEqual([]);
  });
});

test.describe('home bento without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test("shows the hero at once, and the HTML holds every tile's content", async ({
    browser,
    page,
  }) => {
    const expected = await hydratedHeadings(browser);
    expect(expected.map((slot) => slot.area)).toEqual([...BENTO_AREAS]);

    const response = await page.goto(urlOf());
    expect(response?.status()).toBe(200);
    const main = page.locator(MAIN);

    // The hero has no Suspense of its own, so its h1 and links are in the first flush.
    await expectOpaque(main.locator('h1'), 'the h1');
    await expectOneHeroHeading(page, main);
    await expect(main.getByRole('link', { name: FIRST_HERO_LINK, exact: true })).toBeVisible();

    // Each slot is in the first flush too, holding its tile or, until JavaScript, its skeleton.
    for (const area of BENTO_AREAS) await expect(slotOf(main, area)).toBeVisible();
    expect(await missingHeadings(page, expected), 'tile content missing from the HTML').toEqual([]);
  });
});
