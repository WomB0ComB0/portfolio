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
 * @file Muted text that the darker H1 muted token (74% L, was 80%) pushed below WCAG AA's 4.5:1.
 * Ratios from the token-contrast test's OKLCH math, with translucent layers composited in sRGB:
 * - certification detail labels at text-muted-foreground/70 on the bg-card/40 card: 4.54:1, and
 *   4.44:1 under the hover spotlight (plain muted text: 8.16:1). The Ledger replaced those cards;
 *   its rows keep every muted line opaque;
 * - the privacy service rows' purpose on the bg-accent hover fill: 4.14:1 (foreground: 8.02:1);
 * - the photo viewer's drag hint, muted text at opacity-70 on the card: 4.49:1 (text-faint: 5.69:1).
 */

import { cleanup, render, screen } from '@testing-library/react';
import { makeCertification } from '@tests/fixtures/sanity-docs';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children?: ReactNode }) => children,
}));
// The card's hover spotlight is not under test.
vi.mock('@/components/magicui/magic-card', () => ({ MagicCard: passThrough }));

import { Privacy } from '@/app/(routes)/(legal)/privacy/_interface/privacy/privacy';
import { PlacePhotoViewer } from '@/app/(routes)/(main)/(personal)/places/[placeId]/_components/place-photo-viewer';
import type { ViewerPhoto } from '@/app/(routes)/(main)/(personal)/places/[placeId]/page.types';
import { LedgerRow } from '@/app/(routes)/(main)/(professioal)/certifications/_components/ledger-row';
import { ChipLink } from '@/app/(routes)/(main)/(professioal)/certifications/_components/ledger-toolbar';
import { buildLedger } from '@/app/(routes)/(main)/(professioal)/certifications/_lib/ledger';

/** Any translucent muted text colour, e.g. `text-muted-foreground/70`. */
const TRANSLUCENT_MUTED = /\btext-muted-foreground\/\d+/;

const [CERTIFICATION] = buildLedger([
  makeCertification({
    title: 'Azure Fundamentals',
    issuer: 'Microsoft',
    issueDate: '2024-03-01',
    credentialId: 'AZ-900-123',
    credentialUrl: 'https://learn.microsoft.com/x',
    skills: ['Azure'],
  }),
]).entries;

const PHOTOS: readonly ViewerPhoto[] = [
  { url: 'https://cdn.sanity.io/images/test/test/a-3000x4000.jpg?w=1600', alt: 'Photo of A' },
  { url: 'https://cdn.sanity.io/images/test/test/b-1600x1200.jpg?w=1600', alt: 'Photo of B' },
];

afterEach(cleanup);

describe('muted text stays at or above 4.5:1 on the H1 tokens', () => {
  it('a certification row in the Ledger sets no translucent muted text', () => {
    if (!CERTIFICATION) throw new Error('no certification built');
    const { container } = render(
      <table>
        <tbody>
          <LedgerRow entry={CERTIFICATION} />
        </tbody>
      </table>,
    );

    expect(screen.getByText('Microsoft · Mar 2024 · learn.microsoft.com')).toHaveClass(
      'text-muted-foreground',
    );
    const translucent = Array.from(container.querySelectorAll('[class]')).filter((element) =>
      TRANSLUCENT_MUTED.test(element.getAttribute('class') ?? ''),
    );
    expect(translucent).toEqual([]);
  });

  it("the current issuer chip's count lifts from faint to muted on the brand-subtle fill", () => {
    // fg-faint on brand-subtle is 4.27:1; fg-muted is 5.98:1 (token-contrast.test.ts).
    render(
      <ul>
        <ChipLink
          chip={{ slug: 'google', label: 'Google', count: 20 }}
          current
          href="/certifications?issuer=google"
          onSelect={() => undefined}
        />
      </ul>,
    );

    const count = screen.getByText('20');
    expect(count.closest('a')).toHaveAttribute('aria-current', 'true');
    expect(count).toHaveClass('text-faint', '[[aria-current=true]_&]:text-muted-foreground');
  });

  it('a privacy service purpose brightens with its row on hover', () => {
    render(<Privacy />);

    const purpose = screen.getByText('(Hosting and Analytics)');
    expect(purpose).toHaveClass('text-muted-foreground', 'group-hover:text-foreground');
    // group-hover only fires inside an element marked `group`: the row's link.
    expect(purpose.closest('a')).toHaveClass('group', 'hover:bg-accent');
  });

  it("the photo viewer's drag hint uses the faint text tier, not muted text at 70%", () => {
    render(<PlacePhotoViewer photos={PHOTOS} summary={<h2>A place</h2>} />);

    const hint = screen.getByText('← Drag to navigate →');
    expect(hint).toHaveClass('text-faint');
    expect(hint).not.toHaveClass('opacity-70');
  });
});
