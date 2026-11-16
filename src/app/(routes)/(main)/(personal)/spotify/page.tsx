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

import type { ReactElement } from 'react';

import { DEFAULT_ART_MODE } from '@/app/(routes)/(main)/(personal)/spotify/_components/art-backlight';
import { LiveHero } from '@/app/(routes)/(main)/(personal)/spotify/_components/live-hero';
import { ChartLedger } from '@/app/(routes)/(main)/(personal)/spotify/_interface/chart-ledger/chart-ledger';
import { loadSpotifyPage } from '@/app/(routes)/(main)/(personal)/spotify/_lib/loaders';
import { constructMetadata } from '@/utils';

export const metadata = constructMetadata({
  title: 'Spotify',
  description:
    "What I'm listening to on Spotify right now, plus my top tracks and artists of the last four weeks.",
  path: '/spotify',
});

/**
 * /spotify as the Chart ledger. A server component that awaits its data at the top (both top
 * lists under a 4 s deadline with stale caches, now playing under the home tile's 2.5 s one), so
 * the ranked tracks, the artist strip and the hero's first state are in the server HTML for
 * crawlers and for visitors without JavaScript. There is no loading.tsx. Only now playing keeps
 * refreshing in the browser. Album-art colour stays inside the images (the default art mode).
 */
export default async function SpotifyPage(): Promise<ReactElement> {
  const { tracks, artists, hero } = await loadSpotifyPage();
  return (
    <ChartLedger
      tracks={tracks}
      artists={artists}
      hero={<LiveHero initial={hero.initial} recent={hero.recent} art={DEFAULT_ART_MODE} />}
    />
  );
}
