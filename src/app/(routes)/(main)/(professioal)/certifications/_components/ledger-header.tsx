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
 * @file The page header's words: the h1, the "since" subline and the counts as one small byline
 * (certificates, issuers after folding issuer families, and how many can be verified), in place
 * of the stat tiles: the work leads, counts sit in bylines. Server-safe.
 */

import type { ReactElement } from 'react';

import { Byline, type BylinePart, countOf, formatCount } from '@/components/console/folio';
import { CERTIFICATION_NOUN } from '../_lib/certification-filters';
import type { LedgerStats } from '../_lib/ledger';
import { ISSUER_NOUN } from '../_lib/record';

export const LEDGER_TITLE = 'Certifications';

/** "Courses and certificates since July 2022." (the earliest issue month). */
export const sublineOf = (since: string | null): string =>
  since ? `Courses and certificates since ${since}.` : 'Courses and certificates.';

/** '64 certificates · 17 issuers · 62 you can verify'; nothing for an empty page. */
function headerParts(stats: LedgerStats): BylinePart[] {
  if (stats.certificates === 0) return [];
  return [
    countOf(stats.certificates, CERTIFICATION_NOUN),
    countOf(stats.issuers, ISSUER_NOUN),
    stats.verifiable > 0 && `${formatCount(stats.verifiable)} you can verify`,
  ];
}

/** The header's counts, as a byline. */
export function LedgerByline({ stats }: { readonly stats: LedgerStats }): ReactElement | null {
  return <Byline parts={headerParts(stats)} />;
}
