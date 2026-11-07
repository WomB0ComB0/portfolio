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

import 'server-only';

/**
 * @file The home page: the Live Console bento, Waterfall. A server component that renders ten
 * slots as one flat list in priority order (hero, now playing, status, LeetCode, typing, GitHub,
 * project, place, current roles, site index), which is the reading order too. bento.module.css
 * packs them into the shortest lane; each slot carries its estimated span per tier
 * (bento-layout.ts), so the server HTML already paints the packed layout, and the BentoMasonry
 * island swaps in measured spans where the browser has no native masonry.
 *
 * Every slot but the hero is its own loading and failure unit: a SectionBoundary whose fallback is
 * the tile's own error state, around a Suspense whose fallback is the tile's skeleton, around a
 * tile whose loader never throws and stops waiting at its deadline. So no tile can fail the page
 * or hold the stream past its deadline, and a fallback sits in the same slot as the tile it stands
 * for. The hero has no Suspense, so its h1 is in the first flush; only its role line streams.
 *
 * A tile that resolves after the first flush is streamed in a hidden chunk that an inline script
 * moves into place. With JavaScript off that tile shows its skeleton, though its content is in
 * the HTML. No loading.tsx: the slots' own skeletons are the loading state.
 */

import { type ReactElement, type ReactNode, Suspense } from 'react';

import { Tile } from '@/components/console/tile';
import { SectionBoundary } from '@/components/data/section-boundary';
import { STATUS_PAGE_URL } from '@/lib/status/service-state';
import { cn } from '@/lib/utils';
import styles from './bento.module.css';
import { type BentoArea, slotEstimateStyle } from './bento-layout';
import { BentoMasonry } from './bento-masonry';
import { loadNowPlaying, loadServiceStatus } from './data/loaders';
import type { TileResult } from './data/tile-result';
import { NowPlayingTile, NowPlayingTileSkeleton } from './live/now-playing-tile';
import { StatusTile, StatusTileSkeleton } from './live/status-tile';
import { GitHubTile, GitHubTileSkeleton, GitHubTileView } from './tiles/github-tile';
import { HeroTile } from './tiles/hero-tile';
import {
  LeetCodeTile,
  LeetCodeTileSkeleton,
  LeetCodeTileView,
  TypingTile,
  TypingTileSkeleton,
  TypingTileView,
} from './tiles/metric-tiles';
import { PlaceTile, PlaceTileSkeleton, PlaceTileView } from './tiles/place-tile';
import { ProjectTile, ProjectTileSkeleton, ProjectTileView } from './tiles/project-tile';
import { RolesTile, RolesTileSkeleton, RolesTileView } from './tiles/roles-tile';
import {
  SiteIndexTile,
  SiteIndexTileSkeleton,
  SiteIndexTileView,
  UNKNOWN_SITE_COUNTS,
} from './tiles/site-index-tile';
import { TileUnavailable } from './tiles/tile-states';

const SPOTIFY_PATH = '/spotify';

/**
 * The live islands' hidden h2s when they cannot say what is playing or how the site is: their
 * fallbacks name themselves the same way. Repeated here because a server component that imports a
 * value from a 'use client' module gets a client reference, not the string
 * (now-playing-tile.tsx's SPOTIFY_TITLE, status-tile.tsx's STATUS_TILE_TITLE).
 */
const NOW_PLAYING_FALLBACK_TITLE = 'Spotify';
const STATUS_FALLBACK_TITLE = 'Site status';

/** What every server tile's error fallback renders: its own error state, never a number. */
const TILE_ERROR: TileResult<never> = { status: 'error' };

/** One data slot: its area, its name in error reports, and its three states. */
interface DataSlotSpec {
  readonly area: Exclude<BentoArea, 'hero'>;
  /** SectionBoundary's label: the `section` tag on a client-side failure's report. */
  readonly label: string;
  readonly Content: () => ReactNode | Promise<ReactNode>;
  readonly Skeleton: () => ReactNode;
  readonly Fallback: () => ReactNode;
}

interface LiveTileFallbackProps {
  /** The h2, for screen readers only, as on the island it stands in for. */
  title: string;
  message: string;
  href: string;
  linkLabel: string;
  external?: boolean;
}

/**
 * A live island's error-boundary fallback. Static, with no hooks, so it cannot fail the way the
 * island just did, and it promises no retry. Plain: its only link is the note's way out. Slim like
 * the compact now playing and status tiles: no visible label (their words name them), and it hugs
 * its one line.
 */
function LiveTileFallback({ title, ...note }: LiveTileFallbackProps): ReactElement {
  return (
    <Tile data-state="error">
      <h2 className="sr-only">{title}</h2>
      <TileUnavailable {...note} />
    </Tile>
  );
}

/** The now-playing island, seeded with the server's Spotify snapshot. */
async function NowPlayingSlot(): Promise<ReactElement> {
  return <NowPlayingTile initial={await loadNowPlaying()} />;
}

/** The status island, seeded with the server's status check. */
async function StatusSlot(): Promise<ReactElement> {
  return <StatusTile initial={await loadServiceStatus()} />;
}

/** The nine data slots, in DOM order after the hero. */
const DATA_SLOTS: readonly DataSlotSpec[] = [
  {
    area: 'now',
    label: 'Now playing',
    Content: NowPlayingSlot,
    Skeleton: NowPlayingTileSkeleton,
    Fallback: () => (
      <LiveTileFallback
        title={NOW_PLAYING_FALLBACK_TITLE}
        message="Now playing unavailable"
        href={SPOTIFY_PATH}
        linkLabel="Top tracks"
      />
    ),
  },
  {
    area: 'status',
    label: 'Status',
    Content: StatusSlot,
    Skeleton: StatusTileSkeleton,
    Fallback: () => (
      <LiveTileFallback
        title={STATUS_FALLBACK_TITLE}
        message="Status unavailable"
        href={STATUS_PAGE_URL}
        linkLabel="Status page"
        external
      />
    ),
  },
  {
    area: 'leet',
    label: 'LeetCode',
    Content: LeetCodeTile,
    Skeleton: LeetCodeTileSkeleton,
    Fallback: () => <LeetCodeTileView result={TILE_ERROR} />,
  },
  {
    area: 'type',
    label: 'Typing',
    Content: TypingTile,
    Skeleton: TypingTileSkeleton,
    Fallback: () => <TypingTileView result={TILE_ERROR} />,
  },
  {
    area: 'gh',
    label: 'GitHub activity',
    Content: GitHubTile,
    Skeleton: GitHubTileSkeleton,
    Fallback: () => <GitHubTileView result={TILE_ERROR} />,
  },
  {
    area: 'proj',
    // Not 'Featured project': the tile is the owner's latest work when his commits pick it.
    label: 'Project',
    Content: ProjectTile,
    Skeleton: ProjectTileSkeleton,
    Fallback: () => <ProjectTileView result={TILE_ERROR} />,
  },
  {
    area: 'place',
    // The tile's own label: it shows past visits only (owner decision).
    label: 'Recently at',
    Content: PlaceTile,
    Skeleton: PlaceTileSkeleton,
    Fallback: () => <PlaceTileView result={TILE_ERROR} />,
  },
  {
    area: 'role',
    label: 'Current roles',
    Content: RolesTile,
    Skeleton: RolesTileSkeleton,
    Fallback: () => <RolesTileView result={TILE_ERROR} />,
  },
  {
    area: 'strip',
    label: 'Site index',
    Content: SiteIndexTile,
    Skeleton: SiteIndexTileSkeleton,
    Fallback: () => <SiteIndexTileView counts={UNKNOWN_SITE_COUNTS} />,
  },
];

interface SlotProps {
  area: BentoArea;
  children: ReactNode;
}

/**
 * One slot of the waterfall: its lanes come from its area's class (only some areas have one),
 * its span from the estimates until the island measures it. `data-bento-slot` names it for the
 * browser checks and the island (module classes are hashed).
 */
function Slot({ area, children }: SlotProps): ReactElement {
  return (
    <div
      className={cn(styles.slot, styles[area])}
      style={slotEstimateStyle(area)}
      data-bento-slot={area}
    >
      {children}
    </div>
  );
}

function DataSlot({ area, label, Content, Skeleton, Fallback }: DataSlotSpec): ReactElement {
  return (
    <Slot area={area}>
      <SectionBoundary label={label} fallback={<Fallback />}>
        <Suspense fallback={<Skeleton />}>
          <Content />
        </Suspense>
      </SectionBoundary>
    </Slot>
  );
}

/**
 * The home page body. src/app/(routes)/page.tsx renders it inside the shell's main, which is
 * full-bleed, so the bento pads its own sides with --page-gutter. No landmarks of its own: the
 * hero holds the page's h1 and every tile names itself with an h2. The slots are the grid's
 * direct children, rendered here on the server and passed through the island untouched.
 */
export function HomePage(): ReactElement {
  return (
    <div className={styles.container}>
      <BentoMasonry className={styles.grid}>
        <Slot area="hero">
          <HeroTile />
        </Slot>
        {DATA_SLOTS.map((slot) => (
          <DataSlot key={slot.area} {...slot} />
        ))}
      </BentoMasonry>
    </div>
  );
}
