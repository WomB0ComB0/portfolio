/**
 * Copyright 2026 Mike Odnis
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
 * @file Featured: the certificates the owner switched on in Studio (up to four, in display
 * order), as the page's first Folio chapter, each credential set large. It replaces the row of
 * tiles, so the Studio switch keeps working with no boxes. With none featured (as today) it
 * renders nothing at all, and the first year opens the page instead. Server-safe.
 */

import type { ReactElement } from 'react';

import { ChapterOpener, chapterSize, countOf } from '@/components/console/folio';
import { CERTIFICATION_NOUN } from '../_lib/certification-filters';
import { BigCredentials, type CredentialEntry } from './credential';

export const FEATURED_ID = 'featured';

export interface FeaturedChapterProps {
  /** Already capped and ordered by buildLedger. */
  readonly entries: readonly CredentialEntry[];
}

/** The featured certificates, or nothing when the owner has featured none. */
export function FeaturedChapter({ entries }: FeaturedChapterProps): ReactElement | null {
  if (entries.length === 0) return null;
  return (
    <div data-featured="">
      <ChapterOpener
        id={FEATURED_ID}
        title="Featured"
        size={chapterSize({ index: 0, count: entries.length })}
        className="mt-0"
        byline={entries.length > 1 ? [countOf(entries.length, CERTIFICATION_NOUN)] : undefined}
      >
        <BigCredentials entries={entries} />
      </ChapterOpener>
    </div>
  );
}
