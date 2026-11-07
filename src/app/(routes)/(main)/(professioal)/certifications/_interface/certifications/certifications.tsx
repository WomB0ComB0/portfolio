import 'server-only';
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
 * @file The /certifications page as the Ledger, rendered on the server: a PageShell header with
 * three figures, the Featured row when the owner featured certificates in Studio, then the filter
 * island holding the server-rendered rows. The URL's filters are resolved here, so a shared link
 * is right in the server HTML. A failed load is not caught here; it reaches the route's error
 * page inside the shell.
 */

import type { ReactElement } from 'react';

import { PageShell } from '@/components/console';
import type { Certification } from '@/hooks/sanity/schemas';
import { FeaturedRow } from '../../_components/featured-row';
import { EMPTY_CLASS } from '../../_components/ledger-classes';
import { LedgerExplorer, type LedgerRowItem } from '../../_components/ledger-explorer';
import { LEDGER_TITLE, LedgerStatStrip, sublineOf } from '../../_components/ledger-header';
import { LedgerRow } from '../../_components/ledger-row';
import { type RawFilters, resolveFilters } from '../../_lib/filters';
import { buildLedger } from '../../_lib/ledger';

export interface CertificationsProps {
  readonly certifications: readonly Certification[];
  /** The page's ?issuer, ?skill and ?q, as Next passes them. */
  readonly searchParams: RawFilters;
}

/** Every certificate in the Ledger, filtered by the URL. */
export function Certifications({
  certifications,
  searchParams,
}: CertificationsProps): ReactElement {
  const ledger = buildLedger(certifications);
  const initial = resolveFilters(searchParams, ledger);
  const rows: LedgerRowItem[] = ledger.entries.map((entry) => ({
    id: entry.id,
    year: entry.year,
    familySlug: entry.familySlug,
    chip: entry.chip,
    skills: entry.skills,
    haystack: entry.haystack,
    row: <LedgerRow entry={entry} />,
  }));

  return (
    <PageShell
      title={LEDGER_TITLE}
      description={sublineOf(ledger.stats.since)}
      stats={<LedgerStatStrip stats={ledger.stats} />}
    >
      <FeaturedRow entries={ledger.featured} />
      {rows.length === 0 ? (
        <div data-state="empty" className={EMPTY_CLASS}>
          <p className="tile-sub text-muted-foreground">No certificates are listed yet.</p>
        </div>
      ) : (
        // The island follows the URL itself (Back, links, router.push), so it needs no key.
        <LedgerExplorer
          rows={rows}
          chips={ledger.chips}
          other={ledger.other}
          index={ledger.index}
          initial={initial}
        />
      )}
    </PageShell>
  );
}
Certifications.displayName = 'Certifications';

export default Certifications;
