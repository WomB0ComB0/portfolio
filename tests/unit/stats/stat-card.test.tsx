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
 * @file The /stats card shell: each card is a labelled region with a real h2, so the page has a
 * heading outline, and its decorative header icon stays out of the accessibility tree.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { SiDiscord } from 'react-icons/si';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The full '@/components' barrel initialises Firebase; StatCard only needs MagicCard.
vi.mock('@/components', async () => ({
  MagicCard: (await import('@/components/magicui')).MagicCard,
}));

import { StatCard } from '@/app/(routes)/(dev)/stats/_components/stat-card';

afterEach(() => {
  cleanup();
});

describe('StatCard', () => {
  it('renders its title as an h2 that labels the card region', () => {
    render(
      <StatCard title="Discord Status" icon={<SiDiscord />}>
        <p>card body</p>
      </StatCard>,
    );

    const heading = screen.getByRole('heading', { level: 2, name: 'Discord Status' });
    const region = screen.getByRole('region', { name: 'Discord Status' });
    expect(region).toHaveAttribute('aria-labelledby', heading.id);
    expect(within(region).getByText('card body')).toBeInTheDocument();
  });

  it('gives each card its own label', () => {
    render(
      <>
        <StatCard title="GitHub Stats" icon={<SiDiscord />}>
          one
        </StatCard>
        <StatCard title="LeetCode Stats" icon={<SiDiscord />}>
          two
        </StatCard>
      </>,
    );

    expect(screen.getByRole('region', { name: 'GitHub Stats' })).toHaveTextContent('one');
    expect(screen.getByRole('region', { name: 'LeetCode Stats' })).toHaveTextContent('two');
  });

  it('hides the header icon, which carries role="img" and no name', () => {
    const { container } = render(
      <StatCard title="Discord Status" icon={<SiDiscord />}>
        body
      </StatCard>,
    );

    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('role', 'img');
    expect(icon?.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the footer when one is given', () => {
    render(
      <StatCard title="Dev Stats" icon={<SiDiscord />} footer={<span>footer text</span>}>
        body
      </StatCard>,
    );

    expect(
      within(screen.getByRole('region', { name: 'Dev Stats' })).getByText('footer text'),
    ).toBeInTheDocument();
  });
});
