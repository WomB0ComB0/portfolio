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
 * @file The Ledger header's words and figures: the h1, the "since" subline and the three-figure
 * stat strip (certificates, issuers after
 * folding issuer families, and how many have a credential link). Server-safe.
 */

import type { ReactElement } from 'react';

import { StatStrip } from '@/components/console';
import type { LedgerStats } from '../_lib/ledger';

export const LEDGER_TITLE = 'Certifications';
const STATS_LABEL = 'Totals';

/** "Courses and certificates since July 2022." (the earliest issue month). */
export const sublineOf = (since: string | null): string =>
  since ? `Courses and certificates since ${since}.` : 'Courses and certificates.';

/** The header's three figures. */
export function LedgerStatStrip({ stats }: { readonly stats: LedgerStats }): ReactElement {
  return (
    <StatStrip
      aria-label={STATS_LABEL}
      items={[
        { label: 'certificates', value: stats.certificates },
        { label: 'issuers', value: stats.issuers },
        { label: 'with a link', value: stats.withLink },
      ]}
    />
  );
}
