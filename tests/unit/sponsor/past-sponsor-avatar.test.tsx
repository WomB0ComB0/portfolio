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
 * @file Each sponsor avatar fetches a file at least as wide as it is drawn on hover. A past
 * sponsor's link scales it to 110%, and next.config.ts's imageSizes list 64w, so `sizes="64px"`
 * picked a 64px file and drew it at about 70px, soft, on 1x screens. A current sponsor's card
 * scales it to 102%, so `sizes="48px"` drew the 48w file at about 49px.
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

const PAST_SPONSOR = {
  login: 'octocat',
  name: 'The Octocat',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
  url: 'https://github.com/octocat',
  tier: { name: '$5 a month', monthlyPriceInDollars: 5 },
  createdAt: '2025-01-01T00:00:00Z',
  isActive: false,
  type: 'User',
} satisfies GitHubSponsorsData['sponsors'][number];

const PAST_SPONSORS: GitHubSponsorsData = {
  sponsors: [PAST_SPONSOR],
  totalCount: 1,
  totalMonthlyIncome: 0,
};

const CURRENT_SPONSORS: GitHubSponsorsData = {
  sponsors: [{ ...PAST_SPONSOR, isActive: true }],
  totalCount: 1,
  totalMonthlyIncome: 5,
};

/** The first capture of the first class on `element` that `pattern` matches, as a number. */
function classNumber(element: Element, pattern: RegExp): number {
  for (const name of element.classList) {
    const value = pattern.exec(name)?.[1];
    if (value !== undefined) return Number(value);
  }
  throw new Error(`no class matching ${pattern} on <${element.tagName.toLowerCase()}>`);
}

/** The hover scale a link's classes give it: `hover:scale-110` is 1.1, `hover:scale-[1.02]` 1.02. */
function hoverScaleOf(link: Element): number {
  for (const name of link.classList) {
    const [, percent, factor] =
      /^(?:motion-safe:)?hover:scale-(?:(\d+)|\[([\d.]+)\])$/.exec(name) ?? [];
    if (percent !== undefined) return Number(percent) / 100;
    if (factor !== undefined) return Number(factor);
  }
  throw new Error('the link has no hover scale');
}

const sizesPx = (image: HTMLElement): number =>
  Number(/^(\d+)px$/.exec(image.getAttribute('sizes') ?? '')?.[1] ?? Number.NaN);

/** The srcset's widths, narrowest first. */
const srcsetWidths = (image: HTMLElement): number[] =>
  [...(image.getAttribute('srcset') ?? '').matchAll(/\s(\d+)w(?:,|$)/g)]
    .map(([, width = '']) => Number(width))
    .sort((a, b) => a - b);

/** The avatar, its frame (whose classes give its drawn width) and the link that scales it. */
function avatarParts(name: string) {
  const avatar = screen.getByRole('img', { name });
  const frame = avatar.parentElement;
  const link = avatar.closest('a');
  if (!(frame && link)) throw new Error('the avatar has no frame or link');
  return { avatar, frame, link };
}

afterEach(cleanup);

describe("a past sponsor's avatar", () => {
  it('asks for a file at least as wide as the avatar is drawn at its hover scale', () => {
    render(<SponsorLists sponsors={PAST_SPONSORS} />);
    const { avatar, frame, link } = avatarParts("The Octocat's avatar");

    const drawn = classNumber(frame, /^w-(\d+)$/) * TAILWIND_SPACING_PX;

    expect(drawn).toBe(64);
    expect(hoverScaleOf(link)).toBe(1.1);
    expect(sizesPx(avatar)).toBeGreaterThanOrEqual(drawn * hoverScaleOf(link));
  });

  it('so a 1x screen fetches the 96w file, not the 64w one', () => {
    render(<SponsorLists sponsors={PAST_SPONSORS} />);
    const avatar = screen.getByRole('img', { name: "The Octocat's avatar" });

    // A browser at 1x takes the narrowest candidate at least `sizes` wide.
    expect(srcsetWidths(avatar).find((width) => width >= sizesPx(avatar))).toBe(96);
  });
});

describe("a current sponsor's avatar", () => {
  it('asks for a file at least as wide as the avatar is drawn at its hover scale', () => {
    render(<SponsorLists sponsors={CURRENT_SPONSORS} />);
    const { avatar, frame, link } = avatarParts("The Octocat's avatar");

    const drawn = classNumber(frame, /^w-(\d+)$/) * TAILWIND_SPACING_PX;

    expect(drawn).toBe(48);
    expect(hoverScaleOf(link)).toBe(1.02);
    expect(sizesPx(avatar)).toBeGreaterThanOrEqual(drawn * hoverScaleOf(link));
  });

  it('so a 1x screen fetches the 64w file, not the 48w one', () => {
    render(<SponsorLists sponsors={CURRENT_SPONSORS} />);
    const avatar = screen.getByRole('img', { name: "The Octocat's avatar" });

    expect(srcsetWidths(avatar).find((width) => width >= sizesPx(avatar))).toBe(64);
  });
});
