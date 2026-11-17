/**
 * Copyright 2026 Mike Odnis
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InternalServerError } from '@/app/_client/errors/500';
import { ErrorLayout } from '@/app/_client/errors/error-layout';
import { RouteErrorView } from '@/app/_components/errors/route-error-view';
import GlobalError from '@/app/global-error';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
const NAME = 'Check service status (opens in a new tab)';
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('independent status links in failure views', () => {
  it.each([
    ['route', () => <RouteErrorView onRetry={vi.fn()} />],
    ['500', () => <InternalServerError error={new Error('private detail')} reset={vi.fn()} />],
    ['503', () => <ErrorLayout title="503" description="Service unavailable" />],
    ['global', () => <GlobalError error={new Error('private detail')} />],
  ])('%s has a native external status link with no provider or status request', (_name, view) => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    render(view());
    const link = screen.getByRole('link', { name: NAME });
    expect(link).toBeVisible();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://status.mikeodnis.dev');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('private detail')).toBeNull();
  });

  it.each(['401', '403', '404'])('%s keeps its navigation focus', (title) => {
    render(<ErrorLayout title={title} description="Unavailable page" />);
    expect(screen.queryByRole('link', { name: NAME })).toBeNull();
    expect(screen.getByRole('link', { name: /Go back home/ })).toHaveAttribute('href', '/');
  });

  it('retries a 500 once without also navigating to a relative URL', () => {
    const reset = vi.fn();
    render(<InternalServerError error={new Error('failed')} reset={reset} />);
    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry.tagName).toBe('BUTTON');
    expect(retry).not.toHaveAttribute('href');
    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('keeps the global fallback usable for an arbitrary thrown value', () => {
    render(<GlobalError error={null} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: NAME })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go back home' })).toHaveAttribute('href', '/');
  });

  it('uses Next’s retry callback for the global fallback when available', () => {
    const retry = vi.fn();
    render(<GlobalError error={new Error('failed')} retry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
