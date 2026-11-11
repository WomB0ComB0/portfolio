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
 * @file Every filter control on /certifications has an accessible name. The old select bar
 * (src/components/ui/filter-bar.tsx) rendered Radix comboboxes that axe reported as unnamed
 * buttons; the FilterBar family that replaced it names its search and its chip list, and
 * tests/unit/console/filter-bar/server-html.test.tsx checks those names are in the server HTML.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { makeCertification } from '@tests/fixtures/sanity-docs';
import { afterEach, describe, expect, it, vi } from 'vitest';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { LedgerExplorer } from '@/app/(routes)/(main)/(professioal)/certifications/_components/ledger-explorer';
import { buildLedger } from '@/app/(routes)/(main)/(professioal)/certifications/_lib/ledger';
import { wideLayout } from '../console/filter-bar/wide-layout';

/** Undoes the wide layout a Ledger test lays out. */
let narrow: (() => void) | undefined;

afterEach(() => {
  cleanup();
  narrow?.();
  narrow = undefined;
});

describe('FilterBar names on /certifications', () => {
  it('leaves nothing unnamed on /certifications: a named search and a named chip list', () => {
    const ledger = buildLedger([makeCertification({ issuer: 'Amazon Web Services' })]);
    render(
      <LedgerExplorer
        rows={ledger.entries.map((entry) => ({ ...entry, row: <tr key={entry.id} /> }))}
        chips={ledger.chips}
        other={ledger.other}
        index={ledger.index}
        initial={{ issuer: null, skill: null, q: '' }}
      />,
    );
    // From a 48rem page the chips sit in the bar; jsdom computes no container query.
    narrow = wideLayout();

    expect(screen.queryAllByRole('combobox')).toEqual([]);
    expect(screen.getByRole('searchbox', { name: 'Search certificates' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Filter by issuer' })).toBeInTheDocument();
  });
});
