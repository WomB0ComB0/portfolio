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
 * @file A shelf's link-preview card, as next/og (Satori) draws it: the book card's frame
 * (card-chrome.tsx) with the shelf's title, description and counts at the left, and the covers of
 * its first few books overlapping at the right, each later one on top. The covers come in as data
 * URIs (cover-image.ts), only the ones that loaded; the card draws no other image.
 */

import type { ReactElement } from 'react';
import { OG_PALETTE as C } from '@/lib/og/palette';
import { clipText } from '@/lib/og/text';
import { CANVAS, CardFooter, CardHeader, CoverImage, EYEBROW, Pill, TILE } from './card-chrome';
import { bookCount, type ShelfPreview } from './shelf-preview';

/** Each cover's size on the card (the 520x680 shape). */
export const SHELF_CARD_COVER = { width: 196, height: 256 } as const;

/** How far each cover starts after the one before it: they overlap by the rest. */
const COVER_STEP = 112;

/** The longest shelf title and description the card sets. */
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 120;

/** Title sizes, largest first, each with the longest title it is used for. */
const TITLE_STEPS: ReadonlyArray<{ readonly upTo: number; readonly fontSize: number }> = [
  { upTo: 16, fontSize: 60 },
  { upTo: 32, fontSize: 48 },
];
const SMALLEST_TITLE = 40;

const titleSize = (title: string): number =>
  TITLE_STEPS.find(({ upTo }) => title.length <= upTo)?.fontSize ?? SMALLEST_TITLE;

/** Props for {@link ShelfCard}. */
export interface ShelfCardProps {
  readonly preview: ShelfPreview;
  /** The covers that loaded, as data URIs, SHELF_CARD_COVER in size, in stage order. */
  readonly covers: readonly string[];
}

/** The covers side by side, each overlapping the one before it. */
function CoverFan({ covers }: { readonly covers: readonly string[] }): ReactElement {
  const width = SHELF_CARD_COVER.width + COVER_STEP * Math.max(0, covers.length - 1);
  return (
    <div style={{ display: 'flex', position: 'relative', width, height: SHELF_CARD_COVER.height }}>
      {covers.map((src, index) => (
        <CoverImage
          // biome-ignore lint/suspicious/noArrayIndexKey: a cover's place is its identity; two books may share one.
          key={index}
          src={src}
          {...SHELF_CARD_COVER}
          radius={12}
          style={{
            position: 'absolute',
            top: 0,
            left: index * COVER_STEP,
            border: `2px solid ${C.canvas}`,
          }}
        />
      ))}
    </div>
  );
}

/** The shelf's title, description and counts. */
function ShelfText({ preview }: { readonly preview: ShelfPreview }): ReactElement {
  const title = clipText(preview.title, TITLE_MAX);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={EYEBROW}>SHELF</div>
      <div
        style={{
          display: 'flex',
          marginTop: 14,
          fontSize: titleSize(title),
          fontWeight: 600,
          letterSpacing: '-0.035em',
          lineHeight: 1.05,
          color: C.fg,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 18,
          fontSize: 22,
          lineHeight: 1.4,
          color: C['fg-muted'],
        }}
      >
        {clipText(preview.description, DESCRIPTION_MAX)}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <Pill tone="muted">{bookCount(preview.bookCount)}</Pill>
        <Pill tone="brand">{`${preview.readCount} read`}</Pill>
      </div>
    </div>
  );
}

/** The card for one shelf: what it is beside its first covers, under the site header. */
export function ShelfCard({ preview, covers }: ShelfCardProps): ReactElement {
  return (
    <div style={CANVAS}>
      <div style={{ ...TILE, flex: 1, padding: '40px 52px 34px', justifyContent: 'space-between' }}>
        <CardHeader label="Bookshelf" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <ShelfText preview={preview} />
          <CoverFan covers={covers} />
        </div>
        <CardFooter path="/bookshelf" />
      </div>
    </div>
  );
}
