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
 * @file The /stats Discord card's controls and decoration, as assistive tech sees them.
 * /api/v1/lanyard and /api/v1/now-playing are answered by a stubbed fetch.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
// The shared queue rate-limits now-playing across every test in the file.
vi.mock('@/lib/http-clients/request-queue', () => ({
  requestQueue: {
    enqueue: <T,>(_url: string, _method: string, run: () => Promise<T>) => run(),
  },
}));

import { Discord } from '@/app/(routes)/(dev)/stats/_components/discord';

const USER_ID = '42';
const vscode = {
  name: 'Visual Studio Code',
  type: 0,
  details: 'Editing discord.tsx',
  state: 'Workspace: portfolio',
};

const lanyard = (status: string, activities: unknown[]) => ({
  discord_user: { username: 'tester', discriminator: '0', avatar: 'abc123', id: USER_ID },
  activities,
  discord_status: status,
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const stubApi = (lanyardBody: unknown) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
      if (url.pathname === '/api/v1/lanyard') return json(lanyardBody);
      if (url.pathname === '/api/v1/now-playing') return json({ isPlaying: false });
      throw new Error(`unexpected request: ${url.pathname}`);
    }),
  );
};

const renderCard = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Discord />
    </QueryClientProvider>,
  );

const cardRegion = async () => {
  await screen.findByText('tester');
  return screen.getByRole('region', { name: 'Discord Status' });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Discord card accessibility', () => {
  it('makes Add Friend a link to the Discord profile that says it opens a new tab', async () => {
    stubApi(lanyard('online', []));
    renderCard();

    const region = await cardRegion();
    const link = within(region).getByRole('link', { name: 'Add Friend (opens in a new tab)' });
    expect(link).toHaveAttribute('href', `https://discord.com/users/${USER_ID}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(region).queryByRole('button', { name: /Add Friend/ })).not.toBeInTheDocument();
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('pings the online dot only when motion is allowed, and hides the dot', async () => {
    stubApi(lanyard('online', []));
    renderCard();

    const region = await cardRegion();
    const ping = region.querySelector('[class*="animate-ping"]');
    expect(ping).not.toBeNull();
    expect(ping).toHaveClass('motion-safe:animate-ping');
    expect(ping).not.toHaveClass('animate-ping');
    // The status is written out next to the avatar.
    expect(ping?.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(within(region).getByText('Online')).toBeInTheDocument();
  });

  it('hides the activity icon tile, which the row heading already names', async () => {
    stubApi(lanyard('dnd', [vscode]));
    renderCard();

    const list = await screen.findByRole('list', { name: 'Current activity' });
    expect(within(list).getByText('Playing Visual Studio Code')).toBeInTheDocument();
    // The VSCodium icon is a Simple Icons SVG with role="img" and no name.
    expect(list.querySelector('svg[role="img"]')).not.toBeNull();
    expect(within(list).queryByRole('img')).not.toBeInTheDocument();
  });

  it('leaves no unnamed images in the card', async () => {
    stubApi(lanyard('online', [vscode]));
    renderCard();

    const region = await cardRegion();
    await screen.findByRole('list', { name: 'Current activity' });
    for (const image of within(region).queryAllByRole('img')) {
      expect(image).toHaveAccessibleName();
    }
  });
});
