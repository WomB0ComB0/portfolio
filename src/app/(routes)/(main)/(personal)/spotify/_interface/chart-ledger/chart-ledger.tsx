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
 * @file /spotify as the Chart ledger (the owner's pick, 2026-11-10): a PageShell header with the
 * chart's figures, the now-playing hero, the top ten artists, then the top tracks as a ranked
 * table. Presentational and server-safe (no directive, no hooks): the page and the lab station
 * load the data and pass it in, and the hero arrives as a node (the live island on the page, a
 * sample in the lab).
 *
 * The rhythm is uneven on purpose: the hero and the strip sit close (both are "who"), the table
 * a step further down (the long list).
 */

import type { ReactElement, ReactNode } from 'react';

import { PageShell } from '@/components/console/page-shell';
import { StatStrip, type StatStripItem } from '@/components/console/stat-strip';
import { ArtistStrip } from '../../_components/artist-strip';
import { TrackTable } from '../../_components/track-table';
import {
  type ChartArtist,
  type ChartListResult,
  type ChartStats,
  type ChartTrack,
  chartStats,
} from '../../_lib/chart';

/** The nav's label, so the h1 and the menu agree. */
const SPOTIFY_TITLE = 'Spotify';
const EYEBROW = 'Listening';
const DESCRIPTION = "What I've had on repeat over the last four weeks.";

export interface ChartLedgerProps {
  readonly tracks: ChartListResult<ChartTrack>;
  readonly artists: ChartListResult<ChartArtist>;
  /** The now-playing hero: the live island, or a lab sample. */
  readonly hero: ReactNode;
  /** Pads the sides with the page gutter (PageShell's); off inside a frame that already does. */
  readonly gutter?: boolean;
}

/**
 * The header's three figures. Without a chart (Spotify failed) each is an em dash that readers
 * hear as "unavailable", so the header keeps its shape.
 */
function statItems(stats: ChartStats | null): StatStripItem[] {
  return [
    { label: 'top tracks', value: stats?.tracks ?? null },
    { label: 'artists in them', value: stats?.artists ?? null },
    { label: 'runtime', value: stats?.minutes ?? null, unit: 'min' },
  ];
}

/**
 * The whole page body. The header and its figures are sized by the page container in lines of
 * its own text (`sizing="container"`, as Stats is), so with text enlarged on a phone a figure
 * wraps to a row of its own instead of running past the screen; at the browser's own size the
 * header steps where the md viewport did.
 *
 * @example
 * <ChartLedger tracks={tracks} artists={artists} hero={<LiveHero initial={hero.initial} />} />
 */
export function ChartLedger({ tracks, artists, hero, gutter }: ChartLedgerProps): ReactElement {
  const stats = tracks.status === 'ok' ? chartStats(tracks.data) : null;
  return (
    <PageShell
      eyebrow={EYEBROW}
      title={SPOTIFY_TITLE}
      description={DESCRIPTION}
      stats={
        <StatStrip aria-label="The chart at a glance" items={statItems(stats)} sizing="container" />
      }
      gutter={gutter}
      sizing="container"
    >
      <div className="flex min-w-0 flex-col gap-8 @min-[48rem]/page:gap-10">
        <div className="flex min-w-0 flex-col gap-5">
          {hero}
          <ArtistStrip result={artists} />
        </div>
        <TrackTable result={tracks} />
      </div>
    </PageShell>
  );
}
