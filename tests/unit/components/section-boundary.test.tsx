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
 * @file SectionBoundary keeps a failure inside its section, retries with a route refresh (and a
 * reset of the section's client queries), reports only client-side failures, and lets Next's
 * notFound()/redirect() errors through. SectionError and RetryButton, which it builds on, are
 * covered here too, including the busy state while a retry loads.
 */

import {
  QueryClient,
  QueryClientProvider,
  type QueryKey,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Component, type ReactNode, Suspense, use, useEffect, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import {
  RetryButton,
  SECTION_ERROR_DESCRIPTION,
  SectionBoundary,
  SectionError,
} from '@/components/data';

const { refresh, reportError } = vi.hoisted(() => ({
  refresh: vi.fn(),
  reportError: vi.fn(() => true),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/observability/report', () => ({ reportError }));

const LABEL = 'top tracks';
const FALLBACK_TITLE = `Couldn't load ${LABEL}`;
const RAW_MESSAGE = 'Sanity responded 500 {"error":"upstream"}';

/** An error as Next delivers it from the server, or as notFound()/redirect() throw it. */
const withDigest = (digest: string): Error =>
  Object.assign(new Error(RAW_MESSAGE), { digest }) as Error;

/** What the section renders; each test makes it throw, and the retry test makes it recover. */
const sectionBody = vi.fn<() => ReactNode>();

function Section(): ReactNode {
  return sectionBody();
}

const failWith = (error: unknown): void => {
  sectionBody.mockImplementation(() => {
    throw error;
  });
};

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

/** A promise the test settles by hand, so a retry stays pending until it does. */
const deferred = <T,>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

/** Suspends until `pending` settles, then shows what it resolved to. */
function Loaded({ pending }: { pending: Promise<string> }): ReactNode {
  return <p>{use(pending)}</p>;
}

/** Holds `pending` until the first route refresh, then suspends on it inside that transition. */
function RefreshedRoute({ pending }: { pending: Promise<string> }): ReactNode {
  const [isRefreshed, setRefreshed] = useState(false);
  useEffect(() => {
    refresh.mockImplementation(() => setRefreshed(true));
  }, []);
  return (
    <>
      <RetryButton />
      {isRefreshed ? <Loaded pending={pending} /> : null}
    </>
  );
}

const TRACKS_KEY: QueryKey = ['top-tracks'];
/** Cached data the section fails to render, as a malformed Sanity image _ref does. */
const UNRENDERABLE = 'tracks the section cannot render';

/** A client section that reads its data with a plain useSuspenseQuery. */
function Tracks({ queryFn }: { queryFn: () => Promise<string> }): ReactNode {
  const { data } = useSuspenseQuery({ queryKey: TRACKS_KEY, queryFn, staleTime: 60_000 });
  if (data === UNRENDERABLE) throw new Error('cannot render the cached tracks');
  return <p>{data}</p>;
}

const renderWithQueries = (ui: ReactNode): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

interface OuterState {
  error: unknown;
}

/** Stands in for Next's not-found and redirect boundaries above a section. */
class OuterBoundary extends Component<{ children: ReactNode }, OuterState> {
  state: OuterState = { error: null };

  static getDerivedStateFromError(error: unknown): OuterState {
    return { error };
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const digest = (error as { digest?: string }).digest ?? 'none';
    return <p>outer boundary caught {digest}</p>;
  }
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  // React logs every caught render error; the failures below are deliberate.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  sectionBody.mockReset();
  refresh.mockReset();
  vi.clearAllMocks();
});

describe('SectionBoundary', () => {
  it('replaces only the failed section with "Couldn\'t load <label>"', () => {
    failWith(new Error(RAW_MESSAGE));

    render(
      <div>
        <p>Page header</p>
        <SectionBoundary label={LABEL}>
          <Section />
        </SectionBoundary>
        <p>Other section</p>
      </div>,
    );

    expect(screen.getByRole('heading', { level: 3, name: FALLBACK_TITLE })).toBeInTheDocument();
    expect(screen.getByText(SECTION_ERROR_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText('Page header')).toBeInTheDocument();
    expect(screen.getByText('Other section')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(RAW_MESSAGE);
  });

  it('Try again refreshes the route and renders the section again', () => {
    failWith(new Error(RAW_MESSAGE));
    render(
      <SectionBoundary label={LABEL}>
        <Section />
      </SectionBoundary>,
    );
    sectionBody.mockImplementation(() => <p>Section loaded</p>);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Section loaded')).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK_TITLE)).toBeNull();
  });

  it('disables Try again and marks it busy until the retried section has loaded', async () => {
    failWith(new Error(RAW_MESSAGE));
    const reload = deferred<string>();
    render(
      <SectionBoundary label={LABEL}>
        <Section />
      </SectionBoundary>,
    );
    sectionBody.mockImplementation(() => <Loaded pending={reload.promise} />);

    // Awaited: React drops a render that suspends inside a synchronous act scope.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });

    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(retry);
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => reload.resolve('Section loaded'));

    expect(await screen.findByText('Section loaded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('Try again fetches a failed suspense query again, so the section recovers', async () => {
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('503 from the API'))
      .mockResolvedValue('Top tracks loaded');
    renderWithQueries(
      <SectionBoundary label={LABEL}>
        <Suspense fallback={<p>Loading tracks</p>}>
          <Tracks queryFn={queryFn} />
        </Suspense>
      </SectionBoundary>,
    );
    await screen.findByText(FALLBACK_TITLE);
    expect(queryFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });

    expect(await screen.findByText('Top tracks loaded')).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(FALLBACK_TITLE)).toBeNull();
  });

  it('Try again resets queryKeys first, so cached data that failed to render is fetched again', async () => {
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce(UNRENDERABLE)
      .mockResolvedValue('Top tracks loaded');
    renderWithQueries(
      <SectionBoundary label={LABEL} queryKeys={[TRACKS_KEY]}>
        <Suspense fallback={<p>Loading tracks</p>}>
          <Tracks queryFn={queryFn} />
        </Suspense>
      </SectionBoundary>,
    );
    await screen.findByText(FALLBACK_TITLE);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });

    expect(await screen.findByText('Top tracks loaded')).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('reports a client-side failure once, tagged with the section label', () => {
    const error = new Error(RAW_MESSAGE);
    failWith(error);

    render(
      <SectionBoundary label={LABEL}>
        <Section />
      </SectionBoundary>,
    );

    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, { tags: { section: LABEL } });
  });

  it('does not report an error with a digest: the server already reported it', () => {
    failWith(withDigest('2207414537'));

    render(
      <SectionBoundary label={LABEL}>
        <Section />
      </SectionBoundary>,
    );

    expect(screen.getByText(FALLBACK_TITLE)).toBeInTheDocument();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports an error with an empty digest, which did not come from the server', () => {
    const error = withDigest('');
    failWith(error);

    render(
      <SectionBoundary label={LABEL}>
        <Section />
      </SectionBoundary>,
    );

    expect(screen.getByText(FALLBACK_TITLE)).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, { tags: { section: LABEL } });
  });

  it.each([
    'NEXT_HTTP_ERROR_FALLBACK;404',
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT;replace;/projects;307;',
  ])('rethrows %s to the boundary above, so notFound() and redirect() keep working', (digest) => {
    failWith(withDigest(digest));

    render(
      <OuterBoundary>
        <SectionBoundary label={LABEL}>
          <Section />
        </SectionBoundary>
      </OuterBoundary>,
    );

    expect(screen.getByText(`outer boundary caught ${digest}`)).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK_TITLE)).toBeNull();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('renders the fallback prop as is instead of the default, with no retry', () => {
    failWith(new Error(RAW_MESSAGE));

    render(
      <SectionBoundary label={LABEL} fallback={<p>Tracks are resting</p>}>
        <Section />
      </SectionBoundary>,
    );

    expect(screen.getByText('Tracks are resting')).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK_TITLE)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('still counts a thrown non-Error value as a failure', () => {
    failWith(undefined);

    render(
      <SectionBoundary label={LABEL}>
        <Section />
      </SectionBoundary>,
    );

    expect(screen.getByText(FALLBACK_TITLE)).toBeInTheDocument();
  });
});

describe('SectionError', () => {
  it('renders to a string without providers and prints no error text', () => {
    const html = renderToString(<SectionError title="x" />);

    expect(html).toContain('<h3');
    expect(html).toContain(SECTION_ERROR_DESCRIPTION);
    expect(html).not.toContain('Error:');
  });

  it('uses the requested heading level and renders the action slot', () => {
    render(
      <SectionError
        title="Couldn't load stats"
        description="Stats are on a break."
        headingLevel={2}
        action={<button type="button">Retry stats</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: "Couldn't load stats" })).toBeVisible();
    expect(screen.getByText('Stats are on a break.')).toBeInTheDocument();
    expect(screen.queryByText(SECTION_ERROR_DESCRIPTION)).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry stats' })).toBeInTheDocument();
  });
});

describe('RetryButton', () => {
  it('runs onRetry, then refreshes the route', () => {
    const onRetry = vi.fn();
    render(<RetryButton onRetry={onRetry} />);

    const button = screen.getByRole('button', { name: 'Try again' });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy');

    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.invocationCallOrder[0]).toBeLessThan(
      refresh.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it('stays disabled and busy until the refreshed route has rendered', async () => {
    const refreshed = deferred<string>();
    render(<RefreshedRoute pending={refreshed.promise} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });

    const button = screen.getByRole('button', { name: 'Try again' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => refreshed.resolve('Route refreshed'));

    expect(await screen.findByText('Route refreshed')).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('accepts its own label', () => {
    render(<RetryButton>Reload stats</RetryButton>);

    expect(screen.getByRole('button', { name: 'Reload stats' })).toBeInTheDocument();
  });
});
