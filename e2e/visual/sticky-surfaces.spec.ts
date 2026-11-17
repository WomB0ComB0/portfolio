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

import { expect, type Page, test } from '@playwright/test';
import { getTargetUrl } from '../fixtures/base';
import { readOnly } from '../fixtures/console-routes';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await readOnly(page);
});

async function open(page: Page, route: string): Promise<void> {
  await page.goto(`${getTargetUrl()}${route}`);
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (route === '/places/photos') {
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Photos', exact: true })).toBeVisible();
  }
}

async function surfaces(page: Page) {
  return page.locator('.stuck-canvas').evaluateAll((elements) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is required to read computed colour alpha');
    return elements
      .map((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const plate = getComputedStyle(element, '::before');
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = plate.backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return {
          tag: element.tagName,
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          tl: plate.borderTopLeftRadius,
          tr: plate.borderTopRightRadius,
          bl: plate.borderBottomLeftRadius,
          br: plate.borderBottomRightRadius,
          pinned:
            style.position === 'sticky' && Math.abs(box.top - Number.parseFloat(style.top)) < 2,
          alpha: (context.getImageData(0, 0, 1, 1).data[3] ?? 0) / 255,
          blur: plate.backdropFilter,
          textFilter: style.filter,
          containerBlur: style.backdropFilter,
          opacity: style.opacity,
          pointerEvents: plate.pointerEvents,
        };
      })
      .filter((surface) => surface.pinned);
  });
}

async function expectFloatingShape(page: Page): Promise<void> {
  const pinned = await surfaces(page);
  const bar = pinned.find((surface) => surface.tag === 'SEARCH');
  const heading = pinned.find((surface) => surface.tag === 'H2');
  if (bar) {
    const spacing = await page.locator('main [data-filter-part="bar"]').evaluate((element) => {
      const box = element.getBoundingClientRect();
      const form = element.querySelector('form')?.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: style.marginLeft,
        right: style.marginRight,
        innerLeft: form ? form.left - box.left : -1,
        innerRight: form ? box.right - form.right : -1,
      };
    });
    expect(spacing.left).toBe('8px');
    expect(spacing.right).toBe('8px');
    expect(spacing.innerLeft).toBeCloseTo(8, 0);
    expect(spacing.innerRight).toBeCloseTo(8, 0);
    expect(bar.top).toBeCloseTo(8, 0);
    expect([bar.tl, bar.tr, bar.bl, bar.br]).toEqual(['12px', '12px', '12px', '12px']);
  }
  if (heading) {
    expect(heading.top).toBeCloseTo(bar ? bar.bottom + 8 : 8, 0);
    if (bar) {
      expect(heading.left).toBeCloseTo(bar.left, 0);
      expect(heading.right).toBeCloseTo(bar.right, 0);
    }
    expect([heading.tl, heading.tr]).toEqual(['12px', '12px']);
    const labels = pinned.filter((surface) => surface.tag === 'TH');
    if (labels.length) {
      expect(labels[0]?.bl).toBe('12px');
      expect(labels.at(-1)?.br).toBe('12px');
    } else {
      expect([heading.bl, heading.br]).toEqual(['12px', '12px']);
    }
  }
  expect(bar || heading).toBeTruthy();
}

for (const route of ['/projects', '/spotify', '/media', '/certifications']) {
  test(`${route}: pinned backgrounds transmit the haze while controls stay sharp`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1150 });
    await open(page, route);
    await page.evaluate(() => window.scrollTo({ top: 1100, behavior: 'instant' }));
    await expect.poll(async () => (await surfaces(page)).length).toBeGreaterThan(0);
    await expect
      .poll(async () =>
        (await surfaces(page)).every((s) => s.alpha > 0 && s.alpha < 1 && s.blur === 'blur(12px)'),
      )
      .toBe(true);
    await expectFloatingShape(page);
    for (const surface of await surfaces(page)) {
      expect(surface.textFilter).toBe('none');
      expect(surface.containerBlur).toBe('none');
      expect(surface.opacity).toBe('1');
      expect(surface.pointerEvents).toBe('none');
    }
    const search = page.getByRole('searchbox');
    if (await search.count()) {
      await search.focus();
      await expect(search).toBeFocused();
    }
  });
}

/** The form is the only painted Places surface; the sticky wrapper only positions it. */
async function expectOpaquePlaces(page: Page): Promise<void> {
  const state = await page.locator('[data-filter-part="bar"]').evaluate((element) => {
    const form = element.querySelector('form');
    if (!form) throw new Error('missing Places form');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is required for computed colour alpha');
    const alpha = (colour: string): number => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = colour;
      context.fillRect(0, 0, 1, 1);
      return (context.getImageData(0, 0, 1, 1).data[3] ?? 0) / 255;
    };
    const outer = getComputedStyle(element);
    const plate = getComputedStyle(element, '::before');
    const tile = getComputedStyle(form);
    const box = element.getBoundingClientRect();
    const inner = form.getBoundingClientRect();
    return {
      selected: element.getAttribute('data-backplate'),
      outerAlpha: alpha(outer.backgroundColor),
      outerBlur: outer.backdropFilter,
      plateContent: plate.content,
      plateAlpha: alpha(plate.backgroundColor),
      plateBlur: plate.backdropFilter,
      tileAlpha: alpha(tile.backgroundColor),
      tileBlur: tile.backdropFilter,
      radius: tile.borderRadius,
      border: tile.borderTopWidth,
      marginLeft: outer.marginLeft,
      marginRight: outer.marginRight,
      innerLeft: inner.left - box.left,
      innerRight: box.right - inner.right,
      verticalPadding: box.height - inner.height,
      measured: document.documentElement.style.getPropertyValue('--filter-bar-pinned-h'),
      height: box.height,
    };
  });
  expect(state.selected).toBe('none');
  expect(state.outerAlpha).toBe(0);
  expect(state.outerBlur).toBe('none');
  expect(['none', 'normal']).toContain(state.plateContent);
  expect(state.plateAlpha).toBe(0);
  expect(state.plateBlur).toBe('none');
  expect(state.tileAlpha).toBe(1);
  expect(state.tileBlur).toBe('none');
  expect(state.radius).toBe('12px');
  expect(state.border).toBe('1px');
  expect([state.marginLeft, state.marginRight]).toEqual(['8px', '8px']);
  expect(state.innerLeft).toBeCloseTo(8, 0);
  expect(state.innerRight).toBeCloseTo(8, 0);
  expect(state.verticalPadding).toBeCloseTo(8, 0);
  expect(Number.parseFloat(state.measured)).toBeCloseTo(state.height, 0);
}

for (const profile of [
  { name: 'Places desktop', route: '/places', width: 1440, height: 900, touch: false },
  { name: 'Photos desktop', route: '/places/photos', width: 1440, height: 900, touch: false },
  { name: 'Photos touch', route: '/places/photos', width: 390, height: 844, touch: true },
  { name: 'Photos short screen', route: '/places/photos', width: 1024, height: 400, touch: true },
]) {
  test.describe(profile.name, () => {
    test.use({
      viewport: { width: profile.width, height: profile.height },
      hasTouch: profile.touch,
      isMobile: profile.touch,
    });
    test('keeps one opaque rounded tile at rest, while scrolling, and without scroll-state support', async ({
      page,
      context,
    }) => {
      await open(page, profile.route);
      await expectOpaquePlaces(page);
      const bar = page.locator('[data-filter-part="bar"]');
      const initialTop = await bar.evaluate((element) => element.getBoundingClientRect().top);
      await page.evaluate(() => window.scrollTo({ top: 1100, behavior: 'instant' }));
      await expectOpaquePlaces(page);
      if (profile.height < 550) {
        await expect(bar).toHaveCSS('position', 'relative');
        await expect(bar).toHaveCSS('z-index', 'auto');
        expect(await bar.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(
          initialTop,
        );
      } else {
        await expect
          .poll(() => bar.evaluate((element) => element.getBoundingClientRect().top))
          .toBeCloseTo(8, 0);
      }
      await disableScrollStateBranch(page);
      await expectOpaquePlaces(page);
      if (!profile.touch) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
        });
        await expectOpaquePlaces(page);
        await page.emulateMedia({ forcedColors: 'active' });
        await expectOpaquePlaces(page);
      }
    });
  });
}

for (const width of [390, 760]) {
  test(`Media at ${width}px: rounded visible edges and gaps survive collapsed columns`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/media');
    await page.evaluate(() => window.scrollTo({ top: 1100, behavior: 'instant' }));
    await expect.poll(async () => (await surfaces(page)).length).toBeGreaterThan(0);
    await expectFloatingShape(page);
  });
}

test('reduced transparency restores a solid backplate without filtering labels', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  await open(page, '/media');
  await page.evaluate(() => window.scrollTo({ top: 1100, behavior: 'instant' }));
  await expect.poll(async () => (await surfaces(page)).length).toBeGreaterThan(0);
  await expect
    .poll(async () =>
      (await surfaces(page)).every(
        (s) => s.alpha === 1 && s.blur === 'none' && s.textFilter === 'none',
      ),
    )
    .toBe(true);
});

test('forced colours uses solid system surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page, '/certifications');
  await page.evaluate(() => window.scrollTo({ top: 1100, behavior: 'instant' }));
  await expect.poll(async () => (await surfaces(page)).length).toBeGreaterThan(0);
  await expect
    .poll(async () => (await surfaces(page)).every((s) => s.alpha === 1 && s.blur === 'none'))
    .toBe(true);
});

/** Exercise the no-scroll-state fallback while retaining the actual built stylesheet. */
async function disableScrollStateBranch(page: Page): Promise<void> {
  const removed = await page.evaluate(() => {
    let count = 0;
    function visit(group: CSSStyleSheet | CSSGroupingRule): void {
      for (let index = group.cssRules.length - 1; index >= 0; index--) {
        const rule = group.cssRules[index];
        if (
          rule instanceof CSSSupportsRule &&
          rule.conditionText.replace(/\s/g, '').includes('(container-type:scroll-state)')
        ) {
          group.deleteRule(index);
          count++;
        } else if (rule instanceof CSSGroupingRule) visit(rule);
      }
    }
    for (const sheet of document.styleSheets) {
      try {
        visit(sheet);
      } catch {
        /* Cross-origin styles do not contain the app utility. */
      }
    }
    return count;
  });
  expect(removed).toBeGreaterThan(0);
}

for (const [route, selector] of [
  ['/stats', '#stats-top-repositories, #stats-top-repositories + table th.stuck-canvas'],
] as const) {
  test(`${route}: short-screen fallback backplates stay inside their unpinned bars`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 400 });
    await open(page, route);
    await disableScrollStateBranch(page);
    const bars = page.locator(selector);
    expect(await bars.count()).toBeGreaterThan(route === '/stats' ? 1 : 0);
    let visibleBars = 0;
    for (const bar of await bars.all()) {
      if (!(await bar.isVisible())) continue;
      visibleBars++;
      const geometry = await bar.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const plate = getComputedStyle(element, '::before');
        return {
          width: box.width,
          height: box.height,
          plateWidth: Number.parseFloat(plate.width),
          plateHeight: Number.parseFloat(plate.height),
          position: style.position,
          top: style.top,
          zIndex: style.zIndex,
          blur: style.backdropFilter,
        };
      });
      expect(geometry.position).toBe('relative');
      expect(['auto', '0px']).toContain(geometry.top);
      expect(geometry.zIndex).toBe('auto');
      expect(geometry.blur).toBe('none');
      expect(Math.abs(geometry.width - geometry.plateWidth)).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.height - geometry.plateHeight)).toBeLessThanOrEqual(2);
    }
    expect(visibleBars).toBeGreaterThan(route === '/stats' ? 1 : 0);
    const before = await bars.first().evaluate((element) => element.getBoundingClientRect().top);
    const y = await page.evaluate(() => scrollY);
    await page.evaluate(() => window.scrollBy({ top: 100, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y);
    const delta = (await page.evaluate(() => scrollY)) - y;
    await expect
      .poll(() => bars.first().evaluate((element) => element.getBoundingClientRect().top))
      .toBeCloseTo(before - delta, 0);
  });
}
