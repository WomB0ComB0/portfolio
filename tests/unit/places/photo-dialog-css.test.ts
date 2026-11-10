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
 * @file The open view's layout (photo-dialog.module.css), worked out in px for real windows and
 * photo shapes (WCAG 1.4.4 and 1.4.10: nothing is lost when text is zoomed or reflowed):
 * - Wide windows: the panel is never narrower than the caption needs (26rem, or the window less
 *   2rem a side), a tall photo is drawn whole and centred inside it within its height budget,
 *   and the caption stacks below 30rem of panel, with the budget leaving room for it.
 * - The panel never outgrows the window: it is capped at its height and the caption scrolls
 *   (inside the dialog, so the scroll lock allows it), never the photo.
 * - Phones and short windows (the very query the script reads) go full screen, with a floor
 *   under the photo so a zoomed-in window never squeezes it to nothing.
 * - Forced colours keep the panel's edge and the buttons' shapes.
 */

import { describe, expect, it } from 'vitest';

import { COMPACT_QUERY } from '@/app/(routes)/(main)/(personal)/places/photos/_lib/dialog-layout';
import { declaredValue, findRule } from '../styles/css-rules';
import { evaluateCss } from './css-calc';
import { FORCED_COLOURS_MEDIA, PLACES_DIR, readCss, styleRules } from './module-css';

const RULES = styleRules(readCss(`${PLACES_DIR}/photos/_components/photo-dialog.module.css`));
const STACKED = '@container (width < 30rem)';
const COMPACT = `@media ${COMPACT_QUERY}`;
const REM = 16;
/** The panel's side padding, 0.5rem a side. */
const PANEL_PADDING_X = 16;

const value = (selector: string, property: string, conditions: readonly string[] = []): string => {
  const found = declaredValue(findRule(RULES, selector, conditions), property);
  if (found === undefined) throw new Error(`${selector} sets no ${property}`);
  return found;
};

/** The panel and the photo frame in px, for a photo of `ratio` in a `vw` x `vh` window. */
function layout(ratio: number, vw: number, vh: number) {
  const vars = {
    '--ratio': String(ratio),
    '--frame-max-h': value('.panel', '--frame-max-h'),
    '--panel-min': value('.panel', '--panel-min'),
  };
  const panelWidth = evaluateCss(value('.panel', 'width'), { vw, vh, vars });
  const content = panelWidth - PANEL_PADDING_X;
  const stacked = content < 30 * REM;
  const frameVars = stacked
    ? { ...vars, '--frame-max-h': value('.frame', '--frame-max-h', [STACKED]) }
    : vars;
  const frame = { vw, vh, vars: frameVars, percentOf: content };
  const frameWidth = evaluateCss(value('.frame', 'width'), frame);
  return {
    panelWidth,
    content,
    stacked,
    frameWidth,
    frameHeight: frameWidth / ratio,
    frameBudget: evaluateCss('var(--frame-max-h)', frame),
  };
}

describe('photo-dialog.module.css: wide windows', () => {
  it('pads the panel 0.5rem a side, which the layout below assumes', () => {
    expect(value('.panel', 'padding')).toBe('0.5rem 0.5rem 0');
  });

  it.each([
    [0.3, 1440, 900],
    [0.45, 1440, 900],
    [0.45, 1366, 657],
    [0.45, 1280, 720],
    [0.75, 1366, 657],
    [0.75, 1280, 720],
    [1, 800, 600],
  ])(
    'a %s photo at %sx%s: a panel wide enough for its caption, the photo whole',
    (ratio, vw, vh) => {
      const { panelWidth, content, frameWidth, frameHeight, frameBudget } = layout(ratio, vw, vh);

      expect(panelWidth).toBeGreaterThanOrEqual(Math.min(26 * REM, vw - 4 * REM));
      expect(panelWidth).toBeLessThanOrEqual(vw - 4 * REM);
      expect(frameWidth).toBeLessThanOrEqual(content + 0.01);
      expect(frameHeight).toBeLessThanOrEqual(frameBudget + 0.01);
    },
  );

  it('stacks the caption of a 0.3 photo at 1440x900, the frame leaving room for it', () => {
    const tall = layout(0.3, 1440, 900);
    expect(tall.stacked).toBe(true);
    const rowBudget = evaluateCss(value('.panel', '--frame-max-h'), { vw: 1440, vh: 900 });
    expect(tall.frameBudget).toBeLessThan(rowBudget);
    expect(value('.caption', 'flex-direction', [STACKED])).toBe('column');
  });

  it('gives a landscape photo at 1440x900 the full 52rem, its caption in a row', () => {
    const wide = layout(1.5, 1440, 900);
    expect(wide.panelWidth).toBe(52 * REM);
    expect(wide.stacked).toBe(false);
    expect(wide.frameWidth).toBeCloseTo(wide.content);
  });

  it('centres a frame narrower than the panel, keeping its own shape for the flight', () => {
    expect(value('.frame', 'margin-inline')).toBe('auto');
    expect(value('.frame', 'aspect-ratio')).toBe('var(--ratio)');
  });
});

describe('photo-dialog.module.css: never taller than the window', () => {
  it('queries the panel by its width and caps it at the window less 2rem a side', () => {
    expect(value('.panel', 'container-type')).toBe('inline-size');
    expect(value('.panel', 'max-height')).toBe('calc(100dvh - 4rem)');
  });

  it('scrolls the caption inside the dialog, never the photo, centred only when it fits', () => {
    expect(value('.caption', 'overflow-y')).toBe('auto');
    expect(value('.caption', 'overscroll-behavior')).toBe('contain');
    expect(value('.caption', 'align-items')).toBe('safe center');
    expect(value('.frame', 'flex')).toBe('none');
  });
});

describe('photo-dialog.module.css: phones and short windows', () => {
  it('goes full screen below 40rem wide or 32rem tall, the query the script reads', () => {
    expect(COMPACT_QUERY).toBe('(width < 40rem), (height < 32rem)');
    expect(value('.panel', 'width', [COMPACT])).toBe('100vw');
    expect(value('.panel', 'height', [COMPACT])).toBe('100dvh');
    expect(value('.panel', 'max-height', [COMPACT])).toBe('none');
    expect(RULES.some((rule) => rule.conditions.includes('@media (width < 40rem)'))).toBe(false);
  });

  it('keeps a floor under the photo and lets the caption scroll instead', () => {
    expect(value('.frame', 'min-height', [COMPACT])).toBe('min(40dvh, 12rem)');
    expect(value('.frame', 'width', [COMPACT])).toBe('100%');
    expect(value('.caption', 'min-height', [COMPACT])).toBe('0');
    // The scroll area clips, so it reaches past Open place's -0.75rem margin and focus ring.
    expect(value('.caption', 'margin-inline', [COMPACT])).toBe('-0.75rem');
    expect(value('.caption', 'padding', [COMPACT])).toBe('1rem');
    expect(value('.placeholder, .full', 'object-fit', [COMPACT])).toBe('contain');
  });
});

describe('photo-dialog.module.css: forced colours', () => {
  it('outlines the panel, whose edge is a box-shadow, and borders the borderless buttons', () => {
    expect(value('.surface', 'outline', [FORCED_COLOURS_MEDIA])).toBe('1px solid CanvasText');
    expect(value('.close, .done', 'border', [FORCED_COLOURS_MEDIA])).toBe('1px solid ButtonBorder');
  });
});
