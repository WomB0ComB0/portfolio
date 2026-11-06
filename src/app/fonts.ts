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
 * @file The site's two typefaces, Geist and Geist Mono, self-hosted by next/font.
 *
 * next/font downloads them at build time and serves them from /_next/static/media, so the CSP's
 * font-src 'self' covers them. Each sets a CSS variable on <html> (src/app/layout.tsx), and
 * src/styles/globals.css maps `font-sans` and `font-mono` to those variables. The loader calls must
 * stay module-level const initialisers: next/font replaces them at compile time.
 */

import { Geist, Geist_Mono } from 'next/font/google';

/**
 * Geist: body text, headings and UI. Preloaded, since every page renders it first.
 *
 * No `fallback` list: under Turbopack an explicit list replaces next/font's metric-adjusted
 * 'Geist Fallback' face (local Arial with size-adjust and ascent/descent overrides), so text
 * would paint in an unadjusted system font and re-wrap when Geist swaps in. The generic sans
 * stack still follows, from --font-sans in src/styles/globals.css.
 */
export const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

/**
 * Geist Mono: figures, labels and code. Not preloaded, so it never competes with Geist for the
 * first paint; the system monospace stack stands in until it loads.
 *
 * It keeps that manual stack rather than an adjusted fallback. next/font's adjusted face is
 * always Arial (Times New Roman for serifs), and matching Geist Mono's 0.6em advance takes Arial
 * at 134.6%, which makes its digits about 0.75em wide and its capitals a third taller. System
 * monospace fonts already advance about 0.6em per character (Menlo, DejaVu Sans Mono, Courier
 * New; Consolas 0.55em), so figures and labels move far less when Geist Mono swaps in.
 */
export const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

/** Both variable class names, for the <html> element. */
export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;
