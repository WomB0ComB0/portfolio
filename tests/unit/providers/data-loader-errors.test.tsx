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
 * @file DataLoader keeps a failed first load inside itself and renders its ErrorComponent there.
 * Errors it catches no longer reach src/app/error.tsx, which reported them to Sentry, so it reports
 * the ones nothing else does: an answer its schema rejects, or a render bug in its children. A
 * failed fetch is not reported again: the API route reports its own upstream failure, and the
 * QueryCache logs it. PageErrorBoundary stands in for src/app/error.tsx.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { Schema } from 'effect';
import { Component, type ReactNode, Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ reportError: vi.fn((_error: unknown) => true) }));

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
vi.mock('@/lib/observability/report', () => ({ reportError: h.reportError }));

import { FetcherError, ValidationError } from '@/lib/http-clients/effect-fetcher';
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

const stubReply = (status: number, body: unknown) => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** Names the kind of error DataLoader handed its ErrorComponent. */
const KindError = ({ error }: Partial<DataLoaderErrorProps>) => (
  <p role="alert">failed: {error?.name}</p>
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

const expectPageIntact = () => {
  expect(screen.getByText(SIBLING)).toBeInTheDocument();
  expect(screen.queryByText(PAGE_ERROR)).not.toBeInTheDocument();
};

const Broken = (): ReactNode => {
  throw new TypeError('card render bug');
};

describe('DataLoader error handling', () => {
  beforeEach(() => {
    h.reportError.mockClear();
    // React and the QueryCache log the expected failures on console.error.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not report a failed fetch again: the API route reports its own failure', async () => {
    stubReply(500, { error: 'upstream said no' });
    renderOnPage(
      <DataLoader url="/api/v1/lanyard" ErrorComponent={KindError}>
        {() => <p>loaded</p>}
      </DataLoader>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('failed: FetcherError');
    expectPageIntact();
    expect(h.reportError).not.toHaveBeenCalled();
  });

  it('reports an answer the schema rejects, and shows an element ErrorComponent in place', async () => {
    const fetchMock = stubReply(200, { unexpected: true });
    renderOnPage(
      <DataLoader
        url="/api/v1/lanyard"
        schema={Schema.Struct({ discord_status: Schema.String })}
        ErrorComponent={<KindError />}
      >
        {() => <p>loaded</p>}
      </DataLoader>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('failed: ValidationError');
    expectPageIntact();
    // Asking again gets the same answer, so it is not retried.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(h.reportError).toHaveBeenCalledTimes(1);
    expect(h.reportError).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('reports a render bug in the children and keeps it inside the DataLoader', async () => {
    stubReply(200, { ok: true });
    renderOnPage(
      <DataLoader url="/api/v1/lanyard" ErrorComponent={KindError}>
        {() => <Broken />}
      </DataLoader>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('failed: TypeError');
    expectPageIntact();
    expect(h.reportError).toHaveBeenCalledWith(expect.any(TypeError));
    expect(h.reportError).not.toHaveBeenCalledWith(expect.any(FetcherError));
  });
});
