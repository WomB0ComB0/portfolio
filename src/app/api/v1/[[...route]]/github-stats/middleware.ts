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

import { createCacheHeaders, createErrorHandler } from '@/app/api/_elysia/shared/middleware';

export const cacheHeaders = createCacheHeaders('Medium');

/**
 * A cold failure answers one fixed message. The upstream's own text stays out of the response
 * (GitHub's rate-limit message names the caller's IP, and a failure can name the fetched
 * address); the whole error still goes to the logs and the error tracker under this context.
 */
export const errorHandler = createErrorHandler({
  context: 'fetching GitHub stats',
  customMessage: () => 'Failed to fetch GitHub stats',
});
