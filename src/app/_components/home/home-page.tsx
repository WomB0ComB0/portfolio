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
 * @file The home page: the Live Console bento. A server component that lays out ten slots in
 * reading order (hero, now playing, status, LeetCode, typing, GitHub, featured project, last
 * place, current roles, site index); bento.module.css places them in its grid areas.
 *
 * Every slot but the hero is its own loading and failure unit: a SectionBoundary whose fallback is
 * the tile's own error state, around a Suspense whose fallback is the tile's skeleton, around a
 * tile whose loader never throws and stops waiting at its deadline. So no tile can fail the page
 * or hold the stream past its deadline, and a fallback sits in the same area as the tile it stands
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
import { TileLabel, TileUnavailable } from './tiles/tile-states';

/** The bento's grid areas in DOM order, which bento.module.css keeps as the visual order too. */
export const BENTO_AREAS = [
  'hero',
  'now',
  'status',
  'leet',
  'type',
  'gh',
  'proj',
  'place',
  'role',
  'strip',
] as const;

export type BentoArea = (typeof BENTO_AREAS)[number];

const SPOTIFY_PATH = '/spotify';

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
  label: string;
  message: string;
  href: string;
  linkLabel: string;
  external?: boolean;
}

/**
 * A live island's error-boundary fallback. Static, with no hooks, so it cannot fail the way the
 * island just did, and it promises no retry. Plain: its only link is the note's way out.
 */
function LiveTileFallback({ label, ...note }: LiveTileFallbackProps): ReactElement {
  return (
    <Tile className="gap-3" data-state="error">
      <TileLabel>{label}</TileLabel>
      <TileUnavailable className="mt-auto" {...note} />
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
        label="Now playing"
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
        label="Status"
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
    label: 'Last place',
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

/** One grid area. `data-bento-slot` names it for the browser checks (module classes are hashed). */
function Slot({ area, children }: SlotProps): ReactElement {
  return (
    <div className={cn(styles.slot, styles[area])} data-bento-slot={area}>
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
 * hero holds the page's h1 and every tile names itself with an h2.
 */
export function HomePage(): ReactElement {
  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        <Slot area="hero">
          <HeroTile />
        </Slot>
        {DATA_SLOTS.map((slot) => (
          <DataSlot key={slot.area} {...slot} />
        ))}
      </div>
    </div>
  );
}
