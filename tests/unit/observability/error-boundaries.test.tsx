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
 * @file The App Router error boundaries report what they catch to Sentry from the browser.
 * Errors with a digest were thrown during server rendering and already reported there by
 * onRequestError, so the boundaries skip them.
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
// The real page pulls in the animated error layout; the boundary only needs something to render.
vi.mock('@/app/_client', () => ({ InternalServerError: () => <p>Something went wrong</p> }));
// next/error renders its own markup; global-error only wraps it in <html>.
vi.mock('next/error', () => ({ default: () => <p>Application error</p> }));

import ErrorBoundary from '@/app/error';
import GlobalError from '@/app/global-error';

type BoundaryError = Error & { digest?: string };

beforeEach(() => {
  sentry.captureException.mockClear();
  // React logs a warning for <html> inside the test container; it isn't under test.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  ['src/app/error.tsx', (error: BoundaryError) => <ErrorBoundary error={error} reset={vi.fn()} />],
  ['src/app/global-error.tsx', (error: BoundaryError) => <GlobalError error={error} />],
])('%s', (_name, renderBoundary) => {
  it('reports a client-side error to Sentry once', () => {
    const error = new Error('render failed');
    const { rerender } = render(renderBoundary(error));
    rerender(renderBoundary(error));
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('reports a new error caught after a reset', () => {
    const { rerender } = render(renderBoundary(new Error('first')));
    rerender(renderBoundary(new Error('second')));
    expect(sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it('skips errors from server rendering, which carry a digest', () => {
    render(renderBoundary(Object.assign(new Error('redacted'), { digest: '1234567890' })));
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
