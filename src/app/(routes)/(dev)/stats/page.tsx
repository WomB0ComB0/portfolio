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
import { constructMetadata } from '@/utils';
import { StatsConsole } from './_interface/stats-console/stats-console';
import { loadStatsConsole } from './_lib/console-loaders';

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
 * Awaits the bounded, parallel source loaders before rendering so the figures and Discord's
 * first state are readable without JavaScript. There is intentionally no loading.tsx or hidden
 * streamed card. Discord alone continues polling after hydration.
 */
export default async function StatsPage(): Promise<ReactElement> {
  return <StatsConsole data={await loadStatsConsole()} profileId={env.NEXT_PUBLIC_DISCORD_ID} />;
}
