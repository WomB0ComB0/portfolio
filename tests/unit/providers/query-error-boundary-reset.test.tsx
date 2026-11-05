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
 * @file Try again in a section boundary loads the section's data again. It used to clear only the
 * boundary: when a render threw after a successful fetch (a malformed Sanity image _ref is
 * enough), the remount rendered the same cached data within its staleTime and threw again, so
 * the button never worked until the cache went stale. QueryErrorBoundary now resets the
 * section's query keys first, and DataLoader resets its own query.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
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
vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  reportError: h.reportError,
}));

import {
  DataLoader,
  type DataLoaderErrorProps,
  dataLoaderQueryKey,
  QueryErrorBoundary,
  useDataLoader,
} from '@/providers/server/effect-data-loader';
import { createQueryClient } from '@/providers/server/query-client';

const URL_UNDER_TEST = '/api/v1/sanity/things';
const BROKEN = 'the cached answer this section cannot render';

interface Answer {
  readonly version: number;
}

/** Answers `{ version: 1 }`, then `{ version: 2 }` and so on: one version per request. */
const stubVersions = () => {
  let version = 0;
  const fetchMock = vi.fn(async () => {
    version += 1;
    return new Response(JSON.stringify({ version }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** A render bug that only the first answer triggers, as a malformed image _ref would. */
const renderVersion = ({ version }: Answer): ReactNode => {
  if (version === 1) throw new Error(BROKEN);
  return <p>version {version}</p>;
};

/** Reads the data the way the useSanity* hooks do, and renders it. */
const Section = () => <>{renderVersion(useDataLoader<Answer>(URL_UNDER_TEST).data)}</>;

/** Another section on the page, outside the failing section's boundary. */
const Sibling = () => <p>sibling {useDataLoader<Answer>('/api/v1/sanity/other').data.version}</p>;

/** A DataLoader ErrorComponent with a retry button. */
const RetryButton = ({ retry }: DataLoaderErrorProps) => (
  <button type="button" onClick={retry}>
    Retry card
  </button>
);

const renderInClient = async (ui: ReactNode) => {
  await act(async () => {
    render(<QueryClientProvider client={createQueryClient()()}>{ui}</QueryClientProvider>);
  });
};

const clickTryAgain = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

beforeEach(() => {
  h.reportError.mockClear();
  // React logs the render error the boundary catches on console.error.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('QueryErrorBoundary with the section query keys', () => {
  it('fetches again on Try again after a render error, and renders the fresh answer', async () => {
    const fetchMock = stubVersions();
    await renderInClient(
      <QueryErrorBoundary section="things" queryKeys={[dataLoaderQueryKey(URL_UNDER_TEST)]}>
        <Suspense fallback={<p>loading</p>}>
          <Section />
        </Suspense>
      </QueryErrorBoundary>,
    );
    expect(await screen.findByText("Couldn't load things right now.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await clickTryAgain('Try again');

    expect(await screen.findByText('version 2')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load things right now.")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The render bug is reported once; the retry that worked is not.
    expect(h.reportError).toHaveBeenCalledTimes(1);
  });

  it('resets only its own keys, so a sibling section keeps its data', async () => {
    const fetchMock = stubVersions();
    await renderInClient(
      <>
        <QueryErrorBoundary section="things" queryKeys={[dataLoaderQueryKey(URL_UNDER_TEST)]}>
          <Suspense fallback={<p>loading</p>}>
            <Section />
          </Suspense>
        </QueryErrorBoundary>
        <Suspense fallback={<p>sibling loading</p>}>
          <Sibling />
        </Suspense>
      </>,
    );
    await screen.findByText("Couldn't load things right now.");
    const sibling = (await screen.findByText(/^sibling \d$/)).textContent;

    await clickTryAgain('Try again');

    await screen.findByText(/^version \d$/);
    expect(screen.getByText(/^sibling \d$/).textContent).toBe(sibling);
    // One request each, then one for the section's retry.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('DataLoader', () => {
  it('fetches again on retry after a render error in its children', async () => {
    const fetchMock = stubVersions();
    await renderInClient(
      <DataLoader<Answer> url={URL_UNDER_TEST} ErrorComponent={RetryButton}>
        {renderVersion}
      </DataLoader>,
    );
    await screen.findByRole('button', { name: 'Retry card' });

    await clickTryAgain('Retry card');

    expect(await screen.findByText('version 2')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
