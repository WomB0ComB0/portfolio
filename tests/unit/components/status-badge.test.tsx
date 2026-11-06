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
 * @file The footer's StatusBadge. /api/status now counts the active monitors; when none is
 * active (every monitor paused) Better Stack still reports 'operational', so the badge must say
 * 'Monitoring paused' with a still, neutral dot rather than 'All Systems Operational'. An answer
 * the route flagged stale (its cached one, after Better Stack failed) says 'Last known: ...' with
 * a still dot. The query cache is seeded, or fetch stubbed where the decoding is checked.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusBadge, statusBadgeView } from '@/components/custom/status-badge';

// t3-env validates on import (through the Effect fetcher); these tests need no configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

const LAST_UPDATED = '2026-11-05T14:00:00.000Z';

afterEach(() => {
  vi.unstubAllGlobals();
});

type Answer = Parameters<typeof statusBadgeView>[0];

function renderBadge(data: NonNullable<Answer>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['system-status'], { success: true, message: 'ok', data });
  render(
    <QueryClientProvider client={client}>
      <StatusBadge />
    </QueryClientProvider>,
  );
  return screen.getByRole('link');
}

describe('statusBadgeView', () => {
  it('says Monitoring paused, neutral and still, when no monitor is active', () => {
    expect(
      statusBadgeView({
        state: 'operational',
        lastUpdated: LAST_UPDATED,
        monitors: { up: 0, total: 0 },
      }),
    ).toEqual({ label: 'Monitoring paused', color: 'bg-zinc-400', pulse: false });
  });

  it.each([
    ['operational', { up: 3, total: 3 }, 'All Systems Operational', 'bg-emerald-500'],
    ['operational', undefined, 'All Systems Operational', 'bg-emerald-500'],
    ['degraded', { up: 1, total: 2 }, 'Degraded Performance', 'bg-amber-500'],
    ['down', { up: 0, total: 2 }, 'Service Outage', 'bg-red-500'],
    ['unknown', undefined, 'Status Unknown', 'bg-zinc-400'],
  ] as const)('keeps the %s words with %o monitors', (state, monitors, label, color) => {
    expect(statusBadgeView({ state, lastUpdated: LAST_UPDATED, monitors })).toEqual({
      label,
      color,
      pulse: true,
    });
  });

  it('is Status Unknown before any answer', () => {
    expect(statusBadgeView(undefined)).toMatchObject({ label: 'Status Unknown' });
  });

  it.each([
    ['operational', { up: 3, total: 3 }, 'Last known: All Systems Operational', 'bg-emerald-500'],
    ['down', { up: 1, total: 2 }, 'Last known: Service Outage', 'bg-red-500'],
    ['operational', { up: 0, total: 0 }, 'Last known: Monitoring paused', 'bg-zinc-400'],
  ] as const)(
    'says a stale %s answer (%o monitors) is the last known one, without a pulse',
    (state, monitors, label, color) => {
      expect(statusBadgeView({ state, lastUpdated: LAST_UPDATED, monitors, stale: true })).toEqual({
        label,
        color,
        pulse: false,
      });
    },
  );

  it('never calls an unknown state last known', () => {
    expect(
      statusBadgeView({ state: 'unknown', lastUpdated: LAST_UPDATED, stale: true }),
    ).toMatchObject({ label: 'Status Unknown' });
  });
});

describe('StatusBadge', () => {
  it('names the link Monitoring paused, with no pulse, when every monitor is paused', () => {
    const link = renderBadge({
      state: 'operational',
      lastUpdated: LAST_UPDATED,
      monitors: { up: 0, total: 0 },
    });

    expect(link).toHaveAccessibleName('Monitoring paused');
    expect(link.querySelector('[aria-hidden="true"]')).not.toHaveClass('animate-pulse');
  });

  it('decodes the monitor counts and the stale flag /api/status answers', async () => {
    const body = {
      success: true,
      message: 'Status retrieved successfully',
      data: {
        state: 'operational',
        lastUpdated: LAST_UPDATED,
        monitors: { up: 3, total: 3 },
        stale: true,
      },
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <StatusBadge />
      </QueryClientProvider>,
    );

    const link = screen.getByRole('link');
    await waitFor(() => expect(link).toHaveAccessibleName('Last known: All Systems Operational'));
    expect(link.querySelector('[aria-hidden="true"]')).not.toHaveClass('animate-pulse');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('decodes the monitor counts, so every monitor paused reads Monitoring paused', async () => {
    const body = {
      success: true,
      message: 'Status retrieved successfully',
      data: { state: 'operational', lastUpdated: LAST_UPDATED, monitors: { up: 0, total: 0 } },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
      ),
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <StatusBadge />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole('link')).toHaveAccessibleName('Monitoring paused'));
  });

  it('still pulses beside All Systems Operational when monitors are up', () => {
    const link = renderBadge({
      state: 'operational',
      lastUpdated: LAST_UPDATED,
      monitors: { up: 3, total: 3 },
    });

    expect(link).toHaveAccessibleName('All Systems Operational');
    expect(link.querySelector('[aria-hidden="true"]')).toHaveClass('animate-pulse');
  });
});
