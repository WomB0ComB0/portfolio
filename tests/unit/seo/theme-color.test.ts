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
 * @file One theme colour everywhere: the page background, so browser chrome blends with the page.
 *
 * The expected value is computed from the `--background` token in src/styles/globals.css (OKLCH
 * to sRGB, tests/fixtures/oklch.ts), so a change to the token without the constant, or the other
 * way round, fails here.
 */

import { oklchToHex, rootToken } from '@tests/fixtures/oklch';
import { describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import manifest from '@/app/manifest';
import { constructViewport, THEME_COLOR } from '@/utils/seo/meta';

describe('theme colour', () => {
  it('is the page background (--background in globals.css)', () => {
    expect(oklchToHex('oklch(100% 0 0)')).toBe('#ffffff');
    expect(THEME_COLOR.toLowerCase()).toBe(oklchToHex(rootToken('background')));
  });

  it('is emitted once by the viewport, with no light/dark variants', () => {
    const viewport = constructViewport();

    expect(viewport.themeColor).toBe(THEME_COLOR);
    expect(viewport.colorScheme).toBe('dark');
  });

  it('is the manifest theme and splash background colour too', () => {
    const { theme_color, background_color } = manifest();

    expect(theme_color).toBe(THEME_COLOR);
    expect(background_color).toBe(THEME_COLOR);
  });
});
