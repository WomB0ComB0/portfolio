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
 * @file A past sponsor's avatar fetches a file at least as wide as it is drawn on hover. Its link
 * scales it to 110%, and next.config.ts's imageSizes list 64w, so `sizes="64px"` picked a 64px
 * file and drew it at about 70px, soft, on 1x screens.
 *
 * jsdom applies no CSS, so the drawn size is read from the classes that produce it.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { SponsorLists } from '@/app/(routes)/(dev)/sponsor/_components/sponsor-lists';
import type { GitHubSponsorsData } from '@/lib/api-integrations/github-sponsors';

const TAILWIND_SPACING_PX = 4;

const PAST_SPONSORS: GitHubSponsorsData = {
  sponsors: [
    {
      login: 'octocat',
      name: 'The Octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
      url: 'https://github.com/octocat',
      tier: { name: '$5 a month', monthlyPriceInDollars: 5 },
      createdAt: '2025-01-01T00:00:00Z',
      isActive: false,
      type: 'User',
    },
  ],
  totalCount: 1,
  totalMonthlyIncome: 0,
};

/** The first capture of the first class on `element` that `pattern` matches, as a number. */
function classNumber(element: Element, pattern: RegExp): number {
  for (const name of element.classList) {
    const value = pattern.exec(name)?.[1];
    if (value !== undefined) return Number(value);
  }
  throw new Error(`no class matching ${pattern} on <${element.tagName.toLowerCase()}>`);
}

const sizesPx = (image: HTMLElement): number =>
  Number(/^(\d+)px$/.exec(image.getAttribute('sizes') ?? '')?.[1] ?? Number.NaN);

afterEach(cleanup);

describe("a past sponsor's avatar", () => {
  it('asks for a file at least as wide as the avatar is drawn at its hover scale', () => {
    render(<SponsorLists sponsors={PAST_SPONSORS} />);
    const avatar = screen.getByRole('img', { name: "The Octocat's avatar" });
    const frame = avatar.parentElement;
    const link = avatar.closest('a');
    if (!(frame && link)) throw new Error('the avatar has no frame or link');

    const drawn = classNumber(frame, /^w-(\d+)$/) * TAILWIND_SPACING_PX;
    const hoverScale = classNumber(link, /^(?:motion-safe:)?hover:scale-(\d+)$/) / 100;

    expect(drawn).toBe(64);
    expect(sizesPx(avatar)).toBeGreaterThanOrEqual(drawn * hoverScale);
  });

  it('so a 1x screen fetches the 96w file, not the 64w one', () => {
    render(<SponsorLists sponsors={PAST_SPONSORS} />);
    const avatar = screen.getByRole('img', { name: "The Octocat's avatar" });
    const widths = [...(avatar.getAttribute('srcset') ?? '').matchAll(/\s(\d+)w(?:,|$)/g)]
      .map(([, width = '']) => Number(width))
      .sort((a, b) => a - b);

    // A browser at 1x takes the narrowest candidate at least `sizes` wide.
    expect(widths.find((width) => width >= sizesPx(avatar))).toBe(96);
  });
});
