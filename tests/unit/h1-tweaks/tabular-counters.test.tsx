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
 * @file Numbers that change while on screen use tabular figures. Geist's default digits are
 * proportional (a 1 is far narrower than a 0), and H1 removed the old blanket
 * `* { tabular-nums }` rule, so a counter without its own `tabular-nums` changes width as it
 * updates and the text around it jitters.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { makeCertification } from '@tests/fixtures/sanity-docs';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/core/auth', () => ({
  useCurrentUser: () => ({ displayName: 'Ada', email: 'ada@example.com' }),
  useSignIn: () => [vi.fn(), false],
  useSignOut: () => [vi.fn(), false],
}));
vi.mock('@/hooks', () => ({
  usePostMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/lib/http-clients/effect-fetcher', () => ({
  get: () => Effect.succeed({ json: { json: [] } }),
}));

import { GuestbookComponent } from '@/app/(routes)/(main)/(personal)/guestbook/_components/guestbook';
import { PlacePhotoViewer } from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer';
import type { ViewerPhoto } from '@/app/(routes)/(main)/(personal)/places/[placeId]/page.types';
import { LedgerExplorer } from '@/app/(routes)/(main)/(professioal)/certifications/_components/ledger-explorer';
import { buildLedger } from '@/app/(routes)/(main)/(professioal)/certifications/_lib/ledger';
import { FilterBar } from '@/components/ui/filter-bar';

const TABULAR = 'tabular-nums';

const PHOTOS: readonly ViewerPhoto[] = [
  { url: 'https://cdn.sanity.io/images/test/test/a-3000x4000.jpg?w=1600', alt: 'Photo of A' },
  { url: 'https://cdn.sanity.io/images/test/test/b-1600x1200.jpg?w=1600', alt: 'Photo of B' },
];

const LEDGER = buildLedger([
  makeCertification({ issuer: 'Amazon Web Services', issueDate: '2025-01-01' }),
  makeCertification({ issuer: 'Amazon Web Services', issueDate: '2024-01-01' }),
]);

const noop = (): void => undefined;

function renderGuestbook() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuestbookComponent />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('live counters use tabular figures', () => {
  it('the guestbook character counter, which updates on every keystroke', () => {
    renderGuestbook();

    fireEvent.change(screen.getByPlaceholderText("What's on your mind?"), {
      target: { value: 'Hello' },
    });

    expect(screen.getByText('5 / 280')).toHaveClass(TABULAR);
  });

  it('the guestbook message count, which changes when a message is posted', async () => {
    renderGuestbook();

    expect(await screen.findByText('0 messages')).toHaveClass(TABULAR);
  });

  it("the photo viewer's position and zoom readouts", () => {
    render(<PlacePhotoViewer photos={PHOTOS} summary={<h2>A place</h2>} />);

    expect(screen.getByText('Photo 1 of 2')).toHaveClass(TABULAR);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('120%')).toHaveClass(TABULAR);
  });

  it("FilterBar's results count", () => {
    render(
      <FilterBar
        searchQuery="cloud"
        onSearchChange={noop}
        filters={[]}
        onClear={noop}
        hasActiveFilters
        resultsCount={2}
        totalCount={15}
        entityName="projects"
      />,
    );

    expect(screen.getByText('Showing 2 of 15 projects')).toHaveClass(TABULAR);
  });

  it('the certifications chip counts and year counts, which follow the filters', () => {
    render(
      <LedgerExplorer
        rows={LEDGER.entries.map((entry) => ({ ...entry, row: <tr key={entry.id} /> }))}
        chips={LEDGER.chips}
        other={LEDGER.other}
        index={LEDGER.index}
        initial={{ issuer: null, skill: null, q: '' }}
      />,
    );
    const chips = screen.getByRole('list', { name: 'Filter by issuer' });

    for (const count of within(chips).getAllByText('2')) expect(count).toHaveClass(TABULAR);
    // tile-meta sets tabular figures itself (globals.css).
    expect(screen.getAllByText('1 certificate')[0]).toHaveClass('tile-meta');
  });
});
