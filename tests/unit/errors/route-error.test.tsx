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
 * @file The (routes) error boundary shows a failed page's error inside the shell.
 *
 * It replaces only the page: one heading, a Try again that fetches the route again from the
 * server, and a way home. Client-side errors go to Sentry once; server errors (with a digest)
 * were already reported on the server. A noindex meta keeps a streamed error page out of indexes.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { RouteErrorView } from '@/app/_components/errors';
import RouteError from '@/app/(routes)/error';

const SERVER_DIGEST = '2604931812';

const serverError = (): Error & { digest: string } =>
  Object.assign(new Error('An error occurred in the Server Components render.'), {
    digest: SERVER_DIGEST,
  });

const robotsMeta = (): Element | null =>
  document.querySelector('meta[name="robots"][content="noindex"]');

beforeEach(() => {
  sentry.captureException.mockClear();
  router.refresh.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('src/app/(routes)/error.tsx', () => {
  it('renders one "Something went wrong" heading and a link home', () => {
    render(<RouteError error={new Error('render failed')} reset={vi.fn()} />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('renders inside the shell: no <main>, nav or full-screen wrapper of its own', () => {
    const { container } = render(<RouteError error={new Error('render failed')} reset={vi.fn()} />);

    expect(container.querySelector('main')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(container.innerHTML).not.toContain('min-h-screen');
  });

  it('Try again refetches the route from the server, then resets the boundary', () => {
    const reset = vi.fn();
    render(<RouteError error={new Error('render failed')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(router.refresh.mock.invocationCallOrder[0]).toBeLessThan(
      reset.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it('Try again is a button, not a link that reloads the page', () => {
    render(<RouteError error={new Error('render failed')} reset={vi.fn()} />);

    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry.tagName).toBe('BUTTON');
    expect(retry).toHaveAttribute('type', 'button');
    expect(retry).not.toHaveAttribute('href');
  });

  it('reports a client-side error to Sentry once', () => {
    const error = new Error('render failed');
    const reset = vi.fn();
    const { rerender } = render(<RouteError error={error} reset={reset} />);
    rerender(<RouteError error={error} reset={reset} />);

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('skips a server error, which carries a digest, and shows the digest as the error ID', () => {
    render(<RouteError error={serverError()} reset={vi.fn()} />);

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(screen.getByText(`Error ID: ${SERVER_DIGEST}`)).toBeInTheDocument();
  });

  it('shows no error ID for a client-side error', () => {
    render(<RouteError error={new Error('render failed')} reset={vi.fn()} />);

    expect(screen.queryByText(/Error ID/)).toBeNull();
  });

  it('handles a thrown value that is not an Error', () => {
    render(<RouteError error="plain string" reset={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong');
    expect(sentry.captureException).toHaveBeenCalledWith('plain string');
  });

  it('renders a robots noindex meta, so an error streamed under a 200 is not indexed', () => {
    render(<RouteError error={new Error('render failed')} reset={vi.fn()} />);

    expect(robotsMeta()).not.toBeNull();
  });
});

describe('RouteErrorView', () => {
  it('disables Try again and marks it busy while a retry is loading', () => {
    const onRetry = vi.fn();
    render(<RouteErrorView onRetry={onRetry} isRetrying />);

    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('enables Try again when no retry is loading', () => {
    const onRetry = vi.fn();
    render(<RouteErrorView onRetry={onRetry} />);

    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry).toBeEnabled();
    expect(retry).toHaveAttribute('aria-busy', 'false');
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('names its section after the heading', () => {
    render(<RouteErrorView onRetry={vi.fn()} digest={SERVER_DIGEST} />);

    const region = screen.getByRole('region', { name: 'Something went wrong' });
    expect(within(region).getByText(`Error ID: ${SERVER_DIGEST}`)).toBeInTheDocument();
  });
});
