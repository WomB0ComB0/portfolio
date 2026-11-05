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
 * the first card's answer. Each shared request is decoded with the schema of the loader that
 * started it, so loads of one URL with different schemas must not share either: Effect drops the
 * fields a schema leaves out, and the second card got the first card's narrower result.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Schema } from 'effect';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { requestQueue } from '@/lib/http-clients/request-queue';
import { DataLoader } from '@/providers/server/effect-data-loader';
import { createQueryClient } from '@/providers/server/query-client';

const URL_PATH = '/api/v1/sanity/projects';

const TitleSchema = Schema.Struct({ title: Schema.String });
const TitleAndAuthorSchema = Schema.Struct({ title: Schema.String, author: Schema.String });
const ANSWER = { title: 'A Title', author: 'An Author' };

/** Holds every answer until `release`, so a second load asks while the first is in flight. */
const stubHeldAnswer = () => {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetchMock = vi.fn(async () => {
    await released;
    return new Response(JSON.stringify(ANSWER), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, release };
};

/** Resolves once the queue has been asked for URL_PATH `count` times. */
const queueAskedTimes = async (count: number) => {
  const enqueue = vi.mocked(requestQueue.enqueue);
  await waitFor(() =>
    expect(enqueue.mock.calls.filter(([url]) => url === URL_PATH)).toHaveLength(count),
  );
};

const TitleCard = ({ queryKey }: { queryKey?: readonly string[] }) => (
  <Suspense fallback={<p>loading title</p>}>
    <DataLoader url={URL_PATH} schema={TitleSchema} queryKey={queryKey}>
      {(data: typeof TitleSchema.Type) => <p>title card got {data.title}</p>}
    </DataLoader>
  </Suspense>
);

const AuthorCard = () => (
  <Suspense fallback={<p>loading author</p>}>
    <DataLoader url={URL_PATH} schema={TitleAndAuthorSchema}>
      {(data: typeof TitleAndAuthorSchema.Type) => <p>author card got {String(data.author)}</p>}
    </DataLoader>
  </Suspense>
);

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

  it('gives loads of one URL that decode with different schemas their own result', async () => {
    const { fetchMock, release } = stubHeldAnswer();
    vi.spyOn(requestQueue, 'enqueue');

    render(
      <QueryClientProvider client={createQueryClient()()}>
        <TitleCard />
        <AuthorCard />
      </QueryClientProvider>,
    );
    await queueAskedTimes(2);
    release();

    expect(await screen.findByText('title card got A Title')).toBeInTheDocument();
    expect(await screen.findByText('author card got An Author')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still shares one request between loads that decode with the same schema', async () => {
    const { fetchMock, release } = stubHeldAnswer();
    vi.spyOn(requestQueue, 'enqueue');

    // Different query keys, so TanStack runs both queries and only the queue can share them.
    render(
      <QueryClientProvider client={createQueryClient()()}>
        <TitleCard queryKey={['first-card']} />
        <TitleCard queryKey={['second-card']} />
      </QueryClientProvider>,
    );
    await queueAskedTimes(2);
    release();

    expect(await screen.findAllByText('title card got A Title')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
