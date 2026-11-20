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
 * @file What the 2026-11-20 accessibility audit asked of the legal pages:
 * - each card's title is a real heading, so the outline runs h1, h2, h3, h4 with no level skipped
 *   (WCAG 1.3.1, 2.4.6);
 * - a link inside a sentence is underlined at rest, not told apart by colour alone (1.4.1);
 * - the privacy contact link is named by the address it shows (2.5.3);
 * - the "•" glyphs before list items stay out of what a screen reader reads.
 */

import { cleanup, render, screen } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Cookies } from '@/app/(routes)/(legal)/cookies/_interface/cookies/cookies';
import { Licenses } from '@/app/(routes)/(legal)/licenses/_interface/licenses/licenses';
import { Privacy } from '@/app/(routes)/(legal)/privacy/_interface/privacy/privacy';
import { emailHref, encodedEmail } from '@/constants/app';

const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children?: ReactNode }) => children,
}));
// The card's hover effect is not under test.
vi.mock('@/components/magicui/magic-card', () => ({ MagicCard: passThrough }));

afterEach(cleanup);

/** Every heading in document order, as [level, name]. */
const outlineOf = (Page: () => JSX.Element): (readonly [number, string])[] => {
  render(<Page />);
  return screen
    .getAllByRole('heading')
    .map(
      (heading) => [Number(heading.tagName.slice(1)), heading.textContent?.trim() ?? ''] as const,
    );
};

/** The levels never step down by more than one (h2 straight to h4 skips a level). */
const skippedLevels = (outline: readonly (readonly [number, string])[]): string[] =>
  outline.flatMap(([level, name], index) => {
    const previous = outline[index - 1]?.[0] ?? 0;
    return level > previous + 1 ? [`${name} (h${previous} to h${level})`] : [];
  });

/** The address the page shows, decoded from its character references. */
const EMAIL = encodedEmail.replaceAll(/&#(\d+);/g, (_match, dec: string) =>
  String.fromCodePoint(Number(dec)),
);

describe('legal page outlines', () => {
  it('gives /privacy one h2 per card, with its two subsections as h3s', () => {
    const outline = outlineOf(Privacy);

    expect(outline).toEqual([
      [1, 'Privacy Policy'],
      [2, 'Information We Collect'],
      [3, 'Information You Provide to Us'],
      [3, 'Information We Collect Automatically'],
      [2, 'How We Use Your Information'],
      [2, 'Sharing of Your Information'],
      [2, 'Third-Party Services'],
      [2, 'Data Security and Retention'],
      [2, 'Your Data Rights'],
      [2, "Children's Privacy"],
      [2, 'Changes to This Privacy Policy'],
      [2, 'Contact Us'],
    ]);
    expect(skippedLevels(outline)).toEqual([]);
  });

  it('puts the two kinds of cookie under "Types of Cookies We Use", above their h4s', () => {
    const outline = outlineOf(Cookies);

    expect(outline).toEqual([
      [1, 'Cookies Policy'],
      [2, 'What Are Cookies?'],
      [2, 'How We Use Cookies'],
      [2, 'Types of Cookies We Use'],
      [3, 'Strictly Necessary Cookies'],
      [4, 'Firebase Authentication'],
      [3, 'Performance and Analytics Cookies'],
      [4, 'Google Analytics'],
      [4, 'Vercel Analytics'],
      [4, 'Vercel Speed Insights'],
      [2, 'Your Choices and How to Manage Cookies'],
      [2, 'Changes to This Cookie Policy'],
      [2, 'Contact Us'],
    ]);
    expect(skippedLevels(outline)).toEqual([]);
  });

  it('gives /licenses one h2 per card, and one for the questions box after them', () => {
    const outline = outlineOf(Licenses);

    expect(outline.filter(([level]) => level === 2).map(([, name]) => name)).toEqual([
      'Blog Posts',
      'Code & Lab Projects',
      'Photography & Images',
      'Third-Party Licenses',
      'Questions or Permissions',
    ]);
    // The box sits after the Third-Party Licenses card, not inside it.
    expect(outline.at(-1)).toEqual([2, 'Questions or Permissions']);
    expect(skippedLevels(outline)).toEqual([]);
  });
});

describe('links inside sentences', () => {
  it('underlines the cookie policy link on /privacy at rest', () => {
    render(<Privacy />);

    expect(screen.getByRole('link', { name: 'Cookie Policy' })).toHaveClass('underline');
  });

  it.each(['www.aboutcookies.org', 'www.allaboutcookies.org', EMAIL])(
    'underlines %s on /cookies at rest',
    (name) => {
      render(<Cookies />);

      expect(screen.getByRole('link', { name })).toHaveClass('underline');
    },
  );
});

describe('the /privacy contact link', () => {
  it('is named by the address it shows, so saying the address activates it', () => {
    render(<Privacy />);
    const link = screen.getByRole('link', { name: EMAIL });

    expect(link).toHaveAttribute('href', emailHref);
    expect(link).not.toHaveAttribute('aria-label');
  });
});

describe('the /privacy bullets', () => {
  it('hides each "•" glyph from screen readers: the list already says it is a list', () => {
    const { container } = render(<Privacy />);
    const glyphs = Array.from(container.querySelectorAll('li > span')).filter(
      (span) => span.textContent === '•',
    );

    expect(glyphs.length).toBeGreaterThan(0);
    for (const glyph of glyphs) expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });
});
