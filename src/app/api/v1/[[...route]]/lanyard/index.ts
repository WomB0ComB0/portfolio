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

import { Elysia, StatusMap } from 'elysia';
import { getLanyardSnapshot } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { lanyardSchema } from './schema';

export const lanyardRoute = new Elysia({ prefix: '/lanyard' }).model(lanyardSchema).get(
  '/',
  async ({ set }) => {
    try {
      const { data, readAt } = await getLanyardSnapshot();
      Object.assign(set.headers, cacheHeaders());
      // read_at sits in the body, so a CDN-cached copy keeps the time the presence was read. The
      // decoded activities are a readonly array; the response model types a mutable one.
      return { ...data, activities: [...data.activities], read_at: readAt };
    } catch (error) {
      const errorResponse = errorHandler(error);
      set.status = StatusMap['Internal Server Error'];
      return { error: errorResponse.error };
    }
  },
  {
    response: {
      200: 'lanyard.response',
      500: 'lanyard.error',
    },
  },
);
