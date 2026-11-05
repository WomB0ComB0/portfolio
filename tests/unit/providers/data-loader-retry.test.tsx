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
 * @file DataLoader and useDataLoader leave retrying to the QueryClient's shared rule. DataLoader
 * used to combine fetcher `retries: 3` with its own `failureCount < 3`, so a failing endpoint
 * (Lanyard on /stats) was requested 16 times over about 40 s. It also wrapped the fetcher's
 * error, which dropped the HTTP status, so 4xx answers were retried as if they were network
 * failures. The Sanity hooks passed fetcher `retries: 2` on top of the query retry: 6 requests.
 *
 * Everything is wired as in production: the real createQueryClient()() and no boundary of the
 * test's own around DataLoader. PageErrorBoundary stands in for src/app/error.tsx.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { Component, type ReactNode, Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The shared queue rate-limits and deduplicates across tests; run each request directly.
vi.mock('@/lib/http-clients/request-queue', () => ({
  requestQueue: {
    enqueue: <T,>(_url: string, _method: string, run: () => Promise<T>) => run(),
  },
}));

import { useSanityExperiences } from '@/hooks/sanity/use-sanity-suspense';
import { FetcherError } from '@/lib/http-clients/effect-fetcher';
import { DataLoader, type DataLoaderErrorProps } from '@/providers/server/effect-data-loader';
import { createQueryClient } from '@/providers/server/query-client';

const PAGE_ERROR = 'the whole page failed';
const SIBLING = 'another card';

/** Stands in for src/app/error.tsx: an error that escapes a card replaces the whole page. */
class PageErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  render() {
    return this.state.crashed ? <p>{PAGE_ERROR}</p> : this.props.children;
  }
}

/** The production client, with only the retry delay shortened; whether to retry is unchanged. */
const productionClient = () => {
  const client = createQueryClient()();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retryDelay: 1 } });
  return client;
};

/** Answers every request with `status`; returns the mock so the requests can be counted. */
const stubStatus = (status: number) => {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify({ error: 'upstream said no' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** A card's ErrorComponent that shows the status of the error DataLoader hands it. */
const StatusError = ({ error }: DataLoaderErrorProps) => (
  <p role="alert">
    failed with status {String(error instanceof FetcherError ? error.status : undefined)}
  </p>
);

const renderOnPage = (card: ReactNode) =>
  render(
    <QueryClientProvider client={productionClient()}>
      <PageErrorBoundary>
        <Suspense fallback={<p>loading</p>}>{card}</Suspense>
        <p>{SIBLING}</p>
      </PageErrorBoundary>
    </QueryClientProvider>,
  );

const renderLoader = () =>
  renderOnPage(
    <DataLoader url="/api/v1/lanyard" ErrorComponent={StatusError}>
      {() => <p>loaded</p>}
    </DataLoader>,
  );

/** The way the experience pages read Sanity data: useDataLoader via createDataLoaderOptions. */
const SanityExperiences = () => {
  const { data } = useSanityExperiences();
  return <p>{data.length} experiences</p>;
};

describe('DataLoader retries', () => {
  beforeEach(() => {
    // React and the QueryCache log the expected failures on console.error.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests a failing endpoint at most twice, then shows its ErrorComponent with the status', async () => {
    const fetchMock = stubStatus(500);
    renderLoader();

    expect(await screen.findByRole('alert')).toHaveTextContent('failed with status 500');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The failure stayed inside the DataLoader.
    expect(screen.getByText(SIBLING)).toBeInTheDocument();
    expect(screen.queryByText(PAGE_ERROR)).not.toBeInTheDocument();
  });

  it.each([404, 429])('requests an endpoint answering %i once', async (status) => {
    const fetchMock = stubStatus(status);
    renderLoader();

    expect(await screen.findByRole('alert')).toHaveTextContent(`failed with status ${status}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still renders the data when the endpoint answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    renderLoader();

    expect(await screen.findByText('loaded')).toBeInTheDocument();
  });
});

describe('useDataLoader retries (Sanity hooks)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests a failing Sanity endpoint at most twice', async () => {
    const fetchMock = stubStatus(500);
    // useDataLoader is a bare suspense hook: its caller's boundary (here the page's) gets the error.
    renderOnPage(<SanityExperiences />);

    expect(await screen.findByText(PAGE_ERROR)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const paths = fetchMock.mock.calls.map(([input]) =>
      input instanceof Request ? input.url : String(input),
    );
    expect(paths.every((path) => path.includes('/api/v1/sanity/experiences'))).toBe(true);
  });

  it('requests a Sanity endpoint answering 404 once', async () => {
    const fetchMock = stubStatus(404);
    renderOnPage(<SanityExperiences />);

    expect(await screen.findByText(PAGE_ERROR)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
