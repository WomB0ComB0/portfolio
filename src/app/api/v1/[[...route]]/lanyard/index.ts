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
import { getLanyardData } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { lanyardSchema } from './schema';

export const lanyardRoute = new Elysia({ prefix: '/lanyard' }).model(lanyardSchema).get(
  '/',
  async ({ set }) => {
    try {
      // Since the data shape is dynamic, we cast to any here and let schema validation handle it later (I was lazy)
      const data = (await getLanyardData()) as any;
      set.headers = cacheHeaders();
      // Return raw data for validation, superjson will be applied in transform
      return data;
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
