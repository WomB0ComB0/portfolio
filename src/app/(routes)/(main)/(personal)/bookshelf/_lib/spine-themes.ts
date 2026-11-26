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
 * @file The spine bindings the stage draws behind each cover: the cap that holds the stage number,
 * the body, and the title, author and edge inks, all palette tokens. The catalog loader
 * (load-bookshelf.ts) gives each book one by its stage position, so neighbouring spines differ
 * and the real covers carry the colour. Pure and isomorphic; guarded by
 * tests/unit/bookshelf/load-bookshelf.test.ts and book-slot.test.tsx.
 */

export interface BookSpineTheme {
  /** Publisher or accent band at the top of the spine holding the stage number. */
  readonly capBg: string;
  readonly capText: string;
  /** Main spine body fill, title color, and subtle author ink. */
  readonly bodyBg: string;
  readonly titleColor: string;
  readonly authorColor: string;
  /** Subtle sheen tint along the hinge and outer edge. */
  readonly borderTint: string;
}

/** The bindings, from palette tokens only, in the order the stage cycles through them. */
const LIVE_CONSOLE_SPINE_THEMES: readonly [BookSpineTheme, ...BookSpineTheme[]] = [
  {
    capBg: 'var(--surface-3)',
    capText: 'var(--fg-muted)',
    bodyBg: 'var(--surface-1)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-faint)',
    borderTint: 'var(--hairline)',
  },
  {
    capBg: 'var(--brand-subtle)',
    capText: 'var(--brand-ink)',
    bodyBg: 'var(--surface-2)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-faint)',
    borderTint: 'var(--brand-edge)',
  },
  {
    capBg: 'var(--surface-2)',
    capText: 'var(--fg-faint)',
    bodyBg: 'var(--canvas)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-muted)',
    borderTint: 'var(--hairline-strong)',
  },
  {
    capBg: 'var(--brand-subtle)',
    capText: 'var(--fg)',
    bodyBg: 'var(--surface-1)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-muted)',
    borderTint: 'var(--hairline)',
  },
];

/** The binding for the book at zero-based `index`, cycling through the themes. */
export function getLiveConsoleSpineTheme(index: number): BookSpineTheme {
  const len = LIVE_CONSOLE_SPINE_THEMES.length;
  return LIVE_CONSOLE_SPINE_THEMES[((index % len) + len) % len] ?? LIVE_CONSOLE_SPINE_THEMES[0];
}
