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
 * @file The frame the book and shelf cards share, in the page card's Live Console look
 * (src/lib/og/cards.tsx): the tinted-black canvas with the brand's faint light in two corners, a
 * surface-1 tile with a hairline border, the wolf mark badge, the site name over a section label
 * beside the host pill, a hairline footer rail, and pills in the site's badge colours. CANVAS,
 * TILE and MarkBadge repeat cards.tsx's, which it does not export; keep the two the same.
 *
 * Palette only (src/lib/og/palette.ts), plus the reading status's amber (OG_ONGOING), which the
 * site's status badge uses and the page and site cards do not. Satori lays out flexbox only:
 * every element with more than one child sets display: flex.
 */

import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { app } from '@/constants/app';
import { SITE_HOST } from '@/lib/og/constants';
import { OG_PALETTE as C, OG_TINTS as T } from '@/lib/og/palette';
import { WolfMark } from '@/lib/og/wolf-mark';

const SANS = 'Geist';
const MONO = 'Geist Mono';

/**
 * The reading status's amber: `--ongoing` and `--ongoing-tint` in the first `:root` block of
 * src/styles/globals.css, in sRGB (Satori draws no oklch()). The status badge on the site draws
 * a book being read in it (book-status-badge.module.css). tests/unit/seo/og-bookshelf-cards
 * recomputes both from their tokens.
 */
export const OG_ONGOING = {
  ongoing: '#e7b45a',
  'ongoing-tint': 'rgba(231, 180, 90, 0.12)',
} as const;

/** The canvas with the brand's faint light in two corners, as cards.tsx draws it. */
export const CANVAS: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  padding: 36,
  gap: 20,
  backgroundColor: C.canvas,
  backgroundImage: `radial-gradient(circle at 12% 0%, ${T['brand-glow']} 0%, transparent 48%), radial-gradient(circle at 100% 100%, ${T['brand-glow']} 0%, transparent 42%)`,
  color: C.fg,
  fontFamily: SANS,
};

/** A tile: surface-1 with a hairline border, a touch lighter towards its top-left. */
export const TILE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 24,
  border: `1px solid ${C.hairline}`,
  backgroundColor: C['surface-1'],
  backgroundImage: `linear-gradient(160deg, ${C['surface-2']} 0%, ${C['surface-1']} 62%)`,
};

/** A small mono label in capitals, as the site index tile heads itself. */
export const EYEBROW: CSSProperties = {
  display: 'flex',
  fontFamily: MONO,
  fontSize: 17,
  letterSpacing: '0.08em',
  color: C['fg-faint'],
};

/** The wolf mark in a small canvas tile. */
function MarkBadge({ size }: { readonly size: number }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: Math.round(size / 4),
        border: `1px solid ${C.hairline}`,
        backgroundColor: C.canvas,
      }}
    >
      <WolfMark size={Math.round(size * 0.66)} />
    </div>
  );
}

/** The colours of a pill: the site's badge tones. */
export type PillTone = 'brand' | 'muted' | 'ongoing';

const PILL_TONES: Readonly<Record<PillTone, CSSProperties>> = {
  brand: {
    color: C['brand-ink'],
    backgroundColor: C['brand-subtle'],
    border: `1px solid ${T['brand-edge']}`,
  },
  muted: {
    color: C['fg-muted'],
    backgroundColor: C['surface-2'],
    border: `1px solid ${C.hairline}`,
  },
  ongoing: {
    color: OG_ONGOING.ongoing,
    backgroundColor: OG_ONGOING['ongoing-tint'],
    border: `1px solid ${C['hairline-strong']}`,
  },
};

/** A rounded mono label in one of the site's badge tones. */
export function Pill({
  tone,
  children,
}: {
  readonly tone: PillTone;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '7px 16px',
        borderRadius: 999,
        fontFamily: MONO,
        fontSize: 18,
        ...PILL_TONES[tone],
      }}
    >
      {children}
    </div>
  );
}

/** The card's header: the mark, the site name over the section's label, and the host pill. */
export function CardHeader({ label }: { readonly label: string }): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <MarkBadge size={48} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 600 }}>{app.name}</div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, color: C['fg-faint'] }}>
            {label}
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          padding: '8px 16px',
          borderRadius: 999,
          border: `1px solid ${T['brand-edge']}`,
          backgroundColor: T['brand-wash'],
          color: C['brand-ink'],
          fontFamily: MONO,
          fontSize: 17,
        }}
      >
        {SITE_HOST}
      </div>
    </div>
  );
}

/** The footer rail: the section's address in brand ink, the site's other hosts at the right. */
export function CardFooter({ path }: { readonly path: string }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTop: `1px solid ${C.hairline}`,
        fontFamily: MONO,
        fontSize: 15,
        color: C['fg-faint'],
      }}
    >
      <div style={{ display: 'flex', color: C['brand-ink'] }}>{`${SITE_HOST}${path}`}</div>
      <div style={{ display: 'flex' }}>*.mikeodnis.dev</div>
    </div>
  );
}

/** A cover image with a hairline frame, at the size it was fetched. */
export function CoverImage({
  src,
  width,
  height,
  radius,
  style,
}: {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly style?: CSSProperties;
}): ReactElement {
  return (
    // biome-ignore lint/performance/noImgElement: Satori draws the card; next/image has no place in it.
    <img
      src={src}
      width={width}
      height={height}
      alt=""
      style={{
        width,
        height,
        objectFit: 'cover',
        borderRadius: radius,
        border: `1px solid ${C['hairline-strong']}`,
        ...style,
      }}
    />
  );
}
