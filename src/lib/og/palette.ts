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
 * @file The Live Console palette for the link-preview cards, which next/og (Satori) draws without
 * the stylesheet and without oklch(): each entry is the token of the same name in the first
 * `:root` block of src/styles/globals.css, converted to sRGB. tests/unit/seo/og-cards.test.tsx
 * recomputes every value from its token, so the two cannot drift apart. Palette only: no colour
 * here that the site does not use.
 */

/** Opaque tokens as #rrggbb, keyed by token name. */
export const OG_PALETTE = {
  canvas: '#0c0c14',
  'surface-1': '#15151f',
  'surface-2': '#1d1c2a',
  'surface-3': '#252534',
  hairline: '#2c2c3c',
  'hairline-strong': '#45455d',
  fg: '#e8e9ff',
  'fg-muted': '#a8a8c3',
  'fg-faint': '#8d8da1',
  brand: '#8884d5',
  'brand-ink': '#aaa8ee',
  'brand-subtle': '#2b284f',
  live: '#4bde81',
} as const;

/** The translucent tokens (a token's channels plus an alpha) as rgba(), keyed by token name. */
export const OG_TINTS = {
  'brand-glow': 'rgba(136, 132, 213, 0.09)',
  'brand-wash': 'rgba(136, 132, 213, 0.14)',
  'brand-edge': 'rgba(136, 132, 213, 0.18)',
  'live-tint': 'rgba(75, 222, 129, 0.12)',
} as const;
