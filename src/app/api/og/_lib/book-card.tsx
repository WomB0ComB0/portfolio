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
 * @file A book's link-preview card, as next/og (Satori) draws it: one wide tile in the page
 * card's look (card-chrome.tsx), the cover at the left at the size the detail view draws it, and
 * beside it the site header, the stage, the title (stepped down a size as it grows, three lines
 * at most), the authors, the reading status and shelf as the site's badges, and the bookshelf's
 * address in the footer rail. The cover comes in as a data URI (cover-image.ts); the card draws
 * no other image.
 */

import type { ReactElement } from 'react';
import { OG_PALETTE as C } from '@/lib/og/palette';
import { clipText } from '@/lib/og/text';
import { BOOK_STATUS_LABELS, type BookStatus } from '@/sanity/bookshelf-rules';
import { type BookPreview, bookCardTitle } from './book-preview';
import {
  CANVAS,
  CardFooter,
  CardHeader,
  CoverImage,
  EYEBROW,
  Pill,
  type PillTone,
  TILE,
} from './card-chrome';

/** The cover's size on the card: the detail view's, so Sanity's CDN may have it already. */
export const BOOK_CARD_COVER = { width: 340, height: 445 } as const;

/** The longest authors line: about two lines beside the cover. */
const AUTHORS_MAX = 64;

/** Title sizes, largest first, each with the longest title it is used for. */
const TITLE_STEPS: ReadonlyArray<{ readonly upTo: number; readonly fontSize: number }> = [
  { upTo: 22, fontSize: 60 },
  { upTo: 48, fontSize: 50 },
];

/** The smallest title size: three lines of BOOK_CARD_TITLE_MAX characters beside the cover. */
const SMALLEST_TITLE = 42;

/** Each reading status in the tone of the site's status badge. */
const STATUS_TONES: Readonly<Record<BookStatus, PillTone>> = {
  completed: 'brand',
  reading: 'ongoing',
  queued: 'muted',
};

/** The size the card sets `title` in. */
const titleSize = (title: string): number =>
  TITLE_STEPS.find(({ upTo }) => title.length <= upTo)?.fontSize ?? SMALLEST_TITLE;

/** Props for {@link BookCard}. */
export interface BookCardProps {
  readonly preview: BookPreview;
  /** The cover as a data URI, BOOK_CARD_COVER in size. */
  readonly cover: string;
}

/** The stage, title, authors and badges beside the cover. */
function BookText({ preview }: { readonly preview: BookPreview }): ReactElement {
  const title = bookCardTitle(preview.title);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={EYEBROW}>{`STAGE ${preview.stageLabel}`}</div>
      <div
        style={{
          display: 'flex',
          marginTop: 14,
          fontSize: titleSize(title),
          fontWeight: 600,
          letterSpacing: '-0.035em',
          lineHeight: 1.08,
          color: C.fg,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 16,
          fontSize: 26,
          lineHeight: 1.3,
          color: C['fg-muted'],
        }}
      >
        {`by ${clipText(preview.authors, AUTHORS_MAX)}`}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <Pill tone={STATUS_TONES[preview.status]}>{BOOK_STATUS_LABELS[preview.status]}</Pill>
        <Pill tone="muted">{preview.shelf}</Pill>
      </div>
    </div>
  );
}

/** The card for one book: its cover beside what it is, under the site header. */
export function BookCard({ preview, cover }: BookCardProps): ReactElement {
  return (
    <div style={CANVAS}>
      <div
        style={{
          ...TILE,
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 44,
          padding: '0 48px 0 52px',
        }}
      >
        <CoverImage src={cover} {...BOOK_CARD_COVER} radius={14} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: 1,
            height: '100%',
            padding: '40px 0 34px',
          }}
        >
          <CardHeader label="Bookshelf" />
          <BookText preview={preview} />
          <CardFooter path="/bookshelf" />
        </div>
      </div>
    </div>
  );
}
