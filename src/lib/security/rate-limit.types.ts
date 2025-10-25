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

/**
 * Helper type describing the rate limiting parameters for an identifier.
 *
 * @typedef {object} RateLimitHelper
 * @property {'default'|'forcedSlowMode'|'auth'|'api'|'apiv1'|'ai'} [rateLimitingType] - The type of rate limit to use. Defaults to 'default'.
 * @property {string} identifier - A unique identifier for the limiting scope, typically a user ID or IP.
 * @readonly
 * @public
 * @version 1.0.0
 * @author Mike Odnis (
 * @WomB0ComB0 )
 * @see {@link https://github.com/WomB0ComB0/portfolio}
 */
export type RateLimitHelper = {
  rateLimitingType?: 'default' | 'forcedSlowMode' | 'auth' | 'api' | 'apiv1' | 'ai';
  identifier: string;
};
