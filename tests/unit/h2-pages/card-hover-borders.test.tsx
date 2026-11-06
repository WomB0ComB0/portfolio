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
 * @file Brand-bordered MagicCards keep their border on hover. H2 gave MagicCard a default
 * hover:border-hairline-strong, which tailwind-merge keeps beside a caller's border-primary (a
 * different variant), and `.hover\:border-hairline-strong:hover` outranks `.border-primary`. So
 * the résumé viewer (hovered the whole time the PDF iframe is read) and the sponsor page's
 * Monthly Support card turned from purple to grey on hover: less emphasis on cards you cannot
 * click. Each now names the same colour for hover as at rest.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { makeResume } from '@tests/fixtures/sanity-docs';
import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { SponsorLists } from '@/app/(routes)/(dev)/sponsor/_components/sponsor-lists';
import { Resume } from '@/app/(routes)/(main)/(professioal)/resume/_interface/resume/resume';
import type { GitHubSponsorsData } from '@/lib/api-integrations/github-sponsors';

/** border, border-2, border-t, border-x-4, border-[3px] and the styles: not colours. */
const WIDTH_OR_STYLE =
  /^border(?:-[xytrblse])?(?:-\d+|-\[[^\]]+\])?$|^border-(?:none|solid|dashed|dotted|double|hidden)$/;

const isBorderColour = (name: string): boolean =>
  name.startsWith('border-') && !WIDTH_OR_STYLE.test(name);

/** The border colour classes a card applies at rest and on hover, after tailwind-merge. */
function borderColours(card: Element): { rest: string[]; hover: string[] } {
  const classes = [...card.classList];
  return {
    rest: classes.filter(isBorderColour),
    hover: classes
      .filter((name) => name.startsWith('hover:'))
      .map((name) => name.slice('hover:'.length))
      .filter(isBorderColour),
  };
}

/** The MagicCard around an element: its root carries `group` for the spotlight. */
const cardAround = (element: Element): Element => {
  const card = element.closest('.group');
  if (!card) throw new Error('the element is not inside a MagicCard');
  return card;
};

const SPONSORS: GitHubSponsorsData = {
  sponsors: [
    {
      login: 'octocat',
      name: 'The Octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
      url: 'https://github.com/octocat',
      tier: { name: '$5 a month', monthlyPriceInDollars: 5 },
      createdAt: '2025-01-01T00:00:00Z',
      isActive: true,
      type: 'User',
    },
  ],
  totalCount: 1,
  totalMonthlyIncome: 5,
};

const RESUME = makeResume({
  pdfFile: { _type: 'file', asset: { _ref: 'file-0123abcd-pdf', _type: 'reference' } },
});

afterEach(cleanup);

describe('brand-bordered cards on hover', () => {
  it('the résumé viewer keeps its brand border while the PDF is pointed at', () => {
    render(<Resume resume={RESUME} />);

    const { rest, hover } = borderColours(cardAround(screen.getByTitle('Resume PDF')));

    expect(rest).toEqual(['border-primary']);
    expect(hover).toEqual(rest);
  });

  it("the sponsor page's Monthly Support card keeps its faint brand border", () => {
    render(<SponsorLists sponsors={SPONSORS} />);

    const { rest, hover } = borderColours(cardAround(screen.getByText('Monthly Support')));

    expect(rest).toEqual(['border-primary/20']);
    expect(hover).toEqual(rest);
  });
});
