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
 * @file The project page as the case study the owner picked on 2026-11-15, in a real browser:
 * - without JavaScript the page reads in full: one h1, the cover and every screen as links to the
 *   whole image (Screens holds every one but the cover), 'Where it sits' and the case study;
 * - with it, the cover and the screens open the shared viewer: 'Fig. n of N', the arrow keys go
 *   round the set, Escape closes it and focus goes back to the link that opened it; the shown
 *   thumbnail stays in view; inside a tall capture Home and End scroll it while Left and Right
 *   still step; Next stays under the pointer from the first screen to the last (desktop, phone);
 * - the contact sheet keeps every row one height and never scrolls sideways; pointing at a screen
 *   dims the others; on a phone nothing scrolls sideways and the viewer is full screen with Done;
 * - a project with no image is set as its description, one with only a cover has no Screens, and
 *   one with two shows the second alone, never the cover twice;
 * - a Featured project's breadcrumb leads to its own story in the Featured chapter, in view on a
 *   phone;
 * - the Visit address wraps only after a dot (or at a hyphen), never mid-word, even at 320 px
 *   with 200% text; a long name in the prose ('links.example.dev') stays whole whenever it fits
 *   its line;
 * - the neighbours lead to their pages, and Built with to /projects filtered by technology;
 * - a project made of several repositories shows "How it fits together" between The project and
 *   Screens, at 1440 and 375: one h3 per part in Studio order, one h1, a private row with no link,
 *   a part with its own page leading there from its name, repository links 44px tall under a
 *   finger, no sideways scroll at 320 px with 200% text and no page error; a project with fewer
 *   than two parts has no such section.
 * The cases are picked from the live list (GET /api/v1/sanity/projects); a case the data lacks is
 * skipped, never faked. GET only.
 */

import { type APIRequestContext, type Browser, expect, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import {
  type ApiPart,
  filled,
  hasParts,
  isPrivatePart,
  listPartsProjects,
  oneLine,
  partRow,
  shownParts,
} from '../fixtures/project-parts';

interface ApiImage {
  readonly asset?: { readonly _ref?: string } | null;
}

interface ApiProject {
  readonly _id: string;
  readonly title: string;
  readonly image?: ApiImage | null;
  readonly images?: readonly ApiImage[] | null;
  readonly startDate?: string | null;
  readonly liveUrl?: string | null;
  readonly featuredRank?: number | null;
  readonly description?: string | null;
  readonly longDescription?: string | null;
  readonly technologies?: readonly string[] | null;
  readonly systemParts?: readonly ApiPart[] | null;
}

const ASSET = /^image-[A-Za-z0-9]+-(\d+)x(\d+)-[a-z0-9]+$/;
/** Taller than this, the viewer scrolls a capture (photo-viewer-step.ts TALL_RATIO). */
const TALL_RATIO = 0.45;

/** A project's screens' asset ids: the cover and the gallery, each asset once. */
const screenRefs = (project: ApiProject): string[] => [
  ...new Set(
    [project.image, ...(project.images ?? [])]
      .map((image) => image?.asset?._ref ?? '')
      .filter((ref) => ASSET.test(ref)),
  ),
];

/** How many screens a project shows: the cover and the gallery, each asset once. */
const screenCount = (project: ApiProject): number => screenRefs(project).length;

/** The figure number of the first screen past the cover that is a tall capture, or null. */
function tallFigure(project: ApiProject): number | null {
  const at = screenRefs(project).findIndex((ref, index) => {
    const [, width = '0', height = '0'] = ASSET.exec(ref) ?? [];
    return index > 0 && Number(width) / Number(height) < TALL_RATIO;
  });
  return at > 0 ? at + 1 : null;
}

async function listProjects(request: APIRequestContext): Promise<readonly ApiProject[]> {
  const response = await request.get(`${getTargetUrl()}/api/v1/sanity/projects`);
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { data?: ApiProject[] } | ApiProject[];
  return Array.isArray(body) ? body : (body.data ?? []);
}

/** The first project the test wants, or null. */
async function pick(
  request: APIRequestContext,
  wanted: (project: ApiProject) => boolean,
): Promise<ApiProject | null> {
  return (await listProjects(request)).find(wanted) ?? null;
}

/** A live site's address as the page shows it, without 'www.'; '' without a real one. */
function hostOf(project: ApiProject): string {
  try {
    return new URL(project.liveUrl ?? '').hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The project whose shown address is longest and has a dot: the hardest one to wrap. */
const longestAddress = (projects: readonly ApiProject[]): ApiProject | null =>
  projects
    .filter((project) => hostOf(project).includes('.'))
    .reduce<ApiProject | null>(
      (best, project) =>
        hostOf(project).length > (best ? hostOf(best).length : 0) ? project : best,
      null,
    );

const open = async (page: Page, project: ApiProject): Promise<void> => {
  const response = await page.goto(`${getTargetUrl()}/projects/${project._id}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toBeVisible();
};

const noSidewaysScroll = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

const SHEET = (project: ApiProject) => screenCount(project) >= 3 && Boolean(project.startDate);

/** How far a project's screens differ in shape: the widest over the narrowest (1 when alike). */
function shapeSpread(project: ApiProject): number {
  const ratios = screenRefs(project).map((ref) => {
    const [, width = '1', height = '1'] = ASSET.exec(ref) ?? [];
    return Number(width) / Number(height);
  });
  return ratios.length > 0 ? Math.max(...ratios) / Math.min(...ratios) : 1;
}

/** The project whose screens differ most in shape, or null. */
const mostShapes = (projects: readonly ApiProject[]): ApiProject | null =>
  projects.reduce<ApiProject | null>(
    (best, project) => (shapeSpread(project) > (best ? shapeSpread(best) : 0) ? project : best),
    null,
  );

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('reads in full: one h1, every screen a link to the whole image', async ({
    page,
    request,
  }) => {
    const project = await pick(request, SHEET);
    test.skip(!project, 'no project has three screens');
    if (!project) return;
    await open(page, project);

    await expect(page.locator('h1')).toHaveCount(1);
    const cover = page.locator('[data-case-cover]');
    await expect(cover).toHaveAttribute('href', /^https:\/\/cdn\.sanity\.io\/images\//);
    // The cover is the header's link; Screens holds every other screen.
    await expect(page.locator('[data-case-screen]')).toHaveCount(screenCount(project) - 1);
    await expect(page.getByRole('region', { name: 'Where it sits' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Screens' })).toBeVisible();
  });
});

test.describe('the viewer', () => {
  test('opens from the cover, steps round the set and gives focus back', async ({
    page,
    request,
  }) => {
    const project = await pick(request, SHEET);
    test.skip(!project, 'no project has three screens');
    if (!project) return;
    const count = screenCount(project);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, project);

    const cover = page.locator('[data-case-cover]');
    await cover.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Fig. 1 of ${count}`);
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(dialog).toContainText(`Fig. 2 of ${count}`);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(dialog).toContainText(`Fig. ${count} of ${count}`);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(cover).toBeFocused();
  });

  test('opens at the screen clicked in the contact sheet', async ({ page, request }) => {
    const project = await pick(request, SHEET);
    test.skip(!project, 'no project has three screens');
    if (!project) return;
    await open(page, project);

    const third = page.locator('[data-case-screen="3"]');
    await third.scrollIntoViewIfNeeded();
    await third.click();
    await expect(page.getByRole('dialog')).toContainText(`Fig. 3 of ${screenCount(project)}`);
  });

  test('keeps the shown thumbnail in view as it steps', async ({ page, request }) => {
    const project = await pick(request, SHEET);
    test.skip(!project, 'no project has three screens');
    if (!project) return;
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, project);

    await page.locator('[data-case-cover]').click();
    await expect(page.getByRole('dialog')).toContainText('Fig. 1 of');
    await page.keyboard.press('End');
    const strip = page.getByRole('list', { name: 'All screens' });
    const shown = strip.locator('[aria-current="true"]');
    await expect(shown).toHaveAccessibleName(/^Screen (\d+) of \1$/);
    await expect
      .poll(async () => {
        const [list, thumb] = await Promise.all([strip.boundingBox(), shown.boundingBox()]);
        if (!list || !thumb) return false;
        return thumb.x >= list.x - 1 && thumb.x + thumb.width <= list.x + list.width + 1;
      })
      .toBe(true);
  });

  test('leaves the keys to a tall capture to scroll it, and steps elsewhere', async ({
    page,
    request,
  }) => {
    const project = await pick(request, (each) => tallFigure(each) !== null);
    test.skip(!project, 'no project has a full-page capture past its cover');
    if (!project) return;
    const figure = tallFigure(project) ?? 0;
    const count = screenCount(project);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, project);

    const tile = page.locator(`[data-case-screen="${figure}"]`);
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Fig. ${figure} of ${count}`);
    const area = dialog.getByRole('region', { name: /scroll to see all of it/ });
    await area.focus();
    await page.keyboard.press('End');
    await expect.poll(() => area.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(dialog).toContainText(`Fig. ${figure} of ${count}`);
    await expect(area).toBeFocused();
    await page.keyboard.press('Home');
    await expect.poll(() => area.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(dialog).toContainText(`Fig. ${figure} of ${count}`);
    // Left and Right still step from inside it: the column never scrolls sideways.
    await page.keyboard.press('ArrowRight');
    await expect(dialog).toContainText(`Fig. ${(figure % count) + 1} of ${count}`);

    await dialog.getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('End');
    await expect(dialog).toContainText(`Fig. ${count} of ${count}`);
  });

  for (const size of [
    { name: 'a desktop', width: 1440, height: 900, touch: false },
    { name: 'a phone', width: 390, height: 844, touch: true },
  ]) {
    test(`keeps Next under the pointer from the first screen to the last on ${size.name}`, async ({
      browser,
      request,
    }) => {
      // The set whose screens differ most in shape: the hardest one to keep still.
      const project = mostShapes((await listProjects(request)).filter(SHEET));
      test.skip(!project, 'no project has three screens');
      if (!project) return;
      const count = screenCount(project);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        hasTouch: size.touch,
        isMobile: size.touch,
      });
      const page = await context.newPage();
      await open(page, project);

      await page.locator('[data-case-cover]').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(`Fig. 1 of ${count}`);
      const next = dialog.getByRole('button', { name: 'Next screen' });
      // Wait out the opening rise (a transform) before reading where Next sits.
      await page
        .locator('[data-photo-viewer]')
        .evaluate((panel) =>
          Promise.all(panel.getAnimations({ subtree: true }).map((each) => each.finished)),
        );
      const box = await next.boundingBox();
      if (!box) throw new Error('Next has no box');
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      // The same spot, clicked again and again, walks the whole set and comes round to Fig. 1.
      for (let figure = 2; figure <= count + 1; figure += 1) {
        await page.mouse.click(x, y);
        await expect(dialog).toContainText(`Fig. ${figure > count ? 1 : figure} of ${count}`);
      }
      await context.close();
    });
  }

  test('fills the phone screen, with Done to close', async ({ page, request }) => {
    const project = await pick(request, SHEET);
    test.skip(!project, 'no project has three screens');
    if (!project) return;
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, project);

    await page.locator('[data-case-cover]').click();
    const done = page.getByRole('dialog').getByRole('button', { name: 'Done' });
    await expect(done).toBeFocused();
    // The layout width, not the box mid-rise: the opening scale is a transform.
    const width = await page
      .locator('[data-photo-viewer]')
      .evaluate((panel) => [(panel as HTMLElement).offsetWidth, window.innerWidth]);
    expect(width[0]).toBe(width[1]);
    await done.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  for (const size of [
    { width: 1440, height: 900 },
    { width: 900, height: 560 },
  ]) {
    test(`centres a viewer that holds one image at ${size.width}x${size.height}`, async ({
      page,
      request,
    }) => {
      const project = await pick(request, (each) => screenCount(each) === 1);
      test.skip(!project, 'no project has a cover alone');
      if (!project) return;
      await page.setViewportSize(size);
      await open(page, project);

      await page.locator('[data-case-cover]').click();
      const panel = page.locator('[data-photo-viewer]');
      await expect(page.getByRole('dialog')).toContainText('Fig. 1');
      // Wait out the opening rise (a transform) before reading where the panel sits.
      await panel.evaluate((element) =>
        Promise.all(element.getAnimations({ subtree: true }).map((each) => each.finished)),
      );
      const box = await panel.boundingBox();
      if (!box) throw new Error('the panel has no box');
      const below = size.height - (box.y + box.height);
      // No thumbnails are reserved: as much room above it as below, however long its caption.
      expect(Math.abs(box.y - below), `${box.y}px above, ${below}px below`).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('the contact sheet', () => {
  test('keeps each row one height and never scrolls sideways', async ({ page, request }) => {
    const project = await pick(request, SHEET);
    test.skip(!project, 'no project has three screens');
    if (!project) return;
    for (const width of [1440, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page, project);
      await noSidewaysScroll(page);
      const boxes = await page
        .locator('[data-case-screen]')
        .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().toJSON()));
      const rows = new Map<number, number[]>();
      for (const box of boxes) {
        const top = Math.round(box.top);
        rows.set(top, [...(rows.get(top) ?? []), box.height]);
      }
      for (const heights of rows.values()) {
        expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2);
      }
    }
  });

  test('dims the other screens while one is pointed at', async ({ page, request }) => {
    const project = await pick(request, SHEET);
    test.skip(!project, 'no project has three screens');
    if (!project) return;
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, project);

    // Screens starts at Fig. 2: the cover is in the header.
    const first = page.locator('[data-case-screen="2"]');
    await first.scrollIntoViewIfNeeded();
    await first.hover();
    const dimOf = (n: number) =>
      page
        .locator(`[data-case-screen="${n}"]`)
        .evaluate((link) => Number(getComputedStyle(link, '::after').opacity));
    await expect.poll(() => dimOf(3)).toBeGreaterThan(0.4);
    expect(await dimOf(2)).toBe(0);
  });
});

test.describe('the shapes a project can take', () => {
  test('a project with no image is set as its description', async ({ page, request }) => {
    const project = await pick(request, (each) => screenCount(each) === 0);
    test.skip(!project, 'every project has an image');
    if (!project) return;
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, project);

    await expect(page.locator('[data-case-plate]')).toBeVisible();
    await expect(page.locator('[data-case-cover]')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Screens' })).toHaveCount(0);
    await noSidewaysScroll(page);
  });

  test('a project with two images shows the second alone, never the cover twice', async ({
    page,
    request,
  }) => {
    const project = await pick(request, (each) => screenCount(each) === 2);
    test.skip(!project, 'no project has exactly two images');
    if (!project) return;
    await open(page, project);

    const screens = page.getByRole('region', { name: 'Screens' });
    await expect(screens.getByRole('list')).toHaveAttribute('data-layout', 'single');
    await expect(screens.locator('[data-case-screen]')).toHaveCount(1);
    await expect(screens.locator('[data-case-screen="2"]')).toHaveCount(1);
    await expect(page.locator('[data-photo-viewer-index="0"]')).toHaveCount(1);
  });

  test('a project with only a cover shows it, and no Screens section', async ({
    page,
    request,
  }) => {
    const project = await pick(request, (each) => screenCount(each) === 1);
    test.skip(!project, 'no project has a cover alone');
    if (!project) return;
    await open(page, project);

    await expect(page.locator('[data-case-cover]')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Screens' })).toHaveCount(0);
  });
});

test.describe('the breadcrumb', () => {
  test('leads a Featured project to its own story in the Featured chapter', async ({
    page,
    request,
  }) => {
    const project = await pick(request, (each) => typeof each.featuredRank === 'number');
    test.skip(!project, 'no project is ranked Featured');
    if (!project) return;
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, project);

    const crumb = page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', {
      name: 'Featured',
    });
    const anchor = `story-${encodeURIComponent(project._id)}`;
    await expect(crumb).toHaveAttribute('href', `/projects#${anchor}`);
    await crumb.click();
    await expect(page).toHaveURL(new RegExp(`/projects#${anchor}$`));
    const story = page.locator(`#featured [id="story-${project._id}"]`);
    await expect(story.locator(`a[href="/projects/${project._id}"]`).first()).toBeVisible();
    // It lands on the project itself, its picture on the first screen, not a scroll away.
    await expect(story.locator('img').first()).toBeInViewport();
  });
});

test.describe('long names in the prose', () => {
  /** A long address or path inside a sentence, as case-text.ts reads one. */
  const LONG_ADDRESS = /(?<!\S)(?=\S*[./]\S)\S{13,}(?=\s+\S)/u;

  for (const width of [1440, 768, 390]) {
    test(`stay whole whenever they fit their line at ${width} px`, async ({ page, request }) => {
      const project = await pick(request, (each) => LONG_ADDRESS.test(each.description ?? ''));
      test.skip(!project, 'no description holds a long address');
      if (!project) return;
      await page.setViewportSize({ width, height: 900 });
      await open(page, project);

      // Each long name the page may wrap holds its break points: it may split across lines only
      // when its own width is more than the line it sits in.
      const splitThatFits = await page.locator('[data-project-page]').evaluate((article) =>
        [...new Set([...article.querySelectorAll('wbr')].map((wbr) => wbr.parentElement))]
          .filter((holder): holder is HTMLElement => holder !== null)
          .filter((holder) => !holder.closest('[data-case-address]'))
          .flatMap((holder) => {
            const range = document.createRange();
            range.selectNodeContents(holder);
            const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
            const lines = new Set(rects.map((rect) => Math.round(rect.top))).size;
            let block = holder.parentElement;
            while (block && getComputedStyle(block).display.startsWith('inline')) {
              block = block.parentElement;
            }
            const style = block ? getComputedStyle(block) : null;
            const line =
              block && style
                ? block.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
                : 0;
            const whole = rects.reduce((sum, rect) => sum + rect.width, 0);
            return lines > 1 && whole <= line ? [holder.textContent ?? ''] : [];
          }),
      );
      expect(splitThatFits).toEqual([]);
    });
  }
});

test.describe('the Visit address', () => {
  test('wraps only after a dot or a hyphen at 320 px with 200% text', async ({ page, request }) => {
    const project = longestAddress(await listProjects(request));
    test.skip(!project, 'no project has a live site with a dotted address');
    if (!project) return;
    await page.setViewportSize({ width: 320, height: 640 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await open(page, project);

    const address = page.locator('[data-case-link="live"] [data-case-address]');
    await expect(address).toBeVisible();
    // Where each line of the address ends: only after a dot (the <wbr>s) or a hyphen, never
    // inside a word. A character on a new line whose predecessor is a letter is a mid-word break.
    const breaks = await address.evaluate((element) => {
      const text = element.textContent ?? '';
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const tops: number[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (let at = 0; at < (node.textContent ?? '').length; at += 1) {
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + 1);
          tops.push(Math.round(range.getBoundingClientRect().top));
        }
      }
      return tops.flatMap((top, at) =>
        at > 0 && top > (tops[at - 1] ?? top) ? [text[at - 1]] : [],
      );
    });
    for (const before of breaks) expect(before, `a line ends after '${before}'`).toMatch(/[.-]/);
    await noSidewaysScroll(page);
  });
});

test.describe('the way on', () => {
  test('a neighbour leads to its own page', async ({ page, request }) => {
    const project = await pick(request, SHEET);
    test.skip(!project, 'no project has three screens');
    if (!project) return;
    await open(page, project);

    const neighbour = page.locator('[data-case-neighbour]').first();
    const href = await neighbour.getAttribute('href');
    expect(href).toMatch(/^\/projects\/[^/]+$/);
    await neighbour.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('h1')).not.toHaveText(project.title);
  });

  test('Built with filters the projects by technology', async ({ page, request }) => {
    const project = await pick(request, SHEET);
    test.skip(!project, 'no project has three screens');
    if (!project) return;
    await open(page, project);

    const tech = page.getByRole('region', { name: 'Built with' }).getByRole('link').first();
    await expect(tech).toHaveAttribute('href', /^\/projects\?tech=/);
  });
});

test.describe('hyphenated names in Built with', () => {
  /** A name of two words or more, one of them hyphenated ('Google Speech-to-Text'). */
  const HYPHENATED = /\s/u;
  const hasHyphenated = (project: ApiProject): boolean =>
    (project.technologies ?? []).some(
      (tech) => HYPHENATED.test(tech.trim()) && /\S-\S/u.test(tech),
    );

  for (const size of [
    { width: 390, height: 844, touch: true },
    { width: 768, height: 1024, touch: true },
    { width: 1440, height: 900, touch: false },
  ]) {
    test(`stay whole whenever they fit their column at ${size.width} px`, async ({
      browser,
      request,
    }) => {
      const project = await pick(request, hasHyphenated);
      test.skip(!project, 'no technology name holds a hyphenated word');
      if (!project) return;
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        hasTouch: size.touch,
        isMobile: size.touch,
      });
      const page = await context.newPage();
      await open(page, project);

      // A hyphenated word ('Speech-to-Text') split over two lines though it was no wider than
      // its column, however the name's text is cut into nodes.
      const splitThatFits = await page
        .getByRole('region', { name: 'Built with' })
        .getByRole('link')
        .evaluateAll((links) =>
          links.flatMap((link) => {
            const column = (link.parentElement as HTMLElement).clientWidth;
            const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
            const found: string[] = [];
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const text = node as Text;
              for (const word of text.data.matchAll(/\S*\S-\S\S*/gu)) {
                const range = document.createRange();
                range.setStart(text, word.index);
                range.setEnd(text, word.index + word[0].length);
                const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
                const lines = new Set(rects.map((rect) => Math.round(rect.top))).size;
                const whole = rects.reduce((sum, rect) => sum + rect.width, 0);
                if (lines > 1 && whole <= column) found.push(word[0]);
              }
            }
            return found;
          }),
        );
      expect(splitThatFits).toEqual([]);
      await context.close();
    });
  }
});

test.describe('the narrow layout', () => {
  /** A long description with a word of 14 letters or more, which may meet the column's edge. */
  const LONG_WORD = /\p{L}{14,}/u;

  test('hyphenates long words only at 320 px with 200% text, never a long address', async ({
    page,
    request,
  }) => {
    const project = await pick(request, (each) => LONG_WORD.test(each.longDescription ?? ''));
    test.skip(!project, 'no long description holds a word of 14 letters');
    if (!project) return;
    const hyphensOf = () =>
      page.locator('[data-case-section="about"]').evaluate((section) => ({
        prose: [...section.querySelectorAll('p, li')].map(
          (block) => getComputedStyle(block).hyphens,
        ),
        addresses: [...section.querySelectorAll('span')].map(
          (span) => getComputedStyle(span).hyphens,
        ),
      }));

    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, project);
    const wide = await hyphensOf();
    expect(new Set(wide.prose)).toEqual(new Set(['manual']));

    await page.setViewportSize({ width: 320, height: 640 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await open(page, project);
    const narrow = await hyphensOf();
    expect(new Set(narrow.prose)).toEqual(new Set(['auto']));
    // A long address or path keeps its own breaks at its dots and slashes, never a hyphen.
    for (const value of narrow.addresses) expect(value).toBe('manual');
    await noSidewaysScroll(page);
  });
});

test.describe('how a multi-repository project fits together', () => {
  const PARTS_TITLE = 'How it fits together';
  /** A touch target's least height: 2.75rem at the default 16px text. */
  const TOUCH_PX = 44;
  /** Sub-pixel rounding in a box's measured height. */
  const ROUNDING_PX = 0.5;

  /** The project with the most parts among `projects`, or null. */
  const mostParts = (projects: readonly ApiProject[]): ApiProject | null =>
    projects.reduce<ApiProject | null>(
      (best, each) =>
        shownParts(each).length > (best ? shownParts(best).length : 0) ? each : best,
      null,
    );

  /**
   * The project whose section has the most to check: one with a private part when any has (so
   * the private rows are checked whenever the data holds one), then the one with the most parts.
   */
  async function fullestParts(request: APIRequestContext): Promise<ApiProject | null> {
    const withParts = (await listPartsProjects<ApiProject>(request)).filter(hasParts);
    return (
      mostParts(withParts.filter((each) => shownParts(each).some(isPrivatePart))) ??
      mostParts(withParts)
    );
  }

  /** A new context at `size`, as a phone under a finger when `touch`. */
  const contextAt = (browser: Browser, size: { width: number; height: number; touch: boolean }) =>
    browser.newContext({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch,
    });

  for (const size of [
    { width: 1440, height: 900, touch: false },
    { width: 375, height: 812, touch: true },
  ]) {
    test(`shows one heading per part, in order, and links no private part at ${size.width} px`, async ({
      browser,
      request,
    }) => {
      const project = await fullestParts(request);
      test.skip(!project, 'no project has two or more parts yet');
      if (!project) return;
      const parts = shownParts(project);
      const context = await contextAt(browser, size);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await open(page, project);

        const section = page.getByRole('region', { name: PARTS_TITLE });
        await section.scrollIntoViewIfNeeded();
        await expect(section).toBeVisible();
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(section.locator('ul[data-case-parts] > li')).toHaveCount(parts.length);
        // Each name once, in Studio order (a linked name's arrow is hidden from the name).
        const names = (await section.locator('h3').allTextContents()).map((text) =>
          oneLine(text.replace('→', '')),
        );
        expect(names).toEqual(parts.map((part) => oneLine(String(part.name))));
        for (const part of parts.filter(isPrivatePart)) {
          const row = section.locator(partRow(part));
          await expect(row).toContainText('Private repository');
          await expect(row.locator('a')).toHaveCount(0);
        }
        // Between The project and Screens, and before Built with.
        const order = await page
          .locator('[data-case-section]')
          .evaluateAll((sections) =>
            sections.map((each) => each.getAttribute('data-case-section') ?? ''),
          );
        const at = order.indexOf('parts');
        expect(at).toBeGreaterThan(order.indexOf('about'));
        for (const later of ['screens', 'built-with'].filter((name) => order.includes(name))) {
          expect(order.indexOf(later), later).toBeGreaterThan(at);
        }
        await noSidewaysScroll(page);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }

  test('a repository link is at least 44 px tall under a finger', async ({ browser, request }) => {
    const project =
      (await listPartsProjects<ApiProject>(request)).find((each) =>
        shownParts(each).some((part) => filled(part.repoUrl)),
      ) ?? null;
    test.skip(!project, 'no project with parts links a public repository yet');
    if (!project) return;
    const context = await contextAt(browser, { width: 375, height: 812, touch: true });
    const page = await context.newPage();
    try {
      await open(page, project);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);

      const links = page
        .getByRole('region', { name: PARTS_TITLE })
        .locator('[data-case-part-link="repo"]');
      expect(await links.count()).toBeGreaterThan(0);
      const heights = await links.evaluateAll((each) =>
        each.map((link) => link.getBoundingClientRect().height),
      );
      for (const height of heights) expect(height).toBeGreaterThanOrEqual(TOUCH_PX - ROUNDING_PX);
    } finally {
      await context.close();
    }
  });

  test('a part with its own page leads there from its name', async ({ page, request }) => {
    const projects = await listPartsProjects<ApiProject>(request);
    const listed = new Set(projects.map(({ _id }) => _id));
    const linkedPart = (project: ApiProject): ApiPart | undefined =>
      shownParts(project).find(
        (part) =>
          filled(part.projectId) &&
          part.projectId.trim() !== project._id &&
          listed.has(part.projectId.trim()),
      );
    const project = projects.find((each) => linkedPart(each)) ?? null;
    test.skip(!project, 'no part links another project’s page yet');
    if (!project) return;
    const target = `/projects/${encodeURIComponent(String(linkedPart(project)?.projectId).trim())}`;
    await open(page, project);

    const name = page
      .getByRole('region', { name: PARTS_TITLE })
      .locator(`h3 a[data-case-part-link="page"][href="${target}"]`);
    await expect(name).toHaveCount(1);
    await name.click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.locator('h1')).not.toHaveText(project.title);
  });

  test('never scrolls sideways at 320 px with 200% text', async ({
    page,
    request,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'the browser text size is set through Chromium’s CDP');
    const project = await fullestParts(request);
    test.skip(!project, 'no project has two or more parts yet');
    if (!project) return;
    await page.setViewportSize({ width: 320, height: 640 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    await open(page, project);

    const section = page.getByRole('region', { name: PARTS_TITLE });
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
    await noSidewaysScroll(page);
    const past = await section.evaluate((root) =>
      [...root.querySelectorAll('*')]
        .filter((each) => each.getBoundingClientRect().right > window.innerWidth + 1)
        .map((each) => (each.textContent ?? '').trim().slice(0, 40)),
    );
    expect(past, 'past the window’s right edge').toEqual([]);
  });

  test('a project with fewer than two parts has no such section', async ({ page, request }) => {
    const project = (await listPartsProjects<ApiProject>(request)).find((each) => !hasParts(each));
    test.skip(!project, 'every project has parts');
    if (!project) return;
    await open(page, project);

    await expect(page.locator('[data-case-section="parts"]')).toHaveCount(0);
    await expect(page.getByRole('region', { name: PARTS_TITLE })).toHaveCount(0);
  });
});
