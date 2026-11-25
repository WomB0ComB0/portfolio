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
 * @file The link-preview cards in the Live Console look, as next/og (Satori) draws them: a top
 * `*.mikeodnis.dev` constellation rail over asymmetric `surface-1` tiles with hairline borders on
 * the tinted-black canvas, Geist with Geist Mono labels, and the periwinkle/live accents.
 * Palette only (src/lib/og/palette.ts).
 *
 * - SiteCard: constellation bar + hero tile (name, role, positioning line, links) beside a
 *   structured site index tile whose Stats row carries the live badge.
 * - PageCard: constellation header + wide editorial tile with a left brand accent bar, fitted
 *   page title/description, and ecosystem footer rail.
 *
 * Satori lays out flexbox only: every element with more than one child sets display: flex.
 */

import type { CSSProperties, ReactElement } from 'react';
import { app } from '@/constants/app';
import { ECOSYSTEM_HOSTS, SITE_HOST, SITE_ROLE } from './constants';
import { OG_PALETTE as C, OG_TINTS as T } from './palette';
import { fitDescription, fitTitle } from './text';
import { WolfMark } from './wolf-mark';

const SANS = 'Geist';
const MONO = 'Geist Mono';

/** The canvas with the brand's faint light in two corners, as behind the site's pages. */
const CANVAS: CSSProperties = {
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

/** A tile: surface-1 with a hairline border, a touch lighter towards its top-left like the hero. */
const TILE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 24,
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
        borderRadius: Math.round(size / 4),
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
      width="17"
      height="17"
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

/** The live badge: the status colour next to its word, on its own tint, never colour alone. */
function LiveBadge({ label = 'live' }: { readonly label?: string }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '4px 12px',
        borderRadius: 999,
        backgroundColor: T['live-tint'],
        color: C.live,
        fontFamily: MONO,
        fontSize: 15,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: C.live }} />
      {label}
    </div>
  );
}

/** Top constellation bar: wolf mark, canonical host and companion *.mikeodnis.dev subdomains. */
function ConstellationBar(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 22px',
        borderRadius: 18,
        border: `1px solid ${C.hairline}`,
        backgroundColor: C['surface-1'],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <MarkBadge size={40} />
        <div
          style={{
            display: 'flex',
            fontFamily: MONO,
            fontSize: 20,
            color: C.fg,
          }}
        >
          {SITE_HOST}
        </div>
        <div style={{ width: 1, height: 18, backgroundColor: C.hairline }} />
        <div
          style={{
            display: 'flex',
            fontFamily: MONO,
            fontSize: 15,
            color: C['fg-faint'],
          }}
        >
          *.mikeodnis.dev
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {ECOSYSTEM_HOSTS.map((host) => (
          <div
            key={host}
            style={{
              display: 'flex',
              padding: '5px 12px',
              borderRadius: 999,
              border: `1px solid ${C.hairline}`,
              backgroundColor: C['surface-2'],
              color: C['fg-muted'],
              fontFamily: MONO,
              fontSize: 14,
            }}
          >
            {host}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The hero's four link pills: the filled brand one first, then the hairline outlines. */
function HeroLinks(): ReactElement {
  const pill: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 46,
    padding: '0 20px',
    borderRadius: 999,
    fontSize: 19,
    fontWeight: 500,
  };
  const ghost: CSSProperties = {
    ...pill,
    border: `1px solid ${C.hairline}`,
    backgroundColor: C['surface-2'],
    color: C.fg,
  };
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{ ...pill, padding: '0 24px', backgroundColor: C.brand, color: C.canvas }}>
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

/** The site index tile: structured horizontal rows with path right-aligned in mono. */
function IndexTile(): ReactElement {
  return (
    <div style={{ ...TILE, width: 380, padding: '26px 28px', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: MONO,
              fontSize: 14,
              color: C['fg-faint'],
              letterSpacing: '0.08em',
            }}
          >
            SITE INDEX
          </div>
          <div
            style={{
              display: 'flex',
              padding: '3px 10px',
              borderRadius: 999,
              border: `1px solid ${T['brand-edge']}`,
              backgroundColor: T['brand-wash'],
              color: C['brand-ink'],
              fontFamily: MONO,
              fontSize: 13,
            }}
          >
            05 routes
          </div>
        </div>

        {SITE_INDEX.map((row, index) => (
          <div
            key={row.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 0',
              borderTop: index === 0 ? 'none' : `1px solid ${C.hairline}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 500, color: C.fg }}>
                {row.label}
              </div>
              {row.live ? <LiveBadge /> : null}
            </div>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, color: C['fg-faint'] }}>
              {row.path}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 14,
          borderTop: `1px solid ${C.hairline}`,
          fontFamily: MONO,
          fontSize: 14,
          color: C['fg-faint'],
        }}
      >
        <div style={{ display: 'flex', color: C['brand-ink'] }}>status.mikeodnis.dev</div>
        <div style={{ display: 'flex', color: C.live }}>operational</div>
      </div>
    </div>
  );
}

/** The card for the site itself: constellation bar above the hero tile and site index. */
export function SiteCard(): ReactElement {
  return (
    <div style={CANVAS}>
      <ConstellationBar />
      <div style={{ display: 'flex', flex: 1, gap: 20 }}>
        <div style={{ ...TILE, flex: 1, padding: '40px 48px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1px solid ${T['brand-edge']}`,
                  backgroundColor: T['brand-wash'],
                  color: C['brand-ink'],
                  fontFamily: MONO,
                  fontSize: 16,
                }}
              >
                {SITE_ROLE}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                marginTop: 26,
                fontSize: 98,
                fontWeight: 600,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                color: C.fg,
              }}
            >
              {app.name}
            </div>

            <div
              style={{
                display: 'flex',
                marginTop: 22,
                fontSize: 28,
                lineHeight: 1.35,
                color: C['fg-muted'],
              }}
            >
              {app.tagline}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              paddingTop: 22,
              borderTop: `1px solid ${C.hairline}`,
            }}
          >
            <HeroLinks />
          </div>
        </div>
        <IndexTile />
      </div>
    </div>
  );
}

/** Props for {@link PageCard}: the page's text, already read and clipped (src/lib/og/text.ts). */
export interface PageCardProps {
  readonly title: string;
  readonly description: string;
}

/** The card for one page: its title and description in one wide tile, under the console bar. */
export function PageCard({ title, description }: PageCardProps): ReactElement {
  const fitted = fitTitle(title);
  const body = fitDescription(description, fitted);
  return (
    <div style={CANVAS}>
      <div style={{ ...TILE, flex: 1, padding: '42px 54px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <MarkBadge size={56} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 600 }}>{app.name}</div>
              <div
                style={{ display: 'flex', fontFamily: MONO, fontSize: 16, color: C['fg-faint'] }}
              >
                {SITE_ROLE}
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              padding: '9px 18px',
              borderRadius: 999,
              border: `1px solid ${T['brand-edge']}`,
              backgroundColor: T['brand-wash'],
              color: C['brand-ink'],
              fontFamily: MONO,
              fontSize: 19,
            }}
          >
            {SITE_HOST}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 24,
            flex: 1,
            padding: '28px 0',
          }}
        >
          <div
            style={{
              width: 4,
              borderRadius: 999,
              backgroundColor: C.brand,
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: fitted.fontSize,
                fontWeight: 600,
                letterSpacing: '-0.035em',
                lineHeight: 1.05,
                color: C.fg,
              }}
            >
              {fitted.text}
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 22,
                maxWidth: 920,
                fontSize: 28,
                lineHeight: 1.4,
                color: C['fg-muted'],
              }}
            >
              {body}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 18,
            borderTop: `1px solid ${C.hairline}`,
            fontFamily: MONO,
            fontSize: 15,
            color: C['fg-faint'],
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            <span>*.mikeodnis.dev</span>
            {ECOSYSTEM_HOSTS.map((host) => (
              <span key={host} style={{ color: C['fg-muted'] }}>
                {host}
              </span>
            ))}
          </div>
          <LiveBadge />
        </div>
      </div>
    </div>
  );
}
