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

export const topTracksSchema = {
  'top-tracks.response': t.Array(
    t.Object({
      name: t.String(),
      artist: t.Optional(t.String()),
      url: t.Optional(t.String()),
      imageUrl: t.Optional(t.String()),
    }),
  ),
  'top-tracks.error': t.Object({
    error: t.String(),
  }),
};
