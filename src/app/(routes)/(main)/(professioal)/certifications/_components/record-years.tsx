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
 * @file The record's years, which the filter island draws from the certificates it keeps: one
 * Folio chapter per year, newest first, sized by the one chapter system (the first is the page's
 * display numeral, later ones step down, a year of one is a heading on the rule). Each opener has
 * the year's sentence in words and, only for what nothing else says, a byline (each count is said
 * once: record.ts); a thin year sets its certificates large, a busy one groups them by issuer.
 * Server-safe (no directive, no hooks).
 */

import { Fragment, type ReactElement } from 'react';

import { ChapterOpener, chapterSize, countOf } from '@/components/console/folio';
import { ISSUER_NOUN, type SummaryPart, type YearChapter } from '../_lib/record';
import { BigCredentials } from './credential';
import { type BriefEntry, IssuerGroups } from './issuer-group';

/** A year's sentence, its names lifted to the foreground. */
function YearSummary({ parts }: { readonly parts: readonly SummaryPart[] }): ReactElement {
  return (
    <>
      {parts.map((part, index) =>
        part.name ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed sentence, never reordered.
          <em key={index}>{part.text}</em>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed sentence, never reordered.
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * The year's one count its opening does not say elsewhere: '12 issuers'. Never how many
 * certificates (its jump link says that, or the results line when a filter leaves one year), and
 * nothing when the sentence already names or counts every issuer ('IBM and MongoDB.', 'All 16
 * from Google.'), so 2024 reads 'Mostly Google: 16 of 26.' over '7 issuers'.
 */
function yearByline({ count, issuers, issuersSaid }: YearChapter<unknown>): string[] | undefined {
  if (count < 2 || issuers < 2 || issuersSaid) return undefined;
  return [countOf(issuers, ISSUER_NOUN)];
}

export interface RecordYearsProps {
  readonly chapters: readonly YearChapter<BriefEntry>[];
  /** Chapters already on the page above these (Featured), so the first year steps down. */
  readonly offset?: number;
}

/** The years, newest first. */
export function RecordYears({ chapters, offset = 0 }: RecordYearsProps): ReactElement {
  return (
    <>
      {chapters.map((chapter, index) => (
        <ChapterOpener
          key={chapter.id}
          id={chapter.id}
          title={chapter.year}
          size={chapterSize({ index: index + offset, count: chapter.count })}
          // The results head already leaves a pause before the first year.
          className={index === 0 ? 'mt-0' : undefined}
          summary={chapter.summary.length > 0 ? <YearSummary parts={chapter.summary} /> : undefined}
          byline={yearByline(chapter)}
        >
          {chapter.layout === 'thin' ? (
            <BigCredentials entries={chapter.entries} />
          ) : (
            <IssuerGroups groups={chapter.groups} chapterId={chapter.id} />
          )}
        </ChapterOpener>
      ))}
    </>
  );
}
