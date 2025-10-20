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

import { edenTreaty } from '@elysiajs/eden';
import type { API } from '@/app/api/[[...route]]/route';
import type { API_V1 } from '@/app/api/v1';
import { getURL } from '@/utils';
import 'server-only';

/**
 * Instantiates a type-safe, server-only API client for v1 endpoints using the Eden treaty pattern.
 *
 * @type {import('@elysiajs/eden').EdenTreaty<API_V1>}
 * @readonly
 * @public
 * @web
 * @author Mike Odnis <WomB0ComB0>
 * @version 1.0.0
 * @see {@link https://elysiajs.com/eden/treaty.html Eden Treaty Documentation}
 * @see {@link https://github.com/WomB0ComB0/portfolio Portfolio Repository}
 * @remarks
 * This instance enforces server-side usage only via the `server-only` import. It provides full type safety and auto-complete for all v1 API routes.
 * @example
 * * // Fetch data from the v1 API
 * const result = await apiv1.exampleRoute.get();
 * ```
 * @throws {Error} Network errors or contract violations may throw exceptions at runtime.
 * @returns {import('@elysiajs/eden').EdenTreaty<API_V1>} A treaty-wrapped, type-safe API v1 client instance.
 */
const apiv1 = edenTreaty<API_V1>(getURL());

/**
 * Instantiates a type-safe, server-only API client for the full app router using the Eden treaty pattern.
 *
 * @type {import('@elysiajs/eden').EdenTreaty<API>}
 * @readonly
 * @public
 * @web
 * @author Mike Odnis <WomB0ComB0>
 * @version 1.0.0
 * @see {@link https://elysiajs.com/eden/treaty.html Eden Treaty Documentation}
 * @see {@link https://github.com/WomB0ComB0/portfolio Portfolio Repository}
 * @remarks
 * This instance enforces server-side usage only via the `server-only` import. It provides full type safety and auto-complete for all route endpoints.
 * @example
 * ```ts
 * // Fetch data from any API endpoint
 * const data = await api.someEndpoint.get();
 * ```
 * @throws {Error} Network errors or contract violations may throw exceptions at runtime.
 * @returns {import('@elysiajs/eden').EdenTreaty<API>} A treaty-wrapped, type-safe API client instance for all app endpoints.
 */
const api = edenTreaty<API>(getURL());

export { api, apiv1 };
