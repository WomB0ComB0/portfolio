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

import { Elysia } from 'elysia';
import { blogRoute } from './blog';
import { githubSponsorsRoute } from './github-sponsors';
import { githubStatsRoute } from './github-stats';
import { googleRoute } from './google';
import { lanyardRoute } from './lanyard';
import { leetCodeStatsRoute } from './leetcode';
import { messagesRoute } from './messages';
import { nowPlayingRoute } from './now-playing';
import { sanityRoutes } from './sanity';
import { topArtistsRoute } from './top-artists';
import { topTracksRoute } from './top-tracks';
import { wakatimeRoute } from './wakatime';

/**
 * API routes for all endpoints.
 * Includes:
 *   - /now-playing (Spotify)
 *   - /lanyard (Discord)
 *   - /wakatime
 *   - /github-stats
 *   - /github-sponsors (GitHub Sponsors)
 *   - /google (Analytics)
 *   - /top-artists (Spotify)
 *   - /top-tracks (Spotify)
 *   - /blog
 *   - /messages (GET and POST)
 *   - /sanity/* (CMS content)
 * @type {Elysia}
 */
export const apiRoutes = new Elysia()
  .use(nowPlayingRoute)
  .use(lanyardRoute)
  .use(wakatimeRoute)
  .use(githubStatsRoute)
  .use(githubSponsorsRoute)
  .use(googleRoute)
  .use(topArtistsRoute)
  .use(topTracksRoute)
  .use(blogRoute)
  .use(messagesRoute)
  .use(sanityRoutes)
  .use(leetCodeStatsRoute);

export { utilityRoutes } from './utility';
