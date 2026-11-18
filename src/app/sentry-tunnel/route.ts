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
 * @file App Router handler at `/sentry-tunnel`, the path `@sentry/nextjs`'s Vercel build plugin
 * (`setUpManagedTunnelVercelRoute`) checks via `findTunnelRouteHandlerFile` and rewrites
 * `application/x-sentry-envelope` requests to. Keeping this file in the repository prevents
 * `withSentryConfig` from generating the default `@sentry/nextjs/tunnel` route at build time.
 */

export const maxDuration = 15;

export { POST } from '../monitoring/route';
