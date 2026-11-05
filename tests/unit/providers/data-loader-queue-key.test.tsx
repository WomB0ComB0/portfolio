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
 * @file DataLoader shares one in-flight browser request between identical calls through the real
 * request queue. The query string comes from `params`, so two loads of one URL with different
 * params must not share: before the fix the queue's key left params out, and the second card got
 * the first card's answer.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { DataLoader } from '@/providers/server/effect-data-loader';
import { createQueryClient } from '@/providers/server/query-client';

const URL_PATH = '/api/v1/sanity/projects';

/** Answers each request with the `page` query parameter it was sent. */
const stubEchoPage = () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const requested = new URL(input instanceof Request ? input.url : String(input), 'http://x');
    return new Response(JSON.stringify({ page: requested.searchParams.get('page') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const PageCard = ({ page }: { page: string }) => (
  <DataLoader url={URL_PATH} params={{ page }}>
    {(data: { page: string | null }) => (
      <p>
        card {page} got page {String(data.page)}
      </p>
    )}
  </DataLoader>
);

describe('DataLoader request sharing', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not share a request between loads of one URL with different params', async () => {
    const fetchMock = stubEchoPage();

    render(
      <QueryClientProvider client={createQueryClient()()}>
        <Suspense fallback={<p>loading</p>}>
          <PageCard page="1" />
          <PageCard page="2" />
        </Suspense>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('card 1 got page 1')).toBeInTheDocument();
    expect(await screen.findByText('card 2 got page 2')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
