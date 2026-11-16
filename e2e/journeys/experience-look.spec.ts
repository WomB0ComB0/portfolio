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
 * @file How /experience (the story) looks, in a real browser: "The path so far" as a drawing (on
 * a wide page capsules on shared lanes, no name clipped or set over another capsule; on a phone
 * one row a role, its ended line in a tone that reads on the page), the organizations' logos (in
 * their own colours with their highlights capped at rest, never brighter there than drawn whole,
 * and whole while their role is pointed at; grey on a role's page; no letter tile for a role
 * without one), forced colours (the path in system colours, and the stop a jump landed on marked
 * by an outline the system keeps), and the light of a hovered role with its cross-lighting.
 *
 * Read-only: every request is a GET (fixtures/console-routes.ts readOnly).
 */

import { expect, type Locator, type Page, test } from '@playwright/test';
import { readOnly } from '../fixtures/console-routes';
import { hydrated, indexRows, listedRoles, openRole, skipUnless } from './experience-helpers';

test.beforeEach(async ({ page }) => readOnly(page));

/** The path's capsules as drawn: each one's box, its name's box and whether the name is cut. */
const capsulesOf = (page: Page) =>
  page.locator('figure[data-role-path]').evaluate((figure) => {
    const plot = figure.querySelector('[data-path-lanes]')?.getBoundingClientRect();
    return {
      plot: plot ? { left: plot.left, right: plot.right } : null,
      capsules: Array.from(figure.querySelectorAll<HTMLElement>('li[data-path-role]')).map(
        (item) => {
          const line = item.querySelector('[data-path-line]')?.getBoundingClientRect();
          const name = item.querySelector<HTMLElement>('[data-path-label]');
          const box = name?.getBoundingClientRect();
          return {
            name: name?.textContent ?? '',
            line: line
              ? { left: line.left, right: line.right, top: line.top, height: line.height }
              : null,
            label: box
              ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
              : null,
            cut: name ? name.scrollWidth > name.clientWidth + 1 : true,
          };
        },
      ),
    };
  });

test.describe('Experience story, the path as a drawing', () => {
  test('on a wide page, stacks capsules on lanes with no name cut or set over another', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await indexRows(page);
    const figure = page.locator('figure[data-role-path]');
    skipUnless((await figure.count()) > 0, 'Fewer than two dated roles: no path.');
    const { plot, capsules } = await capsulesOf(page);
    if (!plot) throw new Error('no plot');

    for (const capsule of capsules) {
      expect(capsule.cut, capsule.name).toBe(false);
      expect(capsule.line?.height ?? 0, capsule.name).toBeGreaterThanOrEqual(24);
      // Every name stays inside the plot, beside its capsule or in it.
      expect(capsule.label?.left ?? 0, capsule.name).toBeGreaterThanOrEqual(plot.left - 1);
      expect(capsule.label?.right ?? 0, capsule.name).toBeLessThanOrEqual(plot.right + 1);
    }
    // No name overlaps another capsule or another name.
    const boxes = capsules.flatMap((capsule) => [
      { owner: capsule.name, box: capsule.label },
      {
        owner: capsule.name,
        box: capsule.line && {
          left: capsule.line.left,
          right: capsule.line.right,
          top: capsule.line.top,
          bottom: capsule.line.top + capsule.line.height,
        },
      },
    ]);
    for (const capsule of capsules) {
      const label = capsule.label;
      if (!label) continue;
      for (const other of boxes) {
        if (other.owner === capsule.name || !other.box) continue;
        const overlaps =
          label.left < other.box.right - 1 &&
          label.right > other.box.left + 1 &&
          label.top < other.box.bottom - 1 &&
          label.bottom > other.box.top + 1;
        expect(overlaps, `${capsule.name} over ${other.owner}`).toBe(false);
      }
    }
  });

  test('on a phone, gives each role its own row, its ended line in a tone that reads', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await indexRows(page);
    const figure = page.locator('figure[data-role-path]');
    skipUnless((await figure.count()) > 0, 'Fewer than two dated roles: no path.');
    const result = await figure.evaluate((root) => {
      const context = document.createElement('canvas').getContext('2d', {
        willReadFrequently: true,
      });
      if (!context) throw new Error('no canvas');
      const rgba = (colour: string): number[] => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
        const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;
        return [red, green, blue, alpha / 255];
      };
      const luminance = (colour: number[]): number => {
        const [red = 0, green = 0, blue = 0] = colour.map((value) => {
          const share = value / 255;
          return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const page = rgba(getComputedStyle(document.body).backgroundColor);
      const ended = root.querySelector('li[data-path-role]:not([data-current]) [data-path-line]');
      const tone = ended ? rgba(getComputedStyle(ended).backgroundColor) : null;
      const mixed = tone
        ? [0, 1, 2].map(
            (at) => (tone[at] ?? 0) * (tone[3] ?? 1) + (page[at] ?? 0) * (1 - (tone[3] ?? 1)),
          )
        : null;
      const [light, dark] = mixed
        ? [luminance(mixed), luminance(page)].sort((a, b) => b - a)
        : [0, 0];
      const tops = Array.from(root.querySelectorAll('li[data-path-role]')).map(
        (item) => item.getBoundingClientRect().top,
      );
      return {
        contrast: mixed ? ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05) : null,
        rows: tops.length,
        distinctRows: new Set(tops.map(Math.round)).size,
      };
    });

    expect(result.distinctRows).toBe(result.rows);
    const contrast = skipUnless(result.contrast, 'No role has ended: no ended line to compare.');
    expect(contrast).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Experience story, in forced colours', () => {
  test.use({ forcedColors: 'active' });

  test('draws the path in system colours: lines on a phone, rimmed capsules on a wide page', async ({
    page,
  }) => {
    const rows = await indexRows(page);
    const figure = page.locator('figure[data-role-path]');
    skipUnless((await figure.count()) > 0, 'Fewer than two dated roles: no path.');
    const drawn = () =>
      figure.evaluate((root) => {
        const system = (name: string): string => {
          const probe = document.createElement('i');
          probe.style.setProperty('forced-color-adjust', 'none');
          probe.style.backgroundColor = name;
          document.body.append(probe);
          const colour = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return colour;
        };
        const line = (selector: string) => {
          const element = root.querySelector(`${selector} [data-path-line]`);
          if (!element) return null;
          const style = getComputedStyle(element);
          return { fill: style.backgroundColor, rim: style.boxShadow };
        };
        return {
          forced: window.matchMedia('(forced-colors: active)').matches,
          canvas: system('Canvas'),
          ended: system('GrayText'),
          running: system('Highlight'),
          endedLine: line('li[data-path-role]:not([data-current])'),
          runningLine: line('li[data-path-role][data-current]'),
        };
      });

    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await drawn();
    expect(narrow.forced).toBe(true);
    if (narrow.endedLine) expect(narrow.endedLine.fill).toBe(narrow.ended);
    if (narrow.runningLine) expect(narrow.runningLine.fill).toBe(narrow.running);

    await page.setViewportSize({ width: 1440, height: 900 });
    // The rim fades in over the house timing as the capsule takes its wide form: read it settled.
    await expect
      .poll(async () => (await drawn()).endedLine?.rim ?? '')
      .toMatch(/ 0px 0px 0px 1px inset$|^$/);
    const wide = await drawn();
    if (wide.endedLine) {
      expect(wide.endedLine.fill).toBe(wide.canvas);
      expect(wide.endedLine.rim).toContain(wide.ended);
    }
    if (wide.runningLine) {
      expect(wide.runningLine.fill).toBe(wide.canvas);
      expect(wide.runningLine.rim).toContain(wide.running);
    }

    // Pointing at a role lights it in palette colours elsewhere; here the system colours hold.
    await rows.first().hover();
    expect((await drawn()).runningLine?.fill).toBe(wide.runningLine?.fill);
  });
});

/** Arrives at the first row from its role's page, as "All experience" does; the row's id. */
async function arriveAtRow(page: Page): Promise<string> {
  const roles = await listedRoles(page);
  const role = skipUnless(roles[1], 'One role only: no stop to arrive at.');
  const main = await openRole(page, role);
  await hydrated(page);
  await main.getByRole('link', { name: 'All experience' }).click();
  await expect(page).toHaveURL((url) => url.hash === `#role-${role.id}`);
  return `role-${role.id}`;
}

/** The outline of the page's target, as drawn. */
const targetOutline = (page: Page) =>
  page.evaluate(() => {
    const row = document.querySelector(':target');
    // The stop's role (its article) draws the mark, around its light.
    const drawn = row?.querySelector('article') ?? row;
    const style = drawn ? getComputedStyle(drawn) : null;
    const probe = document.createElement('i');
    probe.style.color = 'Highlight';
    document.body.append(probe);
    const highlight = getComputedStyle(probe).color;
    probe.remove();
    return {
      id: row?.id ?? null,
      style: style?.outlineStyle ?? null,
      width: Number.parseFloat(style?.outlineWidth ?? '0'),
      colour: style?.outlineColor ?? null,
      highlight,
    };
  });

test.describe('Experience, the row a jump landed on', () => {
  test('wears its rim and no outline in ordinary colours', async ({ page }) => {
    const id = await arriveAtRow(page);
    await expect.poll(async () => (await targetOutline(page)).id).toBe(id);

    expect((await targetOutline(page)).style).toBe('none');
  });

  test.describe('in forced colours', () => {
    test.use({ forcedColors: 'active' });

    test('is marked by an outline in the system highlight colour, which forced colours keep', async ({
      page,
    }) => {
      const id = await arriveAtRow(page);
      await expect.poll(async () => (await targetOutline(page)).id).toBe(id);

      const outline = await targetOutline(page);
      expect(outline.style).toBe('solid');
      expect(outline.width).toBeGreaterThanOrEqual(1);
      expect(outline.colour).toBe(outline.highlight);
    });
  });
});

test.describe('Experience, the marks', () => {
  /** A mark's grey, opacity and highlight cap as drawn. */
  const lookOf = (mark: Locator) =>
    mark.evaluate((element) => {
      const style = getComputedStyle(element);
      const cap = getComputedStyle(element, '::before');
      return {
        filter: style.filter,
        opacity: Number(style.opacity),
        cap: cap.content === 'none' ? 'none' : `${cap.mixBlendMode} ${cap.opacity}`,
      };
    });
  /**
   * On a role's page: grey at full strength, its highlights capped by a "darken" layer in the
   * muted tone; whole while pointed at.
   */
  const AT_REST = { filter: 'grayscale(1)', opacity: 1, cap: 'darken 1' };
  const AS_DRAWN = { filter: 'grayscale(0)', opacity: 1, cap: 'darken 0' };
  /** On the story's rail: its own colours, the highlights capped at rest; whole while lit. */
  const LIST_AT_REST = { filter: 'none', opacity: 1, cap: 'darken 1' };
  const LIST_AS_DRAWN = { filter: 'none', opacity: 1, cap: 'darken 0' };

  /** The mean relative luminance of a screenshot, read in a blank page's canvas. */
  async function meanLuminance(page: Page, png: Buffer): Promise<number> {
    const calc = await page.context().newPage();
    await readOnly(calc);
    await calc.setContent('<canvas></canvas>');
    const mean = await calc.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.querySelector('canvas');
      const context = canvas?.getContext('2d');
      if (!canvas || !context) throw new Error('no canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      context.drawImage(image, 0, 0);
      // Inside the rim: a hairline is drawn around the mark in both states.
      const inset = Math.round(image.width * 0.12);
      const pixels = context.getImageData(
        inset,
        inset,
        image.width - 2 * inset,
        image.height - 2 * inset,
      ).data;
      const linear = (value: number): number => {
        const share = value / 255;
        return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
      };
      let sum = 0;
      for (let at = 0; at < pixels.length; at += 4) {
        sum +=
          0.2126 * linear(pixels[at] ?? 0) +
          0.7152 * linear(pixels[at + 1] ?? 0) +
          0.0722 * linear(pixels[at + 2] ?? 0);
      }
      return sum / (pixels.length / 4);
    }, png.toString('base64'));
    await calc.close();
    return mean;
  }

  /** A logo's luminance at rest and pointed at (`hoverOn` is what the pointer rests on). */
  async function restAndDrawn(
    page: Page,
    mark: Locator,
    hoverOn: Locator,
    looks: { readonly rest: object; readonly drawn: object } = { rest: AT_REST, drawn: AS_DRAWN },
  ) {
    await mark.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expect.poll(() => lookOf(mark)).toEqual(looks.rest);
    const rest = await meanLuminance(page, await mark.screenshot());
    await hoverOn.hover();
    await expect.poll(() => lookOf(mark)).toEqual(looks.drawn);
    const drawn = await meanLuminance(page, await mark.screenshot());
    return { rest, drawn };
  }

  test('keeps a logo in its colours, capped at rest, and whole while its role is pointed at', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const rows = await indexRows(page);
    const row = rows.filter({ has: page.locator('[data-role-logo]') }).first();
    skipUnless((await row.count()) > 0, 'No role has a logo in Studio: nothing to quiet.');
    const logo = row.locator('[data-role-logo]');

    await page.mouse.move(0, 0);
    await expect.poll(() => lookOf(logo)).toEqual(LIST_AT_REST);
    await row.hover();
    await expect.poll(() => lookOf(logo)).toEqual(LIST_AS_DRAWN);
    await page.mouse.move(0, 0);
    await expect.poll(() => lookOf(logo)).toEqual(LIST_AT_REST);
  });

  test('wakes a logo while its role has keyboard focus, as pointing does, as on a role page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const rows = await indexRows(page);
    const row = rows.filter({ has: page.locator('[data-role-logo]') }).first();
    skipUnless((await row.count()) > 0, 'No role has a logo in Studio: nothing to wake.');
    const title = row.locator('[data-role-page]');
    const logo = row.locator('[data-role-logo]');

    await page.mouse.move(0, 0);
    // A key first, so the focus that follows is a keyboard one (:focus-visible).
    await page.keyboard.press('Shift');
    await title.focus();
    await expect(title).toBeFocused();
    expect(await title.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await expect.poll(() => lookOf(logo)).toEqual(LIST_AS_DRAWN);

    await title.blur();
    await expect.poll(() => lookOf(logo)).toEqual(LIST_AT_REST);
  });

  test('sets no letter tile for a role without a logo: its name stands alone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const rows = await indexRows(page);

    await expect(rows.locator('[data-role-monogram]')).toHaveCount(0);
    // A logo sits on its organization's line, before the name.
    const logos = rows.locator('[data-role-logo]');
    for (const logo of await logos.all()) {
      expect(
        await logo.evaluate((element) =>
          element.parentElement?.hasAttribute('data-role-organization'),
        ),
      ).toBe(true);
    }
  });

  test.describe('in pixels', () => {
    test.use({ deviceScaleFactor: 2 });

    test('is never brighter at rest than in its own colours: every logo on the list', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const rows = await indexRows(page);
      const withLogo = rows.filter({ has: page.locator('[data-role-logo]') });
      const count = await withLogo.count();
      skipUnless(count > 0, 'No role has a logo in Studio: nothing to measure.');

      for (let index = 0; index < count; index += 1) {
        const row = withLogo.nth(index);
        const name = (await row.locator('[data-role-organization]').textContent()) ?? `${index}`;
        const { rest, drawn } = await restAndDrawn(page, row.locator('[data-role-logo]'), row, {
          rest: LIST_AT_REST,
          drawn: LIST_AS_DRAWN,
        });
        expect(rest, name).toBeLessThanOrEqual(drawn);
      }
    });

    test("is never brighter at rest on a role's page either", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const roles = await listedRoles(page);
      let checked = 0;
      for (const role of roles) {
        if (checked === 4) break;
        const main = await openRole(page, role);
        const mark = main.locator('header [data-role-logo]');
        if ((await mark.count()) === 0) continue;
        checked += 1;
        const link = main.locator('header a[target="_blank"]');
        const hoverOn = (await link.count()) > 0 ? link.first() : mark;
        const { rest, drawn } = await restAndDrawn(page, mark, hoverOn);
        expect(rest, role.href).toBeLessThanOrEqual(drawn);
      }
      skipUnless(checked > 0, 'No role page shows a logo: nothing to measure.');
    });
  });
});

test.describe('Experience story, the light and the cross-lighting', () => {
  /** A stop's light (its role's ::before) and whether the role has lifted. */
  const lightOf = (row: Locator) =>
    row.locator('article').evaluate((article) => ({
      opacity: getComputedStyle(article, '::before').opacity,
      transform: getComputedStyle(article).transform,
    }));

  /** The capsules on the path the island has lit, and dimmed. */
  const litOnPath = (page: Page) =>
    page.locator('figure[data-role-path]').evaluate((figure) => ({
      on: Array.from(figure.querySelectorAll<HTMLElement>('[data-r][data-lit="on"]')).map(
        (capsule) => capsule.dataset.r,
      ),
      off: figure.querySelectorAll('[data-r][data-lit="off"]').length,
    }));

  test('lights a hovered role and its capsule on the path, dimming the others', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1440, height: 900 });
    const rows = await indexRows(page);
    await hydrated(page);
    const row = rows.first();
    const id = await row.getAttribute('data-id');
    skipUnless((await page.locator('figure[data-role-path]').count()) > 0, 'No path to light.');

    await row.hover();
    await expect.poll(async () => (await lightOf(row)).opacity).toBe('1');
    await expect.poll(async () => (await litOnPath(page)).on).toEqual([id]);
    expect((await litOnPath(page)).off).toBe((await rows.count()) - 1);
  });

  test('lifts a capsule a pixel on the spring when pointed at, and rims it in brand', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await indexRows(page);
    await hydrated(page);
    const capsule = page.locator('figure[data-role-path] a[data-r]').first();
    skipUnless((await capsule.count()) > 0, 'No path to point at.');

    await capsule.hover();
    await expect
      .poll(() => capsule.evaluate((element) => getComputedStyle(element).translate))
      .toMatch(/-1px/);
    expect(
      await capsule
        .locator('[data-path-line]')
        .evaluate((line) => getComputedStyle(line).boxShadow),
    ).not.toBe('none');
  });

  test('keeps the light but neither lift nor cross-lighting under reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const rows = await indexRows(page);
    await hydrated(page);
    const row = rows.first();

    await row.hover();
    await expect.poll(async () => (await lightOf(row)).opacity).toBe('1');
    expect((await lightOf(row)).transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    await expect(page.locator('figure[data-role-path] [data-lit]')).toHaveCount(0);
    const capsule = page.locator('figure[data-role-path] a[data-r]').first();
    if ((await capsule.count()) > 0) {
      await capsule.hover();
      expect(await capsule.evaluate((element) => getComputedStyle(element).translate)).toMatch(
        /^(none|0px( 0px)?)$/,
      );
    }
  });
});
