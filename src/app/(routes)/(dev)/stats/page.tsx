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
import { Stats } from '@/app/(routes)/(dev)/stats/_interface/stats';
import { constructMetadata } from '@/utils';

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
 * The /stats page. A server component: the GitHub, LeetCode, Dev Stats and Monkeytype numbers
 * are loaded on the server and stream into the HTML card by card; only the live Discord card
 * fetches in the browser. The route has no loading.tsx on purpose: nothing above the cards is
 * awaited and each card has its own Suspense skeleton (see `_interface/stats/stats.tsx`).
 */
export default function StatsPage(): ReactElement {
  return <Stats />;
}
