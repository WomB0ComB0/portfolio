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
 * @file /places/photos' stylesheets, read as text: palette tokens only, every var() resolved,
 * only compositor properties moving, hover only behind a fine pointer, kebab-case classes. Before
 * hydration CSS picks the view by the very media query the script reads (FINE_POINTER) plus
 * scripting: enabled; without script the grid shows alone, with its note. The wall's box keeps
 * one height whether it is the server's empty frame or the live wall. In all seven new modules
 * (these five, the card folder and the Places | Photos links) every reduced-motion reset wins
 * over the motion it undoes, and forced colours keep each pressed or current state and each
 * borderless button's shape. The grid's hover halo is drawn outside the photo's clip.
 */

import { describe, expect, it } from 'vitest';

import { FINE_POINTER } from '@/hooks/use-fine-pointer';
import { declaredValue, findRule } from '../styles/css-rules';
import {
  FINE_POINTER_MEDIA,
  FORCED_COLOURS_MEDIA,
  hoverOutsideFinePointer,
  losingReducedMotionResets,
  NO_SCRIPT_MEDIA,
  nonCompositorTransitions,
  nonKebabClasses,
  OFF_PALETTE,
  PLACES_DIR,
  REDUCED_MOTION_MEDIA,
  readCss,
  styleRules,
  unresolvedVars,
} from './module-css';

const PHOTOS = `${PLACES_DIR}/photos/_components`;
const FILES = [
  `${PHOTOS}/photos-view.module.css`,
  `${PHOTOS}/photo-grid.module.css`,
  `${PHOTOS}/photo-wall.module.css`,
  `${PHOTOS}/wall-sheet.module.css`,
  `${PHOTOS}/photo-dialog.module.css`,
];
const PRE_HYDRATION = `@media ${FINE_POINTER} and (scripting: enabled)`;
const VIEW_NAV = `${PLACES_DIR}/_components/places-view-nav.module.css`;
const FOLDER = `${PLACES_DIR}/_components/photo-folder.module.css`;
/** Every stylesheet this part adds. */
const NEW_MODULES = [...FILES, FOLDER, VIEW_NAV];
/** The system colours forced-colours mode draws with. */
const BUTTON_BORDER = '1px solid ButtonBorder';
const EDGE = '1px solid CanvasText';

/** A property's value in a stylesheet's rule under exactly these at-rules. */
const valueIn = (
  file: string,
  selector: string,
  property: string,
  conditions: readonly string[] = [],
) => declaredValue(findRule(styleRules(readCss(file)), selector, conditions), property);

describe.each(FILES)('%s', (file) => {
  const css = readCss(file);
  const rules = styleRules(css);

  it('uses palette tokens only, and every var() resolves', () => {
    expect(css).not.toMatch(OFF_PALETTE);
    expect(unresolvedVars(css)).toEqual([]);
  });

  it('moves only compositor properties', () => {
    expect(nonCompositorTransitions(rules)).toEqual([]);
    expect(css).not.toMatch(/animation:\s*[^;]*\b(?:width|height|top|left)\b/);
  });

  it('hovers only with a fine pointer, with kebab-case classes', () => {
    expect(hoverOutsideFinePointer(rules)).toEqual([]);
    expect(nonKebabClasses(css)).toEqual([]);
  });
});

describe.each(NEW_MODULES)('%s under reduced motion', (file) => {
  it('holds every hover, press and focus motion still, with a reset that wins', () => {
    expect(losingReducedMotionResets(styleRules(readCss(file)))).toEqual([]);
  });
});

describe('forced colours (Windows High Contrast drops backgrounds and box-shadows)', () => {
  it.each([
    [`${PHOTOS}/photos-view.module.css`, '.option[aria-pressed="true"]'],
    [VIEW_NAV, '.link[aria-current="page"]'],
  ])('%s: %s takes the system highlight', (file, selector) => {
    expect(valueIn(file, selector, 'forced-color-adjust', [FORCED_COLOURS_MEDIA])).toBe('none');
    expect(valueIn(file, selector, 'background', [FORCED_COLOURS_MEDIA])).toBe('Highlight');
    expect(valueIn(file, selector, 'color', [FORCED_COLOURS_MEDIA])).toBe('HighlightText');
  });

  it.each([
    [`${PHOTOS}/photos-view.module.css`, '.option'],
    [VIEW_NAV, '.link'],
    [`${PHOTOS}/photo-grid.module.css`, '.more'],
    [`${PHOTOS}/wall-sheet.module.css`, '.done'],
  ])('%s: %s keeps its shape with a button border', (file, selector) => {
    expect(valueIn(file, selector, 'border', [FORCED_COLOURS_MEDIA])).toBe(BUTTON_BORDER);
  });

  it("outlines the wall's frame, whose hairline is a box-shadow", () => {
    expect(
      valueIn(`${PHOTOS}/photo-wall.module.css`, '.viewport', 'outline', [FORCED_COLOURS_MEDIA]),
    ).toBe(EDGE);
  });
});

describe('photos-view.module.css', () => {
  const rules = styleRules(readCss(`${PHOTOS}/photos-view.module.css`));
  const value = (selector: string, property: string, conditions: readonly string[] = []) =>
    declaredValue(findRule(rules, selector, conditions), property);

  it('shows the grid before hydration, and the wall frame with a fine pointer and script', () => {
    expect(value('.view:not([data-ready]) .wall-block', 'display')).toBe('none');
    expect(
      value('.view:not([data-ready])[data-wall="on"] .wall-block', 'display', [PRE_HYDRATION]),
    ).toBe('block');
    expect(
      value('.view:not([data-ready])[data-wall="on"] .grid-block', 'display', [PRE_HYDRATION]),
    ).toBe('none');
  });

  it('keeps the switch in its place, hidden, until it works', () => {
    expect(value('.view:not([data-ready]) .switch', 'visibility')).toBe('hidden');
  });

  it('shows the grid alone without script', () => {
    expect(value('.switch, .wall-block', 'display', [NO_SCRIPT_MEDIA])).toBe('none');
    expect(value('.grid-block', 'display', [NO_SCRIPT_MEDIA])).toBe('block');
  });
});

describe('photo-grid.module.css', () => {
  const rules = styleRules(readCss(`${PHOTOS}/photo-grid.module.css`));

  it('hides Show all and shows its note without script', () => {
    expect(declaredValue(findRule(rules, '.more', [NO_SCRIPT_MEDIA]), 'display')).toBe('none');
    expect(declaredValue(findRule(rules, '.no-script-note', [NO_SCRIPT_MEDIA]), 'display')).toBe(
      'block',
    );
    expect(declaredValue(findRule(rules, '.no-script-note'), 'display')).toBe('none');
  });

  it("keeps the light outside the photo's clip, so its halo shows as on the wall", () => {
    expect(declaredValue(findRule(rules, '.frame'), 'overflow')).toBeUndefined();
    const clip = findRule(rules, '.clip');
    expect(declaredValue(clip, 'position')).toBe('absolute');
    expect(declaredValue(clip, 'inset')).toBe('0');
    expect(declaredValue(clip, 'overflow')).toBe('hidden');
    expect(declaredValue(clip, 'border-radius')).toBe('inherit');
    expect(declaredValue(findRule(rules, '.light'), 'box-shadow')).toBe(
      'inset 0 0 0 1px var(--brand-rim), 0 25px 50px -12px var(--brand-halo), 0 0 28px 0 var(--brand-halo)',
    );
  });

  it('lays two columns on a phone', () => {
    expect(
      declaredValue(findRule(rules, '.grid', ['@media (width < 40rem)']), 'grid-template-columns'),
    ).toBe('repeat(2, minmax(0, 1fr))');
  });
});

describe('photo-wall.module.css', () => {
  const rules = styleRules(readCss(`${PHOTOS}/photo-wall.module.css`));

  it("gives the wall's box one fixed height, the frame and the live wall alike", () => {
    expect(declaredValue(findRule(rules, '.viewport'), 'height')).toBe('clamp(26rem, 68vh, 44rem)');
  });

  it('never selects text while dragging, unprefixed', () => {
    expect(declaredValue(findRule(rules, '.viewport'), 'user-select')).toBe('none');
  });

  it("holds a hovered card still under reduced motion, with the hover rule's own selector", () => {
    const hover = '.viewport:not([data-dragging="true"]) .card:hover';
    expect(declaredValue(findRule(rules, hover, [FINE_POINTER_MEDIA]), 'translate')).toBe('0 -3px');
    expect(declaredValue(findRule(rules, hover, [REDUCED_MOTION_MEDIA]), 'translate')).toBe('none');
  });
});
