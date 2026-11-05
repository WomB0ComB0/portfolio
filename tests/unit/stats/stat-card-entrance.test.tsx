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
 * @file When a /stats card fades and rises in. A loaded card mounted in the browser (a client
 * navigation, or data fetched after mount) plays the entrance; one hydrated from server HTML is
 * already in place and does not. A skeleton never plays it: it is a placeholder for the loaded
 * card, which plays its own entrance when it replaces it, so animating both shows the entrance
 * twice.
 */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { SiDiscord } from 'react-icons/si';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The skeletons' modules hold the loaded cards too, whose Try again refreshes the route.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The full '@/components' barrel initialises Firebase; StatCard only needs MagicCard.
vi.mock('@/components', async () => ({
  MagicCard: (await import('@/components/magicui')).MagicCard,
}));

import { DiscordSkeleton } from '@/app/(routes)/(dev)/stats/_components/discord';
import { GitHubStatsSkeleton } from '@/app/(routes)/(dev)/stats/_components/github-stats';
import { LeetCodeStatsSkeleton } from '@/app/(routes)/(dev)/stats/_components/leetcode-stats';
import { MonkeytypeStatsSkeleton } from '@/app/(routes)/(dev)/stats/_components/monkeytype-stats';
import { StatCard } from '@/app/(routes)/(dev)/stats/_components/stat-card';
import { DevStatsSkeleton } from '@/app/(routes)/(dev)/stats/_components/stats';

/**
 * The inline style motion writes on a card about to enter: hidden (opacity 0, not MagicCard's
 * 0.8 overlay) or lowered by the 20 px rise.
 */
const ENTRANCE_STYLE = /opacity:\s*0(?![.\d])|translateY\(20px\)/;

const entranceOf = (region: HTMLElement): string | undefined =>
  ENTRANCE_STYLE.exec(region.getAttribute('style') ?? '')?.[0];

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  cleanup();
});

describe('StatCard entrance', () => {
  it('fades and rises in a loaded card that mounts in the browser', () => {
    render(
      <StatCard title="Discord Status" icon={<SiDiscord />}>
        body
      </StatCard>,
    );

    expect(entranceOf(screen.getByRole('region', { name: 'Discord Status' }))).toBeDefined();
  });

  it('mounts a card without an entrance in the browser when told it has none', () => {
    render(
      <StatCard title="Discord Status" icon={<SiDiscord />} hasEntrance={false}>
        body
      </StatCard>,
    );

    expect(entranceOf(screen.getByRole('region', { name: 'Discord Status' }))).toBeUndefined();
  });

  it('keeps a loaded card hydrated from server HTML in place', async () => {
    const card = (
      <StatCard title="Discord Status" icon={<SiDiscord />}>
        body
      </StatCard>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(card);
    document.body.append(container);
    const onRecoverableError = vi.fn();

    expect(entranceOf(screen.getByRole('region', { name: 'Discord Status' }))).toBeUndefined();
    await act(async () => {
      root = hydrateRoot(container, card, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(entranceOf(screen.getByRole('region', { name: 'Discord Status' }))).toBeUndefined();
    container.remove();
  });
});

describe('/stats skeletons', () => {
  const skeletons: ReadonlyArray<[string, () => ReactElement]> = [
    ['GitHubStatsSkeleton', GitHubStatsSkeleton],
    ['LeetCodeStatsSkeleton', LeetCodeStatsSkeleton],
    ['MonkeytypeStatsSkeleton', MonkeytypeStatsSkeleton],
    ['DevStatsSkeleton', DevStatsSkeleton],
    ['DiscordSkeleton', DiscordSkeleton],
  ];

  it.each(skeletons)('%s mounts in the browser with no entrance on any card', (_, Skeleton) => {
    render(<Skeleton />);

    const regions = screen.getAllByRole('region');
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.map(entranceOf)).toEqual(regions.map(() => undefined));
  });
});
