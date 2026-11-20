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
import env from '@/env';
import { FIRST_FLUSH_WAIT_MS, fulfilledWithin, settledWithin } from '@/lib/async/settled-within';
import { constructMetadata } from '@/utils';
import { StreamedStatsConsole } from './_interface/stats-console/stats-console';
import { startStatsConsole } from './_lib/console-loaders';

/**
 * @readonly
 * @type {import('next').Metadata}
 * @description
 *      Page metadata for the Stats page, including title and description,
 *      for SEO and enhanced snippet in web crawlers.
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 */
export const metadata = constructMetadata({
  title: 'Stats',
  description:
    "What I'm up to on Discord right now, plus GitHub, LeetCode, coding-time and typing stats that refresh every few hours.",
  path: '/stats',
});

/**
 * Starts every source at once and waits for them FIRST_FLUSH_WAIT_MS at most, so the first byte
 * never waits on a slow source's deadline. Every part whose sources have answered by then (all of
 * them when the caches are warm) is rendered in place, readable without JavaScript; any other
 * streams in its own Suspense boundary once its own sources settle (each within its deadline),
 * behind a skeleton of its own size. There is no loading.tsx: the parts' skeletons are the
 * loading state. Discord alone polls after hydration.
 */
export default async function StatsPage(): Promise<ReactElement> {
  const sources = startStatsConsole();
  const settled = fulfilledWithin(await settledWithin(sources, FIRST_FLUSH_WAIT_MS));
  return (
    <StreamedStatsConsole
      sources={sources}
      settled={settled}
      profileId={env.NEXT_PUBLIC_DISCORD_ID}
    />
  );
}
