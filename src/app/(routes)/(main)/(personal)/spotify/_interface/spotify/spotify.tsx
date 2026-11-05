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
 * @file The /spotify page body, a server component: the header, the live now-playing card (a
 * client island) and the top artists and top tracks, which render on the server and fail one
 * section at a time.
 */

import { type ReactElement, type ReactNode, Suspense } from 'react';
import { SiSpotify } from 'react-icons/si';

import {
  NowPlaying,
  TopArtists,
  TopArtistsSkeleton,
  TopTracks,
  TopTracksSkeleton,
} from '@/app/(routes)/(main)/(personal)/spotify/_components';
import { PageHeader } from '@/components/custom/page-header';
import { SectionBoundary } from '@/components/data/section-boundary';
import { MagicCard } from '@/components/magicui/magic-card';

const NOW_PLAYING_LABEL = 'Now playing';
const TOP_ARTISTS_HEADING_ID = 'spotify-top-artists-heading';
const TOP_TRACKS_HEADING_ID = 'spotify-top-tracks-heading';

interface ListSectionProps {
  /** The heading's id, which names the section. */
  headingId: string;
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * A card with a server-rendered h2 and description. The heading stays while the list loads or
 * fails, since only the children are suspended or replaced.
 */
const ListSection = ({
  headingId,
  title,
  description,
  children,
}: ListSectionProps): ReactElement => (
  <section aria-labelledby={headingId}>
    <MagicCard className="rounded-2xl shadow-2xl p-6 overflow-hidden">
      <h2 id={headingId} className="text-3xl font-bold text-foreground mb-2 text-center">
        {title}
      </h2>
      <p className="text-muted-foreground mb-6 text-center">{description}</p>
      {children}
    </MagicCard>
  </section>
);

interface SpotifyFrameProps {
  nowPlaying: ReactNode;
  topArtists: ReactNode;
  topTracks: ReactNode;
}

/**
 * The page's header and its three sections around what fills them. The header and headings
 * render at once; each section brings its own loading state (see {@link Spotify}), so the route
 * needs no loading.tsx, which would only show a second skeleton and remount the page.
 */
function SpotifyFrame({ nowPlaying, topArtists, topTracks }: SpotifyFrameProps): ReactElement {
  return (
    <div className="w-full min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto mb-10">
        <PageHeader
          title="My Spotify Stats"
          description="A real-time look at my music taste and listening habits"
          icon={<SiSpotify />}
        />
        <div className="space-y-12">
          {/* NowPlaying renders its own visually hidden "Now Playing" h2, so this section takes
              its name from a label rather than adding a second heading with the same words. */}
          <section aria-label={NOW_PLAYING_LABEL}>{nowPlaying}</section>
          <ListSection
            headingId={TOP_ARTISTS_HEADING_ID}
            title="Top Artists"
            description="My most played artists in the last 4 weeks."
          >
            {topArtists}
          </ListSection>
          <ListSection
            headingId={TOP_TRACKS_HEADING_ID}
            title="Top Tracks"
            description="My most played tracks in the last 4 weeks."
          >
            {topTracks}
          </ListSection>
        </div>
      </div>
    </div>
  );
}

/**
 * The /spotify view. The top lists stream in behind their skeletons; each sits in its own
 * SectionBoundary, so one failing (or throwing while it renders) leaves the other and the
 * now-playing card in place.
 */
export function Spotify(): ReactElement {
  return (
    <SpotifyFrame
      nowPlaying={<NowPlaying />}
      topArtists={
        <SectionBoundary label="top artists">
          <Suspense fallback={<TopArtistsSkeleton />}>
            <TopArtists />
          </Suspense>
        </SectionBoundary>
      }
      topTracks={
        <SectionBoundary label="top tracks">
          <Suspense fallback={<TopTracksSkeleton />}>
            <TopTracks />
          </Suspense>
        </SectionBoundary>
      }
    />
  );
}

export default Spotify;
