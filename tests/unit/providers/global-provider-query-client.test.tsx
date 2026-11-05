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
 * @file GlobalProvider keeps one QueryClient for the whole page load in the browser, and builds a
 * new one for every server render. The root src/app/loading.tsx used to put a Suspense boundary
 * between the provider and the pages; without it, a first hydration that suspends (a client chunk
 * still loading) has no boundary below the provider, so React throws the uncommitted tree away,
 * provider state included, and renders it again. A client kept in useState was then built twice,
 * and whatever the first render had put in it was lost.
 */

import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, type ReactElement, type ReactNode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  passThrough: ({ children }: { children?: ReactNode }) => children,
}));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
// The real factory module also pulls in the Elysia API app, which Vitest can't load. Like the
// real one in a client component (React's cache() memoizes nothing there), every call of the
// factory builds a new client.
vi.mock('@/providers/server', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { createQueryClient: () => () => new QueryClient() };
});
// Browser-only or analytics children of the provider; they play no part here.
vi.mock('@/app/_components', () => ({ WebVitals: () => null }));
vi.mock('@vercel/analytics/react', () => ({ Analytics: () => null }));
vi.mock('@tanstack/react-query-devtools', () => ({ ReactQueryDevtools: () => null }));
vi.mock('nuqs/adapters/next/app', () => ({ NuqsAdapter: h.passThrough }));
vi.mock('kbar', () => ({ KBarProvider: h.passThrough }));

import { GlobalProvider } from '@/app/_providers/global-provider';

/** Whether the page's code has loaded, and the promise a render waits on until it has. */
const chunk: { loaded: boolean; ready: Promise<void> } = { loaded: true, ready: Promise.resolve() };

/** Every QueryClient the page read, one entry per render. */
const seenClient = vi.fn<(client: QueryClient) => void>();

/** The page: it reads the QueryClient, and suspends while its chunk is still loading. */
const Page = (): ReactElement => {
  seenClient(useQueryClient());
  // A pending lazy chunk suspends the same way: React catches the thrown promise.
  if (!chunk.loaded) throw chunk.ready;
  return <p>page</p>;
};

const site = (): ReactElement => (
  <GlobalProvider>
    <Page />
  </GlobalProvider>
);

/** The page's code arrives later; returns the function that delivers it. */
const holdChunk = (): (() => void) => {
  let deliver: () => void = () => undefined;
  chunk.loaded = false;
  chunk.ready = new Promise<void>((resolve) => {
    deliver = () => {
      chunk.loaded = true;
      resolve();
    };
  });
  return deliver;
};

/** Renders `ui` as the server does, where there is no `window`. */
const renderOnServer = (ui: ReactElement): string => {
  vi.stubGlobal('window', undefined);
  try {
    return renderToString(ui);
  } finally {
    vi.unstubAllGlobals();
  }
};

const distinctClients = (): Set<QueryClient> =>
  new Set(seenClient.mock.calls.map(([client]) => client));

let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  seenClient.mockClear();
  chunk.loaded = true;
  chunk.ready = Promise.resolve();
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container?.remove();
  container = undefined;
});

describe('GlobalProvider QueryClient', () => {
  it('keeps one client when the first hydration suspends with no Suspense boundary below it', async () => {
    const html = renderOnServer(site());
    seenClient.mockClear();
    const deliverChunk = holdChunk();

    container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    await act(async () => {
      root = hydrateRoot(container as HTMLElement, site());
    });
    // The first hydration ran and suspended on the chunk.
    expect(seenClient).toHaveBeenCalled();

    await act(async () => deliverChunk());

    expect(container).toHaveTextContent('page');
    expect(seenClient.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(distinctClients().size).toBe(1);
  });

  it('builds a new client for every server render, so requests never share cached data', () => {
    renderOnServer(site());
    renderOnServer(site());

    expect(seenClient).toHaveBeenCalledTimes(2);
    expect(distinctClients().size).toBe(2);
  });
});
