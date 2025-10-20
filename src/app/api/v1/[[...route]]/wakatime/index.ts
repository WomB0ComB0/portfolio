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
import { getWakaTimeData } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { wakatimeSchema } from './schema';

export const wakatimeRoute = new Elysia({ prefix: '/wakatime' }).model(wakatimeSchema).get(
  '/',
  async ({ set }) => {
    try {
      const data = await getWakaTimeData();
      set.headers = cacheHeaders();
      return data;
    } catch (error) {
      const errorResponse = errorHandler(error);
      set.status = StatusMap['Internal Server Error'];
      return { error: errorResponse.error };
    }
  },
  {
    response: {
      200: 'wakatime.response',
      500: 'wakatime.error',
    },
  },
);
