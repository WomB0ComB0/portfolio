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

import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  expectExternalLinks,
  expectNoOverflow,
  expectRowsOrState,
  expectSettled,
  openConsolePage,
  readOnly,
} from '../fixtures/console-routes';

const EMPTY = 'Nothing published yet';
/** A topic slug no hand-written topic can have by accident. */
const NO_TOPIC = 'zz-no-such-topic-918273';
const NO_MATCH = 'zz-unmatched-portfolio-feed-918273';
/** The kinds in section order (media-feed.ts FEED_KINDS): the order the sections must follow. */
const SECTION_ORDER = ['post', 'article', 'video', 'stream', 'talk', 'presentation'];
/**
 * A search that finds part of a series on today's feed (two "(Part n/2)" uploads of the 27-upload
 * marathon): a series links only from a list that holds part of it.
 */
const PART_SEARCH = 'part';

test.beforeEach(async ({ page }) => readOnly(page));

for (const javaScriptEnabled of [false, true]) {
  test.describe(`Media feed, JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, () => {
    test.use({ javaScriptEnabled });

    test('shows the feed as rows rather than tabs, with source states when empty', async ({
      page,
    }) => {
      const main = await openConsolePage(page, '/media', 'Media');
      await expectSettled(main);
      await expect(main.getByRole('tablist')).toHaveCount(0);
      const rows = main.locator('[data-feed-row]');
      if (!(await expectRowsOrState(rows, main.getByRole('heading', { name: EMPTY, exact: true }))))
        return;
      await expect(
        main.getByRole('searchbox', { name: 'Search items', exact: true }),
      ).toBeVisible();
      await expect(rows.first().locator('[data-feed-title]')).not.toBeEmpty();
      await expectExternalLinks(main);
    });

    test('lists every row in the section of its own kind, sections in kind order', async ({
      page,
    }) => {
      const main = await openConsolePage(page, '/media', 'Media');
      const rows = main.locator('[data-feed-row]');
      if (!(await expectRowsOrState(rows, main.getByRole('heading', { name: EMPTY, exact: true }))))
        return;
      const sections = await main.locator('[data-index-part="group"]').evaluateAll((groups) =>
        groups.map((group) => ({
          id: group.querySelector('h2')?.id ?? '',
          kinds: [
            ...new Set(
              Array.from(
                group.querySelectorAll('[data-feed-row]'),
                (row) => row.getAttribute('data-kind') ?? '',
              ),
            ),
          ],
        })),
      );
      expect(sections.length).toBeGreaterThan(0);
      // Each section holds rows of one kind only, the kind its heading's id names.
      for (const section of sections) {
        expect(section.kinds).toEqual([section.id.replace('media-', '')]);
      }
      const order = sections.map((section) => SECTION_ORDER.indexOf(section.kinds[0] ?? ''));
      expect(order).not.toContain(-1);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      // Every row is in a section, and no upload is folded away.
      expect(await main.locator('[data-index-part="group"] [data-feed-row]').count()).toBe(
        await rows.count(),
      );
      await expect(main.locator('[data-feed-parts]')).toHaveCount(0);
    });

    test('shows one series, first part first, from a row and restores the list', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const full = await openConsolePage(page, '/media', 'Media');
      const fullRows = full.locator('[data-feed-row]');
      if (
        !(await expectRowsOrState(
          fullRows,
          full.getByRole('heading', { name: EMPTY, exact: true }),
        ))
      )
        return;
      const fullCount = await fullRows.count();
      // The full list holds every upload of each series, so none links its series: the link would
      // show the same rows again. A search that finds part of one does.
      await expect(full.locator('a[data-feed-series]')).toHaveCount(0);
      const main = await openConsolePage(page, `/media?q=${PART_SEARCH}`, 'Media');
      const rows = main.locator('[data-feed-row]');
      const all = await rows.count();
      const link = main.locator('a[data-feed-series]').first();
      // A feed where no search finds part of a series has nothing to follow.
      if (!(await link.count())) return;
      const series = await link.locator('xpath=ancestor::tr').getAttribute('data-series');
      expect(series).toBeTruthy();
      // Rows of a series the search finds whole say their place as text.
      const places = await main.locator('[data-feed-series-place]').count();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`[?&]series=${series}(?:&|$)`));
      await expect(main.locator(`[data-feed-row]:not([data-series="${series}"])`)).toHaveCount(0);
      // Inside the series a row says its place as text: a link would lead to this same list.
      await expect(rows.first().locator('[data-feed-series-place]')).toContainText(' 1 of ');
      await expect(main.locator('a[data-feed-series]')).toHaveCount(0);
      const inSeries = await rows.count();
      expect(inSeries).toBeGreaterThan(1);
      await expect(main.locator('[data-feed-series-place]')).toHaveCount(inSeries);
      const token = main.locator('a[data-filter-part="token"]');
      await expect(token).toContainText('Series:');
      await expect(token).toBeInViewport();
      // Following the link was one step: Back returns to the search, Forward to the series.
      await page.goBack();
      await expect(page).not.toHaveURL(/[?&]series=/);
      await expect(rows).toHaveCount(all);
      await expect(main.locator('[data-feed-series-place]')).toHaveCount(places);
      await page.goForward();
      await expect(page).toHaveURL(new RegExp(`[?&]series=${series}(?:&|$)`));
      await expect(rows).toHaveCount(inSeries);
      await main.getByRole('link', { name: 'Clear all', exact: true }).click();
      await expect(page).not.toHaveURL(/[?&]series=/);
      await expect(rows).toHaveCount(fullCount);
    });

    test('follows a series link in place: the list is not fetched again', async ({ page }) => {
      test.skip(!javaScriptEnabled, 'Without JavaScript the link is a page load, by design.');
      await page.setViewportSize({ width: 1440, height: 900 });
      const main = await openConsolePage(page, `/media?q=${PART_SEARCH}`, 'Media');
      const link = main.locator('a[data-feed-series]').first();
      if (!(await link.count())) return;
      const series = await link.locator('xpath=ancestor::tr').getAttribute('data-series');
      const fetched: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname === '/media' && request.resourceType() !== 'image')
          fetched.push(url.search);
      });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`[?&]series=${series}(?:&|$)`));
      await expect(main.locator(`[data-feed-row]:not([data-series="${series}"])`)).toHaveCount(0);
      // Focus is on the first row of the series, not lost with the link that is gone.
      await expect(main.locator('[data-feed-row] a[data-feed-title]').first()).toBeFocused();
      expect(fetched).toEqual([]);
    });

    test('links a post and its video to each other safely, when the feed holds a pair', async ({
      page,
    }) => {
      const main = await openConsolePage(page, '/media', 'Media');
      const pairs = main.locator('a[data-feed-pair]');
      // No pair is the usual state: the reference appears only for a real one.
      if (!(await pairs.count())) {
        await expect(main.getByText(/Video version|Written version/)).toHaveCount(0);
        return;
      }
      await expectExternalLinks(main);
      for (const pair of await pairs.all()) {
        await expect(pair).toHaveAccessibleName(/^(Video|Written) version: .+/);
        // A reference sits on a row of the other medium than the piece it points at.
        const own = await pair.locator('xpath=ancestor::tr').getAttribute('data-kind');
        const other = await pair.getAttribute('data-feed-pair');
        const written = (kind: string | null): boolean => kind === 'post' || kind === 'article';
        expect(written(own)).not.toBe(written(other));
      }
    });

    test('gives a row that points somewhere one “See also” list of links that look like links', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const main = await openConsolePage(page, '/media', 'Media');
      const lines = main.locator('[data-feed-row] [data-feed-see-also]');
      // A feed with no series, pair, project or topic has no line anywhere.
      if (!(await lines.count())) return;
      // One line a row at most, and each one of each relation at most (topics: three).
      expect(await main.locator('[data-feed-row]:has([data-feed-see-also])').count()).toBe(
        await lines.count(),
      );
      for (const line of await lines.all()) {
        await expect(line).toHaveRole('list');
        await expect(line).toHaveAccessibleName('See also');
        // The words stand before the list, not in it: every item of the list is a reference.
        await expect(line.locator('xpath=preceding-sibling::*[1]')).toHaveText('See also');
        await expect(line.locator('[data-feed-see-lead]')).toHaveCount(0);
        expect(await line.locator('a[data-feed-pair]').count()).toBeLessThanOrEqual(1);
        expect(await line.locator('a[data-feed-series]').count()).toBeLessThanOrEqual(1);
        expect(await line.locator('a[data-feed-project]').count()).toBeLessThanOrEqual(1);
        expect(await line.locator('a[data-feed-topic]').count()).toBeLessThanOrEqual(3);
      }
      const looks = await lines.locator('a').evaluateAll((links) => {
        const summary = document.querySelector('[data-feed-summary], [data-feed-row] time');
        const quiet = summary ? getComputedStyle(summary).color : '';
        return links.map((link) => {
          const words = link.querySelector('span:not(.sr-only)') ?? link;
          return {
            text: link.textContent ?? '',
            href: link.getAttribute('href') ?? '',
            underlined: getComputedStyle(words).textDecorationLine.includes('underline'),
            sameAsQuietText: getComputedStyle(link).color === quiet,
            height: link.getBoundingClientRect().height,
          };
        });
      });
      expect(looks.length).toBeGreaterThan(0);
      for (const look of looks) {
        expect(look.href, look.text).not.toBe('');
        expect(look.underlined, look.text).toBe(true);
        expect(look.sameAsQuietText, look.text).toBe(false);
        expect(look.height, look.text).toBeGreaterThanOrEqual(24);
      }
      await expectExternalLinks(main);
    });

    test('lists a long series as its newest uploads with a real link to all of them', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const main = await openConsolePage(page, '/media', 'Media');
      const more = main.locator('[data-feed-more]').first();
      // Only a series of many uploads is cut short.
      if (!(await more.count())) return;
      const rows = main.locator('[data-feed-row]');
      const series = await more.getAttribute('data-feed-more');
      const shown = await main.locator(`[data-feed-row][data-series="${series}"]`).count();
      const link = more.locator('a[data-feed-more-link]');
      const total = Number((await link.textContent())?.match(/Show all (\d+)/)?.[1]);
      const before = await rows.count();
      expect(shown).toBeGreaterThan(0);
      expect(total).toBeGreaterThan(shown);
      await expect(more).toContainText(`${total - shown} earlier uploads`);
      // Read alone, the link names the series it opens, and it is the section's one link to it:
      // the rows above it say their place as text.
      await expect(link).toHaveText(/^Show all \d+ uploads of \S.+$/);
      const listedRows = main.locator(`[data-feed-row][data-series="${series}"]`);
      await expect(listedRows.locator('a[data-feed-series]')).toHaveCount(0);
      await expect(listedRows.locator('[data-feed-series-place]')).toHaveCount(shown);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`[?&]series=${series}(?:&|$)`));
      await expect(rows).toHaveCount(total);
      await expect(main.locator('[data-feed-more]')).toHaveCount(0);
      await main.getByRole('link', { name: 'Clear all', exact: true }).click();
      await expect(rows).toHaveCount(before);
      // The kind's own view lists every upload too.
      const kind = await main
        .locator(`[data-feed-row][data-series="${series}"]`)
        .first()
        .getAttribute('data-kind');
      await page.goto(`${page.url().split('?')[0]}?kind=${kind}`);
      const listed = main.locator(`[data-feed-row][data-series="${series}"]`);
      await expect(listed).toHaveCount(total);
      // The kind lists the series whole, beside other rows or not: a link would open these same
      // rows, so every row says its place as text.
      await expect(listed.locator('a[data-feed-series]')).toHaveCount(0);
      await expect(listed.locator('[data-feed-series-place]')).toHaveCount(total);
    });

    test('links a row to its project on this site, and the project page back to the piece', async ({
      page,
    }) => {
      const main = await openConsolePage(page, '/media', 'Media');
      const link = main.locator('a[data-feed-project]').first();
      // A relation needs evidence: with none in the feed, no row names a project.
      if (!(await link.count())) return;
      await expect(main.locator('[data-feed-proposed]')).toHaveCount(0);
      await expect(link).toHaveAccessibleName(/^Project: .+/);
      await expect(link).not.toHaveAttribute('target', '_blank');
      const href = await link.getAttribute('href');
      expect(href).toMatch(/^\/projects\/[\w.-]+$/);
      const piece = await link
        .locator('xpath=ancestor::tr')
        .locator('a[data-feed-title]')
        .getAttribute('href');
      expect(piece).toMatch(/^https?:\/\//);
      const response = await page.goto(new URL(href ?? '', page.url()).toString());
      expect(response?.status()).toBe(200);
      const block = page.locator('main#main-content [data-project-media]');
      await expect(block).toBeVisible();
      await expect(block.getByRole('heading', { name: 'See also', exact: true })).toBeVisible();
      const back = block.locator(`a[href="${piece}"]`);
      await expect(back).toHaveAccessibleName(/^(Video|Stream|Post|Article): .+/);
      await expect(back).toHaveAttribute('rel', /noopener/);
      await expect(block.locator('a[href="/media"]')).toBeVisible();
      await expect(page.locator('main#main-content h1')).toHaveCount(1);
      // The block sits with the project's own sections: "Back to all projects" comes after it,
      // in the document and on the page, and stays the page's last link.
      const lastLink = page.locator('main#main-content a').last();
      await expect(lastLink).toHaveAccessibleName('Back to all projects');
      const blockBox = await block.boundingBox();
      const lastBox = await lastLink.boundingBox();
      expect(lastBox?.y ?? 0).toBeGreaterThanOrEqual((blockBox?.y ?? 0) + (blockBox?.height ?? 0));
    });

    test('reads an unknown topic as no filter and keeps /media the canonical address', async ({
      page,
    }) => {
      const main = await openConsolePage(page, '/media', 'Media');
      const all = await main.locator('[data-feed-row]').count();
      await openConsolePage(page, `/media?topic=${NO_TOPIC}`, 'Media');
      await expect(main.locator('[data-feed-row]')).toHaveCount(all);
      await expect(main.locator('a[data-filter-part="token"]')).toHaveCount(0);
      expect(
        new URL((await page.locator('link[rel="canonical"]').getAttribute('href')) ?? '').pathname,
      ).toBe('/media');
      // Topics are hand-written: a row's topic link, where one exists, stays on this page.
      for (const topic of await main.locator('a[data-feed-topic]').all()) {
        expect(await topic.getAttribute('href')).toMatch(/^\/media\?topic=[a-z0-9-]+$/);
      }
    });

    test('filters by kind from a chip and preserves it on reload', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const main = await openConsolePage(page, '/media', 'Media');
      const rows = main.locator('[data-feed-row]');
      if (!(await expectRowsOrState(rows, main.getByRole('heading', { name: EMPTY, exact: true }))))
        return;
      const chip = main.locator('[data-chip]:not([data-chip="all"])').first();
      const kind = await chip.getAttribute('data-chip');
      expect(kind).toBeTruthy();
      await chip.click();
      await expect(page).toHaveURL(new RegExp(`[?&]kind=${kind}(?:&|$)`));
      await expect(main.locator(`[data-feed-row]:not([data-kind="${kind}"])`)).toHaveCount(0);
      await expect(main.locator(`[data-chip="${kind}"]`)).toHaveAttribute('aria-current', 'true');
      // A chip narrows the page to the section of the same name.
      await expect(main.locator('[data-index-part="group"]')).toHaveCount(1);
      await expect(main.locator(`#media-${kind}`)).toBeVisible();
      await page.reload();
      await expect(main.locator(`[data-feed-row][data-kind="${kind}"]`).first()).toBeVisible();
      await expect(main.locator(`[data-feed-row]:not([data-kind="${kind}"])`)).toHaveCount(0);
      await expect(main.locator('[data-index-part="group"]')).toHaveCount(1);
    });

    test('searches through the URL and shows the explicit no-match state', async ({ page }) => {
      const main = await openConsolePage(page, '/media', 'Media');
      const rows = main.locator('[data-feed-row]');
      if (!(await expectRowsOrState(rows, main.getByRole('heading', { name: EMPTY, exact: true }))))
        return;
      const search = main.getByRole('searchbox', { name: 'Search items', exact: true });
      await search.fill(NO_MATCH);
      await search.press('Enter');
      await expect(page).toHaveURL(new RegExp(`[?&]q=${NO_MATCH}(?:&|$)`));
      await expect(rows).toHaveCount(0);
      await expect(main.locator('[data-filter-part="results"] [data-state="empty"]')).toBeVisible();
      await page.reload();
      await expect(search).toHaveValue(NO_MATCH);
      await expect(rows).toHaveCount(0);
    });

    test('redirects an old tab link to the new kind query', async ({ page }) => {
      const main = await openConsolePage(page, '/media?tab=blog', 'Media');
      await expect(page).toHaveURL(/\/media\?kind=post$/);
      if (await main.locator('[data-chip="post"]').count()) {
        await expect(main.locator('[data-feed-row]:not([data-kind="post"])')).toHaveCount(0);
        await expect(main.locator('[data-chip="post"]')).toHaveAttribute('aria-current', 'true');
      } else if (await main.locator('[data-chip="all"]').count()) {
        // A kind absent from this dataset is not offered and resolves to no filter.
        await expect(main.locator('[data-chip="all"]')).toHaveAttribute('aria-current', 'true');
      } else {
        await expect(main.getByRole('heading', { name: EMPTY, exact: true })).toBeVisible();
      }
    });

    for (const width of [320, 390, 768, 1024, 1440]) {
      test(`fits the feed at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openConsolePage(page, '/media', 'Media');
        await expectNoOverflow(page);
      });
    }

    test('gives every row room at 768px: nothing touches the rows around it', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      const main = await openConsolePage(page, '/media', 'Media');
      const rooms = await main.locator('[data-feed-row]').evaluateAll((rows) =>
        rows.map((row) => {
          const box = row.getBoundingClientRect();
          const parts = Array.from(
            row.querySelectorAll(
              '[data-feed-title], [data-feed-summary], [data-feed-see-also], [data-feed-series-place]',
            ),
            (part) => part.getBoundingClientRect(),
          ).filter((part) => part.height > 0);
          const top = Math.min(...parts.map((part) => part.top));
          const bottom = Math.max(...parts.map((part) => part.bottom));
          return Math.round(Math.min(top - box.top, box.bottom - bottom));
        }),
      );
      // Last round a two-line title over a reference filled the whole row: 0px above and below.
      for (const room of rooms) expect(room).toBeGreaterThanOrEqual(6);
    });

    for (const width of [320, 390, 768, 1440]) {
      test(`never leaves the words “See also” alone on a line at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        const main = await openConsolePage(page, '/media', 'Media');
        const leads = await main.locator('[data-feed-see-lead]').evaluateAll((words) =>
          words.map((lead) => {
            const box = lead.getBoundingClientRect();
            const list = lead.nextElementSibling?.getBoundingClientRect();
            const first = lead.nextElementSibling?.querySelector('a')?.getBoundingClientRect();
            return {
              shown: box.width > 0,
              // The list starts on the words' own line, to their right.
              beside: !!list && Math.abs(list.top - box.top) < 2 && list.left >= box.right,
              firstOnLine: !!first && first.top < box.bottom && first.bottom > box.top,
            };
          }),
        );
        // A feed where no row points anywhere has no line.
        if (leads.length === 0) return;
        for (const lead of leads) {
          // A phone leaves the words out: each reference names itself ("Project:", "Series:").
          if (width < 640) expect(lead.shown).toBe(false);
          else expect(lead).toEqual({ shown: true, beside: true, firstOnLine: true });
        }
      });
    }

    for (const width of [320, 390, 768]) {
      test(`shows every title whole at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        const main = await openConsolePage(page, '/media', 'Media');
        const cut = await main.locator('[data-feed-title]').evaluateAll((titles) =>
          titles
            .map((title) => (title.matches('a') ? (title.querySelector('span') ?? title) : title))
            .filter(
              (text) =>
                text.scrollHeight > text.clientHeight + 1 ||
                text.scrollWidth > text.clientWidth + 1,
            )
            .map((text) => text.textContent),
        );
        expect(cut).toEqual([]);
      });
    }

    test('describes itself to a search engine by what it holds', async ({ page }) => {
      await openConsolePage(page, '/media', 'Media');
      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute(
        'content',
        'Writing, videos and streams on technology and software, newest first.',
      );
    });

    for (const width of [320, 390]) {
      test(`ends a wrapped “See also” link on a project page with its new-tab arrow at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        const main = await openConsolePage(page, '/media', 'Media');
        const project = main.locator('a[data-feed-project]').first();
        // With no project named in the feed there is no project page block to look at.
        if (!(await project.count())) return;
        const href = (await project.getAttribute('href')) ?? '';
        await page.goto(new URL(href, page.url()).toString());
        const links = page.locator('main#main-content [data-project-media] a[target="_blank"]');
        await expect(links.first()).toBeVisible();
        const arrows = await links.evaluateAll((items) =>
          items.map((link) => {
            const words = link.querySelector('span > span');
            const arrow = link.querySelector('[data-new-tab-arrow] svg')?.getBoundingClientRect();
            const lines = Array.from(words?.getClientRects() ?? []);
            const last = lines.at(-1);
            if (!arrow || !last) return 'no arrow or no words';
            const middle = arrow.top + arrow.height / 2;
            // On the last line of the words, right after its last word, not beside all the lines.
            const onLastLine = middle > last.top && middle < last.bottom;
            const afterLastWord = arrow.left >= last.right - 1 && arrow.left - last.right < 8;
            return onLastLine && afterLastWord ? 'follows' : `floats (${lines.length} lines)`;
          }),
        );
        expect(arrows.length).toBeGreaterThan(0);
        expect(arrows.filter((arrow) => arrow !== 'follows')).toEqual([]);
      });
    }

    test('keeps a focused reference’s ring clear of the line above it', async ({ page }) => {
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const main = await openConsolePage(page, '/media', 'Media');
        const reference = main.locator('ul[data-feed-see-also] a').first();
        // Only a row that points somewhere has a reference.
        if (!(await reference.count())) return;
        const reach = await reference.evaluate((link) => {
          (link as HTMLElement).focus({ preventScroll: true });
          const ring = getComputedStyle(link, '::before');
          const own = getComputedStyle(link);
          const drawn = own.outlineStyle === 'none' ? ring : own;
          const top =
            link.getBoundingClientRect().top -
            Number.parseFloat(drawn.outlineWidth) -
            (drawn === own ? Number.parseFloat(own.outlineOffset) : 0);
          // The line above: the nearest box before the "see also" line that shows (the summary
          // from a 40rem page, the meta line on a phone; the other of the two is not rendered).
          let above = link.closest('ul')?.parentElement?.previousElementSibling ?? null;
          while (above && above.getBoundingClientRect().height === 0) {
            above = above.previousElementSibling;
          }
          const bottom = above?.getBoundingClientRect().bottom ?? Number.NaN;
          return { style: drawn.outlineStyle, clear: Math.round((top - bottom) * 10) / 10 };
        });
        expect(reach.style, `a ring is drawn at ${width}px`).toBe('solid');
        expect(
          reach.clear,
          `the ring ends under the line above at ${width}px`,
        ).toBeGreaterThanOrEqual(-0.5);
      }
    });
  });
}

/** Two frames: a change, its scroll and its crossfade's first frame have painted. */
const twoFrames = (page: Page): Promise<unknown> =>
  page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );

/** The filter island has run its effects: the chip row's pill is placed (FilterBar.Chips). */
const hydrated = (main: Locator): Promise<void> =>
  expect(main.locator('[data-filter-part="chips"][data-pill="on"]').first()).toBeAttached();

/** Presses an element at its centre, as a pointer does: a locator's click scrolls it first. */
async function pressAt(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('nothing to press');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Scrolls at once and lets the scroll event land. */
async function scrollPage(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
  await twoFrames(page);
}

/** The scroll position and the results header against the bar, once any crossfade is over. */
async function landed(page: Page, main: Locator) {
  await expect(page.locator('html[data-filter-transition]')).toHaveCount(0);
  await twoFrames(page);
  return main.evaluate((root) => {
    const bar = root.querySelector('[data-filter-part="bar"]')?.getBoundingClientRect();
    const count = root.querySelector('[data-filter-part="count"]')?.getBoundingClientRect();
    return {
      y: Math.round(window.scrollY),
      headWhole: !!bar && !!count && count.top >= bar.bottom - 1,
    };
  });
}

// Without a view transition the change applies in the click's own task, and the browser's scroll
// anchoring used to move the page on its own (174 to 249 with the header hidden; All to the very
// top on /certifications). Reduced motion must land exactly where motion lands.
test.describe('Media feed: a filter change lands in one place, with motion or without', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** Where `act` leaves the page after `setup`, under one motion setting. */
  async function landing(
    page: Page,
    reducedMotion: 'reduce' | 'no-preference',
    setup: (main: Locator) => Promise<void>,
    act: (main: Locator) => Promise<void>,
  ) {
    await page.emulateMedia({ reducedMotion });
    const main = await openConsolePage(page, '/media', 'Media');
    await hydrated(main);
    await setup(main);
    await act(main);
    return landed(page, main);
  }

  const video = (main: Locator): Locator =>
    main.locator('[data-filter-part="bar"] a[data-chip="video"]');
  const all = (main: Locator): Locator =>
    main.locator('[data-filter-part="bar"] a[data-chip="all"]');
  /** Where a part of the page starts in the document. */
  const docTop = (main: Locator, selector: string): Promise<number> =>
    main.evaluate(
      (root, part) => (root.querySelector(part)?.getBoundingClientRect().top ?? 0) + window.scrollY,
      selector,
    );

  test('a chip pressed with the header in view moves nothing', async ({ page }) => {
    const ends = [];
    for (const motion of ['no-preference', 'reduce'] as const) {
      let start = 0;
      const end = await landing(
        page,
        motion,
        async (main) => {
          // The bar not yet stuck, 15px below the top, and the count in view under it.
          start = Math.round((await docTop(main, '[data-filter-part="bar"]')) - 15);
          await scrollPage(page, start);
        },
        (main) => pressAt(page, video(main)),
      );
      expect(end.y, `${motion}: the page stays put`).toBe(start);
      ends.push(end);
    }
    expect(ends[1]).toEqual(ends[0]);
  });

  test('a chip pressed with the header half under the bar shows it whole', async ({ page }) => {
    const ends = [];
    for (const motion of ['no-preference', 'reduce'] as const) {
      const end = await landing(
        page,
        motion,
        async (main) => {
          const bar = await main.locator('[data-filter-part="bar"]').boundingBox();
          const count = await docTop(main, '[data-filter-part="count"]');
          // The stuck bar's edge 9px into the count.
          await scrollPage(page, Math.round(count - (bar?.height ?? 68) + 9));
        },
        (main) => pressAt(page, video(main)),
      );
      expect(end.headWhole, `${motion}: the header shows whole`).toBe(true);
      ends.push(end);
    }
    expect(ends[1]).toEqual(ends[0]);
  });

  test('All, from deep in a filtered list, lands on the results’ top', async ({ page }) => {
    const ends = [];
    for (const motion of ['no-preference', 'reduce'] as const) {
      let filtered = 0;
      const end = await landing(
        page,
        motion,
        async (main) => {
          await scrollPage(page, 700);
          await pressAt(page, video(main));
          filtered = (await landed(page, main)).y;
          await scrollPage(page, filtered + 300);
        },
        (main) => pressAt(page, all(main)),
      );
      expect(end.y, `${motion}: back on the list's top, not thrown to the page's`).toBe(filtered);
      ends.push(end);
    }
    expect(ends[1]).toEqual(ends[0]);
  });

  // html's scroll-padding kept focus clear of the top band, and the stuck bar sits inside it: the
  // browser scrolled the page 75px after every keystroke to bring the caret below the padding.
  for (const width of [390, 1440]) {
    test(`typing in the stuck search never moves the page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const main = await openConsolePage(page, '/media', 'Media');
      await hydrated(main);
      await scrollPage(page, 700);
      const search = main.getByRole('searchbox', { name: 'Search items', exact: true });
      await pressAt(page, search);
      const at = await page.evaluate(() => window.scrollY);
      for (const key of ['e', 'Backspace', 'a']) {
        await page.keyboard.press(key);
        await twoFrames(page);
        expect(await page.evaluate(() => window.scrollY), `after ${key}`).toBe(at);
      }
    });
  }
});

test.describe('Media feed on a phone, where the applied filters take lines of their own', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  // The chips are in the closed sheet: focus with nowhere to go takes the Filters button, never
  // the search field, whose focus would open the on-screen keyboard.
  test('hands focus to the Filters button after Clear all, not to the search', async ({ page }) => {
    const main = await openConsolePage(page, '/media', 'Media');
    await hydrated(main);
    const link = main.locator('a[data-feed-more-link]').first();
    if (!(await link.count())) return;
    await link.scrollIntoViewIfNeeded();
    await link.tap();
    await expect(page).toHaveURL(/[?&]series=/);
    await landed(page, main);
    await main.locator('[data-filter-part="applied"] > a').tap();
    await expect(page).not.toHaveURL(/[?&]series=/);
    await landed(page, main);
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute('data-filter-part')),
    ).toBe('filters');
  });

  test('lands with the whole results header under the bar after “Show all”', async ({ page }) => {
    const main = await openConsolePage(page, '/media', 'Media');
    const link = main.locator('a[data-feed-more-link]').first();
    // Only a series of many uploads has the link.
    if (!(await link.count())) return;
    await link.scrollIntoViewIfNeeded();
    await link.tap();
    await expect(page).toHaveURL(/[?&]series=/);
    await expect(main.locator('a[data-filter-part="token"]')).toBeVisible();
    // Two frames: the change, its scroll and its crossfade have painted.
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const landed = await main.evaluate((root) => {
      const edge = root.querySelector('[data-filter-part="bar"]')?.getBoundingClientRect();
      const parts = ['count', 'applied'].map((part) => {
        const box = root.querySelector(`[data-filter-part="${part}"]`)?.getBoundingClientRect();
        if (!box || !edge) return `${part}: missing`;
        if (box.top >= edge.bottom - 1) return 'whole';
        return box.bottom <= edge.bottom + 1 ? 'under the bar' : `${part}: cut by the bar`;
      });
      const results = root.querySelector('[data-filter-part="results"]')?.getBoundingClientRect();
      return {
        stuck: (edge?.top ?? 1) <= 0,
        parts,
        resultsUnderBar: (results?.top ?? 0) < (edge?.bottom ?? 0),
      };
    });
    // The series is long, so the bar is stuck over the list the visitor lands in.
    expect(landed.stuck).toBe(true);
    expect(landed.parts).toEqual(['whole', 'whole']);
    expect(landed.resultsUnderBar).toBe(false);
  });
});
