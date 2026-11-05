/**
 * Copyright 2026 Mike Odnis
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
 * @file DataLoader never fetches during server rendering. It used to run its query on the
 * server, so every server render of a live widget fetched the site's own API route, and the
 * browser then threw that answer away (data, skeleton, data). Now the server HTML holds
 * LoadingComponent and the browser fetches once, unless a server component prefetched the query
 * behind a HydrationBoundary: then the data is in the server HTML and hydrates with no flash.
 */

import {
  type DehydratedState,
  dehydrate,
  HydrationBoundary,
  type QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Effect } from 'effect';
import { act, type ReactElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn(), loadingRenders: vi.fn() }));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The fetch is the effect-fetcher's `get`; the shared queue runs each request directly.
vi.mock('@/lib/http-clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http-clients')>()),
  get: h.get,
  requestQueue: {
    enqueue: <T,>(_url: string, _method: string, run: () => Promise<T>) => run(),
  },
}));

import { DataLoader } from '@/providers/server/effect-data-loader';
import { makeQueryClient } from '@/providers/server/query-client';

interface LiveStatus {
  readonly status: string;
}

const URL_PATH = '/api/v1/live-status';
const QUERY_KEY = ['live-status'] as const;
const ANSWER: LiveStatus = { status: 'online' };
const PREFETCHED: LiveStatus = { status: 'prefetched' };

/** The loading UI, counting its renders so a skeleton flash between two renders shows up. */
const Loading = (): ReactElement => {
  h.loadingRenders();
  return <p>loading</p>;
};

const card = (
  <DataLoader<LiveStatus> url={URL_PATH} queryKey={QUERY_KEY} LoadingComponent={<Loading />}>
    {(live: LiveStatus) => <p>{`status ${live.status}`}</p>}
  </DataLoader>
);

/** The card under its QueryClient, behind a HydrationBoundary when there is prefetched state. */
const page = (client: QueryClient, state?: DehydratedState): ReactElement => (
  <QueryClientProvider client={client}>
    {state ? <HydrationBoundary state={state}>{card}</HydrationBoundary> : card}
  </QueryClientProvider>
);

/**
 * What a server component's PrefetchBoundary hands the page: the dehydrated query, through a JSON
 * round trip as in the RSC payload.
 */
const prefetchedState = (): DehydratedState => {
  const server = makeQueryClient();
  server.setQueryData(QUERY_KEY, PREFETCHED);
  return JSON.parse(JSON.stringify(dehydrate(server))) as DehydratedState;
};

let root: Root | undefined;
let container: HTMLElement | undefined;

/** Puts `html` in the document and hydrates `ui` over it, as the browser does on a hard load. */
const hydrateInBrowser = async (html: string, ui: ReactElement) => {
  container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  const onRecoverableError = vi.fn();
  await act(async () => {
    root = hydrateRoot(container as HTMLElement, ui, { onRecoverableError });
  });
  return { view: container, onRecoverableError };
};

beforeEach(() => {
  h.get.mockReset();
  h.get.mockImplementation(() => Effect.succeed(ANSWER));
  h.loadingRenders.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container?.remove();
  container = undefined;
  cleanup();
});

describe('DataLoader on the server', () => {
  it('renders LoadingComponent into the server HTML and never fetches', () => {
    const html = renderToString(page(makeQueryClient()));

    expect(html).toContain('loading');
    expect(html).not.toContain('status');
    expect(h.get).not.toHaveBeenCalled();
  });

  it('renders prefetched data into the server HTML without fetching', () => {
    const html = renderToString(page(makeQueryClient(), prefetchedState()));

    expect(html).toContain('status prefetched');
    expect(html).not.toContain('loading');
    expect(h.get).not.toHaveBeenCalled();
  });
});

describe('DataLoader hydrating server HTML', () => {
  it('keeps prefetched data through hydration: no skeleton in between, no fetch while fresh', async () => {
    const state = prefetchedState();
    const html = renderToString(page(makeQueryClient(), state));
    h.loadingRenders.mockReset();

    const { view, onRecoverableError } = await hydrateInBrowser(
      html,
      page(makeQueryClient(), state),
    );

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(view).toHaveTextContent('status prefetched');
    expect(h.loadingRenders).not.toHaveBeenCalled();
    expect(h.get).not.toHaveBeenCalled();
  });

  it('hydrates the server skeleton, then fetches once in the browser', async () => {
    const html = renderToString(page(makeQueryClient()));
    expect(h.get).not.toHaveBeenCalled();

    const { view, onRecoverableError } = await hydrateInBrowser(html, page(makeQueryClient()));

    await waitFor(() => expect(view).toHaveTextContent('status online'));
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(h.get).toHaveBeenCalledTimes(1);
    expect(h.get).toHaveBeenCalledWith(URL_PATH, expect.anything(), expect.anything());
  });
});

describe('DataLoader mounted in the browser', () => {
  it('shows LoadingComponent until the fetch answers, then the data', async () => {
    let answer: (value: LiveStatus) => void = () => undefined;
    const answered = new Promise<LiveStatus>((resolve) => {
      answer = resolve;
    });
    h.get.mockImplementation(() => Effect.promise(() => answered));

    render(page(makeQueryClient()));

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByText(/^status/)).not.toBeInTheDocument();

    await act(async () => answer(ANSWER));

    expect(await screen.findByText('status online')).toBeInTheDocument();
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
    expect(h.get).toHaveBeenCalledTimes(1);
  });
});
