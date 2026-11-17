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
 * @file The /certifications page as a Folio record, rendered on the server: a PageShell header
 * with its counts as one small byline, the Featured chapter when the owner featured certificates
 * in Studio, then the filter island with the year chapters. The URL's filters are resolved here,
 * so a shared link is right in the server HTML. A failed load is not caught here; it reaches the
 * route's error page inside the shell.
 */

import type { ReactElement } from 'react';

import { PageShell } from '@/components/console';
import { EMPTY_CLASS } from '@/components/console/filter-bar/filter-bar-classes';
import type { Certification } from '@/hooks/sanity/schemas';
import { FeaturedChapter } from '../../_components/featured-chapter';
import { LedgerExplorer } from '../../_components/ledger-explorer';
import { LEDGER_TITLE, LedgerByline, sublineOf } from '../../_components/ledger-header';
import { type RawFilters, resolveFilters } from '../../_lib/filters';
import { buildLedger } from '../../_lib/ledger';

export interface CertificationsProps {
  readonly certifications: readonly Certification[];
  /** The page's ?issuer, ?skill and ?q, as Next passes them. */
  readonly searchParams: RawFilters;
}

/** Every certificate as year chapters, filtered by the URL. */
export function Certifications({
  certifications,
  searchParams,
}: CertificationsProps): ReactElement {
  const ledger = buildLedger(certifications);
  const initial = resolveFilters(searchParams, ledger);

  return (
    <PageShell
      title={LEDGER_TITLE}
      description={sublineOf(ledger.stats.since)}
      stats={<LedgerByline stats={ledger.stats} />}
    >
      <FeaturedChapter entries={ledger.featured} />
      {ledger.entries.length === 0 ? (
        <div data-state="empty" className={EMPTY_CLASS}>
          <p className="tile-sub text-muted-foreground">No certificates are listed yet.</p>
        </div>
      ) : (
        // The island follows the URL itself (Back, links, router.push), so it needs no key.
        <LedgerExplorer
          rows={ledger.entries}
          chips={ledger.chips}
          other={ledger.other}
          index={ledger.index}
          initial={initial}
          leadTaken={ledger.featured.length > 0}
        />
      )}
    </PageShell>
  );
}
Certifications.displayName = 'Certifications';
