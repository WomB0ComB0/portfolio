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
 * @file Every FilterBar select has an accessible name. Radix renders the trigger as a button with
 * role="combobox", and a combobox is not named by its text (that text is its value), so axe
 * reported each one on /projects, /certifications and /places as an unnamed button. The name
 * comes from the placeholder ("All Categories" gives "Filter by categories") unless the filter
 * passes its own label, and it is in the server HTML as well as after hydration.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import type { CertificationCardData } from '@/app/(routes)/(main)/(professioal)/certifications/_components/certifications-explorer';
import { CertificationsExplorer } from '@/app/(routes)/(main)/(professioal)/certifications/_components/certifications-explorer';
import { FilterBar, type FilterConfig } from '@/components/ui/filter-bar';

const noop = (): void => undefined;

const filterWith = (placeholder: string, label?: string): FilterConfig => ({
  value: 'all',
  onChange: noop,
  options: ['One', 'Two'],
  placeholder,
  icon: <span aria-hidden="true">#</span>,
  ...(label === undefined ? {} : { label }),
});

const bar = (filters: FilterConfig[]) => (
  <FilterBar
    searchQuery=""
    onSearchChange={noop}
    filters={filters}
    onClear={noop}
    hasActiveFilters={false}
    resultsCount={1}
    totalCount={1}
    entityName="things"
  />
);

const CERTIFICATION: CertificationCardData = {
  id: 'cert-1',
  title: 'Cloud Practitioner',
  issuer: 'Amazon Web Services',
  issueDate: '2025-01-15',
  expiryDate: null,
  credentialId: null,
  credentialUrl: null,
  description: null,
  skills: ['Cloud'],
  imageUrl: null,
  imageAlt: 'Cloud Practitioner badge',
};

afterEach(cleanup);

describe('FilterBar select names', () => {
  // The placeholders the /projects, /certifications and /places explorers pass today.
  it.each([
    ['All Categories', 'Filter by categories'],
    ['All Technologies', 'Filter by technologies'],
    ['All Issuers', 'Filter by issuers'],
    ['All Skills', 'Filter by skills'],
  ])('names the %s select "%s"', (placeholder, name) => {
    render(bar([filterWith(placeholder)]));

    expect(screen.getByRole('combobox', { name })).toBeInTheDocument();
  });

  it("uses a filter's own label when it passes one", () => {
    render(bar([filterWith('All Categories', 'Project category')]));

    expect(screen.getByRole('combobox', { name: 'Project category' })).toBeInTheDocument();
  });

  it('names each select of a bar separately', () => {
    render(bar([filterWith('All Categories'), filterWith('All Technologies')]));

    const names = screen.getAllByRole('combobox').map((box) => box.getAttribute('aria-label'));
    expect(names).toEqual(['Filter by categories', 'Filter by technologies']);
  });

  it('is in the server HTML, before hydration', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(bar([filterWith('All Issuers')]));

    expect(within(container).getByRole('combobox', { name: 'Filter by issuers' })).toBeTruthy();
  });

  it('leaves no select on /certifications unnamed', () => {
    render(
      <NuqsTestingAdapter>
        <CertificationsExplorer certifications={[CERTIFICATION]} />
      </NuqsTestingAdapter>,
    );

    const boxes = screen.getAllByRole('combobox');
    expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual([
      'Filter by issuers',
      'Filter by skills',
    ]);
  });
});
