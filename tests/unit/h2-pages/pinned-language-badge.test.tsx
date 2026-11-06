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
 * @file A pinned repo's language badge sits on an opaque token pair. H2 moved the outline Badge
 * to muted text, and PinnedRepos painted that badge with its own bg-primary/30: muted text on a
 * translucent brand fill halved its contrast, and where color-mix() is missing Tailwind paints
 * the fill solid brand, which made it unreadable. The default badge (brand-subtle fill,
 * brand-ink text) is opaque and passes 4.5:1 without color-mix().
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PinnedRepos } from '@/app/(routes)/(main)/(professioal)/projects/_components/pinned-repos';
import type { PinnedRepo } from '@/lib/api-integrations/get-repos';

/** A colour class with an opacity modifier: bg-primary/30, text-foreground/80. */
const OPACITY_MODIFIED = /^(?:bg|text)-[a-z-]+\/\d+$/;

const REPO: PinnedRepo = {
  name: 'grepo',
  description: 'Search your repos.',
  url: 'https://github.com/example/grepo',
  stargazerCount: 12,
  forkCount: 3,
  primaryLanguage: { name: 'TypeScript' },
};

const languageBadge = (): HTMLElement => {
  render(<PinnedRepos pinnedRepos={[REPO]} />);
  return screen.getByText('TypeScript');
};

afterEach(cleanup);

describe("a pinned repo's language badge", () => {
  it('uses the opaque brand-subtle fill and brand-ink text', () => {
    expect(languageBadge()).toHaveClass('bg-brand-subtle', 'text-brand-ink');
  });

  it('has no opacity-modified fill or text colour', () => {
    const classes = [...languageBadge().classList];

    expect(classes.filter((name) => OPACITY_MODIFIED.test(name))).toEqual([]);
  });

  it('is not the muted outline variant', () => {
    expect(languageBadge()).not.toHaveClass('text-muted-foreground');
  });
});
