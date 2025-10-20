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

import { t } from 'elysia';

export const githubStatsSchema = {
  'github-stats.response': t.Object({
    user: t.Object({
      repos: t.Number(),
      followers: t.Number(),
      avatar_url: t.String(),
    }),
    stats: t.Object({
      totalStars: t.Number(),
      topLanguages: t.Array(t.String()),
    }),
    topRepos: t.Array(
      t.Object({
        name: t.String(),
        description: t.Union([t.String(), t.Null()]),
        stars: t.Number(),
        language: t.Union([t.String(), t.Null()]),
        url: t.String(),
      }),
    ),
  }),
  'github-stats.error': t.Object({
    error: t.String(),
  }),
};
