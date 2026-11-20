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
 * @file axe on the three legal pages, which the 2026-11-20 audit fixed (#2 section titles as
 * headings, #7 underlined in-sentence links, #10 the contact link named by its address). Each is
 * a whole page with its h1, so heading-order (a best-practice rule, the one axe failed them on
 * before the fix) and empty-heading run as well as the WCAG A and AA set.
 *
 * The page components are rendered as legal-a11y.test.tsx renders them, MagicCard passed through.
 */

import { cleanup, render } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { afterEach, describe, it, vi } from 'vitest';

import { Cookies } from '@/app/(routes)/(legal)/cookies/_interface/cookies/cookies';
import { Licenses } from '@/app/(routes)/(legal)/licenses/_interface/licenses/licenses';
import { Privacy } from '@/app/(routes)/(legal)/privacy/_interface/privacy/privacy';
import { expectNoAxeViolations } from '../../utils/axe';

const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children?: ReactNode }) => children,
}));
// The card's hover effect is not under test.
vi.mock('@/components/magicui/magic-card', () => ({ MagicCard: passThrough }));

afterEach(cleanup);

/** The best-practice rules that fit a whole page's outline. */
const OUTLINE_RULES = { 'heading-order': true, 'empty-heading': true } as const;

describe('the legal pages under axe', () => {
  it.each<[string, () => JSX.Element]>([
    ['/privacy', Privacy],
    ['/cookies', Cookies],
    ['/licenses', Licenses],
  ])('finds nothing to fix on %s, its outline included', async (path, Page) => {
    const { container } = render(<Page />);

    await expectNoAxeViolations(container, { rules: OUTLINE_RULES, label: path });
  });
});
