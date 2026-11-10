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
 * @file The link-preview cards in the Live Console look, as next/og (Satori) draws them: tiles
 * on surface-1 with a hairline border over the tinted-black canvas, Geist with Geist Mono
 * labels, and the periwinkle brand. Palette only (src/lib/og/palette.ts).
 *
 * - SiteCard: the home hero as a card, with the name, the role line and the positioning line
 *   beside a site index tile whose Stats row carries the live badge.
 * - PageCard: one wide tile with a page's title and description under the name and host.
 *
 * Satori lays out flexbox only: every element with more than one child sets display: flex.
 */

import type { CSSProperties, ReactElement } from 'react';
import { app } from '@/constants';
import { SITE_HOST, SITE_ROLE } from './constants';
import { OG_PALETTE as C, OG_TINTS as T } from './palette';
import { fitDescription, fitTitle } from './text';
import { WolfMark } from './wolf-mark';

const SANS = 'Geist';
const MONO = 'Geist Mono';

/** The canvas with the brand's faint light in two corners, as behind the site's pages. */
const CANVAS: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  padding: 40,
  gap: 24,
  backgroundColor: C.canvas,
  backgroundImage: `radial-gradient(circle at 12% 0%, ${T['brand-glow']} 0%, transparent 48%), radial-gradient(circle at 100% 100%, ${T['brand-glow']} 0%, transparent 42%)`,
  color: C.fg,
  fontFamily: SANS,
};

/** A tile: surface-1 with a hairline border, a touch lighter towards its top-left like the hero. */
const TILE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 28,
  border: `1px solid ${C.hairline}`,
  backgroundColor: C['surface-1'],
  backgroundImage: `linear-gradient(160deg, ${C['surface-2']} 0%, ${C['surface-1']} 62%)`,
};

/** The wolf mark in a small canvas tile, where the hero has the avatar. */
function MarkBadge({ size }: { readonly size: number }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size / 4,
        border: `1px solid ${C.hairline}`,
        backgroundColor: C.canvas,
      }}
    >
      <WolfMark size={Math.round(size * 0.66)} />
    </div>
  );
}

/** The external-link arrow the hero's GitHub and LinkedIn pills carry (lucide arrow-up-right). */
function ArrowUpRight(): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={C.fg}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

/** The hero's four link pills: the filled brand one first, then the hairline outlines. */
function HeroLinks(): ReactElement {
  const pill: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 52,
    padding: '0 22px',
    borderRadius: 999,
    fontSize: 21,
    fontWeight: 500,
  };
  const ghost: CSSProperties = { ...pill, border: `1px solid ${C.hairline}`, color: C.fg };
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ ...pill, padding: '0 26px', backgroundColor: C.brand, color: C.canvas }}>
        Email me
      </div>
      <div style={ghost}>
        GitHub
        <ArrowUpRight />
      </div>
      <div style={ghost}>
        LinkedIn
        <ArrowUpRight />
      </div>
      <div style={ghost}>Résumé</div>
    </div>
  );
}

/** One section in the index: its name, and its path in mono. */
interface IndexRow {
  readonly label: string;
  readonly path: string;
  /** Whether the page reads live (the Stats page's Discord activity): shows the live badge. */
  readonly live?: boolean;
}

const SITE_INDEX: readonly IndexRow[] = [
  { label: 'Projects', path: '/projects' },
  { label: 'Places', path: '/places' },
  { label: 'Certifications', path: '/certifications' },
  { label: 'Guestbook', path: '/guestbook' },
  { label: 'Stats', path: '/stats', live: true },
];

/** The live badge: the status colour next to its word, on its own tint, never colour alone. */
function LiveBadge(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        borderRadius: 999,
        backgroundColor: T['live-tint'],
        color: C.live,
        fontFamily: MONO,
        fontSize: 16,
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: C.live }} />
      live
    </div>
  );
}

/** The site index tile: each section's name and path, the live one badged. */
function IndexTile(): ReactElement {
  return (
    <div style={{ ...TILE, width: 336, padding: '30px 30px 14px' }}>
      <div style={{ display: 'flex', color: C['fg-muted'], fontSize: 18, marginBottom: 10 }}>
        Site index
      </div>
      {SITE_INDEX.map((row, index) => (
        <div
          key={row.path}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '16px 0',
            borderTop: index === 0 ? 'none' : `1px solid ${C.hairline}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', fontSize: 25, fontWeight: 500 }}>{row.label}</div>
            {row.live ? <LiveBadge /> : null}
          </div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, color: C['fg-faint'] }}>
            {row.path}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The card for the site itself: the home hero as a tile, beside the site index. */
export function SiteCard(): ReactElement {
  return (
    <div style={CANVAS}>
      <div style={{ ...TILE, flex: 1, padding: '48px 56px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <MarkBadge size={72} />
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 22, color: C['fg-faint'] }}>
            {SITE_HOST}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 112,
              fontWeight: 600,
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {app.name}
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 38, fontWeight: 500 }}>
            {SITE_ROLE}
          </div>
          <div style={{ display: 'flex', marginTop: 10, fontSize: 30, color: C['fg-muted'] }}>
            {app.tagline}
          </div>
        </div>
        <HeroLinks />
      </div>
      <IndexTile />
    </div>
  );
}

/** Props for {@link PageCard}: the page's text, already read and clipped (src/lib/og/text.ts). */
export interface PageCardProps {
  readonly title: string;
  readonly description: string;
}

/** The card for one page: its title and description in one wide tile, under the name and host. */
export function PageCard({ title, description }: PageCardProps): ReactElement {
  const fitted = fitTitle(title);
  const body = fitDescription(description, fitted);
  return (
    <div style={CANVAS}>
      <div style={{ ...TILE, flex: 1, padding: '48px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <MarkBadge size={64} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', fontSize: 26, fontWeight: 600 }}>{app.name}</div>
              <div
                style={{ display: 'flex', fontFamily: MONO, fontSize: 17, color: C['fg-faint'] }}
              >
                {SITE_ROLE}
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              padding: '10px 20px',
              borderRadius: 999,
              border: `1px solid ${T['brand-edge']}`,
              backgroundColor: T['brand-wash'],
              color: C['brand-ink'],
              fontFamily: MONO,
              fontSize: 20,
            }}
          >
            {SITE_HOST}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            paddingTop: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: fitted.fontSize,
              fontWeight: 600,
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
            }}
          >
            {fitted.text}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 24,
              maxWidth: 920,
              fontSize: 30,
              lineHeight: 1.4,
              color: C['fg-muted'],
            }}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
